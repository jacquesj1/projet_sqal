"""
Router API - Consumer Feedback & QR Code Traceability
Endpoints publics pour consommateurs + Analytics pour producteurs
"""

from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from datetime import datetime
import logging
import json

from app.models.consumer_feedback import (
    ConsumerFeedbackCreate,
    QRScanResponse,
    FeedbackSubmitResponse,
    FeedbackStatsResponse,
    FeedbackAnalytics,
    ProductTraceability
)
from app.services.consumer_feedback_service import consumer_feedback_service
from app.blockchain.blockchain_service import get_blockchain

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/consumer", tags=["Consumer Feedback & Traceability"])

public_router = APIRouter(prefix="/api/public", tags=["Public Traceability"])


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

        # Valider que le produit existe et correspond au QR scanné
        qr_product_id = await consumer_feedback_service.get_product_id_from_qr_code(feedback.qr_code)
        if not qr_product_id:
            raise HTTPException(status_code=404, detail="QR code invalide ou produit introuvable")

        if feedback.product_id != qr_product_id:
            raise HTTPException(status_code=400, detail="Le product_id ne correspond pas au QR code")

        is_valid_product = await consumer_feedback_service.validate_feedback_product(
            feedback.product_id,
            feedback.qr_code,
        )
        if not is_valid_product:
            raise HTTPException(status_code=404, detail="Produit introuvable")

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


# ============================================================================
# PUBLIC TRACEABILITY (frontend-traceability)
# ============================================================================

@public_router.get("/traceability/{trace_id}")
async def get_public_traceability(trace_id: str, request: Request):
    """Public endpoint used by frontend-traceability.

    It expects a trace id that is the QR token stored in DB (consumer_products.qr_code).
    """
    try:
        traceability = await consumer_feedback_service.scan_qr_code(trace_id)

        if not traceability:
            raise HTTPException(status_code=404, detail="Produit non trouvé")

        # Map SQAL grade to the simplified enum expected by frontend-traceability
        grade_raw = (traceability.sqal_grade or "").upper()
        if grade_raw in {"A+", "A"}:
            grade = "excellent"
        elif grade_raw in {"B"}:
            grade = "good"
        else:
            grade = "poor"

        score_pct = int(round((traceability.sqal_quality_score or 0.0) * 100))

        now_iso = datetime.utcnow().isoformat() + "Z"
        prod_date = traceability.production_date.isoformat() if traceability.production_date else now_iso
        qc_date = traceability.quality_control_date.isoformat() if traceability.quality_control_date else prod_date

        # Keep the payload minimal but compatible with the TraceabilityData interface
        return {
            "id": trace_id,
            "product": {
                "name": "Foie gras",
                "category": "Foie gras",
                "description": f"Produit issu du lot {traceability.lot_code}",
                "weight": "N/A",
                "production_date": prod_date,
                "product_code": traceability.product_id,
                "certifications": traceability.certifications or [],
            },
            "quality": {
                "score": score_pct,
                "grade": grade,
                "analysis": f"SQAL grade={traceability.sqal_grade} score={traceability.sqal_quality_score}",
            },
            "timeline": [
                {
                    "id": "gavage",
                    "title": "Gavage",
                    "description": f"Lot {traceability.lot_code}",
                    "status": "completed",
                    "date": prod_date,
                    "location": traceability.region,
                },
                {
                    "id": "sqal",
                    "title": "SQAL",
                    "description": f"Grade {traceability.sqal_grade}",
                    "status": "completed",
                    "date": qc_date,
                    "location": traceability.site_name,
                },
                {
                    "id": "trace",
                    "title": "Traçabilité",
                    "description": "QR token résolu côté API",
                    "status": "completed",
                    "date": now_iso,
                },
            ],
            "gaveur": {
                "name": "N/A",
                "farm_name": traceability.site_name or "N/A",
                "address": "N/A",
                "location": traceability.region or "N/A",
                "performance_score": 0,
                "certifications": [],
                "animals_count": 0,
            },
            "blockchain": {
                "transaction_hash": traceability.blockchain_hash or "",
                "block_number": 0,
                "confirmations": 0,
                "timestamp": qc_date,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur traçabilité publique: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/feedbacks")
async def get_recent_feedbacks(
    request: Request,
    limit: int = Query(10, description="Nombre de feedbacks à retourner", ge=1, le=100)
):
    """
    **PUBLIC** - Récupère les feedbacks consommateurs les plus récents

    Endpoint pour afficher les feedbacks dans le dashboard Live Demo.

    Args:
        limit: Nombre de feedbacks à retourner (défaut: 10, max: 100)

    Returns:
        Liste des feedbacks récents avec leur note et commentaire
    """
    try:
        pool = request.app.state.db_pool
        async with pool.acquire() as conn:
            feedbacks = await conn.fetch(
                """
                SELECT
                    feedback_id,
                    product_id,
                    overall_rating,
                    texture_rating,
                    flavor_rating,
                    freshness_rating,
                    comment,
                    consumption_context,
                    time
                FROM consumer_feedbacks
                ORDER BY time DESC
                LIMIT $1
                """,
                limit
            )

            result = []
            for fb in feedbacks:
                result.append({
                    "id": fb["feedback_id"],
                    "product_id": fb["product_id"],
                    "overall_rating": fb["overall_rating"],
                    "texture_rating": fb["texture_rating"],
                    "flavor_rating": fb["flavor_rating"],
                    "freshness_rating": fb["freshness_rating"],
                    "comment": fb["comment"],
                    "consumption_context": fb["consumption_context"],
                    "time": fb["time"].isoformat() if fb["time"] else None
                })

            return result

    except Exception as e:
        logger.error(f"Erreur récupération feedbacks récents: {e}", exc_info=True)
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
            "message": "Produit lie a la blockchain avec succes"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur liaison blockchain: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# BLOCKCHAIN VERIFICATION ENDPOINTS
# ============================================================================

@router.get("/blockchain/verify/{blockchain_hash}")
async def verify_blockchain_hash(blockchain_hash: str, request: Request):
    """
    **PUBLIC** - Vérifie l'authenticité d'un produit via son hash blockchain

    Permet aux consommateurs de vérifier la traçabilité blockchain d'un produit.
    Retourne les informations du bloc blockchain et confirme son intégrité.

    Args:
        blockchain_hash: Hash du bloc blockchain (visible dans QR scan response)

    Returns:
        - valid: True/False
        - data: Données du bloc si valide
        - timestamp: Horodatage du bloc
        - verified_at: Date de vérification
    """
    try:
        # Obtenir instance blockchain depuis le pool de la requête
        db_pool = request.app.state.db_pool
        blockchain = get_blockchain(db_pool)

        # Vérifier le hash
        verification_result = await blockchain.verifier_product_blockchain(blockchain_hash)

        if not verification_result["valid"]:
            return {
                "valid": False,
                "error": verification_result.get("error", "Hash invalide"),
                "message": "Ce produit ne peut pas etre verifie sur la blockchain. Il pourrait s'agir d'une contrefacon."
            }

        return {
            "valid": True,
            "blockchain_hash": blockchain_hash,
            "timestamp": verification_result["timestamp"],
            "type_evenement": verification_result["type_evenement"],
            "product_data": verification_result["data"],
            "verified_at": verification_result["verified_at"],
            "message": "Produit authentique - Tracabilite blockchain verifiee"
        }

    except Exception as e:
        logger.error(f"Erreur vérification blockchain: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/blockchain/product/{product_id}/history")
async def get_product_blockchain_history(product_id: str, request: Request):
    """
    **PUBLIC** - Récupère l'historique blockchain complet d'un produit

    Affiche tous les événements blockchain liés à ce produit
    (enregistrement produit, contrôles qualité SQAL, etc.)

    Args:
        product_id: ID produit unique

    Returns:
        Liste chronologique des événements blockchain
    """
    try:
        # Récupérer le hash blockchain du produit
        async with request.app.state.db_pool.acquire() as conn:
            product = await conn.fetchrow(
                """
                SELECT blockchain_hash, blockchain_verified
                FROM consumer_products
                WHERE product_id = $1
                """,
                product_id
            )

            if not product:
                raise HTTPException(status_code=404, detail="Produit non trouvé")

            if not product["blockchain_hash"]:
                return {
                    "product_id": product_id,
                    "blockchain_enabled": False,
                    "message": "Ce produit n'a pas de traçabilité blockchain activée"
                }

            # Récupérer tous les blocs liés à ce produit
            blockchain_events = await conn.fetch(
                """
                SELECT
                    index,
                    timestamp,
                    type_evenement,
                    donnees,
                    hash_actuel
                FROM blockchain
                WHERE donnees::jsonb @> $1::jsonb
                ORDER BY index ASC
                """,
                json.dumps({"product_id": product_id})
            )

            events = []
            for event in blockchain_events:
                events.append({
                    "index": event["index"],
                    "timestamp": event["timestamp"].isoformat(),
                    "type_evenement": event["type_evenement"],
                    "donnees": json.loads(event["donnees"]),
                    "hash": event["hash_actuel"]
                })

            return {
                "product_id": product_id,
                "blockchain_enabled": True,
                "blockchain_verified": product["blockchain_verified"],
                "total_events": len(events),
                "events": events,
                "message": f"✅ {len(events)} événement(s) blockchain trouvé(s)"
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération historique blockchain: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/blockchain/recent")
async def get_recent_blockchain_blocks(
    request: Request,
    limit: int = Query(10, description="Nombre de blocs à retourner", ge=1, le=100)
):
    """
    **PUBLIC** - Récupère les blocs blockchain les plus récents

    Endpoint pour afficher les derniers blocs dans le dashboard Live Demo.

    Args:
        limit: Nombre de blocs à retourner (défaut: 10, max: 100)

    Returns:
        Liste des blocs récents avec leur type et hash
    """
    try:
        pool = request.app.state.db_pool
        async with pool.acquire() as conn:
            blocks = await conn.fetch(
                """
                SELECT index, timestamp, type_evenement, hash_actuel, donnees
                FROM blockchain
                ORDER BY index DESC
                LIMIT $1
                """,
                limit
            )

            result = []
            for block in blocks:
                result.append({
                    "index": block["index"],
                    "timestamp": block["timestamp"].isoformat() if block["timestamp"] else None,
                    "type_evenement": block["type_evenement"],
                    "hash_actuel": block["hash_actuel"],
                    "donnees": json.loads(block["donnees"]) if block["donnees"] else {}
                })

            return result

    except Exception as e:
        logger.error(f"Erreur récupération blocs blockchain récents: {e}", exc_info=True)
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


@router.get("/products")
async def get_available_products(
    request: Request,
    lot_id: Optional[int] = Query(None, description="Filtrer par lots_gavage.id"),
    code_lot: Optional[str] = Query(None, description="Filtrer par lots_gavage.code_lot (ex: LL2512001)")
):
    """
    **PUBLIC** - Récupère tous les produits disponibles avec QR codes

    Utilisé par le simulateur de satisfaction clients pour générer des feedbacks.

    Returns:
        Liste des produits avec leurs QR codes et informations de traçabilité
    """
    try:
        pool = request.app.state.db_pool

        async with pool.acquire() as conn:
            if lot_id is not None and code_lot is not None:
                raise HTTPException(status_code=400, detail="Provide only one filter: lot_id or code_lot")

            query = """
                SELECT
                    p.product_id,
                    p.qr_code,
                    p.lot_id,
                    p.sample_id,
                    p.sqal_grade,
                    p.blockchain_hash,
                    p.created_at
                FROM consumer_products p
            """
            params = []

            if code_lot is not None:
                query += """
                    JOIN lots_gavage l ON l.id = p.lot_id
                    WHERE l.code_lot = $1
                """
                params.append(code_lot)
            elif lot_id is not None:
                query += """
                    WHERE p.lot_id = $1
                """
                params.append(lot_id)

            query += """
                ORDER BY p.created_at DESC
            """

            records = await conn.fetch(query, *params)

            products = [dict(r) for r in records]

            logger.info(f"📦 Récupération de {len(products)} produits disponibles")

            return products

    except Exception as e:
        logger.error(f"Erreur récupération produits: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest-product")
async def get_latest_product(request: Request):
    try:
        pool = request.app.state.db_pool

        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    p.product_id,
                    p.qr_code,
                    p.lot_id,
                    p.sample_id,
                    p.sqal_grade,
                    p.blockchain_hash,
                    p.created_at,
                    l.code_lot
                FROM consumer_products p
                LEFT JOIN lots_gavage l ON l.id = p.lot_id
                WHERE p.is_active = TRUE
                ORDER BY p.created_at DESC
                LIMIT 1
                """
            )

            if not row:
                raise HTTPException(status_code=404, detail="Aucun produit disponible")

            tof_score = None
            as7341_score = None
            if row["sample_id"]:
                scores = await conn.fetchrow(
                    """
                    SELECT
                        vl53l8ch_quality_score AS tof_score,
                        as7341_quality_score AS as7341_score
                    FROM sensor_samples
                    WHERE sample_id = $1
                    ORDER BY timestamp DESC
                    LIMIT 1
                    """,
                    row["sample_id"],
                )
                if scores:
                    tof_score = float(scores["tof_score"]) if scores["tof_score"] is not None else None
                    as7341_score = float(scores["as7341_score"]) if scores["as7341_score"] is not None else None

            product = {
                "product_id": row["product_id"],
                "qr_code": row["qr_code"],
                "lot_id": row["lot_id"],
                "sample_id": row["sample_id"],
                "sqal_grade": row["sqal_grade"],
                "blockchain_hash": row["blockchain_hash"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "tof_score": tof_score,
                "as7341_score": as7341_score,
            }

            return {
                "code_lot": row["code_lot"],
                "lot_id": row["lot_id"],
                "product": product,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération dernier produit: {e}")
        raise HTTPException(status_code=500, detail=str(e))
