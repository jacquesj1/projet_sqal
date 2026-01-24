"""
Service OCR pour extraction de texte de documents et images
Utilise Tesseract OCR pour la reconnaissance optique de caractères
"""

import base64
import io
import re
from typing import Dict, Optional, List, Tuple
from PIL import Image
import logging

logger = logging.getLogger(__name__)

# Import conditionnel de pytesseract (peut ne pas être installé)
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract non disponible - OCR désactivé")


class OCRService:
    """Service d'extraction de texte via OCR"""

    def __init__(self):
        """Initialise le service OCR"""
        self.tesseract_available = TESSERACT_AVAILABLE

        if TESSERACT_AVAILABLE:
            # Configuration Tesseract pour français
            self.tesseract_config = r'--oem 3 --psm 6 -l fra'
            logger.info("OCR Service initialisé avec Tesseract")
        else:
            logger.warning("OCR Service en mode dégradé (Tesseract non disponible)")

    def extract_text_from_base64(self, image_base64: str, lang: str = 'fra') -> Dict:
        """
        Extrait le texte d'une image encodée en base64

        Args:
            image_base64: Image encodée en base64 (avec ou sans préfixe data:image)
            lang: Langue pour OCR (fra, eng, etc.)

        Returns:
            Dict avec texte extrait et métadonnées
        """
        if not TESSERACT_AVAILABLE:
            return {
                "success": False,
                "error": "Tesseract OCR non installé",
                "text": "",
                "confidence": 0
            }

        try:
            # Nettoyer le base64 (retirer préfixe data:image si présent)
            if ',' in image_base64:
                image_base64 = image_base64.split(',')[1]

            # Décoder l'image
            image_bytes = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(image_bytes))

            # Convertir en niveaux de gris pour meilleure OCR
            image = image.convert('L')

            # Améliorer le contraste (optionnel)
            # from PIL import ImageEnhance
            # enhancer = ImageEnhance.Contrast(image)
            # image = enhancer.enhance(2)

            # Extraire le texte
            config = f'--oem 3 --psm 6 -l {lang}'
            text = pytesseract.image_to_string(image, config=config)

            # Calculer confiance (basique)
            data = pytesseract.image_to_data(image, config=config, output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if conf != '-1']
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0

            logger.info(f"OCR réussi - {len(text)} caractères extraits, confiance {avg_confidence:.1f}%")

            return {
                "success": True,
                "text": text.strip(),
                "confidence": round(avg_confidence, 2),
                "char_count": len(text),
                "line_count": len(text.splitlines())
            }

        except Exception as e:
            logger.error(f"Erreur OCR: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "text": "",
                "confidence": 0
            }

    def extract_text_from_image_file(self, image_path: str, lang: str = 'fra') -> Dict:
        """
        Extrait le texte d'un fichier image

        Args:
            image_path: Chemin vers le fichier image
            lang: Langue pour OCR

        Returns:
            Dict avec texte extrait et métadonnées
        """
        if not TESSERACT_AVAILABLE:
            return {
                "success": False,
                "error": "Tesseract OCR non installé",
                "text": "",
                "confidence": 0
            }

        try:
            image = Image.open(image_path)
            image = image.convert('L')

            config = f'--oem 3 --psm 6 -l {lang}'
            text = pytesseract.image_to_string(image, config=config)

            data = pytesseract.image_to_data(image, config=config, output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if conf != '-1']
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0

            logger.info(f"OCR fichier {image_path}: {len(text)} caractères, confiance {avg_confidence:.1f}%")

            return {
                "success": True,
                "text": text.strip(),
                "confidence": round(avg_confidence, 2),
                "char_count": len(text),
                "line_count": len(text.splitlines())
            }

        except Exception as e:
            logger.error(f"Erreur OCR fichier {image_path}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "text": "",
                "confidence": 0
            }

    def parse_bon_livraison(self, text: str) -> Dict:
        """
        Parse un bon de livraison maïs et extrait les données structurées

        Args:
            text: Texte extrait du bon de livraison

        Returns:
            Dict avec données structurées (date, lot, quantité, fournisseur, etc.)
        """
        result = {
            "type_document": "bon_livraison",
            "date_livraison": None,
            "numero_bon": None,
            "fournisseur": None,
            "produit": "mais",  # Default
            "quantite_kg": None,
            "prix_unitaire": None,
            "total_ht": None,
            "tva": None,
            "raw_text": text
        }

        # Pattern date (DD/MM/YYYY ou DD-MM-YYYY)
        date_pattern = r"(\d{2}[/-]\d{2}[/-]\d{4})"
        date_match = re.search(date_pattern, text)
        if date_match:
            result["date_livraison"] = date_match.group(1).replace('-', '/')

        # Pattern numéro bon (BL-XXXXX, BON-XXXXX, N°XXXXX)
        bon_pattern = r"(?:BL|BON|N°)\s*[:_-]?\s*(\w+[\d]+)"
        bon_match = re.search(bon_pattern, text, re.IGNORECASE)
        if bon_match:
            result["numero_bon"] = bon_match.group(1)

        # Pattern quantité (XXX kg, XXX tonnes)
        quantite_pattern = r"(\d+(?:[.,]\d+)?)\s*(?:kg|kilo|kilogrammes?)"
        quantite_match = re.search(quantite_pattern, text, re.IGNORECASE)
        if quantite_match:
            qte_str = quantite_match.group(1).replace(',', '.')
            result["quantite_kg"] = float(qte_str)

        # Pattern tonnes
        tonne_pattern = r"(\d+(?:[.,]\d+)?)\s*(?:t|tonne|tonnes)"
        tonne_match = re.search(tonne_pattern, text, re.IGNORECASE)
        if tonne_match:
            qte_tonnes = float(tonne_match.group(1).replace(',', '.'))
            result["quantite_kg"] = qte_tonnes * 1000

        # Pattern prix (XX.XX €)
        prix_pattern = r"(\d+(?:[.,]\d+)?)\s*(?:€|EUR|euros?)"
        prix_matches = re.findall(prix_pattern, text, re.IGNORECASE)
        if prix_matches:
            # Prendre le plus grand montant comme total
            prix_nums = [float(p.replace(',', '.')) for p in prix_matches]
            result["total_ht"] = max(prix_nums)

        logger.info(f"Bon livraison parsé: {result['numero_bon']}, {result['quantite_kg']} kg")

        return result

    def parse_fiche_mortalite(self, text: str) -> Dict:
        """
        Parse une fiche de mortalité et extrait les données

        Args:
            text: Texte extrait de la fiche

        Returns:
            Dict avec données de mortalité
        """
        result = {
            "type_document": "fiche_mortalite",
            "date": None,
            "lot_code": None,
            "nombre_morts": 0,
            "causes": [],
            "raw_text": text
        }

        # Pattern date
        date_pattern = r"(\d{2}[/-]\d{2}[/-]\d{4})"
        date_match = re.search(date_pattern, text)
        if date_match:
            result["date"] = date_match.group(1).replace('-', '/')

        # Pattern lot
        lot_pattern = r"(?:lot|LOT)\s*[:_-]?\s*(\w+[-]?\w*)"
        lot_match = re.search(lot_pattern, text, re.IGNORECASE)
        if lot_match:
            result["lot_code"] = lot_match.group(1).upper()

        # Pattern nombre (X mort(s), X décès, X canard(s) perdu(s))
        mort_pattern = r"(\d+)\s*(?:mort|décès|perte|canards?\s+(?:mort|perdu))"
        mort_match = re.search(mort_pattern, text, re.IGNORECASE)
        if mort_match:
            result["nombre_morts"] = int(mort_match.group(1))

        # Détecter causes communes
        causes_keywords = {
            "gavage": ["gavage", "étouffement", "asphyxie"],
            "maladie": ["maladie", "infection", "pathologie"],
            "stress": ["stress", "peur", "panique"],
            "chaleur": ["chaleur", "canicule", "température"],
            "autre": ["accident", "indéterminé", "inconnu"]
        }

        text_lower = text.lower()
        for cause, keywords in causes_keywords.items():
            if any(kw in text_lower for kw in keywords):
                result["causes"].append(cause)

        logger.info(f"Fiche mortalité parsée: lot {result['lot_code']}, {result['nombre_morts']} morts")

        return result

    def parse_fiche_lot(self, text: str) -> Dict:
        """
        Parse une fiche de lot (début de gavage)

        Args:
            text: Texte extrait de la fiche

        Returns:
            Dict avec données du lot
        """
        result = {
            "type_document": "fiche_lot",
            "code_lot": None,
            "date_debut": None,
            "nb_canards": None,
            "souche": None,
            "poids_moyen_initial": None,
            "raw_text": text
        }

        # Pattern code lot
        lot_pattern = r"(?:lot|code)\s*[:_-]?\s*(\w+[-]?\w*)"
        lot_match = re.search(lot_pattern, text, re.IGNORECASE)
        if lot_match:
            result["code_lot"] = lot_match.group(1).upper()

        # Pattern date
        date_pattern = r"(\d{2}[/-]\d{2}[/-]\d{4})"
        date_match = re.search(date_pattern, text)
        if date_match:
            result["date_debut"] = date_match.group(1).replace('-', '/')

        # Pattern nombre canards
        nb_pattern = r"(\d+)\s*(?:canards?|têtes?|bêtes?|animaux?)"
        nb_match = re.search(nb_pattern, text, re.IGNORECASE)
        if nb_match:
            result["nb_canards"] = int(nb_match.group(1))

        # Pattern poids (XXX g ou X.X kg)
        poids_pattern = r"(?:poids|pesée)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:g|grammes?|kg|kilos?)"
        poids_match = re.search(poids_pattern, text, re.IGNORECASE)
        if poids_match:
            poids_str = poids_match.group(1).replace(',', '.')
            poids = float(poids_str)
            # Si en kg, convertir en g
            if "kg" in text.lower():
                poids *= 1000
            result["poids_moyen_initial"] = poids

        # Pattern souche
        if "mulard" in text.lower():
            result["souche"] = "Mulard"
        elif "barbarie" in text.lower() or "barbarie" in text.lower():
            result["souche"] = "Barbarie"
        elif "pékin" in text.lower() or "pekin" in text.lower():
            result["souche"] = "Pékin"

        logger.info(f"Fiche lot parsée: {result['code_lot']}, {result['nb_canards']} canards")

        return result


# Instance globale du service OCR
ocr_service = OCRService()
