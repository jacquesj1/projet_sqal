"""
Service de parsing de commandes vocales pour saisie rapide gavage
Analyse les commandes en langage naturel et extrait les données structurées
"""

import re
from typing import Dict, Optional, List, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class VoiceCommandParser:
    """Parser de commandes vocales en français pour la saisie de gavage"""

    # Patterns de reconnaissance
    DOSE_PATTERN = r"(?:dose|donner|mettre|ajouter)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:grammes?|g|kilos?|kg)?"
    POIDS_PATTERN = r"(?:poids|pèse|pesée)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:grammes?|g|kilos?|kg)?"
    TEMPERATURE_PATTERN = r"(?:température|temp)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:degrés?|°|celsius)?"
    HUMIDITE_PATTERN = r"(?:humidité|hygrométrie)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:pourcent|%|pour\s+cent)?"
    MORTALITE_PATTERN = r"(?:mortalité|mort|décès|perte)\s+(?:de\s+)?(\d+)\s*(?:canards?|bêtes?|animaux?)?"
    LOT_PATTERN = r"(?:lot|numéro\s+lot|n°\s+lot)\s+(\w+[-]?\w*)"
    SESSION_PATTERN = r"\b(matin|soir|journée|jour)\b"

    # Mots-clés pour contexte
    MATIN_KEYWORDS = ["matin", "matinée", "8h", "huit heures"]
    SOIR_KEYWORDS = ["soir", "soirée", "18h", "dix-huit heures", "19h"]

    def __init__(self):
        """Initialise le parser avec les patterns compilés"""
        self.dose_re = re.compile(self.DOSE_PATTERN, re.IGNORECASE)
        self.poids_re = re.compile(self.POIDS_PATTERN, re.IGNORECASE)
        self.temp_re = re.compile(self.TEMPERATURE_PATTERN, re.IGNORECASE)
        self.humid_re = re.compile(self.HUMIDITE_PATTERN, re.IGNORECASE)
        self.mort_re = re.compile(self.MORTALITE_PATTERN, re.IGNORECASE)
        self.lot_re = re.compile(self.LOT_PATTERN, re.IGNORECASE)
        self.session_re = re.compile(self.SESSION_PATTERN, re.IGNORECASE)

    def parse_command(self, command: str) -> Dict:
        """
        Parse une commande vocale et extrait les données structurées

        Args:
            command: Texte de la commande vocale

        Returns:
            Dict avec les données extraites et le type d'action

        Exemples:
            "dose matin 450 grammes" → {"type": "dose", "session": "matin", "valeur": 450}
            "poids 3250 lot A123" → {"type": "poids", "valeur": 3250, "lot_code": "A123"}
            "température 22 degrés" → {"type": "temperature", "valeur": 22}
            "mortalité 2 canards" → {"type": "mortalite", "valeur": 2}
        """
        command_lower = command.lower().strip()
        logger.info(f"Parsing commande: {command}")

        result = {
            "command_original": command,
            "parsed_at": datetime.now().isoformat(),
            "success": False,
            "type": None,
            "data": {}
        }

        # Détecter la session (matin/soir)
        session = self._detect_session(command_lower)
        if session:
            result["data"]["session"] = session

        # Détecter le lot
        lot_code = self._extract_lot_code(command_lower)
        if lot_code:
            result["data"]["lot_code"] = lot_code

        # Parser selon le type de commande
        if "dose" in command_lower or "donner" in command_lower or "mettre" in command_lower:
            dose_data = self._parse_dose(command_lower)
            if dose_data:
                result["type"] = "dose"
                result["data"].update(dose_data)
                result["success"] = True

        elif "poids" in command_lower or "pèse" in command_lower or "pesée" in command_lower:
            poids_data = self._parse_poids(command_lower)
            if poids_data:
                result["type"] = "poids"
                result["data"].update(poids_data)
                result["success"] = True

        elif "température" in command_lower or "temp" in command_lower:
            temp_data = self._parse_temperature(command_lower)
            if temp_data:
                result["type"] = "temperature"
                result["data"].update(temp_data)
                result["success"] = True

        elif "humidité" in command_lower or "hygrométrie" in command_lower:
            humid_data = self._parse_humidite(command_lower)
            if humid_data:
                result["type"] = "humidite"
                result["data"].update(humid_data)
                result["success"] = True

        elif "mortalité" in command_lower or "mort" in command_lower or "décès" in command_lower:
            mort_data = self._parse_mortalite(command_lower)
            if mort_data:
                result["type"] = "mortalite"
                result["data"].update(mort_data)
                result["success"] = True

        else:
            result["error"] = "Type de commande non reconnu"
            logger.warning(f"Commande non reconnue: {command}")

        return result

    def _detect_session(self, command: str) -> Optional[str]:
        """Détecte si la commande concerne le matin ou le soir"""
        if any(kw in command for kw in self.MATIN_KEYWORDS):
            return "matin"
        elif any(kw in command for kw in self.SOIR_KEYWORDS):
            return "soir"
        return None

    def _extract_lot_code(self, command: str) -> Optional[str]:
        """Extrait le code lot de la commande"""
        match = self.lot_re.search(command)
        if match:
            return match.group(1).upper()
        return None

    def _parse_dose(self, command: str) -> Optional[Dict]:
        """Parse une commande de dose"""
        match = self.dose_re.search(command)
        if match:
            valeur_str = match.group(1).replace(',', '.')
            valeur = float(valeur_str)

            # Conversion kg → g si nécessaire
            if "kilo" in command or "kg" in command:
                valeur *= 1000

            return {"valeur": valeur, "unite": "g"}
        return None

    def _parse_poids(self, command: str) -> Optional[Dict]:
        """Parse une commande de poids"""
        match = self.poids_re.search(command)
        if match:
            valeur_str = match.group(1).replace(',', '.')
            valeur = float(valeur_str)

            # Conversion kg → g si nécessaire
            if "kilo" in command or "kg" in command:
                valeur *= 1000

            return {"valeur": valeur, "unite": "g"}
        return None

    def _parse_temperature(self, command: str) -> Optional[Dict]:
        """Parse une commande de température"""
        match = self.temp_re.search(command)
        if match:
            valeur_str = match.group(1).replace(',', '.')
            valeur = float(valeur_str)
            return {"valeur": valeur, "unite": "°C"}
        return None

    def _parse_humidite(self, command: str) -> Optional[Dict]:
        """Parse une commande d'humidité"""
        match = self.humid_re.search(command)
        if match:
            valeur_str = match.group(1).replace(',', '.')
            valeur = float(valeur_str)
            return {"valeur": valeur, "unite": "%"}
        return None

    def _parse_mortalite(self, command: str) -> Optional[Dict]:
        """Parse une commande de mortalité"""
        match = self.mort_re.search(command)
        if match:
            valeur = int(match.group(1))
            return {"valeur": valeur, "unite": "canards"}
        return None

    def parse_batch(self, commands: List[str]) -> List[Dict]:
        """
        Parse plusieurs commandes en batch

        Args:
            commands: Liste de commandes vocales

        Returns:
            Liste de résultats parsés
        """
        return [self.parse_command(cmd) for cmd in commands]

    def get_suggestions(self, partial_command: str) -> List[str]:
        """
        Génère des suggestions de commandes basées sur un début de phrase

        Args:
            partial_command: Début de commande

        Returns:
            Liste de suggestions de commandes complètes
        """
        suggestions = []
        partial_lower = partial_command.lower()

        if "dose" in partial_lower:
            suggestions.extend([
                "dose matin 450 grammes",
                "dose soir 480 grammes",
                "donner 500 grammes lot A123"
            ])

        if "poids" in partial_lower:
            suggestions.extend([
                "poids 3250 grammes",
                "pèse 3.5 kilos",
                "pesée matin 3200 grammes"
            ])

        if "temp" in partial_lower:
            suggestions.extend([
                "température 22 degrés",
                "temp 23.5 celsius"
            ])

        if "humid" in partial_lower:
            suggestions.extend([
                "humidité 65 pourcent",
                "hygrométrie 70%"
            ])

        if "mort" in partial_lower:
            suggestions.extend([
                "mortalité 2 canards",
                "mort 1 canard lot A123",
                "décès 3 bêtes"
            ])

        return suggestions


# Instance globale du parser
voice_parser = VoiceCommandParser()
