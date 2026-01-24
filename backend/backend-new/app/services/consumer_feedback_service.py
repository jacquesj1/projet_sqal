"""
Service Layer - Consumer Feedback & QR Code Traceability
Intégré avec SQAL, Blockchain et amélioration IA courbes alimentation
"""

import asyncpg
import json
import hashlib
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta, date
import logging

from app.models.consumer_feedback import (
    ConsumerFeedbackCreate,
    ConsumerFeedbackDB,
    ProductTraceability,
    QRCodeData,
    FeedbackAnalytics,
    FeedbackMLInput,
    FeedbackInsights
)

logger = logging.getLogger(__name__)


class ConsumerFeedbackService:
    """
    Service pour gestion feedbacks consommateurs et QR codes

    Responsabilités:
    - Génération QR codes après contrôle SQAL
    - Scan QR code → Traçabilité produit
    - Collecte feedbacks consommateurs
    - Auto-remplissage données ML
    - Analytics feedbacks
    - Génération insights IA
    """

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def init_pool(self, database_url: str):
        """Initialise le pool de connexions PostgreSQL"""
        self.pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10)
        logger.info("Pool de connexions Consumer Feedback initialisé")

    async def close_pool(self):
        """Ferme le pool de connexions"""
        if self.pool:
            await self.pool.close()
            logger.info("Pool de connexions Consumer Feedback fermé")

    # ============================================================================
    # QR CODE GENERATION
    # ============================================================================

    async def register_product_after_sqal(
        self,
        lot_id: int,
        sample_id: str,
        site_code: str
    ) -> Tuple[str, str]:
        """
        Enregistre un produit après contrôle qualité SQAL et génère QR code

        Args:
            lot_id: ID du lot Euralis
            sample_id: ID échantillon SQAL
            site_code: Code site (LL/LS/MT)

        Returns:
            Tuple (product_id, qr_code)
        """
        try:
            async with self.pool.acquire() as conn:
                # Appelle fonction SQL qui génère QR code et enregistre produit
                result = await conn.fetchrow(
                    "SELECT * FROM register_consumer_product($1, $2, $3)",
                    lot_id,
                    sample_id,
                    site_code
                )

                product_id = result["product_id"]
                qr_code = result["qr_code"]

                logger.info(
                    f"✅ Produit enregistré : {product_id} | "
                    f"QR: {qr_code[:30]}... | Lot: {lot_id} | SQAL: {sample_id}"
                )

                return product_id, qr_code

        except Exception as e:
            logger.error(f"❌ Erreur enregistrement produit: {e}", exc_info=True)
            raise

    async def link_product_to_blockchain(
        self,
        product_id: str,
        blockchain_hash: str
    ) -> bool:
        """
        Lie un produit à une transaction blockchain

        Args:
            product_id: ID produit
            blockchain_hash: Hash transaction blockchain

        Returns:
            True si succès
        """
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE consumer_products
                    SET blockchain_hash = $1,
                        blockchain_verified = TRUE
                    WHERE product_id = $2
                    """,
                    blockchain_hash,
                    product_id
                )

                logger.info(f"✅ Produit {product_id} lié à blockchain: {blockchain_hash[:16]}...")
                return True

        except Exception as e:
            logger.error(f"❌ Erreur liaison blockchain: {e}")
            return False

    # ============================================================================
    # QR CODE SCAN & TRACEABILITY
    # ============================================================================

    async def scan_qr_code(self, qr_code: str) -> Optional[ProductTraceability]:
        """
        Scan QR code et retourne traçabilité complète

        Args:
            qr_code: Code QR scanné par consommateur

        Returns:
            ProductTraceability ou None si invalide
        """
        try:
            async with self.pool.acquire() as conn:
                # Récupère produit + données liées
                row = await conn.fetchrow(
                    """
                    SELECT
                        p.*,
                        s.nom as site_name,
                        s.region,
                        l.code_lot
                    FROM consumer_products p
                    LEFT JOIN sites_euralis s ON p.site_code = s.code
                    LEFT JOIN lots_gavage l ON p.lot_id = l.id
                    WHERE p.qr_code = $1 AND p.is_active = TRUE
                    """,
                    qr_code
                )

                if not row:
                    logger.warning(f"⚠️ QR code invalide ou produit désactivé: {qr_code}")
                    return None

                # Convertit en ProductTraceability
                product = dict(row)

                traceability = ProductTraceability(
                    product_id=product["product_id"],
                    lot_code=product["code_lot"] or "N/A",
                    qr_code=product["qr_code"],
                    site_code=product["site_code"],
                    site_name=product["site_name"] or "Site Euralis",
                    region=product["region"] or "France",
                    production_date=product["production_date"],
                    quality_control_date=product["quality_control_date"],
                    packaging_date=product["packaging_date"],
                    best_before_date=product["best_before_date"],
                    sqal_quality_score=float(product["sqal_quality_score"]) if product["sqal_quality_score"] else 0.0,
                    sqal_grade=product["sqal_grade"] or "N/A",
                    sqal_compliance=product["sqal_compliance"] or False,
                    gavage_duration_days=product["gavage_duration_days"] or 14,
                    average_itm=float(product["lot_itm"]) if product["lot_itm"] else None,
                    certifications=product["certifications"] if product["certifications"] else [],
                    production_method=product["production_method"] or "traditionnel",
                    carbon_footprint_kg=float(product["carbon_footprint_kg"]) if product["carbon_footprint_kg"] else None,
                    animal_welfare_score=float(product["animal_welfare_score"]) if product["animal_welfare_score"] else None,
                    blockchain_hash=product["blockchain_hash"] or "",
                    blockchain_verified=product["blockchain_verified"] or False
                )

                logger.info(f"✅ QR scanné : {product['product_id']} | Score SQAL: {traceability.sqal_quality_score:.2f}")
                return traceability

        except Exception as e:
            logger.error(f"❌ Erreur scan QR code: {e}", exc_info=True)
            return None

    async def check_already_reviewed(self, qr_code: str, ip_address: str) -> bool:
        """
        Vérifie si un consommateur a déjà laissé un feedback pour ce produit

        Args:
            qr_code: Code QR produit
            ip_address: Adresse IP consommateur (sera hashée)

        Returns:
            True si déjà reviewed
        """
        try:
            # Hash IP pour ne pas la stocker en clair
            ip_hash = hashlib.sha256(ip_address.encode()).hexdigest()

            async with self.pool.acquire() as conn:
                # Cherche feedback existant (même IP + même produit dans les 30 derniers jours)
                count = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM consumer_feedbacks f
                    JOIN consumer_products p ON f.product_id = p.product_id
                    WHERE p.qr_code = $1
                      AND f.ip_hash = $2
                      AND f.time > NOW() - INTERVAL '30 days'
                    """,
                    qr_code,
                    ip_hash
                )

                return count > 0

        except Exception as e:
            logger.error(f"❌ Erreur vérification already_reviewed: {e}")
            return False  # En cas d'erreur, autoriser le feedback

    # ============================================================================
    # FEEDBACK SUBMISSION
    # ============================================================================

    async def submit_feedback(
        self,
        feedback: ConsumerFeedbackCreate,
        ip_address: str
    ) -> Optional[int]:
        """
        Enregistre un feedback consommateur

        Args:
            feedback: Données feedback
            ip_address: IP consommateur (hashée pour anti-doublons)

        Returns:
            feedback_id ou None si échec
        """
        try:
            # Hash IP
            ip_hash = hashlib.sha256(ip_address.encode()).hexdigest()

            # Vérifier doublon (optionnel, déjà fait côté endpoint)
            already_reviewed = await self.check_already_reviewed(feedback.qr_code, ip_address)
            if already_reviewed:
                logger.warning(f"⚠️ Doublon feedback ignoré: QR {feedback.qr_code[:20]}...")
                return None

            async with self.pool.acquire() as conn:
                # Insérer feedback
                feedback_id = await conn.fetchval(
                    """
                    INSERT INTO consumer_feedbacks (
                        time, product_id, overall_rating,
                        texture_rating, flavor_rating, color_rating, aroma_rating, freshness_rating,
                        comment, consumption_context, consumption_date,
                        consumer_age_range, consumer_region,
                        would_recommend, repurchase_intent,
                        photo_urls, device_type, app_version, ip_hash
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
                    )
                    RETURNING feedback_id
                    """,
                    datetime.utcnow(),
                    feedback.product_id,
                    feedback.overall_rating,
                    feedback.detailed_ratings.texture if feedback.detailed_ratings else None,
                    feedback.detailed_ratings.flavor if feedback.detailed_ratings else None,
                    feedback.detailed_ratings.color if feedback.detailed_ratings else None,
                    feedback.detailed_ratings.aroma if feedback.detailed_ratings else None,
                    feedback.detailed_ratings.freshness if feedback.detailed_ratings else None,
                    feedback.comment,
                    feedback.consumption_context,
                    feedback.consumption_date,
                    feedback.consumer_age_range,
                    feedback.consumer_region,
                    feedback.would_recommend,
                    feedback.repurchase_intent,
                    json.dumps(feedback.photo_urls) if feedback.photo_urls else '[]',
                    feedback.device_type,
                    feedback.app_version,
                    ip_hash
                )

                logger.info(
                    f"✅ Feedback enregistré : ID {feedback_id} | "
                    f"Produit: {feedback.product_id} | Note: {feedback.overall_rating}/5"
                )

                # Trigger auto_populate_ml_data se déclenche automatiquement

                return feedback_id

        except Exception as e:
            logger.error(f"❌ Erreur soumission feedback: {e}", exc_info=True)
            return None

    # ============================================================================
    # ANALYTICS
    # ============================================================================

    async def get_product_analytics(self, product_id: str) -> Optional[FeedbackAnalytics]:
        """
        Récupère analytics feedbacks pour un produit

        Args:
            product_id: ID produit

        Returns:
            FeedbackAnalytics ou None
        """
        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT * FROM consumer_product_stats
                    WHERE product_id = $1
                    """,
                    product_id
                )

                if not row or row["total_feedbacks"] == 0:
                    return None

                stats = dict(row)

                return FeedbackAnalytics(
                    total_feedbacks=stats["total_feedbacks"],
                    average_overall_rating=float(stats["avg_overall_rating"]),
                    rating_distribution={
                        5: stats["count_5_stars"],
                        4: stats["count_4_stars"],
                        3: stats["count_3_stars"],
                        2: stats["count_2_stars"],
                        1: stats["count_1_star"]
                    },
                    avg_texture=float(stats["avg_texture_rating"]) if stats["avg_texture_rating"] else None,
                    avg_flavor=float(stats["avg_flavor_rating"]) if stats["avg_flavor_rating"] else None,
                    avg_color=float(stats["avg_color_rating"]) if stats["avg_color_rating"] else None,
                    avg_aroma=float(stats["avg_aroma_rating"]) if stats["avg_aroma_rating"] else None,
                    avg_freshness=float(stats["avg_freshness_rating"]) if stats["avg_freshness_rating"] else None,
                    recommendation_rate=float(stats["recommendation_rate_pct"]) if stats["recommendation_rate_pct"] else 0.0,
                    avg_repurchase_intent=float(stats["avg_repurchase_intent"]) if stats["avg_repurchase_intent"] else None
                )

        except Exception as e:
            logger.error(f"❌ Erreur analytics produit: {e}")
            return None

    async def get_lot_analytics(
        self,
        lot_id: int,
        period_days: int = 30
    ) -> Optional[FeedbackAnalytics]:
        """
        Récupère analytics feedbacks pour un lot (agrégé tous produits du lot)

        Args:
            lot_id: ID lot
            period_days: Période d'analyse (jours)

        Returns:
            FeedbackAnalytics ou None
        """
        try:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=period_days)

            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(*) as total_feedbacks,
                        AVG(overall_rating) as avg_overall_rating,
                        AVG(texture_rating) as avg_texture,
                        AVG(flavor_rating) as avg_flavor,
                        AVG(color_rating) as avg_color,
                        AVG(aroma_rating) as avg_aroma,
                        AVG(freshness_rating) as avg_freshness,
                        COUNT(*) FILTER (WHERE overall_rating = 5) as count_5,
                        COUNT(*) FILTER (WHERE overall_rating = 4) as count_4,
                        COUNT(*) FILTER (WHERE overall_rating = 3) as count_3,
                        COUNT(*) FILTER (WHERE overall_rating = 2) as count_2,
                        COUNT(*) FILTER (WHERE overall_rating = 1) as count_1,
                        (COUNT(*) FILTER (WHERE would_recommend = TRUE)::FLOAT / NULLIF(COUNT(*), 0) * 100) as rec_rate,
                        AVG(repurchase_intent) as avg_repurchase
                    FROM consumer_feedbacks f
                    JOIN consumer_products p ON f.product_id = p.product_id
                    WHERE p.lot_id = $1
                      AND f.time BETWEEN $2 AND $3
                      AND f.is_public = TRUE
                    """,
                    lot_id,
                    start_time,
                    end_time
                )

                if not row or row["total_feedbacks"] == 0:
                    return None

                stats = dict(row)

                return FeedbackAnalytics(
                    total_feedbacks=stats["total_feedbacks"],
                    average_overall_rating=float(stats["avg_overall_rating"]),
                    rating_distribution={
                        5: stats["count_5"],
                        4: stats["count_4"],
                        3: stats["count_3"],
                        2: stats["count_2"],
                        1: stats["count_1"]
                    },
                    avg_texture=float(stats["avg_texture"]) if stats["avg_texture"] else None,
                    avg_flavor=float(stats["avg_flavor"]) if stats["avg_flavor"] else None,
                    avg_color=float(stats["avg_color"]) if stats["avg_color"] else None,
                    avg_aroma=float(stats["avg_aroma"]) if stats["avg_aroma"] else None,
                    avg_freshness=float(stats["avg_freshness"]) if stats["avg_freshness"] else None,
                    recommendation_rate=float(stats["rec_rate"]) if stats["rec_rate"] else 0.0,
                    avg_repurchase_intent=float(stats["avg_repurchase"]) if stats["avg_repurchase"] else None
                )

        except Exception as e:
            logger.error(f"❌ Erreur analytics lot: {e}")
            return None

    async def get_recent_comments(
        self,
        lot_id: Optional[int] = None,
        site_code: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Récupère les commentaires récents

        Args:
            lot_id: Filtrer par lot (optionnel)
            site_code: Filtrer par site (optionnel)
            limit: Nombre max commentaires

        Returns:
            Liste de commentaires
        """
        try:
            async with self.pool.acquire() as conn:
                query = """
                    SELECT
                        f.time,
                        f.overall_rating,
                        f.comment,
                        f.consumption_context,
                        f.consumer_region,
                        p.product_id,
                        p.site_code
                    FROM consumer_feedbacks f
                    JOIN consumer_products p ON f.product_id = p.product_id
                    WHERE f.is_public = TRUE
                      AND f.comment IS NOT NULL
                      AND LENGTH(f.comment) > 10
                """
                params = []
                param_idx = 1

                if lot_id:
                    query += f" AND p.lot_id = ${param_idx}"
                    params.append(lot_id)
                    param_idx += 1

                if site_code:
                    query += f" AND p.site_code = ${param_idx}"
                    params.append(site_code)
                    param_idx += 1

                query += f" ORDER BY f.time DESC LIMIT ${param_idx}"
                params.append(limit)

                rows = await conn.fetch(query, *params)

                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"❌ Erreur récupération commentaires: {e}")
            return []

    # ============================================================================
    # ML DATA & INSIGHTS
    # ============================================================================

    async def get_ml_training_data(
        self,
        site_code: Optional[str] = None,
        min_feedbacks: int = 100
    ) -> List[FeedbackMLInput]:
        """
        Récupère données ML pour entraînement IA

        Args:
            site_code: Filtrer par site (optionnel)
            min_feedbacks: Minimum feedbacks requis

        Returns:
            Liste FeedbackMLInput
        """
        try:
            async with self.pool.acquire() as conn:
                query = "SELECT * FROM consumer_feedback_ml_data WHERE 1=1"
                params = []
                param_idx = 1

                if site_code:
                    query += f" AND site_code = ${param_idx}"
                    params.append(site_code)
                    param_idx += 1

                query += " AND used_for_training = FALSE"

                rows = await conn.fetch(query, *params)

                if len(rows) < min_feedbacks:
                    logger.warning(
                        f"⚠️ Pas assez de données ML ({len(rows)}/{min_feedbacks})"
                    )
                    return []

                # Convertit en FeedbackMLInput
                ml_data = []
                for row in rows:
                    r = dict(row)
                    ml_data.append(FeedbackMLInput(
                        lot_id=r["lot_id"],
                        sample_id=r["sample_id"],
                        feedback_id=r["feedback_id"],
                        lot_itm=float(r["lot_itm"]) if r["lot_itm"] else 0.0,
                        lot_avg_weight=float(r["lot_avg_weight"]) if r["lot_avg_weight"] else 0.0,
                        lot_mortality_rate=float(r["lot_mortality_rate"]) if r["lot_mortality_rate"] else 0.0,
                        lot_feed_conversion=float(r["lot_feed_conversion"]) if r["lot_feed_conversion"] else 0.0,
                        sqal_score=float(r["sqal_score"]) if r["sqal_score"] else 0.0,
                        sqal_grade=r["sqal_grade"] or "N/A",
                        vl53l8ch_volume=float(r["vl53l8ch_volume_mm3"]) if r["vl53l8ch_volume_mm3"] else 0.0,
                        vl53l8ch_uniformity=float(r["vl53l8ch_surface_uniformity"]) if r["vl53l8ch_surface_uniformity"] else 0.0,
                        as7341_freshness=float(r["as7341_freshness_index"]) if r["as7341_freshness_index"] else 0.0,
                        as7341_fat_quality=float(r["as7341_fat_quality_index"]) if r["as7341_fat_quality_index"] else 0.0,
                        as7341_oxidation=float(r["as7341_oxidation_index"]) if r["as7341_oxidation_index"] else 0.0,
                        consumer_overall_rating=r["consumer_overall_rating"],
                        consumer_texture_rating=r["consumer_texture_rating"],
                        consumer_flavor_rating=r["consumer_flavor_rating"],
                        consumer_freshness_rating=r["consumer_freshness_rating"],
                        consumer_would_recommend=r["consumer_would_recommend"] or False,
                        site_code=r["site_code"],
                        production_date=r["production_date"],
                        consumption_delay_days=r["consumption_delay_days"] or 0
                    ))

                logger.info(f"✅ Données ML récupérées : {len(ml_data)} échantillons")
                return ml_data

        except Exception as e:
            logger.error(f"❌ Erreur récupération données ML: {e}", exc_info=True)
            return []

    async def mark_ml_data_used(self, feedback_ids: List[int], split: str = "train"):
        """
        Marque des données ML comme utilisées pour entraînement

        Args:
            feedback_ids: Liste feedback IDs utilisés
            split: train/test/validation
        """
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE consumer_feedback_ml_data
                    SET used_for_training = TRUE,
                        train_test_split = $1
                    WHERE feedback_id = ANY($2)
                    """,
                    split,
                    feedback_ids
                )

                logger.info(f"✅ {len(feedback_ids)} données ML marquées '{split}'")

        except Exception as e:
            logger.error(f"❌ Erreur marquage données ML: {e}")


# Instance globale (singleton)
consumer_feedback_service = ConsumerFeedbackService()
