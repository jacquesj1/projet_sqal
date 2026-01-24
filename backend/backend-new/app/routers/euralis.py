"""
================================================================================
EURALIS - API Router Multi-Sites
================================================================================
Description : Routes API pour le pilotage multi-sites Euralis
Sites       : LL (Bretagne), LS (Pays de Loire), MT (Maubourguet)
Prefix      : /api/euralis
Date        : 2024-12-14
================================================================================
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel
import asyncpg
import os

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/gaveurs_db')

# Router
router = APIRouter(prefix="/api/euralis", tags=["euralis"])


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


class Lot(BaseModel):
    """Modèle d'un lot de gavage"""
    id: int
    code_lot: str
    site_code: str
    gaveur_id: Optional[int]
    souche: Optional[str]
    debut_lot: date
    itm: Optional[float]
    sigma: Optional[float]
    duree_gavage_reelle: Optional[int]
    pctg_perte_gavage: Optional[float]
    statut: str


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
    niveau: str
    site_code: Optional[str]
    type_alerte: str
    severite: str
    message: str
    acquittee: bool


# ============================================================================
# DÉPENDANCES
# ============================================================================

async def get_db_connection():
    """Obtenir une connexion à la base de données"""
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        await conn.close()


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
            nb_lots,
            nb_gaveurs,
            itm_moyen,
            mortalite_moyenne,
            production_foie_kg
        FROM performances_sites
        WHERE site_code = $1
    """

    params = [code]

    if mois:
        query += " AND DATE_TRUNC('month', mois) = $2"
        params.append(datetime.strptime(mois + '-01', '%Y-%m-%d'))

    query += " ORDER BY mois DESC LIMIT 1"

    row = await conn.fetchrow(query, *params)

    if not row:
        # Pas de données dans la vue matérialisée, calculer à la volée
        row = await conn.fetchrow("""
            SELECT
                l.site_code,
                s.nom as site_nom,
                COUNT(DISTINCT l.id) as nb_lots,
                COUNT(DISTINCT l.gaveur_id) as nb_gaveurs,
                AVG(l.itm) as itm_moyen,
                AVG(l.pctg_perte_gavage) as mortalite_moyenne,
                SUM(l.nb_canards_accroches * l.itm / 1000) as production_foie_kg
            FROM lots_gavage l
            JOIN sites_euralis s ON l.site_code = s.code
            WHERE l.site_code = $1
            GROUP BY l.site_code, s.nom
        """, code)

    if not row:
        raise HTTPException(status_code=404, detail=f"Aucune statistique pour site {code}")

    return dict(row)


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


@router.get("/sites/compare")
async def compare_sites(
    metrique: str = Query("itm", regex="^(itm|mortalite|production)$"),
    conn = Depends(get_db_connection)
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

    rows = await conn.fetch(f"""
        SELECT
            site_code,
            site_nom,
            {metric_col} as valeur,
            nb_lots
        FROM performances_sites
        WHERE mois = (SELECT MAX(mois) FROM performances_sites)
        ORDER BY site_code
    """)

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
            SUM(nb_canards_accroches * itm / 1000) as production_totale_kg,
            COUNT(CASE WHEN statut = 'en_cours' THEN 1 END) as nb_lots_actifs,
            COUNT(CASE WHEN statut IN ('termine', 'abattu') THEN 1 END) as nb_lots_termines,
            COUNT(DISTINCT gaveur_id) as nb_gaveurs_actifs,
            AVG(itm) as itm_moyen_global,
            AVG(pctg_perte_gavage) as mortalite_moyenne_globale
        FROM lots_gavage
    """)

    # Alertes critiques
    nb_alertes = await conn.fetchval("""
        SELECT COUNT(*)
        FROM alertes_euralis
        WHERE severite = 'critique'
        AND acquittee = false
        AND time > NOW() - INTERVAL '7 days'
    """)

    return {
        "production_totale_kg": stats['production_totale_kg'] or 0,
        "nb_lots_actifs": stats['nb_lots_actifs'] or 0,
        "nb_lots_termines": stats['nb_lots_termines'] or 0,
        "nb_gaveurs_actifs": stats['nb_gaveurs_actifs'] or 0,
        "itm_moyen_global": round(stats['itm_moyen_global'] or 0, 2),
        "mortalite_moyenne_globale": round(stats['mortalite_moyenne_globale'] or 0, 2),
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

    query = """
        SELECT id, code_lot, site_code, gaveur_id, souche, debut_lot,
               itm, sigma, duree_gavage_reelle, pctg_perte_gavage, statut
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

    row = await conn.fetchrow("""
        SELECT id, code_lot, site_code, gaveur_id, souche, debut_lot,
               itm, sigma, duree_gavage_reelle, pctg_perte_gavage, statut,
               nb_canards_meg, nb_canards_accroches, total_corn_real
        FROM lots_gavage
        WHERE id = $1
    """, id)

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
        Historique des doses journalières
    """

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

    if not rows:
        raise HTTPException(status_code=404, detail=f"Aucune dose pour lot {id}")

    return [dict(row) for row in rows]


# ============================================================================
# ROUTES ALERTES (2 routes)
# ============================================================================

@router.get("/alertes", response_model=List[Alerte])
async def get_alertes(
    niveau: Optional[str] = None,
    site_code: Optional[str] = None,
    severite: Optional[str] = None,
    acquittee: Optional[bool] = None,
    limit: int = Query(50, le=200),
    conn = Depends(get_db_connection)
):
    """
    Liste des alertes Euralis

    Args:
        niveau: Filtrer par niveau (cooperative, site, gaveur, lot)
        site_code: Filtrer par site
        severite: Filtrer par sévérité (critique, important, warning, info)
        acquittee: Filtrer par statut d'acquittement
        limit: Nombre max de résultats

    Returns:
        Liste des alertes
    """

    query = """
        SELECT id, time, niveau, site_code, type_alerte, severite, message, acquittee
        FROM alertes_euralis
        WHERE 1=1
    """

    params = []

    if niveau:
        params.append(niveau)
        query += f" AND niveau = ${len(params)}"

    if site_code:
        params.append(site_code)
        query += f" AND site_code = ${len(params)}"

    if severite:
        params.append(severite)
        query += f" AND severite = ${len(params)}"

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
