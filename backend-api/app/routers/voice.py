"""
API Endpoints pour la reconnaissance et le parsing de commandes vocales
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from app.services.voice_parser import voice_parser
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["Voice Recognition"])


class VoiceCommandRequest(BaseModel):
    """Requête de parsing de commande vocale"""
    command: str = Field(..., min_length=1, max_length=500, description="Texte de la commande vocale")
    context: Optional[dict] = Field(None, description="Contexte additionnel (lot_id, gaveur_id, etc.)")


class VoiceCommandBatchRequest(BaseModel):
    """Requête de parsing batch de commandes vocales"""
    commands: List[str] = Field(..., min_items=1, max_items=50, description="Liste de commandes vocales")


class VoiceCommandResponse(BaseModel):
    """Réponse du parsing de commande vocale"""
    command_original: str
    parsed_at: str
    success: bool
    type: Optional[str]
    data: dict
    error: Optional[str] = None


class VoiceSuggestionsRequest(BaseModel):
    """Requête de suggestions de commandes"""
    partial_command: str = Field(..., min_length=1, max_length=200)


@router.post("/parse", response_model=VoiceCommandResponse)
async def parse_voice_command(request: VoiceCommandRequest):
    """
    Parse une commande vocale et extrait les données structurées

    **Exemples de commandes supportées:**
    - "dose matin 450 grammes"
    - "poids 3250 lot A123"
    - "température 22 degrés"
    - "mortalité 2 canards"
    - "humidité 65 pourcent"

    **Retourne:**
    - type: Type de commande (dose, poids, temperature, humidite, mortalite)
    - data: Données extraites (valeur, session, lot_code, etc.)
    - success: True si parsing réussi
    """
    try:
        result = voice_parser.parse_command(request.command)

        # Ajouter le contexte si fourni
        if request.context:
            result["data"]["context"] = request.context

        logger.info(f"Commande parsée: {request.command} → {result['type']}")

        return result

    except Exception as e:
        logger.error(f"Erreur parsing commande vocale: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du parsing de la commande: {str(e)}"
        )


@router.post("/parse-batch", response_model=List[VoiceCommandResponse])
async def parse_voice_commands_batch(request: VoiceCommandBatchRequest):
    """
    Parse plusieurs commandes vocales en batch

    **Utilisation:**
    Utile pour traiter plusieurs commandes rapidement (ex: dictée de toute une journée)

    **Limite:** Max 50 commandes par requête
    """
    try:
        results = voice_parser.parse_batch(request.commands)
        logger.info(f"Batch parsing: {len(request.commands)} commandes")
        return results

    except Exception as e:
        logger.error(f"Erreur batch parsing: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du batch parsing: {str(e)}"
        )


@router.post("/suggestions", response_model=List[str])
async def get_command_suggestions(request: VoiceSuggestionsRequest):
    """
    Génère des suggestions de commandes basées sur un début de phrase

    **Utilisation:**
    Aide l'utilisateur en suggérant des formulations complètes

    **Exemples:**
    - "dose" → ["dose matin 450 grammes", "dose soir 480 grammes", ...]
    - "poids" → ["poids 3250 grammes", "pèse 3.5 kilos", ...]
    """
    try:
        suggestions = voice_parser.get_suggestions(request.partial_command)

        if not suggestions:
            return [
                f"{request.partial_command} [aucune suggestion disponible]"
            ]

        logger.info(f"Suggestions pour '{request.partial_command}': {len(suggestions)} trouvées")
        return suggestions

    except Exception as e:
        logger.error(f"Erreur génération suggestions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la génération de suggestions: {str(e)}"
        )


@router.get("/commands/examples", response_model=dict)
async def get_command_examples():
    """
    Retourne des exemples de commandes vocales par catégorie

    **Utilisation:**
    Documentation intégrée pour les gaveurs
    """
    return {
        "dose": [
            "dose matin 450 grammes",
            "dose soir 480 grammes",
            "donner 500 grammes",
            "mettre 1.2 kilos",
            "ajouter 550 g lot A123"
        ],
        "poids": [
            "poids 3250 grammes",
            "pèse 3.5 kilos",
            "pesée matin 3200",
            "poids 3400 lot B456"
        ],
        "temperature": [
            "température 22 degrés",
            "temp 23.5 celsius",
            "température 21°"
        ],
        "humidite": [
            "humidité 65 pourcent",
            "hygrométrie 70%",
            "humidité 60 pour cent"
        ],
        "mortalite": [
            "mortalité 2 canards",
            "mort 1 canard",
            "décès 3 bêtes",
            "perte 1 animal lot C789"
        ],
        "session": [
            "dose matin 450 grammes",
            "poids soir 3400",
            "température journée 22"
        ]
    }


@router.get("/health")
async def voice_health_check():
    """Health check du service de reconnaissance vocale"""
    return {
        "status": "healthy",
        "service": "voice-recognition",
        "parser": "VoiceCommandParser",
        "supported_commands": ["dose", "poids", "temperature", "humidite", "mortalite"]
    }
