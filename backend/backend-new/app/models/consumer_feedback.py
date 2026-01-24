"""
Modèles Pydantic pour le système de feedback consommateur
QR Code → Traçabilité + Collecte retours qualité
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================

class FeedbackRating(int, Enum):
    """Notation 1-5 étoiles"""
    TERRIBLE = 1
    POOR = 2
    AVERAGE = 3
    GOOD = 4
    EXCELLENT = 5


class ConsumptionContext(str, Enum):
    """Contexte de consommation"""
    HOME = "home"
    RESTAURANT = "restaurant"
    SPECIAL_EVENT = "special_event"
    GIFT = "gift"


class QualityAspect(str, Enum):
    """Aspects qualité évalués"""
    TEXTURE = "texture"
    FLAVOR = "flavor"
    COLOR = "color"
    AROMA = "aroma"
    FRESHNESS = "freshness"
    OVERALL = "overall"


# ============================================================================
# QR CODE & TRACEABILITY
# ============================================================================

class QRCodeData(BaseModel):
    """
    Données encodées dans le QR code (après contrôle qualité SQAL)
    Format: SQAL_{lot_id}_{sample_id}_{signature}
    """
    lot_id: int = Field(..., description="ID du lot de gavage")
    sample_id: str = Field(..., description="ID échantillon SQAL")
    product_id: str = Field(..., description="ID produit final (unique)")
    timestamp: datetime = Field(..., description="Date contrôle qualité")
    signature: str = Field(..., description="Signature cryptographique")

    def to_qr_string(self) -> str:
        """Génère la chaîne encodée dans le QR code"""
        return f"SQAL_{self.lot_id}_{self.sample_id}_{self.product_id}_{self.signature[:16]}"

    @classmethod
    def from_qr_string(cls, qr_string: str):
        """Parse une chaîne QR code"""
        parts = qr_string.split("_")
        if len(parts) < 5 or parts[0] != "SQAL":
            raise ValueError("QR code invalide")

        return {
            "lot_id": int(parts[1]),
            "sample_id": parts[2],
            "product_id": parts[3],
            "signature": parts[4]
        }


class ProductTraceability(BaseModel):
    """
    Données de traçabilité complètes accessibles via QR code
    (publiques pour le consommateur)
    """
    # Identifiants
    product_id: str
    lot_code: str
    qr_code: str

    # Origine production
    site_code: str = Field(..., description="Site production (LL/LS/MT)")
    site_name: str = Field(..., description="Nom complet du site")
    region: str = Field(..., description="Région d'origine")

    # Dates
    production_date: datetime = Field(..., description="Date de production")
    quality_control_date: datetime = Field(..., description="Date contrôle qualité SQAL")
    packaging_date: Optional[datetime] = Field(None, description="Date d'emballage")
    best_before_date: Optional[datetime] = Field(None, description="Date limite consommation")

    # Qualité SQAL
    sqal_quality_score: float = Field(..., description="Score qualité SQAL (0-1)", ge=0, le=1)
    sqal_grade: str = Field(..., description="Grade qualité (A+/A/B/C)")
    sqal_compliance: bool = Field(..., description="Conforme aux normes")

    # Détails production (anonymisés)
    gavage_duration_days: int = Field(..., description="Durée gavage (jours)")
    average_itm: Optional[float] = Field(None, description="ITM moyen du lot")

    # Certifications
    certifications: List[str] = Field(default_factory=list, description="Labels (IGP, Bio, etc.)")
    production_method: str = Field(default="traditionnel", description="Méthode de production")

    # Empreinte carbone
    carbon_footprint_kg: Optional[float] = Field(None, description="Empreinte carbone (kg CO2)")
    animal_welfare_score: Optional[float] = Field(None, description="Score bien-être animal (0-1)")

    # Blockchain
    blockchain_hash: str = Field(..., description="Hash transaction blockchain")
    blockchain_verified: bool = Field(default=True, description="Vérifié sur blockchain")


# ============================================================================
# CONSUMER FEEDBACK
# ============================================================================

class DetailedRatings(BaseModel):
    """Notations détaillées par aspect"""
    texture: Optional[FeedbackRating] = Field(None, description="Texture (1-5)")
    flavor: Optional[FeedbackRating] = Field(None, description="Saveur (1-5)")
    color: Optional[FeedbackRating] = Field(None, description="Couleur (1-5)")
    aroma: Optional[FeedbackRating] = Field(None, description="Arôme (1-5)")
    freshness: Optional[FeedbackRating] = Field(None, description="Fraîcheur (1-5)")


class ConsumerFeedbackCreate(BaseModel):
    """
    Feedback créé par le consommateur après scan QR code
    """
    # Référence produit
    qr_code: str = Field(..., description="Code QR scanné")
    product_id: str = Field(..., description="ID produit")

    # Notation globale (obligatoire)
    overall_rating: FeedbackRating = Field(..., description="Note globale (1-5)")

    # Notations détaillées (optionnelles)
    detailed_ratings: Optional[DetailedRatings] = Field(None)

    # Commentaire texte
    comment: Optional[str] = Field(
        None,
        description="Commentaire libre",
        max_length=1000
    )

    # Contexte consommation
    consumption_context: Optional[ConsumptionContext] = Field(None)
    consumption_date: Optional[datetime] = Field(None, description="Date de consommation")

    # Informations consommateur (optionnelles, anonymisées)
    consumer_age_range: Optional[str] = Field(None, description="Tranche d'âge (18-25, 26-35...)")
    consumer_region: Optional[str] = Field(None, description="Région consommateur")

    # Recommandation
    would_recommend: Optional[bool] = Field(None, description="Recommanderait le produit")
    repurchase_intent: Optional[int] = Field(
        None,
        description="Intention de réachat (1-5)",
        ge=1,
        le=5
    )

    # Photos (optionnel)
    photo_urls: Optional[List[str]] = Field(default_factory=list, description="URLs photos produit")

    # Métadonnées
    device_type: Optional[str] = Field(None, description="Type appareil (iOS/Android/Web)")
    app_version: Optional[str] = Field(None, description="Version application")


class ConsumerFeedbackDB(BaseModel):
    """
    Feedback stocké en base de données
    """
    feedback_id: int
    product_id: str
    qr_code: str
    lot_id: int
    sample_id: str

    # Notations
    overall_rating: int
    texture_rating: Optional[int]
    flavor_rating: Optional[int]
    color_rating: Optional[int]
    aroma_rating: Optional[int]
    freshness_rating: Optional[int]

    # Commentaire et contexte
    comment: Optional[str]
    consumption_context: Optional[str]
    consumption_date: Optional[datetime]

    # Consommateur (anonymisé)
    consumer_age_range: Optional[str]
    consumer_region: Optional[str]

    # Recommandation
    would_recommend: Optional[bool]
    repurchase_intent: Optional[int]

    # Métadonnées
    created_at: datetime
    device_type: Optional[str]
    ip_hash: Optional[str]  # Hashé pour éviter doublons sans stocker IP

    # Flags
    is_verified: bool = Field(default=False, description="Feedback vérifié (achat confirmé)")
    is_moderated: bool = Field(default=False, description="Modéré par équipe")
    is_public: bool = Field(default=True, description="Visible publiquement")

    class Config:
        from_attributes = True


# ============================================================================
# ANALYTICS & AI INTEGRATION
# ============================================================================

class FeedbackAnalytics(BaseModel):
    """
    Analyse agrégée des feedbacks pour un lot/site/période
    """
    total_feedbacks: int
    average_overall_rating: float

    # Répartition notes
    rating_distribution: Dict[int, int] = Field(
        default_factory=dict,
        description="Distribution {note: count}"
    )

    # Moyennes aspects
    avg_texture: Optional[float] = None
    avg_flavor: Optional[float] = None
    avg_color: Optional[float] = None
    avg_aroma: Optional[float] = None
    avg_freshness: Optional[float] = None

    # Recommandation
    recommendation_rate: float = Field(
        ...,
        description="% consommateurs recommandant (0-100)"
    )
    avg_repurchase_intent: Optional[float] = None

    # Tendance
    trend_7d: Optional[float] = Field(
        None,
        description="Évolution moyenne 7 derniers jours"
    )
    trend_30d: Optional[float] = Field(
        None,
        description="Évolution moyenne 30 derniers jours"
    )


class FeedbackMLInput(BaseModel):
    """
    Données préparées pour entraînement IA
    (Corrélation feedback consommateur ↔ métriques production)
    """
    # Identifiants
    lot_id: int
    sample_id: str
    feedback_id: int

    # Métriques production (Euralis)
    lot_itm: float
    lot_avg_weight: float
    lot_mortality_rate: float
    lot_feed_conversion: float

    # Qualité SQAL
    sqal_score: float
    sqal_grade: str
    vl53l8ch_volume: float
    vl53l8ch_uniformity: float
    as7341_freshness: float
    as7341_fat_quality: float
    as7341_oxidation: float

    # Feedback consommateur
    consumer_overall_rating: int
    consumer_texture_rating: Optional[int]
    consumer_flavor_rating: Optional[int]
    consumer_freshness_rating: Optional[int]
    consumer_would_recommend: bool

    # Contexte
    site_code: str
    production_date: datetime
    consumption_delay_days: int = Field(
        ...,
        description="Délai production → consommation (jours)"
    )


class FeedbackInsights(BaseModel):
    """
    Insights IA générés depuis feedbacks consommateurs
    """
    # Corrélations découvertes
    correlations: Dict[str, float] = Field(
        default_factory=dict,
        description="Corrélations entre métriques (ex: itm_vs_flavor: 0.85)"
    )

    # Prédictions
    predicted_consumer_score: float = Field(
        ...,
        description="Score consommateur prédit (1-5) selon métriques prod"
    )
    confidence_interval: tuple[float, float] = Field(
        ...,
        description="Intervalle confiance (min, max)"
    )

    # Recommandations production
    production_recommendations: List[str] = Field(
        default_factory=list,
        description="Recommandations amélioration production"
    )

    # Facteurs clés
    top_quality_drivers: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Top facteurs impactant satisfaction (feature importance)"
    )


# ============================================================================
# API RESPONSES
# ============================================================================

class QRScanResponse(BaseModel):
    """
    Réponse lors du scan QR code par consommateur
    """
    success: bool
    traceability: ProductTraceability
    already_reviewed: bool = Field(
        default=False,
        description="Consommateur a déjà laissé un feedback"
    )
    average_rating: Optional[float] = Field(
        None,
        description="Note moyenne produit (si >5 feedbacks)"
    )
    total_reviews: int = Field(default=0, description="Nombre total d'avis")


class FeedbackSubmitResponse(BaseModel):
    """
    Réponse après soumission feedback
    """
    success: bool
    feedback_id: int
    message: str = Field(
        default="Merci pour votre retour ! Il nous aidera à améliorer nos produits."
    )
    reward_points: Optional[int] = Field(
        None,
        description="Points fidélité gagnés (optionnel)"
    )


class FeedbackStatsResponse(BaseModel):
    """
    Statistiques feedbacks pour producteur
    """
    period: str = Field(..., description="Période (7d, 30d, all)")
    analytics: FeedbackAnalytics
    recent_comments: List[str] = Field(
        default_factory=list,
        description="5 derniers commentaires"
    )
    insights: Optional[FeedbackInsights] = None
