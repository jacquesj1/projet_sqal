from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime, time
from enum import Enum


class GenetiqueEnum(str, Enum):
    """Types génétiques de canards"""
    MULARD = "mulard"
    BARBARIE = "barbarie"
    PEKIN = "pekin"
    MIXTE = "mixte"


class AlerteNiveauEnum(str, Enum):
    """Niveaux d'alerte"""
    CRITIQUE = "critique"
    IMPORTANT = "important"
    INFO = "info"


class GaveurBase(BaseModel):
    nom: str = Field(..., min_length=2, max_length=100)
    prenom: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    telephone: str = Field(..., pattern=r'^\+?[0-9]{10,15}$')
    adresse: Optional[str] = None
    certifications: Optional[List[str]] = []


class GaveurCreate(GaveurBase):
    password: str = Field(..., min_length=8)


class Gaveur(GaveurBase):
    id: int
    created_at: datetime
    actif: bool = True

    class Config:
        from_attributes = True


class AbattoirBase(BaseModel):
    nom: str
    adresse: str
    ville: str
    code_postal: str
    numero_agrement: str
    contact_telephone: str


class AbattoirCreate(AbattoirBase):
    pass


class Abattoir(AbattoirBase):
    id: int

    class Config:
        from_attributes = True


class LotMaisBase(BaseModel):
    numero_lot: str
    origine: str
    date_reception: datetime
    taux_humidite: float = Field(..., ge=0, le=100)
    qualite_note: Optional[float] = Field(None, ge=0, le=10)


class LotMais(LotMaisBase):
    id: int

    class Config:
        from_attributes = True


class CanardBase(BaseModel):
    numero_identification: str = Field(..., description="Numéro de bague unique")
    genetique: GenetiqueEnum
    date_naissance: datetime
    origine_elevage: str
    numero_lot_canard: str
    poids_initial: float = Field(..., ge=0)


class CanardCreate(CanardBase):
    gaveur_id: int


class Canard(CanardBase):
    id: int
    gaveur_id: int
    created_at: datetime
    statut: str = "en_gavage"  # en_gavage, termine, decede

    class Config:
        from_attributes = True


class GavageDataBase(BaseModel):
    canard_id: int
    dose_matin: float = Field(..., ge=0, description="Dose de maïs matin (grammes)")
    dose_soir: float = Field(..., ge=0, description="Dose de maïs soir (grammes)")
    dose_theorique_matin: Optional[float] = Field(None, description="Dose théorique calculée par IA")
    dose_theorique_soir: Optional[float] = Field(None, description="Dose théorique calculée par IA")
    heure_gavage_matin: time
    heure_gavage_soir: time
    poids_matin: Optional[float] = Field(None, ge=0)
    poids_soir: Optional[float] = Field(None, ge=0)
    temperature_stabule: float = Field(..., ge=-20, le=50)
    humidite_stabule: Optional[float] = Field(None, ge=0, le=100)
    qualite_air_co2: Optional[float] = Field(None, ge=0)
    lot_mais_id: int
    remarques: Optional[str] = None
    comportement_observe: Optional[str] = None
    etat_sanitaire: Optional[str] = None


class GavageDataCreate(GavageDataBase):
    pass


class GavageData(GavageDataBase):
    id: int
    time: datetime
    correction_proposee: Optional[str] = None
    ecart_dose_matin: Optional[float] = None
    ecart_dose_soir: Optional[float] = None
    alerte_generee: bool = False

    class Config:
        from_attributes = True


class PredictionCourbe(BaseModel):
    """Prédiction de courbe de croissance par l'IA"""
    canard_id: int
    jours_gavage: List[int]
    poids_predits: List[float]
    doses_recommandees_matin: List[float]
    doses_recommandees_soir: List[float]
    confiance: float = Field(..., ge=0, le=1)
    formule_symbolique: Optional[str] = None
    date_prediction: datetime


class CorrectionDose(BaseModel):
    """Correction proposée quand dose réelle diffère de théorique"""
    canard_id: int
    date: datetime
    dose_theorique: float
    dose_reelle: float
    ecart_absolu: float
    ecart_pourcentage: float
    correction_proposee: str
    raison: str
    impact_prevu: str


class AlerteBase(BaseModel):
    canard_id: int
    niveau: AlerteNiveauEnum
    type_alerte: str
    message: str
    valeur_mesuree: Optional[float] = None
    valeur_seuil: Optional[float] = None


class AlerteCreate(AlerteBase):
    envoyer_sms: bool = True


class Alerte(AlerteBase):
    id: int
    time: datetime
    sms_envoye: bool = False
    acquittee: bool = False
    acquittee_par: Optional[int] = None
    acquittee_le: Optional[datetime] = None

    class Config:
        from_attributes = True


class BlockchainRecord(BaseModel):
    """Enregistrement blockchain pour traçabilité"""
    index: int
    timestamp: datetime
    type_evenement: str  # gavage, pesee, abattage, transport
    canard_id: int
    gaveur_id: int
    abattoir_id: Optional[int] = None
    donnees: dict  # Données chiffrées de l'événement
    hash_precedent: str
    hash_actuel: str
    signature_numerique: str


class BlockchainInit(BaseModel):
    """Initialisation de la blockchain"""
    gaveur_id: int
    canard_ids: List[int]
    description: str


class StatistiquesGaveur(BaseModel):
    """Statistiques pour un gaveur"""
    gaveur_id: int
    periode_debut: datetime
    periode_fin: datetime
    nombre_canards_total: int
    nombre_canards_termines: int
    poids_moyen_final: float
    taux_mortalite: float
    indice_consommation: float
    performance_score: float
    
    
class WebSocketMessage(BaseModel):
    """Message WebSocket pour temps réel"""
    type: str  # gavage_update, alerte, prediction
    data: dict
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SMSNotification(BaseModel):
    """Notification SMS"""
    destinataire: str
    message: str
    type_alerte: str
    priorite: AlerteNiveauEnum
