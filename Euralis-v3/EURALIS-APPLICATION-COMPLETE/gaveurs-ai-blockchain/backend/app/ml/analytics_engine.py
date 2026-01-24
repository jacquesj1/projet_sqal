import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_absolute_error
from typing import Dict, List, Optional, Tuple
import asyncpg
from datetime import datetime, timedelta
import logging
import json

logger = logging.getLogger(__name__)


class AdvancedAnalyticsEngine:
    """
    Moteur d'analytics avancé avec prévisions Prophet et insights IA
    """
    
    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
    
    async def predict_courbe_poids_prophet(
        self,
        canard_id: int,
        jours_prevision: int = 7
    ) -> Dict:
        """
        Prédit la courbe de poids avec Prophet (Facebook)
        
        Args:
            canard_id: ID du canard
            jours_prevision: Nombre de jours à prévoir
            
        Returns:
            Prévisions avec intervalles de confiance
        """
        # Récupérer l'historique
        query = """
        SELECT 
            time as ds,
            poids_soir as y
        FROM gavage_data
        WHERE canard_id = $1
          AND poids_soir IS NOT NULL
        ORDER BY time ASC
        """
        
        async with self.db_pool.acquire() as conn:
            records = await conn.fetch(query, canard_id)
        
        if len(records) < 10:
            raise ValueError("Pas assez de données historiques pour Prophet")
        
        # Préparer les données Prophet
        df = pd.DataFrame(records)
        df['ds'] = pd.to_datetime(df['ds'])
        
        # Modèle Prophet
        model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=False,
            yearly_seasonality=False,
            interval_width=0.95,
            changepoint_prior_scale=0.5
        )
        
        model.fit(df)
        
        # Créer les dates futures
        future = model.make_future_dataframe(periods=jours_prevision)
        
        # Prédictions
        forecast = model.predict(future)
        
        # Extraire les prévisions futures uniquement
        previsions = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(jours_prevision)
        
        return {
            "canard_id": canard_id,
            "previsions": [
                {
                    "date": row['ds'].isoformat(),
                    "poids_predit": float(row['yhat']),
                    "poids_min": float(row['yhat_lower']),
                    "poids_max": float(row['yhat_upper'])
                }
                for _, row in previsions.iterrows()
            ],
            "confiance": 0.95,
            "methode": "Prophet (Facebook)",
            "date_generation": datetime.utcnow().isoformat()
        }
    
    async def calculate_performance_metrics(self, canard_id: int) -> Dict:
        """
        Calcule toutes les métriques de performance d'un canard
        
        Returns:
            Dictionnaire complet de métriques
        """
        # Récupérer toutes les données
        query = """
        SELECT 
            c.poids_initial,
            c.genetique,
            c.created_at as debut_gavage,
            COALESCE(
                (SELECT poids_soir FROM gavage_data WHERE canard_id = c.id ORDER BY time DESC LIMIT 1),
                c.poids_initial
            ) as poids_actuel,
            COALESCE(
                (SELECT SUM(dose_matin + dose_soir) FROM gavage_data WHERE canard_id = c.id),
                0
            ) as dose_totale_grammes,
            COALESCE(
                (SELECT COUNT(*) FROM gavage_data WHERE canard_id = c.id),
                0
            ) as nb_gavages,
            COALESCE(
                (SELECT AVG(poids_soir - poids_matin) FROM gavage_data WHERE canard_id = c.id AND poids_matin IS NOT NULL),
                0
            ) as gain_moyen_journalier,
            COALESCE(
                (SELECT STDDEV(poids_soir - poids_matin) FROM gavage_data WHERE canard_id = c.id AND poids_matin IS NOT NULL),
                0
            ) as variance_gain_poids
        FROM canards c
        WHERE c.id = $1
        """
        
        async with self.db_pool.acquire() as conn:
            data = await conn.fetchrow(query, canard_id)
        
        if not data:
            raise ValueError(f"Canard {canard_id} non trouvé")
        
        # Calculs
        gain_total = data['poids_actuel'] - data['poids_initial']
        jours_gavage = (datetime.utcnow() - data['debut_gavage']).days or 1
        dose_totale_kg = data['dose_totale_grammes'] / 1000.0
        gain_total_kg = gain_total / 1000.0
        
        # Indice de consommation (IC)
        # IC = kg maïs consommé / kg de gain de poids
        indice_consommation = dose_totale_kg / gain_total_kg if gain_total_kg > 0 else 0
        
        # Taux de croissance journalier
        taux_croissance = (gain_total / jours_gavage) if jours_gavage > 0 else 0
        
        # Score de performance (0-100)
        # Basé sur : IC optimal (~3.5), gain journalier optimal (>80g), variance faible
        score_ic = max(0, 100 - abs(indice_consommation - 3.5) * 20)
        score_gain = min(100, (data['gain_moyen_journalier'] / 80.0) * 100)
        score_regularite = max(0, 100 - (data['variance_gain_poids'] * 2))
        
        score_performance = (score_ic * 0.4 + score_gain * 0.4 + score_regularite * 0.2)
        
        return {
            "canard_id": canard_id,
            "genetique": data['genetique'],
            "duree_gavage_jours": jours_gavage,
            "nb_gavages": data['nb_gavages'],
            
            # Poids
            "poids_initial": float(data['poids_initial']),
            "poids_actuel": float(data['poids_actuel']),
            "gain_total_grammes": float(gain_total),
            "gain_total_kg": round(gain_total_kg, 3),
            "gain_moyen_journalier": round(float(data['gain_moyen_journalier']), 1),
            "variance_gain": round(float(data['variance_gain_poids']), 1),
            
            # Consommation
            "dose_totale_kg": round(dose_totale_kg, 2),
            "indice_consommation": round(indice_consommation, 2),
            "indice_consommation_optimal": 3.5,
            
            # Performance
            "taux_croissance_g_par_jour": round(taux_croissance, 1),
            "score_performance": round(score_performance, 1),
            "score_ic": round(score_ic, 1),
            "score_gain": round(score_gain, 1),
            "score_regularite": round(score_regularite, 1),
            
            # Prédiction poids final
            "poids_final_predit": await self._predict_poids_final(canard_id, jours_gavage),
            
            "date_analyse": datetime.utcnow().isoformat()
        }
    
    async def _predict_poids_final(self, canard_id: int, jours_gavage: int) -> float:
        """Prédit le poids final avec régression linéaire"""
        query = """
        SELECT 
            EXTRACT(EPOCH FROM (time - (SELECT MIN(time) FROM gavage_data WHERE canard_id = $1)))/86400 as jour,
            poids_soir as poids
        FROM gavage_data
        WHERE canard_id = $1
          AND poids_soir IS NOT NULL
        ORDER BY time ASC
        """
        
        async with self.db_pool.acquire() as conn:
            records = await conn.fetch(query, canard_id)
        
        if len(records) < 5:
            return 0.0
        
        df = pd.DataFrame(records)
        X = df[['jour']].values
        y = df['poids'].values
        
        # Régression linéaire
        model = LinearRegression()
        model.fit(X, y)
        
        # Prévoir au jour 14 (durée standard gavage)
        poids_final = model.predict([[14]])[0]
        
        return round(float(poids_final), 1)
    
    async def compare_genetiques(self, gaveur_id: Optional[int] = None) -> Dict:
        """
        Compare les performances par génétique
        
        Returns:
            Comparaison complète des génétiques
        """
        query = """
        SELECT 
            c.genetique,
            COUNT(DISTINCT c.id) as nb_canards,
            AVG(COALESCE(
                (SELECT poids_soir FROM gavage_data WHERE canard_id = c.id ORDER BY time DESC LIMIT 1),
                c.poids_initial
            ) - c.poids_initial) as gain_moyen,
            AVG(COALESCE(
                (SELECT SUM(dose_matin + dose_soir) FROM gavage_data WHERE canard_id = c.id),
                0
            )) / 1000.0 as dose_moyenne_kg,
            COUNT(CASE WHEN c.statut = 'decede' THEN 1 END) * 100.0 / COUNT(*) as taux_mortalite
        FROM canards c
        """
        
        if gaveur_id:
            query += f" WHERE c.gaveur_id = {gaveur_id}"
        
        query += " GROUP BY c.genetique ORDER BY gain_moyen DESC"
        
        async with self.db_pool.acquire() as conn:
            records = await conn.fetch(query)
        
        comparaison = []
        for record in records:
            gain_kg = record['gain_moyen'] / 1000.0 if record['gain_moyen'] else 0
            ic = record['dose_moyenne_kg'] / gain_kg if gain_kg > 0 else 0
            
            comparaison.append({
                "genetique": record['genetique'],
                "nb_canards": record['nb_canards'],
                "gain_moyen_grammes": round(float(record['gain_moyen'] or 0), 1),
                "gain_moyen_kg": round(gain_kg, 2),
                "dose_moyenne_kg": round(float(record['dose_moyenne_kg'] or 0), 2),
                "indice_consommation": round(ic, 2),
                "taux_mortalite_pct": round(float(record['taux_mortalite'] or 0), 1)
            })
        
        return {
            "comparaisons": comparaison,
            "meilleure_genetique": comparaison[0]['genetique'] if comparaison else None,
            "date_analyse": datetime.utcnow().isoformat()
        }
    
    async def analyze_correlation_temperature_poids(self, canard_id: int) -> Dict:
        """
        Analyse la corrélation température <-> gain de poids
        """
        query = """
        SELECT 
            temperature_stabule as temperature,
            poids_soir - poids_matin as gain_poids
        FROM gavage_data
        WHERE canard_id = $1
          AND poids_matin IS NOT NULL
          AND poids_soir IS NOT NULL
        """
        
        async with self.db_pool.acquire() as conn:
            records = await conn.fetch(query, canard_id)
        
        if len(records) < 5:
            return {"correlation": None, "message": "Pas assez de données"}
        
        df = pd.DataFrame(records)
        
        # Corrélation de Pearson
        correlation = df['temperature'].corr(df['gain_poids'])
        
        # Régression pour trouver la température optimale
        X = df[['temperature']].values
        y = df['gain_poids'].values
        
        model = LinearRegression()
        model.fit(X, y)
        
        # Température optimale (approximation)
        temp_optimale = 22.0  # Température standard
        gain_predit_optimal = model.predict([[temp_optimale]])[0]
        
        return {
            "canard_id": canard_id,
            "correlation_pearson": round(float(correlation), 3),
            "interpretation": self._interpreter_correlation(correlation),
            "temperature_optimale_estimee": temp_optimale,
            "gain_predit_temperature_optimale": round(float(gain_predit_optimal), 1),
            "coefficient_regression": round(float(model.coef_[0]), 2),
            "intercept": round(float(model.intercept_), 2)
        }
    
    def _interpreter_correlation(self, corr: float) -> str:
        """Interprète le coefficient de corrélation"""
        abs_corr = abs(corr)
        
        if abs_corr >= 0.8:
            force = "très forte"
        elif abs_corr >= 0.6:
            force = "forte"
        elif abs_corr >= 0.4:
            force = "modérée"
        elif abs_corr >= 0.2:
            force = "faible"
        else:
            force = "très faible"
        
        sens = "positive" if corr > 0 else "négative"
        
        return f"Corrélation {force} {sens}"
    
    async def detect_patterns_gavage(self, gaveur_id: int) -> Dict:
        """
        Détecte les patterns de gavage du gaveur
        Identifie les "best practices"
        """
        query = """
        SELECT 
            c.genetique,
            gd.dose_matin,
            gd.dose_soir,
            gd.temperature_stabule,
            gd.humidite_stabule,
            gd.poids_soir - gd.poids_matin as gain_poids,
            EXTRACT(HOUR FROM gd.heure_gavage_matin) as heure_matin,
            EXTRACT(HOUR FROM gd.heure_gavage_soir) as heure_soir
        FROM gavage_data gd
        JOIN canards c ON gd.canard_id = c.id
        WHERE c.gaveur_id = $1
          AND gd.poids_matin IS NOT NULL
          AND gd.poids_soir IS NOT NULL
        ORDER BY gd.time DESC
        LIMIT 500
        """
        
        async with self.db_pool.acquire() as conn:
            records = await conn.fetch(query)
        
        if len(records) < 20:
            return {"patterns": [], "message": "Pas assez de données"}
        
        df = pd.DataFrame(records)
        
        # Pattern 1: Meilleure heure de gavage
        best_hour_morning = df.groupby('heure_matin')['gain_poids'].mean().idxmax()
        best_hour_evening = df.groupby('heure_soir')['gain_poids'].mean().idxmax()
        
        # Pattern 2: Meilleure température
        best_temp = df.groupby(pd.cut(df['temperature_stabule'], bins=5))['gain_poids'].mean().idxmax()
        
        # Pattern 3: Ratio dose matin/soir optimal
        df['ratio_doses'] = df['dose_matin'] / df['dose_soir']
        best_ratio = df.groupby(pd.cut(df['ratio_doses'], bins=5))['gain_poids'].mean().idxmax()
        
        patterns = [
            {
                "type": "heure_gavage_matin",
                "valeur_optimale": f"{int(best_hour_morning):02d}:00",
                "gain_moyen_associe": round(float(df[df['heure_matin'] == best_hour_morning]['gain_poids'].mean()), 1)
            },
            {
                "type": "heure_gavage_soir",
                "valeur_optimale": f"{int(best_hour_evening):02d}:00",
                "gain_moyen_associe": round(float(df[df['heure_soir'] == best_hour_evening]['gain_poids'].mean()), 1)
            },
            {
                "type": "temperature_optimale",
                "plage_optimale": str(best_temp),
                "recommandation": "Maintenir température autour de 22°C"
            }
        ]
        
        return {
            "gaveur_id": gaveur_id,
            "patterns_detectes": patterns,
            "nb_echantillons_analyses": len(df),
            "date_analyse": datetime.utcnow().isoformat()
        }
    
    async def generate_weekly_report(self, gaveur_id: int) -> Dict:
        """
        Génère un rapport hebdomadaire complet
        """
        # Statistiques générales
        query_stats = """
        SELECT 
            COUNT(DISTINCT c.id) as nb_canards_actifs,
            COUNT(DISTINCT gd.canard_id) as nb_canards_gaves_semaine,
            COUNT(*) as nb_gavages_semaine,
            AVG(gd.poids_soir - gd.poids_matin) as gain_moyen,
            AVG(gd.dose_matin + gd.dose_soir) as dose_moyenne,
            COUNT(CASE WHEN a.niveau = 'critique' THEN 1 END) as alertes_critiques,
            COUNT(CASE WHEN a.niveau = 'important' THEN 1 END) as alertes_importantes
        FROM canards c
        LEFT JOIN gavage_data gd ON c.id = gd.canard_id AND gd.time >= NOW() - INTERVAL '7 days'
        LEFT JOIN alertes a ON c.id = a.canard_id AND a.time >= NOW() - INTERVAL '7 days'
        WHERE c.gaveur_id = $1
          AND c.statut = 'en_gavage'
        """
        
        async with self.db_pool.acquire() as conn:
            stats = await conn.fetchrow(query_stats)
        
        # Top 3 meilleurs canards
        query_top = """
        SELECT 
            c.numero_identification,
            AVG(gd.poids_soir - gd.poids_matin) as gain_moyen
        FROM canards c
        JOIN gavage_data gd ON c.id = gd.canard_id
        WHERE c.gaveur_id = $1
          AND gd.time >= NOW() - INTERVAL '7 days'
          AND gd.poids_matin IS NOT NULL
        GROUP BY c.id, c.numero_identification
        ORDER BY gain_moyen DESC
        LIMIT 3
        """
        
        async with self.db_pool.acquire() as conn:
            top_canards = await conn.fetch(query_top)
        
        return {
            "periode": "7 derniers jours",
            "gaveur_id": gaveur_id,
            "statistiques": {
                "canards_actifs": stats['nb_canards_actifs'],
                "canards_gaves": stats['nb_canards_gaves_semaine'],
                "gavages_total": stats['nb_gavages_semaine'],
                "gain_moyen_g": round(float(stats['gain_moyen'] or 0), 1),
                "dose_moyenne_g": round(float(stats['dose_moyenne'] or 0), 1),
                "alertes_critiques": stats['alertes_critiques'],
                "alertes_importantes": stats['alertes_importantes']
            },
            "top_performers": [
                {
                    "numero": record['numero_identification'],
                    "gain_moyen": round(float(record['gain_moyen']), 1)
                }
                for record in top_canards
            ],
            "date_generation": datetime.utcnow().isoformat()
        }


# Instance globale
analytics_engine: Optional[AdvancedAnalyticsEngine] = None


def get_analytics_engine(db_pool: asyncpg.Pool) -> AdvancedAnalyticsEngine:
    """Obtenir l'instance du moteur analytics"""
    global analytics_engine
    if analytics_engine is None:
        analytics_engine = AdvancedAnalyticsEngine(db_pool)
    return analytics_engine
