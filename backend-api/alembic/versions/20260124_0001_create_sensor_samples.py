"""create sensor_samples

Revision ID: 20260124_0001
Revises: 
Create Date: 2026-01-24

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260124_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sensor_samples",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("device_id", sa.String(length=100), nullable=False),
        sa.Column("sample_id", sa.String(length=100), nullable=False),
        sa.Column("lot_id", sa.Integer(), nullable=True),
        # VL53L8CH raw
        sa.Column("vl53l8ch_distance_matrix", postgresql.JSONB(), nullable=True),
        sa.Column("vl53l8ch_reflectance_matrix", postgresql.JSONB(), nullable=True),
        sa.Column("vl53l8ch_amplitude_matrix", postgresql.JSONB(), nullable=True),
        sa.Column("vl53l8ch_bins_matrix", postgresql.JSONB(), nullable=True),
        # VL53L8CH basic metrics
        sa.Column("vl53l8ch_volume_mm3", sa.Float(), nullable=True),
        sa.Column("vl53l8ch_avg_height_mm", sa.Float(), nullable=True),
        sa.Column("vl53l8ch_max_height_mm", sa.Float(), nullable=True),
        sa.Column("vl53l8ch_min_height_mm", sa.Float(), nullable=True),
        sa.Column("vl53l8ch_base_area_mm2", sa.Float(), nullable=True),
        sa.Column("vl53l8ch_surface_uniformity", sa.Float(), nullable=True),
        sa.Column("vl53l8ch_defect_count", sa.Integer(), nullable=True),
        sa.Column("vl53l8ch_quality_score", sa.Float(), nullable=True),
        sa.Column("vl53l8ch_grade", sa.String(length=50), nullable=True),
        # VL53L8CH detailed
        sa.Column("vl53l8ch_bins_analysis", postgresql.JSONB(), nullable=True),
        sa.Column("vl53l8ch_reflectance_analysis", postgresql.JSONB(), nullable=True),
        sa.Column("vl53l8ch_amplitude_consistency", postgresql.JSONB(), nullable=True),
        sa.Column("vl53l8ch_score_breakdown", postgresql.JSONB(), nullable=True),
        sa.Column("vl53l8ch_defects", postgresql.JSONB(), nullable=True),
        # AS7341 raw
        sa.Column("as7341_channels", postgresql.JSONB(), nullable=True),
        sa.Column("as7341_integration_time", sa.Integer(), nullable=True),
        sa.Column("as7341_gain", sa.Integer(), nullable=True),
        # AS7341 metrics
        sa.Column("as7341_color_score", sa.Float(), nullable=True),
        sa.Column("as7341_freshness_score", sa.Float(), nullable=True),
        sa.Column("as7341_freshness_index", sa.Float(), nullable=True),
        sa.Column("as7341_fat_quality_index", sa.Float(), nullable=True),
        sa.Column("as7341_oxidation_index", sa.Float(), nullable=True),
        sa.Column("as7341_color_uniformity", sa.Float(), nullable=True),
        sa.Column("as7341_quality_score", sa.Float(), nullable=True),
        sa.Column("as7341_grade", sa.String(length=50), nullable=True),
        # AS7341 detailed
        sa.Column("as7341_spectral_analysis", postgresql.JSONB(), nullable=True),
        sa.Column("as7341_color_analysis", postgresql.JSONB(), nullable=True),
        sa.Column("as7341_score_breakdown", postgresql.JSONB(), nullable=True),
        sa.Column("as7341_defects", postgresql.JSONB(), nullable=True),
        # Fusion
        sa.Column("fusion_final_score", sa.Float(), nullable=False),
        sa.Column("fusion_final_grade", sa.String(length=50), nullable=False),
        sa.Column("fusion_vl53l8ch_score", sa.Float(), nullable=True),
        sa.Column("fusion_as7341_score", sa.Float(), nullable=True),
        sa.Column("fusion_confidence", sa.Float(), nullable=True),
        sa.Column("fusion_defects", postgresql.JSONB(), nullable=True),
        # Metadata
        sa.Column("meta_firmware_version", sa.String(length=50), nullable=True),
        sa.Column("meta_temperature_c", sa.Float(), nullable=True),
        sa.Column("meta_humidity_percent", sa.Float(), nullable=True),
        sa.Column("meta_config_profile", sa.String(length=100), nullable=True),
        sa.Column("processing_time_ms", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        # Traceability / blockchain
        sa.Column("blockchain_hash", sa.String(length=256), nullable=True),
        sa.Column("blockchain_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("qr_code_base64", sa.String(), nullable=True),
        sa.Column("lot_abattage", sa.String(length=100), nullable=True),
        sa.Column("eleveur", sa.String(length=200), nullable=True),
        sa.Column("provenance", sa.String(length=200), nullable=True),
    )

    op.create_index("idx_sensor_samples_device_timestamp", "sensor_samples", ["device_id", "timestamp"])
    op.create_index("idx_sensor_samples_grade_timestamp", "sensor_samples", ["fusion_final_grade", "timestamp"])
    op.create_index("idx_sensor_samples_score_timestamp", "sensor_samples", ["fusion_final_score", "timestamp"])
    op.create_index("ix_sensor_samples_timestamp", "sensor_samples", ["timestamp"])
    op.create_index("ix_sensor_samples_device_id", "sensor_samples", ["device_id"])
    op.create_index("ix_sensor_samples_sample_id", "sensor_samples", ["sample_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_sensor_samples_sample_id", table_name="sensor_samples")
    op.drop_index("ix_sensor_samples_device_id", table_name="sensor_samples")
    op.drop_index("ix_sensor_samples_timestamp", table_name="sensor_samples")
    op.drop_index("idx_sensor_samples_score_timestamp", table_name="sensor_samples")
    op.drop_index("idx_sensor_samples_grade_timestamp", table_name="sensor_samples")
    op.drop_index("idx_sensor_samples_device_timestamp", table_name="sensor_samples")
    op.drop_table("sensor_samples")
