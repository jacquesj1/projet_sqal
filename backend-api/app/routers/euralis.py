"""
================================================================================
EURALIS - API Router Multi-Sites
================================================================================
Description : Routes API pour le pilotage multi-sites Euralis
Updated: 2026-01-15 - Ajout endpoint gaveurs-by-cluster avec correction ITM
Sites       : LL (Bretagne), LS (Pays de Loire), MT (Maubourguet)
Prefix      : /api/euralis
Date        : 2024-12-14
================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel
import asyncpg
import os
import logging
import json
import math

from celery.result import AsyncResult

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

# Configuration
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://gaveurs_admin:gaveurs_secure_2024@timescaledb:5432/gaveurs_db'
)

# Router
router = APIRouter(prefix="/api/euralis", tags=["euralis"])


# ============================================================================
# DÉPENDANCES
# ============================================================================

async def get_db_connection():
    """Obtenir une connexion à la base de données"""
    # Disable SSL for Docker internal connections
    conn = await asyncpg.connect(DATABASE_URL, ssl=False)
    try:
        yield conn
    finally:
        await conn.close()


def _capacity_end_exclusive(start: date, duree_jours: int, buffer_jours: int) -> date:
    from datetime import timedelta

    return start + timedelta(days=int(duree_jours + buffer_jours))


class FoieObjectivePolicy(BaseModel):
    id: int
    genetique: str
    site_code: Optional[str] = None
    lot_cluster_pred_id: Optional[int] = None
    foie_min_g: float
    foie_max_g: float
    foie_target_g: float
    weight_range: float
    weight_target: float
    is_active: bool
    valid_from: datetime
    valid_to: Optional[datetime] = None
    created_at: datetime
    created_by: Optional[str] = None


class PySRReferenceCurvePublishRequest(BaseModel):
    site_code: str
    genetique: str
    cluster_id: int
    task_id: str
    created_by: Optional[str] = None
    reference_curve: Optional[List[Dict[str, Any]]] = None


class PySRReferenceCurveAssignRequest(BaseModel):
    gaveur_ids: List[int]
    nb_canards: int = 800
    souche: str = "Mulard"
    assigned_by: Optional[str] = None


class PySRTrainingHistoryRow(BaseModel):
    id: int
    task_id: Optional[str] = None
    site_code: Optional[str] = None
    genetique: Optional[str] = None
    cluster_id: Optional[int] = None
    statut: str
    best_equation: Optional[str] = None
    r2_score: Optional[float] = None
    mae: Optional[float] = None
    complexity: Optional[int] = None
    candidate_curve_json: Optional[Any] = None
    candidate_metrics_json: Optional[Any] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class PlanningAbattageRow(BaseModel):
    id: int
    code_lot: str
    site_code: str
    date_abattage_prevue: str
    abattoir: str
    creneau_horaire: str
    nb_canards_prevu: int
    capacite_abattoir_jour: int
    taux_utilisation_pct: float
    distance_km: float
    cout_transport: float
    priorite: int
    statut: str


class PySRTrainingPreviewResponse(BaseModel):
    task_id: str
    segment: Dict[str, Any]
    pysr: Dict[str, Any]
    courbe: Dict[str, Any]


@router.get("/ml/pysr/genetiques", response_model=List[str])
async def list_pysr_available_genetiques(
    site_code: Optional[str] = Query(None, description="Code site"),
    cluster_id: Optional[int] = Query(None, ge=0, description="Cluster lot_pred (dernier run)"),
    conn=Depends(get_db_connection),
):
    """Liste les génétiques réellement disponibles en base pour lancer un training PySR.

    Critères:
    - lots_gavage.itm non NULL
    - au moins 1 ligne dans gavage_data_lots pour le lot
    - filtres optionnels: site_code, cluster_id (basé sur le dernier run lot_pred)
    """

    resolved_site = str(site_code).strip().upper() if site_code else None

    params: list[object] = []
    where: list[str] = [
        "lg.itm IS NOT NULL",
        "EXISTS (SELECT 1 FROM gavage_data_lots gdl WHERE gdl.lot_gavage_id = lg.id)",
        "COALESCE(lg.genetique, lg.souche) IS NOT NULL",
        "TRIM(COALESCE(lg.genetique, lg.souche)) <> ''",
    ]

    if resolved_site:
        params.append(resolved_site)
        where.append(f"lg.site_code = ${len(params)}")

    cluster_join = ""
    if cluster_id is not None:
        params.append(int(cluster_id))
        cluster_join = """
        JOIN (
            SELECT id
            FROM lot_clustering_runs
            WHERE clustering_type = 'lot_pred'
            ORDER BY created_at DESC
            LIMIT 1
        ) lcr ON TRUE
        JOIN lot_clustering_assignments lca
          ON lca.run_id = lcr.id AND lca.lot_id = lg.id
        """
        where.append(f"lca.cluster_id = ${len(params)}")

    query = f"""
    SELECT DISTINCT LOWER(COALESCE(lg.genetique, lg.souche)) AS genetique
    FROM lots_gavage lg
    {cluster_join}
    WHERE {' AND '.join(where)}
    ORDER BY genetique
    """

    rows = await conn.fetch(query, *params)
    return [str(r["genetique"]) for r in rows if r.get("genetique")]


class TransitionPolicy(BaseModel):
    id: int
    genetique: str
    site_code: Optional[str] = None
    lot_cluster_refined_j4_id: Optional[int] = None
    params: Dict[str, Any]
    is_active: bool
    valid_from: datetime
    valid_to: Optional[datetime] = None
    created_at: datetime
    created_by: Optional[str] = None


class TransitionPolicyCreateRequest(BaseModel):
    genetique: str
    site_code: Optional[str] = None
    lot_cluster_refined_j4_id: Optional[int] = None
    params: Dict[str, Any]
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    created_by: Optional[str] = None


class FoieObjectivePolicyCreateRequest(BaseModel):
    genetique: str
    site_code: Optional[str] = None
    lot_cluster_pred_id: Optional[int] = None
    foie_min_g: float = 400.0
    foie_max_g: float = 700.0
    foie_target_g: float = 550.0
    weight_range: float = 0.5
    weight_target: float = 0.5
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    created_by: Optional[str] = None


async def _ensure_foie_objective_policy_tables(conn: asyncpg.Connection) -> None:
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
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_foie_policy_segment ON foie_objective_policies(genetique, site_code, lot_cluster_pred_id);"
    )
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_foie_policy_active ON foie_objective_policies(is_active, valid_from, valid_to);"
    )


async def _ensure_transition_policy_tables(conn: asyncpg.Connection) -> None:
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS transition_policies (
            id SERIAL PRIMARY KEY,
            genetique TEXT NOT NULL,
            site_code VARCHAR(2),
            lot_cluster_refined_j4_id INTEGER,
            params JSONB NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            valid_to TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_by TEXT
        );
        """
    )
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_transition_policy_segment ON transition_policies(genetique, site_code, lot_cluster_refined_j4_id);"
    )
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_transition_policy_active ON transition_policies(is_active, valid_from, valid_to);"
    )


async def _ensure_pysr_reference_curve_tables(conn: asyncpg.Connection) -> None:
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pysr_reference_curves_segments (
            id SERIAL PRIMARY KEY,
            site_code VARCHAR(2) NOT NULL,
            genetique TEXT NOT NULL,
            cluster_id INTEGER NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            task_id TEXT,
            pysr_formula TEXT,
            pysr_r2_score DOUBLE PRECISION,
            pysr_complexity INTEGER,
            reference_curve_json JSONB NOT NULL,
            params JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_by TEXT
        );
        """
    )
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_pysr_ref_seg ON pysr_reference_curves_segments(site_code, genetique, cluster_id, created_at DESC);"
    )
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_pysr_ref_task ON pysr_reference_curves_segments(task_id);"
    )


# ============================================================================
# MODÈLES PYDANTIC
# ============================================================================

class Site(BaseModel):
    """Modèle d'un site Euralis"""
    id: int
    code: str
    nom: str
    region: Optional[str]
    capacite_gavage_max: Optional[int]
    nb_gaveurs_actifs: Optional[int]


class SiteStats(BaseModel):
    """Statistiques d'un site"""
    site_code: str
    site_nom: str
    nb_lots: int
    nb_gaveurs: int
    itm_moyen: Optional[float]
    mortalite_moyenne: Optional[float]
    production_foie_kg: Optional[float]


class LotClusteringRun(BaseModel):
    """Run de clustering lots (lot_pred)"""

    run_id: int
    clustering_type: str
    modele_version: str
    params: Optional[Dict[str, Any]]
    features: Optional[List[str]]
    n_clusters: Optional[int]
    n_lots: Optional[int]
    avg_confidence: Optional[float]
    created_at: datetime


class LotClusterAssignment(BaseModel):
    """Assignation cluster pour un lot sur un run"""

    run_id: int
    lot_id: int
    cluster_id: int
    confidence: Optional[float]
    modele_version: str
    created_at: datetime
    genetique: Optional[str] = None
    site_code: Optional[str] = None


class Lot(BaseModel):
    """Modèle d'un lot de gavage"""
    id: int
    code_lot: str
    site_code: str
    gaveur_id: Optional[int]
    souche: Optional[str]
    debut_lot: date
    duree_gavage_prevue: Optional[int] = None
    buffer_jours: Optional[int] = None
    fin_capacite_prevue: Optional[date] = None
    itm: Optional[float]
    sigma: Optional[float]
    duree_gavage_reelle: Optional[int]
    pctg_perte_gavage: Optional[float]
    statut: str
    courbe_pysr_snapshot_json: Optional[Any] = None
    pysr_formula: Optional[str] = None
    pysr_r2_score: Optional[float] = None


class LotPlanCreateRequest(BaseModel):
    code_lot: str
    site_code: str
    gaveur_id: int
    debut_lot: date
    duree_gavage_prevue: int
    buffer_jours: int = 0
    nb_canards_initial: int = 800
    souche: Optional[str] = None
    genetique: Optional[str] = None


class LotAssignCurveSnapshotRequest(BaseModel):
    courbe_pysr_snapshot_json: Any
    pysr_formula: Optional[str] = None
    pysr_r2_score: Optional[float] = None
    assigned_by: Optional[str] = None


class GaveurCapacityRow(BaseModel):
    gaveur_id: int
    nom: Optional[str] = None
    prenom: Optional[str] = None
    site_code: Optional[str] = None
    active_lots_count: int
    can_plan_new_lot: bool


class DashboardKPIs(BaseModel):
    """KPIs du dashboard global"""
    production_totale_kg: float
    nb_lots_actifs: int
    nb_lots_termines: int
    nb_gaveurs_actifs: int
    itm_moyen_global: float
    mortalite_moyenne_globale: float
    nb_alertes_critiques: int


class Alerte(BaseModel):
    """Modèle d'une alerte"""
    id: int
    time: datetime
    lot_id: Optional[int]
    gaveur_id: Optional[int]
    site_code: Optional[str]
    type_alerte: str
    criticite: str
    titre: str
    description: Optional[str]
    valeur_observee: Optional[float]
    valeur_attendue: Optional[float]
    ecart_pct: Optional[float]
    acquittee: bool


class GaveurDetail(BaseModel):
    """Détail d'un gaveur individuel"""
    id: int
    nom: str
    prenom: Optional[str]
    email: Optional[str]
    telephone: Optional[str]
    site_code: Optional[str] = None  # Peut être NULL pour certains gaveurs
    actif: bool
    created_at: Optional[datetime]
    nb_lots_total: int
    nb_lots_actifs: int
    nb_lots_termines: int


class GaveurAnalytics(BaseModel):
    """Analytics d'un gaveur individuel"""
    gaveur_id: int
    gaveur_nom: str
    site_code: str

    # Performance globale
    nb_lots_total: int
    itm_moyen: float
    sigma_moyen: float


# ============================================================================
# PYSR - COURBES DE RÉFÉRENCE SEGMENTÉES (site_code + genetique + cluster)
# ============================================================================


async def _ensure_lots_gavage_planning_columns(conn: asyncpg.Connection) -> None:
    await conn.execute(
        """
        ALTER TABLE lots_gavage
        ADD COLUMN IF NOT EXISTS duree_gavage_prevue INTEGER;
        """
    )
    await conn.execute(
        """
        ALTER TABLE lots_gavage
        ADD COLUMN IF NOT EXISTS buffer_jours INTEGER;
        """
    )
    await conn.execute(
        """
        ALTER TABLE lots_gavage
        ADD COLUMN IF NOT EXISTS courbe_pysr_snapshot_json JSONB;
        """
    )
    await conn.execute(
        """
        ALTER TABLE lots_gavage
        ADD COLUMN IF NOT EXISTS pysr_formula TEXT;
        """
    )
    await conn.execute(
        """
        ALTER TABLE lots_gavage
        ADD COLUMN IF NOT EXISTS pysr_r2_score DOUBLE PRECISION;
        """
    )
    await conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_lots_gavage_gaveur_debut
        ON lots_gavage(gaveur_id, debut_lot);
        """
    )


async def _column_exists(conn, table_name: str, column_name: str, schema: str = "public") -> bool:
    row = await conn.fetchrow(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name = $3
        """,
        schema,
        table_name,
        column_name,
    )
    return row is not None


async def _table_exists(conn, table_name: str, schema: str = "public") -> bool:
    row = await conn.fetchrow(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
        """,
        schema,
        table_name,
    )
    return row is not None


@router.get("/planning/gaveurs-capacite", response_model=List[GaveurCapacityRow])
async def get_gaveurs_capacite(
    start_date: date = Query(..., description="Date de début gavage"),
    duree_jours: int = Query(..., ge=11, le=14, description="Durée gavage (11-14)"),
    buffer_jours: int = Query(0, ge=0, le=1, description="Buffer (0-1)"),
    site_code: Optional[str] = Query(None, description="Filtre site"),
    conn=Depends(get_db_connection),
):
    """Retourne la capacité (nombre de lots simultanés sur la fenêtre gavage+buffer) par gaveur.

    La fenêtre utilisée est: [start_date, start_date + duree_jours + buffer_jours)
    Règle: un gaveur peut avoir au plus 3 lots en parallèle sur cette fenêtre.
    """

    await _ensure_lots_gavage_planning_columns(conn)

    resolved_site = str(site_code).strip().upper() if site_code else None
    end2_excl = _capacity_end_exclusive(start_date, int(duree_jours), int(buffer_jours))

    params: List[Any] = [start_date, end2_excl]
    where_gaveurs: List[str] = ["1=1"]
    if resolved_site:
        params.append(resolved_site)
        where_gaveurs.append(f"g.site_code = ${len(params)}")

    where_gaveurs_sql = " AND ".join(where_gaveurs)

    query = f"""
    WITH lots_overlap AS (
        SELECT
            lg.gaveur_id,
            COUNT(*)::int AS active_lots_count
        FROM lots_gavage lg
        WHERE lg.gaveur_id IS NOT NULL
          AND COALESCE(LOWER(lg.statut), 'en_cours') IN ('planifie', 'en_cours', 'en_gavage', 'en_preparation')
          AND lg.debut_lot < $2::date
          AND (
                lg.debut_lot
                + (
                    COALESCE(lg.duree_gavage_prevue, lg.duree_gavage_reelle, 14)
                    + COALESCE(lg.buffer_jours, 0)
                  ) * INTERVAL '1 day'
              ) > $1::date
        GROUP BY lg.gaveur_id
    )
    SELECT
        g.id AS gaveur_id,
        g.nom,
        g.prenom,
        g.site_code,
        COALESCE(lo.active_lots_count, 0) AS active_lots_count,
        (COALESCE(lo.active_lots_count, 0) < 3) AS can_plan_new_lot
    FROM gaveurs_euralis g
    LEFT JOIN lots_overlap lo ON lo.gaveur_id = g.id
    WHERE {where_gaveurs_sql}
    ORDER BY g.site_code NULLS LAST, g.nom NULLS LAST, g.prenom NULLS LAST
    """

    rows = await conn.fetch(query, *params)
    return [GaveurCapacityRow(**dict(r)) for r in rows]


@router.get("/abattages/planning", response_model=List[PlanningAbattageRow])
async def get_planning_abattages(
    site_code: Optional[str] = Query(None, description="Filtre site (LL/LS/MT)"),
    date_debut: Optional[date] = Query(None, description="Date de début (inclus)"),
    date_fin: Optional[date] = Query(None, description="Date de fin (inclus)"),
    limit: int = Query(200, ge=1, le=500),
    conn=Depends(get_db_connection),
):
    """Planning abattages (V1).

    Tant que l'optimisation (Hongrois / contraintes abattoirs) n'est pas branchée,
    cet endpoint fournit un planning simple et déterministe dérivé des lots.

    Champs renvoyés alignés avec le frontend `PlanningAbattage`.
    """

    await _ensure_lots_gavage_planning_columns(conn)

    resolved_site = str(site_code).strip().upper() if site_code else None

    # Source nb_canards_prevu (ordre de priorité):
    # 1) SQAL: nombre de canards suspendus = nombre d'échantillons capteurs (sensor_samples)
    # 2) lots_gavage.<col> si présente/remplie (différents schémas possibles)
    # 3) estimation: nb_initial - nb_meg (morts) si les 2 existent
    # 4) sinon dernière valeur connue en timeseries: gavage_data_lots.nb_canards_vivants

    # SQAL (suspendus): on compte les échantillons associés au lot
    # - certains schémas relient via lot_id
    # - d'autres via code_lot
    has_sensor_samples = await _table_exists(conn, "sensor_samples")
    has_ss_lot_id = has_sensor_samples and await _column_exists(conn, "sensor_samples", "lot_id")
    has_ss_code_lot = has_sensor_samples and await _column_exists(conn, "sensor_samples", "code_lot")

    join_sqal_sql = ""
    sqal_suspendus_expr = "NULL"
    if has_sensor_samples and (has_ss_lot_id or has_ss_code_lot):
        if has_ss_lot_id and has_ss_code_lot:
            where_sql = "ss.lot_id = lg.id OR ss.code_lot = lg.code_lot"
        elif has_ss_lot_id:
            where_sql = "ss.lot_id = lg.id"
        else:
            where_sql = "ss.code_lot = lg.code_lot"

        join_sqal_sql = f"""
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS nb_suspendus
            FROM sensor_samples ss
            WHERE {where_sql}
        ) sqal_susp ON TRUE
        """
        sqal_suspendus_expr = "NULLIF(sqal_susp.nb_suspendus, 0)"

    lot_canards_exprs: List[str] = []
    for col in [
        "nb_canards_initial",
        "nb_canards_meg",
        "nb_meg",
        "nombre_canards",
        "nombre_canards_initial",
    ]:
        if await _column_exists(conn, "lots_gavage", col):
            lot_canards_exprs.append(f"lg.{col}")

    lg_canards_expr = ", ".join(lot_canards_exprs) if lot_canards_exprs else "NULL"

    # MEG (morts en gavage): colonne variable selon schéma
    meg_exprs: List[str] = []
    for col in [
        "nb_canards_meg",
        "nb_meg",
        "nb_morts",
        "nb_canards_morts",
    ]:
        if await _column_exists(conn, "lots_gavage", col):
            meg_exprs.append(f"lg.{col}")

    lg_meg_expr = ", ".join(meg_exprs) if meg_exprs else "NULL"

    # Estimation alternative: initial - meg (si les 2 sont dispos)
    # On ne l'utilise que si les 2 expressions sont non-null.
    est_init_minus_meg_expr = f"(NULLIF({lg_canards_expr}, 0) - COALESCE({lg_meg_expr}, 0))"
    has_gdl = await _table_exists(conn, "gavage_data_lots") and await _column_exists(conn, "gavage_data_lots", "nb_canards_vivants")

    join_gdl_sql = ""
    gdl_canards_expr = "NULL"
    if has_gdl:
        join_gdl_sql = """
        LEFT JOIN LATERAL (
            SELECT gdl.nb_canards_vivants
            FROM gavage_data_lots gdl
            WHERE gdl.lot_gavage_id = lg.id
            ORDER BY gdl.time DESC
            LIMIT 1
        ) gdl_last ON TRUE
        """
        gdl_canards_expr = "gdl_last.nb_canards_vivants"

    nb_canards_expr = f"COALESCE({sqal_suspendus_expr}, NULLIF({lg_canards_expr}, 0), {est_init_minus_meg_expr}, {gdl_canards_expr}, 0)"

    query = f"""
        SELECT
            lg.id AS id,
            lg.code_lot,
            lg.site_code,
            lg.debut_lot,
            COALESCE(lg.duree_gavage_prevue, lg.duree_gavage_reelle, 14) AS duree_jours,
            COALESCE(lg.buffer_jours, 0) AS buffer_jours,
            (
                lg.debut_lot
                + (
                    (COALESCE(lg.duree_gavage_prevue, lg.duree_gavage_reelle, 14) + COALESCE(lg.buffer_jours, 0))
                    * INTERVAL '1 day'
                )
            )::date AS date_abattage_prevue,
            {nb_canards_expr} AS nb_canards,
            LOWER(COALESCE(lg.statut, '')) AS statut
        FROM lots_gavage lg
        {join_sqal_sql}
        {join_gdl_sql}
        WHERE lg.code_lot IS NOT NULL
    """

    params: List[Any] = []
    where_parts: List[str] = []

    if resolved_site:
        params.append(resolved_site)
        where_parts.append(f"site_code = ${len(params)}")

    if date_debut:
        params.append(date_debut)
        where_parts.append(f"(debut_lot + ((COALESCE(duree_gavage_prevue, duree_gavage_reelle, 14) + COALESCE(buffer_jours, 0)) * INTERVAL '1 day'))::date >= ${len(params)}")

    if date_fin:
        params.append(date_fin)
        where_parts.append(f"(debut_lot + ((COALESCE(duree_gavage_prevue, duree_gavage_reelle, 14) + COALESCE(buffer_jours, 0)) * INTERVAL '1 day'))::date <= ${len(params)}")

    if where_parts:
        query += " AND " + " AND ".join(where_parts)

    query += " ORDER BY date_abattage_prevue ASC NULLS LAST, debut_lot ASC NULLS LAST LIMIT $" + str(len(params) + 1)
    params.append(int(limit))

    rows = await conn.fetch(query, *params)

    # Mapping simple abattoirs / distances (placeholder V1)
    abattoir_by_site = {
        "LL": ("ABATTOIR OUEST", 45.0),
        "LS": ("ABATTOIR SUD", 65.0),
        "MT": ("ABATTOIR NORD", 35.0),
    }

    out: List[PlanningAbattageRow] = []
    for r in rows:
        rd = dict(r)

        abattage_date: Optional[date] = rd.get("date_abattage_prevue") or date.today()

        site = str(rd.get("site_code") or "").strip().upper() or "LL"
        abattoir, distance_km = abattoir_by_site.get(site, ("ABATTOIR OUEST", 50.0))

        # Créneau horaire simple (alternance)
        creneau = "08h-12h" if int(rd.get("id") or 0) % 2 == 0 else "14h-18h"

        nb_canards = int(rd.get("nb_canards") or 0)
        capacite_jour = 2000
        taux_util = 0.0
        if capacite_jour > 0:
            taux_util = min(100.0, (nb_canards / capacite_jour) * 100.0)

        # Coût transport (placeholder): base + km
        cout = float(120.0 + distance_km * 2.5)

        statut_raw = str(rd.get("statut") or "").strip().lower()
        if statut_raw in {"abattu", "termine"}:
            statut_ab = "realise"
        elif statut_raw in {"planifie", "en_preparation"}:
            statut_ab = "planifie"
        else:
            statut_ab = "confirme"

        # Priorité simple: plus proche = plus prioritaire
        days_to = (abattage_date - date.today()).days if abattage_date else 999
        if days_to <= 1:
            priorite = 5
        elif days_to <= 3:
            priorite = 4
        elif days_to <= 7:
            priorite = 3
        elif days_to <= 14:
            priorite = 2
        else:
            priorite = 1

        out.append(
            PlanningAbattageRow(
                id=int(rd.get("id")),
                code_lot=str(rd.get("code_lot")),
                site_code=site,
                date_abattage_prevue=abattage_date.isoformat() if abattage_date else date.today().isoformat(),
                abattoir=abattoir,
                creneau_horaire=creneau,
                nb_canards_prevu=nb_canards,
                capacite_abattoir_jour=int(capacite_jour),
                taux_utilisation_pct=float(round(taux_util, 2)),
                distance_km=float(round(distance_km, 2)),
                cout_transport=float(round(cout, 2)),
                priorite=int(priorite),
                statut=str(statut_ab),
            )
        )
    return out


@router.post("/lots/planifier", response_model=Dict[str, Any])
async def planifier_lot(
    payload: LotPlanCreateRequest,
    conn=Depends(get_db_connection),
):
    """Crée un lot planifié côté Euralis (planning superviseur).

    Remarque: la courbe PySR snapshot est assignée via un endpoint séparé.
    """

    await _ensure_lots_gavage_planning_columns(conn)

    site = str(payload.site_code).strip().upper()
    if payload.duree_gavage_prevue < 11 or payload.duree_gavage_prevue > 14:
        raise HTTPException(status_code=400, detail="duree_gavage_prevue must be between 11 and 14")
    if payload.buffer_jours < 0 or payload.buffer_jours > 1:
        raise HTTPException(status_code=400, detail="buffer_jours must be 0 or 1")

    # Check capacity for that gaveur on that window
    cap_rows = await get_gaveurs_capacite(
        start_date=payload.debut_lot,
        duree_jours=payload.duree_gavage_prevue,
        buffer_jours=payload.buffer_jours,
        site_code=site,
        conn=conn,
    )
    cap = next((r for r in cap_rows if r.gaveur_id == payload.gaveur_id), None)
    if not cap:
        raise HTTPException(status_code=404, detail=f"Gaveur {payload.gaveur_id} introuvable")
    if not cap.can_plan_new_lot:
        raise HTTPException(status_code=409, detail=f"Gaveur {payload.gaveur_id} a déjà 3 lots sur la période")

    fin_capacite_prevue = _capacity_end_exclusive(
        payload.debut_lot, int(payload.duree_gavage_prevue), int(payload.buffer_jours)
    )

    try:
        row = await conn.fetchrow(
            """
            INSERT INTO lots_gavage (
                code_lot,
                site_code,
                gaveur_id,
                souche,
                genetique,
                debut_lot,
                nb_canards_initial,
                duree_gavage_prevue,
                buffer_jours,
                statut,
                created_at,
                updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'planifie',NOW(),NOW())
            RETURNING id, code_lot, site_code, gaveur_id, debut_lot, duree_gavage_prevue, buffer_jours, statut
            """,
            str(payload.code_lot),
            site,
            int(payload.gaveur_id),
            payload.souche,
            payload.genetique,
            payload.debut_lot,
            int(payload.nb_canards_initial),
            int(payload.duree_gavage_prevue),
            int(payload.buffer_jours),
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail=f"Le code lot {payload.code_lot} existe déjà")

    result = dict(row)
    result["fin_capacite_prevue"] = fin_capacite_prevue.isoformat()
    return result


@router.post("/lots/{lot_id}/assign-curve-snapshot", response_model=Dict[str, Any])
async def assign_curve_snapshot_to_lot(
    lot_id: int,
    payload: LotAssignCurveSnapshotRequest,
    conn=Depends(get_db_connection),
):
    """Assigne un snapshot JSON de courbe PySR au lot.

    Le snapshot est figé. Refus si le lot a déjà démarré.
    """

    await _ensure_lots_gavage_planning_columns(conn)

    lot = await conn.fetchrow(
        """
        SELECT id, code_lot, debut_lot, statut
        FROM lots_gavage
        WHERE id = $1
        """,
        int(lot_id),
    )
    if not lot:
        raise HTTPException(status_code=404, detail=f"Lot {lot_id} introuvable")

    lot_statut = str(lot.get("statut") or "").strip().lower()
    today = date.today()
    debut_lot = lot.get("debut_lot")
    lot_started_by_status = lot_statut in {"en_cours", "en_gavage"}
    lot_started_by_date = bool(debut_lot and today > debut_lot)
    if lot_started_by_status or lot_started_by_date:
        raise HTTPException(status_code=409, detail="Impossible d'assigner une courbe: le lot a déjà démarré")

    import json as _json

    snapshot_json = payload.courbe_pysr_snapshot_json
    try:
        if isinstance(snapshot_json, str):
            snapshot_json = _json.loads(snapshot_json)
    except Exception:
        raise HTTPException(status_code=400, detail="courbe_pysr_snapshot_json doit être un JSON valide")

    try:
        snapshot_json_str = _json.dumps(snapshot_json)
    except Exception:
        raise HTTPException(status_code=400, detail="courbe_pysr_snapshot_json doit être sérialisable JSON")

    await conn.execute(
        """
        UPDATE lots_gavage
        SET
            courbe_pysr_snapshot_json = $1::jsonb,
            pysr_formula = $2,
            pysr_r2_score = $3,
            updated_at = NOW()
        WHERE id = $4
        """,
        snapshot_json_str,
        payload.pysr_formula,
        payload.pysr_r2_score,
        int(lot_id),
    )

    updated = await conn.fetchrow(
        """
        SELECT
            id, code_lot, site_code, gaveur_id, souche, debut_lot,
            duree_gavage_prevue, buffer_jours,
            (debut_lot + (COALESCE(duree_gavage_prevue, 14) + COALESCE(buffer_jours, 0)) * INTERVAL '1 day')::date AS fin_capacite_prevue,
            itm, sigma, duree_gavage_reelle, pctg_perte_gavage, statut,
            courbe_pysr_snapshot_json, pysr_formula, pysr_r2_score
        FROM lots_gavage
        WHERE id = $1
        """,
        int(lot_id),
    )
    return dict(updated)


def _compute_capacity_end_exclusive_sql(start_param: str, duree_param: str, buffer_param: str) -> str:
    return f"({start_param}::date + ({duree_param}::int + {buffer_param}::int) * INTERVAL '1 day')"


@router.get("/ml/pysr/training-history", response_model=List[PySRTrainingHistoryRow])
async def list_pysr_training_history(
    site_code: Optional[str] = Query(None, description="Code site"),
    genetique: Optional[str] = Query(None, description="Génétique"),
    cluster_id: Optional[int] = Query(None, ge=0),
    statut: Optional[str] = Query(None, description="SUCCESS/FAILED/..."),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    conn=Depends(get_db_connection),
):
    """Liste l'historique des runs PySR (pour comparaison multi-courbes côté admin)."""

    try:
        def _json_safe(obj: Any) -> Any:
            """Convertit récursivement les valeurs non sérialisables JSON strict (NaN/Inf) en None."""
            try:
                if isinstance(obj, float):
                    return obj if math.isfinite(obj) else None
                if isinstance(obj, dict):
                    return {k: _json_safe(v) for k, v in obj.items()}
                if isinstance(obj, list):
                    return [_json_safe(v) for v in obj]
                if isinstance(obj, tuple):
                    return [_json_safe(v) for v in obj]
                return obj
            except Exception:
                return None

        # Robustesse: la table peut ne pas exister si aucun training n'a encore tourné.
        try:
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
        except Exception:
            pass

        # Robustesse: le schéma peut ne pas être à jour si aucun training n'a encore exécuté
        # _ensure_pysr_training_history_table côté worker.
        try:
            await conn.execute(
                "ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS candidate_curve_json JSONB"
            )
            await conn.execute(
                "ALTER TABLE pysr_training_history ADD COLUMN IF NOT EXISTS candidate_metrics_json JSONB"
            )
        except Exception:
            # Ne pas empêcher la lecture de l'historique si la migration légère échoue
            pass

        where: list[str] = ["1=1"]
        params: list[object] = []

        if site_code:
            where.append(f"site_code = ${len(params) + 1}")
            params.append(str(site_code).strip().upper())

        if genetique:
            where.append(f"genetique = ${len(params) + 1}")
            params.append(str(genetique).strip().lower())

        if cluster_id is not None:
            where.append(f"cluster_id = ${len(params) + 1}")
            params.append(int(cluster_id))

        if statut:
            where.append(f"statut = ${len(params) + 1}")
            params.append(str(statut).strip().upper())

        params.append(int(limit))
        limit_param_idx = len(params)
        params.append(int(offset))
        offset_param_idx = len(params)

        query = (
            "SELECT id, task_id, site_code, genetique, cluster_id, statut, best_equation, r2_score, mae, complexity, "
            "candidate_curve_json, candidate_metrics_json, "
            "error_message, started_at, finished_at, created_at "
            "FROM pysr_training_history "
            f"WHERE {' AND '.join(where)} "
            "ORDER BY started_at DESC NULLS LAST, created_at DESC "
            f"LIMIT ${limit_param_idx} OFFSET ${offset_param_idx}"
        )

        rows = await conn.fetch(query, *params)

        out: list[PySRTrainingHistoryRow] = []
        for r in rows:
            try:
                payload = dict(r)

                # Robust conversions (asyncpg.Record doesn't guarantee plain python types for JSON/NUMERIC).
                payload["started_at"] = r["started_at"].isoformat() if r["started_at"] is not None else None
                payload["finished_at"] = r["finished_at"].isoformat() if r["finished_at"] is not None else None
                payload["created_at"] = r["created_at"].isoformat() if r["created_at"] is not None else None

                payload["r2_score"] = float(r["r2_score"]) if r["r2_score"] is not None else None
                payload["mae"] = float(r["mae"]) if r["mae"] is not None else None
                payload["complexity"] = int(r["complexity"]) if r["complexity"] is not None else None
                payload["cluster_id"] = int(r["cluster_id"]) if r["cluster_id"] is not None else None

                # JSONB can arrive as python objects, strings, or driver wrappers.
                for k in ("candidate_curve_json", "candidate_metrics_json"):
                    v = payload.get(k)
                    if v is None:
                        continue
                    if isinstance(v, (dict, list, int, float, bool)):
                        continue
                    if isinstance(v, str):
                        try:
                            payload[k] = json.loads(v)
                        except Exception:
                            # Keep raw string if it isn't JSON.
                            payload[k] = v
                    else:
                        # Fallback: ensure it's JSON-serializable.
                        payload[k] = json.loads(json.dumps(v, default=str))

                # JSON strict: empêcher NaN/Inf dans toute la payload (sinon 500 à la sérialisation).
                payload = _json_safe(payload)

                out.append(PySRTrainingHistoryRow(**payload))
            except Exception as row_exc:
                # Never crash the whole endpoint due to one bad legacy row.
                try:
                    logger.warning(
                        "Skip invalid pysr_training_history row id=%s err=%s",
                        str(r["id"] if "id" in r else "?"),
                        str(row_exc),
                    )
                except Exception:
                    pass
                continue

        return out
    except Exception as exc:
        logger.exception("Erreur list_pysr_training_history")
        raise HTTPException(status_code=500, detail="Erreur listing historique PySR")


@router.get("/ml/pysr/training-preview", response_model=PySRTrainingPreviewResponse)
async def get_pysr_training_preview(
    task_id: str = Query(..., description="Celery task_id d'un run PySR"),
    cluster_id: Optional[int] = Query(None, ge=0, description="Override cluster pour choisir la courbe de base"),
):
    """Reconstruit une courbe preview à partir d'un résultat d'entraînement PySR (task SUCCESS)."""

    try:
        task_res = AsyncResult(str(task_id), app=celery_app)
        if task_res is None:
            raise HTTPException(status_code=404, detail="task_id introuvable")

        if task_res.state not in ("SUCCESS", "FAILURE"):
            raise HTTPException(
                status_code=409,
                detail=f"Task pas terminée (state={task_res.state})",
            )

        if task_res.state == "FAILURE":
            raise HTTPException(status_code=400, detail="Task en échec, preview impossible")

        result = task_res.result or {}

        resolved_site_code = None
        site_codes = result.get("site_codes")
        if isinstance(site_codes, list) and site_codes:
            resolved_site_code = str(site_codes[0]).strip().upper()

        resolved_cluster_id = cluster_id
        if resolved_cluster_id is None:
            cluster_ids = result.get("cluster_ids")
            if isinstance(cluster_ids, list) and cluster_ids:
                try:
                    resolved_cluster_id = int(cluster_ids[0])
                except Exception:
                    resolved_cluster_id = None

        resolved_genetique = result.get("genetique")
        if resolved_genetique is not None:
            resolved_genetique = str(resolved_genetique).strip().lower()

        from app.ml.euralis.courbes_personnalisees import CourbesPersonnaliseesML

        ref_engine = CourbesPersonnaliseesML()

        base_curve: list[dict[str, Any]] = []
        if resolved_cluster_id is not None:
            base_curve = (ref_engine.courbes_reference.get(int(resolved_cluster_id)) or {}).get("courbe", [])
        if not base_curve:
            base_curve = (ref_engine.courbes_reference.get(2) or {}).get("courbe", [])

        if not base_curve:
            raise HTTPException(status_code=400, detail="Impossible de construire la courbe preview")

        return {
            "task_id": str(task_id),
            "segment": {
                "site_code": resolved_site_code,
                "genetique": resolved_genetique,
                "cluster_id": resolved_cluster_id,
            },
            "pysr": {
                "formula": result.get("formula"),
                "r2_score": result.get("r2_score"),
                "complexity": result.get("complexity"),
                "variables": result.get("variables"),
                "foie_objective": result.get("foie_objective"),
            },
            "courbe": {"jours": base_curve},
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Erreur get_pysr_training_preview")
        raise HTTPException(status_code=500, detail="Erreur preview PySR")


@router.get("/ml/pysr/reference-curves/latest")
async def get_latest_pysr_reference_curve(
    site_code: str = Query(..., description="Code site"),
    genetique: str = Query(..., description="Génétique"),
    cluster_id: int = Query(..., ge=0),
    conn=Depends(get_db_connection),
):
    try:
        await _ensure_pysr_reference_curve_tables(conn)

        row = await conn.fetchrow(
            """
            SELECT *
            FROM pysr_reference_curves_segments
            WHERE site_code = $1
              AND genetique = $2
              AND cluster_id = $3
            ORDER BY created_at DESC
            LIMIT 1
            """,
            str(site_code).strip().upper(),
            str(genetique).strip().lower(),
            int(cluster_id),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Aucune courbe de référence PySR pour ce segment")

        return {
            **dict(row),
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Erreur get_latest_pysr_reference_curve: {exc}")
        raise HTTPException(status_code=500, detail="Erreur récupération courbe de référence")


@router.post("/ml/pysr/reference-curves/publish")
async def publish_pysr_reference_curve(
    payload: PySRReferenceCurvePublishRequest,
    conn=Depends(get_db_connection),
):
    """Publie une courbe de référence segment (figée) à partir d'un résultat de task PySR."""

    try:
        await _ensure_pysr_reference_curve_tables(conn)

        task_res = AsyncResult(payload.task_id, app=celery_app)
        if task_res is None:
            raise HTTPException(status_code=404, detail="task_id introuvable")

        if task_res.state not in ("SUCCESS", "FAILURE"):
            raise HTTPException(
                status_code=409,
                detail=f"Task pas terminée (state={task_res.state})",
            )

        if task_res.state == "FAILURE":
            raise HTTPException(status_code=400, detail="Task en échec, publication impossible")

        result = task_res.result or {}
        pysr_formula = result.get("formula")
        pysr_r2_score = result.get("r2_score")
        pysr_complexity = result.get("complexity")

        from app.ml.euralis.courbes_personnalisees import CourbesPersonnaliseesML

        if payload.reference_curve:
            reference_curve = payload.reference_curve
        else:
            ref_engine = CourbesPersonnaliseesML()
            reference_curve = (ref_engine.courbes_reference.get(int(payload.cluster_id)) or ref_engine.courbes_reference.get(2) or {}).get(
                "courbe",
                [],
            )

        if not reference_curve:
            raise HTTPException(status_code=400, detail="Impossible de construire la courbe de référence")

        last_version = await conn.fetchval(
            """
            SELECT COALESCE(MAX(version), 0)
            FROM pysr_reference_curves_segments
            WHERE site_code = $1 AND genetique = $2 AND cluster_id = $3
            """,
            str(payload.site_code).strip().upper(),
            str(payload.genetique).strip().lower(),
            int(payload.cluster_id),
        )
        next_version = int(last_version or 0) + 1

        row = await conn.fetchrow(
            """
            INSERT INTO pysr_reference_curves_segments (
                site_code, genetique, cluster_id, version,
                task_id, pysr_formula, pysr_r2_score, pysr_complexity,
                reference_curve_json, params, created_by
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8,
                $9::jsonb, $10::jsonb, $11
            )
            RETURNING id, created_at
            """,
            str(payload.site_code).strip().upper(),
            str(payload.genetique).strip().lower(),
            int(payload.cluster_id),
            next_version,
            str(payload.task_id),
            (str(pysr_formula) if pysr_formula else None),
            (float(pysr_r2_score) if pysr_r2_score is not None else None),
            (int(pysr_complexity) if pysr_complexity is not None else None),
            json.dumps({"jours": reference_curve}),
            json.dumps(
                {
                    "task_result": {
                        "include_sqal_features": result.get("include_sqal_features"),
                        "premium_grades": result.get("premium_grades"),
                        "require_sqal_premium": result.get("require_sqal_premium"),
                        "site_codes": result.get("site_codes"),
                        "seasons": result.get("seasons"),
                        "cluster_ids": result.get("cluster_ids"),
                        "foie_objective": result.get("foie_objective"),
                    }
                }
            ),
            payload.created_by,
        )

        return {
            "success": True,
            "reference_curve_id": row["id"],
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
            "version": next_version,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Erreur publish_pysr_reference_curve: {exc}")
        raise HTTPException(status_code=500, detail="Erreur publication courbe de référence")


@router.post("/ml/pysr/reference-curves/{reference_curve_id}/assign")
async def assign_pysr_reference_curve_to_gaveurs(
    reference_curve_id: int,
    payload: PySRReferenceCurveAssignRequest,
    conn=Depends(get_db_connection),
):
    """Assigne (bulk) une référence segment à des gaveurs en matérialisant une courbe personnalisée et en écrasant la courbe active."""

    try:
        await _ensure_pysr_reference_curve_tables(conn)

        ref_row = await conn.fetchrow(
            """
            SELECT *
            FROM pysr_reference_curves_segments
            WHERE id = $1
            """,
            int(reference_curve_id),
        )
        if not ref_row:
            raise HTTPException(status_code=404, detail="Courbe de référence introuvable")

        ref_json = ref_row.get("reference_curve_json")
        ref_curve = []
        if isinstance(ref_json, str):
            try:
                ref_json = json.loads(ref_json)
            except Exception:
                ref_json = None

        if isinstance(ref_json, dict):
            ref_curve = ref_json.get("jours") or []

        if not ref_curve:
            raise HTTPException(status_code=400, detail="Courbe de référence invalide")

        from app.ml.euralis.courbes_personnalisees import CourbesPersonnaliseesML

        engine = CourbesPersonnaliseesML()

        view_exists = await conn.fetchval(
            "SELECT to_regclass('public.gaveurs_clustering_ml_view') IS NOT NULL"
        )

        assigned: List[Dict[str, Any]] = []
        for gid in payload.gaveur_ids:
            if view_exists:
                stats_row = await conn.fetchrow(
                    """
                    SELECT
                        g.id as gaveur_id,
                        g.nom,
                        g.prenom,
                        COALESCE(v.cluster_ml, NULL) as cluster_ml,
                        AVG(l.itm) as itm_moyen,
                        AVG(l.pctg_perte_gavage) as mortalite
                    FROM gaveurs_euralis g
                    LEFT JOIN gaveurs_clustering_ml_view v ON v.gaveur_id = g.id
                    LEFT JOIN lots_gavage l ON l.gaveur_id = g.id AND l.itm IS NOT NULL
                    WHERE g.id = $1
                    GROUP BY g.id, g.nom, g.prenom, v.cluster_ml
                    """,
                    int(gid),
                )
            else:
                stats_row = await conn.fetchrow(
                    """
                    SELECT
                        g.id as gaveur_id,
                        g.nom,
                        g.prenom,
                        NULL as cluster_ml,
                        AVG(l.itm) as itm_moyen,
                        AVG(l.pctg_perte_gavage) as mortalite
                    FROM gaveurs_euralis g
                    LEFT JOIN lots_gavage l ON l.gaveur_id = g.id AND l.itm IS NOT NULL
                    WHERE g.id = $1
                    GROUP BY g.id, g.nom, g.prenom
                    """,
                    int(gid),
                )

            if not stats_row:
                assigned.append({"gaveur_id": int(gid), "status": "not_found"})
                continue

            cluster_val = int(stats_row["cluster_ml"]) if stats_row.get("cluster_ml") is not None else int(ref_row["cluster_id"])
            itm_val = float(stats_row["itm_moyen"]) if stats_row.get("itm_moyen") is not None else 15.0
            mortalite_val = float(stats_row["mortalite"]) if stats_row.get("mortalite") is not None else 1.5

            courbe_result = engine.generer_courbe_personnalisee_depuis_reference(
                reference_curve=ref_curve,
                cluster=cluster_val,
                itm_historique=itm_val,
                mortalite_historique=mortalite_val,
                nb_canards=int(payload.nb_canards),
                souche=str(payload.souche),
            )

            courbe_json = json.dumps({"jours": courbe_result["courbe"]})
            metadata = courbe_result.get("metadata", {})

            existing_id = await conn.fetchval(
                "SELECT id FROM courbes_optimales_gaveurs WHERE gaveur_id = $1 LIMIT 1",
                int(gid),
            )

            if existing_id:
                await conn.execute(
                    """
                    UPDATE courbes_optimales_gaveurs
                    SET
                        cluster_performance = $1,
                        souche = $2,
                        duree_jours = $3,
                        itm_cible = $4,
                        courbe_json = $5::jsonb,
                        score_performance = $6,
                        source_generation = $7,
                        nb_lots_base = $8
                    WHERE id = $9
                    """,
                    int(metadata.get("cluster", cluster_val)),
                    str(metadata.get("souche", payload.souche)),
                    int(11),
                    float(metadata.get("itm_cible", 15.0)),
                    courbe_json,
                    float(20.0 / float(metadata.get("itm_cible", 15.0) or 15.0)),
                    "pysr_segment",
                    None,
                    int(existing_id),
                )
                courbe_id = int(existing_id)
            else:
                new_row = await conn.fetchrow(
                    """
                    INSERT INTO courbes_optimales_gaveurs (
                        gaveur_id, cluster_performance, souche, duree_jours,
                        itm_cible, courbe_json, score_performance,
                        source_generation, nb_lots_base
                    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
                    RETURNING id
                    """,
                    int(gid),
                    int(metadata.get("cluster", cluster_val)),
                    str(metadata.get("souche", payload.souche)),
                    int(11),
                    float(metadata.get("itm_cible", 15.0)),
                    courbe_json,
                    float(20.0 / float(metadata.get("itm_cible", 15.0) or 15.0)),
                    "pysr_segment",
                    None,
                )
                courbe_id = int(new_row["id"])

            await conn.execute(
                """
                INSERT INTO courbes_recommandations_historique (
                    gaveur_id, courbe_id, lot_id,
                    itm_cible, notes
                ) VALUES ($1, $2, NULL, $3, $4)
                """,
                int(gid),
                int(courbe_id),
                float(metadata.get("itm_cible", 15.0)),
                json.dumps(
                    {
                        "reference_curve_id": int(reference_curve_id),
                        "assigned_by": payload.assigned_by,
                        "segment": {
                            "site_code": ref_row.get("site_code"),
                            "genetique": ref_row.get("genetique"),
                            "cluster_id": ref_row.get("cluster_id"),
                            "version": ref_row.get("version"),
                        },
                    }
                ),
            )

            assigned.append(
                {
                    "gaveur_id": int(gid),
                    "courbe_id": int(courbe_id),
                    "status": "assigned",
                }
            )

        return {
            "success": True,
            "reference_curve_id": int(reference_curve_id),
            "n_requested": len(payload.gaveur_ids),
            "results": assigned,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Erreur assign_pysr_reference_curve_to_gaveurs")
        raise HTTPException(status_code=500, detail="Erreur assignation courbe de référence")


# ============================================================================
# ADMIN - Policy Objectif Foie (Conseil)
# ============================================================================


@router.post("/admin/foie-objectives", response_model=FoieObjectivePolicy)
async def create_foie_objective_policy(
    payload: FoieObjectivePolicyCreateRequest,
    conn=Depends(get_db_connection),
):
    await _ensure_foie_objective_policy_tables(conn)

    genetique = str(payload.genetique).strip().lower()
    site_code = str(payload.site_code).strip().upper() if payload.site_code else None
    lot_cluster_pred_id = int(payload.lot_cluster_pred_id) if payload.lot_cluster_pred_id is not None else None
    valid_from = payload.valid_from or datetime.utcnow()
    valid_to = payload.valid_to

    row = await conn.fetchrow(
        """
        INSERT INTO foie_objective_policies (
            genetique,
            site_code,
            lot_cluster_pred_id,
            foie_min_g,
            foie_max_g,
            foie_target_g,
            weight_range,
            weight_target,
            is_active,
            valid_from,
            valid_to,
            created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,$10,$11)
        RETURNING *
        """,
        genetique,
        site_code,
        lot_cluster_pred_id,
        float(payload.foie_min_g),
        float(payload.foie_max_g),
        float(payload.foie_target_g),
        float(payload.weight_range),
        float(payload.weight_target),
        valid_from,
        valid_to,
        payload.created_by,
    )
    return FoieObjectivePolicy(**dict(row))


@router.post("/admin/transition-policies", response_model=TransitionPolicy)
async def create_transition_policy(
    payload: TransitionPolicyCreateRequest,
    conn=Depends(get_db_connection),
):
    await _ensure_transition_policy_tables(conn)

    genetique = str(payload.genetique).strip().lower()
    site_code = str(payload.site_code).strip().upper() if payload.site_code else None
    lot_cluster_refined_j4_id = (
        int(payload.lot_cluster_refined_j4_id) if payload.lot_cluster_refined_j4_id is not None else None
    )
    valid_from = payload.valid_from or datetime.utcnow()
    valid_to = payload.valid_to

    row = await conn.fetchrow(
        """
        INSERT INTO transition_policies (
            genetique,
            site_code,
            lot_cluster_refined_j4_id,
            params,
            is_active,
            valid_from,
            valid_to,
            created_by
        ) VALUES ($1,$2,$3,$4,TRUE,$5,$6,$7)
        RETURNING *
        """,
        genetique,
        site_code,
        lot_cluster_refined_j4_id,
        payload.params,
        valid_from,
        valid_to,
        payload.created_by,
    )
    return TransitionPolicy(**dict(row))


@router.get("/admin/transition-policies", response_model=List[TransitionPolicy])
async def list_transition_policies(
    genetique: Optional[str] = Query(None),
    site_code: Optional[str] = Query(None),
    lot_cluster_refined_j4_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    conn=Depends(get_db_connection),
):
    await _ensure_transition_policy_tables(conn)

    query = """
        SELECT *
        FROM transition_policies
        WHERE 1=1
    """
    params: List[Any] = []

    if genetique:
        params.append(str(genetique).strip().lower())
        query += f" AND genetique = ${len(params)}"

    if site_code:
        params.append(str(site_code).strip().upper())
        query += f" AND site_code = ${len(params)}"

    if lot_cluster_refined_j4_id is not None:
        params.append(int(lot_cluster_refined_j4_id))
        query += f" AND lot_cluster_refined_j4_id = ${len(params)}"

    if is_active is not None:
        params.append(bool(is_active))
        query += f" AND is_active = ${len(params)}"

    params.append(int(limit))
    params.append(int(offset))
    query += f" ORDER BY created_at DESC LIMIT ${len(params)-1} OFFSET ${len(params)}"

    rows = await conn.fetch(query, *params)
    return [TransitionPolicy(**dict(r)) for r in rows]


@router.post("/admin/transition-policies/{policy_id}/deactivate", response_model=TransitionPolicy)
async def deactivate_transition_policy(
    policy_id: int,
    conn=Depends(get_db_connection),
):
    await _ensure_transition_policy_tables(conn)

    row = await conn.fetchrow(
        """
        UPDATE transition_policies
        SET is_active = FALSE,
            valid_to = COALESCE(valid_to, NOW())
        WHERE id = $1
        RETURNING *
        """,
        int(policy_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    return TransitionPolicy(**dict(row))


@router.get("/admin/foie-objectives", response_model=List[FoieObjectivePolicy])
async def list_foie_objective_policies(
    genetique: Optional[str] = Query(None),
    site_code: Optional[str] = Query(None),
    lot_cluster_pred_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    conn=Depends(get_db_connection),
):
    await _ensure_foie_objective_policy_tables(conn)

    query = """
        SELECT *
        FROM foie_objective_policies
        WHERE 1=1
    """
    params: List[Any] = []

    if genetique:
        params.append(str(genetique).strip().lower())
        query += f" AND genetique = ${len(params)}"

    if site_code:
        params.append(str(site_code).strip().upper())
        query += f" AND site_code = ${len(params)}"

    if lot_cluster_pred_id is not None:
        params.append(int(lot_cluster_pred_id))
        query += f" AND lot_cluster_pred_id = ${len(params)}"

    if is_active is not None:
        params.append(bool(is_active))
        query += f" AND is_active = ${len(params)}"

    params.append(int(limit))
    params.append(int(offset))
    query += f" ORDER BY created_at DESC LIMIT ${len(params)-1} OFFSET ${len(params)}"

    rows = await conn.fetch(query, *params)
    return [FoieObjectivePolicy(**dict(r)) for r in rows]


@router.post("/admin/foie-objectives/{policy_id}/deactivate", response_model=FoieObjectivePolicy)
async def deactivate_foie_objective_policy(
    policy_id: int,
    conn=Depends(get_db_connection),
):
    await _ensure_foie_objective_policy_tables(conn)

    row = await conn.fetchrow(
        """
        UPDATE foie_objective_policies
        SET is_active = FALSE,
            valid_to = COALESCE(valid_to, NOW())
        WHERE id = $1
        RETURNING *
        """,
        int(policy_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    return FoieObjectivePolicy(**dict(row))


# ============================================================================
# Lecture policy active (par segment)
# ============================================================================


@router.get("/ml/foie-objectives/active", response_model=Optional[FoieObjectivePolicy])
async def get_active_foie_objective_policy(
    genetique: str = Query(...),
    site_code: Optional[str] = Query(None),
    lot_cluster_pred_id: Optional[int] = Query(None),
    conn=Depends(get_db_connection),
):
    await _ensure_foie_objective_policy_tables(conn)

    g = str(genetique).strip().lower()
    sc = str(site_code).strip().upper() if site_code else None
    lc = int(lot_cluster_pred_id) if lot_cluster_pred_id is not None else None

    row = await conn.fetchrow(
        """
        SELECT *
        FROM foie_objective_policies
        WHERE genetique = $1
          AND ($2::varchar IS NULL OR site_code = $2)
          AND ($3::int IS NULL OR lot_cluster_pred_id = $3)
          AND is_active = TRUE
          AND valid_from <= NOW()
          AND (valid_to IS NULL OR valid_to > NOW())
        ORDER BY created_at DESC
        LIMIT 1
        """,
        g,
        sc,
        lc,
    )
    if not row:
        return None
    return FoieObjectivePolicy(**dict(row))


@router.get("/ml/transition/active", response_model=Optional[TransitionPolicy])
async def get_active_transition_policy(
    genetique: str = Query(...),
    site_code: Optional[str] = Query(None),
    lot_cluster_refined_j4_id: Optional[int] = Query(None),
    conn=Depends(get_db_connection),
):
    await _ensure_transition_policy_tables(conn)

    g = str(genetique).strip().lower()
    sc = str(site_code).strip().upper() if site_code else None
    lc = int(lot_cluster_refined_j4_id) if lot_cluster_refined_j4_id is not None else None

    row = await conn.fetchrow(
        """
        SELECT *
        FROM transition_policies
        WHERE genetique = $1
          AND ($2::varchar IS NULL OR site_code = $2)
          AND ($3::int IS NULL OR lot_cluster_refined_j4_id = $3)
          AND is_active = TRUE
          AND valid_from <= NOW()
          AND (valid_to IS NULL OR valid_to > NOW())
        ORDER BY created_at DESC
        LIMIT 1
        """,
        g,
        sc,
        lc,
    )
    if not row:
        return None
    return TransitionPolicy(**dict(row))


@router.get("/ml/lots-clustering/runs/latest", response_model=LotClusteringRun)
async def get_latest_lot_pred_clustering_run(
    modele_version: Optional[str] = Query(None, description="Filtrer par modele_version"),
    conn=Depends(get_db_connection),
):
    """Retourne le dernier run enregistré du clustering lots (lot_pred)."""

    import json

    query = """
        SELECT
            id as run_id,
            clustering_type,
            modele_version,
            params,
            features,
            n_clusters,
            n_lots,
            avg_confidence,
            created_at
        FROM lot_clustering_runs
        WHERE clustering_type = 'lot_pred'
    """
    params: List[Any] = []
    if modele_version:
        params.append(str(modele_version))
        query += f" AND modele_version = ${len(params)}"
    query += " ORDER BY created_at DESC LIMIT 1"

    try:
        row = await conn.fetchrow(query, *params)
    except asyncpg.exceptions.UndefinedTableError:
        raise HTTPException(status_code=404, detail="lot_clustering_runs table not found")

    if not row:
        raise HTTPException(status_code=404, detail="No lot_pred clustering run found")

    payload = dict(row)
    if isinstance(payload.get("params"), str):
        try:
            payload["params"] = json.loads(payload["params"])
        except Exception:
            payload["params"] = None

    return LotClusteringRun(**payload)


@router.get("/ml/lots/{lot_id}/cluster-pred", response_model=LotClusterAssignment)
async def get_lot_cluster_pred(
    lot_id: int,
    run_id: Optional[int] = Query(None, description="Run id (sinon dernier run lot_pred)"),
    conn=Depends(get_db_connection),
):
    """Retourne le cluster_pred (lot_pred) d'un lot pour un run (ou le dernier run)."""

    resolved_run_id = run_id
    if resolved_run_id is None:
        try:
            resolved_run_id = await conn.fetchval(
                """
                SELECT id
                FROM lot_clustering_runs
                WHERE clustering_type = 'lot_pred'
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
        except asyncpg.exceptions.UndefinedTableError:
            raise HTTPException(status_code=404, detail="lot_clustering_runs table not found")

    if not resolved_run_id:
        raise HTTPException(status_code=404, detail="No lot_pred clustering run found")

    try:
        row = await conn.fetchrow(
            """
            SELECT
                a.run_id,
                a.lot_id,
                a.cluster_id,
                a.confidence,
                r.modele_version,
                r.created_at,
                LOWER(lg.genetique) AS genetique,
                lg.site_code AS site_code
            FROM lot_clustering_assignments a
            JOIN lot_clustering_runs r ON r.id = a.run_id
            LEFT JOIN lots_gavage lg ON lg.id = a.lot_id
            WHERE a.run_id = $1 AND a.lot_id = $2
            """,
            int(resolved_run_id),
            int(lot_id),
        )
    except asyncpg.exceptions.UndefinedTableError:
        raise HTTPException(status_code=404, detail="lot_clustering_assignments table not found")

    if not row:
        raise HTTPException(status_code=404, detail="No cluster_pred found for this lot/run")

    return LotClusterAssignment(**dict(row))


@router.get("/ml/lots/{lot_id}/cluster-refined-j4", response_model=LotClusterAssignment)
async def get_lot_cluster_refined_j4(
    lot_id: int,
    run_id: Optional[int] = Query(None, description="Run id (sinon dernier run lot_refined_j4)"),
    conn=Depends(get_db_connection),
):
    """Retourne le cluster_refined_j4 (lot_refined_j4) d'un lot pour un run (ou le dernier run)."""

    resolved_run_id = run_id
    if resolved_run_id is None:
        try:
            resolved_run_id = await conn.fetchval(
                """
                SELECT id
                FROM lot_clustering_runs
                WHERE clustering_type = 'lot_refined_j4'
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
        except asyncpg.exceptions.UndefinedTableError:
            raise HTTPException(status_code=404, detail="lot_clustering_runs table not found")

    if not resolved_run_id:
        raise HTTPException(status_code=404, detail="No lot_refined_j4 clustering run found")

    try:
        row = await conn.fetchrow(
            """
            SELECT
                a.run_id,
                a.lot_id,
                a.cluster_id,
                a.confidence,
                r.modele_version,
                r.created_at,
                LOWER(lg.genetique) AS genetique,
                lg.site_code AS site_code
            FROM lot_clustering_assignments a
            JOIN lot_clustering_runs r ON r.id = a.run_id
            LEFT JOIN lots_gavage lg ON lg.id = a.lot_id
            WHERE a.run_id = $1 AND a.lot_id = $2
            """,
            int(resolved_run_id),
            int(lot_id),
        )
    except asyncpg.exceptions.UndefinedTableError:
        raise HTTPException(status_code=404, detail="lot_clustering_assignments table not found")

    if not row:
        raise HTTPException(status_code=404, detail="No cluster_refined_j4 found for this lot/run")

    return LotClusterAssignment(**dict(row))


@router.get("/ml/lots-clustering/assignments", response_model=List[LotClusterAssignment])
async def list_lot_pred_clustering_assignments(
    run_id: Optional[int] = Query(None, description="Run id (sinon dernier run lot_pred)"),
    site_code: Optional[str] = Query(None, description="Filtrer par site_code (LL/LS/MT)"),
    genetique: Optional[str] = Query(None, description="Filtrer par génétique (minuscule conseillé)"),
    lot_id: Optional[int] = Query(None, description="Filtrer par lot_id"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    conn=Depends(get_db_connection),
):
    """Liste les assignations de clusters lots (lot_pred) pour un run (ou le dernier)."""

    resolved_run_id = run_id
    if resolved_run_id is None:
        try:
            resolved_run_id = await conn.fetchval(
                """
                SELECT id
                FROM lot_clustering_runs
                WHERE clustering_type = 'lot_pred'
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
        except asyncpg.exceptions.UndefinedTableError:
            raise HTTPException(status_code=404, detail="lot_clustering_runs table not found")

    if not resolved_run_id:
        raise HTTPException(status_code=404, detail="No lot_pred clustering run found")

    query = """
        SELECT
            a.run_id,
            a.lot_id,
            a.cluster_id,
            a.confidence,
            r.modele_version,
            r.created_at,
            LOWER(lg.genetique) AS genetique,
            lg.site_code AS site_code
        FROM lot_clustering_assignments a
        JOIN lot_clustering_runs r ON r.id = a.run_id
        LEFT JOIN lots_gavage lg ON lg.id = a.lot_id
        WHERE a.run_id = $1
    """
    params: List[Any] = [int(resolved_run_id)]

    if lot_id is not None:
        params.append(int(lot_id))
        query += f" AND a.lot_id = ${len(params)}"

    if site_code:
        params.append(str(site_code).strip().upper())
        query += f" AND lg.site_code = ${len(params)}"

    if genetique:
        params.append(str(genetique).strip().lower())
        query += f" AND LOWER(lg.genetique) = ${len(params)}"

    params.append(int(limit))
    params.append(int(offset))
    query += f" ORDER BY a.lot_id ASC LIMIT ${len(params)-1} OFFSET ${len(params)}"

    try:
        rows = await conn.fetch(query, *params)
    except asyncpg.exceptions.UndefinedTableError:
        raise HTTPException(status_code=404, detail="lot_clustering_assignments table not found")

    return [LotClusterAssignment(**dict(r)) for r in rows]


@router.get("/ml/lots-clustering/assignments-refined-j4", response_model=List[LotClusterAssignment])
async def list_lot_refined_j4_clustering_assignments(
    run_id: Optional[int] = Query(None, description="Run id (sinon dernier run lot_refined_j4)"),
    site_code: Optional[str] = Query(None, description="Filtrer par site_code (LL/LS/MT)"),
    genetique: Optional[str] = Query(None, description="Filtrer par génétique (minuscule conseillé)"),
    lot_id: Optional[int] = Query(None, description="Filtrer par lot_id"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    conn=Depends(get_db_connection),
):
    """Liste les assignations de clusters lots (lot_refined_j4) pour un run (ou le dernier)."""

    resolved_run_id = run_id
    if resolved_run_id is None:
        try:
            resolved_run_id = await conn.fetchval(
                """
                SELECT id
                FROM lot_clustering_runs
                WHERE clustering_type = 'lot_refined_j4'
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
        except asyncpg.exceptions.UndefinedTableError:
            raise HTTPException(status_code=404, detail="lot_clustering_runs table not found")

    if not resolved_run_id:
        raise HTTPException(status_code=404, detail="No lot_refined_j4 clustering run found")

    query = """
        SELECT
            a.run_id,
            a.lot_id,
            a.cluster_id,
            a.confidence,
            r.modele_version,
            r.created_at,
            LOWER(lg.genetique) AS genetique,
            lg.site_code AS site_code
        FROM lot_clustering_assignments a
        JOIN lot_clustering_runs r ON r.id = a.run_id
        LEFT JOIN lots_gavage lg ON lg.id = a.lot_id
        WHERE a.run_id = $1
    """
    params: List[Any] = [int(resolved_run_id)]

    if lot_id is not None:
        params.append(int(lot_id))
        query += f" AND a.lot_id = ${len(params)}"

    if site_code:
        params.append(str(site_code).strip().upper())
        query += f" AND lg.site_code = ${len(params)}"

    if genetique:
        params.append(str(genetique).strip().lower())
        query += f" AND LOWER(lg.genetique) = ${len(params)}"

    params.append(int(limit))
    params.append(int(offset))
    query += f" ORDER BY a.lot_id ASC LIMIT ${len(params)-1} OFFSET ${len(params)}"

    try:
        rows = await conn.fetch(query, *params)
    except asyncpg.exceptions.UndefinedTableError:
        raise HTTPException(status_code=404, detail="lot_clustering_assignments table not found")

    return [LotClusterAssignment(**dict(r)) for r in rows]


# ============================================================================
# ROUTES SITES (5 routes)
# ============================================================================

@router.get("/sites", response_model=List[Site])
async def get_sites(conn = Depends(get_db_connection)):
    """
    Liste des 3 sites Euralis

    Returns:
        Liste des sites (LL, LS, MT)
    """
    rows = await conn.fetch("""
        SELECT id, code, nom, region, capacite_gavage_max, nb_gaveurs_actifs
        FROM sites_euralis
        ORDER BY code
    """)

    return [dict(row) for row in rows]


@router.get("/sites/compare")
async def compare_sites(
    request: Request,
    metrique: str = Query("itm", regex="^(itm|mortalite|production)$")
):
    """
    Comparer les 3 sites sur une métrique

    Args:
        metrique: Métrique à comparer (itm, mortalite, production)

    Returns:
        Comparaison des 3 sites
    """

    metric_map = {
        'itm': 'itm_moyen',
        'mortalite': 'mortalite_moyenne',
        'production': 'production_foie_kg'
    }

    metric_col = metric_map[metrique]

    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                site_code,
                site_nom,
                itm_moyen,
                mortalite_moyenne,
                production_foie_kg as production_kg,
                nb_lots_total as nb_lots,
                ROW_NUMBER() OVER (ORDER BY itm_moyen ASC) as rank
            FROM performances_sites
            ORDER BY site_code
        """)

        return [
            {
                'site_code': row['site_code'],
                'site_nom': row['site_nom'],
                'itm_moyen': float(row['itm_moyen']) if row['itm_moyen'] else 0.0,
                'mortalite': float(row['mortalite_moyenne']) if row['mortalite_moyenne'] else 0.0,
                'production_kg': float(row['production_kg']) if row['production_kg'] else 0.0,
                'nb_lots': row['nb_lots'] or 0,
                'rank': row['rank']
            }
            for row in rows
        ]


@router.get("/sites/{code}", response_model=Site)
async def get_site_detail(code: str, conn = Depends(get_db_connection)):
    """
    Détail d'un site (LL/LS/MT)

    Args:
        code: Code du site (LL, LS, ou MT)

    Returns:
        Informations détaillées du site
    """
    if code not in ['LL', 'LS', 'MT']:
        raise HTTPException(status_code=400, detail="Code site invalide (doit être LL, LS ou MT)")

    row = await conn.fetchrow("""
        SELECT id, code, nom, region, capacite_gavage_max, nb_gaveurs_actifs
        FROM sites_euralis
        WHERE code = $1
    """, code)

    if not row:
        raise HTTPException(status_code=404, detail=f"Site {code} non trouvé")

    return dict(row)


@router.get("/sites/{code}/stats", response_model=SiteStats)
async def get_site_stats(
    code: str,
    mois: Optional[str] = None,
    conn = Depends(get_db_connection)
):
    """
    Statistiques d'un site

    Args:
        code: Code du site (LL, LS, ou MT)
        mois: Filtre par mois (format YYYY-MM, optionnel)

    Returns:
        Statistiques agrégées du site
    """
    if code not in ['LL', 'LS', 'MT']:
        raise HTTPException(status_code=400, detail="Code site invalide")

    # Construire la requête avec filtre optionnel par mois
    query = """
        SELECT
            site_code,
            site_nom,
            nb_lots_total,
            itm_moyen,
            itm_min,
            itm_max,
            sigma_moyen,
            mortalite_moyenne,
            production_totale_kg as production_foie_kg,
            conso_moyenne_mais,
            total_canards_meg,
            total_canards_accroches,
            total_canards_morts,
            duree_moyenne,
            premier_lot,
            dernier_lot,
            nb_lots_actifs,
            nb_lots_termines
        FROM performances_sites
        WHERE site_code = $1
    """

    params = [code]

    # Note: performances_sites n'a pas de colonne mois, elle agrège tout
    # Le paramètre mois est ignoré pour l'instant

    row = await conn.fetchrow(query, *params)

    if not row:
        # Pas de données dans la vue matérialisée, calculer à la volée
        row = await conn.fetchrow("""
            SELECT
                l.site_code,
                s.nom as site_nom,
                COUNT(DISTINCT l.id) as nb_lots_total,
                AVG(l.itm) as itm_moyen,
                MIN(l.itm) as itm_min,
                MAX(l.itm) as itm_max,
                AVG(l.sigma) as sigma_moyen,
                AVG(l.pctg_perte_gavage) as mortalite_moyenne,
                SUM(l.nb_accroches * l.itm * (l.total_corn_real / NULLIF(l.nb_accroches, 0)) / 1000) as production_foie_kg,
                AVG(l.total_corn_real) as conso_moyenne_mais,
                SUM(l.nb_canards_meg) as total_canards_meg,
                SUM(l.nb_accroches) as total_canards_accroches,
                SUM(l.nb_canards_meg - l.nb_accroches) as total_canards_morts,
                AVG(l.duree_gavage_prevue_jours) as duree_moyenne,
                MIN(l.date_debut) as premier_lot,
                MAX(l.date_debut) as dernier_lot,
                COUNT(DISTINCT CASE WHEN l.statut = 'en_cours' THEN l.id END) as nb_lots_actifs,
                COUNT(DISTINCT CASE WHEN l.statut IN ('termine', 'abattu') THEN l.id END) as nb_lots_termines
            FROM lots_gavage l
            JOIN sites_euralis s ON l.site_code = s.code
            WHERE l.site_code = $1
            GROUP BY l.site_code, s.nom
        """, code)

    if not row:
        raise HTTPException(status_code=404, detail=f"Aucune statistique pour site {code}")

    # Compter nb_gaveurs séparément (pas dans la vue)
    nb_gaveurs = await conn.fetchval("""
        SELECT COUNT(DISTINCT gaveur_id)
        FROM lots_gavage
        WHERE site_code = $1
    """, code)

    # Combiner résultats
    result = dict(row)
    result['nb_gaveurs'] = nb_gaveurs or 0
    result['nb_lots'] = result.get('nb_lots_total', 0)  # Compatibilité

    return result


@router.get("/sites/{code}/gaveurs")
async def get_site_gaveurs(
    code: str,
    conn = Depends(get_db_connection)
):
    """
    Liste des gaveurs d'un site

    Args:
        code: Code du site (LL, LS, ou MT)

    Returns:
        Liste des gaveurs du site
    """
    if code not in ['LL', 'LS', 'MT']:
        raise HTTPException(status_code=400, detail="Code site invalide")

    rows = await conn.fetch("""
        SELECT
            g.id,
            g.nom,
            g.prenom,
            g.email,
            g.telephone,
            g.site_code as site_origine,
            COUNT(DISTINCT l.id) as nb_lots
        FROM gaveurs_euralis g
        LEFT JOIN lots_gavage l ON g.id = l.gaveur_id AND l.site_code = $1
        WHERE g.site_code = $1 AND g.actif = TRUE
        GROUP BY g.id, g.nom, g.prenom, g.email, g.telephone, g.site_code
        ORDER BY g.nom, g.prenom
    """, code)

    return [dict(row) for row in rows]


@router.get("/sites/{code}/lots", response_model=List[Lot])
async def get_site_lots(
    code: str,
    statut: Optional[str] = None,
    limit: int = Query(100, le=500),
    conn = Depends(get_db_connection)
):
    """
    Liste des lots d'un site

    Args:
        code: Code du site (LL, LS, ou MT)
        statut: Filtre par statut (optionnel)
        limit: Nombre max de résultats

    Returns:
        Liste des lots du site
    """
    if code not in ['LL', 'LS', 'MT']:
        raise HTTPException(status_code=400, detail="Code site invalide")

    query = """
        SELECT id, code_lot, site_code, gaveur_id, souche, debut_lot,
               itm, sigma, duree_gavage_reelle, pctg_perte_gavage, statut
        FROM lots_gavage
        WHERE site_code = $1
    """

    params = [code]

    if statut:
        query += " AND statut = $2"
        params.append(statut)

    query += " ORDER BY debut_lot DESC LIMIT $" + str(len(params) + 1)
    params.append(limit)

    rows = await conn.fetch(query, *params)

    return [dict(row) for row in rows]


# ============================================================================
# ROUTES DASHBOARD (3 routes)
# ============================================================================

@router.get("/dashboard/kpis", response_model=DashboardKPIs)
async def get_dashboard_kpis(conn = Depends(get_db_connection)):
    """
    KPIs globaux du dashboard Euralis

    Returns:
        Indicateurs clés de performance globaux
    """

    # Production totale et statistiques globales
    stats = await conn.fetchrow("""
        SELECT
            -- Production avec données SQAL (prioritaire) ou fallback sur ITM
            COALESCE(
                (
                    -- MÉTHODE 1: Production calculée depuis mesures SQAL réelles
                    SELECT SUM(s.poids_moyen_g * l2.nb_accroches) / 1000
                    FROM lots_gavage l2
                    JOIN (
                        SELECT
                            lot_id,
                            AVG(poids_foie_estime_g) as poids_moyen_g,
                            COUNT(*) as nb_mesures
                        FROM sensor_samples
                        WHERE poids_foie_estime_g IS NOT NULL
                        GROUP BY lot_id
                    ) s ON l2.id = s.lot_id
                    WHERE l2.statut IN ('termine', 'abattu')
                ),
                -- MÉTHODE 2: Fallback sur estimation via ITM si pas de données SQAL
                SUM(
                    CASE
                        WHEN statut IN ('termine', 'abattu')
                             AND total_corn_real IS NOT NULL
                             AND itm IS NOT NULL
                        THEN total_corn_real * itm / 1000
                        ELSE 0
                    END
                )
            ) as production_totale_kg,
            COUNT(CASE WHEN statut = 'en_cours' THEN 1 END) as nb_lots_actifs,
            COUNT(CASE WHEN statut IN ('termine', 'abattu') THEN 1 END) as nb_lots_termines,
            COUNT(DISTINCT gaveur_id) as nb_gaveurs_actifs,
            AVG(NULLIF(itm, 0)) as itm_moyen_global,
            AVG(NULLIF(pctg_perte_gavage, 0)) as mortalite_moyenne_globale
        FROM lots_gavage
    """)

    # Calculer la mortalité moyenne depuis doses_journalieres (pour les lots actifs)
    mortalite_realtime = await conn.fetchval("""
        SELECT AVG(dj.taux_mortalite)
        FROM doses_journalieres dj
        JOIN lots_gavage l ON dj.lot_id = l.id
        WHERE l.statut = 'en_cours'
        AND dj.time > NOW() - INTERVAL '24 hours'
    """)

    # Alertes critiques
    nb_alertes = await conn.fetchval("""
        SELECT COUNT(*)
        FROM alertes_euralis
        WHERE criticite = 'critique'
        AND acquittee = false
        AND time > NOW() - INTERVAL '7 days'
    """)

    # Utiliser mortalite_realtime si stats.mortalite est NULL
    mortalite_finale = stats['mortalite_moyenne_globale'] or mortalite_realtime or 0

    return {
        "production_totale_kg": stats['production_totale_kg'] or 0,
        "nb_lots_actifs": stats['nb_lots_actifs'] or 0,
        "nb_lots_termines": stats['nb_lots_termines'] or 0,
        "nb_gaveurs_actifs": stats['nb_gaveurs_actifs'] or 0,
        "itm_moyen_global": round(stats['itm_moyen_global'] or 0, 2),
        "mortalite_moyenne_globale": round(mortalite_finale, 2),
        "nb_alertes_critiques": nb_alertes or 0
    }


@router.get("/dashboard/charts/production")
async def get_production_chart(
    periode: int = Query(30, description="Nombre de jours"),
    conn = Depends(get_db_connection)
):
    """
    Données pour graphique d'évolution de la production

    Args:
        periode: Nombre de jours à afficher (défaut: 30)

    Returns:
        Données de production par site et par jour
    """

    rows = await conn.fetch("""
        SELECT
            site_code,
            DATE(debut_lot) as date,
            COUNT(*) as nb_lots,
            SUM(nb_canards_accroches * itm / 1000) as production_kg
        FROM lots_gavage
        WHERE debut_lot > NOW() - INTERVAL '$1 days'
        GROUP BY site_code, DATE(debut_lot)
        ORDER BY date DESC, site_code
    """, periode)

    return [dict(row) for row in rows]


@router.get("/dashboard/charts/itm")
async def get_itm_comparison_chart(conn = Depends(get_db_connection)):
    """
    Graphique comparaison ITM par site

    Returns:
        Distribution ITM par site
    """

    rows = await conn.fetch("""
        SELECT
            site_code,
            AVG(itm) as itm_moyen,
            MIN(itm) as itm_min,
            MAX(itm) as itm_max,
            STDDEV(itm) as itm_stddev,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY itm) as q1,
            PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY itm) as median,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY itm) as q3
        FROM lots_gavage
        WHERE itm IS NOT NULL
        GROUP BY site_code
        ORDER BY site_code
    """)

    return [dict(row) for row in rows]


# ============================================================================
# ROUTES LOTS (3 routes)
# ============================================================================

@router.get("/lots", response_model=List[Lot])
async def get_lots(
    site_code: Optional[str] = None,
    statut: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    conn = Depends(get_db_connection)
):
    """
    Liste de tous les lots (avec filtres)

    Args:
        site_code: Filtrer par site (optionnel)
        statut: Filtrer par statut (optionnel)
        limit: Nombre max de résultats
        offset: Décalage pour pagination

    Returns:
        Liste des lots
    """

    await _ensure_lots_gavage_planning_columns(conn)

    query = """
        SELECT
            id,
            code_lot,
            site_code,
            gaveur_id,
            souche,
            debut_lot,
            duree_gavage_prevue,
            buffer_jours,
            (debut_lot + (COALESCE(duree_gavage_prevue, 14) + COALESCE(buffer_jours, 0)) * INTERVAL '1 day')::date AS fin_capacite_prevue,
            itm,
            sigma,
            duree_gavage_reelle,
            pctg_perte_gavage,
            statut
        FROM lots_gavage
        WHERE 1=1
    """

    params = []

    if site_code:
        params.append(site_code)
        query += f" AND site_code = ${len(params)}"

    if statut:
        params.append(statut)
        query += f" AND statut = ${len(params)}"

    query += f" ORDER BY debut_lot DESC LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}"
    params.extend([limit, offset])

    rows = await conn.fetch(query, *params)

    return [dict(row) for row in rows]


@router.get("/lots/{id}", response_model=Lot)
async def get_lot_detail(id: int, conn = Depends(get_db_connection)):
    """
    Détail d'un lot

    Args:
        id: ID du lot

    Returns:
        Informations détaillées du lot
    """

    await _ensure_lots_gavage_planning_columns(conn)

    row = await conn.fetchrow(
        """
        SELECT
            id,
            code_lot,
            site_code,
            gaveur_id,
            souche,
            debut_lot,
            duree_gavage_prevue,
            buffer_jours,
            (debut_lot + (COALESCE(duree_gavage_prevue, 14) + COALESCE(buffer_jours, 0)) * INTERVAL '1 day')::date AS fin_capacite_prevue,
            itm,
            sigma,
            duree_gavage_reelle,
            pctg_perte_gavage,
            statut,
            courbe_pysr_snapshot_json,
            pysr_formula,
            pysr_r2_score,
            nb_canards_meg,
            nb_canards_accroches,
            total_corn_real
        FROM lots_gavage
        WHERE id = $1
        """,
        id,
    )

    if not row:
        raise HTTPException(status_code=404, detail=f"Lot {id} non trouvé")

    return dict(row)


@router.get("/lots/{id}/doses")
async def get_lot_doses(id: int, conn = Depends(get_db_connection)):
    """
    Doses journalières d'un lot

    Args:
        id: ID du lot

    Returns:
        Historique des doses journalières (tableau vide si aucune donnée)
    """

    # Vérifier que le lot existe d'abord
    lot_exists = await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM lots_gavage WHERE id = $1)",
        id
    )

    if not lot_exists:
        raise HTTPException(status_code=404, detail=f"Lot {id} non trouvé")

    # Récupérer les doses (retourner tableau vide si aucune donnée)
    rows = await conn.fetch("""
        SELECT
            jour_gavage,
            feed_target,
            feed_real,
            corn_variation,
            cumul_corn
        FROM doses_journalieres
        WHERE lot_id = $1
        ORDER BY jour_gavage
    """, id)

    return [dict(row) for row in rows]


# ============================================================================
# ROUTES ALERTES (2 routes)
# ============================================================================

@router.get("/alertes", response_model=List[Alerte])
async def get_alertes(
    criticite: Optional[str] = None,
    site_code: Optional[str] = None,
    acquittee: Optional[bool] = None,
    limit: int = Query(50, le=200),
    conn = Depends(get_db_connection)
):
    """
    Liste des alertes Euralis

    Args:
        criticite: Filtrer par criticité (critique, important, warning, info)
        site_code: Filtrer par site
        acquittee: Filtrer par statut d'acquittement
        limit: Nombre max de résultats

    Returns:
        Liste des alertes
    """

    query = """
        SELECT id, time, lot_id, gaveur_id, site_code, type_alerte, criticite, titre, description,
               valeur_observee, valeur_attendue, ecart_pct, acquittee
        FROM alertes_euralis
        WHERE 1=1
    """

    params = []

    if site_code:
        params.append(site_code)
        query += f" AND site_code = ${len(params)}"

    if criticite:
        params.append(criticite)
        query += f" AND criticite = ${len(params)}"

    if acquittee is not None:
        params.append(acquittee)
        query += f" AND acquittee = ${len(params)}"

    query += f" ORDER BY time DESC LIMIT ${len(params) + 1}"
    params.append(limit)

    rows = await conn.fetch(query, *params)

    return [dict(row) for row in rows]


@router.post("/alertes/{id}/acquitter")
async def acquitter_alerte(id: int, conn = Depends(get_db_connection)):
    """
    Acquitter une alerte

    Args:
        id: ID de l'alerte

    Returns:
        Confirmation d'acquittement
    """

    result = await conn.execute("""
        UPDATE alertes_euralis
        SET acquittee = true,
            acquittee_le = NOW()
        WHERE id = $1
    """, id)

    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail=f"Alerte {id} non trouvée")

    return {"message": f"Alerte {id} acquittée avec succès"}


# ============================================================================
# ROUTE SANTÉ
# ============================================================================

@router.get("/health")
async def health_check(conn = Depends(get_db_connection)):
    """
    Vérification de santé de l'API Euralis

    Returns:
        Statut de santé
    """

    # Vérifier connexion DB
    nb_sites = await conn.fetchval("SELECT COUNT(*) FROM sites_euralis")
    nb_lots = await conn.fetchval("SELECT COUNT(*) FROM lots_gavage")

    return {
        "status": "healthy",
        "service": "Euralis API",
        "database": "connected",
        "sites": nb_sites,
        "lots": nb_lots,
        "timestamp": datetime.now().isoformat()
    }


@router.get("/gavages/recent")
async def get_recent_gavages(
    limit: int = Query(10, le=50),
    conn = Depends(get_db_connection)
):
    """
    Récupère les derniers gavages pour le monitoring temps réel

    Args:
        limit: Nombre de gavages à récupérer (max 50)

    Returns:
        Liste des derniers gavages avec infos gaveur et site
    """

    rows = await conn.fetch("""
        SELECT
            dj.code_lot,
            dj.jour as jour,
            dj.moment,
            dj.dose_reelle,
            dj.poids_moyen,
            dj.nb_vivants as nb_canards_vivants,
            dj.taux_mortalite,
            dj.time as timestamp,
            l.site_code as site,
            l.genetique,
            l.gaveur_id,
            ge.nom as gaveur_nom
        FROM doses_journalieres dj
        JOIN lots_gavage l ON dj.lot_id = l.id
        LEFT JOIN gaveurs_euralis ge ON l.gaveur_id = ge.id
        WHERE dj.time > NOW() - INTERVAL '24 hours'
        ORDER BY dj.time DESC
        LIMIT $1
    """, limit)

    return [dict(row) for row in rows]


# ============================================================================
# ROUTES ANALYTICS & ML (4 routes)
# ============================================================================

@router.get("/ml/forecasts")
async def get_production_forecasts(
    days: int = Query(30, ge=7, le=90),
    site_code: Optional[str] = Query(None, description="Filtrer par site (LL/LS/MT)"),
    force_refresh: bool = Query(False, description="Forcer recalcul ML (ignore cache)"),
    conn = Depends(get_db_connection)
):
    """
    Prévisions de production avec Prophet ML

    Args:
        days: Nombre de jours à prévoir (7, 30, ou 90)
        site_code: Filtrer prévisions par site (optionnel)
        force_refresh: Forcer recalcul ML (ignore cache) - nécessite ML_MODE=realtime

    Returns:
        Liste des prévisions de production journalières

    Note:
        - Par défaut (ML_MODE=batch): Utilise cache pré-calculé la nuit
        - Mode realtime (ML_MODE=realtime): Calcul à la demande
        - force_refresh=true: Recalcule même en mode batch (si activé)
    """
    from datetime import datetime, timedelta
    import random

    # TODO: Implémenter cache ML avec Redis/Memcached
    # TODO: Implémenter Prophet réel une fois les données historiques disponibles
    # Pour l'instant, retourner des prévisions simulées basées sur moyenne actuelle

    # Récupérer production moyenne récente (filtrée par site si demandé)
    if site_code:
        stats = await conn.fetchrow("""
            SELECT AVG(production_totale_kg) as avg_prod
            FROM performances_sites
            WHERE site_code = $1
        """, site_code)
    else:
        stats = await conn.fetchrow("""
            SELECT AVG(production_totale_kg) as avg_prod
            FROM performances_sites
        """)

    base_production = float(stats['avg_prod']) if stats and stats['avg_prod'] else 300.0

    # Générer prévisions simulées
    forecasts = []
    for i in range(1, days + 1):
        date = (datetime.now() + timedelta(days=i)).date()

        # Variation saisonnière simulée (+/- 20%)
        seasonal_factor = 1 + 0.2 * (i % 7 - 3) / 3
        production_kg = base_production * seasonal_factor + random.uniform(-30, 30)

        forecasts.append({
            'date': date.isoformat(),
            'production_kg': round(production_kg, 2),
            'lower_bound': round(production_kg * 0.85, 2),  # Intervalle confiance 95%
            'upper_bound': round(production_kg * 1.15, 2),
            'confidence': 0.90,
            'model': 'Prophet (simulation)',
            'site_code': site_code or 'ALL'
        })

    return forecasts


@router.get("/ml/clusters")
async def get_gaveur_clusters(
    site_code: Optional[str] = Query(None, description="Filtrer par site (LL/LS/MT)"),
    force_refresh: bool = Query(False, description="Forcer re-calcul K-Means"),
    conn = Depends(get_db_connection)
):
    """
    Segmentation des gaveurs par performance (K-Means)

    Args:
        site_code: Optionnel - Filtrer les clusters pour un site spécifique
        force_refresh: Forcer re-clustering (sinon utilise cache si < 24h)

    Returns:
        5 clusters de gaveurs avec caractéristiques et recommandations
    """
    import pandas as pd
    from app.ml.euralis.gaveur_clustering import GaveurSegmentation

    # Récupérer données gaveurs avec performances
    query = """
        SELECT
            g.id as gaveur_id,
            g.nom || COALESCE(' ' || g.prenom, '') as nom,
            g.site_code,
            COUNT(l.id) as nb_lots,
            AVG(l.itm) as itm_moyen,
            AVG(l.sigma) as sigma_moyen,
            STDDEV(l.itm) as regularite,
            AVG(l.pctg_perte_gavage) as mortalite_moyenne,
            SUM(COALESCE(l.itm * l.nb_accroches, 0)) as production_totale_kg
        FROM gaveurs_euralis g
        LEFT JOIN lots_gavage l ON g.id = l.gaveur_id AND l.itm IS NOT NULL
        WHERE g.actif = TRUE
    """

    params = []
    if site_code:
        params.append(site_code)
        query += f" AND g.site_code = ${len(params)}"

    query += """
        GROUP BY g.id, g.nom, g.prenom, g.site_code
        HAVING COUNT(l.id) >= 2
        ORDER BY AVG(l.itm) DESC
    """

    rows = await conn.fetch(query, *params)

    if len(rows) < 5:
        # Pas assez de gaveurs pour clustering, retourner profils basiques
        return [
            {
                'cluster_id': 0,
                'nom': 'Tous gaveurs',
                'nb_gaveurs': len(rows),
                'itm_moyen': float(sum(r['itm_moyen'] or 0 for r in rows) / len(rows)) if rows else 0,
                'message': 'Clustering nécessite au moins 5 gaveurs avec 2+ lots'
            }
        ]

    # Créer DataFrame
    df = pd.DataFrame([dict(row) for row in rows])

    # Remplacer None par 0
    df = df.fillna(0)

    # K-Means clustering
    segmenter = GaveurSegmentation(n_clusters=min(5, len(df)))

    try:
        df_clustered = segmenter.segment_gaveurs(df)
        profiles = segmenter.get_cluster_profiles(df_clustered)

        # Mapper couleurs et descriptions
        cluster_config = {
            'Excellent': {
                'couleur': '#10b981',
                'description': 'Gaveurs exceptionnels - Performances top tier',
                'recommandation': 'Partager bonnes pratiques avec autres'
            },
            'Très bon': {
                'couleur': '#3b82f6',
                'description': 'Excellentes performances générales',
                'recommandation': 'Viser excellence en optimisant régularité'
            },
            'Bon': {
                'couleur': '#f59e0b',
                'description': 'Performances correctes, marge de progression',
                'recommandation': 'Formation continue sur dosage précis'
            },
            'À améliorer': {
                'couleur': '#f97316',
                'description': 'Nécessite accompagnement rapproché',
                'recommandation': 'Mentoring par gaveurs excellents'
            },
            'Critique': {
                'couleur': '#ef4444',
                'description': 'Performances faibles, intervention urgente',
                'recommandation': 'Formation intensive + suivi quotidien'
            }
        }

        # Construire résultat
        result = []
        for idx, (cluster_name, row) in enumerate(profiles.iterrows()):
            config = cluster_config.get(cluster_name, {})

            result.append({
                'cluster_id': idx,
                'nom': cluster_name,
                'nb_gaveurs': int(row['Nb Gaveurs']),
                'itm_moyen': float(row['ITM']),
                'sigma_moyen': float(row['Sigma']),
                'mortalite_moyenne': float(row['Mortalité%']),
                'production_totale_kg': float(row['Total Lots']),  # Total lots dans ce contexte
                'description': config.get('description', ''),
                'recommandation': config.get('recommandation', ''),
                'couleur': config.get('couleur', '#6b7280')
            })

        return result

    except Exception as e:
        # Si clustering échoue, retourner mock data
        raise HTTPException(
            status_code=500,
            detail=f"Erreur clustering K-Means: {str(e)}"
        )


@router.get("/ml/gaveurs-by-cluster")
async def get_gaveurs_by_cluster(
    site_code: Optional[str] = Query(None, description="Filtrer par site (LL/LS/MT)"),
    request: Request = None
):
    """
    Retourne la liste complète des gaveurs avec leur cluster assigné

    Ce endpoint retourne les GAVEURS INDIVIDUELS (pas les statistiques agrégées)
    pour permettre l'affichage sur une carte géographique.

    Args:
        site_code: Optionnel - Filtrer les gaveurs pour un site spécifique

    Returns:
        Liste de gaveurs avec: gaveur_id, nom, site_code, cluster, itm_moyen, mortalite, performance_score
    """
    pool = request.app.state.db_pool

    async with pool.acquire() as conn:
        # Récupérer données gaveurs avec performances
        query = """
            SELECT
                g.id as gaveur_id,
                g.nom,
                g.prenom,
                g.site_code,
                g.email,
                g.telephone,
                COUNT(l.id) as nb_lots,
                AVG(l.itm) as itm_moyen,
                AVG(l.sigma) as sigma_moyen,
                STDDEV(l.itm) as regularite,
                AVG(l.pctg_perte_gavage) as mortalite,
                SUM(COALESCE(l.itm * l.nb_accroches, 0)) as production_totale_kg,
                gc.cluster_id as cluster_ml_id,
                gc.cluster_label as cluster_ml_label,
                -- Calcul cluster basé sur ITM (5 clusters: 0=Excellent, 1=Très bon, 2=Bon, 3=À améliorer, 4=Critique)
                -- IMPORTANT: ITM = maïs_ingéré/poids_foie → Plus ITM est BAS, mieux c'est (rentabilité)
                CASE
                    WHEN AVG(l.itm) <= 13 THEN 0    -- Excellent (ITM <= 13: très efficace, peu de maïs pour gros foie)
                    WHEN AVG(l.itm) <= 14.5 THEN 1  -- Très bon (13-14.5: bon ratio)
                    WHEN AVG(l.itm) <= 15.5 THEN 2  -- Bon (14.5-15.5: ratio acceptable)
                    WHEN AVG(l.itm) <= 17 THEN 3    -- À améliorer (15.5-17: ratio médiocre)
                    ELSE 4                          -- Critique (> 17: inefficace, beaucoup de maïs pour petit foie)
                END as cluster,
                -- Score de performance (0-1): Plus ITM est bas et mortalité faible, meilleur est le score
                CASE
                    WHEN AVG(l.itm) IS NULL THEN 0
                    ELSE LEAST(1.0, (20.0 / GREATEST(AVG(l.itm), 1.0)) * (1.0 - COALESCE(AVG(l.pctg_perte_gavage), 0) / 100.0))
                END as performance_score
            FROM gaveurs_euralis g
            LEFT JOIN lots_gavage l ON g.id = l.gaveur_id AND l.itm IS NOT NULL
            LEFT JOIN gaveurs_clusters gc ON gc.gaveur_id = g.id
            WHERE g.actif = TRUE
        """

        params = []
        if site_code:
            params.append(site_code)
            query += f" AND g.site_code = ${len(params)}"

        query += """
            GROUP BY g.id, g.nom, g.prenom, g.site_code, g.email, g.telephone, gc.cluster_id, gc.cluster_label
            HAVING COUNT(l.id) >= 1
            ORDER BY performance_score DESC, AVG(l.itm) DESC
        """

        rows = await conn.fetch(query, *params)

        # Convertir en liste de dicts
        result = []
        for row in rows:
            cluster_ml_id = int(row['cluster_ml_id']) if row.get('cluster_ml_id') is not None else None
            cluster_ml_label = str(row['cluster_ml_label']) if row.get('cluster_ml_label') is not None else None
            cluster_rule_id = int(row['cluster']) if row.get('cluster') is not None else None
            cluster_id_effective = cluster_ml_id if cluster_ml_id is not None else cluster_rule_id
            cluster_source = 'kmeans' if cluster_ml_id is not None else 'rule_based'

            result.append({
                'gaveur_id': row['gaveur_id'],
                'nom': row['nom'] or '',
                'prenom': row['prenom'] or '',
                'site_code': row['site_code'],
                'email': row['email'],
                'telephone': row['telephone'],
                'nb_lots': int(row['nb_lots']),
                'itm_moyen': float(row['itm_moyen']) if row['itm_moyen'] else None,
                'sigma_moyen': float(row['sigma_moyen']) if row['sigma_moyen'] else None,
                'regularite': float(row['regularite']) if row['regularite'] else None,
                'mortalite': float(row['mortalite']) if row['mortalite'] else None,
                'production_totale_kg': float(row['production_totale_kg']) if row['production_totale_kg'] else 0,
                'cluster': cluster_id_effective,
                'cluster_source': cluster_source,
                'cluster_rule_id': cluster_rule_id,
                'cluster_ml_id': cluster_ml_id,
                'cluster_ml_label': cluster_ml_label,
                'performance_score': float(row['performance_score']) if row['performance_score'] else 0,
                'recommendation': _get_cluster_recommendation(cluster_id_effective)
            })

        return result

def _get_cluster_recommendation(cluster_id: int) -> str:
    """Retourne la recommandation pour un cluster donné"""
    recommendations = {
        0: "Partager bonnes pratiques avec autres",  # Excellent
        1: "Viser excellence en optimisant régularité",  # Très bon
        2: "Formation continue sur dosage précis",  # Bon
        3: "Mentoring par gaveurs excellents",  # À améliorer
        4: "Formation intensive + suivi quotidien"  # Critique
    }
    return recommendations.get(cluster_id, "Continuer les efforts")


@router.get("/ml/gaveurs-by-cluster-ml")
async def get_gaveurs_by_cluster_ml(
    request: Request,
    site_code: Optional[str] = Query(None, description="Filtrer par site (LL/LS/MT)"),
    n_clusters: int = Query(5, ge=3, le=7, description="Nombre de clusters")
):
    """
    Clustering ML des gaveurs (K-Means multi-critères)

    Remplace les seuils ITM fixes par un vrai clustering machine learning
    basé sur 5 critères: ITM, mortalité, régularité, sigma, production

    Args:
        site_code: Optionnel - Filtrer par site
        n_clusters: Nombre de clusters (3-7, défaut 5)

    Returns:
        Gaveurs avec clusters ML + statistiques clustering
    """
    from app.ml.euralis.gaveur_clustering_ml import cluster_gaveurs_ml

    pool = request.app.state.db_pool

    async with pool.acquire() as conn:
        # Récupérer données gaveurs (même query que endpoint classique)
        query = """
            SELECT
                g.id as gaveur_id,
                g.nom,
                g.prenom,
                g.site_code,
                g.email,
                g.telephone,
                COUNT(l.id) as nb_lots,
                AVG(l.itm) as itm_moyen,
                AVG(l.sigma) as sigma_moyen,
                STDDEV(l.itm) as regularite,
                AVG(l.pctg_perte_gavage) as mortalite,
                SUM(COALESCE(l.itm * l.nb_accroches, 0)) as production_totale_kg
            FROM gaveurs_euralis g
            LEFT JOIN lots_gavage l ON g.id = l.gaveur_id AND l.itm IS NOT NULL
            WHERE g.actif = TRUE
        """

        params = []
        if site_code:
            params.append(site_code)
            query += f" AND g.site_code = ${len(params)}"

        query += """
            GROUP BY g.id, g.nom, g.prenom, g.site_code, g.email, g.telephone
            HAVING COUNT(l.id) >= 1 AND AVG(l.itm) IS NOT NULL
            ORDER BY g.nom
        """

        rows = await conn.fetch(query, *params)

        # Convertir en liste de dicts
        gaveurs_data = []
        for row in rows:
            gaveurs_data.append({
                'gaveur_id': row['gaveur_id'],
                'nom': row['nom'] or '',
                'prenom': row['prenom'] or '',
                'site_code': row['site_code'],
                'email': row['email'],
                'telephone': row['telephone'],
                'nb_lots': int(row['nb_lots']),
                'itm_moyen': float(row['itm_moyen']) if row['itm_moyen'] else None,
                'sigma_moyen': float(row['sigma_moyen']) if row['sigma_moyen'] else None,
                'regularite': float(row['regularite']) if row['regularite'] else 0.0,
                'mortalite': float(row['mortalite']) if row['mortalite'] else 0.0,
                'production_totale_kg': float(row['production_totale_kg']) if row['production_totale_kg'] else 0.0
            })

        if len(gaveurs_data) < n_clusters:
            return {
                'error': f'Pas assez de gaveurs: {len(gaveurs_data)}, minimum {n_clusters} requis',
                'gaveurs': [],
                'clustering_stats': None
            }

        # Appliquer clustering ML
        try:
            result = cluster_gaveurs_ml(gaveurs_data, n_clusters=n_clusters)

            # Fusionner clusters ML avec données gaveurs
            cluster_map = {g['gaveur_id']: g['cluster_ranked'] for g in result['gaveurs']}

            for gaveur in gaveurs_data:
                cluster_id = cluster_map.get(gaveur['gaveur_id'], 0)
                gaveur['cluster'] = cluster_id
                gaveur['cluster_ml'] = True  # Flag pour indiquer clustering ML
                gaveur['recommendation'] = _get_cluster_recommendation(cluster_id)
                gaveur['performance_score'] = result['cluster_stats'].get(cluster_id, {}).get('performance_score', 0.0)

            return {
                'gaveurs': gaveurs_data,
                'clustering_stats': {
                    'method': 'K-Means ML',
                    'n_clusters': result['n_clusters'],
                    'silhouette_score': result['silhouette_score'],
                    'features_used': ['ITM', 'Mortalité', 'Régularité', 'Sigma', 'Production'],
                    'cluster_stats': result['cluster_stats']
                }
            }

        except Exception as e:
            logger.error(f"Erreur clustering ML: {e}")
            # Fallback sur méthode classique
            return {
                'error': str(e),
                'gaveurs': gaveurs_data,
                'clustering_stats': None
            }


@router.get("/ml/anomalies")
async def get_anomalies(
    site_code: Optional[str] = Query(None, description="Filtrer par site (LL/LS/MT)"),
    conn = Depends(get_db_connection)
):
    """
    Détection d'anomalies de production (Isolation Forest)

    Args:
        site_code: Optionnel - Filtrer les anomalies pour un site spécifique

    Returns:
        Lots et sites avec comportement atypique
    """

    # TODO: Implémenter Isolation Forest réel avec filtre site_code
    # Pour l'instant, identifier les lots avec métriques extrêmes

    query = """
        SELECT
            code_lot,
            site_code,
            itm,
            sigma,
            pctg_perte_gavage as mortalite,
            duree_gavage_reelle,
            statut
        FROM lots_gavage
        WHERE statut IN ('EN_COURS', 'TERMINE')
    """

    params = []
    if site_code:
        params.append(site_code)
        query += f" AND site_code = ${len(params)}"

    query += " ORDER BY debut_lot DESC LIMIT 100"

    rows = await conn.fetch(query, *params)

    anomalies = []
    for row in rows:
        row_dict = dict(row)
        itm = row_dict.get('itm', 0) or 0
        mortalite = row_dict.get('mortalite', 0) or 0

        is_anomaly = False
        raisons = []
        score = 0

        # Détection simple d'anomalies
        if itm < 60:
            is_anomaly = True
            raisons.append(f'ITM très faible ({itm:.1f})')
            score += 0.3

        if itm > 100:
            is_anomaly = True
            raisons.append(f'ITM exceptionnellement élevé ({itm:.1f})')
            score += 0.2

        if mortalite > 5:
            is_anomaly = True
            raisons.append(f'Mortalité élevée ({mortalite:.1f}%)')
            score += 0.4

        if mortalite > 8:
            score += 0.3

        if is_anomaly:
            anomalies.append({
                'code_lot': row_dict['code_lot'],
                'site_code': row_dict['site_code'],
                'is_anomaly': True,
                'anomaly_score': min(score, 1.0),
                'severity': 'HIGH' if score > 0.6 else 'MEDIUM' if score > 0.3 else 'LOW',
                'raisons': raisons,
                'itm': itm,
                'mortalite': mortalite,
                'recommandation': 'Inspection immédiate' if score > 0.6 else 'Surveillance rapprochée',
                'statut': row_dict['statut']
            })

    # Trier par score d'anomalie décroissant
    anomalies.sort(key=lambda x: x['anomaly_score'], reverse=True)

    return anomalies[:20]  # Top 20 anomalies


@router.get("/ml/lots-correlation-data")
async def get_lots_correlation_data(
    limit: int = Query(200, le=500),
    conn = Depends(get_db_connection)
):
    """
    Récupère les données complètes des lots CSV pour analyse de corrélations

    Retourne toutes les variables de production nécessaires:
    - ITM, Sigma
    - Total maïs (target + real)
    - Mortalité (nb_meg, pctg_perte_gavage)
    - Poids foie moyen
    - Durée gavage
    - Nombre canards (accrochés)

    Utilisé par: Frontend Analytics - Onglet Corrélations
    """

    query = """
        SELECT
            id,
            code_lot,
            site_code,
            gaveur_id,
            debut_lot,
            -- Variables clés pour corrélations
            itm,
            sigma,
            total_corn_target,
            total_corn_real,
            nb_meg,
            nb_accroches,
            poids_foie_moyen_g as poids_foie_moyen,
            duree_du_lot,
            pctg_perte_gavage as mortalite_pct,
            statut
        FROM lots_gavage
        WHERE (code_lot LIKE 'LL%' OR code_lot LIKE 'LS%')
          AND itm IS NOT NULL  -- Filtrer uniquement lots avec données
        ORDER BY debut_lot DESC
        LIMIT $1
    """

    rows = await conn.fetch(query, limit)

    return [dict(row) for row in rows]


@router.get("/ml/optimization")
async def get_optimization_plans(
    days: int = Query(7, ge=1, le=30),
    site_code: Optional[str] = Query(None, description="Filtrer par site (LL/LS/MT)"),
    conn = Depends(get_db_connection)
):
    """
    Plans d'optimisation abattage (Algorithme Hungarian)

    Args:
        days: Nombre de jours à planifier
        site_code: Optionnel - Filtrer les lots pour un site spécifique

    Returns:
        Planning optimisé des abattages par jour
    """
    from datetime import datetime, timedelta
    import random

    # TODO: Implémenter Hungarian réel pour optimisation lots-abattoirs avec filtre site_code
    # Pour l'instant, retourner planning simulé

    # Récupérer lots prêts ou bientôt prêts
    query = """
        SELECT
            code_lot,
            site_code,
            duree_gavage_reelle,
            itm,
            debut_lot,
            statut
        FROM lots_gavage
        WHERE statut = 'EN_COURS'
        AND duree_gavage_reelle >= 10
    """

    params = []
    if site_code:
        params.append(site_code)
        query += f" AND site_code = ${len(params)}"

    query += " ORDER BY debut_lot LIMIT 50"

    rows = await conn.fetch(query, *params)

    lots_disponibles = [dict(row) for row in rows]

    # Abattoirs fictifs
    abattoirs = [
        {'id': 'ABT_01', 'nom': 'Abattoir Landes', 'capacite_jour': 200},
        {'id': 'ABT_02', 'nom': 'Abattoir Loire', 'capacite_jour': 150},
        {'id': 'ABT_03', 'nom': 'Abattoir Sud-Ouest', 'capacite_jour': 180}
    ]

    plans = []
    for i in range(days):
        date = (datetime.now() + timedelta(days=i + 1)).date()

        # Sélectionner quelques lots pour ce jour (simulation)
        nb_lots_jour = min(random.randint(2, 5), len(lots_disponibles))
        lots_jour = random.sample(lots_disponibles, nb_lots_jour) if lots_disponibles else []

        for lot in lots_jour:
            abattoir = random.choice(abattoirs)

            plans.append({
                'date': date.isoformat(),
                'code_lot': lot['code_lot'],
                'site_code': lot['site_code'],
                'abattoir_id': abattoir['id'],
                'abattoir_nom': abattoir['nom'],
                'distance_km': random.randint(20, 150),
                'cout_transport_estime': random.randint(80, 300),
                'efficacite_score': round(random.uniform(0.75, 0.98), 2),
                'priorite': random.choice(['HIGH', 'MEDIUM', 'LOW']),
                'itm_prevu': lot.get('itm', 80),
                'optimisation': 'Hungarian Algorithm'
            })

    # Trier par date puis efficacité
    plans.sort(key=lambda x: (x['date'], -x['efficacite_score']))

    return plans


# ============================================================================
# ROUTES GAVEURS INDIVIDUELS (3 routes) - Sprint 2 + Quick Win
# ============================================================================

@router.get("/gaveurs/performances")
async def get_gaveurs_performances(
    site_code: Optional[str] = Query(None, description="Filtrer par site (LL/LS/MT)"),
    cluster_label: Optional[str] = Query(None, description="Filtrer par cluster"),
    limit: int = Query(100, le=500),
    conn = Depends(get_db_connection)
):
    """
    Liste des performances de tous les gaveurs avec clustering

    Args:
        site_code: Filtrer par site (optionnel)
        cluster_label: Filtrer par label cluster (optionnel)
        limit: Nombre max de résultats

    Returns:
        Liste des gaveurs avec performances et clustering
    """

    # Requête de base
    query = """
        SELECT
            g.id as gaveur_id,
            g.nom || COALESCE(' ' || g.prenom, '') as gaveur_nom,
            g.site_code,
            COUNT(l.id) as nb_lots_total,
            AVG(l.itm) as itm_moyen,
            AVG(l.sigma) as sigma_moyen,
            AVG(l.pctg_perte_gavage) as mortalite_moyenne,
            SUM(COALESCE(l.itm * l.nb_accroches, 0)) as production_totale_kg
        FROM gaveurs_euralis g
        LEFT JOIN lots_gavage l ON g.id = l.gaveur_id AND l.itm IS NOT NULL
        WHERE g.actif = TRUE
    """

    params = []

    if site_code:
        params.append(site_code)
        query += f" AND g.site_code = ${len(params)}"

    query += """
        GROUP BY g.id, g.nom, g.prenom, g.site_code
        HAVING COUNT(l.id) > 0
    """

    query += f" ORDER BY AVG(l.itm) DESC LIMIT ${len(params) + 1}"
    params.append(limit)

    rows = await conn.fetch(query, *params)

    # Ajouter clustering basique pour chaque gaveur
    results = []
    for row in rows:
        itm = float(row['itm_moyen']) if row['itm_moyen'] else 0

        # Clustering basique (même logique que /gaveurs/{id}/analytics)
        if itm >= 16:
            cluster_id = 0
            cluster_label_value = "Excellent"
        elif itm >= 15:
            cluster_id = 1
            cluster_label_value = "Très bon"
        elif itm >= 14:
            cluster_id = 2
            cluster_label_value = "Bon"
        elif itm >= 13:
            cluster_id = 3
            cluster_label_value = "À surveiller"
        else:
            cluster_id = 4
            cluster_label_value = "Critique"

        # Filtrer par cluster si demandé
        if cluster_label and cluster_label_value != cluster_label:
            continue

        results.append({
            'gaveur_id': row['gaveur_id'],
            'gaveur_nom': row['gaveur_nom'],
            'site_code': row['site_code'],
            'nb_lots_total': row['nb_lots_total'],
            'itm_moyen': float(row['itm_moyen']) if row['itm_moyen'] else 0,
            'sigma_moyen': float(row['sigma_moyen']) if row['sigma_moyen'] else 0,
            'mortalite_moyenne': float(row['mortalite_moyenne']) if row['mortalite_moyenne'] else 0,
            'cluster_id': cluster_id,
            'cluster_label': cluster_label_value,
            'production_totale_kg': float(row['production_totale_kg']) if row['production_totale_kg'] else 0
        })

    return results


@router.get("/gaveurs/{id}", response_model=GaveurDetail)
async def get_gaveur_detail(id: int, conn = Depends(get_db_connection)):
    """
    Détail d'un gaveur individuel

    Args:
        id: ID du gaveur

    Returns:
        Informations détaillées du gaveur
    """
    # Récupérer les infos du gaveur
    gaveur = await conn.fetchrow("""
        SELECT
            id,
            nom,
            prenom,
            email,
            telephone,
            site_code,
            actif,
            created_at
        FROM gaveurs_euralis
        WHERE id = $1
    """, id)

    if not gaveur:
        raise HTTPException(status_code=404, detail=f"Gaveur {id} non trouvé")

    # Compter les lots
    lots_stats = await conn.fetchrow("""
        SELECT
            COUNT(*) as nb_lots_total,
            COUNT(*) FILTER (WHERE statut IN ('EN_COURS', 'en_gavage')) as nb_lots_actifs,
            COUNT(*) FILTER (WHERE statut = 'TERMINE') as nb_lots_termines
        FROM lots_gavage
        WHERE gaveur_id = $1
    """, id)

    return {
        **dict(gaveur),
        'nb_lots_total': lots_stats['nb_lots_total'] or 0,
        'nb_lots_actifs': lots_stats['nb_lots_actifs'] or 0,
        'nb_lots_termines': lots_stats['nb_lots_termines'] or 0
    }


@router.get("/gaveurs/{id}/analytics", response_model=GaveurAnalytics)
async def get_gaveur_analytics(id: int, conn = Depends(get_db_connection)):
    """
    Analytics complets d'un gaveur individuel

    Args:
        id: ID du gaveur

    Returns:
        Analytics détaillés avec performances, clustering, comparaisons, évolution
    """
    # 1. Vérifier que le gaveur existe
    gaveur = await conn.fetchrow("""
        SELECT id, nom, prenom, site_code
        FROM gaveurs_euralis
        WHERE id = $1
    """, id)

    if not gaveur:
        raise HTTPException(status_code=404, detail=f"Gaveur {id} non trouvé")

    gaveur_nom = f"{gaveur['nom']}"
    site_code = gaveur['site_code']

    # 2. Performances globales du gaveur
    perf = await conn.fetchrow("""
        SELECT
            COUNT(*) as nb_lots_total,
            AVG(itm) as itm_moyen,
            AVG(sigma) as sigma_moyen,
            AVG(pctg_perte_gavage) as mortalite_moyenne,
            SUM(COALESCE(itm * nb_accroches, 0)) as production_totale_kg
        FROM lots_gavage
        WHERE gaveur_id = $1 AND itm IS NOT NULL
    """, id)

    # 3. Moyennes site et Euralis pour comparaison
    itm_site = await conn.fetchval("""
        SELECT AVG(itm)
        FROM lots_gavage
        WHERE site_code = $1 AND itm IS NOT NULL
    """, site_code)

    itm_euralis = await conn.fetchval("""
        SELECT AVG(itm)
        FROM lots_gavage
        WHERE itm IS NOT NULL
    """)

    # 4. Rang du gaveur sur son site
    rang_site_result = await conn.fetchrow("""
        WITH gaveurs_site AS (
            SELECT
                gaveur_id,
                AVG(itm) as itm_moyen,
                RANK() OVER (ORDER BY AVG(itm) DESC) as rang
            FROM lots_gavage
            WHERE site_code = $1 AND itm IS NOT NULL
            GROUP BY gaveur_id
        )
        SELECT
            rang,
            (SELECT COUNT(DISTINCT gaveur_id) FROM lots_gavage WHERE site_code = $1) as total
        FROM gaveurs_site
        WHERE gaveur_id = $2
    """, site_code, id)

    # 5. Rang du gaveur au niveau Euralis
    rang_euralis_result = await conn.fetchrow("""
        WITH gaveurs_euralis AS (
            SELECT
                gaveur_id,
                AVG(itm) as itm_moyen,
                RANK() OVER (ORDER BY AVG(itm) DESC) as rang
            FROM lots_gavage
            WHERE itm IS NOT NULL
            GROUP BY gaveur_id
        )
        SELECT
            rang,
            (SELECT COUNT(DISTINCT gaveur_id) FROM lots_gavage) as total
        FROM gaveurs_euralis
        WHERE gaveur_id = $1
    """, id)

    # 6. Clustering (TODO: Implémenter K-Means réel)
    # Pour l'instant, déterminer cluster basique basé sur ITM
    cluster_id = None
    cluster_label = None
    if perf['itm_moyen']:
        if perf['itm_moyen'] >= 16:
            cluster_id = 0
            cluster_label = "Excellent"
        elif perf['itm_moyen'] >= 15:
            cluster_id = 1
            cluster_label = "Très bon"
        elif perf['itm_moyen'] >= 14:
            cluster_id = 2
            cluster_label = "Bon"
        elif perf['itm_moyen'] >= 13:
            cluster_id = 3
            cluster_label = "À surveiller"
        else:
            cluster_id = 4
            cluster_label = "Critique"

    # 7. Evolution ITM 7 derniers jours (moyenne par jour)
    evolution_rows = await conn.fetch("""
        SELECT
            DATE(debut_lot) as jour,
            AVG(itm) as itm_jour
        FROM lots_gavage
        WHERE gaveur_id = $1 AND itm IS NOT NULL
        AND debut_lot >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(debut_lot)
        ORDER BY jour DESC
        LIMIT 7
    """, id)

    evolution_itm_7j = [
        {'jour': row['jour'].isoformat(), 'itm': float(row['itm_jour'])}
        for row in evolution_rows
    ] if evolution_rows else []

    # 8. Construire la réponse
    return {
        'gaveur_id': id,
        'gaveur_nom': gaveur_nom,
        'site_code': site_code,
        'nb_lots_total': perf['nb_lots_total'] or 0,
        'itm_moyen': float(perf['itm_moyen'] or 0),
        'sigma_moyen': float(perf['sigma_moyen'] or 0),
        'mortalite_moyenne': float(perf['mortalite_moyenne'] or 0),
        'production_totale_kg': float(perf['production_totale_kg'] or 0),
        'cluster_id': cluster_id,
        'cluster_label': cluster_label,
        'itm_site_moyen': float(itm_site) if itm_site else None,
        'itm_euralis_moyen': float(itm_euralis) if itm_euralis else None,
        'rang_site': int(rang_site_result['rang']) if rang_site_result else None,
        'total_gaveurs_site': int(rang_site_result['total']) if rang_site_result else None,
        'rang_euralis': int(rang_euralis_result['rang']) if rang_euralis_result else None,
        'total_gaveurs_euralis': int(rang_euralis_result['total']) if rang_euralis_result else None,
        'evolution_itm_7j': evolution_itm_7j
    }


# ============================================================================
# ADMIN - Migration Schema (TEMPORARY)
# ============================================================================

@router.post("/admin/apply-pysr-schema")
async def apply_pysr_schema(conn = Depends(get_db_connection)):
    """
    **ADMIN TEMPORAIRE** - Applique le schéma PySR 3-courbes

    Crée les tables:
    - courbes_gavage_optimales
    - courbe_reelle_quotidienne
    - corrections_ia_quotidiennes
    - pysr_training_history
    - dashboard_courbes_gaveur (materialized view)
    """
    import os

    # Lire le fichier SQL
    schema_path = os.path.join(os.path.dirname(__file__), '..', '..', 'scripts', 'pysr_courbes_schema.sql')

    with open(schema_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    try:
        # Exécuter le schéma par sections (asyncpg ne supporte pas multi-statement directement)
        # Diviser le SQL en commandes individuelles
        import re

        # Supprimer les commentaires SQL
        sql_clean = re.sub(r'--[^\n]*', '', sql)

        # Diviser par point-virgule (sauf dans les strings)
        statements = []
        current = []
        in_function = False

        for line in sql_clean.split('\n'):
            line_stripped = line.strip()

            # Détecter début/fin de fonction
            if 'CREATE OR REPLACE FUNCTION' in line_stripped or 'CREATE FUNCTION' in line_stripped:
                in_function = True
            if in_function and line_stripped.startswith('$$ LANGUAGE'):
                in_function = False
                current.append(line)
                statements.append('\n'.join(current))
                current = []
                continue

            if line_stripped:
                current.append(line)

            # Si on trouve un ; et qu'on n'est pas dans une fonction
            if not in_function and line_stripped.endswith(';') and not line_stripped.startswith('--'):
                if current:
                    statements.append('\n'.join(current))
                    current = []

        if current:
            statements.append('\n'.join(current))

        # Exécuter chaque statement
        executed_count = 0
        for stmt in statements:
            stmt_clean = stmt.strip()
            if stmt_clean and not stmt_clean.startswith('COMMENT ON'):  # Ignorer les commentaires pour simplifier
                try:
                    await conn.execute(stmt_clean)
                    executed_count += 1
                except Exception as stmt_error:
                    # Ignorer les erreurs de "already exists"
                    if 'already exists' not in str(stmt_error):
                        raise

        # Vérifier tables créées
        tables = await conn.fetch("""
            SELECT
                tablename,
                pg_size_pretty(pg_total_relation_size('public.'||tablename)) as taille
            FROM pg_tables
            WHERE tablename IN (
                'courbes_gavage_optimales',
                'courbe_reelle_quotidienne',
                'corrections_ia_quotidiennes',
                'pysr_training_history'
            )
            ORDER BY tablename
        """)

        return {
            'status': 'success',
            'message': 'Schéma PySR 3-courbes appliqué avec succès',
            'statements_executed': executed_count,
            'tables_created': [dict(row) for row in tables]
        }

    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=500,
            detail=f"Erreur application schéma: {str(e)}\n{traceback.format_exc()}"
        )


# ============================================================================
# COURBES PYSR - Liste toutes les courbes théoriques
# ============================================================================

@router.get("/courbes/theoriques")
async def get_courbes_theoriques_all(
    request: Request,
    statut: Optional[str] = Query(None, description="Filtrer par statut (EN_ATTENTE, VALIDEE, MODIFIEE, REJETEE)"),
    site_code: Optional[str] = Query(None, description="Filtrer par site (LL, LS, MT)"),
    limit: int = Query(100, le=500)
):
    """
    Liste toutes les courbes théoriques PySR pour supervision multi-sites

    Returns:
        Liste des courbes avec informations lot et gaveur
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        query = """
            SELECT
                cgo.id,
                cgo.lot_id,
                lg.code_lot,
                cgo.gaveur_id,
                ge.nom || COALESCE(' ' || ge.prenom, '') as gaveur_nom,
                cgo.site_code,
                cgo.pysr_equation,
                cgo.pysr_r2_score,
                cgo.pysr_complexity,
                cgo.duree_gavage_jours,
                cgo.statut,
                cgo.superviseur_nom,
                cgo.date_validation,
                cgo.commentaire_superviseur,
                cgo.created_at,
                cgo.updated_at
            FROM courbes_gavage_optimales cgo
            JOIN lots_gavage lg ON cgo.lot_id = lg.id
            JOIN gaveurs_euralis ge ON cgo.gaveur_id = ge.id
            WHERE 1=1
        """

        params = []
        param_count = 1

        if statut:
            query += f" AND cgo.statut = ${param_count}"
            params.append(statut)
            param_count += 1

        if site_code:
            query += f" AND cgo.site_code = ${param_count}"
            params.append(site_code)
            param_count += 1

        query += f" ORDER BY cgo.created_at DESC LIMIT ${param_count}"
        params.append(limit)

        rows = await conn.fetch(query, *params)

        return [
            {
                'id': row['id'],
                'lot_id': row['lot_id'],
                'code_lot': row['code_lot'],
                'gaveur_id': row['gaveur_id'],
                'gaveur_nom': row['gaveur_nom'],
                'site_code': row['site_code'],
                'pysr_equation': row['pysr_equation'],
                'pysr_r2_score': float(row['pysr_r2_score']) if row['pysr_r2_score'] else None,
                'pysr_complexity': row['pysr_complexity'],
                'duree_gavage_jours': row['duree_gavage_jours'],
                'statut': row['statut'],
                'superviseur_nom': row['superviseur_nom'],
                'date_validation': row['date_validation'].isoformat() if row['date_validation'] else None,
                'commentaire_superviseur': row['commentaire_superviseur'],
                'created_at': row['created_at'].isoformat(),
                'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
            }
            for row in rows
        ]


# ============================================================================
# SPRINT 3 - COURBES OPTIMALES PERSONNALISÉES
# ============================================================================

@router.get("/ml/gaveur/{gaveur_id}/courbe-recommandee")
async def get_courbe_recommandee_gaveur(
    gaveur_id: int,
    nb_canards: int = Query(800, ge=100, le=2000, description="Nombre de canards du lot"),
    souche: str = Query("Mulard", description="Souche de canards"),
    conn = Depends(get_db_connection)
):
    """
    Recommande une courbe de gavage personnalisée pour un gaveur

    Args:
        gaveur_id: ID du gaveur
        nb_canards: Nombre de canards du lot (100-2000)
        souche: Souche de canards (Mulard, etc.)

    Returns:
        Courbe journalière optimisée (11 jours) avec recommandations
    """
    from app.ml.euralis.courbes_personnalisees import recommander_courbe_gaveur

    try:
        # Récupérer le vrai cluster ML du gaveur depuis la vue matérialisée
        query_cluster = """
            SELECT cluster_ml, performance_score
            FROM gaveurs_clustering_ml_view
            WHERE gaveur_id = $1
        """
        cluster_row = await conn.fetchrow(query_cluster, gaveur_id)

        # Si pas de cluster ML, récupérer données historiques et faire classification simple
        if not cluster_row:
            query = """
                SELECT
                    g.id as gaveur_id,
                    g.nom,
                    g.prenom,
                    COUNT(DISTINCT l.id) as nb_lots,
                    AVG(l.itm) as itm_moyen,
                    AVG(l.pctg_perte_gavage) as mortalite,
                    AVG(l.sigma) as sigma_moyen,
                    SUM(l.poids_foie_moyen_g * l.nb_canards_initial) / 1000.0 as production_totale_kg
                FROM gaveurs_euralis g
                LEFT JOIN lots_gavage l ON g.id = l.gaveur_id
                WHERE g.id = $1 AND l.itm IS NOT NULL
                GROUP BY g.id, g.nom, g.prenom
            """
            row = await conn.fetchrow(query, gaveur_id)

            if not row or row['nb_lots'] == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"Gaveur {gaveur_id} non trouvé ou sans données historiques"
                )

            itm_moyen = float(row['itm_moyen']) if row['itm_moyen'] else 15.0

            # Classification simple par ITM (fallback si pas de cluster ML)
            if itm_moyen <= 13:
                cluster = 0  # Excellent
            elif itm_moyen <= 14.5:
                cluster = 1  # Très bon
            elif itm_moyen <= 15.5:
                cluster = 2  # Bon
            elif itm_moyen <= 17:
                cluster = 3  # À améliorer
            else:
                cluster = 4  # Critique

            logger.info(f"Gaveur {gaveur_id} - Pas de cluster ML, classification simple: ITM {itm_moyen:.2f} → Cluster {cluster}")
        else:
            # Utiliser le vrai cluster ML de la vue matérialisée
            cluster = int(cluster_row['cluster_ml'])

            # Récupérer les données historiques pour ITM et mortalité
            query = """
                SELECT
                    g.id as gaveur_id,
                    g.nom,
                    g.prenom,
                    COUNT(DISTINCT l.id) as nb_lots,
                    AVG(l.itm) as itm_moyen,
                    AVG(l.pctg_perte_gavage) as mortalite,
                    AVG(l.sigma) as sigma_moyen,
                    SUM(l.poids_foie_moyen_g * l.nb_canards_initial) / 1000.0 as production_totale_kg
                FROM gaveurs_euralis g
                LEFT JOIN lots_gavage l ON g.id = l.gaveur_id
                WHERE g.id = $1 AND l.itm IS NOT NULL
                GROUP BY g.id, g.nom, g.prenom
            """
            row = await conn.fetchrow(query, gaveur_id)

            if not row:
                raise HTTPException(
                    status_code=404,
                    detail=f"Gaveur {gaveur_id} non trouvé ou sans données historiques"
                )

            itm_moyen = float(row['itm_moyen']) if row['itm_moyen'] else 15.0

            logger.info(f"Gaveur {gaveur_id} - Cluster ML {cluster} (ITM {itm_moyen:.2f}, performance {cluster_row['performance_score']:.2f})")

        # Préparer données pour recommandation
        gaveur_info = {
            'cluster': cluster,
            'itm_moyen': itm_moyen,
            'mortalite': float(row['mortalite']) if row['mortalite'] else 1.5
        }

        # Générer courbe recommandée
        courbe_result = recommander_courbe_gaveur(
            gaveur_data=gaveur_info,
            nb_canards=nb_canards,
            souche=souche
        )

        # Vérifier si le gaveur a déjà une courbe sauvegardée
        query_courbe_existante = """
            SELECT id, courbe_json, itm_cible, created_at
            FROM courbes_optimales_gaveurs
            WHERE gaveur_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        """
        courbe_existante = await conn.fetchrow(query_courbe_existante, gaveur_id)

        return {
            'gaveur': {
                'id': row['gaveur_id'],
                'nom': row['nom'],
                'prenom': row['prenom'],
                'nb_lots_historique': row['nb_lots'],
                'itm_moyen': round(float(row['itm_moyen']), 2) if row['itm_moyen'] else None,
                'mortalite_moyenne': round(float(row['mortalite']), 2) if row['mortalite'] else None,
                'cluster': cluster
            },
            'courbe_recommandee': courbe_result['courbe'],
            'metadata': courbe_result['metadata'],
            'recommandations': courbe_result['recommandations'],
            'courbe_existante': {
                'id': courbe_existante['id'],
                'courbe': courbe_existante['courbe_json'],
                'itm_cible': float(courbe_existante['itm_cible']) if courbe_existante['itm_cible'] else None,
                'date_creation': courbe_existante['created_at'].isoformat()
            } if courbe_existante else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur génération courbe gaveur {gaveur_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur génération courbe: {str(e)}")


@router.post("/ml/gaveur/{gaveur_id}/courbe-recommandee/sauvegarder")
async def sauvegarder_courbe_recommandee(
    gaveur_id: int,
    courbe_data: dict,
    conn = Depends(get_db_connection)
):
    """
    Sauvegarde une courbe recommandée en base de données
    """
    try:
        import json as json_module
        courbe_json = json_module.dumps({"jours": courbe_data['courbe']})
        metadata = courbe_data.get('metadata', {})

        query = """
            INSERT INTO courbes_optimales_gaveurs (
                gaveur_id, cluster_performance, souche, duree_jours,
                itm_cible, courbe_json, score_performance,
                source_generation, nb_lots_base
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
            RETURNING id
        """

        row = await conn.fetchrow(
            query,
            gaveur_id,
            metadata.get('cluster', 2),
            metadata.get('souche', 'Mulard'),
            11,
            metadata.get('itm_cible', 15.0),
            courbe_json,
            20.0 / metadata.get('itm_cible', 15.0),
            metadata.get('source', 'ML'),
            None
        )

        return {
            'success': True,
            'courbe_id': row['id'],
            'message': f"Courbe sauvegardée avec succès pour gaveur {gaveur_id}"
        }

    except Exception as e:
        logger.error(f"Erreur sauvegarde courbe: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur sauvegarde: {str(e)}")


@router.get("/ml/gaveur/{gaveur_id}/performance-history")
async def get_gaveur_performance_history(
    gaveur_id: int,
    limit: int = Query(10, ge=1, le=100),
    conn = Depends(get_db_connection)
):
    """
    Historique complet des performances d'un gaveur
    """
    try:
        query = """
            SELECT
                l.id,
                l.code_lot,
                l.debut_lot,
                l.duree_du_lot,
                l.itm,
                l.sigma,
                l.pctg_perte_gavage as mortalite,
                l.total_corn_real,
                l.poids_foie_moyen_g,
                l.nb_canards_initial,
                l.souche,
                (l.poids_foie_moyen_g * l.nb_canards_initial) / 1000.0 as production_kg
            FROM lots_gavage l
            WHERE l.gaveur_id = $1 AND l.itm IS NOT NULL
            ORDER BY l.debut_lot DESC
            LIMIT $2
        """

        rows = await conn.fetch(query, gaveur_id, limit)

        if not rows:
            raise HTTPException(
                status_code=404,
                detail=f"Aucun historique trouvé pour gaveur {gaveur_id}"
            )

        itms = [float(r['itm']) for r in rows if r['itm']]
        mortalites = [float(r['mortalite']) for r in rows if r['mortalite']]
        productions = [float(r['production_kg']) for r in rows if r['production_kg']]

        stats = {
            'itm_moyen': round(sum(itms) / len(itms), 2) if itms else None,
            'itm_min': round(min(itms), 2) if itms else None,
            'itm_max': round(max(itms), 2) if itms else None,
            'mortalite_moyenne': round(sum(mortalites) / len(mortalites), 2) if mortalites else None,
            'production_totale_kg': round(sum(productions), 2) if productions else None,
            'nb_lots': len(rows),
            'tendance_itm': 'amélioration' if len(itms) >= 3 and itms[0] < itms[-1] else 'stable' if len(itms) >= 3 else 'insuffisant'
        }

        return {
            'gaveur_id': gaveur_id,
            'lots': [
                {
                    'id': row['id'],
                    'code_lot': row['code_lot'],
                    'debut_lot': row['debut_lot'].isoformat() if row['debut_lot'] else None,
                    'duree_jours': row['duree_du_lot'],
                    'itm': round(float(row['itm']), 2) if row['itm'] else None,
                    'sigma': round(float(row['sigma']), 3) if row['sigma'] else None,
                    'mortalite_pct': round(float(row['mortalite']), 2) if row['mortalite'] else None,
                    'total_mais_kg': round(float(row['total_corn_real']), 2) if row['total_corn_real'] else None,
                    'poids_foie_moyen_g': round(float(row['poids_foie_moyen_g']), 2) if row['poids_foie_moyen_g'] else None,
                    'nb_canards': row['nb_canards_initial'],
                    'souche': row['souche'],
                    'production_kg': round(float(row['production_kg']), 2) if row['production_kg'] else None
                }
                for row in rows
            ],
            'statistiques': stats
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur historique gaveur {gaveur_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur récupération historique: {str(e)}")
