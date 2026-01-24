"""
================================================================================
Module: Prévisions de Production
================================================================================
Description : Prévisions de production de foie gras par site
Technologie : Prophet (Facebook)
Usage       : Prédire production à 7/30/90 jours
================================================================================
"""

from prophet import Prophet
import pandas as pd
import numpy as np
from typing import Dict, Optional
from datetime import datetime, timedelta


class ProductionForecaster:
    """
    Prévisions de production avec Prophet (Facebook)
    """

    def __init__(self):
        self.models = {}  # {site_code: model}
        self.history = {}  # Historique d'entraînement

    def train_site_model(
        self,
        site_code: str,
        historical_data: pd.DataFrame,
        **prophet_kwargs
    ) -> Prophet:
        """
        Entraîner modèle Prophet pour un site

        Args:
            site_code: 'LL', 'LS', 'MT'
            historical_data: DataFrame avec colonnes:
                - date: Date
                - production_kg: Production foie gras en kg
            **prophet_kwargs: Arguments supplémentaires pour Prophet

        Returns:
            Modèle Prophet entraîné
        """

        print(f"\n📊 Entraînement modèle Prophet pour site {site_code}")
        print(f"   Données: {len(historical_data)} jours")

        # Préparer données pour Prophet
        df = historical_data[['date', 'production_kg']].copy()
        df.columns = ['ds', 'y']

        # S'assurer que ds est datetime
        df['ds'] = pd.to_datetime(df['ds'])

        # Supprimer les NaN
        df = df.dropna()

        if len(df) < 30:
            raise ValueError(f"Pas assez de données pour site {site_code} ({len(df)} jours)")

        print(f"   Production moyenne: {df['y'].mean():.1f} kg/jour")
        print(f"   Production min/max: {df['y'].min():.1f} / {df['y'].max():.1f} kg")

        # Modèle Prophet avec paramètres optimisés
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            seasonality_mode='multiplicative',
            interval_width=0.95,
            **prophet_kwargs
        )

        # Ajouter saisonnalité mensuelle
        model.add_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=5
        )

        # Entraîner
        with suppress_stdout():
            model.fit(df)

        # Stocker
        self.models[site_code] = model
        self.history[site_code] = df

        print(f"   ✅ Modèle entraîné avec succès")

        return model

    def forecast(
        self,
        site_code: str,
        periods_days: int = 30
    ) -> pd.DataFrame:
        """
        Générer prévisions

        Args:
            site_code: Code du site
            periods_days: Nombre de jours à prévoir

        Returns:
            DataFrame avec colonnes:
                - date: Date
                - production_kg_prevu: Prévision
                - production_kg_min: Borne inf (95%)
                - production_kg_max: Borne sup (95%)
        """

        if site_code not in self.models:
            raise ValueError(f"Modèle non entraîné pour site {site_code}")

        print(f"\n🔮 Prévisions pour site {site_code} à {periods_days} jours")

        model = self.models[site_code]

        # Créer dataframe futures
        future = model.make_future_dataframe(periods=periods_days)

        # Prédire
        forecast = model.predict(future)

        # Formatter résultats (seulement les futures dates)
        result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods_days).copy()
        result.columns = ['date', 'production_kg_prevu', 'production_kg_min', 'production_kg_max']

        # S'assurer que les valeurs sont positives
        result['production_kg_prevu'] = result['production_kg_prevu'].clip(lower=0)
        result['production_kg_min'] = result['production_kg_min'].clip(lower=0)
        result['production_kg_max'] = result['production_kg_max'].clip(lower=0)

        # Statistiques
        total_prevu = result['production_kg_prevu'].sum()
        print(f"   Production totale prévue: {total_prevu:.1f} kg")
        print(f"   Moyenne journalière: {result['production_kg_prevu'].mean():.1f} kg/jour")

        return result

    def forecast_all_sites(
        self,
        periods_days: int = 30
    ) -> Dict[str, pd.DataFrame]:
        """
        Prévisions pour tous les sites

        Args:
            periods_days: Nombre de jours à prévoir

        Returns:
            Dict {site_code: DataFrame prévisions}
        """

        forecasts = {}

        for site in ['LL', 'LS', 'MT']:
            if site in self.models:
                try:
                    forecasts[site] = self.forecast(site, periods_days)
                except Exception as e:
                    print(f"❌ Erreur prévisions site {site}: {e}")

        return forecasts

    def get_total_forecast(
        self,
        periods_days: int = 30
    ) -> pd.DataFrame:
        """
        Prévisions agrégées de tous les sites

        Args:
            periods_days: Nombre de jours

        Returns:
            DataFrame avec production totale prévue
        """

        forecasts = self.forecast_all_sites(periods_days)

        if not forecasts:
            raise ValueError("Aucune prévision disponible")

        # Combiner toutes les prévisions
        total = None

        for site, df in forecasts.items():
            df_site = df.copy()
            df_site['site'] = site

            if total is None:
                total = df_site
            else:
                total = pd.concat([total, df_site])

        # Agréger par date
        total_agg = total.groupby('date').agg({
            'production_kg_prevu': 'sum',
            'production_kg_min': 'sum',
            'production_kg_max': 'sum'
        }).reset_index()

        return total_agg

    def evaluate_accuracy(
        self,
        site_code: str,
        test_data: pd.DataFrame
    ) -> Dict:
        """
        Évaluer la précision du modèle

        Args:
            site_code: Code du site
            test_data: Données de test avec colonnes date et production_kg

        Returns:
            Métriques de performance
        """

        if site_code not in self.models:
            raise ValueError(f"Modèle non entraîné pour site {site_code}")

        # Préparer données
        test = test_data[['date', 'production_kg']].copy()
        test.columns = ['ds', 'y']
        test['ds'] = pd.to_datetime(test['ds'])

        # Prédire
        forecast = self.models[site_code].predict(test[['ds']])

        # Calculer métriques
        y_true = test['y'].values
        y_pred = forecast['yhat'].values

        mae = np.mean(np.abs(y_true - y_pred))
        rmse = np.sqrt(np.mean((y_true - y_pred)**2))
        mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100

        return {
            'mae': mae,
            'rmse': rmse,
            'mape': mape,
            'r2': 1 - (np.sum((y_true - y_pred)**2) / np.sum((y_true - y_true.mean())**2))
        }


# ============================================================================
# UTILITAIRES
# ============================================================================

class suppress_stdout:
    """Context manager pour supprimer les prints de Prophet"""

    def __enter__(self):
        import sys
        self._original_stdout = sys.stdout
        sys.stdout = open('/dev/null', 'w') if sys.platform != 'win32' else open('nul', 'w')

    def __exit__(self, exc_type, exc_val, exc_tb):
        import sys
        sys.stdout.close()
        sys.stdout = self._original_stdout


# ============================================================================
# EXEMPLE D'UTILISATION
# ============================================================================

if __name__ == "__main__":
    # Créer instance
    forecaster = ProductionForecaster()

    # Données historiques simulées
    dates = pd.date_range(start='2024-01-01', periods=90, freq='D')
    historical = pd.DataFrame({
        'date': dates,
        'production_kg': 3000 + 500 * np.sin(np.arange(90) / 10) + np.random.randn(90) * 200
    })

    # Entraîner
    forecaster.train_site_model('LS', historical)

    # Prévisions
    forecast = forecaster.forecast('LS', periods_days=30)

    print("\n📈 Prévisions 30 jours:")
    print(forecast.head())

    print(f"\n📊 Production totale prévue: {forecast['production_kg_prevu'].sum():.1f} kg")
