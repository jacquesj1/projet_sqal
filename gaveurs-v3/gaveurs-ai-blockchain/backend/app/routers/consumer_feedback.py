"""
Router API - Consumer Feedback & QR Code Traceability
Endpoints publics pour consommateurs + Analytics pour producteurs
"""

from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from datetime import datetime
import logging

from app.models.consumer_feedback import (
    ConsumerFeedbackCreate,
    QRScanResponse,
    FeedbackSubmitResponse,
    FeedbackStatsResponse,
    FeedbackAnalytics,
    ProductTraceability
)
from app.services.consumer_feedback_service import consumer_feedback_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/consumer", tags=["Consumer Feedback & Traceability"])


# ============================================================================
# PUBLIC ENDPOINTS (Consommateurs)
# ============================================================================

@router.get("/scan/{qr_code}", response_model=QRScanResponse)
async def scan_qr_code(qr_code: str, request: Request):
    """
    **PUBLIC** - Scan QR code produit et récupère traçabilité complète

    Utilisé par l'application consommateur mobile/web après scan QR.

    Args:
        qr_code: Code QR scanné (format: SQAL_{lot_id}_{sample_id}_{product_id}_{sig})

    Returns:
        - Traçabilité complète (origine, qualité SQAL, blockchain)
        - Already_reviewed (si consommateur a déjà laissé feedback)
        - Note moyenne produit (si >5 feedbacks)
        - Total avis
    """
    try:
        # Récupérer traçabilité
        traceability = await consumer_feedback_service.scan_qr_code(qr_code)

        if not traceability:
            raise HTTPException(status_code=404, detail="QR code invalide ou produit introuvable")

        # Vérifier si déjà reviewed
        client_ip = request.client.host if request.client else "unknown"
        already_reviewed = await consumer_feedback_service.check_already_reviewed(qr_code, client_ip)

        # Analytics produit (si disponibles)
        analytics = await consumer_feedback_service.get_product_analytics(traceability.product_id)

        return QRScanResponse(
            success=True,
            traceability=traceability,
            already_reviewed=already_reviewed,
            average_rating=analytics.average_overall_rating if analytics and analytics.total_feedbacks >= 5 else None,
            total_reviews=analytics.total_feedbacks if analytics else 0
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur scan QR code: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/feedback", response_model=FeedbackSubmitResponse)
async def submit_feedback(feedback: ConsumerFeedbackCreate, request: Request):
    """
    **PUBLIC** - Soumet un feedback consommateur après scan QR

    Le feedback est automatiquement intégré aux données ML pour améliorer
    les courbes d'alimentation des gaveurs.

    Args:
        feedback: Données feedback (note, commentaire, contexte)

    Returns:
        - success
        - feedback_id
        - message de remerciement
        - reward_points (optionnel)
    """
    try:
        # Récupérer IP pour anti-doublons (hashée, pas stockée en clair)
        client_ip = request.client.host if request.client else "unknown"

        # Vérifier doublon
        already_reviewed = await consumer_feedback_service.check_already_reviewed(feedback.qr_code, client_ip)
        if already_reviewed:
            raise HTTPException(
                status_code=409,
                detail="Vous avez déjà laissé un avis pour ce produit"
            )

        # Enregistrer feedback
        feedback_id = await consumer_feedback_service.submit_feedback(feedback, client_ip)

        if not feedback_id:
            raise HTTPException(status_code=500, detail="Échec enregistrement feedback")

        # Points de récompense (optionnel, à implémenter selon système fidélité)
        reward_points = 10 if feedback.comment and len(feedback.comment) > 50 else 5

        return FeedbackSubmitResponse(
            success=True,
            feedback_id=feedback_id,
            message="Merci pour votre retour ! Il nous aidera à améliorer nos produits et nos méthodes de production.",
            reward_points=reward_points
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur soumission feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/product/{product_id}/stats")
async def get_product_public_stats(product_id: str):
    """
    **PUBLIC** - Statistiques publiques d'un produit

    Affiche note moyenne, distribution notes et nombre total d'avis.
    Disponible pour tous les produits avec >5 feedbacks.

    Args:
        product_id: ID produit

    Returns:
        Statistiques agrégées (sans commentaires individuels)
    """
    try:
        analytics = await consumer_feedback_service.get_product_analytics(product_id)

        if not analytics or analytics.total_feedbacks < 5:
            raise HTTPException(
                status_code=404,
                detail="Pas encore assez d'avis pour afficher les statistiques"
            )

        return {
            "product_id": product_id,
            "total_reviews": analytics.total_feedbacks,
            "average_rating": round(analytics.average_overall_rating, 2),
            "rating_distribution": analytics.rating_distribution,
            "recommendation_rate": round(analytics.recommendation_rate, 1)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur stats produit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PRODUCER ENDPOINTS (Producteurs Euralis)
# ============================================================================

@router.get("/producer/lot/{lot_id}/stats", response_model=FeedbackStatsResponse)
async def get_lot_feedback_stats(
    lot_id: int,
    period: str = Query("30d", description="Période: 7d, 30d, 90d, all")
):
    """
    **PRODUCER** - Statistiques feedbacks consommateurs pour un lot

    Permet aux producteurs de voir comment leurs lots sont perçus
    par les consommateurs.

    Args:
        lot_id: ID lot gavage
        period: Période d'analyse (7d/30d/90d/all)

    Returns:
        - Analytics détaillées
        - Commentaires récents (5 derniers)
        - Insights IA (si disponibles)
    """
    try:
        # Parse période
        period_days = {
            "7d": 7,
            "30d": 30,
            "90d": 90,
            "all": 365 * 5  # 5 ans max
        }.get(period, 30)

        # Analytics
        analytics = await consumer_feedback_service.get_lot_analytics(lot_id, period_days)

        if not analytics:
            raise HTTPException(
                status_code=404,
                detail=f"Aucun feedback pour le lot {lot_id} sur cette période"
            )

        # Commentaires récents
        comments = await consumer_feedback_service.get_recent_comments(lot_id=lot_id, limit=5)
        recent_comments = [c["comment"] for c in comments if c["comment"]]

        # TODO: Insights IA (à implémenter dans module ML)
        insights = None

        return FeedbackStatsResponse(
            period=period,
            analytics=analytics,
            recent_comments=recent_comments,
            insights=insights
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur stats lot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/producer/site/{site_code}/stats")
async def get_site_feedback_stats(
    site_code: str,
    period: str = Query("30d", description="Période: 7d, 30d, 90d, all")
):
    """
    **PRODUCER** - Statistiques feedbacks par site

    Vue d'ensemble satisfaction consommateurs par site de production.

    Args:
        site_code: Code site (LL/LS/MT)
        period: Période d'analyse

    Returns:
        Statistiques agrégées par site
    """
    try:
        # TODO: Implémenter agrégation site depuis consumer_site_stats
        # Pour l'instant, retourne placeholder

        return {
            "site_code": site_code,
            "period": period,
            "message": "Stats site en cours d'implémentation"
        }

    except Exception as e:
        logger.error(f"Erreur stats site: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/producer/comments/recent")
async def get_recent_producer_comments(
    site_code: Optional[str] = Query(None, description="Filtrer par site"),
    limit: int = Query(20, ge=1, le=100)
):
    """
    **PRODUCER** - Commentaires consommateurs récents

    Permet aux producteurs de lire les retours directs consommateurs.

    Args:
        site_code: Filtrer par site (optionnel)
        limit: Nombre max commentaires (1-100)

    Returns:
        Liste commentaires avec contexte
    """
    try:
        comments = await consumer_feedback_service.get_recent_comments(
            site_code=site_code,
            limit=limit
        )

        return {
            "total": len(comments),
            "comments": comments
        }

    except Exception as e:
        logger.error(f"Erreur commentaires récents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# INTERNAL ENDPOINTS (Backend → Backend)
# ============================================================================

@router.post("/internal/register-product")
async def register_product_after_sqal_control(
    lot_id: int,
    sample_id: str,
    site_code: str
):
    """
    **INTERNAL** - Enregistre un produit après contrôle qualité SQAL

    Appelé automatiquement par le backend après qu'un échantillon SQAL
    a été analysé et validé.

    Génère:
    - product_id unique
    - QR code cryptographique
    - Lien lot + sample SQAL
    - Préparation blockchain

    Args:
        lot_id: ID lot Euralis
        sample_id: ID échantillon SQAL
        site_code: Code site (LL/LS/MT)

    Returns:
        - product_id
        - qr_code (à imprimer sur packaging)
    """
    try:
        product_id, qr_code = await consumer_feedback_service.register_product_after_sqal(
            lot_id, sample_id, site_code
        )

        return {
            "success": True,
            "product_id": product_id,
            "qr_code": qr_code,
            "message": "Produit enregistré avec succès. QR code prêt pour impression."
        }

    except Exception as e:
        logger.error(f"Erreur enregistrement produit: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/internal/link-blockchain")
async def link_product_to_blockchain(
    product_id: str,
    blockchain_hash: str
):
    """
    **INTERNAL** - Lie un produit à une transaction blockchain

    Appelé après enregistrement événement qualité dans blockchain Hyperledger Fabric.

    Args:
        product_id: ID produit
        blockchain_hash: Hash transaction blockchain

    Returns:
        Confirmation liaison
    """
    try:
        success = await consumer_feedback_service.link_product_to_blockchain(
            product_id, blockchain_hash
        )

        if not success:
            raise HTTPException(status_code=500, detail="Échec liaison blockchain")

        return {
            "success": True,
            "product_id": product_id,
            "blockchain_hash": blockchain_hash,
            "message": "Produit lié à la blockchain avec succès"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur liaison blockchain: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ML ENDPOINTS (Machine Learning)
# ============================================================================

@router.get("/ml/training-data")
async def get_ml_training_data(
    site_code: Optional[str] = Query(None, description="Filtrer par site"),
    min_feedbacks: int = Query(100, description="Minimum feedbacks requis")
):
    """
    **ML** - Récupère données ML pour entraînement IA

    Données préparées pour entraîner modèles de prédiction :
    - Corrélation métriques production ↔ satisfaction consommateur
    - Amélioration courbes alimentation gaveurs
    - Optimisation qualité finale

    Args:
        site_code: Filtrer par site (optionnel)
        min_feedbacks: Minimum feedbacks requis (défaut: 100)

    Returns:
        Liste de FeedbackMLInput (données normalisées pour ML)
    """
    try:
        ml_data = await consumer_feedback_service.get_ml_training_data(
            site_code=site_code,
            min_feedbacks=min_feedbacks
        )

        if not ml_data:
            raise HTTPException(
                status_code=404,
                detail=f"Pas assez de données ML (minimum: {min_feedbacks})"
            )

        return {
            "success": True,
            "total_samples": len(ml_data),
            "site_code": site_code or "all",
            "data": ml_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération données ML: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ml/mark-used")
async def mark_ml_data_used(feedback_ids: list[int], split: str = "train"):
    """
    **ML** - Marque données ML comme utilisées pour entraînement

    Permet de tracker quelles données ont été utilisées pour quel split (train/test/val).

    Args:
        feedback_ids: Liste feedback IDs utilisés
        split: train/test/validation

    Returns:
        Confirmation
    """
    try:
        await consumer_feedback_service.mark_ml_data_used(feedback_ids, split)

        return {
            "success": True,
            "marked_count": len(feedback_ids),
            "split": split
        }

    except Exception as e:
        logger.error(f"Erreur marquage données ML: {e}")
        raise HTTPException(status_code=500, detail=str(e))
