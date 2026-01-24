from typing import Dict, Optional
import asyncpg
from datetime import datetime
import logging
from app.models.schemas import CorrectionDose, SMSNotification, AlerteNiveauEnum
from app.services.sms_service import sms_service
from app.ml.symbolic_regression import get_symbolic_engine

logger = logging.getLogger(__name__)


class DoseCorrectionService:
    """
    Service de correction et d'optimisation des doses de gavage
    Compare dose théorique (IA) vs dose réelle et propose des corrections
    """
    
    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
        self.seuil_ecart_warning = 10.0  # 10% d'écart = warning
        self.seuil_ecart_critique = 25.0  # 25% d'écart = critique
    
    async def calculate_theoretical_dose(
        self,
        canard_id: int,
        session: str  # "matin" ou "soir"
    ) -> float:
        """
        Calcule la dose théorique optimale via régression symbolique
        
        Args:
            canard_id: ID du canard
            session: "matin" ou "soir"
            
        Returns:
            Dose théorique en grammes
        """
        # Récupérer les informations du canard
        query = """
        SELECT 
            c.genetique,
            c.poids_initial,
            COALESCE(
                (SELECT poids_soir FROM gavage_data 
                 WHERE canard_id = c.id 
                 ORDER BY time DESC LIMIT 1),
                c.poids_initial
            ) as poids_actuel,
            EXTRACT(EPOCH FROM (NOW() - c.created_at))/86400 as jours_gavage,
            COALESCE(
                (SELECT temperature_stabule FROM gavage_data 
                 WHERE canard_id = c.id 
                 ORDER BY time DESC LIMIT 1),
                20.0
            ) as temperature,
            COALESCE(
                (SELECT humidite_stabule FROM gavage_data 
                 WHERE canard_id = c.id 
                 ORDER BY time DESC LIMIT 1),
                60.0
            ) as humidite,
            COALESCE(
                (SELECT lm.taux_humidite FROM gavage_data gd
                 JOIN lot_mais lm ON gd.lot_mais_id = lm.id
                 WHERE gd.canard_id = c.id
                 ORDER BY gd.time DESC LIMIT 1),
                14.0
            ) as humidite_mais
        FROM canards c
        WHERE c.id = $1
        """
        
        async with self.db_pool.acquire() as conn:
            record = await conn.fetchrow(query, canard_id)
        
        if not record:
            raise ValueError(f"Canard {canard_id} non trouvé")
        
        # Obtenir le moteur de régression symbolique
        engine = get_symbolic_engine(self.db_pool)
        
        # Calculer dose optimale (même pour matin et soir, la formule s'adapte)
        try:
            dose_optimale = await engine.calculate_optimal_doses(
                canard_id=canard_id,
                genetique=record['genetique'],
                poids_actuel=record['poids_actuel'],
                poids_cible=record['poids_actuel'] + 100,  # Cible: +100g/jour
                jours_restants=1,
                temperature=record['temperature'],
                humidite=record['humidite'],
                humidite_mais=record['humidite_mais']
            )
            
            if session == "matin":
                return dose_optimale["dose_matin_optimale"]
            else:
                return dose_optimale["dose_soir_optimale"]
                
        except Exception as e:
            logger.warning(f"Calcul dose théorique échoué: {e}, utilisation dose standard")
            # Dose par défaut selon génétique
            doses_standard = {
                "mulard": 450,
                "barbarie": 400,
                "pekin": 350
            }
            return doses_standard.get(record['genetique'], 400)
    
    async def check_and_correct(
        self,
        canard_id: int,
        dose_reelle: float,
        dose_theorique: float,
        session: str,
        gaveur_telephone: str
    ) -> Optional[CorrectionDose]:
        """
        Vérifie l'écart entre dose réelle et théorique et propose correction
        
        Args:
            canard_id: ID du canard
            dose_reelle: Dose effectivement donnée
            dose_theorique: Dose recommandée par l'IA
            session: "matin" ou "soir"
            gaveur_telephone: Téléphone du gaveur pour SMS
            
        Returns:
            CorrectionDose si correction nécessaire, None sinon
        """
        ecart_absolu = abs(dose_reelle - dose_theorique)
        ecart_pourcentage = (ecart_absolu / dose_theorique * 100) if dose_theorique > 0 else 0
        
        # Pas de correction si écart < 10%
        if ecart_pourcentage < self.seuil_ecart_warning:
            return None
        
        # Déterminer le type de correction
        if dose_reelle < dose_theorique:
            # Sous-dosage
            correction_proposee = self._generer_correction_sous_dosage(
                ecart_absolu, 
                ecart_pourcentage,
                session
            )
            raison = "Sous-dosage détecté"
            impact = "Risque de poids insuffisant et durée de gavage prolongée"
            
        else:
            # Sur-dosage
            correction_proposee = self._generer_correction_sur_dosage(
                ecart_absolu,
                ecart_pourcentage,
                session
            )
            raison = "Sur-dosage détecté"
            impact = "Risque de refus alimentaire et stress du canard"
        
        # Créer l'objet correction
        correction = CorrectionDose(
            canard_id=canard_id,
            date=datetime.utcnow(),
            dose_theorique=dose_theorique,
            dose_reelle=dose_reelle,
            ecart_absolu=ecart_absolu,
            ecart_pourcentage=ecart_pourcentage,
            correction_proposee=correction_proposee,
            raison=raison,
            impact_prevu=impact
        )
        
        # Sauvegarder dans DB
        await self._save_correction(correction)
        
        # Envoyer SMS si écart important
        if ecart_pourcentage >= self.seuil_ecart_warning:
            await self._send_correction_sms(
                gaveur_telephone,
                correction,
                session
            )
        
        logger.info(
            f"Correction générée pour canard {canard_id}: "
            f"{ecart_pourcentage:.1f}% d'écart"
        )
        
        return correction
    
    def _generer_correction_sous_dosage(
        self,
        ecart: float,
        pct: float,
        session: str
    ) -> str:
        """Génère le message de correction pour sous-dosage"""
        session_suivante = "soir" if session == "matin" else "demain matin"
        
        if pct >= self.seuil_ecart_critique:
            return (
                f"⚠️ SOUS-DOSAGE IMPORTANT ({pct:.1f}%)\n"
                f"Action: Compenser +{ecart:.0f}g au gavage {session_suivante}\n"
                f"Surveiller l'appétit et le comportement"
            )
        else:
            return (
                f"Léger sous-dosage ({pct:.1f}%)\n"
                f"Suggestion: Ajouter +{ecart/2:.0f}g au gavage {session_suivante}\n"
                f"Aucune action urgente requise"
            )
    
    def _generer_correction_sur_dosage(
        self,
        ecart: float,
        pct: float,
        session: str
    ) -> str:
        """Génère le message de correction pour sur-dosage"""
        session_suivante = "soir" if session == "matin" else "demain matin"
        
        if pct >= self.seuil_ecart_critique:
            return (
                f"🚨 SUR-DOSAGE CRITIQUE ({pct:.1f}%)\n"
                f"Action: Réduire de -{ecart:.0f}g au gavage {session_suivante}\n"
                f"⚠️ Surveiller refus alimentaire et régurgitation"
            )
        else:
            return (
                f"Sur-dosage modéré ({pct:.1f}%)\n"
                f"Suggestion: Réduire de -{ecart/2:.0f}g au gavage {session_suivante}\n"
                f"Surveiller l'état général"
            )
    
    async def _save_correction(self, correction: CorrectionDose):
        """Sauvegarde la correction dans la base de données"""
        query = """
        INSERT INTO corrections_doses (
            canard_id,
            date,
            dose_theorique,
            dose_reelle,
            ecart_absolu,
            ecart_pourcentage,
            correction_proposee,
            raison,
            impact_prevu
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """
        
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                query,
                correction.canard_id,
                correction.date,
                correction.dose_theorique,
                correction.dose_reelle,
                correction.ecart_absolu,
                correction.ecart_pourcentage,
                correction.correction_proposee,
                correction.raison,
                correction.impact_prevu
            )
    
    async def _send_correction_sms(
        self,
        telephone: str,
        correction: CorrectionDose,
        session: str
    ):
        """Envoie un SMS de correction au gaveur"""
        priorite = (
            AlerteNiveauEnum.CRITIQUE 
            if correction.ecart_pourcentage >= self.seuil_ecart_critique 
            else AlerteNiveauEnum.IMPORTANT
        )
        
        await sms_service.send_correction_dose(
            telephone=telephone,
            canard_id=correction.canard_id,
            dose_theorique=correction.dose_theorique,
            dose_reelle=correction.dose_reelle,
            correction=correction.correction_proposee
        )
    
    async def get_corrections_history(
        self,
        canard_id: Optional[int] = None,
        gaveur_id: Optional[int] = None,
        limit: int = 50
    ) -> list:
        """Récupère l'historique des corrections"""
        query = """
        SELECT 
            cd.*,
            c.numero_identification,
            c.genetique
        FROM corrections_doses cd
        JOIN canards c ON cd.canard_id = c.id
        WHERE 1=1
        """
        params = []
        param_idx = 1
        
        if canard_id:
            query += f" AND cd.canard_id = ${param_idx}"
            params.append(canard_id)
            param_idx += 1
        
        if gaveur_id:
            query += f" AND c.gaveur_id = ${param_idx}"
            params.append(gaveur_id)
            param_idx += 1
        
        query += f" ORDER BY cd.date DESC LIMIT ${param_idx}"
        params.append(limit)
        
        async with self.db_pool.acquire() as conn:
            records = await conn.fetch(query, *params)
        
        return [dict(r) for r in records]
    
    async def get_correction_stats(self, gaveur_id: int) -> Dict:
        """Statistiques de corrections pour un gaveur"""
        query = """
        SELECT 
            COUNT(*) as total_corrections,
            AVG(ecart_pourcentage) as ecart_moyen,
            COUNT(CASE WHEN ecart_pourcentage >= $1 THEN 1 END) as critiques,
            COUNT(CASE WHEN dose_reelle < dose_theorique THEN 1 END) as sous_dosages,
            COUNT(CASE WHEN dose_reelle > dose_theorique THEN 1 END) as sur_dosages
        FROM corrections_doses cd
        JOIN canards c ON cd.canard_id = c.id
        WHERE c.gaveur_id = $2
          AND cd.date >= NOW() - INTERVAL '30 days'
        """
        
        async with self.db_pool.acquire() as conn:
            record = await conn.fetchrow(
                query,
                self.seuil_ecart_critique,
                gaveur_id
            )
        
        return dict(record) if record else {}


# Instance globale
dose_correction_service: Optional[DoseCorrectionService] = None


def get_dose_correction_service(db_pool: asyncpg.Pool) -> DoseCorrectionService:
    """Obtenir l'instance du service de correction"""
    global dose_correction_service
    if dose_correction_service is None:
        dose_correction_service = DoseCorrectionService(db_pool)
    return dose_correction_service
