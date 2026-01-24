"""
Voice Assistant Module - Speech-to-Text for Duck Feeding Data Entry
Uses OpenAI Whisper for transcription + NLP for command parsing

Module permettant la saisie vocale des données de gavage.
Le gaveur dicte les informations et le système les parse automatiquement.
"""

import asyncpg
from typing import Dict, Optional, List
from datetime import datetime
import base64
import io
import logging
import re

# Whisper imports (conditional for optional dependency)
try:
    import whisper
    import torch
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    logging.warning("Whisper not available. Install with: pip install openai-whisper")

# Audio processing
try:
    from pydub import AudioSegment
    import numpy as np
    AUDIO_PROCESSING_AVAILABLE = True
except ImportError:
    AUDIO_PROCESSING_AVAILABLE = False
    logging.warning("Audio processing not available. Install: pip install pydub numpy")
    # Fallback pour éviter NameError
    import numpy as np

logger = logging.getLogger(__name__)


class VoiceAssistant:
    """
    Assistant vocal pour saisie de données de gavage

    Fonctionnalités:
    1. Speech-to-Text avec Whisper (OpenAI)
    2. Parsing intelligent des commandes vocales
    3. Extraction automatique des données (dose, poids, température, etc.)
    4. Support multi-langue (français prioritaire)

    Exemples de commandes:
    - "dose matin 450 grammes"
    - "poids matin 3 kilos 250"
    - "température stabule 21 degrés"
    - "canard numéro 42 dose soir 485"
    """

    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
        self.model: Optional[whisper.Whisper] = None
        self.model_size = "base"  # Options: tiny, base, small, medium, large

        if not WHISPER_AVAILABLE:
            logger.error("Whisper is required for Voice Assistant")

        # Patterns pour parsing
        self.patterns = {
            "dose_matin": r"dose\s+matin\s+(\d+)",
            "dose_soir": r"dose\s+soir\s+(\d+)",
            "poids_matin": r"poids\s+matin\s+(\d+)(?:\s+kilos?)?\s*(\d+)?",
            "poids_soir": r"poids\s+soir\s+(\d+)(?:\s+kilos?)?\s*(\d+)?",
            "temperature": r"temp[eé]rature\s+(?:stabule\s+)?(\d+)(?:\s+degr[eé]s?)?",
            "humidite": r"humidit[eé]\s+(\d+)(?:\s+pour\s*cent)?",
            "canard_id": r"canard\s+(?:num[eé]ro\s+)?(\d+)",
            "remarque": r"remarque\s+(.+)",
        }

    def load_model(self, model_size: str = "base"):
        """
        Charge le modèle Whisper

        Model sizes:
        - tiny: 39M params, ~1GB RAM, fastest
        - base: 74M params, ~1GB RAM, good speed/quality
        - small: 244M params, ~2GB RAM, better quality
        - medium: 769M params, ~5GB RAM, high quality
        - large: 1550M params, ~10GB RAM, best quality

        Args:
            model_size: Taille du modèle (tiny, base, small, medium, large)
        """
        if not WHISPER_AVAILABLE:
            raise RuntimeError("Whisper is not installed")

        logger.info(f"Loading Whisper model '{model_size}'...")
        self.model = whisper.load_model(model_size)
        self.model_size = model_size
        logger.info(f"Whisper model '{model_size}' loaded successfully")

    def decode_audio(self, audio_base64: str) -> np.ndarray:
        """
        Décode un audio base64 en numpy array

        Formats supportés: MP3, WAV, OGG, M4A, FLAC
        Output: numpy array PCM 16kHz mono

        Args:
            audio_base64: Audio encodé en base64

        Returns:
            np.ndarray: Audio array
        """
        if not AUDIO_PROCESSING_AVAILABLE:
            raise RuntimeError("Audio processing libraries not installed")

        # Decode base64
        audio_data = base64.b64decode(audio_base64)

        # Load audio
        audio = AudioSegment.from_file(io.BytesIO(audio_data))

        # Convert to mono 16kHz
        audio = audio.set_channels(1)
        audio = audio.set_frame_rate(16000)

        # To numpy array
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)

        # Normalize to [-1, 1]
        samples = samples / np.max(np.abs(samples))

        return samples

    async def transcribe(
        self,
        audio_base64: str,
        language: str = "fr"
    ) -> Dict:
        """
        Transcrit un audio en texte avec Whisper

        Args:
            audio_base64: Audio encodé en base64
            language: Langue (fr, en, es, de, it...)

        Returns:
            Dict: {
                "text": str,
                "language": str,
                "confidence": float,
                "segments": List[Dict]
            }
        """
        if not WHISPER_AVAILABLE:
            return {
                "text": "",
                "language": language,
                "confidence": 0.0,
                "error": "Whisper not installed",
                "segments": []
            }

        # Load model if not loaded
        if self.model is None:
            self.load_model(self.model_size)

        # Decode audio
        try:
            audio = self.decode_audio(audio_base64)
        except Exception as e:
            return {
                "text": "",
                "language": language,
                "confidence": 0.0,
                "error": f"Failed to decode audio: {str(e)}",
                "segments": []
            }

        # Transcribe
        try:
            result = self.model.transcribe(
                audio,
                language=language,
                task="transcribe",
                fp16=torch.cuda.is_available()
            )

            return {
                "text": result["text"].strip(),
                "language": result["language"],
                "confidence": self._calculate_confidence(result),
                "segments": result.get("segments", []),
                "error": None
            }

        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return {
                "text": "",
                "language": language,
                "confidence": 0.0,
                "error": str(e),
                "segments": []
            }

    def _calculate_confidence(self, whisper_result: Dict) -> float:
        """
        Calcule un score de confiance basé sur les segments Whisper

        Args:
            whisper_result: Résultat de Whisper

        Returns:
            float: Confiance moyenne (0-1)
        """
        segments = whisper_result.get("segments", [])
        if not segments:
            return 0.5

        # Average of no_speech_prob (inverted)
        confidences = [1.0 - seg.get("no_speech_prob", 0.5) for seg in segments]
        return sum(confidences) / len(confidences)

    def parse_gavage_command(self, text: str) -> Dict:
        """
        Parse une commande vocale de gavage

        Exemples:
        - "dose matin 450 grammes" → {"dose_matin": 450}
        - "poids matin 3 kilos 250" → {"poids_matin": 3250}
        - "canard 42 dose soir 485" → {"canard_id": 42, "dose_soir": 485}
        - "température 21 degrés humidité 65" → {"temperature": 21, "humidite": 65}

        Args:
            text: Texte transcrit

        Returns:
            Dict: Données parsées
        """
        text_lower = text.lower()
        parsed_data = {}

        # Canard ID
        match = re.search(self.patterns["canard_id"], text_lower)
        if match:
            parsed_data["canard_id"] = int(match.group(1))

        # Dose matin
        match = re.search(self.patterns["dose_matin"], text_lower)
        if match:
            parsed_data["dose_matin"] = int(match.group(1))

        # Dose soir
        match = re.search(self.patterns["dose_soir"], text_lower)
        if match:
            parsed_data["dose_soir"] = int(match.group(1))

        # Poids matin (format: "3 kilos 250" ou "3250")
        match = re.search(self.patterns["poids_matin"], text_lower)
        if match:
            kilos = int(match.group(1))
            grammes = int(match.group(2)) if match.group(2) else 0
            parsed_data["poids_matin"] = kilos * 1000 + grammes

        # Poids soir
        match = re.search(self.patterns["poids_soir"], text_lower)
        if match:
            kilos = int(match.group(1))
            grammes = int(match.group(2)) if match.group(2) else 0
            parsed_data["poids_soir"] = kilos * 1000 + grammes

        # Température
        match = re.search(self.patterns["temperature"], text_lower)
        if match:
            parsed_data["temperature_stabule"] = int(match.group(1))

        # Humidité
        match = re.search(self.patterns["humidite"], text_lower)
        if match:
            parsed_data["humidite_stabule"] = int(match.group(1))

        # Remarque (tout ce qui suit "remarque")
        match = re.search(self.patterns["remarque"], text_lower)
        if match:
            parsed_data["remarque"] = match.group(1).strip()

        return parsed_data

    async def process_voice_command(
        self,
        audio_base64: str,
        language: str = "fr"
    ) -> Dict:
        """
        Traite une commande vocale complète (transcription + parsing)

        Args:
            audio_base64: Audio encodé en base64
            language: Langue (défaut: français)

        Returns:
            Dict: {
                "transcription": str,
                "parsed_data": Dict,
                "confidence": float,
                "language": str,
                "status": str
            }
        """
        # Transcribe
        transcription_result = await self.transcribe(audio_base64, language)

        if transcription_result.get("error"):
            return {
                "transcription": "",
                "parsed_data": {},
                "confidence": 0.0,
                "language": language,
                "status": "error",
                "error": transcription_result["error"]
            }

        text = transcription_result["text"]
        confidence = transcription_result["confidence"]

        # Parse
        parsed_data = self.parse_gavage_command(text)

        # Store interaction in database
        await self._store_voice_interaction(
            text,
            parsed_data,
            confidence,
            language
        )

        return {
            "transcription": text,
            "parsed_data": parsed_data,
            "confidence": confidence,
            "language": transcription_result["language"],
            "status": "success",
            "nb_fields_extracted": len(parsed_data)
        }

    async def _store_voice_interaction(
        self,
        text: str,
        parsed_data: Dict,
        confidence: float,
        language: str
    ):
        """Stocke l'interaction vocale dans la base de données"""
        query = """
        INSERT INTO voice_interactions (
            transcription,
            parsed_data,
            confidence,
            language,
            created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        """

        async with self.db_pool.acquire() as conn:
            await conn.execute(
                query,
                text,
                parsed_data,
                confidence,
                language
            )

    async def get_voice_statistics(self, gaveur_id: Optional[int] = None) -> Dict:
        """
        Statistiques d'utilisation de la saisie vocale

        Returns:
            Dict: Statistiques (nb utilisations, confiance moyenne, etc.)
        """
        query = """
        SELECT
            COUNT(*) as nb_interactions,
            AVG(confidence) as avg_confidence,
            COUNT(DISTINCT DATE(created_at)) as nb_jours_utilises,
            MAX(created_at) as derniere_utilisation
        FROM voice_interactions
        """

        if gaveur_id:
            query += f" WHERE gaveur_id = {gaveur_id}"

        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query)

        return {
            "nb_interactions": row['nb_interactions'],
            "avg_confidence": float(row['avg_confidence']) if row['avg_confidence'] else 0.0,
            "nb_jours_utilises": row['nb_jours_utilises'],
            "derniere_utilisation": row['derniere_utilisation'].isoformat() if row['derniere_utilisation'] else None
        }

    def get_supported_commands(self) -> List[Dict]:
        """
        Retourne la liste des commandes vocales supportées

        Returns:
            List[Dict]: Liste des patterns supportés avec exemples
        """
        return [
            {
                "commande": "dose_matin",
                "pattern": "dose matin <nombre>",
                "exemples": [
                    "dose matin 450 grammes",
                    "dose matin quatre cent cinquante"
                ]
            },
            {
                "commande": "dose_soir",
                "pattern": "dose soir <nombre>",
                "exemples": [
                    "dose soir 485",
                    "dose soir quatre cent quatre vingt cinq"
                ]
            },
            {
                "commande": "poids_matin",
                "pattern": "poids matin <kilos> [grammes]",
                "exemples": [
                    "poids matin 3 kilos 250",
                    "poids matin trois kilos deux cent cinquante",
                    "poids matin 3250 grammes"
                ]
            },
            {
                "commande": "poids_soir",
                "pattern": "poids soir <kilos> [grammes]",
                "exemples": [
                    "poids soir 3 kilos 320",
                    "poids soir 3320 grammes"
                ]
            },
            {
                "commande": "temperature",
                "pattern": "température [stabule] <nombre> [degrés]",
                "exemples": [
                    "température stabule 21 degrés",
                    "température 21"
                ]
            },
            {
                "commande": "humidite",
                "pattern": "humidité <nombre> [pourcent]",
                "exemples": [
                    "humidité 65 pourcent",
                    "humidité 65"
                ]
            },
            {
                "commande": "canard_id",
                "pattern": "canard [numéro] <id>",
                "exemples": [
                    "canard numéro 42",
                    "canard 42"
                ]
            },
            {
                "commande": "remarque",
                "pattern": "remarque <texte libre>",
                "exemples": [
                    "remarque canard agité ce matin",
                    "remarque comportement normal"
                ]
            }
        ]


def get_voice_assistant(db_pool: asyncpg.Pool) -> VoiceAssistant:
    """Factory function to get VoiceAssistant instance"""
    return VoiceAssistant(db_pool)
