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
def train_pysr_async(
    self,
    lot_id: int | None = None,
    genetique: str | None = None,
    include_sqal_features: bool = False,
    premium_grades: list[str] | None = None,
    require_sqal_premium: bool = True,
    site_codes: list[str] | None = None,
    min_duree_gavage: int | None = None,
    max_duree_gavage: int | None = None,
    seasons: list[str] | None = None,
    cluster_ids: list[int] | None = None,
) -> Dict[str, Any]:
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
        logger.info(f"🔬 Starting PySR training (lot_id={lot_id}, genetique={genetique})")

        # Import lazy (évite imports inutiles au démarrage)
        from app.ml.symbolic_regression import train_pysr_model

        # Entraînement
        result = train_pysr_model(
            lot_id=lot_id,
            genetique=genetique,
            include_sqal_features=include_sqal_features,
            premium_grades=premium_grades,
            require_sqal_premium=require_sqal_premium,
            site_codes=site_codes,
            min_duree_gavage=min_duree_gavage,
            max_duree_gavage=max_duree_gavage,
            seasons=seasons,
            cluster_ids=cluster_ids,
        )

        logger.info(
            f"✅ PySR training completed (lot_id={lot_id}, genetique={genetique}) - R²: {result.get('r2_score', 0):.3f}"
        )

        return {
            "status": "success",
            "lot_id": lot_id,
            "genetique": result.get("genetique", genetique),
            "formula": result.get("formula", ""),
            "r2_score": result.get("r2_score", 0.0),
            "variables": result.get("variables", []),
            "complexity": result.get("complexity", 0),
            "include_sqal_features": include_sqal_features,
            "premium_grades": premium_grades,
            "require_sqal_premium": require_sqal_premium,
            "site_codes": site_codes,
            "min_duree_gavage": min_duree_gavage,
            "max_duree_gavage": max_duree_gavage,
            "seasons": seasons,
            "cluster_ids": cluster_ids,
        }

    except Exception as exc:
        logger.error(f"❌ PySR training failed (lot_id={lot_id}, genetique={genetique}): {exc}", exc_info=True)

        # Cas attendu: pas assez de données → ne pas retry en boucle
        msg = str(exc)
        if "Pas assez de données" in msg:
            return {
                "status": "error",
                "lot_id": lot_id,
                "genetique": genetique,
                "error": msg,
            }

        # Retry avec backoff exponentiel
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@celery_app.task(bind=True, max_retries=1, time_limit=3600)
def train_pysr_multi_async(
    self,
    include_sqal_features: bool = False,
    premium_grades: list[str] | None = None,
    require_sqal_premium: bool = True,
    site_codes: list[str] | None = None,
    min_duree_gavage: int | None = None,
    max_duree_gavage: int | None = None,
    seasons: list[str] | None = None,
    cluster_ids: list[int] | None = None,
) -> Dict[str, Any]:
    """Entraîne PySR sur *toutes* les génétiques disponibles après application des filtres."""
    try:
        logger.info(
            "🔬 Starting PySR multi training "
            f"(site_codes={site_codes}, seasons={seasons}, cluster_ids={cluster_ids}, premium={require_sqal_premium})"
        )

        import asyncio

        from app.ml.symbolic_regression import train_pysr_model

        async def _discover_genetiques(
            _site_codes: list[str] | None,
            _min_duree_gavage: int | None,
            _max_duree_gavage: int | None,
            _seasons: list[str] | None,
            _cluster_ids: list[int] | None,
            _require_sqal_premium: bool,
        ) -> list[str]:
            pool = await asyncpg.create_pool(DATABASE_URL)
            try:
                where_clauses: list[str] = [
                    "(gdl.dose_moyenne IS NOT NULL)",
                    "(gdl.poids_moyen_lot IS NOT NULL)",
                    "(lg.genetique IS NOT NULL)",
                    "(TRIM(lg.genetique) <> '')",
                ]

                params: list[object] = []
                param_idx = 1

                if _site_codes:
                    where_clauses.append(f"lg.site_code = ANY(${param_idx})")
                    params.append(_site_codes)
                    param_idx += 1

                if _min_duree_gavage is not None:
                    where_clauses.append(
                        f"COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc) >= ${param_idx}"
                    )
                    params.append(int(_min_duree_gavage))
                    param_idx += 1

                if _max_duree_gavage is not None:
                    where_clauses.append(
                        f"COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc) <= ${param_idx}"
                    )
                    params.append(int(_max_duree_gavage))
                    param_idx += 1

                if _seasons:
                    where_clauses.append(f"lc.season = ANY(${param_idx})")
                    params.append([str(s).lower() for s in _seasons])
                    param_idx += 1

                if _cluster_ids:
                    where_clauses.append(f"gc.cluster_id = ANY(${param_idx})")
                    params.append([int(x) for x in _cluster_ids])
                    param_idx += 1

                if _require_sqal_premium:
                    resolved_premium = premium_grades or ["A+", "A"]
                    where_clauses.append(
                        f"EXISTS (SELECT 1 FROM sensor_samples ss WHERE ss.lot_id = lg.id AND ss.fusion_final_grade = ANY(${param_idx}))"
                    )
                    params.append(resolved_premium)
                    param_idx += 1

                query = """
                WITH lot_duree AS (
                    SELECT lot_gavage_id, MAX(jour_gavage) AS duree_gavage_calc
                    FROM gavage_data_lots
                    GROUP BY lot_gavage_id
                ),
                lots_ctx AS (
                    SELECT
                        lg.id AS lot_id,
                        COALESCE(
                            pa.date_abattage_reelle,
                            pa.date_abattage_prevue,
                            (lg.debut_lot + COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc))
                        ) AS date_abattage,
                        CASE
                            WHEN EXTRACT(MONTH FROM COALESCE(
                                pa.date_abattage_reelle,
                                pa.date_abattage_prevue,
                                (lg.debut_lot + COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc))
                            )) IN (12, 1, 2) THEN 'winter'
                            WHEN EXTRACT(MONTH FROM COALESCE(
                                pa.date_abattage_reelle,
                                pa.date_abattage_prevue,
                                (lg.debut_lot + COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc))
                            )) IN (3, 4, 5) THEN 'spring'
                            WHEN EXTRACT(MONTH FROM COALESCE(
                                pa.date_abattage_reelle,
                                pa.date_abattage_prevue,
                                (lg.debut_lot + COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc))
                            )) IN (6, 7, 8) THEN 'summer'
                            WHEN EXTRACT(MONTH FROM COALESCE(
                                pa.date_abattage_reelle,
                                pa.date_abattage_prevue,
                                (lg.debut_lot + COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc))
                            )) IN (9, 10, 11) THEN 'autumn'
                            ELSE NULL
                        END AS season
                    FROM lots_gavage lg
                    LEFT JOIN lot_duree d ON d.lot_gavage_id = lg.id
                    LEFT JOIN planning_abattages pa ON pa.lot_id = lg.id
                )
                SELECT DISTINCT LOWER(lg.genetique) AS genetique
                FROM gavage_data_lots gdl
                JOIN lots_gavage lg ON lg.id = gdl.lot_gavage_id
                LEFT JOIN lot_duree d ON d.lot_gavage_id = lg.id
                LEFT JOIN lots_ctx lc ON lc.lot_id = lg.id
                LEFT JOIN gaveurs_clusters gc ON gc.gaveur_id = lg.gaveur_id
                WHERE
                """

                query += " AND ".join(where_clauses)
                query += " ORDER BY genetique"

                rows = await pool.fetch(query, *params)
                return [str(r["genetique"]) for r in rows if r.get("genetique")]
            finally:
                await pool.close()

        genetiques = asyncio.run(
            _discover_genetiques(
                site_codes,
                min_duree_gavage,
                max_duree_gavage,
                seasons,
                cluster_ids,
                require_sqal_premium,
            )
        )

        if not genetiques:
            diagnostics = {
                "step_base_no_filters": asyncio.run(
                    _discover_genetiques(None, None, None, None, None, False)
                ),
                "step_site": asyncio.run(
                    _discover_genetiques(site_codes, None, None, None, None, False)
                ),
                "step_site_duration": asyncio.run(
                    _discover_genetiques(site_codes, min_duree_gavage, max_duree_gavage, None, None, False)
                ),
                "step_site_duration_season": asyncio.run(
                    _discover_genetiques(site_codes, min_duree_gavage, max_duree_gavage, seasons, None, False)
                ),
                "step_site_duration_season_cluster": asyncio.run(
                    _discover_genetiques(site_codes, min_duree_gavage, max_duree_gavage, seasons, cluster_ids, False)
                ),
            }

            if require_sqal_premium:
                diagnostics["step_full_with_premium"] = asyncio.run(
                    _discover_genetiques(
                        site_codes,
                        min_duree_gavage,
                        max_duree_gavage,
                        seasons,
                        cluster_ids,
                        True,
                    )
                )

            return {
                "status": "error",
                "error": "Aucune génétique trouvée avec ces filtres",
                "site_codes": site_codes,
                "min_duree_gavage": min_duree_gavage,
                "max_duree_gavage": max_duree_gavage,
                "seasons": seasons,
                "cluster_ids": cluster_ids,
                "require_sqal_premium": require_sqal_premium,
                "premium_grades": premium_grades,
                "diagnostics": {
                    k: {"n_genetiques": len(v), "genetiques": v}
                    for k, v in diagnostics.items()
                },
            }

        results: dict[str, Any] = {}
        for g in genetiques:
            try:
                res = train_pysr_model(
                    genetique=g,
                    include_sqal_features=include_sqal_features,
                    premium_grades=premium_grades,
                    require_sqal_premium=require_sqal_premium,
                    site_codes=site_codes,
                    min_duree_gavage=min_duree_gavage,
                    max_duree_gavage=max_duree_gavage,
                    seasons=seasons,
                    cluster_ids=cluster_ids,
                )
                results[g] = {
                    "status": "success",
                    "formula": res.get("formula", ""),
                    "r2_score": res.get("r2_score", 0.0),
                    "n_samples": res.get("n_samples", 0),
                }
            except Exception as exc:
                results[g] = {
                    "status": "error",
                    "error": str(exc),
                }

        return {
            "status": "success",
            "mode": "multi_genetique",
            "genetiques": genetiques,
            "results": results,
            "include_sqal_features": include_sqal_features,
            "premium_grades": premium_grades,
            "require_sqal_premium": require_sqal_premium,
            "site_codes": site_codes,
            "min_duree_gavage": min_duree_gavage,
            "max_duree_gavage": max_duree_gavage,
            "seasons": seasons,
            "cluster_ids": cluster_ids,
        }

    except Exception as exc:
        logger.error(f"❌ PySR multi training failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


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


@celery_app.task(time_limit=300)
def cluster_lots_pred_async(
    n_clusters: int = 3,
    random_state: int = 42,
    n_init: int = 10,
    min_lots: int = 20,
    site_codes: list[str] | None = None,
    genetique: str | None = None,
    seasons: list[str] | None = None,
    min_duree_gavage: int | None = None,
    max_duree_gavage: int | None = None,
    features: list[str] | None = None,
    modele_version: str = "lot_pred_kmeans_v1",
) -> Dict[str, Any]:
    """Clustering prédictif des lots (lot_pred) pour segmentation génétique+site+cluster."""
    try:
        logger.info(
            "📦 Starting lot_pred clustering "
            f"(k={n_clusters}, site_codes={site_codes}, genetique={genetique}, seasons={seasons})"
        )

        from datetime import datetime
        import json
        import asyncio

        from app.ml.euralis.lot_clustering import cluster_lots_pred

        database_url = os.getenv("DATABASE_URL", DATABASE_URL)

        async def _ensure_tables(conn: asyncpg.Connection):
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS lot_clustering_runs (
                    id SERIAL PRIMARY KEY,
                    clustering_type VARCHAR(50) NOT NULL,
                    modele_version VARCHAR(100) NOT NULL,
                    params JSONB,
                    features TEXT[],
                    n_clusters INTEGER,
                    n_lots INTEGER,
                    avg_confidence DOUBLE PRECISION,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS lot_clustering_assignments (
                    id SERIAL PRIMARY KEY,
                    run_id INTEGER REFERENCES lot_clustering_runs(id) ON DELETE CASCADE,
                    lot_id INTEGER REFERENCES lots_gavage(id) ON DELETE CASCADE,
                    cluster_id INTEGER NOT NULL,
                    confidence DOUBLE PRECISION,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(run_id, lot_id)
                );
                """
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_lot_clust_assign_lot ON lot_clustering_assignments(lot_id);"
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_lot_clust_assign_run ON lot_clustering_assignments(run_id);"
            )

        async def _persist(result: Dict[str, Any]) -> int:
            pool = await asyncpg.create_pool(database_url)
            try:
                async with pool.acquire() as conn:
                    await _ensure_tables(conn)

                    params = {
                        "n_clusters": n_clusters,
                        "random_state": random_state,
                        "n_init": n_init,
                        "min_lots": min_lots,
                        "site_codes": site_codes,
                        "genetique": genetique,
                        "seasons": seasons,
                        "min_duree_gavage": min_duree_gavage,
                        "max_duree_gavage": max_duree_gavage,
                    }
                    run_id = await conn.fetchval(
                        """
                        INSERT INTO lot_clustering_runs (
                            clustering_type,
                            modele_version,
                            params,
                            features,
                            n_clusters,
                            n_lots,
                            avg_confidence,
                            created_at
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                        RETURNING id
                        """,
                        "lot_pred",
                        str(result.get("modele_version") or modele_version),
                        json.dumps(params),
                        result.get("features") or [],
                        int(result.get("n_clusters") or 0),
                        int(result.get("n_lots") or 0),
                        float(result.get("avg_confidence") or 0.0),
                        datetime.utcnow(),
                    )

                    upsert = """
                        INSERT INTO lot_clustering_assignments (
                            run_id, lot_id, cluster_id, confidence, created_at
                        ) VALUES ($1,$2,$3,$4,$5)
                        ON CONFLICT (run_id, lot_id) DO UPDATE SET
                            cluster_id = EXCLUDED.cluster_id,
                            confidence = EXCLUDED.confidence,
                            created_at = EXCLUDED.created_at
                    """

                    for a in result.get("assignments", []):
                        await conn.execute(
                            upsert,
                            int(run_id),
                            int(a["lot_id"]),
                            int(a["cluster_id"]),
                            float(a.get("confidence") or 0.0),
                            datetime.utcnow(),
                        )

                    return int(run_id)
            finally:
                await pool.close()

        result = cluster_lots_pred(
            n_clusters=n_clusters,
            random_state=random_state,
            n_init=n_init,
            min_lots=min_lots,
            site_codes=site_codes,
            genetique=genetique,
            seasons=seasons,
            min_duree_gavage=min_duree_gavage,
            max_duree_gavage=max_duree_gavage,
            features=features,
            modele_version=modele_version,
        )

        if result.get("status") != "success":
            return result

        run_id = asyncio.run(_persist(result))
        result["run_id"] = run_id

        logger.info(
            "✅ lot_pred clustering completed "
            f"(run_id={run_id}, n_lots={result.get('n_lots')}, k={result.get('n_clusters')})"
        )
        return result

    except Exception as exc:
        logger.error(f"❌ lot_pred clustering failed: {exc}", exc_info=True)
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
