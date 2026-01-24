"""
API Endpoints pour OCR (Optical Character Recognition)
Extraction de texte depuis images de documents
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional
from app.services.ocr_service import ocr_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ocr", tags=["OCR"])


class OCRImageRequest(BaseModel):
    """Requête OCR avec image en base64"""
    image_base64: str = Field(..., description="Image encodée en base64")
    lang: str = Field("fra", description="Langue du document (fra, eng, etc.)")
    document_type: Optional[str] = Field(None, description="Type de document (bon_livraison, fiche_mortalite, fiche_lot)")


class OCRResponse(BaseModel):
    """Réponse OCR"""
    success: bool
    text: str
    confidence: float
    char_count: int = 0
    line_count: int = 0
    error: Optional[str] = None


class ParsedDocumentResponse(BaseModel):
    """Réponse document parsé"""
    success: bool
    document_type: str
    data: dict
    raw_text: str
    ocr_confidence: float


@router.post("/scan-image", response_model=OCRResponse)
async def scan_image(request: OCRImageRequest):
    """
    Extrait le texte d'une image via OCR

    **Paramètres:**
    - image_base64: Image encodée en base64 (avec ou sans préfixe data:image)
    - lang: Langue du document (fra par défaut)

    **Utilisation:**
    ```python
    # Frontend
    const canvas = document.createElement('canvas');
    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg');

    fetch('/api/ocr/scan-image', {
      method: 'POST',
      body: JSON.stringify({
        image_base64: base64,
        lang: 'fra'
      })
    });
    ```

    **Retourne:**
    - text: Texte extrait
    - confidence: Score de confiance (0-100)
    """
    try:
        result = ocr_service.extract_text_from_base64(
            request.image_base64,
            lang=request.lang
        )

        if not result["success"]:
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "OCR failed")
            )

        logger.info(f"OCR scan réussi: {result['char_count']} caractères, confiance {result['confidence']:.1f}%")

        return result

    except Exception as e:
        logger.error(f"Erreur OCR scan-image: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du scan OCR: {str(e)}"
        )


@router.post("/scan-document", response_model=ParsedDocumentResponse)
async def scan_document(request: OCRImageRequest):
    """
    Scanne un document et extrait les données structurées

    **Types de documents supportés:**
    - bon_livraison: Bon de livraison maïs (date, quantité, fournisseur, prix)
    - fiche_mortalite: Fiche de mortalité (date, lot, nombre morts, causes)
    - fiche_lot: Fiche de lot (code, date début, nb canards, souche, poids)

    **Workflow:**
    1. OCR extrait le texte brut
    2. Parser analyse et structure les données selon le type de document
    3. Retourne JSON prêt à enregistrer en base

    **Exemples:**
    ```javascript
    // Frontend - Scan bon livraison
    const response = await fetch('/api/ocr/scan-document', {
      method: 'POST',
      body: JSON.stringify({
        image_base64: photoBase64,
        lang: 'fra',
        document_type: 'bon_livraison'
      })
    });

    const data = await response.json();
    // {
    //   "date_livraison": "15/01/2024",
    //   "quantite_kg": 5000,
    //   "numero_bon": "BL-12345"
    // }
    ```
    """
    try:
        # Étape 1: OCR extraction texte
        ocr_result = ocr_service.extract_text_from_base64(
            request.image_base64,
            lang=request.lang
        )

        if not ocr_result["success"]:
            raise HTTPException(
                status_code=500,
                detail=ocr_result.get("error", "OCR extraction failed")
            )

        text = ocr_result["text"]
        confidence = ocr_result["confidence"]

        # Étape 2: Parsing selon type de document
        if not request.document_type:
            # Auto-détection du type (simple heuristique)
            if "bon" in text.lower() or "livraison" in text.lower():
                request.document_type = "bon_livraison"
            elif "mortalité" in text.lower() or "décès" in text.lower():
                request.document_type = "fiche_mortalite"
            elif "lot" in text.lower() and "début" in text.lower():
                request.document_type = "fiche_lot"
            else:
                request.document_type = "inconnu"

        # Parser selon type
        if request.document_type == "bon_livraison":
            parsed_data = ocr_service.parse_bon_livraison(text)
        elif request.document_type == "fiche_mortalite":
            parsed_data = ocr_service.parse_fiche_mortalite(text)
        elif request.document_type == "fiche_lot":
            parsed_data = ocr_service.parse_fiche_lot(text)
        else:
            parsed_data = {
                "type_document": "inconnu",
                "raw_text": text
            }

        logger.info(f"Document scanné et parsé: type={request.document_type}, confiance={confidence:.1f}%")

        return {
            "success": True,
            "document_type": request.document_type,
            "data": parsed_data,
            "raw_text": text,
            "ocr_confidence": confidence
        }

    except Exception as e:
        logger.error(f"Erreur OCR scan-document: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du scan de document: {str(e)}"
        )


@router.post("/upload-file", response_model=OCRResponse)
async def upload_file_ocr(
    file: UploadFile = File(...),
    lang: str = "fra"
):
    """
    Upload un fichier image pour OCR

    **Formats supportés:**
    - JPEG, PNG, BMP, TIFF

    **Utilisation:**
    ```javascript
    const formData = new FormData();
    formData.append('file', imageFile);

    fetch('/api/ocr/upload-file?lang=fra', {
      method: 'POST',
      body: formData
    });
    ```
    """
    try:
        # Vérifier type de fichier
        if not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400,
                detail="Le fichier doit être une image (JPEG, PNG, BMP, TIFF)"
            )

        # Lire le fichier
        contents = await file.read()

        # Convertir en base64
        import base64
        image_base64 = base64.b64encode(contents).decode('utf-8')

        # OCR
        result = ocr_service.extract_text_from_base64(image_base64, lang=lang)

        if not result["success"]:
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "OCR failed")
            )

        logger.info(f"Upload OCR réussi: {file.filename}, {result['char_count']} caractères")

        return result

    except Exception as e:
        logger.error(f"Erreur upload-file OCR: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'upload OCR: {str(e)}"
        )


@router.get("/health")
async def ocr_health_check():
    """Health check du service OCR"""
    return {
        "status": "healthy" if ocr_service.tesseract_available else "degraded",
        "service": "ocr",
        "tesseract_available": ocr_service.tesseract_available,
        "supported_documents": [
            "bon_livraison",
            "fiche_mortalite",
            "fiche_lot"
        ],
        "supported_languages": ["fra", "eng"]
    }


@router.get("/document-types")
async def get_document_types():
    """Liste les types de documents supportés avec exemples"""
    return {
        "bon_livraison": {
            "description": "Bon de livraison maïs",
            "fields": [
                "date_livraison",
                "numero_bon",
                "fournisseur",
                "quantite_kg",
                "prix_unitaire",
                "total_ht"
            ],
            "example": "BL-12345, 15/01/2024, 5000 kg maïs, 1250.00€"
        },
        "fiche_mortalite": {
            "description": "Fiche de mortalité canards",
            "fields": [
                "date",
                "lot_code",
                "nombre_morts",
                "causes"
            ],
            "example": "Lot A123, 16/01/2024, 2 canards morts, cause: gavage"
        },
        "fiche_lot": {
            "description": "Fiche de début de lot",
            "fields": [
                "code_lot",
                "date_debut",
                "nb_canards",
                "souche",
                "poids_moyen_initial"
            ],
            "example": "Lot B456, 10/01/2024, 800 canards Mulard, 3500g"
        }
    }
