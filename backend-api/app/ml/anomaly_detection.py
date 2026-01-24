import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from typing import Dict, List, Optional, Tuple
import asyncpg
from datetime import datetime, timedelta
import logging
from prophet import Prophet

from app.models.schemas import AlerteCreate, AlerteNiveauEnum, SMSNotification
from app.services.sms_service import sms_service

logger = logging.getLogger(__name__)


class AnomalyDetectionEngine:
    """
    Moteur de détection d'anomalies avec Machine Learning
    Détecte automatiquement les comportements anormaux des canards
    """
    
    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
        self.isolation_forest = IsolationForest(
            contamination=0.1,  # 10% d'anomalies attendues
            random_state=42
        )
        self.scaler = StandardScaler()
        
        # Seuils d'alertes configurables
        self.seuils = {
            "perte_poids_critique": -150,  # grammes
            "perte_poids_warning": -80,
            "gain_poids_faible_critique": 30,  # < 30g/jour
            "gain_poids_faible_warning": 50,
            "temperature_min": 18.0,
            "temperature_max": 25.0,
            "temperature_critique_min": 15.0,
            "temperature_critique_max": 28.0,
            "humidite_min": 50.0,
            "humidite_max": 75.0,
            "refus_alimentaire_pct": 30.0,  # Si dose < 70% théorique
            "mortalite_lot_pct": 5.0,  # Alerte si > 5% du lot
        }
    
    async def detect_anomalies_canard(
        self,
        canard_id: int,
        window_days: int = 3
    ) -> List[Dict]:
        """
        Détecte les anomalies sur un canard avec ML
        
        Args:
            canard_id: ID du canard
            window_days: Fenêtre de détection (jours)
            
        Returns:
            Liste d'anomalies détectées
        """
        # Récupérer les données récentes
        query = """
        SELECT 
            time,
            dose_matin,
            dose_soir,
            poids_matin,
            poids_soir,
            temperature_stabule,
            humidite_stabule,
            poids_soir - poids_matin as gain_journalier
        FROM gavage_data
        WHERE canard_id = $1
          AND time >= NOW() - INTERVAL '$2 days'
        ORDER BY time ASC
        """
        
        async with self.db_pool.acquire() as conn:
            records = await conn.fetch(query, canard_id, window_days)
        
        if len(records) < 3:
            return []  # Pas assez de données
        
        # Préparer les features
        df = pd.DataFrame(records)
        features = df[[
            'dose_matin', 'dose_soir', 'poids_matin', 'poids_soir',
            'temperature_stabule', 'humidite_stabule', 'gain_journalier'
        ]].values
        
        # Normalisation
        features_scaled = self.scaler.fit_transform(features)
        
        # Détection par Isolation Forest
        predictions = self.isolation_forest.fit_predict(features_scaled)
        anomaly_scores = self.isolation_forest.score_samples(features_scaled)
        
        # Identifier les anomalies
        anomalies = []
        for idx, (pred, score) in enumerate(zip(predictions, anomaly_scores)):
            if pred == -1:  # Anomalie détectée
                row = df.iloc[idx]
                anomalies.append({
                    "time": row['time'],
                    "type": "anomalie_ml",
                    "score": float(score),
                    "valeurs": {
                        "dose_matin": float(row['dose_matin']),
                        "dose_soir": float(row['dose_soir']),
                        "gain_journalier": float(row['gain_journalier']),
                        "temperature": float(row['temperature_stabule'])
                    }
                })
        
        return anomalies
    
    async def check_all_alerts_canard(
        self,
        canard_id: int,
        gaveur_telephone: str
    ) -> List[Dict]:
        """
        Vérifie TOUTES les alertes possibles pour un canard
        
        Returns:
            Liste des alertes générées
        """
        alertes_generees = []
        
        # 1. Vérifier perte de poids
        alerte_poids = await self._check_perte_poids(canard_id)
        if alerte_poids:
            alertes_generees.append(alerte_poids)
            await self._envoyer_alerte(canard_id, alerte_poids, gaveur_telephone)
        
        # 2. Vérifier gain de poids faible
        alerte_gain = await self._check_gain_poids_faible(canard_id)
        if alerte_gain:
            alertes_generees.append(alerte_gain)
            await self._envoyer_alerte(canard_id, alerte_gain, gaveur_telephone)
        
        # 3. Vérifier température
        alerte_temp = await self._check_temperature(canard_id)
        if alerte_temp:
            alertes_generees.append(alerte_temp)
            await self._envoyer_alerte(canard_id, alerte_temp, gaveur_telephone)
        
        # 4. Vérifier humidité
        alerte_hum = await self._check_humidite(canard_id)
        if alerte_hum:
            alertes_generees.append(alerte_hum)
            await self._envoyer_alerte(canard_id, alerte_hum, gaveur_telephone)
        
        # 5. Vérifier refus alimentaire
        alerte_refus = await self._check_refus_alimentaire(canard_id)
        if alerte_refus:
            alertes_generees.append(alerte_refus)
            await self._envoyer_alerte(canard_id, alerte_refus, gaveur_telephone)
        
        # 6. Détection anomalies ML
        anomalies_ml = await self.detect_anomalies_canard(canard_id)
        if anomalies_ml:
            for anomalie in anomalies_ml:
                alerte_ml = {
                    "type": "anomalie_comportement",
                    "niveau": AlerteNiveauEnum.IMPORTANT,
                    "message": f"Comportement anormal détecté par IA (score: {anomalie['score']:.2f})",
                    "valeur_mesuree": anomalie['score'],
                    "details": anomalie['valeurs']
                }
                alertes_generees.append(alerte_ml)
                await self._envoyer_alerte(canard_id, alerte_ml, gaveur_telephone)
        
        return alertes_generees
    
    async def _check_perte_poids(self, canard_id: int) -> Optional[Dict]:
        """Vérifie si perte de poids anormale"""
        query = """
        SELECT 
            poids_soir - poids_matin as variation
        FROM gavage_data
        WHERE canard_id = $1
        ORDER BY time DESC
        LIMIT 1
        """
        
        async with self.db_pool.acquire() as conn:
            variation = await conn.fetchval(query, canard_id)
        
        if variation is None:
            return None
        
        if variation <= self.seuils["perte_poids_critique"]:
            return {
                "type": "perte_poids_critique",
                "niveau": AlerteNiveauEnum.CRITIQUE,
                "message": f"🚨 PERTE DE POIDS CRITIQUE: {variation:.0f}g - INTERVENTION URGENTE",
                "valeur_mesuree": float(variation),
                "valeur_seuil": self.seuils["perte_poids_critique"]
            }
        elif variation <= self.seuils["perte_poids_warning"]:
            return {
                "type": "perte_poids_warning",
                "niveau": AlerteNiveauEnum.IMPORTANT,
                "message": f"⚠️ Perte de poids anormale: {variation:.0f}g - Surveiller",
                "valeur_mesuree": float(variation),
                "valeur_seuil": self.seuils["perte_poids_warning"]
            }
        
        return None
    
    async def _check_gain_poids_faible(self, canard_id: int) -> Optional[Dict]:
        """Vérifie si gain de poids trop faible"""
        query = """
        SELECT 
            AVG(poids_soir - poids_matin) as gain_moyen
        FROM gavage_data
        WHERE canard_id = $1
          AND time >= NOW() - INTERVAL '3 days'
          AND poids_matin IS NOT NULL
          AND poids_soir IS NOT NULL
        """
        
        async with self.db_pool.acquire() as conn:
            gain_moyen = await conn.fetchval(query, canard_id)
        
        if gain_moyen is None:
            return None
        
        if gain_moyen <= self.seuils["gain_poids_faible_critique"]:
            return {
                "type": "gain_poids_faible_critique",
                "niveau": AlerteNiveauEnum.CRITIQUE,
                "message": f"🚨 Gain de poids insuffisant: {gain_moyen:.0f}g/jour - Revoir stratégie",
                "valeur_mesuree": float(gain_moyen),
                "valeur_seuil": self.seuils["gain_poids_faible_critique"]
            }
        elif gain_moyen <= self.seuils["gain_poids_faible_warning"]:
            return {
                "type": "gain_poids_faible",
                "niveau": AlerteNiveauEnum.IMPORTANT,
                "message": f"⚠️ Gain de poids sous la moyenne: {gain_moyen:.0f}g/jour",
                "valeur_mesuree": float(gain_moyen),
                "valeur_seuil": self.seuils["gain_poids_faible_warning"]
            }
        
        return None
    
    async def _check_temperature(self, canard_id: int) -> Optional[Dict]:
        """Vérifie la température stabule"""
        query = """
        SELECT temperature_stabule
        FROM gavage_data
        WHERE canard_id = $1
        ORDER BY time DESC
        LIMIT 1
        """
        
        async with self.db_pool.acquire() as conn:
            temp = await conn.fetchval(query, canard_id)
        
        if temp is None:
            return None
        
        if temp <= self.seuils["temperature_critique_min"] or temp >= self.seuils["temperature_critique_max"]:
            return {
                "type": "temperature_critique",
                "niveau": AlerteNiveauEnum.CRITIQUE,
                "message": f"🚨 TEMPÉRATURE CRITIQUE: {temp:.1f}°C - Corriger immédiatement",
                "valeur_mesuree": float(temp),
                "valeur_seuil": f"{self.seuils['temperature_critique_min']}-{self.seuils['temperature_critique_max']}"
            }
        elif temp <= self.seuils["temperature_min"] or temp >= self.seuils["temperature_max"]:
            return {
                "type": "temperature_hors_zone",
                "niveau": AlerteNiveauEnum.IMPORTANT,
                "message": f"⚠️ Température hors zone de confort: {temp:.1f}°C",
                "valeur_mesuree": float(temp),
                "valeur_seuil": f"{self.seuils['temperature_min']}-{self.seuils['temperature_max']}"
            }
        
        return None
    
    async def _check_humidite(self, canard_id: int) -> Optional[Dict]:
        """Vérifie l'humidité stabule"""
        query = """
        SELECT humidite_stabule
        FROM gavage_data
        WHERE canard_id = $1
        ORDER BY time DESC
        LIMIT 1
        """
        
        async with self.db_pool.acquire() as conn:
            hum = await conn.fetchval(query, canard_id)
        
        if hum is None:
            return None
        
        if hum <= self.seuils["humidite_min"] or hum >= self.seuils["humidite_max"]:
            return {
                "type": "humidite_hors_zone",
                "niveau": AlerteNiveauEnum.IMPORTANT,
                "message": f"⚠️ Humidité hors zone optimale: {hum:.0f}%",
                "valeur_mesuree": float(hum),
                "valeur_seuil": f"{self.seuils['humidite_min']}-{self.seuils['humidite_max']}"
            }
        
        return None
    
    async def _check_refus_alimentaire(self, canard_id: int) -> Optional[Dict]:
        """Vérifie si refus alimentaire (dose réelle << théorique)"""
        query = """
        SELECT 
            dose_theorique_matin + dose_theorique_soir as dose_theo_totale,
            dose_matin + dose_soir as dose_reelle_totale
        FROM gavage_data
        WHERE canard_id = $1
          AND dose_theorique_matin IS NOT NULL
          AND dose_theorique_soir IS NOT NULL
        ORDER BY time DESC
        LIMIT 1
        """
        
        async with self.db_pool.acquire() as conn:
            record = await conn.fetchrow(query, canard_id)
        
        if not record or record['dose_theo_totale'] == 0:
            return None
        
        pct_reelle = (record['dose_reelle_totale'] / record['dose_theo_totale']) * 100
        
        if pct_reelle <= (100 - self.seuils["refus_alimentaire_pct"]):
            return {
                "type": "refus_alimentaire",
                "niveau": AlerteNiveauEnum.CRITIQUE,
                "message": f"🚨 REFUS ALIMENTAIRE: Seulement {pct_reelle:.0f}% de la dose théorique consommée",
                "valeur_mesuree": float(pct_reelle),
                "valeur_seuil": 100 - self.seuils["refus_alimentaire_pct"]
            }
        
        return None
    
    async def check_mortalite_lot(self, numero_lot: str, gaveur_telephone: str) -> Optional[Dict]:
        """Vérifie le taux de mortalité d'un lot"""
        query = """
        SELECT 
            COUNT(*) FILTER (WHERE statut = 'decede') as morts,
            COUNT(*) as total
        FROM canards
        WHERE numero_lot_canard = $1
        """
        
        async with self.db_pool.acquire() as conn:
            record = await conn.fetchrow(query, numero_lot)
        
        if record['total'] == 0:
            return None
        
        taux_mortalite = (record['morts'] / record['total']) * 100
        
        if taux_mortalite >= self.seuils["mortalite_lot_pct"]:
            alerte = {
                "type": "mortalite_lot_elevee",
                "niveau": AlerteNiveauEnum.CRITIQUE,
                "message": f"🚨 MORTALITÉ ÉLEVÉE LOT {numero_lot}: {taux_mortalite:.1f}% ({record['morts']}/{record['total']})",
                "valeur_mesuree": float(taux_mortalite),
                "valeur_seuil": self.seuils["mortalite_lot_pct"]
            }
            
            # Envoyer SMS
            await sms_service.send_alerte_critique(
                gaveur_telephone,
                0,  # Pas de canard spécifique
                alerte["message"]
            )
            
            return alerte
        
        return None
    
    async def _envoyer_alerte(
        self,
        canard_id: int,
        alerte: Dict,
        telephone: str
    ):
        """Enregistre et envoie une alerte"""
        # Enregistrer dans DB
        query = """
        INSERT INTO alertes (
            time, canard_id, niveau, type_alerte, message,
            valeur_mesuree, valeur_seuil, sms_envoye
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """
        
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                query,
                datetime.utcnow(),
                canard_id,
                alerte["niveau"],
                alerte["type"],
                alerte["message"],
                alerte.get("valeur_mesuree"),
                alerte.get("valeur_seuil"),
                False
            )
        
        # Envoyer SMS si critique
        if alerte["niveau"] == AlerteNiveauEnum.CRITIQUE:
            await sms_service.send_alerte_critique(
                telephone,
                canard_id,
                alerte["message"]
            )
            
            # Marquer SMS envoyé
            update_query = """
            UPDATE alertes
            SET sms_envoye = true
            WHERE canard_id = $1
              AND type_alerte = $2
              AND time >= NOW() - INTERVAL '1 minute'
            """
            async with self.db_pool.acquire() as conn:
                await conn.execute(update_query, canard_id, alerte["type"])
    
    async def get_alertes_dashboard(self, gaveur_id: int) -> Dict:
        """Dashboard des alertes pour un gaveur"""
        query = """
        SELECT
            COUNT(*) FILTER (WHERE niveau = 'critique' AND NOT acquittee) as critiques_actives,
            COUNT(*) FILTER (WHERE niveau = 'important' AND NOT acquittee) as importantes_actives,
            COUNT(*) FILTER (WHERE niveau = 'info' AND NOT acquittee) as info_actives,
            COUNT(*) FILTER (WHERE time >= NOW() - INTERVAL '24 hours') as alertes_24h,
            COUNT(*) FILTER (WHERE sms_envoye) as sms_envoyes
        FROM alertes
        WHERE gaveur_id = $1
        """

        async with self.db_pool.acquire() as conn:
            record = await conn.fetchrow(query, gaveur_id)

        return dict(record)


# Instance globale
anomaly_detection: Optional[AnomalyDetectionEngine] = None


def get_anomaly_detection(db_pool: asyncpg.Pool) -> AnomalyDetectionEngine:
    """Obtenir l'instance du moteur de détection"""
    global anomaly_detection
    if anomaly_detection is None:
        anomaly_detection = AnomalyDetectionEngine(db_pool)
    return anomaly_detection
