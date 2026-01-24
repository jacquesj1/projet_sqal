"""
Tâches ML/Analytics Asynchrones

Entraînements de modèles ML qui peuvent prendre plusieurs minutes/heures:
- PySR (Symbolic Regression) - 5-30 minutes
- Random Forest (Feedback Optimizer) - 2-10 minutes
- Prophet (Forecasting) - 1-5 minutes
- K-Means (Clustering) - 1-3 minutes
- Isolation Forest (Anomaly Detection) - 30s-2min
"""

from app.tasks.celery_app import celery_app
import logging
from typing import Dict, Any
import asyncpg
import os

logger = logging.getLogger(__name__)

# Configuration Database
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db')


@celery_app.task(bind=True, max_retries=3, time_limit=1800)
def train_pysr_async(self, lot_id: int) -> Dict[str, Any]:
    """
    Entraînement PySR (Symbolic Regression) pour découvrir formules optimales

    Peut prendre 5-30 minutes selon complexité données.

    Args:
        lot_id: ID du lot à analyser

    Returns:
        dict: {
            "status": "success",
            "lot_id": int,
            "formula": str,
            "r2_score": float,
            "variables": list
        }
    """
    try:
        logger.info(f"🔬 Starting PySR training for lot {lot_id}")

        # Import lazy (évite imports inutiles au démarrage)
        from app.ml.symbolic_regression import train_pysr_model

        # Entraînement
        result = train_pysr_model(lot_id)

        logger.info(f"✅ PySR training completed for lot {lot_id} - R²: {result.get('r2_score', 0):.3f}")

        return {
            "status": "success",
            "lot_id": lot_id,
            "formula": result.get("formula", ""),
            "r2_score": result.get("r2_score", 0.0),
            "variables": result.get("variables", []),
            "complexity": result.get("complexity", 0)
        }

    except Exception as exc:
        logger.error(f"❌ PySR training failed for lot {lot_id}: {exc}", exc_info=True)

        # Retry avec backoff exponentiel
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@celery_app.task(bind=True, max_retries=2, time_limit=600)
def optimize_feeding_curve_async(self, lot_id: int) -> Dict[str, Any]:
    """
    Optimisation courbe gavage basée sur feedbacks consommateurs (Random Forest)

    Analyse corrélations: paramètres gavage ↔ satisfaction consommateurs
    Génère courbe optimisée pour maximiser qualité finale.

    Args:
        lot_id: ID du lot à optimiser

    Returns:
        dict: {
            "status": "success",
            "lot_id": int,
            "optimized_curve": dict,
            "expected_improvement": float,
            "confidence": float
        }
    """
    try:
        logger.info(f"🎯 Optimizing feeding curve for lot {lot_id}")

        from app.ml.feedback_optimizer import optimize_feeding_curve

        result = optimize_feeding_curve(lot_id)

        logger.info(f"✅ Feeding curve optimization completed - Improvement: {result.get('expected_improvement', 0):.1f}%")

        return {
            "status": "success",
            "lot_id": lot_id,
            "optimized_curve": result.get("optimized_curve", {}),
            "expected_improvement": result.get("expected_improvement", 0.0),
            "confidence": result.get("confidence", 0.0),
            "key_factors": result.get("key_factors", [])
        }

    except Exception as exc:
        logger.error(f"❌ Feeding curve optimization failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=180)


@celery_app.task(bind=True, max_retries=2, time_limit=300)
def train_prophet_async(self, site_code: str, horizon_days: int = 30) -> Dict[str, Any]:
    """
    Entraînement Prophet pour prévisions production

    Génère prévisions à 7/30/90 jours pour un site Euralis.

    Args:
        site_code: Code site ('LL', 'LS', 'MT')
        horizon_days: Horizon prévision (7, 30, 90)

    Returns:
        dict: Prévisions avec intervalles de confiance
    """
    try:
        logger.info(f"📈 Training Prophet model for site {site_code} - Horizon: {horizon_days}d")

        from app.ml.euralis.production_forecasting import train_prophet_model

        result = train_prophet_model(site_code, horizon_days)

        logger.info(f"✅ Prophet training completed for site {site_code}")

        return {
            "status": "success",
            "site_code": site_code,
            "horizon_days": horizon_days,
            "forecast": result.get("forecast", []),
            "confidence_lower": result.get("confidence_lower", []),
            "confidence_upper": result.get("confidence_upper", []),
            "trend": result.get("trend", "stable")
        }

    except Exception as exc:
        logger.error(f"❌ Prophet training failed for site {site_code}: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=120)


@celery_app.task(time_limit=300)
def cluster_gaveurs_async() -> Dict[str, Any]:
    """
    Clustering K-Means des gaveurs (5 segments)

    Segmente gaveurs en clusters de performance:
    - Cluster A: Excellence
    - Cluster B: Haute performance
    - Cluster C: Performance moyenne
    - Cluster D: En difficulté
    - Cluster E: Critique

    Returns:
        dict: Clusters avec statistiques par cluster
    """
    try:
        logger.info("📊 Starting K-Means clustering of gaveurs")

        from app.ml.euralis.gaveur_clustering import cluster_gaveurs

        result = cluster_gaveurs()

        logger.info(f"✅ Clustering completed - {result.get('nb_clusters', 0)} clusters")

        return {
            "status": "success",
            "nb_clusters": result.get("nb_clusters", 5),
            "clusters": result.get("clusters", {}),
            "silhouette_score": result.get("silhouette_score", 0.0)
        }

    except Exception as exc:
        logger.error(f"❌ Clustering failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=180)
def detect_anomalies_async(site_code: str = None) -> Dict[str, Any]:
    """
    Détection anomalies Isolation Forest

    Détecte lots avec performances anormales (ITM, mortalité, etc.)

    Args:
        site_code: Code site optionnel (None = tous sites)

    Returns:
        dict: Liste anomalies détectées
    """
    try:
        logger.info(f"🔍 Detecting anomalies for site {site_code or 'ALL'}")

        from app.ml.euralis.anomaly_detection import detect_anomalies

        result = detect_anomalies(site_code)

        nb_anomalies = len(result.get("anomalies", []))
        logger.info(f"✅ Anomaly detection completed - {nb_anomalies} anomalies found")

        return {
            "status": "success",
            "site_code": site_code,
            "nb_anomalies": nb_anomalies,
            "anomalies": result.get("anomalies", []),
            "threshold": result.get("threshold", 0.0)
        }

    except Exception as exc:
        logger.error(f"❌ Anomaly detection failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=180)
def detect_anomalies_periodic() -> Dict[str, Any]:
    """
    Détection anomalies périodique (tous les sites)

    Appelée automatiquement toutes les 6h par Celery Beat.
    Envoie alertes si anomalies critiques détectées.

    Returns:
        dict: Résumé anomalies par site
    """
    try:
        logger.info("🔍 Periodic anomaly detection starting")

        sites = ['LL', 'LS', 'MT']
        results = {}
        critical_count = 0

        for site in sites:
            result = detect_anomalies_async(site)
            results[site] = result

            # Compter anomalies critiques
            critical = [a for a in result.get("anomalies", []) if a.get("severity") == "critical"]
            critical_count += len(critical)

            # Envoyer alertes si anomalies critiques
            if critical:
                from app.tasks.notification_tasks import send_anomaly_alert
                send_anomaly_alert.delay(site, critical)

        logger.info(f"✅ Periodic anomaly detection completed - {critical_count} critical anomalies")

        return {
            "status": "success",
            "total_critical": critical_count,
            "results_by_site": results
        }

    except Exception as exc:
        logger.error(f"❌ Periodic anomaly detection failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=600)
def optimize_abattage_planning_async(date_debut: str, date_fin: str) -> Dict[str, Any]:
    """
    Optimisation planning abattage (Algorithme Hongrois)

    Optimise attribution lots → abattoirs pour minimiser coûts/délais.

    Args:
        date_debut: Date début période (YYYY-MM-DD)
        date_fin: Date fin période (YYYY-MM-DD)

    Returns:
        dict: Planning optimisé
    """
    try:
        logger.info(f"🗓️ Optimizing abattage planning: {date_debut} → {date_fin}")

        from app.ml.euralis.abattage_optimization import optimize_planning

        result = optimize_planning(date_debut, date_fin)

        logger.info(f"✅ Planning optimization completed - {result.get('nb_lots', 0)} lots assigned")

        return {
            "status": "success",
            "nb_lots": result.get("nb_lots", 0),
            "planning": result.get("planning", []),
            "total_cost": result.get("total_cost", 0.0),
            "optimization_ratio": result.get("optimization_ratio", 0.0)
        }

    except Exception as exc:
        logger.error(f"❌ Planning optimization failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=120)
def retrain_all_ml_models_async() -> Dict[str, Any]:
    """
    Re-entraînement de tous les modèles ML

    Workflow complet:
    1. K-Means clustering
    2. Isolation Forest anomalies
    3. Prophet prévisions (3 sites × 3 horizons)

    Utilisé pour refresh mensuel des modèles.

    Returns:
        dict: Résumé re-entraînements
    """
    try:
        logger.info("🔄 Starting full ML models retraining")

        results = {}

        # 1. Clustering
        results['clustering'] = cluster_gaveurs_async()

        # 2. Anomaly detection
        results['anomalies_LL'] = detect_anomalies_async('LL')
        results['anomalies_LS'] = detect_anomalies_async('LS')
        results['anomalies_MT'] = detect_anomalies_async('MT')

        # 3. Prophet forecasting
        for site in ['LL', 'LS', 'MT']:
            for horizon in [7, 30, 90]:
                key = f'prophet_{site}_{horizon}d'
                results[key] = train_prophet_async(site, horizon)

        logger.info("✅ Full ML models retraining completed")

        return {
            "status": "success",
            "timestamp": str(logger.handlers[0].formatter.formatTime(logger.makeRecord('', 0, '', 0, '', (), None))),
            "results": results
        }

    except Exception as exc:
        logger.error(f"❌ Full retraining failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}
