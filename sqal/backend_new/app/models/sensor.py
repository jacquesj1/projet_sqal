"""
SQLAlchemy Models for Sensor Data
Optimized for TimescaleDB hypertables
"""
from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Index, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class SensorSample(Base):
    """
    Main table for sensor samples - will be converted to hypertable
    Stores all sensor data with full analysis results
    """
    __tablename__ = "sensor_samples"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Time dimension (required for hypertable)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Device information
    device_id = Column(String(100), nullable=False, index=True)
    sample_id = Column(String(100), nullable=False, unique=True)
    
    # VL53L8CH Data (ToF sensor)
    vl53l8ch_distance_matrix = Column(JSONB)  # 8x8 matrix
    vl53l8ch_reflectance_matrix = Column(JSONB)  # 8x8 matrix
    vl53l8ch_amplitude_matrix = Column(JSONB)  # 8x8 matrix
    vl53l8ch_bins_matrix = Column(JSONB)  # Histogram data

    # VL53L8CH Analysis Results - Basic metrics
    vl53l8ch_volume_mm3 = Column(Float)
    vl53l8ch_avg_height_mm = Column(Float)
    vl53l8ch_max_height_mm = Column(Float)
    vl53l8ch_min_height_mm = Column(Float)
    vl53l8ch_base_area_mm2 = Column(Float)
    vl53l8ch_surface_uniformity = Column(Float)
    vl53l8ch_defect_count = Column(Integer)
    vl53l8ch_quality_score = Column(Float, index=True)
    vl53l8ch_grade = Column(String(50), index=True)

    # VL53L8CH Detailed Analysis (JSONB for full data)
    vl53l8ch_bins_analysis = Column(JSONB)  # Histogram analysis, multi-peaks, roughness
    vl53l8ch_reflectance_analysis = Column(JSONB)  # Optical anomalies, uniformity
    vl53l8ch_amplitude_consistency = Column(JSONB)  # Signal quality, z-scores
    vl53l8ch_score_breakdown = Column(JSONB)  # Detailed score components
    vl53l8ch_defects = Column(JSONB)  # List of detected defects with details
    
    # AS7341 Data (Spectral sensor)
    as7341_channels = Column(JSONB)  # All spectral channels (F1-F8, Clear, NIR)
    as7341_integration_time = Column(Integer)
    as7341_gain = Column(Integer)

    # AS7341 Analysis Results - Basic metrics
    as7341_color_score = Column(Float)
    as7341_freshness_score = Column(Float)
    as7341_freshness_index = Column(Float)  # 0.0-1.0
    as7341_fat_quality_index = Column(Float)  # 0.0-1.0
    as7341_oxidation_index = Column(Float)  # 0.0-1.0
    as7341_color_uniformity = Column(Float)  # 0.0-1.0
    as7341_quality_score = Column(Float, index=True)
    as7341_grade = Column(String(50), index=True)

    # AS7341 Detailed Analysis (JSONB for full data)
    as7341_spectral_analysis = Column(JSONB)  # All spectral ratios and indices
    as7341_color_analysis = Column(JSONB)  # RGB, dominant wavelength, color metrics
    as7341_score_breakdown = Column(JSONB)  # Detailed score components
    as7341_defects = Column(JSONB)  # List of detected defects with details
    
    # Fusion Results
    fusion_final_score = Column(Float, nullable=False, index=True)
    fusion_final_grade = Column(String(50), nullable=False, index=True)
    fusion_vl53l8ch_score = Column(Float)  # VL53L8CH contribution to fusion
    fusion_as7341_score = Column(Float)  # AS7341 contribution to fusion
    fusion_confidence = Column(Float)
    fusion_defects = Column(JSONB)  # List of detected defects (combined from both sensors)

    # Metadata
    meta_firmware_version = Column(String(50))
    meta_temperature_c = Column(Float)
    meta_humidity_percent = Column(Float)
    meta_config_profile = Column(String(100))
    processing_time_ms = Column(Float)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Blockchain & Traceability
    blockchain_hash = Column(String(256), index=True)  # SHA-256 hash for data immutability
    blockchain_timestamp = Column(DateTime(timezone=True))  # When certified
    qr_code_base64 = Column(String)  # Base64-encoded QR code for traceability
    lot_abattage = Column(String(100))  # Slaughter batch number
    eleveur = Column(String(200))  # Farmer/producer name
    provenance = Column(String(200))  # Origin/provenance location

    # Indexes for common queries
    __table_args__ = (
        Index('idx_device_timestamp', 'device_id', 'timestamp'),
        Index('idx_grade_timestamp', 'fusion_final_grade', 'timestamp'),
        Index('idx_score_timestamp', 'fusion_final_score', 'timestamp'),
    )


class DeviceStatus(Base):
    """
    Device health and status tracking
    """
    __tablename__ = "device_status"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    device_id = Column(String(100), nullable=False, index=True)
    
    status = Column(String(50), nullable=False)  # online, offline, error, maintenance
    uptime_seconds = Column(Integer)
    samples_processed = Column(Integer)
    error_rate = Column(Float)
    avg_processing_time_ms = Column(Float)
    last_error = Column(String(500))
    
    firmware_version = Column(String(50))
    location = Column(String(200))
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_device_status_timestamp', 'device_id', 'timestamp'),
    )


class QualityAlert(Base):
    """
    Quality alerts and notifications
    """
    __tablename__ = "quality_alerts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    
    alert_type = Column(String(50), nullable=False, index=True)  # quality, device, system
    severity = Column(String(20), nullable=False, index=True)  # critical, warning, info
    message = Column(String(500), nullable=False)
    
    device_id = Column(String(100), index=True)
    sample_id = Column(String(100))
    
    value = Column(Float)  # Associated metric value
    threshold = Column(Float)  # Threshold that triggered alert
    
    acknowledged = Column(DateTime(timezone=True))
    resolved = Column(DateTime(timezone=True))
    
    extra_metadata = Column(JSONB)  # Additional context
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_alert_severity_timestamp', 'severity', 'timestamp'),
        Index('idx_alert_type_timestamp', 'alert_type', 'timestamp'),
    )


class ProductionBatch(Base):
    """
    Production batch tracking for traceability
    """
    __tablename__ = "production_batches"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_number = Column(String(100), nullable=False, unique=True, index=True)
    
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True))
    
    total_samples = Column(Integer, default=0)
    grade_distribution = Column(JSONB)  # {A+: 50, A: 30, B: 15, C: 4, REJECT: 1}
    avg_quality_score = Column(Float)
    
    status = Column(String(50), default='active')  # active, completed, cancelled
    
    # Blockchain integration
    blockchain_hash = Column(String(256))  # Hash for immutability
    blockchain_timestamp = Column(DateTime(timezone=True))
    
    extra_metadata = Column(JSONB)  # Additional batch info
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_batch_start_time', 'start_time'),
    )
