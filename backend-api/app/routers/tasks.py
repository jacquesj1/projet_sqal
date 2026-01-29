"""
Routes API pour Gestion des Tâches Celery

Permet de déclencher, monitorer et gérer les tâches asynchrones.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from celery.result import AsyncResult

from app.tasks.celery_app import celery_app
from app.tasks import ml_tasks, export_tasks, notification_tasks, scheduled_tasks

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


# ============================================================================
# Pydantic Models
# ============================================================================

class TaskTriggerRequest(BaseModel):
    """Request pour déclencher une tâche"""
    task_name: str
    args: List[Any] = []
    kwargs: Dict[str, Any] = {}


class TaskStatusResponse(BaseModel):
    """Réponse statut tâche"""
    task_id: str
    task_name: str
    status: str  # PENDING, STARTED, SUCCESS, FAILURE, RETRY, REVOKED
    result: Optional[Any] = None
    error: Optional[str] = None
    progress: Optional[int] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class TaskListResponse(BaseModel):
    """Liste de tâches"""
    total: int
    tasks: List[TaskStatusResponse]


# ============================================================================
# ML Tasks Routes
# ============================================================================

@router.post("/ml/pysr/train", response_model=Dict[str, Any])
async def trigger_pysr_training(
    lot_id: Optional[int] = None,
    genetique: Optional[str] = None,
    include_sqal_features: bool = False,
    premium_mode: str = "extended",
    require_sqal_premium: bool = True,
    site_codes: Optional[str] = None,
    min_duree_gavage: Optional[int] = None,
    max_duree_gavage: Optional[int] = None,
    seasons: Optional[str] = None,
    cluster_ids: Optional[str] = None,
):
    """
    Déclenche entraînement PySR (Symbolic Regression)

    Entraînement asynchrone qui peut prendre 5-30 minutes.
    """

    premium_mode_norm = (premium_mode or "").strip().lower()
    if premium_mode_norm == "strict":
        premium_grades = ["A+", "A"]
    elif premium_mode_norm in ("extended", ""):  # default
        premium_grades = ["A+", "A", "B"]
    elif premium_mode_norm in ("off", "none", "all"):
        premium_grades = None
        require_sqal_premium = False
    else:
        raise HTTPException(
            status_code=400,
            detail="premium_mode must be one of: strict, extended, off",
        )

    parsed_site_codes: Optional[List[str]] = None
    if site_codes:
        parsed_site_codes = [
            x.strip().upper() for x in site_codes.split(",") if x.strip()
        ]

    parsed_seasons: Optional[List[str]] = None
    if seasons:
        parsed_seasons = [
            x.strip().lower() for x in seasons.split(",") if x.strip()
        ]

    parsed_cluster_ids: Optional[List[int]] = None
    if cluster_ids:
        try:
            parsed_cluster_ids = [
                int(x.strip()) for x in cluster_ids.split(",") if x.strip()
            ]
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="cluster_ids must be a comma-separated list of integers",
            ) from exc

    if lot_id is None and genetique is None:
        task = ml_tasks.train_pysr_multi_async.delay(
            include_sqal_features=include_sqal_features,
            premium_grades=premium_grades,
            require_sqal_premium=require_sqal_premium,
            site_codes=parsed_site_codes,
            min_duree_gavage=min_duree_gavage,
            max_duree_gavage=max_duree_gavage,
            seasons=parsed_seasons,
            cluster_ids=parsed_cluster_ids,
        )
        return {
            "status": "submitted",
            "task_id": task.id,
            "mode": "multi_genetique",
            "lot_id": lot_id,
            "genetique": genetique,
            "include_sqal_features": include_sqal_features,
            "premium_mode": premium_mode_norm,
            "premium_grades": premium_grades,
            "require_sqal_premium": require_sqal_premium,
            "site_codes": parsed_site_codes,
            "min_duree_gavage": min_duree_gavage,
            "max_duree_gavage": max_duree_gavage,
            "seasons": parsed_seasons,
            "cluster_ids": parsed_cluster_ids,
            "message": "PySR multi training started",
        }

    task = ml_tasks.train_pysr_async.delay(
        lot_id=lot_id,
        genetique=genetique,
        include_sqal_features=include_sqal_features,
        premium_grades=premium_grades,
        require_sqal_premium=require_sqal_premium,
        site_codes=parsed_site_codes,
        min_duree_gavage=min_duree_gavage,
        max_duree_gavage=max_duree_gavage,
        seasons=parsed_seasons,
        cluster_ids=parsed_cluster_ids,
    )
    return {
        "status": "submitted",
        "task_id": task.id,
        "lot_id": lot_id,
        "genetique": genetique,
        "include_sqal_features": include_sqal_features,
        "premium_mode": premium_mode_norm,
        "premium_grades": premium_grades,
        "require_sqal_premium": require_sqal_premium,
        "site_codes": parsed_site_codes,
        "min_duree_gavage": min_duree_gavage,
        "max_duree_gavage": max_duree_gavage,
        "seasons": parsed_seasons,
        "cluster_ids": parsed_cluster_ids,
        "message": "PySR training started"
    }


@router.post("/ml/feeding-curve/optimize", response_model=Dict[str, str])
async def trigger_feeding_curve_optimization(lot_id: int):
    """
    Déclenche optimisation courbe gavage basée sur feedbacks consommateurs

    Utilise Random Forest pour corréler paramètres gavage ↔ satisfaction.
    """
    task = ml_tasks.optimize_feeding_curve_async.delay(lot_id)
    return {
        "status": "submitted",
        "task_id": task.id,
        "lot_id": lot_id,
        "message": "Feeding curve optimization started"
    }


@router.post("/ml/prophet/train", response_model=Dict[str, str])
async def trigger_prophet_training(
    site_code: str = Query(..., regex="^(LL|LS|MT)$"),
    horizon_days: int = Query(30, ge=7, le=90)
):
    """
    Déclenche entraînement Prophet pour prévisions production

    Génère prévisions à 7/30/90 jours pour un site.
    """
    task = ml_tasks.train_prophet_async.delay(site_code, horizon_days)
    return {
        "status": "submitted",
        "task_id": task.id,
        "site_code": site_code,
        "horizon_days": horizon_days,
        "message": "Prophet training started"
    }


@router.post("/ml/clustering/gaveurs", response_model=Dict[str, str])
async def trigger_gaveur_clustering():
    """
    Déclenche clustering K-Means des gaveurs

    Segmente gaveurs en 5 clusters de performance.
    """
    task = ml_tasks.cluster_gaveurs_async.delay()
    return {
        "status": "submitted",
        "task_id": task.id,
        "message": "Gaveur clustering started"
    }


@router.post("/ml/clustering/lots", response_model=Dict[str, Any])
async def trigger_lot_pred_clustering(
    n_clusters: int = Query(3, ge=2, le=20),
    random_state: int = Query(42),
    n_init: int = Query(10, ge=1, le=100),
    min_lots: int = Query(20, ge=2),
    site_codes: Optional[str] = None,
    genetique: Optional[str] = None,
    seasons: Optional[str] = None,
    min_duree_gavage: Optional[int] = None,
    max_duree_gavage: Optional[int] = None,
    features: Optional[str] = None,
    modele_version: str = Query("lot_pred_kmeans_v1"),
):
    """Déclenche clustering prédictif des lots (lot_pred) avec paramètres."""

    parsed_site_codes: Optional[List[str]] = None
    if site_codes:
        parsed_site_codes = [x.strip().upper() for x in site_codes.split(",") if x.strip()]

    parsed_seasons: Optional[List[str]] = None
    if seasons:
        parsed_seasons = [x.strip().lower() for x in seasons.split(",") if x.strip()]

    parsed_features: Optional[List[str]] = None
    if features:
        parsed_features = [x.strip() for x in features.split(",") if x.strip()]

    task = ml_tasks.cluster_lots_pred_async.delay(
        n_clusters=n_clusters,
        random_state=random_state,
        n_init=n_init,
        min_lots=min_lots,
        site_codes=parsed_site_codes,
        genetique=(genetique.strip().lower() if genetique else None),
        seasons=parsed_seasons,
        min_duree_gavage=min_duree_gavage,
        max_duree_gavage=max_duree_gavage,
        features=parsed_features,
        modele_version=modele_version,
    )

    return {
        "status": "submitted",
        "task_id": task.id,
        "message": "lot_pred clustering started",
        "n_clusters": n_clusters,
        "random_state": random_state,
        "n_init": n_init,
        "min_lots": min_lots,
        "site_codes": parsed_site_codes,
        "genetique": genetique,
        "seasons": parsed_seasons,
        "min_duree_gavage": min_duree_gavage,
        "max_duree_gavage": max_duree_gavage,
        "features": parsed_features,
        "modele_version": modele_version,
    }


@router.post("/ml/anomalies/detect", response_model=Dict[str, str])
async def trigger_anomaly_detection(site_code: Optional[str] = None):
    """
    Déclenche détection d'anomalies Isolation Forest

    Détecte lots avec performances anormales.
    """
    task = ml_tasks.detect_anomalies_async.delay(site_code)
    return {
        "status": "submitted",
        "task_id": task.id,
        "site_code": site_code or "ALL",
        "message": "Anomaly detection started"
    }


@router.post("/ml/abattage/optimize", response_model=Dict[str, str])
async def trigger_abattage_optimization(date_debut: str, date_fin: str):
    """
    Déclenche optimisation planning abattage (Algorithme Hongrois)

    Optimise attribution lots → abattoirs pour minimiser coûts/délais.
    """
    task = ml_tasks.optimize_abattage_planning_async.delay(date_debut, date_fin)
    return {
        "status": "submitted",
        "task_id": task.id,
        "period": f"{date_debut} → {date_fin}",
        "message": "Abattage planning optimization started"
    }


@router.post("/ml/retrain-all", response_model=Dict[str, str])
async def trigger_full_ml_retraining():
    """
    Déclenche re-entraînement de tous les modèles ML

    Workflow complet: clustering, anomalies, prévisions Prophet (tous sites).
    """
    task = ml_tasks.retrain_all_ml_models_async.delay()
    return {
        "status": "submitted",
        "task_id": task.id,
        "message": "Full ML retraining started (may take 30-60 min)"
    }


# ============================================================================
# Export Tasks Routes
# ============================================================================

@router.post("/export/pdf/lot", response_model=Dict[str, str])
async def trigger_lot_pdf_export(
    lot_id: int,
    report_type: str = Query("complete", regex="^(complete|summary|quality)$")
):
    """
    Déclenche génération rapport PDF pour un lot

    Types: complete (tout), summary (résumé), quality (qualité uniquement)
    """
    task = export_tasks.generate_lot_pdf_report.delay(lot_id, report_type)
    return {
        "status": "submitted",
        "task_id": task.id,
        "lot_id": lot_id,
        "report_type": report_type,
        "message": "PDF generation started"
    }


@router.post("/export/pdf/site", response_model=Dict[str, str])
async def trigger_site_pdf_export(
    site_code: str = Query(..., regex="^(LL|LS|MT)$"),
    date_debut: str = Query(...),
    date_fin: str = Query(...)
):
    """
    Déclenche génération rapport PDF pour un site
    """
    task = export_tasks.generate_site_pdf_report.delay(site_code, date_debut, date_fin)
    return {
        "status": "submitted",
        "task_id": task.id,
        "site_code": site_code,
        "period": f"{date_debut} → {date_fin}",
        "message": "Site PDF generation started"
    }


@router.post("/export/csv/gavage", response_model=Dict[str, str])
async def trigger_gavage_csv_export(
    lot_id: Optional[int] = None,
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None
):
    """
    Déclenche export CSV données gavage
    """
    task = export_tasks.export_gavage_data_csv.delay(lot_id, date_debut, date_fin)
    return {
        "status": "submitted",
        "task_id": task.id,
        "message": "CSV export started"
    }


@router.post("/export/csv/sqal", response_model=Dict[str, str])
async def trigger_sqal_csv_export(
    lot_id: Optional[int] = None,
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None
):
    """
    Déclenche export CSV données SQAL
    """
    task = export_tasks.export_sqal_data_csv.delay(lot_id, date_debut, date_fin)
    return {
        "status": "submitted",
        "task_id": task.id,
        "message": "SQAL CSV export started"
    }


@router.post("/export/blockchain/certificate", response_model=Dict[str, str])
async def trigger_blockchain_certificate(
    lot_id: int,
    certificate_type: str = Query("tracabilite", regex="^(tracabilite|qualite|complete)$")
):
    """
    Déclenche génération certificat blockchain
    """
    task = export_tasks.generate_blockchain_certificate.delay(lot_id, certificate_type)
    return {
        "status": "submitted",
        "task_id": task.id,
        "lot_id": lot_id,
        "certificate_type": certificate_type,
        "message": "Blockchain certificate generation started"
    }


# ============================================================================
# Notification Tasks Routes
# ============================================================================

@router.post("/notifications/sms", response_model=Dict[str, str])
async def trigger_sms_alert(phone: str, message: str, priority: str = "normal"):
    """
    Envoie SMS d'alerte

    Priority: low, normal, high, critical
    """
    task = notification_tasks.send_sms_alert.delay(phone, message, priority)
    return {
        "status": "submitted",
        "task_id": task.id,
        "phone": phone,
        "message": "SMS sending started"
    }


@router.post("/notifications/email", response_model=Dict[str, str])
async def trigger_email_notification(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None
):
    """
    Envoie email de notification
    """
    task = notification_tasks.send_email_notification.delay(
        to_email, subject, body_html, body_text
    )
    return {
        "status": "submitted",
        "task_id": task.id,
        "to_email": to_email,
        "message": "Email sending started"
    }


# ============================================================================
# Task Management Routes
# ============================================================================

@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    Récupère statut d'une tâche

    Statuts possibles:
    - PENDING: Tâche en attente
    - STARTED: Tâche en cours
    - SUCCESS: Tâche terminée avec succès
    - FAILURE: Tâche échouée
    - RETRY: Tâche en retry après erreur
    - REVOKED: Tâche annulée
    """
    task = AsyncResult(task_id, app=celery_app)

    response = {
        "task_id": task_id,
        "task_name": task.name or "unknown",
        "status": task.status,
        "result": None,
        "error": None,
        "progress": None,
        "started_at": None,
        "completed_at": None
    }

    if task.status == "SUCCESS":
        response["result"] = task.result
        response["completed_at"] = datetime.utcnow().isoformat()
    elif task.status == "FAILURE":
        response["error"] = str(task.info)
    elif task.status == "STARTED":
        response["started_at"] = datetime.utcnow().isoformat()
        # Progress si disponible (via task.update_state)
        if hasattr(task.info, 'get'):
            response["progress"] = task.info.get('progress', None)

    return response


@router.delete("/cancel/{task_id}", response_model=Dict[str, str])
async def cancel_task(task_id: str):
    """
    Annule une tâche en cours

    Note: Seules les tâches PENDING ou STARTED peuvent être annulées.
    """
    task = AsyncResult(task_id, app=celery_app)

    if task.status in ["SUCCESS", "FAILURE"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel task with status {task.status}"
        )

    task.revoke(terminate=True)

    return {
        "status": "cancelled",
        "task_id": task_id,
        "message": "Task cancellation requested"
    }


@router.get("/list/active", response_model=TaskListResponse)
async def list_active_tasks(limit: int = Query(50, ge=1, le=200)):
    """
    Liste toutes les tâches actives (PENDING, STARTED)

    Utilise Celery inspect pour récupérer tâches en cours.
    """
    inspector = celery_app.control.inspect()

    active = inspector.active() or {}
    scheduled = inspector.scheduled() or {}
    reserved = inspector.reserved() or {}

    all_tasks = []

    # Tasks actives
    for worker, tasks in active.items():
        for task_info in tasks:
            all_tasks.append({
                "task_id": task_info.get('id'),
                "task_name": task_info.get('name'),
                "status": "STARTED",
                "worker": worker,
                "started_at": task_info.get('time_start')
            })

    # Tasks planifiées
    for worker, tasks in scheduled.items():
        for task_info in tasks:
            all_tasks.append({
                "task_id": task_info.get('id'),
                "task_name": task_info.get('name'),
                "status": "PENDING",
                "worker": worker,
                "eta": task_info.get('eta')
            })

    # Limiter résultats
    all_tasks = all_tasks[:limit]

    return {
        "total": len(all_tasks),
        "tasks": all_tasks
    }


@router.get("/list/recent", response_model=TaskListResponse)
async def list_recent_tasks(limit: int = Query(20, ge=1, le=100)):
    """
    Liste tâches récentes (succès + échecs)

    Note: Requiert Celery result backend (Redis) configuré.
    """
    # Cette route nécessite un backend de résultats persistant
    # Pour une implémentation complète, il faudrait stocker les tâches en DB
    return {
        "total": 0,
        "tasks": [],
        "message": "Recent tasks tracking requires database implementation"
    }


@router.get("/stats", response_model=Dict[str, Any])
async def get_tasks_stats():
    """
    Récupère statistiques Celery

    Nombre de workers, queues, tâches en cours, etc.
    """
    inspector = celery_app.control.inspect()

    stats = inspector.stats() or {}
    active_tasks = inspector.active() or {}
    scheduled_tasks = inspector.scheduled() or {}
    reserved_tasks = inspector.reserved() or {}

    total_active = sum(len(tasks) for tasks in active_tasks.values())
    total_scheduled = sum(len(tasks) for tasks in scheduled_tasks.values())
    total_reserved = sum(len(tasks) for tasks in reserved_tasks.values())

    return {
        "workers": list(stats.keys()),
        "nb_workers": len(stats),
        "tasks_active": total_active,
        "tasks_scheduled": total_scheduled,
        "tasks_reserved": total_reserved,
        "total_pending": total_active + total_scheduled + total_reserved,
        "worker_stats": stats
    }


@router.post("/maintenance/refresh-aggregates", response_model=Dict[str, str])
async def trigger_refresh_aggregates():
    """
    Force refresh des continuous aggregates TimescaleDB
    """
    task = scheduled_tasks.refresh_continuous_aggregates.delay()
    return {
        "status": "submitted",
        "task_id": task.id,
        "message": "Continuous aggregates refresh started"
    }


@router.post("/maintenance/backup-database", response_model=Dict[str, str])
async def trigger_database_backup():
    """
    Force backup de la base de données
    """
    task = scheduled_tasks.backup_database_task.delay()
    return {
        "status": "submitted",
        "task_id": task.id,
        "message": "Database backup started"
    }


@router.post("/maintenance/calculate-kpis", response_model=Dict[str, str])
async def trigger_weekly_kpis():
    """
    Force calcul des KPIs hebdomadaires
    """
    task = scheduled_tasks.calculate_weekly_kpis.delay()
    return {
        "status": "submitted",
        "task_id": task.id,
        "message": "Weekly KPIs calculation started"
    }


@router.post("/qr-code/generate", response_model=Dict[str, str])
async def trigger_qr_code_generation(
    lot_id: int = Query(..., description="ID du lot"),
    sample_id: str = Query(..., description="ID échantillon SQAL"),
    site_code: str = Query("LL", regex="^(LL|LS|MT)$", description="Code site")
):
    """
    Génère QR code pour un échantillon SQAL

    Déclenche génération QR code après contrôle qualité.
    Insère produit dans consumer_products avec traçabilité complète.

    Args:
        lot_id: ID du lot
        sample_id: ID échantillon SQAL
        site_code: Code site (LL, LS, MT)

    Returns:
        Task ID Celery
    """
    task = export_tasks.generate_qr_code_async.delay(lot_id, sample_id, site_code)
    return {
        "status": "submitted",
        "task_id": task.id,
        "lot_id": lot_id,
        "sample_id": sample_id,
        "message": "QR code generation started"
    }
