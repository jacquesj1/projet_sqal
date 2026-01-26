import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SensorSample(Base):
    __tablename__ = "sensor_samples"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    device_id: Mapped[str] = mapped_column(String(100), index=True)
    sample_id: Mapped[str] = mapped_column(String(100), unique=True)
    lot_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    vl53l8ch_distance_matrix: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    vl53l8ch_reflectance_matrix: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    vl53l8ch_amplitude_matrix: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    vl53l8ch_bins_matrix: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    vl53l8ch_volume_mm3: Mapped[float | None] = mapped_column(Float, nullable=True)
    vl53l8ch_avg_height_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    vl53l8ch_max_height_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    vl53l8ch_min_height_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    vl53l8ch_base_area_mm2: Mapped[float | None] = mapped_column(Float, nullable=True)
    vl53l8ch_surface_uniformity: Mapped[float | None] = mapped_column(Float, nullable=True)
    vl53l8ch_defect_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vl53l8ch_quality_score: Mapped[float | None] = mapped_column(Float, index=True, nullable=True)
    vl53l8ch_grade: Mapped[str | None] = mapped_column(String(50), index=True, nullable=True)

    vl53l8ch_bins_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    vl53l8ch_reflectance_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    vl53l8ch_amplitude_consistency: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    vl53l8ch_score_breakdown: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    vl53l8ch_defects: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    as7341_channels: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    as7341_integration_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
    as7341_gain: Mapped[int | None] = mapped_column(Integer, nullable=True)

    as7341_color_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    as7341_freshness_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    as7341_freshness_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    as7341_fat_quality_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    as7341_oxidation_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    as7341_color_uniformity: Mapped[float | None] = mapped_column(Float, nullable=True)
    as7341_quality_score: Mapped[float | None] = mapped_column(Float, index=True, nullable=True)
    as7341_grade: Mapped[str | None] = mapped_column(String(50), index=True, nullable=True)

    as7341_spectral_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    as7341_color_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    as7341_score_breakdown: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    as7341_defects: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    fusion_final_score: Mapped[float] = mapped_column(Float, index=True)
    fusion_final_grade: Mapped[str] = mapped_column(String(50), index=True)
    fusion_vl53l8ch_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    fusion_as7341_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    fusion_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    fusion_defects: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    poids_foie_estime_g: Mapped[float | None] = mapped_column(Float, nullable=True)

    meta_firmware_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    meta_temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    meta_humidity_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    meta_config_profile: Mapped[str | None] = mapped_column(String(100), nullable=True)
    processing_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    blockchain_hash: Mapped[str | None] = mapped_column(String(256), index=True, nullable=True)
    blockchain_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    qr_code_base64: Mapped[str | None] = mapped_column(String, nullable=True)
    lot_abattage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    eleveur: Mapped[str | None] = mapped_column(String(200), nullable=True)
    provenance: Mapped[str | None] = mapped_column(String(200), nullable=True)

    __table_args__ = (
        Index("idx_sensor_samples_device_timestamp", "device_id", "timestamp"),
        Index("idx_sensor_samples_grade_timestamp", "fusion_final_grade", "timestamp"),
        Index("idx_sensor_samples_score_timestamp", "fusion_final_score", "timestamp"),
    )
