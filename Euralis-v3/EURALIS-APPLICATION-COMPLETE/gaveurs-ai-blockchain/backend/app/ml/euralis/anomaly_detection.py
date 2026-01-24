"""
================================================================================
Module: Détection d'Anomalies Multi-Niveaux
================================================================================
Description : Détection d'anomalies à tous les niveaux (coopérative, site, gaveur, lot)
Technologie : Isolation Forest (Scikit-learn)
Usage       : Identifier lots/gaveurs/sites atypiques
================================================================================
"""

from sklearn.ensemble import IsolationForest
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple


class MultiLevelAnomalyDetector:
    """
    Détection d'anomalies à plusieurs niveaux
    """

    def __init__(self):
        self.models = {
            'lot': IsolationForest(contamination=0.1, random_state=42),
            'gaveur': IsolationForest(contamination=0.15, random_state=42),
            'site': IsolationForest(contamination=0.2, random_state=42)
        }

    def detect_lot_anomalies(self, lots_df: pd.DataFrame) -> pd.DataFrame:
        """
        Détecter lots anormaux

        Args:
            lots_df: DataFrame avec colonnes:
                - id: ID du lot
                - code_lot: Code du lot
                - itm: ITM
                - sigma: Sigma
                - pctg_perte_gavage: Mortalité %
                - duree_gavage_reelle: Durée gavage
                - total_corn_real: Consommation maïs
                - site_code: Site

        Returns:
            DataFrame enrichi avec anomalies détectées
        """

        print(f"\n🔍 Détection d'anomalies sur {len(lots_df)} lots")

        # Features pour détection
        features = lots_df[[
            'itm',
            'sigma',
            'pctg_perte_gavage',
            'duree_gavage_reelle',
            'total_corn_real'
        ]].fillna(lots_df.median())

        # Prédire anomalies (-1 = anomalie, 1 = normal)
        predictions = self.models['lot'].fit_predict(features)

        lots_df['is_anomaly'] = predictions == -1

        # Scores anomalie (plus négatif = plus anormal)
        lots_df['anomaly_score'] = self.models['lot'].score_samples(features)

        # Identifier raisons anomalie
        lots_df['raisons_anomalie'] = ''

        # Calculer percentiles pour comparaison
        itm_q10 = lots_df['itm'].quantile(0.1)
        itm_q90 = lots_df['itm'].quantile(0.9)
        mort_q90 = lots_df['pctg_perte_gavage'].quantile(0.9)
        sigma_q90 = lots_df['sigma'].quantile(0.9)
        duree_q10 = lots_df['duree_gavage_reelle'].quantile(0.1)
        duree_q90 = lots_df['duree_gavage_reelle'].quantile(0.9)

        for idx, row in lots_df[lots_df['is_anomaly']].iterrows():
            raisons = []

            if row['itm'] < itm_q10:
                raisons.append(f"ITM très faible ({row['itm']:.2f} kg < {itm_q10:.2f})")

            if row['itm'] > itm_q90:
                raisons.append(f"ITM très élevé ({row['itm']:.2f} kg > {itm_q90:.2f})")

            if row['pctg_perte_gavage'] > mort_q90:
                raisons.append(f"Mortalité élevée ({row['pctg_perte_gavage']:.1f}% > {mort_q90:.1f}%)")

            if row['sigma'] > sigma_q90:
                raisons.append(f"Hétérogénéité forte (σ={row['sigma']:.2f} > {sigma_q90:.2f})")

            if row['duree_gavage_reelle'] < duree_q10:
                raisons.append(f"Durée très courte ({row['duree_gavage_reelle']} j < {duree_q10:.0f})")

            if row['duree_gavage_reelle'] > duree_q90:
                raisons.append(f"Durée très longue ({row['duree_gavage_reelle']} j > {duree_q90:.0f})")

            lots_df.at[idx, 'raisons_anomalie'] = '; '.join(raisons)

        nb_anomalies = lots_df['is_anomaly'].sum()
        print(f"   🚨 {nb_anomalies} anomalies détectées ({nb_anomalies/len(lots_df)*100:.1f}%)")

        return lots_df

    def detect_gaveur_anomalies(self, gaveurs_stats_df: pd.DataFrame) -> pd.DataFrame:
        """
        Détecter gaveurs avec performances anormales

        Args:
            gaveurs_stats_df: DataFrame avec métriques par gaveur:
                - gaveur_id: ID
                - nom: Nom
                - itm_moyen: ITM moyen
                - mortalite_moyenne: Mortalité moyenne
                - regularite: Variance ITM
                - nb_lots: Nombre de lots

        Returns:
            DataFrame avec anomalies
        """

        print(f"\n👥 Détection d'anomalies sur {len(gaveurs_stats_df)} gaveurs")

        features = gaveurs_stats_df[[
            'itm_moyen',
            'mortalite_moyenne',
            'regularite',
            'nb_lots'
        ]].fillna(0)

        predictions = self.models['gaveur'].fit_predict(features)
        gaveurs_stats_df['is_anomaly'] = predictions == -1
        gaveurs_stats_df['anomaly_score'] = self.models['gaveur'].score_samples(features)

        # Raisons
        gaveurs_stats_df['raisons_anomalie'] = ''

        itm_mean = gaveurs_stats_df['itm_moyen'].mean()
        itm_std = gaveurs_stats_df['itm_moyen'].std()
        mort_q90 = gaveurs_stats_df['mortalite_moyenne'].quantile(0.9)

        for idx, row in gaveurs_stats_df[gaveurs_stats_df['is_anomaly']].iterrows():
            raisons = []

            if row['itm_moyen'] < itm_mean - 2*itm_std:
                raisons.append(f"ITM moyen très faible ({row['itm_moyen']:.2f} kg)")

            if row['mortalite_moyenne'] > mort_q90:
                raisons.append(f"Mortalité moyenne élevée ({row['mortalite_moyenne']:.1f}%)")

            if row['regularite'] > gaveurs_stats_df['regularite'].quantile(0.9):
                raisons.append(f"Forte variance ITM (régularité faible)")

            if row['nb_lots'] < 3:
                raisons.append(f"Peu de données ({row['nb_lots']} lots)")

            gaveurs_stats_df.at[idx, 'raisons_anomalie'] = '; '.join(raisons)

        nb_anomalies = gaveurs_stats_df['is_anomaly'].sum()
        print(f"   🚨 {nb_anomalies} gaveurs atypiques ({nb_anomalies/len(gaveurs_stats_df)*100:.1f}%)")

        return gaveurs_stats_df

    def detect_site_anomalies(self, sites_stats_df: pd.DataFrame) -> pd.DataFrame:
        """
        Détecter anomalies au niveau site

        Args:
            sites_stats_df: DataFrame avec stats par site:
                - site_code: Code site
                - itm_moyen: ITM moyen
                - production_totale: Production (kg)
                - mortalite_moyenne: Mortalité moyenne
                - nb_gaveurs_actifs: Nombre de gaveurs

        Returns:
            DataFrame avec anomalies
        """

        print(f"\n🏢 Détection d'anomalies sur {len(sites_stats_df)} sites")

        if len(sites_stats_df) < 3:
            print("   ⚠️  Pas assez de sites pour détection fiable")
            sites_stats_df['is_anomaly'] = False
            sites_stats_df['anomaly_score'] = 0
            return sites_stats_df

        features = sites_stats_df[[
            'itm_moyen',
            'production_totale',
            'mortalite_moyenne',
            'nb_gaveurs_actifs'
        ]].fillna(0)

        predictions = self.models['site'].fit_predict(features)
        sites_stats_df['is_anomaly'] = predictions == -1
        sites_stats_df['anomaly_score'] = self.models['site'].score_samples(features)

        # Raisons
        sites_stats_df['raisons_anomalie'] = ''

        itm_mean = sites_stats_df['itm_moyen'].mean()
        prod_mean = sites_stats_df['production_totale'].mean()

        for idx, row in sites_stats_df[sites_stats_df['is_anomaly']].iterrows():
            raisons = []

            if row['itm_moyen'] < itm_mean * 0.9:
                raisons.append(f"ITM moyen sous la moyenne ({row['itm_moyen']:.2f} < {itm_mean:.2f})")

            if row['production_totale'] < prod_mean * 0.7:
                raisons.append(f"Production faible ({row['production_totale']:.0f} kg)")

            if row['mortalite_moyenne'] > sites_stats_df['mortalite_moyenne'].median() * 1.5:
                raisons.append(f"Mortalité élevée ({row['mortalite_moyenne']:.1f}%)")

            sites_stats_df.at[idx, 'raisons_anomalie'] = '; '.join(raisons)

        nb_anomalies = sites_stats_df['is_anomaly'].sum()
        print(f"   🚨 {nb_anomalies} sites atypiques")

        return sites_stats_df

    def get_most_critical_anomalies(
        self,
        lots_df: pd.DataFrame,
        top_n: int = 10
    ) -> pd.DataFrame:
        """
        Obtenir les anomalies les plus critiques

        Args:
            lots_df: DataFrame avec anomalies détectées
            top_n: Nombre d'anomalies à retourner

        Returns:
            Top N anomalies les plus sévères
        """

        if 'is_anomaly' not in lots_df.columns:
            raise ValueError("Détection d'anomalies non effectuée")

        anomalies = lots_df[lots_df['is_anomaly']].copy()

        # Trier par score (plus négatif = plus anormal)
        anomalies = anomalies.sort_values('anomaly_score')

        return anomalies.head(top_n)

    def generate_alert_messages(self, anomalies_df: pd.DataFrame) -> List[Dict]:
        """
        Générer messages d'alerte pour les anomalies

        Args:
            anomalies_df: DataFrame avec anomalies

        Returns:
            Liste de messages d'alerte formatés
        """

        alerts = []

        for idx, row in anomalies_df.iterrows():
            # Déterminer sévérité
            if row['anomaly_score'] < -0.5:
                severite = 'critique'
            elif row['anomaly_score'] < -0.3:
                severite = 'important'
            else:
                severite = 'warning'

            alert = {
                'type_alerte': 'anomalie_detectee',
                'severite': severite,
                'niveau': 'lot',
                'lot_id': row.get('id'),
                'code_lot': row.get('code_lot'),
                'site_code': row.get('site_code'),
                'message': f"Anomalie détectée sur lot {row.get('code_lot')}: {row.get('raisons_anomalie', 'Raison inconnue')}",
                'valeur_mesuree': float(row.get('anomaly_score', 0)),
                'action_requise': self._get_recommended_action(row, severite)
            }

            alerts.append(alert)

        return alerts

    def _get_recommended_action(self, anomaly_row: pd.Series, severite: str) -> str:
        """
        Obtenir action recommandée pour une anomalie

        Args:
            anomaly_row: Ligne d'anomalie
            severite: Niveau de sévérité

        Returns:
            Action recommandée
        """

        if severite == 'critique':
            return "Audit immédiat du lot et du gaveur. Vérifier conditions sanitaires."

        elif severite == 'important':
            return "Analyse approfondie requise. Contacter le gaveur pour explications."

        else:
            return "Suivi renforcé du prochain lot de ce gaveur."


# ============================================================================
# EXEMPLE D'UTILISATION
# ============================================================================

if __name__ == "__main__":
    # Créer instance
    detector = MultiLevelAnomalyDetector()

    # Données de test
    lots = pd.DataFrame({
        'id': range(1, 76),
        'code_lot': [f'LL480{i}' for i in range(1, 76)],
        'site_code': np.random.choice(['LL', 'LS', 'MT'], 75),
        'itm': np.concatenate([
            np.random.uniform(14, 16, 70),  # Normaux
            np.random.uniform(10, 12, 5)    # Anomalies
        ]),
        'sigma': np.random.uniform(1.5, 3, 75),
        'pctg_perte_gavage': np.concatenate([
            np.random.uniform(2, 4, 70),
            np.random.uniform(8, 12, 5)
        ]),
        'duree_gavage_reelle': np.random.randint(8, 13, 75),
        'total_corn_real': np.random.uniform(600, 800, 75)
    })

    # Détecter anomalies
    lots_with_anomalies = detector.detect_lot_anomalies(lots)

    # Anomalies critiques
    critical = detector.get_most_critical_anomalies(lots_with_anomalies, top_n=5)

    print("\n🚨 Top 5 anomalies critiques:")
    print(critical[['code_lot', 'itm', 'pctg_perte_gavage', 'raisons_anomalie']])

    # Générer alertes
    alerts = detector.generate_alert_messages(critical)

    print(f"\n📢 {len(alerts)} alertes générées")
    for alert in alerts[:3]:
        print(f"   - [{alert['severite'].upper()}] {alert['message']}")
