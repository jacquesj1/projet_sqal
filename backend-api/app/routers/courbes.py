"""
================================================================================
COURBES - API Router pour PySR 3-Courbes Workflow
================================================================================
Description : Gestion complète du workflow 3-courbes
              - Courbe Théorique (PySR + validation superviseur)
              - Courbe Réelle (saisie quotidienne gaveur)
              - Courbe de Correction (IA temps réel)
Prefix      : /api/courbes
Date        : 2026-01-09
================================================================================
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel
import asyncpg
import os

# Configuration
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://gaveurs_admin:gaveurs_secure_2024@timescaledb:5432/gaveurs_db'
)

# Router
router = APIRouter(prefix="/api/courbes", tags=["courbes"])


# ============================================================================
# MODÈLES PYDANTIC
# ============================================================================

class DoseJournaliere(BaseModel):
    """Dose pour un jour spécifique"""
    jour: int
    dose_g: float


class CourbeTheorique(BaseModel):
    """Courbe théorique PySR validée"""
    id: Optional[int] = None
    lot_id: int
    gaveur_id: int
    site_code: str
    pysr_equation: Optional[str] = None
    pysr_r2_score: Optional[float] = None
    courbe_theorique: List[DoseJournaliere]
    duree_gavage_jours: int
    statut: str = "EN_ATTENTE"  # EN_ATTENTE, VALIDEE, MODIFIEE, REJETEE
    superviseur_nom: Optional[str] = None
    commentaire_superviseur: Optional[str] = None
    courbe_modifiee: Optional[List[DoseJournaliere]] = None


class CourbeReelleJour(BaseModel):
    """Saisie dose réelle pour 1 jour"""
    lot_id: int
    gaveur_id: int
    site_code: str
    date_gavage: date
    jour_gavage: int
    dose_reelle_g: float
    dose_theorique_g: Optional[float] = None
    ecart_g: Optional[float] = None
    ecart_pct: Optional[float] = None
    alerte_ecart: Optional[bool] = None
    commentaire_gaveur: Optional[str] = None


class CorrectionIA(BaseModel):
    """Suggestion de correction IA"""
    lot_id: int
    gaveur_id: int
    date_correction: date
    jour_gavage: int
    ecart_detecte_g: float
    ecart_detecte_pct: float
    dose_suggeree_g: float
    raison_suggestion: str
    confiance_score: float
    acceptee: Optional[bool] = None


class ValidationCourbe(BaseModel):
    """Validation/rejet courbe par superviseur"""
    courbe_id: int
    statut: str  # VALIDEE, REJETEE
    superviseur_nom: str
    commentaire: Optional[str] = None
    courbe_modifiee: Optional[List[DoseJournaliere]] = None


# ============================================================================
# DÉPENDANCE - Connexion DB
# ============================================================================

async def get_db_connection():
    """Obtenir une connexion à la base de données"""
    conn = await asyncpg.connect(DATABASE_URL, ssl=False)
    try:
        yield conn
    finally:
        await conn.close()


# ============================================================================
# ENDPOINTS - COURBE THÉORIQUE (PySR)
# ============================================================================

@router.post("/theorique")
async def create_courbe_theorique(
    courbe: CourbeTheorique,
    conn = Depends(get_db_connection)
):
    """
    Créer une courbe théorique PySR pour un lot

    Typiquement appelé après entraînement PySR pour enregistrer
    la courbe optimale générée.
    """
    import json

    row = await conn.fetchrow("""
        INSERT INTO courbes_gavage_optimales (
            lot_id, gaveur_id, site_code,
            pysr_equation, pysr_r2_score,
            courbe_theorique, duree_gavage_jours,
            statut
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, created_at
    """,
        courbe.lot_id,
        courbe.gaveur_id,
        courbe.site_code,
        courbe.pysr_equation,
        courbe.pysr_r2_score,
        json.dumps([d.dict() for d in courbe.courbe_theorique]),
        courbe.duree_gavage_jours,
        courbe.statut
    )

    return {
        'id': row['id'],
        'lot_id': courbe.lot_id,
        'statut': courbe.statut,
        'message': 'Courbe théorique créée (en attente validation superviseur)',
        'created_at': row['created_at'].isoformat()
    }


@router.get("/theorique/lot/{lot_id}")
async def get_courbe_theorique_lot(
    lot_id: int,
    conn = Depends(get_db_connection)
):
    """
    Récupérer la courbe théorique d'un lot spécifique
    """
    row = await conn.fetchrow("""
        SELECT
            id, lot_id, gaveur_id, site_code,
            pysr_equation, pysr_r2_score, pysr_complexity,
            courbe_theorique, courbe_modifiee,
            duree_gavage_jours, statut,
            superviseur_nom, date_validation,
            commentaire_superviseur,
            created_at, updated_at
        FROM courbes_gavage_optimales
        WHERE lot_id = $1
        ORDER BY created_at DESC
        LIMIT 1
    """, lot_id)

    if not row:
        raise HTTPException(status_code=404, detail=f"Aucune courbe théorique pour lot {lot_id}")

    # Utiliser courbe modifiée si existe, sinon courbe théorique
    courbe_active = row['courbe_modifiee'] if row['courbe_modifiee'] else row['courbe_theorique']

    return {
        **dict(row),
        'courbe_active': courbe_active  # Courbe à suivre (modifiée ou théorique)
    }


@router.post("/theorique/{courbe_id}/valider")
async def valider_courbe(
    courbe_id: int,
    validation: ValidationCourbe,
    conn = Depends(get_db_connection)
):
    """
    Valider ou rejeter une courbe théorique (action superviseur)

    - VALIDEE : Courbe approuvée, gaveur peut la suivre
    - MODIFIEE : Superviseur a ajusté la courbe
    - REJETEE : Courbe refusée, doit être régénérée
    """
    import json

    # Vérifier que la courbe existe
    courbe = await conn.fetchrow(
        "SELECT id, statut FROM courbes_gavage_optimales WHERE id = $1",
        courbe_id
    )

    if not courbe:
        raise HTTPException(status_code=404, detail=f"Courbe {courbe_id} introuvable")

    # Mettre à jour statut
    courbe_modifiee_json = None
    if validation.courbe_modifiee:
        courbe_modifiee_json = json.dumps([d.dict() for d in validation.courbe_modifiee])

    await conn.execute("""
        UPDATE courbes_gavage_optimales
        SET
            statut = $1,
            superviseur_nom = $2,
            date_validation = NOW(),
            commentaire_superviseur = $3,
            courbe_modifiee = $4,
            updated_at = NOW()
        WHERE id = $5
    """,
        validation.statut,
        validation.superviseur_nom,
        validation.commentaire,
        courbe_modifiee_json,
        courbe_id
    )

    return {
        'courbe_id': courbe_id,
        'statut': validation.statut,
        'superviseur': validation.superviseur_nom,
        'message': f"Courbe {validation.statut.lower()} par {validation.superviseur_nom}"
    }


# ============================================================================
# ENDPOINTS - COURBE RÉELLE (Saisie gaveur quotidienne)
# ============================================================================

@router.post("/reelle")
async def saisir_dose_reelle(
    dose: CourbeReelleJour,
    conn = Depends(get_db_connection)
):
    """
    Enregistrer la dose réellement donnée par un gaveur

    - Auto-calcule l'écart vs courbe théorique
    - Déclenche alerte si écart > 10%
    - Peut générer une suggestion de correction IA
    """
    # Récupérer ID courbe optimale du lot
    courbe_opt = await conn.fetchrow("""
        SELECT id FROM courbes_gavage_optimales
        WHERE lot_id = $1 AND statut IN ('VALIDEE', 'MODIFIEE')
        ORDER BY created_at DESC LIMIT 1
    """, dose.lot_id)

    courbe_optimale_id = courbe_opt['id'] if courbe_opt else None

    # Insérer dose réelle (trigger auto-calcule écart)
    try:
        row = await conn.fetchrow("""
            INSERT INTO courbe_reelle_quotidienne (
                lot_id, gaveur_id, site_code,
                date_gavage, jour_gavage, dose_reelle_g,
                courbe_optimale_id, commentaire_gaveur
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
                id, ecart_g, ecart_pct, alerte_ecart,
                dose_theorique_g, created_at
        """,
            dose.lot_id,
            dose.gaveur_id,
            dose.site_code,
            dose.date_gavage,
            dose.jour_gavage,
            dose.dose_reelle_g,
            courbe_optimale_id,
            dose.commentaire_gaveur
        )
    except asyncpg.exceptions.UniqueViolationError:
        raise HTTPException(
            status_code=409,
            detail=f"Dose déjà saisie pour lot {dose.lot_id} jour {dose.jour_gavage}"
        )

    result = {
        'id': row['id'],
        'dose_reelle_g': dose.dose_reelle_g,
        'dose_theorique_g': row['dose_theorique_g'],
        'ecart_g': row['ecart_g'],
        'ecart_pct': row['ecart_pct'],
        'alerte_ecart': row['alerte_ecart'],
        'created_at': row['created_at'].isoformat()
    }

    # Si alerte écart, générer suggestion correction IA
    if row['alerte_ecart']:
        suggestion = await conn.fetchrow("""
            SELECT dose_suggeree, raison, confiance
            FROM generer_correction_ia($1, $2, $3, $4)
        """,
            dose.lot_id,
            dose.jour_gavage,
            row['ecart_g'],
            row['ecart_pct']
        )

        # Enregistrer suggestion
        await conn.execute("""
            INSERT INTO corrections_ia_quotidiennes (
                lot_id, gaveur_id, date_correction, jour_gavage,
                ecart_detecte_g, ecart_detecte_pct,
                dose_suggeree_g, raison_suggestion, confiance_score
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (lot_id, jour_gavage, date_correction) DO NOTHING
        """,
            dose.lot_id,
            dose.gaveur_id,
            dose.date_gavage,
            dose.jour_gavage,
            row['ecart_g'],
            row['ecart_pct'],
            suggestion['dose_suggeree'],
            suggestion['raison'],
            suggestion['confiance']
        )

        result['correction_ia'] = {
            'dose_suggeree_g': float(suggestion['dose_suggeree']),
            'raison': suggestion['raison'],
            'confiance': float(suggestion['confiance'])
        }

    return result


@router.get("/reelle/lot/{lot_id}")
async def get_courbe_reelle_lot(
    lot_id: int,
    conn = Depends(get_db_connection)
):
    """
    Récupérer toutes les doses réelles d'un lot
    """
    rows = await conn.fetch("""
        SELECT
            jour_gavage,
            date_gavage,
            dose_reelle_g,
            dose_theorique_g,
            ecart_g,
            ecart_pct,
            alerte_ecart,
            commentaire_gaveur,
            created_at
        FROM courbe_reelle_quotidienne
        WHERE lot_id = $1
        ORDER BY jour_gavage ASC
    """, lot_id)

    return [dict(row) for row in rows]


# ============================================================================
# ENDPOINTS - CORRECTIONS IA
# ============================================================================

@router.get("/corrections/gaveur/{gaveur_id}")
async def get_corrections_gaveur(
    gaveur_id: int,
    pending_only: bool = Query(True, description="Seulement corrections en attente"),
    conn = Depends(get_db_connection)
):
    """
    Récupérer corrections IA pour un gaveur

    Used by gaveur frontend to show pending AI suggestions
    """
    query = """
        SELECT
            c.id,
            c.lot_id,
            l.code_lot,
            c.date_correction,
            c.jour_gavage,
            c.ecart_detecte_g,
            c.ecart_detecte_pct,
            c.dose_suggeree_g,
            c.raison_suggestion,
            c.confiance_score,
            c.acceptee,
            c.dose_finale_appliquee_g,
            c.created_at
        FROM corrections_ia_quotidiennes c
        JOIN lots_gavage l ON c.lot_id = l.id
        WHERE c.gaveur_id = $1
    """

    params = [gaveur_id]

    if pending_only:
        query += " AND c.acceptee IS NULL"

    query += " ORDER BY c.date_correction DESC, c.jour_gavage DESC LIMIT 50"

    rows = await conn.fetch(query, *params)
    return [dict(row) for row in rows]


@router.post("/corrections/{correction_id}/repondre")
async def repondre_correction(
    correction_id: int,
    acceptee: bool,
    dose_finale_g: Optional[float] = None,
    conn = Depends(get_db_connection)
):
    """
    Gaveur accepte ou refuse correction IA

    - acceptee=True : Gaveur applique la dose suggérée
    - acceptee=False : Gaveur refuse, garde sa dose ou en choisit une autre
    """
    await conn.execute("""
        UPDATE corrections_ia_quotidiennes
        SET
            acceptee = $1,
            dose_finale_appliquee_g = $2,
            date_reponse_gaveur = NOW()
        WHERE id = $3
    """,
        acceptee,
        dose_finale_g,
        correction_id
    )

    return {
        'correction_id': correction_id,
        'acceptee': acceptee,
        'dose_finale_g': dose_finale_g,
        'message': 'Acceptée' if acceptee else 'Refusée'
    }


# ============================================================================
# ENDPOINTS - DASHBOARD 3 COURBES
# ============================================================================

@router.get("/dashboard/lot/{lot_id}")
async def get_dashboard_3_courbes(
    lot_id: int,
    conn = Depends(get_db_connection)
):
    """
    Dashboard complet 3 courbes pour un lot

    Returns:
        - Courbe théorique (PySR validée)
        - Courbe réelle (doses quotidiennes gaveur)
        - Corrections IA (suggestions en cours)
        - Statistiques écarts
    """
    # 1. Courbe théorique
    courbe_theo = await conn.fetchrow("""
        SELECT
            id, pysr_equation, courbe_theorique, courbe_modifiee,
            duree_gavage_jours, statut, superviseur_nom
        FROM courbes_gavage_optimales
        WHERE lot_id = $1
        ORDER BY created_at DESC LIMIT 1
    """, lot_id)

    if not courbe_theo:
        raise HTTPException(status_code=404, detail=f"Aucune courbe pour lot {lot_id}")

    # 2. Courbe réelle
    courbe_reelle = await conn.fetch("""
        SELECT
            jour_gavage, date_gavage,
            dose_reelle_g, dose_theorique_g,
            ecart_g, ecart_pct, alerte_ecart
        FROM courbe_reelle_quotidienne
        WHERE lot_id = $1
        ORDER BY jour_gavage ASC
    """, lot_id)

    # 3. Corrections IA en attente
    corrections = await conn.fetch("""
        SELECT
            jour_gavage, date_correction,
            dose_suggeree_g, raison_suggestion,
            confiance_score, acceptee
        FROM corrections_ia_quotidiennes
        WHERE lot_id = $1
        ORDER BY jour_gavage DESC
    """, lot_id)

    # 4. Stats écarts
    stats = await conn.fetchrow("""
        SELECT
            COUNT(*) as nb_jours_saisis,
            AVG(ABS(ecart_pct)) as ecart_moyen_pct,
            MAX(ABS(ecart_pct)) as ecart_max_pct,
            SUM(CASE WHEN alerte_ecart THEN 1 ELSE 0 END) as nb_alertes
        FROM courbe_reelle_quotidienne
        WHERE lot_id = $1
    """, lot_id)

    return {
        'lot_id': lot_id,
        'courbe_theorique': {
            'id': courbe_theo['id'],
            'equation': courbe_theo['pysr_equation'],
            'courbe': courbe_theo['courbe_modifiee'] or courbe_theo['courbe_theorique'],
            'statut': courbe_theo['statut'],
            'superviseur': courbe_theo['superviseur_nom']
        },
        'courbe_reelle': [dict(row) for row in courbe_reelle],
        'corrections_ia': [dict(row) for row in corrections],
        'statistiques': dict(stats) if stats else {}
    }


# ============================================================================
# ROUTE 10: COURBE PRÉDICTIVE IA
# ============================================================================

@router.get("/predictive/lot/{lot_id}")
async def get_courbe_predictive(lot_id: int):
    """
    Calcule la courbe prédictive IA pour rattraper la courbe théorique

    Algorithme v2 hybride (amélioration Sprint 5):
    1. Récupère courbe théorique et doses réelles
    2. Si pas d'écart significatif → courbe prédictive = courbe théorique
    3. Si écart détecté → utilise algorithme v2:
       - Spline cubique (courbe lisse)
       - Contraintes vétérinaires (sécurité animale)
       - Lissage adaptatif (convergence vers théorique)
       - Ajustement final (atteinte précise objectif)

    Returns:
        Courbe prédictive jour par jour jusqu'à la fin du gavage
    """
    import json
    import logging
    from app.services.courbe_predictive_v2 import generer_courbe_predictive_v2

    logger = logging.getLogger(__name__)

    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # 1. Récupérer courbe théorique
        courbe_theo = await conn.fetchrow("""
            SELECT id, courbe_theorique, courbe_modifiee, duree_gavage_jours
            FROM courbes_gavage_optimales
            WHERE lot_id = $1 AND statut IN ('VALIDEE', 'MODIFIEE')
            ORDER BY created_at DESC LIMIT 1
        """, lot_id)

        if not courbe_theo:
            raise HTTPException(status_code=404, detail="Courbe théorique non trouvée")

        # Parser la courbe théorique
        courbe_ref = courbe_theo['courbe_modifiee'] or courbe_theo['courbe_theorique']
        if isinstance(courbe_ref, str):
            courbe_ref = json.loads(courbe_ref)

        duree_totale = courbe_theo['duree_gavage_jours']

        # 2. Récupérer doses réelles
        doses_reelles = await conn.fetch("""
            SELECT jour_gavage, dose_reelle_g, dose_theorique_g, ecart_pct, alerte_ecart
            FROM courbe_reelle_quotidienne
            WHERE lot_id = $1
            ORDER BY jour_gavage
        """, lot_id)

        # 3. Calculer courbe prédictive
        courbe_predictive = []
        a_des_alertes = False
        dernier_jour_reel = 0

        if not doses_reelles:
            # Pas de données réelles → courbe prédictive = courbe théorique
            courbe_predictive = courbe_ref
        else:
            # Analyser les écarts
            dernier_jour = doses_reelles[-1]['jour_gavage']
            # Convertir Decimal en float pour éviter TypeError
            derniere_dose_reelle = float(doses_reelles[-1]['dose_reelle_g'])
            derniere_dose_theo = float(doses_reelles[-1]['dose_theorique_g'])
            dernier_jour_reel = dernier_jour

            # Calculer écart cumulé
            ecart_cumule = derniere_dose_reelle - derniere_dose_theo
            a_des_alertes = any(d['alerte_ecart'] for d in doses_reelles)

            # Dose finale théorique
            dose_finale_theo = courbe_ref[-1]['dose_g']
            jours_restants = duree_totale - dernier_jour

            if not a_des_alertes or abs(ecart_cumule) < 10:
                # Pas d'écart significatif → suivre la courbe théorique
                courbe_predictive = courbe_ref
            else:
                # Écart significatif → utiliser algorithme v2 hybride

                # Formater données réelles pour v2
                doses_reelles_fmt = [
                    {
                        "jour": d['jour_gavage'],
                        "dose_reelle_g": float(d['dose_reelle_g'])
                    }
                    for d in doses_reelles
                ]

                # Formater doses théoriques pour v2
                doses_theoriques_fmt = [
                    {
                        "jour": i + 1,
                        "dose_theorique_g": courbe_ref[i]['dose_g']
                    }
                    for i in range(len(courbe_ref))
                ]

                # Générer courbe prédictive avec algorithme v2
                courbe_pred_futur = generer_courbe_predictive_v2(
                    doses_reelles=doses_reelles_fmt,
                    doses_theoriques=doses_theoriques_fmt,
                    dernier_jour_reel=dernier_jour_reel,
                    duree_totale=duree_totale,
                    race=None  # TODO: récupérer race du lot
                )

                # Construire courbe complète (passé réel + futur prédictif)
                courbe_predictive = []

                # Copier jours passés (doses réelles)
                for jour in range(1, dernier_jour_reel + 1):
                    dose_jour = next((d['dose_reelle_g'] for d in doses_reelles if d['jour_gavage'] == jour), None)
                    if dose_jour:
                        courbe_predictive.append({"jour": jour, "dose_g": float(dose_jour)})
                    else:
                        # Si pas de donnée réelle, prendre théorique
                        dose_theo = next((c['dose_g'] for c in courbe_ref if c['jour'] == jour), 0)
                        courbe_predictive.append({"jour": jour, "dose_g": dose_theo})

                # Ajouter jours futurs (prédiction v2)
                courbe_predictive.extend(courbe_pred_futur)

        return {
            'lot_id': lot_id,
            'courbe_predictive': courbe_predictive,
            'dernier_jour_reel': dernier_jour_reel,
            'a_des_ecarts': a_des_alertes,
            'algorithme': 'v2_spline_cubique_contraintes' if a_des_alertes else 'courbe_theorique'
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur calcul courbe prédictive lot {lot_id}: {type(e).__name__}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erreur calcul courbe prédictive: {str(e)}")
    finally:
        await conn.close()

# ============================================================================
# ROUTE 11: GÉNÉRATION COURBE PYSR (IA)
# ============================================================================

@router.post("/theorique/generate-pysr")
async def generate_courbe_pysr(
    lot_id: int,
    age_moyen: int = 90,
    poids_foie_cible: float = 400.0,
    duree_gavage: int = 14,
    race: str | None = None,
    food_intake_goal: float | None = None,
    auto_save: bool = True
):
    """
    Génère une courbe théorique via le modèle PySR pré-entraîné

    Args:
        lot_id: ID du lot
        age_moyen: Âge moyen canards (jours), défaut 90
        poids_foie_cible: Objectif poids foie (g), défaut 400
        duree_gavage: Durée (jours), défaut 14
        race: Race canard (optionnel: "Mulard", "Barbarie")
        food_intake_goal: Total aliment (g), calculé auto si None
        auto_save: Sauvegarder en DB automatiquement

    Returns:
        Courbe théorique générée + métadonnées
    """
    import json
    import os

    # Sélectionner implémentation PySR selon variable d'environnement
    use_numpy = os.getenv('PYSR_USE_NUMPY', 'true').lower() == 'true'

    if use_numpy:
        # Version NumPy pure (pas besoin Julia, compatible Windows/Linux)
        from app.ml.pysr_predictor_numpy import get_pysr_predictor_numpy
        predictor = get_pysr_predictor_numpy()
    else:
        # Version PySR avec Julia (besoin pickle compatible)
        from app.ml.pysr_predictor import get_pysr_predictor
        predictor = get_pysr_predictor()

    try:

        # Générer courbe
        result = predictor.generate_courbe_theorique(
            lot_id=lot_id,
            age_moyen=age_moyen,
            poids_foie_cible=poids_foie_cible,
            duree_gavage=duree_gavage,
            race=race,
            food_intake_goal=food_intake_goal
        )

        # Sauvegarder en DB si demandé
        if auto_save:
            conn = await asyncpg.connect(DATABASE_URL)

            try:
                # Équation PySR (metadata)
                pysr_equation = f"PySR {result['metadata']['modele_version']}"

                await conn.execute("""
                    INSERT INTO courbes_gavage_optimales (
                        lot_id, gaveur_id, site_code,
                        courbe_theorique, duree_gavage_jours,
                        pysr_equation, statut, created_at
                    )
                    VALUES ($1, 1, 'LL', $2, $3, $4, 'EN_ATTENTE', NOW())
                    ON CONFLICT (lot_id) DO UPDATE SET
                        courbe_theorique = EXCLUDED.courbe_theorique,
                        duree_gavage_jours = EXCLUDED.duree_gavage_jours,
                        pysr_equation = EXCLUDED.pysr_equation,
                        statut = 'EN_ATTENTE',
                        updated_at = NOW()
                """, lot_id, json.dumps(result['courbe_theorique']),
                    duree_gavage, pysr_equation)

                result['saved_to_db'] = True
                result['status_db'] = 'EN_ATTENTE - Nécessite validation superviseur'

            finally:
                await conn.close()
        else:
            result['saved_to_db'] = False

        return result

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Modèle PySR non disponible: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Paramètres invalides: {str(e)}"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur génération courbe PySR: {str(e)}"
        )
