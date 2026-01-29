"""
Modèles Pydantic pour le système SQAL (Quality Control)
Validation des données VL53L8CH (ToF) + AS7341 (Spectral) + Fusion
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================

class QualityGrade(str, Enum):
    """Grades de qualité SQAL"""
    A_PLUS = "A+"
    A = "A"
    B = "B"
    C = "C"
    REJECT = "REJECT"


class DeviceStatus(str, Enum):
    """Statuts des dispositifs ESP32"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"
    ERROR = "error"


class AlertSeverity(str, Enum):
    """Niveaux de sévérité des alertes"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


# ============================================================================
# VL53L8CH (Time-of-Flight Sensor)
# ============================================================================

class VL53L8CHRawData(BaseModel):
    """Données brutes du capteur VL53L8CH (matrices 8x8)"""
    model_config = {"extra": "ignore"}

    distance_matrix: List[List[int]] = Field(
        ...,
        description="Matrice 8x8 distances en mm (0-4000mm)",
        min_items=8,
        max_items=8
    )
    reflectance_matrix: List[List[int]] = Field(
        ...,
        description="Matrice 8x8 réflectance (0-255)",
        min_items=8,
        max_items=8
    )
    amplitude_matrix: List[List[int]] = Field(
        ...,
        description="Matrice 8x8 amplitude signal retour (0-4095)",
        min_items=8,
        max_items=8
    )

    status_matrix: List[List[int]] = Field(
        default_factory=list,
        description="Matrice 8x8 status/validité (0-255)",
        min_items=0,
        max_items=8
    )

    ambient_matrix: List[List[int]] = Field(
        default_factory=list,
        description="Matrice 8x8 lumière ambiante (0-4095)",
        min_items=0,
        max_items=8
    )

    @validator('distance_matrix', 'reflectance_matrix', 'amplitude_matrix', 'status_matrix', 'ambient_matrix')
    def validate_8x8_matrix(cls, v):
        """Valide que chaque ligne a exactement 8 éléments"""
        if v is None or v == []:
            return v
        if not all(len(row) == 8 for row in v):
            raise ValueError("Chaque ligne de la matrice doit avoir 8 éléments")
        return v

    @validator('distance_matrix')
    def validate_distance_range(cls, v):
        """Valide les valeurs de distance (0-4000mm)"""
        for row in v:
            for val in row:
                if not (0 <= val <= 4000):
                    raise ValueError(f"Distance invalide: {val}mm (range: 0-4000)")
        return v

    @validator('reflectance_matrix')
    def validate_reflectance_range(cls, v):
        """Valide les valeurs de réflectance (0-255)"""
        for row in v:
            for val in row:
                if not (0 <= val <= 255):
                    raise ValueError(f"Réflectance invalide: {val} (range: 0-255)")
        return v

    @validator('amplitude_matrix')
    def validate_amplitude_range(cls, v):
        """Valide les valeurs d'amplitude (0-4095)"""
        for row in v:
            for val in row:
                if not (0 <= val <= 4095):
                    raise ValueError(f"Amplitude invalide: {val} (range: 0-4095)")
        return v

    @validator('status_matrix')
    def validate_status_range(cls, v):
        """Valide les valeurs de status (0-255)"""
        if v is None or v == []:
            return v
        for row in v:
            for val in row:
                if not (0 <= val <= 255):
                    raise ValueError(f"Status invalide: {val} (range: 0-255)")
        return v

    @validator('ambient_matrix')
    def validate_ambient_range(cls, v):
        """Valide les valeurs ambient (0-4095)"""
        if v is None or v == []:
            return v
        for row in v:
            for val in row:
                if not (0 <= val <= 4095):
                    raise ValueError(f"Ambient invalide: {val} (range: 0-4095)")
        return v


class VL53L8CHAnalysis(BaseModel):
    """Résultats d'analyse VL53L8CH"""
    model_config = {"extra": "ignore"}

    volume_mm3: float = Field(..., description="Volume calculé en mm³", ge=0)
    surface_uniformity: float = Field(
        ...,
        description="Uniformité de surface (0-1)",
        ge=0.0,
        le=1.0
    )
    quality_score: float = Field(
        ...,
        description="Score qualité ToF (0-1)",
        ge=0.0,
        le=1.0
    )
    grade: QualityGrade = Field(..., description="Grade qualité ToF")

    # Métriques supplémentaires
    avg_distance_mm: Optional[float] = Field(None, description="Distance moyenne en mm")
    std_distance_mm: Optional[float] = Field(None, description="Écart-type distance")
    avg_reflectance: Optional[float] = Field(None, description="Réflectance moyenne")


class VL53L8CHData(BaseModel):
    """Données complètes VL53L8CH (Raw + Analysis)"""
    model_config = {"extra": "ignore"}

    raw: VL53L8CHRawData
    analysis: VL53L8CHAnalysis


# ============================================================================
# AS7341 (Spectral Sensor)
# ============================================================================

class AS7341RawData(BaseModel):
    """Données brutes AS7341 (10 canaux spectraux)"""
    model_config = {"extra": "ignore"}

    F1_415nm: int = Field(..., description="Canal 415nm (Violet)", ge=0)
    F2_445nm: int = Field(..., description="Canal 445nm (Indigo)", ge=0)
    F3_480nm: int = Field(..., description="Canal 480nm (Bleu)", ge=0)
    F4_515nm: int = Field(..., description="Canal 515nm (Cyan)", ge=0)
    F5_555nm: int = Field(..., description="Canal 555nm (Vert)", ge=0)
    F6_590nm: int = Field(..., description="Canal 590nm (Jaune)", ge=0)
    F7_630nm: int = Field(..., description="Canal 630nm (Orange)", ge=0)
    F8_680nm: int = Field(..., description="Canal 680nm (Rouge)", ge=0)
    Clear: int = Field(..., description="Canal Clear (visible total)", ge=0)
    NIR: int = Field(..., description="Canal NIR (proche infrarouge)", ge=0)

    def to_dict(self) -> Dict[str, int]:
        """Convertit en dictionnaire pour stockage JSONB"""
        return {
            "F1_415nm": self.F1_415nm,
            "F2_445nm": self.F2_445nm,
            "F3_480nm": self.F3_480nm,
            "F4_515nm": self.F4_515nm,
            "F5_555nm": self.F5_555nm,
            "F6_590nm": self.F6_590nm,
            "F7_630nm": self.F7_630nm,
            "F8_680nm": self.F8_680nm,
            "Clear": self.Clear,
            "NIR": self.NIR
        }


class AS7341Analysis(BaseModel):
    """Résultats d'analyse AS7341"""
    model_config = {"extra": "ignore"}

    freshness_index: float = Field(
        ...,
        description="Indice fraîcheur (0-1)",
        ge=0.0,
        le=1.0
    )
    fat_quality_index: float = Field(
        ...,
        description="Indice qualité lipides (0-1)",
        ge=0.0,
        le=1.0
    )
    oxidation_index: float = Field(
        ...,
        description="Indice oxydation (0-1, 0=pas oxydé)",
        ge=0.0,
        le=1.0
    )
    quality_score: float = Field(
        ...,
        description="Score qualité spectral (0-1)",
        ge=0.0,
        le=1.0
    )

    # Ratios spectraux calculés
    ratio_red_nir: Optional[float] = Field(None, description="Ratio Rouge/NIR")
    ratio_clear_nir: Optional[float] = Field(None, description="Ratio Clear/NIR")


class AS7341Data(BaseModel):
    """Données complètes AS7341 (Raw + Analysis)"""
    model_config = {"extra": "ignore"}

    raw: AS7341RawData
    analysis: AS7341Analysis


# ============================================================================
# FUSION (VL53L8CH + AS7341)
# ============================================================================

class FusionResult(BaseModel):
    """Résultat de fusion ToF + Spectral"""
    model_config = {"extra": "ignore"}

    final_score: float = Field(
        ...,
        description="Score final fusionné (60% ToF + 40% Spectral)",
        ge=0.0,
        le=1.0
    )
    final_grade: QualityGrade = Field(..., description="Grade final A+/A/B/C/REJECT")
    is_compliant: bool = Field(..., description="Conforme aux normes qualité")

    # Pondération utilisée
    weight_tof: float = Field(default=0.60, description="Poids ToF (défaut 60%)")
    weight_spectral: float = Field(default=0.40, description="Poids Spectral (défaut 40%)")

    # Métriques de confiance
    confidence_level: Optional[float] = Field(
        None,
        description="Niveau de confiance (0-1)",
        ge=0.0,
        le=1.0
    )

    @validator('weight_tof', 'weight_spectral')
    def validate_weights(cls, v, values):
        """Valide que les poids somment à 1.0"""
        if 'weight_tof' in values and abs(values['weight_tof'] + v - 1.0) > 0.01:
            raise ValueError("La somme des poids ToF + Spectral doit être 1.0")
        return v


# ============================================================================
# SENSOR DATA MESSAGE (WebSocket)
# ============================================================================

class SensorDataMessage(BaseModel):
    """Message complet envoyé par le simulateur via WebSocket"""
    model_config = {"extra": "ignore"}  # Ignore extra fields from simulator

    sample_id: str = Field(..., description="ID unique échantillon (UUID)")
    device_id: str = Field(..., description="ID dispositif ESP32")
    timestamp: datetime = Field(..., description="Timestamp échantillon")

    # Données capteurs
    vl53l8ch: VL53L8CHData
    as7341: AS7341Data
    fusion: FusionResult

    # Contexte optionnel
    lot_id: Optional[int] = Field(None, description="ID lot gavage (si associé)")
    site_code: Optional[str] = Field(None, description="Code site (LL/LS/MT)")
    location: Optional[str] = Field(None, description="Emplacement physique (ex: Ligne A)")

    # Traçabilité blockchain
    lot_abattage: Optional[str] = Field(None, description="Numéro lot abattage")
    eleveur: Optional[str] = Field(None, description="Nom éleveur")
    provenance: Optional[str] = Field(None, description="Provenance géographique")

    # Métadonnées
    meta: Optional[Dict[str, Any]] = Field(None, description="Métadonnées additionnelles")
    firmware_version: Optional[str] = Field(None, description="Version firmware ESP32")
    temperature_c: Optional[float] = Field(None, description="Température ambiante °C")
    humidity_pct: Optional[float] = Field(None, description="Humidité relative %")


# ============================================================================
# DATABASE MODELS (Lecture depuis TimescaleDB)
# ============================================================================

class SensorSampleDB(BaseModel):
    """Échantillon capteur (lecture depuis sensor_samples)"""
    time: datetime
    sample_id: str
    device_id: str
    lot_id: Optional[int]

    # VL53L8CH
    vl53l8ch_distance_matrix: Dict[str, Any]  # JSONB
    vl53l8ch_reflectance_matrix: Dict[str, Any]
    vl53l8ch_amplitude_matrix: Dict[str, Any]
    vl53l8ch_volume_mm3: float
    vl53l8ch_surface_uniformity: float
    vl53l8ch_quality_score: float
    vl53l8ch_grade: str

    # AS7341
    as7341_channels: Dict[str, int]  # JSONB
    as7341_freshness_index: float
    as7341_fat_quality_index: float
    as7341_oxidation_index: float
    as7341_quality_score: float

    # Fusion
    fusion_final_score: float
    fusion_final_grade: str
    fusion_is_compliant: bool

    class Config:
        from_attributes = True


class DeviceDB(BaseModel):
    """Dispositif ESP32 (lecture depuis sqal_devices)"""
    device_id: str
    device_name: str
    firmware_version: Optional[str]
    site_code: Optional[str]
    status: str
    config_profile: Optional[str]
    created_at: datetime
    last_seen: Optional[datetime]

    class Config:
        from_attributes = True


class HourlyStatsDB(BaseModel):
    """Statistiques horaires (agrégation depuis sensor_samples)"""
    bucket: datetime
    device_id: str
    sample_count: int
    avg_quality_score: float
    count_a_plus: int
    count_a: int
    count_b: int
    count_c: int
    count_reject: int
    avg_volume_mm3: float
    avg_freshness_index: float
    compliance_rate_pct: float

    class Config:
        from_attributes = True


class SiteStatsDB(BaseModel):
    """Statistiques par site (agrégation depuis sensor_samples + sqal_devices)"""
    bucket: datetime
    site_code: str
    total_samples: int
    avg_quality_score: float
    compliance_rate_pct: float
    count_a_plus: int
    count_a: int
    count_b: int
    count_c: int
    count_reject: int

    class Config:
        from_attributes = True


# ============================================================================
# ALERTS
# ============================================================================

class AlertCreate(BaseModel):
    """Création d'alerte SQAL"""
    device_id: str
    sample_id: str
    alert_type: str = Field(..., description="Type: quality_low, sensor_error, etc.")
    severity: AlertSeverity
    message: str = Field(..., min_length=1, max_length=500)
    data_context: Optional[Dict[str, Any]] = Field(None, description="Données contextuelles")


class AlertDB(BaseModel):
    """Alerte SQAL (lecture depuis sqal_alerts)"""
    time: datetime
    alert_id: int
    device_id: str
    sample_id: str
    alert_type: str
    severity: str
    message: str
    data_context: Optional[Dict[str, Any]]
    is_acknowledged: bool
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[str]

    class Config:
        from_attributes = True


# ============================================================================
# ML MODELS
# ============================================================================

class MLModelDB(BaseModel):
    """Modèle ML SQAL (lecture depuis sqal_ml_models)"""
    model_config = {"protected_namespaces": (), "from_attributes": True}

    model_id: int
    model_name: str
    model_type: str
    version: str
    framework: str
    file_path: Optional[str]
    accuracy: Optional[float]
    precision: Optional[float]
    recall: Optional[float]
    f1_score: Optional[float]
    training_date: Optional[datetime]
    is_active: bool
    hyperparameters: Optional[Dict[str, Any]]
    feature_importance: Optional[Dict[str, Any]]


# ============================================================================
# BLOCKCHAIN
# ============================================================================

class BlockchainTxnDB(BaseModel):
    """Transaction blockchain SQAL (lecture depuis sqal_blockchain_txns)"""
    txn_id: int
    sample_id: str
    block_hash: str
    txn_hash: str
    timestamp: datetime
    contract_address: Optional[str]
    gas_used: Optional[int]
    data_ipfs_hash: Optional[str]

    class Config:
        from_attributes = True


# ============================================================================
# API RESPONSES
# ============================================================================

class SensorDataResponse(BaseModel):
    """Réponse API après réception de données capteur"""
    success: bool
    sample_id: str
    timestamp: datetime
    fusion_score: float
    fusion_grade: str
    message: str


class DeviceListResponse(BaseModel):
    """Liste de dispositifs"""
    devices: List[DeviceDB]
    total: int


class StatsResponse(BaseModel):
    """Statistiques globales SQAL"""
    period_start: datetime
    period_end: datetime
    total_samples: int
    avg_quality_score: float
    compliance_rate_pct: float
    grade_distribution: Dict[str, int]
    top_devices: List[Dict[str, Any]]


class HealthCheckResponse(BaseModel):
    """Health check SQAL"""
    status: str
    timestamp: datetime
    active_devices: int
    last_sample_age_seconds: Optional[float]
    database_connected: bool
