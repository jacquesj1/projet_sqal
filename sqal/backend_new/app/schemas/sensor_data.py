"""
Pydantic Schemas for Sensor Data Validation
Validates all incoming data from the simulator
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime


# ============================================================================
# VL53L8CH (Time-of-Flight) Schemas
# ============================================================================

class VL53L8CHRawData(BaseModel):
    """Raw data from VL53L8CH sensor - 8x8 matrices"""
    distance_matrix: List[List[float]] = Field(..., description="8x8 distance matrix in mm")
    reflectance_matrix: List[List[float]] = Field(..., description="8x8 reflectance matrix (0-255)")
    amplitude_matrix: List[List[float]] = Field(..., description="8x8 amplitude matrix")

    @field_validator('distance_matrix', 'reflectance_matrix', 'amplitude_matrix')
    @classmethod
    def validate_8x8_matrix(cls, v, info):
        if len(v) != 8:
            raise ValueError(f'{info.field_name} must have exactly 8 rows, got {len(v)}')
        for i, row in enumerate(v):
            if len(row) != 8:
                raise ValueError(f'{info.field_name} row {i} must have exactly 8 columns, got {len(row)}')
        return v

    @field_validator('reflectance_matrix')
    @classmethod
    def validate_reflectance_range(cls, v):
        """Reflectance values should be 0-255"""
        for row in v:
            for val in row:
                if not 0 <= val <= 255:
                    raise ValueError(f'Reflectance values must be 0-255, got {val}')
        return v


class VL53L8CHBinsAnalysis(BaseModel):
    """Histogram and bins analysis

    Can be either:
    - Full object with all fields (advanced analysis)
    - Simple histogram array (basic mode)
    """
    histogram: Optional[List[float]] = None
    bin_count: Optional[int] = Field(None, ge=0, le=1000)
    multi_peak_detected: Optional[bool] = None
    roughness_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    signal_quality: Optional[float] = Field(None, ge=0.0, le=1.0)
    texture_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    density_score: Optional[float] = Field(None, ge=0.0, le=1.0)


class VL53L8CHReflectanceAnalysis(BaseModel):
    """Reflectance analysis"""
    avg_reflectance: float = Field(..., ge=0)
    reflectance_uniformity: float = Field(..., ge=0.0, le=1.0)
    optical_anomalies: List[str] = Field(default_factory=list)


class VL53L8CHAmplitudeConsistency(BaseModel):
    """Amplitude consistency analysis"""
    avg_amplitude: float = Field(..., ge=0)
    amplitude_std: float = Field(..., ge=0)
    amplitude_variance: float = Field(..., ge=0)
    signal_stability: float = Field(..., ge=0.0, le=1.0)
    z_scores: Optional[List[float]] = None


class VL53L8CHScoreBreakdown(BaseModel):
    """Score breakdown components"""
    volume_score: float = Field(..., ge=0.0, le=1.0)
    uniformity_score: float = Field(..., ge=0.0, le=1.0)
    reflectance_score: float = Field(..., ge=0.0, le=1.0)
    amplitude_score: float = Field(..., ge=0.0, le=1.0)
    defect_penalty: float = Field(..., ge=0.0, le=1.0)


class VL53L8CHAnalysis(VL53L8CHRawData):
    """Complete VL53L8CH analysis with validation"""
    # Basic statistics
    volume_mm3: float = Field(..., ge=0, description="Volume in mm³")
    base_area_mm2: float = Field(..., ge=0, description="Base area in mm²")
    average_height_mm: float = Field(..., ge=0, description="Average height in mm")
    max_height_mm: float = Field(..., ge=0, description="Max height in mm")
    min_height_mm: float = Field(..., ge=0, description="Min height in mm")
    height_range_mm: float = Field(..., ge=0, description="Height range in mm")
    surface_uniformity: float = Field(..., ge=0.0, le=1.0, description="Surface uniformity score")

    # Detailed analysis
    # Accept both structured object and raw dict from simulator
    bins_analysis: Optional[Union[VL53L8CHBinsAnalysis, Dict[str, Any]]] = None
    reflectance_analysis: Optional[Union[VL53L8CHReflectanceAnalysis, Dict[str, Any]]] = None
    amplitude_consistency: Optional[Union[VL53L8CHAmplitudeConsistency, Dict[str, Any]]] = None

    # Quality assessment
    defects: List[str] = Field(default_factory=list)
    quality_score: float = Field(..., ge=0.0, le=1.0, description="Overall quality score")
    score_breakdown: Optional[VL53L8CHScoreBreakdown] = None
    grade: str = Field(..., pattern=r'^(A\+|A|B|C|REJECT|UNKNOWN)$', description="Quality grade")

    @model_validator(mode='after')
    def validate_height_fields(self):
        if self.max_height_mm < self.min_height_mm:
            raise ValueError(f'max_height_mm ({self.max_height_mm}) must be >= min_height_mm ({self.min_height_mm})')

        expected_range = self.max_height_mm - self.min_height_mm
        if abs(self.height_range_mm - expected_range) > 0.01:  # Allow small floating point errors
            raise ValueError(f'height_range_mm ({self.height_range_mm}) should equal max - min ({expected_range})')

        return self


# ============================================================================
# AS7341 (Spectral) Schemas
# ============================================================================

class AS7341Channels(BaseModel):
    """10-channel spectral data"""
    F1_415nm: int = Field(..., ge=0, le=65535, description="Violet channel (415nm)")
    F2_445nm: int = Field(..., ge=0, le=65535, description="Indigo channel (445nm)")
    F3_480nm: int = Field(..., ge=0, le=65535, description="Blue channel (480nm)")
    F4_515nm: int = Field(..., ge=0, le=65535, description="Cyan channel (515nm)")
    F5_555nm: int = Field(..., ge=0, le=65535, description="Green channel (555nm)")
    F6_590nm: int = Field(..., ge=0, le=65535, description="Yellow channel (590nm)")
    F7_630nm: int = Field(..., ge=0, le=65535, description="Orange channel (630nm)")
    F8_680nm: int = Field(..., ge=0, le=65535, description="Red channel (680nm)")
    Clear: int = Field(..., ge=0, le=65535, description="Clear channel")
    NIR: int = Field(..., ge=0, le=65535, description="Near-infrared channel")


class AS7341SpectralRatios(BaseModel):
    """Spectral ratios for quality assessment"""
    violet_orange_ratio: float = Field(..., ge=0, description="F1/F7 - Oxidation indicator")
    blue_red_ratio: float = Field(..., ge=0, description="F3/F8 - Freshness indicator")
    green_red_ratio: float = Field(..., ge=0, description="F5/F8 - Color indicator")
    nir_clear_ratio: float = Field(..., ge=0, description="NIR/Clear - Density indicator")
    yellow_red_ratio: float = Field(..., ge=0, description="F6/F8")
    cyan_orange_ratio: float = Field(..., ge=0, description="F4/F7")


class AS7341SpectralAnalysis(BaseModel):
    """Spectral analysis results"""
    total_intensity: float = Field(..., ge=0)
    spectral_ratios: AS7341SpectralRatios
    dominant_wavelength: float = Field(..., ge=400, le=750, description="Dominant wavelength in nm")
    spectral_uniformity: float = Field(..., ge=0.0, le=1.0)


class AS7341ColorAnalysis(BaseModel):
    """Color analysis results"""
    rgb: Dict[str, int] = Field(..., description="RGB values")
    dominant_color: str = Field(..., min_length=1)
    color_temperature_k: float = Field(..., ge=1000, le=15000, description="Color temperature in Kelvin")
    color_purity: float = Field(..., ge=0.0, le=1.0)

    @field_validator('rgb')
    @classmethod
    def validate_rgb(cls, v):
        required_keys = {'r', 'g', 'b'}
        if not required_keys.issubset(v.keys()):
            raise ValueError(f'rgb must contain keys: {required_keys}')
        for key in required_keys:
            if not 0 <= v[key] <= 255:
                raise ValueError(f'RGB value {key}={v[key]} must be 0-255')
        return v


class AS7341ScoreBreakdown(BaseModel):
    """Score breakdown components"""
    freshness_score: float = Field(..., ge=0.0, le=1.0)
    fat_quality_score: float = Field(..., ge=0.0, le=1.0)
    oxidation_score: float = Field(..., ge=0.0, le=1.0)
    color_score: float = Field(..., ge=0.0, le=1.0)
    spectral_consistency_score: float = Field(..., ge=0.0, le=1.0)


class AS7341Analysis(BaseModel):
    """Complete AS7341 analysis with validation"""
    # Raw data
    channels: AS7341Channels
    integration_time: int = Field(..., ge=1, le=1000, description="Integration time in ms")
    gain: int = Field(..., ge=1, le=512, description="Gain multiplier")

    # Detailed analysis
    spectral_analysis: Optional[AS7341SpectralAnalysis] = None
    color_analysis: Optional[AS7341ColorAnalysis] = None

    # Quality metrics
    freshness_index: float = Field(..., ge=0.0, le=1.0, description="Freshness index (1.0 = very fresh)")
    fat_quality_index: float = Field(..., ge=0.0, le=1.0, description="Fat quality index")
    oxidation_index: float = Field(..., ge=0.0, le=1.0, description="Oxidation index (0.0 = no oxidation)")
    color_uniformity: float = Field(..., ge=0.0, le=1.0, description="Color uniformity")

    # Quality assessment
    defects: List[str] = Field(default_factory=list)
    quality_score: float = Field(..., ge=0.0, le=1.0, description="Overall quality score")
    score_breakdown: Optional[AS7341ScoreBreakdown] = None
    grade: str = Field(..., pattern=r'^(A\+|A|B|C|REJECT|UNKNOWN)$', description="Quality grade")


# ============================================================================
# Fusion Schemas
# ============================================================================

class FusionResult(BaseModel):
    """Multi-sensor fusion result"""
    final_score: float = Field(..., ge=0.0, le=1.0, description="Combined quality score")
    final_grade: str = Field(..., pattern=r'^(A\+|A|B|C|REJECT|UNKNOWN)$', description="Final quality grade")
    vl53l8ch_score: float = Field(..., ge=0.0, le=1.0, description="VL53L8CH contribution")
    as7341_score: float = Field(..., ge=0.0, le=1.0, description="AS7341 contribution")
    defects: List[str] = Field(default_factory=list, description="Combined defects from both sensors")

    @field_validator('defects')
    @classmethod
    def validate_defects_unique(cls, v):
        """Ensure defects list has unique entries"""
        return list(set(v))


# ============================================================================
# Metadata Schemas
# ============================================================================

class SensorMetadata(BaseModel):
    """Device and environment metadata"""
    device_id: str = Field(..., min_length=1, max_length=100)
    firmware_version: str = Field(..., min_length=1, max_length=50, pattern=r'^\d+\.\d+\.\d+$')
    temperature_c: float = Field(..., ge=-40, le=85, description="Temperature in Celsius")
    humidity_percent: float = Field(..., ge=0, le=100, description="Humidity percentage")
    config_profile: str = Field(..., min_length=1, max_length=100)


# ============================================================================
# Complete Message Schema
# ============================================================================

class SensorDataMessage(BaseModel):
    """Complete sensor data message with full validation"""
    type: str = Field(..., pattern=r'^sensor_data$', description="Message type")
    timestamp: datetime = Field(..., description="Sample timestamp (ISO 8601)")
    device_id: str = Field(..., min_length=1, max_length=100, description="Device identifier")
    sample_id: str = Field(..., min_length=1, max_length=100, description="Unique sample identifier")

    # Sensor data
    vl53l8ch: VL53L8CHAnalysis
    as7341: AS7341Analysis
    fusion: FusionResult

    # Metadata
    meta: SensorMetadata
    processing_time_ms: Optional[float] = Field(None, ge=0, le=60000, description="Processing time in ms")

    @field_validator('timestamp')
    @classmethod
    def validate_timestamp_not_future(cls, v):
        """Ensure timestamp is not in the future (allow 5 min tolerance for clock skew)"""
        from datetime import timedelta, timezone
        
        # Convert naive datetime to UTC aware datetime
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        
        # Compare with UTC now (aware)
        max_allowed = datetime.now(timezone.utc) + timedelta(minutes=5)
        if v > max_allowed:
            raise ValueError(f'Timestamp {v} is too far in the future')
        return v

    @model_validator(mode='after')
    def validate_consistency(self):
        """Validate cross-field consistency"""
        # Check device_id consistency
        if self.device_id != self.meta.device_id:
            raise ValueError(f"device_id mismatch: {self.device_id} != {self.meta.device_id}")

        # Check grade consistency with score
        fusion = self.fusion
        score = fusion.final_score
        grade = fusion.final_grade

        # Validate grade matches score range
        if grade == 'A+' and score < 0.85:
            raise ValueError(f"Grade A+ requires score >= 0.85, got {score}")
        elif grade == 'A' and not (0.75 <= score < 0.85):
            raise ValueError(f"Grade A requires score 0.75-0.85, got {score}")
        elif grade == 'B' and not (0.60 <= score < 0.75):
            raise ValueError(f"Grade B requires score 0.60-0.75, got {score}")
        elif grade == 'C' and not (0.45 <= score < 0.60):
            raise ValueError(f"Grade C requires score 0.45-0.60, got {score}")
        elif grade == 'REJECT' and score >= 0.45:
            raise ValueError(f"Grade REJECT requires score < 0.45, got {score}")

        return self

    class Config:
        json_schema_extra = {
            "example": {
                "type": "sensor_data",
                "timestamp": "2025-10-26T10:30:00.000Z",
                "device_id": "ESP32-FOIEGRAS-001",
                "sample_id": "SAMPLE-20251026-103000-123",
                "vl53l8ch": {
                    "distance_matrix": [[10.5] * 8 for _ in range(8)],
                    "reflectance_matrix": [[150.0] * 8 for _ in range(8)],
                    "amplitude_matrix": [[50.0] * 8 for _ in range(8)],
                    "volume_mm3": 2500.0,
                    "base_area_mm2": 250.0,
                    "average_height_mm": 10.0,
                    "max_height_mm": 12.0,
                    "min_height_mm": 8.0,
                    "height_range_mm": 4.0,
                    "surface_uniformity": 0.85,
                    "defects": [],
                    "quality_score": 0.87,
                    "grade": "A"
                },
                "as7341": {
                    "channels": {
                        "F1_415nm": 1000,
                        "F2_445nm": 1200,
                        "F3_480nm": 1500,
                        "F4_515nm": 2000,
                        "F5_555nm": 2500,
                        "F6_590nm": 2200,
                        "F7_630nm": 1800,
                        "F8_680nm": 1600,
                        "Clear": 10000,
                        "NIR": 3000
                    },
                    "integration_time": 100,
                    "gain": 16,
                    "freshness_index": 0.82,
                    "fat_quality_index": 0.85,
                    "oxidation_index": 0.15,
                    "color_uniformity": 0.88,
                    "defects": [],
                    "quality_score": 0.83,
                    "grade": "A"
                },
                "fusion": {
                    "final_score": 0.85,
                    "final_grade": "A+",
                    "vl53l8ch_score": 0.87,
                    "as7341_score": 0.83,
                    "defects": []
                },
                "meta": {
                    "device_id": "ESP32-FOIEGRAS-001",
                    "firmware_version": "1.0.0",
                    "temperature_c": 25.5,
                    "humidity_percent": 50.0,
                    "config_profile": "foiegras_premium"
                },
                "processing_time_ms": 150.5
            }
        }
