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
import json

logger = logging.getLogger(__name__)

# Configuration Database
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db')


async def _fetch_lot_level_dataset(
    *,
    conn: asyncpg.Connection,
    site_codes: list[str] | None = None,
    genetique: str | None = None,
    min_duree_gavage: int | None = None,
    max_duree_gavage: int | None = None,
    limit_lots: int | None = None,
) -> list[dict[str, Any]]:
    resolved_site_codes = [str(x).strip().upper() for x in (site_codes or []) if str(x).strip()]
    resolved_gen = str(genetique).strip().lower() if genetique else None

    where: list[str] = [
        "lg.code_lot IS NOT NULL",
    ]
    params: list[object] = []
    idx = 1

    if resolved_site_codes:
        where.append(f"lg.site_code = ANY(${idx}::varchar[])")
        params.append(resolved_site_codes)
        idx += 1

    if resolved_gen:
        where.append("(LOWER(lg.genetique) = $%s OR LOWER(lg.souche) = $%s)" % (idx, idx))
        params.append(resolved_gen)
        idx += 1

    if min_duree_gavage is not None:
        where.append(f"COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc) >= ${idx}")
        params.append(int(min_duree_gavage))
        idx += 1

    if max_duree_gavage is not None:
        where.append(f"COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc) <= ${idx}")
        params.append(int(max_duree_gavage))
        idx += 1

    limit_sql = ""
    if limit_lots is not None:
        limit_sql = f"LIMIT {int(max(1, limit_lots))}"

    query = f"""
    WITH lot_duree AS (
        SELECT lot_gavage_id, MAX(jour_gavage) AS duree_gavage_calc
        FROM gavage_data_lots
        GROUP BY lot_gavage_id
    ),
    gdl_last AS (
        SELECT DISTINCT ON (gdl.lot_gavage_id, gdl.jour_gavage, LOWER(gdl.repas))
            gdl.lot_gavage_id,
            gdl.jour_gavage,
            LOWER(gdl.repas) AS repas,
            gdl.dose_moyenne,
            gdl.time
        FROM gavage_data_lots gdl
        WHERE gdl.dose_moyenne IS NOT NULL
        ORDER BY gdl.lot_gavage_id, gdl.jour_gavage, LOWER(gdl.repas), gdl.time DESC
    ),
    gdl_pivot AS (
        SELECT
            lot_gavage_id,
            jour_gavage,
            MAX(dose_moyenne) FILTER (WHERE repas = 'matin') AS dose_matin,
            MAX(dose_moyenne) FILTER (WHERE repas = 'soir') AS dose_soir
        FROM gdl_last
        GROUP BY lot_gavage_id, jour_gavage
    ),
    sqal_avg AS (
        SELECT
            lg.id AS lot_id,
            AVG(ss.fusion_final_score) AS sqal_score_avg
        FROM lots_gavage lg
        JOIN sensor_samples ss
          ON ss.lot_id = lg.id
        GROUP BY lg.id
    ),
    sqal_last_grade AS (
        SELECT DISTINCT ON (lg.id)
            lg.id AS lot_id,
            ss.fusion_final_grade AS sqal_grade_last,
            ss.timestamp AS sqal_ts
        FROM lots_gavage lg
        JOIN sensor_samples ss
          ON ss.lot_id = lg.id
        WHERE ss.fusion_final_grade IS NOT NULL
        ORDER BY lg.id, ss.timestamp DESC NULLS LAST
    )
    SELECT
        lg.id AS lot_id,
        lg.code_lot,
        lg.site_code,
        COALESCE(LOWER(lg.genetique), LOWER(lg.souche)) AS genetique,
        COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc) AS duree_gavage,
        sc.sqal_score_avg,
        slg.sqal_grade_last,
        COALESCE(
            json_agg(
                json_build_object(
                    'jour', p.jour_gavage,
                    'matin', COALESCE(p.dose_matin, 0),
                    'soir', COALESCE(p.dose_soir, 0),
                    'total', COALESCE(p.dose_matin, 0) + COALESCE(p.dose_soir, 0)
                )
                ORDER BY p.jour_gavage
            ) FILTER (WHERE p.jour_gavage IS NOT NULL),
            '[]'::json
        ) AS jours
    FROM lots_gavage lg
    JOIN lot_duree d ON d.lot_gavage_id = lg.id
    LEFT JOIN gdl_pivot p ON p.lot_gavage_id = lg.id
    LEFT JOIN sqal_avg sc ON sc.lot_id = lg.id
    LEFT JOIN sqal_last_grade slg ON slg.lot_id = lg.id
    WHERE {' AND '.join(where)}
    GROUP BY
        lg.id,
        lg.code_lot,
        lg.site_code,
        COALESCE(LOWER(lg.genetique), LOWER(lg.souche)),
        COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc),
        sc.sqal_score_avg,
        slg.sqal_grade_last
    ORDER BY lg.id DESC
    {limit_sql}
    """

    rows = await conn.fetch(query, *params)
    return [dict(r) for r in rows]


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
    foie_min_g: float | None = None,
    foie_max_g: float | None = None,
    foie_target_g: float | None = None,
    foie_weight_range: float | None = None,
    foie_weight_target: float | None = None,
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
    import time
    started_ts = time.time()

    async def _ensure_pysr_training_history_table(conn: asyncpg.Connection) -> None:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS pysr_training_history (
                id SERIAL PRIMARY KEY,
                lot_id INTEGER REFERENCES lots_gavage(id),
                gaveur_id INTEGER REFERENCES gaveurs_euralis(id),
                nb_iterations INTEGER,
                max_complexity INTEGER,
                binary_operators TEXT,
                unary_operators TEXT,
                statut VARCHAR(20) NOT NULL,
                best_equation TEXT,
                r2_score DECIMAL(10, 6),
                mae DECIMAL(12, 6),
                complexity INTEGER,
                duree_secondes INTEGER,
                nb_equations_generees INTEGER,
                nb_lots_entrainement INTEGER,
                date_debut_donnees DATE,
                date_fin_donnees DATE,
                error_message TEXT,
                started_at TIMESTAMPTZ NOT NULL,
                finished_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            """
        )

        # Colonnes additionnelles pour le mode segment (compat rétro)
        await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS task_id TEXT")
        await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS site_code VARCHAR(2)")
        await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS genetique TEXT")
        await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS cluster_id INTEGER")

        await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS candidate_curve_json JSONB")
        await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS candidate_metrics_json JSONB")

        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pysr_history_segment ON pysr_training_history(site_code, genetique, cluster_id, started_at DESC)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pysr_history_task_id ON pysr_training_history(task_id)"
        )

    async def _persist_pysr_history(
        *,
        statut: str,
        equation: str | None,
        r2_score: float | None,
        complexity: int | None,
        error_message: str | None,
        resolved_site_code: str | None,
        resolved_cluster_id: int | None,
        resolved_genetique: str | None,
        candidate_curve_json: dict[str, Any] | None = None,
        candidate_metrics_json: dict[str, Any] | None = None,
    ) -> None:
        pool = await asyncpg.create_pool(DATABASE_URL)
        try:
            async with pool.acquire() as conn:
                await _ensure_pysr_training_history_table(conn)
                await conn.execute(
                    """
                    INSERT INTO pysr_training_history (
                        task_id, lot_id, gaveur_id,
                        site_code, genetique, cluster_id,
                        statut, best_equation, r2_score, complexity,
                        duree_secondes, error_message,
                        candidate_curve_json, candidate_metrics_json,
                        started_at, finished_at
                    ) VALUES (
                        $1, $2, $3,
                        $4, $5, $6,
                        $7, $8, $9, $10,
                        $11, $12,
                        $13, $14,
                        to_timestamp($15), to_timestamp($16)
                    )
                    """,
                    str(getattr(self.request, "id", "")) or None,
                    (int(lot_id) if lot_id is not None else None),
                    None,
                    (str(resolved_site_code).strip().upper() if resolved_site_code else None),
                    (str(resolved_genetique).strip().lower() if resolved_genetique else None),
                    (int(resolved_cluster_id) if resolved_cluster_id is not None else None),
                    str(statut).upper(),
                    (str(equation) if equation else None),
                    (float(r2_score) if r2_score is not None else None),
                    (int(complexity) if complexity is not None else None),
                    int(max(0, round(time.time() - started_ts))),
                    (str(error_message) if error_message else None),
                    (json.dumps(candidate_curve_json) if candidate_curve_json is not None else None),
                    (json.dumps(candidate_metrics_json) if candidate_metrics_json is not None else None),
                    float(started_ts),
                    float(time.time()),
                )
        finally:
            await pool.close()

    def _compute_curve_metrics_from_jours(jours: list[dict[str, Any]]) -> dict[str, Any]:
        totals = []
        for p in jours:
            try:
                totals.append(float(p.get("total") or 0.0))
            except Exception:
                totals.append(0.0)
        if not totals:
            return {"n_jours": 0}

        peak_total = max(totals)
        day_peak = int(jours[totals.index(peak_total)].get("jour") or (totals.index(peak_total) + 1))
        return {
            "n_jours": int(len(totals)),
            "dose_start_total": float(totals[0]),
            "dose_peak_total": float(peak_total),
            "day_peak": int(day_peak),
            "dose_end_total": float(totals[-1]),
            "total_mais": float(sum(totals)),
        }

    def _build_candidate_curves_by_gate(
        rows: list[dict[str, Any]],
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        # Group by SQAL gate using last grade.
        gate_to_lots: dict[str, list[list[dict[str, Any]]]] = {
            "A": [],
            "B": [],
            "C_D": [],
        }

        for r in rows:
            grade = str(r.get("sqal_grade_last") or "").strip().upper()
            if grade in ("A+", "A"):
                gate = "A"
            elif grade == "B":
                gate = "B"
            elif grade in ("C", "REJECT"):
                gate = "C_D"
            else:
                continue

            jours = r.get("jours")
            if isinstance(jours, str):
                try:
                    jours = json.loads(jours)
                except Exception:
                    jours = []
            if not isinstance(jours, list):
                jours = []
            gate_to_lots[gate].append(jours)

        curves_by_gate: dict[str, Any] = {"by_gate": {}}
        metrics_by_gate: dict[str, Any] = {"by_gate": {}}

        for gate, lots_jours in gate_to_lots.items():
            if not lots_jours:
                curves_by_gate["by_gate"][gate] = {"jours": []}
                metrics_by_gate["by_gate"][gate] = {"n_lots": 0, "metrics": {"n_jours": 0}}
                continue

            max_day = 0
            for lj in lots_jours:
                for p in lj:
                    try:
                        max_day = max(max_day, int(p.get("jour") or 0))
                    except Exception:
                        continue

            agg: list[dict[str, Any]] = []
            for day in range(1, max_day + 1):
                matin_vals: list[float] = []
                soir_vals: list[float] = []
                for lj in lots_jours:
                    for p in lj:
                        if int(p.get("jour") or 0) != day:
                            continue
                        try:
                            matin_vals.append(float(p.get("matin") or 0.0))
                        except Exception:
                            pass
                        try:
                            soir_vals.append(float(p.get("soir") or 0.0))
                        except Exception:
                            pass
                        break

                matin_mean = (sum(matin_vals) / len(matin_vals)) if matin_vals else 0.0
                soir_mean = (sum(soir_vals) / len(soir_vals)) if soir_vals else 0.0
                agg.append(
                    {
                        "jour": int(day),
                        "matin": float(round(matin_mean, 2)),
                        "soir": float(round(soir_mean, 2)),
                        "total": float(round(matin_mean + soir_mean, 2)),
                    }
                )

            curves_by_gate["by_gate"][gate] = {
                "jours": agg,
            }
            metrics_by_gate["by_gate"][gate] = {
                "n_lots": int(len(lots_jours)),
                "metrics": _compute_curve_metrics_from_jours(agg),
            }

        return curves_by_gate, metrics_by_gate

    try:
        logger.info(f"🔬 Starting PySR training (lot_id={lot_id}, genetique={genetique})")

        import asyncio

        async def _resolve_foie_objective(
            *,
            resolved_genetique: str | None,
            resolved_site_code: str | None,
            resolved_cluster_pred_id: int | None,
            override_min: float | None,
            override_max: float | None,
            override_target: float | None,
            override_w_range: float | None,
            override_w_target: float | None,
        ) -> tuple[float, float, float, float, float]:
            default_min = 400.0
            default_max = 700.0
            default_target = 550.0
            default_w_range = 0.5
            default_w_target = 0.5

            if not resolved_genetique:
                return (
                    float(override_min if override_min is not None else default_min),
                    float(override_max if override_max is not None else default_max),
                    float(override_target if override_target is not None else default_target),
                    float(override_w_range if override_w_range is not None else default_w_range),
                    float(override_w_target if override_w_target is not None else default_w_target),
                )

            pool = await asyncpg.create_pool(DATABASE_URL)
            try:
                async with pool.acquire() as conn:
                    await conn.execute(
                        """
                        CREATE TABLE IF NOT EXISTS foie_objective_policies (
                            id SERIAL PRIMARY KEY,
                            genetique TEXT NOT NULL,
                            site_code VARCHAR(2),
                            lot_cluster_pred_id INTEGER,
                            foie_min_g DOUBLE PRECISION NOT NULL,
                            foie_max_g DOUBLE PRECISION NOT NULL,
                            foie_target_g DOUBLE PRECISION NOT NULL,
                            weight_range DOUBLE PRECISION NOT NULL,
                            weight_target DOUBLE PRECISION NOT NULL,
                            is_active BOOLEAN NOT NULL DEFAULT TRUE,
                            valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            valid_to TIMESTAMPTZ,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            created_by TEXT
                        );
                        """
                    )

                    row = await conn.fetchrow(
                        """
                        SELECT *
                        FROM foie_objective_policies
                        WHERE genetique = $1
                          AND is_active = TRUE
                          AND valid_from <= NOW()
                          AND (valid_to IS NULL OR valid_to > NOW())
                          AND ($2::varchar IS NULL OR site_code IS NULL OR site_code = $2)
                          AND ($3::int IS NULL OR lot_cluster_pred_id IS NULL OR lot_cluster_pred_id = $3)
                        ORDER BY
                          (site_code IS NOT NULL AND site_code = $2) DESC,
                          (lot_cluster_pred_id IS NOT NULL AND lot_cluster_pred_id = $3) DESC,
                          created_at DESC
                        LIMIT 1
                        """,
                        str(resolved_genetique).strip().lower(),
                        (str(resolved_site_code).strip().upper() if resolved_site_code else None),
                        (int(resolved_cluster_pred_id) if resolved_cluster_pred_id is not None else None),
                    )
            finally:
                await pool.close()

            if row:
                p_min = float(row["foie_min_g"])
                p_max = float(row["foie_max_g"])
                p_target = float(row["foie_target_g"])
                p_w_range = float(row["weight_range"])
                p_w_target = float(row["weight_target"])
            else:
                p_min = default_min
                p_max = default_max
                p_target = default_target
                p_w_range = default_w_range
                p_w_target = default_w_target

            return (
                float(override_min if override_min is not None else p_min),
                float(override_max if override_max is not None else p_max),
                float(override_target if override_target is not None else p_target),
                float(override_w_range if override_w_range is not None else p_w_range),
                float(override_w_target if override_w_target is not None else p_w_target),
            )

        async def _infer_segment_from_lot(
            lot_id: int,
        ) -> tuple[str | None, str | None, int | None]:
            pool = await asyncpg.create_pool(DATABASE_URL)
            try:
                async with pool.acquire() as conn:
                    lot_row = await conn.fetchrow(
                        "SELECT genetique, site_code FROM lots_gavage WHERE id = $1",
                        int(lot_id),
                    )
                    if not lot_row:
                        return None, None, None

                    resolved_gen = str(lot_row["genetique"]).strip().lower() if lot_row.get("genetique") else None
                    resolved_site = str(lot_row["site_code"]).strip().upper() if lot_row.get("site_code") else None

                    run_id = await conn.fetchval(
                        """
                        SELECT id
                        FROM lot_clustering_runs
                        WHERE clustering_type = 'lot_pred'
                        ORDER BY created_at DESC
                        LIMIT 1
                        """
                    )
                    if not run_id:
                        return resolved_gen, resolved_site, None

                    cluster_id = await conn.fetchval(
                        """
                        SELECT cluster_id
                        FROM lot_clustering_assignments
                        WHERE run_id = $1 AND lot_id = $2
                        """,
                        int(run_id),
                        int(lot_id),
                    )
                    return resolved_gen, resolved_site, (int(cluster_id) if cluster_id is not None else None)
            finally:
                await pool.close()

        # Import lazy (évite imports inutiles au démarrage)
        from app.ml.symbolic_regression import train_pysr_model

        async def _ensure_pysr_training_history_table(conn: asyncpg.Connection) -> None:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS pysr_training_history (
                    id SERIAL PRIMARY KEY,
                    task_id TEXT,
                    lot_id INTEGER,
                    gaveur_id INTEGER,
                    site_code VARCHAR(2),
                    genetique TEXT,
                    cluster_id INTEGER,
                    statut VARCHAR(20) NOT NULL,
                    best_equation TEXT,
                    r2_score DOUBLE PRECISION,
                    mae DOUBLE PRECISION,
                    complexity INTEGER,
                    duree_secondes INTEGER,
                    error_message TEXT,
                    candidate_curve_json JSONB,
                    candidate_metrics_json JSONB,
                    started_at TIMESTAMPTZ,
                    finished_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS task_id TEXT")
            await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS site_code VARCHAR(2)")
            await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS genetique TEXT")
            await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS cluster_id INTEGER")
            await conn.execute(
                "ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS candidate_curve_json JSONB"
            )
            await conn.execute(
                "ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS candidate_metrics_json JSONB"
            )

        async def _persist_multi_history_row(
            *,
            statut: str,
            resolved_site_code: str | None,
            resolved_genetique: str | None,
            resolved_cluster_id: int | None,
            equation: str | None,
            r2_score: float | None,
            complexity: int | None,
            error_message: str | None,
            candidate_curve_json: dict[str, Any] | None = None,
            candidate_metrics_json: dict[str, Any] | None = None,
        ) -> None:
            pool = await asyncpg.create_pool(DATABASE_URL)
            try:
                async with pool.acquire() as conn:
                    await _ensure_pysr_training_history_table(conn)
                    await conn.execute(
                        """
                        INSERT INTO pysr_training_history (
                            task_id,
                            site_code,
                            genetique,
                            cluster_id,
                            statut,
                            best_equation,
                            r2_score,
                            complexity,
                            duree_secondes,
                            error_message,
                            candidate_curve_json,
                            candidate_metrics_json,
                            started_at,
                            finished_at
                        ) VALUES (
                            $1,
                            $2,
                            $3,
                            $4,
                            $5,
                            $6,
                            $7,
                            $8,
                            $9,
                            $10,
                            $11::jsonb,
                            $12::jsonb,
                            to_timestamp($13),
                            to_timestamp($14)
                        )
                        """,
                        str(getattr(self.request, "id", "")) or None,
                        (str(resolved_site_code).strip().upper() if resolved_site_code else None),
                        (str(resolved_genetique).strip().lower() if resolved_genetique else None),
                        (int(resolved_cluster_id) if resolved_cluster_id is not None else None),
                        str(statut).upper(),
                        (str(equation) if equation else None),
                        (float(r2_score) if r2_score is not None else None),
                        (int(complexity) if complexity is not None else None),
                        int(max(0, round(time.time() - started_ts))),
                        (str(error_message) if error_message else None),
                        (json.dumps(candidate_curve_json) if candidate_curve_json is not None else None),
                        (json.dumps(candidate_metrics_json) if candidate_metrics_json is not None else None),
                        float(started_ts),
                        float(time.time()),
                    )
            finally:
                await pool.close()

        resolved_genetique = genetique
        resolved_site_code: str | None = None
        resolved_cluster_pred_id: int | None = None

        if lot_id is not None:
            g, sc, lc = asyncio.run(_infer_segment_from_lot(int(lot_id)))
            resolved_genetique = resolved_genetique or g
            resolved_site_code = sc
            resolved_cluster_pred_id = lc
        elif site_codes and len(site_codes) == 1:
            resolved_site_code = str(site_codes[0]).strip().upper()

        persisted_cluster_id: int | None = resolved_cluster_pred_id
        if persisted_cluster_id is None and cluster_ids and len(cluster_ids) == 1:
            try:
                persisted_cluster_id = int(cluster_ids[0])
            except Exception:
                persisted_cluster_id = None

        (resolved_foie_min,
         resolved_foie_max,
         resolved_foie_target,
         resolved_w_range,
         resolved_w_target,) = asyncio.run(
            _resolve_foie_objective(
                resolved_genetique=str(resolved_genetique).strip().lower() if resolved_genetique else None,
                resolved_site_code=resolved_site_code,
                resolved_cluster_pred_id=resolved_cluster_pred_id,
                override_min=foie_min_g,
                override_max=foie_max_g,
                override_target=foie_target_g,
                override_w_range=foie_weight_range,
                override_w_target=foie_weight_target,
            )
        )

        resolved_foie_objective = {
            "foie_min_g": float(resolved_foie_min),
            "foie_max_g": float(resolved_foie_max),
            "foie_target_g": float(resolved_foie_target),
            "foie_weight_range": float(resolved_w_range),
            "foie_weight_target": float(resolved_w_target),
        }

        # Entraînement
        result = train_pysr_model(
            lot_id=lot_id,
            genetique=resolved_genetique,
            include_sqal_features=include_sqal_features,
            premium_grades=premium_grades,
            require_sqal_premium=require_sqal_premium,
            site_codes=site_codes,
            min_duree_gavage=min_duree_gavage,
            max_duree_gavage=max_duree_gavage,
            seasons=seasons,
            cluster_ids=cluster_ids,
            foie_min_g=float(resolved_foie_min),
            foie_max_g=float(resolved_foie_max),
            foie_target_g=float(resolved_foie_target),
            foie_weight_range=float(resolved_w_range),
            foie_weight_target=float(resolved_w_target),
        )
        logger.info(
            f"✅ PySR training completed (lot_id={lot_id}, genetique={genetique}) - R²: {result.get('r2_score', 0):.3f}"
        )

        # Build "real" candidates curves by SQAL gate from the lot-level dataset.
        candidate_curve_json = None
        candidate_metrics_json = None
        try:
            pool = asyncio.run(asyncpg.create_pool(DATABASE_URL))
            try:
                async def _load_rows() -> list[dict[str, Any]]:
                    async with pool.acquire() as conn:
                        return await _fetch_lot_level_dataset(
                            conn=conn,
                            site_codes=site_codes,
                            genetique=resolved_genetique,
                            min_duree_gavage=min_duree_gavage,
                            max_duree_gavage=max_duree_gavage,
                            limit_lots=2000,
                        )

                rows = asyncio.run(_load_rows())
            finally:
                asyncio.run(pool.close())

            candidate_curve_json, candidate_metrics_json = _build_candidate_curves_by_gate(rows)
            candidate_curve_json["default_gate"] = "A"
        except Exception as curve_err:
            logger.warning(f"Failed to build candidate curves by gate: {curve_err}")

        # Persister aussi les métriques de winsorisation (Option C) si présentes dans le résultat.
        try:
            w = result.get("winsorization") if isinstance(result, dict) else None
            if w is not None:
                if candidate_metrics_json is None:
                    candidate_metrics_json = {}
                if isinstance(candidate_metrics_json, dict):
                    candidate_metrics_json["winsorization"] = w
        except Exception:
            pass

        asyncio.run(
            _persist_pysr_history(
                statut="SUCCESS",
                equation=result.get("formula"),
                r2_score=result.get("r2_score"),
                complexity=result.get("complexity"),
                error_message=None,
                resolved_site_code=resolved_site_code,
                resolved_cluster_id=persisted_cluster_id,
                resolved_genetique=resolved_genetique,
                candidate_curve_json=candidate_curve_json,
                candidate_metrics_json=candidate_metrics_json,
            )
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
            "foie_objective": resolved_foie_objective,
        }

    except Exception as exc:
        logger.error(f"❌ PySR training failed (lot_id={lot_id}, genetique={genetique}): {exc}", exc_info=True)

        import asyncio
        try:
            asyncio.run(
                _persist_pysr_history(
                    statut="FAILED",
                    equation=None,
                    r2_score=None,
                    complexity=None,
                    error_message=str(exc),
                    resolved_site_code=None,
                    resolved_cluster_id=None,
                    resolved_genetique=str(genetique).strip().lower() if genetique else None,
                    candidate_curve_json=None,
                    candidate_metrics_json=None,
                )
            )
        except Exception:
            # Ne pas masquer l'erreur initiale si l'écriture de l'historique échoue
            pass

        # Cas attendu: pas assez de données → ne pas retry en boucle
        msg = str(exc)
        if "Pas assez de données" in msg:
            # Important: si on return un dict ici, Celery marquera la tâche SUCCESS.
            # Or on a persisté un FAILED en DB → incohérence côté UI. On laisse échouer sans retry.
            raise

        # Retry avec backoff exponentiel
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@celery_app.task(bind=True, max_retries=1, time_limit=3600)
def train_pysr_multi_async(
    self,
    genetiques: list[str] | None = None,
    include_sqal_features: bool = False,
    premium_grades: list[str] | None = None,
    require_sqal_premium: bool = True,
    site_codes: list[str] | None = None,
    min_duree_gavage: int | None = None,
    max_duree_gavage: int | None = None,
    seasons: list[str] | None = None,
    cluster_ids: list[int] | None = None,
    foie_min_g: float | None = None,
    foie_max_g: float | None = None,
    foie_target_g: float | None = None,
    foie_weight_range: float | None = None,
    foie_weight_target: float | None = None,
) -> Dict[str, Any]:
    """Entraîne PySR sur *toutes* les génétiques disponibles après application des filtres."""
    try:
        import time
        started_ts = time.time()
        logger.info(
            "🔬 Starting PySR multi training "
            f"(site_codes={site_codes}, seasons={seasons}, cluster_ids={cluster_ids}, premium={require_sqal_premium})"
        )

        import asyncio

        from app.ml.symbolic_regression import train_pysr_model

        async def _ensure_pysr_training_history_table(conn: asyncpg.Connection) -> None:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS pysr_training_history (
                    id SERIAL PRIMARY KEY,
                    task_id TEXT,
                    lot_id INTEGER,
                    gaveur_id INTEGER,
                    site_code VARCHAR(2),
                    genetique TEXT,
                    cluster_id INTEGER,
                    statut VARCHAR(20) NOT NULL,
                    best_equation TEXT,
                    r2_score DOUBLE PRECISION,
                    mae DOUBLE PRECISION,
                    complexity INTEGER,
                    duree_secondes INTEGER,
                    error_message TEXT,
                    candidate_curve_json JSONB,
                    candidate_metrics_json JSONB,
                    started_at TIMESTAMPTZ,
                    finished_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS task_id TEXT")
            await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS site_code VARCHAR(2)")
            await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS genetique TEXT")
            await conn.execute("ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS cluster_id INTEGER")
            await conn.execute(
                "ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS candidate_curve_json JSONB"
            )
            await conn.execute(
                "ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS candidate_metrics_json JSONB"
            )

        async def _persist_multi_history_row(
            *,
            statut: str,
            resolved_site_code: str | None,
            resolved_genetique: str | None,
            resolved_cluster_id: int | None,
            equation: str | None,
            r2_score: float | None,
            complexity: int | None,
            error_message: str | None,
            candidate_curve_json: dict[str, Any] | None = None,
            candidate_metrics_json: dict[str, Any] | None = None,
        ) -> None:
            pool = await asyncpg.create_pool(DATABASE_URL)
            try:
                async with pool.acquire() as conn:
                    await _ensure_pysr_training_history_table(conn)
                    await conn.execute(
                        """
                        INSERT INTO pysr_training_history (
                            task_id,
                            site_code,
                            genetique,
                            cluster_id,
                            statut,
                            best_equation,
                            r2_score,
                            complexity,
                            duree_secondes,
                            error_message,
                            candidate_curve_json,
                            candidate_metrics_json,
                            started_at,
                            finished_at
                        ) VALUES (
                            $1,
                            $2,
                            $3,
                            $4,
                            $5,
                            $6,
                            $7,
                            $8,
                            $9,
                            $10,
                            $11::jsonb,
                            $12::jsonb,
                            to_timestamp($13),
                            to_timestamp($14)
                        )
                        """,
                        str(getattr(self.request, "id", "")) or None,
                        (str(resolved_site_code).strip().upper() if resolved_site_code else None),
                        (str(resolved_genetique).strip().lower() if resolved_genetique else None),
                        (int(resolved_cluster_id) if resolved_cluster_id is not None else None),
                        str(statut).upper(),
                        (str(equation) if equation else None),
                        (float(r2_score) if r2_score is not None else None),
                        (int(complexity) if complexity is not None else None),
                        int(max(0, round(time.time() - started_ts))),
                        (str(error_message) if error_message else None),
                        (json.dumps(candidate_curve_json) if candidate_curve_json is not None else None),
                        (json.dumps(candidate_metrics_json) if candidate_metrics_json is not None else None),
                        float(started_ts),
                        float(time.time()),
                    )
            finally:
                await pool.close()

        async def _resolve_foie_objective_for_gen(
            *,
            resolved_genetique: str,
            resolved_site_code: str | None,
            override_min: float | None,
            override_max: float | None,
            override_target: float | None,
            override_w_range: float | None,
            override_w_target: float | None,
        ) -> tuple[float, float, float, float, float]:
            default_min = 400.0
            default_max = 700.0
            default_target = 550.0
            default_w_range = 0.5
            default_w_target = 0.5

            pool = await asyncpg.create_pool(DATABASE_URL)
            try:
                async with pool.acquire() as conn:
                    row = await conn.fetchrow(
                        """
                        SELECT *
                        FROM foie_objective_policies
                        WHERE genetique = $1
                          AND is_active = TRUE
                          AND valid_from <= NOW()
                          AND (valid_to IS NULL OR valid_to > NOW())
                          AND ($2::varchar IS NULL OR site_code IS NULL OR site_code = $2)
                          AND lot_cluster_pred_id IS NULL
                        ORDER BY
                          (site_code IS NOT NULL AND site_code = $2) DESC,
                          created_at DESC
                        LIMIT 1
                        """,
                        str(resolved_genetique).strip().lower(),
                        (str(resolved_site_code).strip().upper() if resolved_site_code else None),
                    )
            finally:
                await pool.close()

            if row:
                p_min = float(row["foie_min_g"])
                p_max = float(row["foie_max_g"])
                p_target = float(row["foie_target_g"])
                p_w_range = float(row["weight_range"])
                p_w_target = float(row["weight_target"])
            else:
                p_min = default_min
                p_max = default_max
                p_target = default_target
                p_w_range = default_w_range
                p_w_target = default_w_target

            return (
                float(override_min if override_min is not None else p_min),
                float(override_max if override_max is not None else p_max),
                float(override_target if override_target is not None else p_target),
                float(override_w_range if override_w_range is not None else p_w_range),
                float(override_w_target if override_w_target is not None else p_w_target),
            )
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
            # Persister un run "FAILED" (sinon Celery peut finir SUCCESS mais l'UI ne verra rien en DB)
            resolved_site_code_for_history: str | None = None
            if site_codes and len(site_codes) == 1:
                resolved_site_code_for_history = str(site_codes[0]).strip().upper()

            persisted_cluster_id_for_history: int | None = None
            if cluster_ids and len(cluster_ids) == 1:
                try:
                    persisted_cluster_id_for_history = int(cluster_ids[0])
                except Exception:
                    persisted_cluster_id_for_history = None

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

            try:
                asyncio.run(
                    _persist_multi_history_row(
                        statut="FAILED",
                        resolved_site_code=resolved_site_code_for_history,
                        resolved_genetique=None,
                        resolved_cluster_id=persisted_cluster_id_for_history,
                        equation=None,
                        r2_score=None,
                        complexity=None,
                        error_message=(
                            "Aucune génétique trouvée avec ces filtres | "
                            f"site_codes={site_codes} cluster_ids={cluster_ids} seasons={seasons} "
                            f"premium={require_sqal_premium} diagnostics={diagnostics}"
                        ),
                    )
                )
                logger.info(
                    "PySR multi persisted FAILED history row (no genetiques) task_id=%s",
                    str(getattr(self.request, "id", "")),
                )
            except Exception:
                logger.exception(
                    "PySR multi failed to persist history row (no genetiques) task_id=%s",
                    str(getattr(self.request, "id", "")),
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
        resolved_site_code: str | None = None
        if site_codes and len(site_codes) == 1:
            resolved_site_code = str(site_codes[0]).strip().upper()

        persisted_cluster_id: int | None = None
        if cluster_ids and len(cluster_ids) == 1:
            try:
                persisted_cluster_id = int(cluster_ids[0])
            except Exception:
                persisted_cluster_id = None

        async def _dataset_stats_for_gen(resolved_gen: str) -> dict[str, Any]:
            pool = await asyncpg.create_pool(DATABASE_URL)
            try:
                async with pool.acquire() as conn:
                    rows = await _fetch_lot_level_dataset(
                        conn=conn,
                        site_codes=site_codes,
                        genetique=resolved_gen,
                        min_duree_gavage=min_duree_gavage,
                        max_duree_gavage=max_duree_gavage,
                        limit_lots=None,
                    )
            finally:
                await pool.close()

            counts = {
                "A": 0,
                "B": 0,
                "C_D": 0,
                "missing": 0,
            }

            for r in rows:
                grade = (str(r.get("sqal_grade_last") or "").strip().upper())
                if grade in ("A+", "A"):
                    counts["A"] += 1
                elif grade == "B":
                    counts["B"] += 1
                elif grade in ("C", "REJECT"):
                    counts["C_D"] += 1
                else:
                    counts["missing"] += 1

            return {
                "n_lots": int(len(rows)),
                "sqal_gate_counts": counts,
            }

        def _empty_candidates_payload(*, gate_counts: dict[str, int] | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
            resolved_counts = gate_counts or {"A": 0, "B": 0, "C_D": 0, "missing": 0}
            curves = {
                "by_gate": {
                    "A": {"jours": []},
                    "B": {"jours": []},
                    "C_D": {"jours": []},
                },
                "default_gate": "A",
            }
            metrics = {
                "by_gate": {
                    "A": {"n_lots": int(resolved_counts.get("A", 0)), "metrics": {"n_jours": 0}},
                    "B": {"n_lots": int(resolved_counts.get("B", 0)), "metrics": {"n_jours": 0}},
                    "C_D": {"n_lots": int(resolved_counts.get("C_D", 0)), "metrics": {"n_jours": 0}},
                }
            }
            return curves, metrics

        for g in genetiques:
            try:
                ds_stats = asyncio.run(_dataset_stats_for_gen(str(g).strip().lower()))
                logger.info(
                    "PySR lot-level dataset stats genetique=%s n_lots=%s gates=%s",
                    str(g),
                    ds_stats.get("n_lots"),
                    ds_stats.get("sqal_gate_counts"),
                )

                (resolved_foie_min,
                 resolved_foie_max,
                 resolved_foie_target,
                 resolved_w_range,
                 resolved_w_target,) = asyncio.run(
                    _resolve_foie_objective_for_gen(
                        resolved_genetique=str(g).strip().lower(),
                        resolved_site_code=resolved_site_code,
                        override_min=foie_min_g,
                        override_max=foie_max_g,
                        override_target=foie_target_g,
                        override_w_range=foie_weight_range,
                        override_w_target=foie_weight_target,
                    )
                )

                resolved_foie_objective = {
                    "foie_min_g": float(resolved_foie_min),
                    "foie_max_g": float(resolved_foie_max),
                    "foie_target_g": float(resolved_foie_target),
                    "foie_weight_range": float(resolved_w_range),
                    "foie_weight_target": float(resolved_w_target),
                }

                res = train_pysr_model(
                    lot_id=None,
                    genetique=g,
                    include_sqal_features=include_sqal_features,
                    premium_grades=premium_grades,
                    require_sqal_premium=require_sqal_premium,
                    site_codes=site_codes,
                    min_duree_gavage=min_duree_gavage,
                    max_duree_gavage=max_duree_gavage,
                    seasons=seasons,
                    cluster_ids=cluster_ids,
                    foie_min_g=float(resolved_foie_min),
                    foie_max_g=float(resolved_foie_max),
                    foie_target_g=float(resolved_foie_target),
                    foie_weight_range=float(resolved_w_range),
                    foie_weight_target=float(resolved_w_target),
                )

                # Build candidates curves by SQAL gate (same structure as single-run history).
                candidate_curve_json = None
                candidate_metrics_json = None
                try:
                    async def _load_rows_for_candidates() -> list[dict[str, Any]]:
                        pool = await asyncpg.create_pool(DATABASE_URL)
                        try:
                            async with pool.acquire() as conn:
                                return await _fetch_lot_level_dataset(
                                    conn=conn,
                                    site_codes=site_codes,
                                    genetique=str(g).strip().lower(),
                                    min_duree_gavage=min_duree_gavage,
                                    max_duree_gavage=max_duree_gavage,
                                    limit_lots=2000,
                                )
                        finally:
                            await pool.close()

                    rows_for_candidates = asyncio.run(_load_rows_for_candidates())
                    if rows_for_candidates:
                        candidate_curve_json, candidate_metrics_json = _build_candidate_curves_by_gate(rows_for_candidates)
                        candidate_curve_json["default_gate"] = "A"
                    else:
                        candidate_curve_json, candidate_metrics_json = _empty_candidates_payload(
                            gate_counts=(ds_stats or {}).get("sqal_gate_counts")
                        )
                except Exception as curve_err:
                    logger.warning(
                        "PySR multi failed to build candidate curves by gate genetique=%s err=%s",
                        str(g),
                        str(curve_err),
                    )
                    candidate_curve_json, candidate_metrics_json = _empty_candidates_payload(
                        gate_counts=(ds_stats or {}).get("sqal_gate_counts")
                    )

                # Persister aussi les métriques de winsorisation (Option C) si présentes dans le résultat.
                try:
                    w = res.get("winsorization") if isinstance(res, dict) else None
                    if w is not None:
                        if candidate_metrics_json is None:
                            candidate_metrics_json = {}
                        if isinstance(candidate_metrics_json, dict):
                            candidate_metrics_json["winsorization"] = w
                except Exception:
                    pass

                try:
                    asyncio.run(
                        _persist_multi_history_row(
                            statut="SUCCESS",
                            resolved_site_code=resolved_site_code,
                            resolved_genetique=str(g).strip().lower() if g else None,
                            resolved_cluster_id=persisted_cluster_id,
                            equation=res.get("formula"),
                            r2_score=res.get("r2_score"),
                            complexity=res.get("complexity"),
                            error_message=None,
                            candidate_curve_json=candidate_curve_json,
                            candidate_metrics_json=candidate_metrics_json,
                        )
                    )
                except Exception:
                    logger.exception(
                        "PySR multi failed to persist SUCCESS history row task_id=%s genetique=%s",
                        str(getattr(self.request, "id", "")),
                        str(g),
                    )
                results[str(g)] = {
                    "status": res.get("status", "success"),
                    "genetique": g,
                    "formula": res.get("formula", ""),
                    "r2_score": res.get("r2_score", 0.0),
                    "n_samples": res.get("n_samples", 0),
                    "dataset": ds_stats,
                    "foie_objective": resolved_foie_objective,
                }
            except Exception as exc:
                # Try to still persist candidate curves for debugging/publishing if we can build them.
                candidate_curve_json = None
                candidate_metrics_json = None
                try:
                    async def _load_rows_for_candidates_failed() -> list[dict[str, Any]]:
                        pool = await asyncpg.create_pool(DATABASE_URL)
                        try:
                            async with pool.acquire() as conn:
                                return await _fetch_lot_level_dataset(
                                    conn=conn,
                                    site_codes=site_codes,
                                    genetique=str(g).strip().lower(),
                                    min_duree_gavage=min_duree_gavage,
                                    max_duree_gavage=max_duree_gavage,
                                    limit_lots=2000,
                                )
                        finally:
                            await pool.close()

                    rows_for_candidates = asyncio.run(_load_rows_for_candidates_failed())
                    if rows_for_candidates:
                        candidate_curve_json, candidate_metrics_json = _build_candidate_curves_by_gate(rows_for_candidates)
                        candidate_curve_json["default_gate"] = "A"
                    else:
                        candidate_curve_json, candidate_metrics_json = _empty_candidates_payload()
                except Exception:
                    candidate_curve_json, candidate_metrics_json = _empty_candidates_payload()

                try:
                    asyncio.run(
                        _persist_multi_history_row(
                            statut="FAILED",
                            resolved_site_code=resolved_site_code,
                            resolved_genetique=str(g).strip().lower() if g else None,
                            resolved_cluster_id=persisted_cluster_id,
                            equation=None,
                            r2_score=None,
                            complexity=None,
                            error_message=str(exc),
                            candidate_curve_json=candidate_curve_json,
                            candidate_metrics_json=candidate_metrics_json,
                        )
                    )
                except Exception:
                    logger.exception(
                        "PySR multi failed to persist FAILED history row task_id=%s genetique=%s",
                        str(getattr(self.request, "id", "")),
                        str(g),
                    )
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

    Analyse corrélations: paramètres gavage -> satisfaction consommateurs
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
                        params,
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


@celery_app.task(time_limit=300)
def cluster_lots_refined_j4_async(
    n_clusters: int = 3,
    random_state: int = 42,
    n_init: int = 10,
    min_lots: int = 20,
    min_days: int = 2,
    site_codes: list[str] | None = None,
    genetique: str | None = None,
    modele_version: str = "lot_refined_j4_kmeans_v1",
) -> Dict[str, Any]:
    """Clustering phase B (lot_refined_j4) sur features J1..J4 pour piloter la transition courbe."""
    try:
        logger.info(
            "📦 Starting lot_refined_j4 clustering "
            f"(k={n_clusters}, site_codes={site_codes}, genetique={genetique}, min_days={min_days})"
        )

        from datetime import datetime
        import asyncio

        from app.ml.euralis.lot_clustering import cluster_lots_refined_j4

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
                        "min_days": min_days,
                        "site_codes": site_codes,
                        "genetique": genetique,
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
                        "lot_refined_j4",
                        str(result.get("modele_version") or modele_version),
                        params,
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

        result = cluster_lots_refined_j4(
            n_clusters=n_clusters,
            random_state=random_state,
            n_init=n_init,
            min_lots=min_lots,
            min_days=min_days,
            site_codes=site_codes,
            genetique=genetique,
            modele_version=modele_version,
        )

        if result.get("status") != "success":
            return result

        run_id = asyncio.run(_persist(result))
        result["run_id"] = run_id

        logger.info(
            "✅ lot_refined_j4 clustering completed "
            f"(run_id={run_id}, n_lots={result.get('n_lots')}, k={result.get('n_clusters')})"
        )
        return result

    except Exception as exc:
        logger.error(f"❌ lot_refined_j4 clustering failed: {exc}", exc_info=True)
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
