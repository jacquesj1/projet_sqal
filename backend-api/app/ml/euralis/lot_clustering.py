import os
from typing import Any, Dict, List, Optional, Tuple

import asyncpg
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


_DEFAULT_DB_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db"


def _allowed_feature_specs() -> Dict[str, str]:
    return {
        "itm": "COALESCE(lg.itm, 0)::double precision",
        "sigma": "COALESCE(lg.sigma, 0)::double precision",
        "pctg_perte_gavage": "COALESCE(lg.pctg_perte_gavage, 0)::double precision",
        "total_corn_real": "COALESCE(lg.total_corn_real, 0)::double precision",
        "nb_meg": "COALESCE(lg.nb_meg, 0)::double precision",
        "duree_gavage": "COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc, 0)::double precision",
        "poids_foie_moyen_g": "COALESCE(lg.poids_foie_moyen_g, 0)::double precision",
    }


def _normalize_features(features: Optional[List[str]]) -> List[str]:
    default_features = [
        "itm",
        "sigma",
        "pctg_perte_gavage",
        "total_corn_real",
        "nb_meg",
        "duree_gavage",
    ]
    if not features:
        return default_features

    cleaned = []
    for f in features:
        key = str(f).strip()
        if not key:
            continue
        cleaned.append(key)

    return cleaned or default_features


def _confidence_from_distances(dists: np.ndarray) -> np.ndarray:
    inv = 1.0 / (1.0 + np.maximum(dists, 0.0))
    denom = np.sum(inv, axis=1, keepdims=True)
    denom = np.where(denom == 0, 1.0, denom)
    probs = inv / denom
    return np.max(probs, axis=1)


def cluster_lots_pred(
    *,
    n_clusters: int = 3,
    random_state: int = 42,
    n_init: int = 10,
    min_lots: int = 20,
    site_codes: Optional[List[str]] = None,
    genetique: Optional[str] = None,
    seasons: Optional[List[str]] = None,
    min_duree_gavage: Optional[int] = None,
    max_duree_gavage: Optional[int] = None,
    features: Optional[List[str]] = None,
    modele_version: str = "lot_pred_kmeans_v1",
) -> Dict[str, Any]:
    async def _run() -> Dict[str, Any]:
        database_url = os.getenv("DATABASE_URL", _DEFAULT_DB_URL)
        pool = await asyncpg.create_pool(database_url)
        try:
            feats = _normalize_features(features)
            allowed = _allowed_feature_specs()
            invalid = [f for f in feats if f not in allowed]
            if invalid:
                return {
                    "status": "error",
                    "error": f"Invalid features: {invalid}. Allowed: {sorted(list(allowed.keys()))}",
                }

            select_exprs = [
                "lg.id AS lot_id",
                "LOWER(lg.genetique) AS genetique",
                "lg.site_code AS site_code",
            ]
            for f in feats:
                select_exprs.append(f"{allowed[f]} AS {f}")

            where_clauses: List[str] = [
                "lg.id IS NOT NULL",
                "lg.genetique IS NOT NULL",
                "TRIM(lg.genetique) <> ''",
            ]

            params: List[object] = []
            param_idx = 1

            if site_codes:
                where_clauses.append(f"lg.site_code = ANY(${param_idx})")
                params.append([str(x).strip().upper() for x in site_codes if str(x).strip()])
                param_idx += 1

            if genetique:
                where_clauses.append(f"LOWER(lg.genetique) = LOWER(${param_idx})")
                params.append(str(genetique).strip().lower())
                param_idx += 1

            if seasons:
                where_clauses.append(f"LOWER(lg.saison) = ANY(${param_idx})")
                params.append([str(x).strip().lower() for x in seasons if str(x).strip()])
                param_idx += 1

            if min_duree_gavage is not None:
                where_clauses.append(f"COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc) >= ${param_idx}")
                params.append(int(min_duree_gavage))
                param_idx += 1

            if max_duree_gavage is not None:
                where_clauses.append(f"COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc) <= ${param_idx}")
                params.append(int(max_duree_gavage))
                param_idx += 1

            query = f"""
                WITH lot_duree AS (
                    SELECT lot_gavage_id, MAX(jour_gavage) AS duree_gavage_calc
                    FROM gavage_data_lots
                    GROUP BY lot_gavage_id
                )
                SELECT
                    {", ".join(select_exprs)}
                FROM lots_gavage lg
                LEFT JOIN lot_duree d ON d.lot_gavage_id = lg.id
                WHERE {" AND ".join(where_clauses)}
            """

            rows = await pool.fetch(query, *params)
            df = pd.DataFrame([dict(r) for r in rows])

            if df.empty:
                return {
                    "status": "error",
                    "error": "No lots found with these filters",
                    "n_lots": 0,
                }

            if len(df) < int(min_lots):
                return {
                    "status": "error",
                    "error": f"Not enough lots for clustering: {len(df)} < {int(min_lots)}",
                    "n_lots": int(len(df)),
                }

            X = df[feats].apply(pd.to_numeric, errors="coerce").fillna(0.0).values

            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            k = min(int(n_clusters), len(df))
            if k < 2:
                return {
                    "status": "error",
                    "error": "Need at least 2 lots to cluster",
                    "n_lots": int(len(df)),
                }

            kmeans = KMeans(n_clusters=k, random_state=int(random_state), n_init=int(n_init))
            cluster_ids = kmeans.fit_predict(X_scaled)

            dists = kmeans.transform(X_scaled)
            confidence = _confidence_from_distances(dists)

            df_out = df[["lot_id", "genetique", "site_code"]].copy()
            df_out["cluster_id"] = cluster_ids.astype(int)
            df_out["confidence"] = confidence.astype(float)

            return {
                "status": "success",
                "modele_version": str(modele_version),
                "n_clusters": int(k),
                "n_lots": int(len(df_out)),
                "features": feats,
                "assignments": df_out,
            }
        finally:
            await pool.close()

    import asyncio

    res = asyncio.run(_run())

    if res.get("status") != "success":
        return res


def cluster_lots_refined_j4(
    *,
    n_clusters: int = 3,
    random_state: int = 42,
    n_init: int = 10,
    min_lots: int = 20,
    min_days: int = 2,
    site_codes: Optional[List[str]] = None,
    genetique: Optional[str] = None,
    modele_version: str = "lot_refined_j4_kmeans_v1",
) -> Dict[str, Any]:
    async def _run() -> Dict[str, Any]:
        database_url = os.getenv("DATABASE_URL", _DEFAULT_DB_URL)
        pool = await asyncpg.create_pool(database_url)
        try:
            where_clauses: List[str] = [
                "lg.id IS NOT NULL",
                "lg.genetique IS NOT NULL",
                "TRIM(lg.genetique) <> ''",
            ]

            params: List[object] = []
            param_idx = 1

            if site_codes:
                where_clauses.append(f"lg.site_code = ANY(${param_idx})")
                params.append([str(x).strip().upper() for x in site_codes if str(x).strip()])
                param_idx += 1

            if genetique:
                where_clauses.append(f"LOWER(lg.genetique) = LOWER(${param_idx})")
                params.append(str(genetique).strip().lower())
                param_idx += 1

            # Features F4: doses J1..J4 + deltas vs theoretical + cumul delta
            query = f"""
                SELECT
                    lg.id AS lot_id,
                    LOWER(lg.genetique) AS genetique,
                    lg.site_code AS site_code,
                    COUNT(*) FILTER (WHERE crq.jour_gavage BETWEEN 1 AND 4) AS n_days,

                    COALESCE(MAX(crq.dose_reelle_g) FILTER (WHERE crq.jour_gavage = 1), 0)::double precision AS dose_reelle_j1,
                    COALESCE(MAX(crq.dose_reelle_g) FILTER (WHERE crq.jour_gavage = 2), 0)::double precision AS dose_reelle_j2,
                    COALESCE(MAX(crq.dose_reelle_g) FILTER (WHERE crq.jour_gavage = 3), 0)::double precision AS dose_reelle_j3,
                    COALESCE(MAX(crq.dose_reelle_g) FILTER (WHERE crq.jour_gavage = 4), 0)::double precision AS dose_reelle_j4,

                    COALESCE(MAX(crq.dose_reelle_g - crq.dose_theorique_g) FILTER (WHERE crq.jour_gavage = 1), 0)::double precision AS delta_j1,
                    COALESCE(MAX(crq.dose_reelle_g - crq.dose_theorique_g) FILTER (WHERE crq.jour_gavage = 2), 0)::double precision AS delta_j2,
                    COALESCE(MAX(crq.dose_reelle_g - crq.dose_theorique_g) FILTER (WHERE crq.jour_gavage = 3), 0)::double precision AS delta_j3,
                    COALESCE(MAX(crq.dose_reelle_g - crq.dose_theorique_g) FILTER (WHERE crq.jour_gavage = 4), 0)::double precision AS delta_j4,

                    COALESCE(SUM(crq.dose_reelle_g - crq.dose_theorique_g) FILTER (WHERE crq.jour_gavage BETWEEN 1 AND 4), 0)::double precision AS delta_cum_j4,
                    COALESCE(AVG(ABS(crq.dose_reelle_g - crq.dose_theorique_g)) FILTER (WHERE crq.jour_gavage BETWEEN 1 AND 4), 0)::double precision AS delta_abs_mean_j4
                FROM lots_gavage lg
                JOIN courbe_reelle_quotidienne crq ON crq.lot_id = lg.id
                WHERE
                    crq.jour_gavage BETWEEN 1 AND 4
                    AND crq.dose_reelle_g IS NOT NULL
                    AND crq.dose_theorique_g IS NOT NULL
                    AND {" AND ".join(where_clauses)}
                GROUP BY lg.id, LOWER(lg.genetique), lg.site_code
                HAVING COUNT(*) FILTER (WHERE crq.jour_gavage BETWEEN 1 AND 4) >= {int(min_days)}
            """

            rows = await pool.fetch(query, *params)
            df = pd.DataFrame([dict(r) for r in rows])

            if df.empty:
                return {
                    "status": "error",
                    "error": "No lots found with these filters",
                    "n_lots": 0,
                }

            if len(df) < int(min_lots):
                return {
                    "status": "error",
                    "error": f"Not enough lots for clustering: {len(df)} < {int(min_lots)}",
                    "n_lots": int(len(df)),
                }

            feats = [
                "dose_reelle_j1",
                "dose_reelle_j2",
                "dose_reelle_j3",
                "dose_reelle_j4",
                "delta_j1",
                "delta_j2",
                "delta_j3",
                "delta_j4",
                "delta_cum_j4",
                "delta_abs_mean_j4",
            ]

            X = df[feats].apply(pd.to_numeric, errors="coerce").fillna(0.0).values
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            k = min(int(n_clusters), len(df))
            if k < 2:
                return {
                    "status": "error",
                    "error": "Need at least 2 lots to cluster",
                    "n_lots": int(len(df)),
                }

            kmeans = KMeans(n_clusters=k, random_state=int(random_state), n_init=int(n_init))
            cluster_ids = kmeans.fit_predict(X_scaled)

            dists = kmeans.transform(X_scaled)
            confidence = _confidence_from_distances(dists)

            df_out = df[["lot_id", "genetique", "site_code"]].copy()
            df_out["cluster_id"] = cluster_ids.astype(int)
            df_out["confidence"] = confidence.astype(float)

            return {
                "status": "success",
                "modele_version": str(modele_version),
                "n_clusters": int(k),
                "n_lots": int(len(df_out)),
                "features": feats,
                "assignments": df_out,
            }
        finally:
            await pool.close()

    import asyncio

    res = asyncio.run(_run())

    if res.get("status") != "success":
        return res

    assignments_df: pd.DataFrame = res["assignments"]
    counts = assignments_df["cluster_id"].value_counts().to_dict()
    res["clusters"] = {int(k): int(v) for k, v in counts.items()}
    res["avg_confidence"] = float(assignments_df["confidence"].mean()) if len(assignments_df) else 0.0
    res["assignments"] = assignments_df.to_dict(orient="records")

    return res
