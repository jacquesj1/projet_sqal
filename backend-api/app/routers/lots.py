"""
Router LOT-centric pour FastAPI

Gestion des lots de canards et gavage quotidien.
Remplace le modèle canard-individuel par un modèle LOT.

Date: 28 décembre 2025
"""

from fastapi import APIRouter, HTTPException, Request, Query
from typing import List, Optional
from datetime import date, datetime, time
from pydantic import BaseModel, Field
import asyncpg
import json

# ============================================================================
# ROUTER CONFIGURATION
# ============================================================================

router = APIRouter(
    prefix="/api/lots",
    tags=["Lots"],
    responses={404: {"description": "Lot non trouvé"}},
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
# Note: La couche de mapping a été supprimée. Les requêtes utilisent maintenant
# la VIEW SQL "lots" qui expose lots_gavage avec les noms de colonnes attendus.

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CurvePoint(BaseModel):
    jour: int
    poids: float
    dose_matin: Optional[float] = None
    dose_soir: Optional[float] = None
    lower: Optional[float] = None
    upper: Optional[float] = None


class LotCreate(BaseModel):
    code_lot: str = Field(..., min_length=5, max_length=20)
    site_origine: str = Field(..., pattern="^(Bretagne|Pays de Loire|Maubourguet)$")
    nombre_canards: int = Field(..., gt=0)
    genetique: str = Field(..., pattern="^(mulard|barbarie|pekin|mixte)$")
    date_debut_gavage: date
    date_fin_gavage_prevue: date
    poids_moyen_initial: float = Field(..., gt=0)
    objectif_quantite_mais: int = Field(..., gt=0)
    objectif_poids_final: int = Field(..., gt=0)
    gaveur_id: int
    lot_mais_id: Optional[int] = None


class LotUpdate(BaseModel):
    site_origine: Optional[str] = None
    nombre_canards: Optional[int] = None
    date_fin_gavage_prevue: Optional[date] = None
    objectif_quantite_mais: Optional[int] = None
    objectif_poids_final: Optional[int] = None
    statut: Optional[str] = None


class Lot(BaseModel):
    id: int
    code_lot: str
    site_origine: str
    nombre_canards: int
    genetique: str
    date_debut_gavage: date
    date_fin_gavage_prevue: date
    date_fin_gavage_reelle: Optional[date] = None
    poids_moyen_initial: Optional[float] = None  # Peut être NULL pour lots CSV
    poids_moyen_actuel: Optional[float] = None   # Peut être NULL pour lots CSV
    poids_moyen_final: Optional[float] = None
    objectif_quantite_mais: Optional[int] = None  # Peut être NULL pour lots CSV
    objectif_poids_final: Optional[int] = None    # Peut être NULL pour lots CSV
    courbe_theorique: Optional[List[CurvePoint]] = None
    formule_pysr: Optional[str] = None
    r2_score_theorique: Optional[float] = None
    statut: str
    gaveur_id: Optional[int] = None  # Peut être NULL pour lots CSV
    lot_mais_id: Optional[int] = None
    nombre_jours_gavage_ecoules: Optional[int] = None  # Peut être NULL pour lots CSV
    taux_mortalite: Optional[float] = None  # Peut être NULL pour lots CSV
    nombre_mortalite: Optional[int] = None  # Peut être NULL pour lots CSV
    taux_conformite: Optional[float] = None
    created_at: Optional[datetime] = None  # Peut être NULL pour lots CSV
    updated_at: Optional[datetime] = None  # Peut être NULL pour lots CSV


class GavageQuotidienCreate(BaseModel):
    lot_id: int
    date_gavage: date
    dose_matin: float = Field(..., ge=0)
    dose_soir: float = Field(..., ge=0)
    heure_gavage_matin: str  # Format "HH:MM"
    heure_gavage_soir: str   # Format "HH:MM"
    nb_canards_peses: int = Field(..., gt=0)
    poids_echantillon: List[float] = Field(..., min_items=1)
    temperature_stabule: Optional[float] = None
    humidite_stabule: Optional[float] = None
    suit_courbe_theorique: bool = True
    raison_ecart: Optional[str] = None
    remarques: Optional[str] = None
    mortalite_jour: Optional[int] = 0
    cause_mortalite: Optional[str] = None
    problemes_sante: Optional[str] = None


class GavageQuotidien(BaseModel):
    id: int
    lot_id: int
    date_gavage: date
    jour_gavage: int
    dose_matin: float
    dose_soir: float
    dose_totale_jour: float
    heure_gavage_matin: str  # Format "HH:MM"
    heure_gavage_soir: str   # Format "HH:MM"
    nb_canards_peses: int
    poids_echantillon: List[float]
    poids_moyen_mesure: float
    gain_poids_jour: Optional[float] = None
    gain_poids_cumule: Optional[float] = None
    temperature_stabule: Optional[float] = None
    humidite_stabule: Optional[float] = None
    dose_theorique_matin: Optional[float] = None
    dose_theorique_soir: Optional[float] = None
    poids_theorique: Optional[float] = None
    ecart_dose_pourcent: Optional[float] = None
    ecart_poids_pourcent: Optional[float] = None
    suit_courbe_theorique: bool
    raison_ecart: Optional[str] = None
    remarques: Optional[str] = None
    mortalite_jour: int
    cause_mortalite: Optional[str] = None
    problemes_sante: Optional[str] = None
    alerte_generee: bool
    niveau_alerte: Optional[str] = None
    recommandations_ia: Optional[List[dict]] = None
    prediction_activee: bool
    created_at: datetime


class Recommandation(BaseModel):
    type: str
    message: str
    ajustement_dose: float
    impact_prevu: dict
    urgence: str


class GavageCreationResponse(BaseModel):
    gavage_id: int
    ecart_courbe_theorique: float
    alerte_generee: bool
    recommandations: List[Recommandation]


class StatistiquesLot(BaseModel):
    lot_id: int
    code_lot: str
    statut: str
    nombre_jours_ecoules: int
    nombre_jours_prevus: int
    nombre_jours_restants: int
    pourcent_avancement: float
    poids: dict
    doses: dict
    conformite: dict
    sante: dict
    derniere_mise_a_jour: datetime


# ============================================================================
# ROUTES - GESTION DES LOTS
# ============================================================================

@router.get("/")
async def get_all_lots(
    request: Request,
    statut: Optional[str] = Query(None, regex="^(en_preparation|en_gavage|en_cours|termine|abattu)$"),
    limit: int = Query(100, le=500)
):
    """
    Récupérer tous les lots (avec filtre optionnel par statut)

    Args:
        statut: Filtrer par statut (optionnel)
        limit: Nombre max de résultats (défaut: 100, max: 500)

    Returns:
        Liste de tous les lots
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        query = "SELECT * FROM lots WHERE 1=1"
        params = []

        if statut:
            params.append(statut)
            query += f" AND statut = ${len(params)}"

        query += f" ORDER BY date_debut_gavage DESC LIMIT ${len(params) + 1}"
        params.append(limit)

        rows = await conn.fetch(query, *params)
        return [dict(row) for row in rows]


@router.post("/migrate/csv-columns")
async def migrate_csv_columns(request: Request):
    """
    Endpoint temporaire pour ajouter les colonnes CSV manquantes
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        try:
            # Ajouter total_corn_real_g
            await conn.execute("""
                ALTER TABLE lots_gavage
                ADD COLUMN IF NOT EXISTS total_corn_real_g DECIMAL(10, 2)
            """)

            # Ajouter nb_meg
            await conn.execute("""
                ALTER TABLE lots_gavage
                ADD COLUMN IF NOT EXISTS nb_meg INTEGER DEFAULT 0
            """)

            # Ajouter poids_foie_moyen_g
            await conn.execute("""
                ALTER TABLE lots_gavage
                ADD COLUMN IF NOT EXISTS poids_foie_moyen_g DECIMAL(8, 2)
            """)

            # Créer les index
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_lots_gavage_total_corn
                ON lots_gavage(total_corn_real_g) WHERE total_corn_real_g IS NOT NULL
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_lots_gavage_nb_meg
                ON lots_gavage(nb_meg) WHERE nb_meg > 0
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_lots_gavage_poids_foie
                ON lots_gavage(poids_foie_moyen_g) WHERE poids_foie_moyen_g IS NOT NULL
            """)

            # Vérifier les colonnes
            rows = await conn.fetch("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns
                WHERE table_name = 'lots_gavage'
                AND column_name IN ('total_corn_real_g', 'nb_meg', 'poids_foie_moyen_g')
                ORDER BY column_name
            """)

            return {
                "status": "success",
                "message": "Migration CSV columns completed",
                "columns": [dict(row) for row in rows]
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")


@router.post("/", response_model=Lot, status_code=201)
async def create_lot(
    lot: LotCreate,
    request: Request
):
    """
    Créer un nouveau lot de canards
    """
    pool = request.app.state.db_pool
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO lots (
                    code_lot, site_origine, nombre_canards, genetique,
                    date_debut_gavage, date_fin_gavage_prevue,
                    poids_moyen_initial, poids_moyen_actuel,
                    objectif_quantite_mais, objectif_poids_final,
                    gaveur_id, lot_mais_id, statut
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'en_preparation')
                RETURNING *
                """,
                lot.code_lot, lot.site_origine, lot.nombre_canards, lot.genetique,
                lot.date_debut_gavage, lot.date_fin_gavage_prevue,
                lot.poids_moyen_initial, lot.poids_moyen_initial,
                lot.objectif_quantite_mais, lot.objectif_poids_final,
                lot.gaveur_id, lot.lot_mais_id
            )

            return dict(row)

        except asyncpg.UniqueViolationError:
            raise HTTPException(
                status_code=400,
                detail=f"Le code lot {lot.code_lot} existe déjà"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/gaveur/{gaveur_id}")
async def get_lots_by_gaveur(
    gaveur_id: int,
    request: Request,
    statut: Optional[str] = Query(None, regex="^(en_preparation|en_gavage|en_cours|termine|abattu)$")
):
    """
    Récupérer tous les lots d'un gaveur (depuis VIEW lots)
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        query = "SELECT * FROM lots WHERE gaveur_id = $1"
        params = [gaveur_id]

        if statut:
            query += " AND statut = $2"
            params.append(statut)

        query += " ORDER BY statut DESC, date_debut_gavage DESC"

        rows = await conn.fetch(query, *params)

        if not rows:
            return []

        # Conversion directe sans mapping (VIEW lots a déjà les bons noms de colonnes)
        return [dict(row) for row in rows]


@router.get("/{lot_id}", response_model=Lot)
async def get_lot(
    lot_id: int,
    request: Request
):
    """
    Récupérer un lot spécifique (cherche dans lots puis lots_gavage CSV)
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Essayer d'abord dans la table lots (lots actifs gaveurs)
        row = await conn.fetchrow(
            "SELECT * FROM lots WHERE id = $1",
            lot_id
        )

        # Si pas trouvé, chercher dans lots_gavage (lots CSV importés)
        if not row:
            row = await conn.fetchrow(
                """SELECT
                    id, code_lot, site_code, gaveur_id, souche, debut_lot,
                    itm, sigma, duree_gavage_reelle as duree_gavage,
                    pctg_perte_gavage as perte_poids,
                    statut, nb_canards_meg as nb_morts,
                    nb_canards_accroches as nb_canards,
                    total_corn_real as total_corn,
                    poids_foie_moyen_g as poids_foie_moyen,
                    'termine' as statut
                FROM lots_gavage
                WHERE id = $1""",
                lot_id
            )

        if not row:
            raise HTTPException(status_code=404, detail=f"Lot {lot_id} non trouvé")

        lot_dict = dict(row)
        if lot_dict.get('courbe_theorique'):
            lot_dict['courbe_theorique'] = json.loads(lot_dict['courbe_theorique'])

        return lot_dict


@router.put("/{lot_id}", response_model=Lot)
async def update_lot(
    lot_id: int,
    updates: LotUpdate,
    request: Request
):
    """
    Mettre à jour un lot
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Vérifier que le lot existe
        existing = await conn.fetchrow("SELECT id FROM lots WHERE id = $1", lot_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Lot non trouvé")

        # Construire la requête UPDATE dynamiquement
        update_fields = []
        params = []
        param_count = 1

        for field, value in updates.dict(exclude_unset=True).items():
            if value is not None:
                update_fields.append(f"{field} = ${param_count}")
                params.append(value)
                param_count += 1

        if not update_fields:
            raise HTTPException(status_code=400, detail="Aucune mise à jour fournie")

        params.append(lot_id)
        query = f"""
            UPDATE lots
            SET {', '.join(update_fields)}
            WHERE id = ${param_count}
            RETURNING *
        """

        row = await conn.fetchrow(query, *params)
        return dict(row)


@router.delete("/{lot_id}")
async def delete_lot(
    lot_id: int,
    request: Request
):
    """
    Supprimer un lot (soft delete via statut)
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE lots SET statut = 'termine' WHERE id = $1",
            lot_id
        )

        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Lot non trouvé")

        return {"success": True, "message": "Lot marqué comme terminé"}


# ============================================================================
# ROUTES - GAVAGE QUOTIDIEN
# ============================================================================

@router.post("/gavage", response_model=GavageCreationResponse, status_code=201)
async def create_gavage_quotidien(
    gavage: GavageQuotidienCreate,
    request: Request
):
    """
    Enregistrer un gavage quotidien pour un lot

    Ce endpoint effectue automatiquement:
    1. Calcul du jour de gavage
    2. Calcul de la moyenne des poids
    3. Comparaison avec courbe théorique
    4. Génération d'alertes si écart > seuil
    5. Génération de recommandations IA
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Convertir les heures string "HH:MM" en objets time Python
        heure_matin = datetime.strptime(gavage.heure_gavage_matin, "%H:%M").time()
        heure_soir = datetime.strptime(gavage.heure_gavage_soir, "%H:%M").time()

        # 1. Récupérer info lot
        lot = await conn.fetchrow(
            "SELECT * FROM lots WHERE id = $1",
            gavage.lot_id
        )

        if not lot:
            raise HTTPException(status_code=404, detail="Lot non trouvé")

        # 2. Calculer jour de gavage
        jour_gavage = (gavage.date_gavage - lot['date_debut_gavage']).days + 1

        # 3. Calculer poids moyen
        poids_moyen = sum(gavage.poids_echantillon) / len(gavage.poids_echantillon)

        # 4. Obtenir poids théorique si courbe disponible
        poids_theorique = None
        ecart_poids_pourcent = None

        if lot['courbe_theorique']:
            courbe = json.loads(lot['courbe_theorique']) if isinstance(lot['courbe_theorique'], str) else lot['courbe_theorique']
            point_theorique = next((p for p in courbe if p['jour'] == jour_gavage), None)

            if point_theorique:
                poids_theorique = point_theorique['poids']
                ecart_poids_pourcent = ((poids_moyen - poids_theorique) / poids_theorique) * 100

        # 5. Déterminer si alerte nécessaire
        alerte_generee = False
        niveau_alerte = None

        if ecart_poids_pourcent is not None:
            abs_ecart = abs(ecart_poids_pourcent)
            if abs_ecart >= 25:  # CRITIQUE
                alerte_generee = True
                niveau_alerte = "critique"
            elif abs_ecart >= 10:  # WARNING
                alerte_generee = True
                niveau_alerte = "warning"
            elif abs_ecart >= 5:  # INFO
                alerte_generee = True
                niveau_alerte = "info"

        # 6. Générer recommandations IA (simplifié pour l'instant)
        recommandations = []
        if alerte_generee and ecart_poids_pourcent is not None:
            if ecart_poids_pourcent < -10:  # En retard
                recommandations.append({
                    "type": "augmenter_dose",
                    "message": "Augmenter la dose pour rattraper le retard",
                    "ajustement_dose": 50,
                    "impact_prevu": {
                        "poids_final_estime": lot['objectif_poids_final'],
                        "jours_gavage_estimes": 14
                    },
                    "urgence": niveau_alerte
                })
            elif ecart_poids_pourcent > 10:  # En avance
                recommandations.append({
                    "type": "reduire_dose",
                    "message": "Réduire la dose pour éviter le surpoids",
                    "ajustement_dose": -30,
                    "impact_prevu": {
                        "poids_final_estime": lot['objectif_poids_final'],
                        "jours_gavage_estimes": 14
                    },
                    "urgence": niveau_alerte
                })

        # 7. Insérer gavage quotidien
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO gavage_lot_quotidien (
                    lot_id, date_gavage, jour_gavage,
                    dose_matin, dose_soir,
                    heure_gavage_matin, heure_gavage_soir,
                    nb_canards_peses, poids_echantillon, poids_moyen_mesure,
                    temperature_stabule, humidite_stabule,
                    poids_theorique, ecart_poids_pourcent,
                    suit_courbe_theorique, raison_ecart, remarques,
                    mortalite_jour, cause_mortalite, problemes_sante,
                    alerte_generee, niveau_alerte, recommandations_ia,
                    prediction_activee
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
                )
                RETURNING id
                """,
                gavage.lot_id, gavage.date_gavage, jour_gavage,
                gavage.dose_matin, gavage.dose_soir,
                heure_matin, heure_soir,  # Utilisez les objets time convertis
                gavage.nb_canards_peses, json.dumps(gavage.poids_echantillon), poids_moyen,
                gavage.temperature_stabule, gavage.humidite_stabule,
                poids_theorique, ecart_poids_pourcent,
                gavage.suit_courbe_theorique, gavage.raison_ecart, gavage.remarques,
                gavage.mortalite_jour or 0, gavage.cause_mortalite, gavage.problemes_sante,
                alerte_generee, niveau_alerte, json.dumps(recommandations),
                len(recommandations) > 0
            )
        except Exception as e:
            # Détecter erreur de contrainte unique (gavage déjà enregistré pour cette date)
            if "unique constraint" in str(e) or "duplicate key" in str(e):
                raise HTTPException(
                    status_code=409,
                    detail=f"Un gavage existe déjà pour le lot {gavage.lot_id} à la date {gavage.date_gavage}. Veuillez choisir une autre date."
                )
            raise

        return {
            "gavage_id": row['id'],
            "ecart_courbe_theorique": ecart_poids_pourcent or 0.0,
            "alerte_generee": alerte_generee,
            "recommandations": recommandations
        }


@router.get("/{lot_id}/historique")
async def get_historique_gavage(
    lot_id: int,
    request: Request
):
    """
    Récupérer l'historique de tous les gavages d'un lot

    Note: Utilise la table courbe_reelle_quotidienne (même source que le dashboard 3-courbes)
    pour avoir des données cohérentes avec le graphique du dashboard.
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Essayer d'abord courbe_reelle_quotidienne (table principale pour le dashboard 3-courbes)
        rows = await conn.fetch(
            """
            SELECT
                id,
                lot_id,
                gaveur_id,
                site_code,
                date_gavage,
                jour_gavage,
                dose_reelle_g as dose_totale_jour,
                dose_theorique_g,
                ecart_g,
                ecart_pct as ecart_poids_pourcent,
                alerte_ecart as alerte_generee,
                commentaire_gaveur as remarques,
                created_at,
                -- Calculer dose matin/soir (approximation 50/50)
                ROUND(dose_reelle_g / 2.0) as dose_matin,
                ROUND(dose_reelle_g / 2.0) as dose_soir,
                -- Heure fictive pour compatibilité
                '08:00:00' as heure_gavage_matin,
                '18:00:00' as heure_gavage_soir,
                -- Placeholder pour champs non disponibles
                NULL as poids_moyen_mesure,
                NULL as nb_canards_peses,
                CASE WHEN alerte_ecart THEN 'WARNING' ELSE NULL END as niveau_alerte,
                NOT alerte_ecart as suit_courbe_theorique,
                NULL as poids_echantillon,
                NULL as recommandations_ia,
                NULL as temperature_stabule,
                NULL as humidite_stabule,
                NULL as raison_ecart
            FROM courbe_reelle_quotidienne
            WHERE lot_id = $1
            ORDER BY date_gavage DESC, jour_gavage DESC
            """,
            lot_id
        )

        # Si aucune donnée dans courbe_reelle_quotidienne, fallback sur gavage_lot_quotidien
        if not rows:
            rows = await conn.fetch(
                """
                SELECT * FROM gavage_lot_quotidien
                WHERE lot_id = $1
                ORDER BY date_gavage DESC
                """,
                lot_id
            )

        if not rows:
            return []

        gavages = []
        for row in rows:
            gavage_dict = dict(row)

            # Convertir les types non-JSON-serializables
            for key, value in gavage_dict.items():
                # Convertir date en string
                if isinstance(value, date) and not isinstance(value, datetime):
                    gavage_dict[key] = value.isoformat()
                # Convertir datetime en string
                elif isinstance(value, datetime):
                    gavage_dict[key] = value.isoformat()
                # Convertir time en string
                elif hasattr(value, 'hour') and hasattr(value, 'minute'):  # time object
                    gavage_dict[key] = value.strftime("%H:%M:%S")

            # Convertir JSONB en listes (asyncpg peut retourner str ou déjà des objets Python)
            if gavage_dict.get('poids_echantillon'):
                if isinstance(gavage_dict['poids_echantillon'], str):
                    gavage_dict['poids_echantillon'] = json.loads(gavage_dict['poids_echantillon'])
            else:
                gavage_dict['poids_echantillon'] = []

            if gavage_dict.get('recommandations_ia'):
                if isinstance(gavage_dict['recommandations_ia'], str):
                    gavage_dict['recommandations_ia'] = json.loads(gavage_dict['recommandations_ia'])
            else:
                gavage_dict['recommandations_ia'] = []

            gavages.append(gavage_dict)

        return gavages


@router.get("/gavages/all")
async def get_all_gavages(request: Request):
    """
    Récupérer tous les gavages de tous les lots
    Pour la page de récapitulation avec filtres et recherche
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                g.id,
                g.lot_id,
                l.code_lot,
                g.date_gavage,
                g.jour_gavage,
                g.dose_matin,
                g.dose_soir,
                g.dose_totale_jour,
                g.poids_moyen_mesure,
                g.ecart_poids_pourcent,
                g.alerte_generee,
                g.niveau_alerte,
                g.suit_courbe_theorique,
                g.remarques,
                l.site_origine,
                gv.nom as gaveur_nom
            FROM gavage_lot_quotidien g
            JOIN lots l ON l.id = g.lot_id
            LEFT JOIN gaveurs gv ON gv.id = l.gaveur_id
            ORDER BY g.date_gavage DESC, l.code_lot
            LIMIT 1000
            """
        )

        gavages = []
        for row in rows:
            gavage_dict = dict(row)
            gavages.append(gavage_dict)

        return {
            "success": True,
            "data": gavages
        }


@router.get("/{lot_id}/jour/{jour}", response_model=GavageQuotidien)
async def get_gavage_by_jour(
    lot_id: int,
    jour: int,
    request: Request
):
    """
    Récupérer les données d'un jour spécifique
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM gavage_lot_quotidien
            WHERE lot_id = $1 AND jour_gavage = $2
            """,
            lot_id, jour
        )

        if not row:
            raise HTTPException(status_code=404, detail="Gavage non trouvé pour ce jour")

        gavage_dict = dict(row)
        if gavage_dict.get('poids_echantillon'):
            gavage_dict['poids_echantillon'] = json.loads(gavage_dict['poids_echantillon'])
        if gavage_dict.get('recommandations_ia'):
            gavage_dict['recommandations_ia'] = json.loads(gavage_dict['recommandations_ia'])

        return gavage_dict


# ============================================================================
# ROUTES - COURBES
# ============================================================================

@router.get("/{lot_id}/courbes/theorique")
async def get_courbe_theorique(
    lot_id: int,
    request: Request
):
    """
    Récupérer la courbe théorique PySR d'un lot
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT courbe_theorique, formule_pysr, r2_score_theorique
            FROM lots
            WHERE id = $1
            """,
            lot_id
        )

        if not row:
            raise HTTPException(status_code=404, detail="Lot non trouvé")

        courbe = json.loads(row['courbe_theorique']) if row['courbe_theorique'] else []

        return {
            "formule_pysr": row['formule_pysr'],
            "points": courbe,
            "metadata": {
                "r2_score": row['r2_score_theorique'],
                "nombre_echantillons": 0,  # À calculer
                "date_generation": datetime.now().isoformat()
            }
        }


@router.get("/{lot_id}/courbes/reelle")
async def get_courbe_reelle(
    lot_id: int,
    request: Request
):
    """
    Récupérer la courbe réelle basée sur les données saisies
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT jour_gavage, poids_moyen_mesure
            FROM gavage_lot_quotidien
            WHERE lot_id = $1
            ORDER BY jour_gavage ASC
            """,
            lot_id
        )

        points = [
            {"jour": row['jour_gavage'], "poids": row['poids_moyen_mesure']}
            for row in rows
        ]

        return points


@router.post("/{lot_id}/courbes/generer-theorique")
async def generer_courbe_theorique(
    lot_id: int,
    request: Request
):
    """
    Générer la courbe théorique PySR en calculant les points avec la formule
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Récupérer le lot et sa formule
        lot = await conn.fetchrow(
            """
            SELECT formule_pysr, date_debut_gavage, date_fin_gavage_prevue, poids_moyen_initial
            FROM lots
            WHERE id = $1
            """,
            lot_id
        )

        if not lot or not lot['formule_pysr']:
            raise HTTPException(status_code=404, detail="Lot ou formule PySR non trouvé")

        # Récupérer les données réelles pour calculer les points théoriques
        gavages = await conn.fetch(
            """
            SELECT jour_gavage, dose_matin, dose_soir, temperature_stabule
            FROM gavage_lot_quotidien
            WHERE lot_id = $1
            ORDER BY jour_gavage ASC
            """,
            lot_id
        )

        if not gavages:
            raise HTTPException(status_code=400, detail="Aucune donnée de gavage pour générer la courbe")

        # Calculer les points théoriques avec la formule PySR
        formule = lot['formule_pysr']
        poids_initial = float(lot['poids_moyen_initial']) if lot['poids_moyen_initial'] else 4000.0
        points = []
        poids_cumule = poids_initial  # Partir du poids initial

        for gav in gavages:
            try:
                # Remplacer les variables dans la formule
                formule_eval = formule.replace('dose_matin', str(gav['dose_matin']))
                formule_eval = formule_eval.replace('dose_soir', str(gav['dose_soir']))
                formule_eval = formule_eval.replace('temperature', str(gav['temperature_stabule'] or 22))
                formule_eval = formule_eval.replace('^', '**')  # Python utilise ** pour puissance

                # Évaluer la formule (elle donne le GAIN de poids journalier)
                gain_journalier = eval(formule_eval)

                # Ajouter le gain au poids cumulé
                poids_cumule += gain_journalier

                points.append({
                    "jour": gav['jour_gavage'],
                    "poids": round(float(poids_cumule), 2)
                })
            except Exception as e:
                print(f"Erreur calcul jour {gav['jour_gavage']}: {e}")
                continue

        # Stocker la courbe dans la base
        courbe_json = json.dumps(points)
        await conn.execute(
            """
            UPDATE lots
            SET courbe_theorique = $1
            WHERE id = $2
            """,
            courbe_json,
            lot_id
        )

        return {
            "success": True,
            "points_generes": len(points),
            "formule": formule,
            "points": points
        }


# ============================================================================
# ROUTES - STATISTIQUES
# ============================================================================

@router.get("/{lot_id}/stats", response_model=StatistiquesLot)
async def get_statistiques_lot(
    lot_id: int,
    request: Request
):
    """
    Récupérer statistiques complètes d'un lot
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM stats_lots WHERE lot_id = $1",
            lot_id
        )

        if not row:
            # Rafraîchir la vue matérialisée
            await conn.execute("SELECT refresh_stats_lots()")
            row = await conn.fetchrow(
                "SELECT * FROM stats_lots WHERE lot_id = $1",
                lot_id
            )

        if not row:
            raise HTTPException(status_code=404, detail="Statistiques non disponibles")

        return {
            "lot_id": row['lot_id'],
            "code_lot": row['code_lot'],
            "statut": row['statut'],
            "nombre_jours_ecoules": row['nombre_jours_gavage_ecoules'],
            "nombre_jours_prevus": row['nombre_jours_prevus'],
            "nombre_jours_restants": row['nombre_jours_prevus'] - row['nombre_jours_gavage_ecoules'],
            "pourcent_avancement": row['pourcent_avancement'],
            "poids": {
                "initial": row['poids_moyen_initial'],
                "actuel": row['poids_moyen_actuel'],
                "objectif": row['objectif_poids_final'],
                "gain_total": row['gain_total'],
                "gain_moyen_jour": row['gain_moyen_jour']
            },
            "doses": {
                "total_donne": row['dose_totale_donnee'],
                "objectif_total": row['objectif_quantite_mais'],
                "pourcent_objectif": row['pourcent_objectif_dose'],
                "moyenne_jour": row['dose_totale_donnee'] / max(row['nombre_jours_gavage_ecoules'], 1)
            },
            "conformite": {
                "ecart_moyen_courbe": row['ecart_moyen_poids'],
                "jours_hors_tolerance": row['jours_hors_tolerance'],
                "taux_conformite": row['taux_conformite_declare']
            },
            "sante": {
                "mortalite_totale": row['nombre_mortalite'],
                "taux_mortalite": row['taux_mortalite'],
                "nombre_alertes": row['nombre_alertes']
            },
            "derniere_mise_a_jour": row['derniere_mise_a_jour']
        }


# ============================================================================
# ROUTES - QUALITÉ (SQAL)
# ============================================================================

@router.get("/{lot_id}/qualite")
async def get_qualite_lot(
    lot_id: int,
    request: Request
):
    """
    Récupérer les données de contrôle qualité SQAL d'un lot

    Retourne les mesures des capteurs ToF (VL53L8CH) et Spectral (AS7341):
    - Poids de foie moyen estimé depuis volume 3D
    - Grades de qualité (A+, A, B, C, REJECT)
    - Scores de fraîcheur, oxydation, qualité du gras
    - Volume, uniformité de surface

    Args:
        lot_id: ID du lot

    Returns:
        Statistiques de qualité agrégées pour le lot

    Note:
        Les données SQAL sont optionnelles (lot_id peut être NULL).
        Si aucune mesure n'existe pour ce lot, retourne valeurs nulles.
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Vérifier que le lot existe
        lot_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM lots WHERE id = $1)",
            lot_id
        )

        if not lot_exists:
            raise HTTPException(status_code=404, detail=f"Lot {lot_id} non trouvé")

        # Requête agrégée des données SQAL pour ce lot
        stats = await conn.fetchrow("""
            SELECT
                -- Comptage échantillons
                COUNT(*) as nb_echantillons,

                -- Poids de foie (calculé depuis volume ToF)
                AVG(poids_foie_estime_g) as poids_foie_moyen,
                MIN(poids_foie_estime_g) as poids_foie_min,
                MAX(poids_foie_estime_g) as poids_foie_max,
                STDDEV(poids_foie_estime_g) as poids_foie_ecart_type,

                -- Volume 3D (VL53L8CH)
                AVG(vl53l8ch_volume_mm3) as volume_moyen_mm3,
                AVG(vl53l8ch_avg_height_mm) as hauteur_moyenne_mm,
                AVG(vl53l8ch_surface_uniformity) as uniformite_surface,

                -- Scores qualité
                AVG(fusion_final_score) as score_qualite_moyen,
                MIN(fusion_final_score) as score_qualite_min,
                MAX(fusion_final_score) as score_qualite_max,

                -- Indices AS7341 (Spectral)
                AVG(as7341_freshness_index) as indice_fraicheur,
                AVG(as7341_fat_quality_index) as indice_qualite_gras,
                AVG(as7341_oxidation_index) as indice_oxydation,

                -- Répartition par grade
                COUNT(*) FILTER (WHERE fusion_final_grade = 'A+') as nb_grade_a_plus,
                COUNT(*) FILTER (WHERE fusion_final_grade = 'A') as nb_grade_a,
                COUNT(*) FILTER (WHERE fusion_final_grade = 'B') as nb_grade_b,
                COUNT(*) FILTER (WHERE fusion_final_grade = 'C') as nb_grade_c,
                COUNT(*) FILTER (WHERE fusion_final_grade = 'REJECT') as nb_grade_reject,

                -- Grade majoritaire (mode)
                MODE() WITHIN GROUP (ORDER BY fusion_final_grade) as grade_majoritaire,

                -- Conformité
                COUNT(*) FILTER (WHERE fusion_is_compliant = TRUE) as nb_conformes,

                -- Dates
                MIN(timestamp) as premiere_mesure,
                MAX(timestamp) as derniere_mesure

            FROM sqal_sensor_samples
            WHERE lot_id = $1
              AND poids_foie_estime_g IS NOT NULL
        """, lot_id)

        # Si aucune donnée SQAL
        if stats['nb_echantillons'] == 0:
            return {
                "lot_id": lot_id,
                "has_sqal_data": False,
                "message": "Aucune mesure de contrôle qualité SQAL pour ce lot",
                "nb_echantillons": 0,
                "poids_foie": None,
                "volume": None,
                "scores": None,
                "grades": None,
                "indices_spectraux": None,
                "conformite": None,
                "dates": None
            }

        # Calculer pourcentage conformité
        pct_conformes = (stats['nb_conformes'] / stats['nb_echantillons']) * 100 if stats['nb_echantillons'] > 0 else 0

        return {
            "lot_id": lot_id,
            "has_sqal_data": True,
            "nb_echantillons": stats['nb_echantillons'],

            # Poids de foie
            "poids_foie": {
                "moyen_g": round(float(stats['poids_foie_moyen']), 1) if stats['poids_foie_moyen'] else None,
                "min_g": round(float(stats['poids_foie_min']), 1) if stats['poids_foie_min'] else None,
                "max_g": round(float(stats['poids_foie_max']), 1) if stats['poids_foie_max'] else None,
                "ecart_type_g": round(float(stats['poids_foie_ecart_type']), 1) if stats['poids_foie_ecart_type'] else None
            },

            # Volume 3D (ToF)
            "volume": {
                "moyen_mm3": round(float(stats['volume_moyen_mm3']), 0) if stats['volume_moyen_mm3'] else None,
                "hauteur_moyenne_mm": round(float(stats['hauteur_moyenne_mm']), 1) if stats['hauteur_moyenne_mm'] else None,
                "uniformite_surface": round(float(stats['uniformite_surface']), 3) if stats['uniformite_surface'] else None
            },

            # Scores qualité globaux
            "scores": {
                "moyen": round(float(stats['score_qualite_moyen']), 3) if stats['score_qualite_moyen'] else None,
                "min": round(float(stats['score_qualite_min']), 3) if stats['score_qualite_min'] else None,
                "max": round(float(stats['score_qualite_max']), 3) if stats['score_qualite_max'] else None
            },

            # Répartition par grade
            "grades": {
                "majoritaire": stats['grade_majoritaire'],
                "repartition": {
                    "A+": stats['nb_grade_a_plus'],
                    "A": stats['nb_grade_a'],
                    "B": stats['nb_grade_b'],
                    "C": stats['nb_grade_c'],
                    "REJECT": stats['nb_grade_reject']
                },
                "pourcent_a_plus_a": round((stats['nb_grade_a_plus'] + stats['nb_grade_a']) / stats['nb_echantillons'] * 100, 1)
            },

            # Indices spectraux (AS7341)
            "indices_spectraux": {
                "fraicheur": round(float(stats['indice_fraicheur']), 3) if stats['indice_fraicheur'] else None,
                "qualite_gras": round(float(stats['indice_qualite_gras']), 3) if stats['indice_qualite_gras'] else None,
                "oxydation": round(float(stats['indice_oxydation']), 3) if stats['indice_oxydation'] else None
            },

            # Conformité
            "conformite": {
                "nb_conformes": stats['nb_conformes'],
                "pourcent_conformes": round(pct_conformes, 1)
            },

            # Dates
            "dates": {
                "premiere_mesure": stats['premiere_mesure'].isoformat() if stats['premiere_mesure'] else None,
                "derniere_mesure": stats['derniere_mesure'].isoformat() if stats['derniere_mesure'] else None
            }
        }


# ============================================================================
# ENDPOINTS ALERTES POUR LOTS GAVEURS
# ============================================================================

@router.get("/{lot_id}/alertes")
async def get_alertes_lot(
    lot_id: int,
    niveau: Optional[str] = None,
    acquittee: Optional[bool] = None,
    limit: int = Query(50, le=200),
    request: Request = None
):
    """
    Récupérer les alertes d'un lot spécifique

    Args:
        lot_id: ID du lot
        niveau: Filtrer par niveau (critique, important, info)
        acquittee: Filtrer par statut d'acquittement
        limit: Nombre max de résultats

    Returns:
        Liste des alertes du lot avec détails des canards
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Vérifier que le lot existe
        lot_exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM lots WHERE id = $1)", lot_id)
        if not lot_exists:
            raise HTTPException(status_code=404, detail=f"Lot {lot_id} non trouvé")

        query = """
            SELECT
                a.id,
                a.time,
                a.canard_id,
                c.numero_bague,
                c.race,
                a.niveau,
                a.type_alerte,
                a.message,
                a.valeur_mesuree,
                a.valeur_seuil,
                a.acquittee,
                a.acquittee_par,
                a.acquittee_le,
                a.sms_envoye,
                a.sms_envoye_le,
                a.created_at
            FROM alertes a
            INNER JOIN canards c ON a.canard_id = c.id
            WHERE c.lot_id = $1
        """

        params = [lot_id]
        param_idx = 2

        if niveau:
            query += f" AND a.niveau = ${param_idx}"
            params.append(niveau)
            param_idx += 1

        if acquittee is not None:
            query += f" AND a.acquittee = ${param_idx}"
            params.append(acquittee)
            param_idx += 1

        query += f" ORDER BY a.time DESC LIMIT ${param_idx}"
        params.append(limit)

        rows = await conn.fetch(query, *params)

        return [
            {
                "id": row['id'],
                "time": row['time'].isoformat() if row['time'] else None,
                "canard_id": row['canard_id'],
                "numero_bague": row['numero_bague'],
                "race": row['race'],
                "niveau": row['niveau'],
                "type_alerte": row['type_alerte'],
                "message": row['message'],
                "valeur_mesuree": float(row['valeur_mesuree']) if row['valeur_mesuree'] else None,
                "valeur_seuil": float(row['valeur_seuil']) if row['valeur_seuil'] else None,
                "acquittee": row['acquittee'],
                "acquittee_par": row['acquittee_par'],
                "acquittee_le": row['acquittee_le'].isoformat() if row['acquittee_le'] else None,
                "sms_envoye": row['sms_envoye'],
                "sms_envoye_le": row['sms_envoye_le'].isoformat() if row['sms_envoye_le'] else None,
                "created_at": row['created_at'].isoformat() if row['created_at'] else None,
            }
            for row in rows
        ]


@router.get("/alertes/gaveur/{gaveur_id}")
async def get_alertes_gaveur(
    gaveur_id: int,
    niveau: Optional[str] = None,
    acquittee: Optional[bool] = None,
    limit: int = Query(100, le=500),
    request: Request = None
):
    """
    Récupérer toutes les alertes d'un gaveur (tous ses lots)

    Args:
        gaveur_id: ID du gaveur
        niveau: Filtrer par niveau (critique, important, info)
        acquittee: Filtrer par statut d'acquittement
        limit: Nombre max de résultats

    Returns:
        Liste des alertes du gaveur avec détails lots et canards
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Vérifier que le gaveur existe
        gaveur_exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM gaveurs WHERE id = $1)", gaveur_id)
        if not gaveur_exists:
            raise HTTPException(status_code=404, detail=f"Gaveur {gaveur_id} non trouvé")

        query = """
            SELECT
                a.id,
                a.time,
                a.canard_id,
                c.numero_bague,
                c.race,
                c.lot_id,
                l.code_lot,
                l.nombre_canards as total_canards_lot,
                a.niveau,
                a.type_alerte,
                a.message,
                a.valeur_mesuree,
                a.valeur_seuil,
                a.acquittee,
                a.acquittee_par,
                a.acquittee_le,
                a.sms_envoye,
                a.sms_envoye_le,
                a.created_at
            FROM alertes a
            INNER JOIN canards c ON a.canard_id = c.id
            INNER JOIN lots l ON c.lot_id = l.id
            WHERE l.gaveur_id = $1
        """

        params = [gaveur_id]
        param_idx = 2

        if niveau:
            query += f" AND a.niveau = ${param_idx}"
            params.append(niveau)
            param_idx += 1

        if acquittee is not None:
            query += f" AND a.acquittee = ${param_idx}"
            params.append(acquittee)
            param_idx += 1

        query += f" ORDER BY a.time DESC LIMIT ${param_idx}"
        params.append(limit)

        rows = await conn.fetch(query, *params)

        return [
            {
                "id": row['id'],
                "time": row['time'].isoformat() if row['time'] else None,
                "canard_id": row['canard_id'],
                "numero_bague": row['numero_bague'],
                "race": row['race'],
                "lot_id": row['lot_id'],
                "code_lot": row['code_lot'],
                "total_canards_lot": row['total_canards_lot'],
                "niveau": row['niveau'],
                "type_alerte": row['type_alerte'],
                "message": row['message'],
                "valeur_mesuree": float(row['valeur_mesuree']) if row['valeur_mesuree'] else None,
                "valeur_seuil": float(row['valeur_seuil']) if row['valeur_seuil'] else None,
                "acquittee": row['acquittee'],
                "acquittee_par": row['acquittee_par'],
                "acquittee_le": row['acquittee_le'].isoformat() if row['acquittee_le'] else None,
                "sms_envoye": row['sms_envoye'],
                "sms_envoye_le": row['sms_envoye_le'].isoformat() if row['sms_envoye_le'] else None,
                "created_at": row['created_at'].isoformat() if row['created_at'] else None,
            }
            for row in rows
        ]


@router.post("/alertes/{alerte_id}/acquitter")
async def acquitter_alerte(
    alerte_id: int,
    acquittee_par: str = Query(..., description="Nom ou ID de l'utilisateur qui acquitte l'alerte"),
    request: Request = None
):
    """
    Acquitter une alerte

    Args:
        alerte_id: ID de l'alerte
        acquittee_par: Nom ou ID de l'utilisateur

    Returns:
        Confirmation d'acquittement
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE alertes
            SET acquittee = true,
                acquittee_par = $1,
                acquittee_le = NOW()
            WHERE id = $2
        """, acquittee_par, alerte_id)

        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail=f"Alerte {alerte_id} non trouvée")

        return {
            "success": True,
            "message": f"Alerte {alerte_id} acquittée avec succès",
            "acquittee_par": acquittee_par,
            "acquittee_le": datetime.now().isoformat()
        }


@router.get("/{lot_id}/statistiques-alertes")
async def get_statistiques_alertes_lot(lot_id: int, request: Request = None):
    """
    Statistiques des alertes d'un lot

    Args:
        lot_id: ID du lot

    Returns:
        Statistiques agrégées des alertes (total, par niveau, par type, taux d'acquittement)
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Vérifier que le lot existe
        lot_exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM lots WHERE id = $1)", lot_id)
        if not lot_exists:
            raise HTTPException(status_code=404, detail=f"Lot {lot_id} non trouvé")

        stats = await conn.fetchrow("""
            SELECT
                COUNT(*) as total_alertes,
                COUNT(*) FILTER (WHERE niveau = 'critique') as nb_critiques,
                COUNT(*) FILTER (WHERE niveau = 'important') as nb_importantes,
                COUNT(*) FILTER (WHERE niveau = 'info') as nb_infos,
                COUNT(*) FILTER (WHERE acquittee = true) as nb_acquittees,
                COUNT(DISTINCT a.canard_id) as nb_canards_alertes,
                COUNT(DISTINCT a.type_alerte) as nb_types_distincts,
                MIN(a.time) as premiere_alerte,
                MAX(a.time) as derniere_alerte
            FROM alertes a
            INNER JOIN canards c ON a.canard_id = c.id
            WHERE c.lot_id = $1
        """, lot_id)

        # Répartition par type d'alerte
        types_repartition = await conn.fetch("""
            SELECT
                a.type_alerte,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE a.acquittee = true) as count_acquittees
            FROM alertes a
            INNER JOIN canards c ON a.canard_id = c.id
            WHERE c.lot_id = $1
            GROUP BY a.type_alerte
            ORDER BY count DESC
        """, lot_id)

        # Top 5 canards avec le plus d'alertes
        top_canards = await conn.fetch("""
            SELECT
                c.numero_bague,
                c.race,
                COUNT(*) as nb_alertes,
                COUNT(*) FILTER (WHERE a.niveau = 'critique') as nb_critiques
            FROM alertes a
            INNER JOIN canards c ON a.canard_id = c.id
            WHERE c.lot_id = $1
            GROUP BY c.id, c.numero_bague, c.race
            ORDER BY nb_alertes DESC
            LIMIT 5
        """, lot_id)

        total = stats['total_alertes'] or 0
        taux_acquittement = (stats['nb_acquittees'] / total * 100) if total > 0 else 0

        return {
            "lot_id": lot_id,
            "total_alertes": total,
            "par_niveau": {
                "critique": stats['nb_critiques'] or 0,
                "important": stats['nb_importantes'] or 0,
                "info": stats['nb_infos'] or 0,
            },
            "nb_canards_avec_alertes": stats['nb_canards_alertes'] or 0,
            "nb_types_distincts": stats['nb_types_distincts'] or 0,
            "taux_acquittement": round(taux_acquittement, 2),
            "premiere_alerte": stats['premiere_alerte'].isoformat() if stats['premiere_alerte'] else None,
            "derniere_alerte": stats['derniere_alerte'].isoformat() if stats['derniere_alerte'] else None,
            "repartition_par_type": [
                {
                    "type_alerte": row['type_alerte'],
                    "count": row['count'],
                    "count_acquittees": row['count_acquittees'],
                    "taux_acquittement": round(row['count_acquittees'] / row['count'] * 100, 2) if row['count'] > 0 else 0
                }
                for row in types_repartition
            ],
            "top_canards_alertes": [
                {
                    "numero_bague": row['numero_bague'],
                    "race": row['race'],
                    "nb_alertes": row['nb_alertes'],
                    "nb_critiques": row['nb_critiques']
                }
                for row in top_canards
            ]
        }

