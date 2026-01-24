"""
Router ML/IA pour FastAPI

Suggestions de dose et recommandations basées sur Machine Learning
Pour le modèle LOT-centric

Date: 28 décembre 2025
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
import json

router = APIRouter(
    prefix="/api/ml",
    tags=["Machine Learning"],
    responses={404: {"description": "Ressource non trouvée"}},
)


@router.get("/suggestions/lot/{lot_id}/jour/{jour}")
async def get_ml_suggestions(
    lot_id: int,
    jour: int,
    request: Request
):
    """
    Obtenir une suggestion IA de dose pour un jour donné

    TODO: Implémenter Random Forest pour suggestions de dose
    Pour l'instant, retourne une suggestion basée sur la courbe théorique
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Vérifier que le lot existe
        lot = await conn.fetchrow("SELECT * FROM lots WHERE id = $1", lot_id)
        if not lot:
            raise HTTPException(status_code=404, detail="Lot non trouvé")

        # TODO: Implémenter le modèle Random Forest
        # Pour l'instant, retourner une suggestion basique basée sur la courbe théorique
        if lot['courbe_theorique']:
            courbe = json.loads(lot['courbe_theorique']) if isinstance(lot['courbe_theorique'], str) else lot['courbe_theorique']
            point = next((p for p in courbe if p.get('jour') == jour), None)

            if point:
                return {
                    "success": True,
                    "data": {
                        "dose_matin": point.get('dose_matin', 150),
                        "dose_soir": point.get('dose_soir', 150),
                        "confiance": 75.0,
                        "source": "courbe_theorique",
                        "message": "Suggestion basée sur la courbe théorique (PySR)"
                    }
                }

        # Si pas de courbe théorique, retourner des valeurs par défaut
        return {
            "success": True,
            "data": {
                "dose_matin": 150,
                "dose_soir": 150,
                "confiance": 50.0,
                "source": "default",
                "message": "Suggestion par défaut - Modèle ML en cours de développement"
            }
        }


@router.get("/recommandations/lot/{lot_id}")
async def get_ml_recommandations(
    lot_id: int,
    request: Request
):
    """
    Obtenir des recommandations globales pour un lot

    TODO: Implémenter analyse ML complète
    Pour l'instant, retourne des recommandations basiques
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Récupérer le lot et son historique
        lot = await conn.fetchrow("SELECT * FROM lots WHERE id = $1", lot_id)
        if not lot:
            raise HTTPException(status_code=404, detail="Lot non trouvé")

        historique = await conn.fetch(
            """
            SELECT * FROM gavage_lot_quotidien
            WHERE lot_id = $1
            ORDER BY date_gavage DESC
            LIMIT 5
            """,
            lot_id
        )

        recommandations = []

        # Analyser les écarts récents
        ecarts_recents = [h['ecart_poids_pourcent'] for h in historique if h.get('ecart_poids_pourcent')]
        if ecarts_recents:
            ecart_moyen = sum(ecarts_recents) / len(ecarts_recents)

            if abs(ecart_moyen) > 10:
                recommandations.append({
                    "type": "ajustement_dose",
                    "urgence": "haute" if abs(ecart_moyen) > 15 else "moyenne",
                    "message": f"Écart moyen de {ecart_moyen:.1f}% détecté. Ajustement recommandé.",
                    "action": "Revoir les doses quotidiennes"
                })

        # Analyser la conformité
        taux_conformite = lot.get('taux_conformite')
        if taux_conformite and taux_conformite < 75:
            recommandations.append({
                "type": "conformite",
                "urgence": "moyenne",
                "message": f"Taux de conformité à {taux_conformite:.1f}% (objectif: 85%)",
                "action": "Suivre plus rigoureusement la courbe théorique"
            })

        # Si pas de recommandations, tout va bien
        if not recommandations:
            recommandations.append({
                "type": "info",
                "urgence": "basse",
                "message": "Gavage conforme aux attentes",
                "action": "Continuer le suivi actuel"
            })

        return {
            "success": True,
            "data": {
                "recommandations": recommandations,
                "analyse_complete": False,  # TODO: Activer quand ML sera implémenté
                "derniere_analyse": datetime.now().isoformat()
            }
        }
