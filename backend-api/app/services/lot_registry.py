"""
==============================================================================
Lot Registry Service - Centralized Lot Tracking
==============================================================================
Service centralisé pour suivre les lots à travers toute la chaîne :
Gavage → SQAL → Consumer Feedback

Permet la traçabilité complète et la cohérence des IDs entre simulateurs.

Auteur: Claude Code
Date: 2026-01-07
==============================================================================
"""

import asyncio
import asyncpg
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from enum import Enum
import random
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# Pydantic Models
# ============================================================================

class GavageStatus(str, Enum):
    """Status du gavage d'un lot"""
    EN_COURS = "en_cours"
    TERMINE = "termine"
    SUSPENDU = "suspendu"


class LotEventType(str, Enum):
    """Types d'événements dans la timeline d'un lot"""
    GAVAGE_STARTED = "gavage_started"
    GAVAGE_DAY = "gavage_day"
    GAVAGE_ENDED = "gavage_ended"
    SQAL_CONTROL = "sqal_control"
    CONSUMER_FEEDBACK = "consumer_feedback"
    BLOCKCHAIN_RECORD = "blockchain_record"


class LotEvent(BaseModel):
    """Événement dans la timeline d'un lot"""
    timestamp: datetime
    event_type: LotEventType
    data: Dict[str, Any]
    description: str


class LotInfo(BaseModel):
    """Informations complètes d'un lot"""
    lot_id: str
    gaveur_id: str
    nb_canards: int
    created_at: datetime
    gavage_status: GavageStatus
    gavage_started_at: Optional[datetime] = None
    gavage_ended_at: Optional[datetime] = None
    current_day: int = 0
    itm_moyen: Optional[float] = None
    sqal_samples: List[str] = []  # sample_ids
    sqal_grades: List[str] = []  # A+, A, B, C, D
    consumer_feedbacks: List[str] = []  # feedback_ids
    average_rating: Optional[float] = None
    blockchain_hash: Optional[str] = None


class LotTimeline(BaseModel):
    """Timeline complète d'un lot pour traçabilité"""
    lot_id: str
    lot_info: LotInfo
    events: List[LotEvent]
    total_duration_days: float
    sqal_control_count: int
    consumer_feedback_count: int


class LotStats(BaseModel):
    """Statistiques globales des lots"""
    total_lots: int
    active_lots: int
    completed_lots: int
    total_canards: int
    average_gavage_duration: float
    average_itm: float
    average_consumer_rating: float


# ============================================================================
# LotRegistry Service
# ============================================================================

class LotRegistry:
    """
    Service de registre centralisé des lots.

    Gère :
    - Création de lots avec IDs uniques
    - Suivi du gavage (jours, ITM)
    - Lien avec échantillons SQAL
    - Lien avec feedbacks consommateurs
    - Timeline complète pour traçabilité
    - Statistiques globales
    """

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.lots_cache: Dict[str, LotInfo] = {}  # Cache mémoire
        logger.info("LotRegistry initialized")

    async def init_pool(self, database_url: str):
        """Initialise la connexion à la base de données"""
        try:
            self.pool = await asyncpg.create_pool(
                database_url,
                min_size=2,
                max_size=10,
                ssl=False
            )
            logger.info("✅ LotRegistry database pool initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize LotRegistry pool: {e}")
            raise

    async def close_pool(self):
        """Ferme la connexion à la base de données"""
        if self.pool:
            await self.pool.close()
            logger.info("🔴 LotRegistry database pool closed")

    # ========================================================================
    # Création et Gestion des Lots
    # ========================================================================

    async def create_lot(
        self,
        gaveur_id: str,
        nb_canards: int,
        start_gavage: bool = True
    ) -> str:
        """
        Crée un nouveau lot et retourne son ID unique.

        Args:
            gaveur_id: ID du gaveur
            nb_canards: Nombre de canards dans le lot
            start_gavage: Démarrer le gavage immédiatement

        Returns:
            lot_id: ID unique du lot (ex: LOT_20260107_1234)
        """
        # Générer ID unique
        timestamp = datetime.now().strftime("%Y%m%d")
        random_suffix = random.randint(1000, 9999)
        lot_id = f"LOT_{timestamp}_{random_suffix}"

        # Créer objet LotInfo
        lot_info = LotInfo(
            lot_id=lot_id,
            gaveur_id=gaveur_id,
            nb_canards=nb_canards,
            created_at=datetime.now(),
            gavage_status=GavageStatus.EN_COURS if start_gavage else GavageStatus.SUSPENDU,
            gavage_started_at=datetime.now() if start_gavage else None,
            current_day=0
        )

        # Sauvegarder en cache
        self.lots_cache[lot_id] = lot_info

        # Persister en base de données
        await self._save_lot_to_db(lot_info)

        # Créer événement de création
        await self._add_event(
            lot_id=lot_id,
            event_type=LotEventType.GAVAGE_STARTED,
            data={
                "gaveur_id": gaveur_id,
                "nb_canards": nb_canards
            },
            description=f"Lot créé avec {nb_canards} canards par gaveur {gaveur_id}"
        )

        logger.info(f"✅ Lot created: {lot_id} ({nb_canards} canards)")
        return lot_id

    async def update_gavage_progress(
        self,
        lot_id: str,
        current_day: int,
        itm_moyen: float
    ):
        """
        Met à jour la progression du gavage d'un lot.

        Args:
            lot_id: ID du lot
            current_day: Jour actuel de gavage (1-14)
            itm_moyen: ITM moyen du lot
        """
        if lot_id not in self.lots_cache:
            await self._load_lot_from_db(lot_id)

        if lot_id in self.lots_cache:
            lot = self.lots_cache[lot_id]
            lot.current_day = current_day
            lot.itm_moyen = itm_moyen

            # Update en base
            await self._update_lot_in_db(lot)

            # Ajouter événement si c'est un jour significatif (J7, J14)
            if current_day in [7, 14]:
                await self._add_event(
                    lot_id=lot_id,
                    event_type=LotEventType.GAVAGE_DAY,
                    data={
                        "day": current_day,
                        "itm_moyen": itm_moyen
                    },
                    description=f"Jour {current_day} de gavage - ITM moyen: {itm_moyen:.1f}g"
                )

            logger.debug(f"Updated gavage progress for {lot_id}: day {current_day}, ITM {itm_moyen:.1f}g")

    async def end_gavage(self, lot_id: str):
        """Marque le gavage comme terminé"""
        if lot_id not in self.lots_cache:
            await self._load_lot_from_db(lot_id)

        if lot_id in self.lots_cache:
            lot = self.lots_cache[lot_id]
            lot.gavage_status = GavageStatus.TERMINE
            lot.gavage_ended_at = datetime.now()

            await self._update_lot_in_db(lot)
            await self._add_event(
                lot_id=lot_id,
                event_type=LotEventType.GAVAGE_ENDED,
                data={"final_day": lot.current_day, "final_itm": lot.itm_moyen},
                description=f"Gavage terminé après {lot.current_day} jours"
            )

            logger.info(f"✅ Gavage ended for lot {lot_id}")

    # ========================================================================
    # Liens avec SQAL et Consumer
    # ========================================================================

    async def link_sqal_sample(
        self,
        lot_id: str,
        sample_id: str,
        grade: str,
        quality_score: float
    ):
        """
        Lie un échantillon SQAL à un lot.

        Args:
            lot_id: ID du lot
            sample_id: ID de l'échantillon SQAL
            grade: Grade qualité (A+, A, B, C, D)
            quality_score: Score qualité (0-100)
        """
        if lot_id not in self.lots_cache:
            await self._load_lot_from_db(lot_id)

        if lot_id in self.lots_cache:
            lot = self.lots_cache[lot_id]
            lot.sqal_samples.append(sample_id)
            lot.sqal_grades.append(grade)

            await self._update_lot_in_db(lot)
            await self._add_event(
                lot_id=lot_id,
                event_type=LotEventType.SQAL_CONTROL,
                data={
                    "sample_id": sample_id,
                    "grade": grade,
                    "quality_score": quality_score
                },
                description=f"Contrôle qualité SQAL - Grade: {grade} (score: {quality_score:.1f})"
            )

            logger.info(f"✅ SQAL sample linked: {sample_id} → {lot_id} (Grade: {grade})")

    async def link_consumer_feedback(
        self,
        lot_id: str,
        feedback_id: str,
        rating: int,
        comment: Optional[str] = None
    ):
        """
        Lie un feedback consommateur à un lot.

        Args:
            lot_id: ID du lot
            feedback_id: ID du feedback
            rating: Note (1-5)
            comment: Commentaire optionnel
        """
        if lot_id not in self.lots_cache:
            await self._load_lot_from_db(lot_id)

        if lot_id in self.lots_cache:
            lot = self.lots_cache[lot_id]
            lot.consumer_feedbacks.append(feedback_id)

            # Recalculer note moyenne
            if lot.average_rating is None:
                lot.average_rating = rating
            else:
                # Moyenne pondérée
                n = len(lot.consumer_feedbacks)
                lot.average_rating = ((lot.average_rating * (n - 1)) + rating) / n

            await self._update_lot_in_db(lot)
            await self._add_event(
                lot_id=lot_id,
                event_type=LotEventType.CONSUMER_FEEDBACK,
                data={
                    "feedback_id": feedback_id,
                    "rating": rating,
                    "comment": comment
                },
                description=f"Feedback consommateur - Note: {rating}/5"
            )

            logger.info(f"✅ Consumer feedback linked: {feedback_id} → {lot_id} (Rating: {rating}/5)")

    # ========================================================================
    # Timeline et Traçabilité
    # ========================================================================

    async def get_lot_timeline(self, lot_id: str) -> Optional[LotTimeline]:
        """
        Récupère la timeline complète d'un lot pour traçabilité.

        Returns:
            LotTimeline avec tous les événements chronologiques
        """
        if lot_id not in self.lots_cache:
            await self._load_lot_from_db(lot_id)

        if lot_id not in self.lots_cache:
            return None

        lot = self.lots_cache[lot_id]

        # Récupérer événements depuis la base
        events = await self._get_events_from_db(lot_id)

        # Calculer durée totale
        if lot.gavage_ended_at and lot.gavage_started_at:
            duration = (lot.gavage_ended_at - lot.gavage_started_at).total_seconds() / 86400
        else:
            duration = 0.0

        return LotTimeline(
            lot_id=lot_id,
            lot_info=lot,
            events=events,
            total_duration_days=duration,
            sqal_control_count=len(lot.sqal_samples),
            consumer_feedback_count=len(lot.consumer_feedbacks)
        )

    async def get_active_lots(self) -> List[LotInfo]:
        """Retourne tous les lots en cours de gavage"""
        if not self.pool:
            return list(self.lots_cache.values())

        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT lot_id, gaveur_id, nb_canards, created_at,
                           gavage_status, current_day, itm_moyen,
                           sqal_samples, consumer_feedbacks
                    FROM lots_registry
                    WHERE gavage_status = 'en_cours'
                    ORDER BY created_at DESC
                """)

                return [self._row_to_lot_info(row) for row in rows]
        except Exception as e:
            logger.error(f"Error getting active lots: {e}")
            return []

    async def get_lot_stats(self) -> LotStats:
        """Retourne les statistiques globales des lots"""
        if not self.pool:
            return LotStats(
                total_lots=len(self.lots_cache),
                active_lots=sum(1 for lot in self.lots_cache.values() if lot.gavage_status == GavageStatus.EN_COURS),
                completed_lots=sum(1 for lot in self.lots_cache.values() if lot.gavage_status == GavageStatus.TERMINE),
                total_canards=sum(lot.nb_canards for lot in self.lots_cache.values()),
                average_gavage_duration=0.0,
                average_itm=0.0,
                average_consumer_rating=0.0
            )

        try:
            async with self.pool.acquire() as conn:
                stats = await conn.fetchrow("""
                    SELECT
                        COUNT(*) as total_lots,
                        SUM(CASE WHEN gavage_status = 'en_cours' THEN 1 ELSE 0 END) as active_lots,
                        SUM(CASE WHEN gavage_status = 'termine' THEN 1 ELSE 0 END) as completed_lots,
                        SUM(nb_canards) as total_canards,
                        AVG(current_day) as avg_duration,
                        AVG(itm_moyen) as avg_itm,
                        AVG(average_rating) as avg_rating
                    FROM lots_registry
                """)

                return LotStats(
                    total_lots=stats['total_lots'] or 0,
                    active_lots=stats['active_lots'] or 0,
                    completed_lots=stats['completed_lots'] or 0,
                    total_canards=stats['total_canards'] or 0,
                    average_gavage_duration=float(stats['avg_duration'] or 0.0),
                    average_itm=float(stats['avg_itm'] or 0.0),
                    average_consumer_rating=float(stats['avg_rating'] or 0.0)
                )
        except Exception as e:
            logger.error(f"Error getting lot stats: {e}")
            return LotStats(
                total_lots=0, active_lots=0, completed_lots=0,
                total_canards=0, average_gavage_duration=0.0,
                average_itm=0.0, average_consumer_rating=0.0
            )

    # ========================================================================
    # Database Operations (Private)
    # ========================================================================

    async def _save_lot_to_db(self, lot: LotInfo):
        """Sauvegarde un lot en base de données"""
        if not self.pool:
            return

        try:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO lots_registry (
                        lot_id, gaveur_id, nb_canards, created_at,
                        gavage_status, gavage_started_at, current_day, itm_moyen,
                        sqal_samples, consumer_feedbacks, average_rating
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (lot_id) DO UPDATE SET
                        gavage_status = EXCLUDED.gavage_status,
                        current_day = EXCLUDED.current_day,
                        itm_moyen = EXCLUDED.itm_moyen,
                        sqal_samples = EXCLUDED.sqal_samples,
                        consumer_feedbacks = EXCLUDED.consumer_feedbacks,
                        average_rating = EXCLUDED.average_rating
                """, lot.lot_id, lot.gaveur_id, lot.nb_canards, lot.created_at,
                    lot.gavage_status.value, lot.gavage_started_at, lot.current_day,
                    lot.itm_moyen, lot.sqal_samples, lot.consumer_feedbacks, lot.average_rating)
        except Exception as e:
            logger.error(f"Error saving lot to DB: {e}")

    async def _update_lot_in_db(self, lot: LotInfo):
        """Met à jour un lot en base de données"""
        await self._save_lot_to_db(lot)

    async def _load_lot_from_db(self, lot_id: str):
        """Charge un lot depuis la base de données"""
        if not self.pool:
            return

        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT * FROM lots_registry WHERE lot_id = $1
                """, lot_id)

                if row:
                    self.lots_cache[lot_id] = self._row_to_lot_info(row)
        except Exception as e:
            logger.error(f"Error loading lot from DB: {e}")

    async def _add_event(
        self,
        lot_id: str,
        event_type: LotEventType,
        data: Dict[str, Any],
        description: str
    ):
        """Ajoute un événement à la timeline d'un lot"""
        if not self.pool:
            return

        try:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO lot_events (
                        lot_id, timestamp, event_type, data, description
                    ) VALUES ($1, $2, $3, $4, $5)
                """, lot_id, datetime.now(), event_type.value, data, description)
        except Exception as e:
            logger.error(f"Error adding event: {e}")

    async def _get_events_from_db(self, lot_id: str) -> List[LotEvent]:
        """Récupère tous les événements d'un lot"""
        if not self.pool:
            return []

        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT timestamp, event_type, data, description
                    FROM lot_events
                    WHERE lot_id = $1
                    ORDER BY timestamp ASC
                """, lot_id)

                return [
                    LotEvent(
                        timestamp=row['timestamp'],
                        event_type=LotEventType(row['event_type']),
                        data=row['data'],
                        description=row['description']
                    )
                    for row in rows
                ]
        except Exception as e:
            logger.error(f"Error getting events: {e}")
            return []

    def _row_to_lot_info(self, row) -> LotInfo:
        """Convertit une ligne SQL en LotInfo"""
        return LotInfo(
            lot_id=row['lot_id'],
            gaveur_id=row['gaveur_id'],
            nb_canards=row['nb_canards'],
            created_at=row['created_at'],
            gavage_status=GavageStatus(row['gavage_status']),
            gavage_started_at=row.get('gavage_started_at'),
            gavage_ended_at=row.get('gavage_ended_at'),
            current_day=row.get('current_day', 0),
            itm_moyen=row.get('itm_moyen'),
            sqal_samples=row.get('sqal_samples', []),
            sqal_grades=row.get('sqal_grades', []),
            consumer_feedbacks=row.get('consumer_feedbacks', []),
            average_rating=row.get('average_rating'),
            blockchain_hash=row.get('blockchain_hash')
        )


# ============================================================================
# Global Instance
# ============================================================================

lot_registry = LotRegistry()
