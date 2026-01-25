"""add poids_foie_estime_g to sensor_samples

Revision ID: 20260125_0002
Revises: 20260125_0001
Create Date: 2026-01-25

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260125_0002"
down_revision = "20260125_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sensor_samples", sa.Column("poids_foie_estime_g", sa.Float(), nullable=True))

    op.create_index(
        "idx_sensor_samples_lot_poids",
        "sensor_samples",
        ["lot_id", "poids_foie_estime_g"],
        postgresql_where=sa.text("lot_id IS NOT NULL AND poids_foie_estime_g IS NOT NULL"),
    )

    op.execute(
        """
        UPDATE sensor_samples
        SET poids_foie_estime_g = ROUND(((vl53l8ch_volume_mm3 / 1000.0) * 0.947)::numeric, 1)::double precision
        WHERE vl53l8ch_volume_mm3 IS NOT NULL
          AND poids_foie_estime_g IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("idx_sensor_samples_lot_poids", table_name="sensor_samples")
    op.drop_column("sensor_samples", "poids_foie_estime_g")
