"""
Router API SQAL - Endpoints REST pour contrôle qualité
Préfixe: /api/sqal/*
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from app.models.sqal import (
    SensorDataMessage,
    SensorDataResponse,
    DeviceListResponse,
    StatsResponse,
    HealthCheckResponse,
    AlertDB,
    DeviceDB,
    SensorSampleDB
)
from app.services.sqal_service import sqal_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sqal", tags=["SQAL Quality Control"])


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Vérification santé système SQAL

    Returns:
        - status: ok/degraded/error
        - timestamp: Date vérification
        - active_devices: Nombre devices actifs
        - last_sample_age_seconds: Âge dernier échantillon
        - database_connected: Connexion DB ok
    """
    try:
        # Vérifie connexion DB
        devices = await sqal_service.get_devices()
        active_devices = len([d for d in devices if d.status == "active"])

        # Récupère dernier échantillon
        latest = await sqal_service.get_latest_sample()
        last_sample_age = None
        if latest and "time" in latest:
            last_sample_age = (datetime.utcnow() - latest["time"]).total_seconds()

        # Détermine statut
        status = "ok"
        if last_sample_age and last_sample_age > 300:  # 5 minutes
            status = "degraded"
        if not latest or last_sample_age and last_sample_age > 3600:  # 1 heure
            status = "error"

        return HealthCheckResponse(
            status=status,
            timestamp=datetime.utcnow(),
            active_devices=active_devices,
            last_sample_age_seconds=last_sample_age,
            database_connected=True
        )

    except Exception as e:
        logger.error(f"Erreur health check: {e}")
        return HealthCheckResponse(
            status="error",
            timestamp=datetime.utcnow(),
            active_devices=0,
            last_sample_age_seconds=None,
            database_connected=False
        )


# ============================================================================
# DEVICES
# ============================================================================

@router.get("/devices", response_model=DeviceListResponse)
async def get_devices(site_code: Optional[str] = Query(None, description="Filtrer par site (LL/LS/MT)")):
    """
    Liste des dispositifs ESP32

    Args:
        site_code: Filtrer par site (optionnel)

    Returns:
        Liste de devices avec métadonnées
    """
    try:
        devices = await sqal_service.get_devices(site_code=site_code)
        return DeviceListResponse(devices=devices, total=len(devices))

    except Exception as e:
        logger.error(f"Erreur récupération devices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/devices/{device_id}")
async def get_device_detail(device_id: str):
    """
    Détail d'un dispositif avec dernières stats

    Args:
        device_id: ID du device

    Returns:
        Device + statistiques 24h
    """
    try:
        devices = await sqal_service.get_devices()
        device = next((d for d in devices if d.device_id == device_id), None)

        if not device:
            raise HTTPException(status_code=404, detail=f"Device {device_id} introuvable")

        # Stats 24h
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=1)

        hourly_stats = await sqal_service.get_hourly_stats(
            start_time=start_time,
            end_time=end_time,
            device_id=device_id
        )

        latest_sample = await sqal_service.get_latest_sample(device_id=device_id)

        return {
            "device": device,
            "latest_sample": latest_sample,
            "hourly_stats": hourly_stats,
            "stats_24h": {
                "total_samples": sum(s["sample_count"] for s in hourly_stats),
                "avg_quality_score": (
                    sum(s["avg_quality_score"] * s["sample_count"] for s in hourly_stats) /
                    sum(s["sample_count"] for s in hourly_stats)
                ) if hourly_stats and sum(s["sample_count"] for s in hourly_stats) > 0 else 0
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération détail device: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SAMPLES
# ============================================================================

@router.get("/samples/latest")
async def get_latest_sample(device_id: Optional[str] = Query(None)):
    """
    Dernier échantillon capteur

    Args:
        device_id: Filtrer par device (optionnel)

    Returns:
        Échantillon le plus récent
    """
    try:
        sample = await sqal_service.get_latest_sample(device_id=device_id)

        if not sample:
            raise HTTPException(status_code=404, detail="Aucun échantillon trouvé")

        return sample

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération dernier échantillon: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/samples")
async def get_samples(
    start_time: Optional[datetime] = Query(None, description="Début période (ISO 8601)"),
    end_time: Optional[datetime] = Query(None, description="Fin période (ISO 8601)"),
    device_id: Optional[str] = Query(None, description="Filtrer par device"),
    limit: int = Query(100, ge=1, le=1000, description="Nombre max résultats")
):
    """
    Échantillons sur une période

    Args:
        start_time: Début (défaut: 24h avant end_time)
        end_time: Fin (défaut: maintenant)
        device_id: Filtrer par device (optionnel)
        limit: Max résultats (1-1000)

    Returns:
        Liste d'échantillons
    """
    try:
        if not end_time:
            end_time = datetime.utcnow()
        if not start_time:
            start_time = end_time - timedelta(days=1)

        samples = await sqal_service.get_samples_period(
            start_time=start_time,
            end_time=end_time,
            device_id=device_id,
            limit=limit
        )

        return {
            "samples": samples,
            "count": len(samples),
            "period": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            }
        }

    except Exception as e:
        logger.error(f"Erreur récupération échantillons: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STATISTICS
# ============================================================================

@router.get("/stats/hourly")
async def get_hourly_stats(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    device_id: Optional[str] = Query(None)
):
    """
    Statistiques horaires (continuous aggregate)

    Args:
        start_time: Début (défaut: 7j avant end_time)
        end_time: Fin (défaut: maintenant)
        device_id: Filtrer par device (optionnel)

    Returns:
        Statistiques agrégées par heure
    """
    try:
        if not end_time:
            end_time = datetime.utcnow()
        if not start_time:
            start_time = end_time - timedelta(days=7)

        stats = await sqal_service.get_hourly_stats(
            start_time=start_time,
            end_time=end_time,
            device_id=device_id
        )

        return {
            "stats": stats,
            "count": len(stats),
            "period": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            }
        }

    except Exception as e:
        logger.error(f"Erreur récupération stats horaires: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/sites", response_model=StatsResponse)
async def get_site_stats(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    site_code: Optional[str] = Query(None, description="LL/LS/MT")
):
    """
    Statistiques par site (continuous aggregate)

    Args:
        start_time: Début (défaut: 30j avant end_time)
        end_time: Fin (défaut: maintenant)
        site_code: Filtrer par site (optionnel)

    Returns:
        Statistiques agrégées par site et jour
    """
    try:
        if not end_time:
            end_time = datetime.utcnow()
        if not start_time:
            start_time = end_time - timedelta(days=30)

        stats = await sqal_service.get_site_stats(
            start_time=start_time,
            end_time=end_time,
            site_code=site_code
        )

        # Calcule agrégats globaux
        total_samples = sum(s["total_samples"] for s in stats)
        avg_quality_score = (
            sum(s["avg_quality_score"] * s["total_samples"] for s in stats) / total_samples
        ) if total_samples > 0 else 0
        avg_compliance_rate = (
            sum(s["compliance_rate_pct"] * s["total_samples"] for s in stats) / total_samples
        ) if total_samples > 0 else 0

        # Distribution grades
        grade_distribution = {
            "A+": sum(s["count_a_plus"] for s in stats),
            "A": sum(s["count_a"] for s in stats),
            "B": sum(s["count_b"] for s in stats),
            "C": sum(s["count_c"] for s in stats),
            "REJECT": sum(s["count_reject"] for s in stats)
        }

        # Top devices (simplifié ici, requête dédiée possible)
        top_devices = []

        return StatsResponse(
            period_start=start_time,
            period_end=end_time,
            total_samples=total_samples,
            avg_quality_score=avg_quality_score,
            compliance_rate_pct=avg_compliance_rate,
            grade_distribution=grade_distribution,
            top_devices=top_devices
        )

    except Exception as e:
        logger.error(f"Erreur récupération stats sites: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/grade-distribution")
async def get_grade_distribution(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    site_code: Optional[str] = Query(None)
):
    """
    Distribution des grades qualité

    Args:
        start_time: Début (défaut: 7j avant end_time)
        end_time: Fin (défaut: maintenant)
        site_code: Filtrer par site (optionnel)

    Returns:
        Compteurs par grade (A+, A, B, C, REJECT)
    """
    try:
        if not end_time:
            end_time = datetime.utcnow()
        if not start_time:
            start_time = end_time - timedelta(days=7)

        distribution = await sqal_service.get_grade_distribution(
            start_time=start_time,
            end_time=end_time,
            site_code=site_code
        )

        total = sum(distribution.values())

        return {
            "distribution": distribution,
            "total": total,
            "percentages": {
                grade: (count / total * 100) if total > 0 else 0
                for grade, count in distribution.items()
            },
            "period": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            }
        }

    except Exception as e:
        logger.error(f"Erreur récupération distribution grades: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ALERTS
# ============================================================================

@router.get("/alerts", response_model=List[AlertDB])
async def get_alerts(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    severity: Optional[str] = Query(None, description="info/warning/critical"),
    is_acknowledged: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500)
):
    """
    Liste des alertes qualité

    Args:
        start_time: Début (défaut: 24h avant end_time)
        end_time: Fin (défaut: maintenant)
        severity: Filtrer par sévérité (optionnel)
        is_acknowledged: Filtrer par statut acquittement (optionnel)
        limit: Max résultats (1-500)

    Returns:
        Liste d'alertes
    """
    try:
        alerts = await sqal_service.get_alerts(
            start_time=start_time,
            end_time=end_time,
            severity=severity,
            is_acknowledged=is_acknowledged,
            limit=limit
        )

        return alerts

    except Exception as e:
        logger.error(f"Erreur récupération alertes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    acknowledged_by: str = Query(..., description="Nom utilisateur")
):
    """
    Acquitter une alerte

    Args:
        alert_id: ID de l'alerte
        acknowledged_by: Nom utilisateur

    Returns:
        Confirmation acquittement
    """
    try:
        success = await sqal_service.acknowledge_alert(alert_id, acknowledged_by)

        if not success:
            raise HTTPException(status_code=500, detail="Échec acquittement")

        return {
            "success": True,
            "alert_id": alert_id,
            "acknowledged_by": acknowledged_by,
            "acknowledged_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur acquittement alerte: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DASHBOARD
# ============================================================================

@router.get("/dashboard/overview")
async def get_dashboard_overview():
    """
    Vue d'ensemble dashboard SQAL (KPIs globaux)

    Returns:
        - Stats 24h (samples, score moyen, compliance)
        - Distribution grades
        - Alertes actives
        - Top/Bottom devices
    """
    try:
        end_time = datetime.utcnow()
        start_time_24h = end_time - timedelta(days=1)
        start_time_7d = end_time - timedelta(days=7)

        # Stats 24h
        samples_24h = await sqal_service.get_samples_period(
            start_time=start_time_24h,
            end_time=end_time,
            limit=10000
        )

        total_24h = len(samples_24h)
        avg_score_24h = (
            sum(s["fusion_final_score"] for s in samples_24h) / total_24h
        ) if total_24h > 0 else 0
        compliance_24h = (
            sum(1 for s in samples_24h if s["fusion_is_compliant"]) / total_24h * 100
        ) if total_24h > 0 else 0

        # Distribution grades 7j
        grade_dist = await sqal_service.get_grade_distribution(
            start_time=start_time_7d,
            end_time=end_time
        )

        # Alertes non acquittées
        alerts = await sqal_service.get_alerts(
            start_time=start_time_24h,
            end_time=end_time,
            is_acknowledged=False,
            limit=100
        )

        # Devices
        devices = await sqal_service.get_devices()

        return {
            "stats_24h": {
                "total_samples": total_24h,
                "avg_quality_score": round(avg_score_24h, 3),
                "compliance_rate_pct": round(compliance_24h, 1)
            },
            "grade_distribution_7d": grade_dist,
            "active_alerts": len(alerts),
            "critical_alerts": len([a for a in alerts if a.severity == "critical"]),
            "total_devices": len(devices),
            "active_devices": len([d for d in devices if d.status == "active"]),
            "timestamp": end_time.isoformat()
        }

    except Exception as e:
        logger.error(f"Erreur dashboard overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# INTEGRATION EURALIS (Corrélation ITM ↔ Qualité)
# ============================================================================

@router.get("/integration/lot/{lot_id}")
async def get_quality_for_lot(lot_id: int):
    """
    Récupère les données qualité pour un lot Euralis

    Permet de corréler ITM (Euralis) avec score qualité SQAL

    Args:
        lot_id: ID du lot gavage (lots_gavage.id)

    Returns:
        Statistiques qualité pour ce lot
    """
    try:
        # Récupère tous les échantillons de ce lot
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=90)  # 3 mois max

        # Requête directe avec filtre lot_id
        # (à implémenter dans sqal_service si besoin)
        # Pour l'instant, solution simple via échantillons récents

        samples_raw = await sqal_service.get_samples_period(
            start_time=start_time,
            end_time=end_time,
            limit=10000
        )

        # Filtre par lot_id
        samples = [s for s in samples_raw if s.get("lot_id") == lot_id]

        if not samples:
            raise HTTPException(status_code=404, detail=f"Aucune donnée qualité pour lot {lot_id}")

        # Calcule statistiques
        total = len(samples)
        avg_score = sum(s["fusion_final_score"] for s in samples) / total
        compliance_rate = sum(1 for s in samples if s["fusion_is_compliant"]) / total * 100

        grades = {}
        for sample in samples:
            grade = sample["fusion_final_grade"]
            grades[grade] = grades.get(grade, 0) + 1

        return {
            "lot_id": lot_id,
            "total_samples": total,
            "avg_quality_score": round(avg_score, 3),
            "compliance_rate_pct": round(compliance_rate, 1),
            "grade_distribution": grades,
            "samples": samples[:50]  # Limite 50 pour réponse
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération qualité lot: {e}")
        raise HTTPException(status_code=500, detail=str(e))
