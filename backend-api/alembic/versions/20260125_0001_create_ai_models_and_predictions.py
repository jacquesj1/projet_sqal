"""create ai_models and predictions

Revision ID: 20260125_0001
Revises: 20260124_0001
Create Date: 2026-01-25

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260125_0001"
down_revision = "20260124_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_models",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("framework", sa.String(length=50), nullable=True),
        sa.Column("model_type", sa.String(length=50), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_ai_models_name", "ai_models", ["name"])
    op.create_index("ix_ai_models_version", "ai_models", ["version"])
    op.create_index("ix_ai_models_is_active", "ai_models", ["is_active"])
    op.create_index("idx_ai_models_name_version", "ai_models", ["name", "version"], unique=True)

    op.create_table(
        "predictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("sample_id", sa.String(length=100), nullable=False),
        sa.Column("device_id", sa.String(length=100), nullable=False),
        sa.Column("predicted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("model_name", sa.String(length=200), nullable=False),
        sa.Column("model_version", sa.String(length=50), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("grade", sa.String(length=50), nullable=True),
        sa.Column("explanations", postgresql.JSONB(), nullable=True),
    )

    op.create_index("ix_predictions_sample_id", "predictions", ["sample_id"])
    op.create_index("ix_predictions_device_id", "predictions", ["device_id"])
    op.create_index("ix_predictions_predicted_at", "predictions", ["predicted_at"])
    op.create_index("ix_predictions_model_name", "predictions", ["model_name"])
    op.create_index("ix_predictions_model_version", "predictions", ["model_version"])
    op.create_index("idx_predictions_sample_predicted_at", "predictions", ["sample_id", "predicted_at"])


def downgrade() -> None:
    op.drop_index("idx_predictions_sample_predicted_at", table_name="predictions")
    op.drop_index("ix_predictions_model_version", table_name="predictions")
    op.drop_index("ix_predictions_model_name", table_name="predictions")
    op.drop_index("ix_predictions_predicted_at", table_name="predictions")
    op.drop_index("ix_predictions_device_id", table_name="predictions")
    op.drop_index("ix_predictions_sample_id", table_name="predictions")
    op.drop_table("predictions")

    op.drop_index("idx_ai_models_name_version", table_name="ai_models")
    op.drop_index("ix_ai_models_is_active", table_name="ai_models")
    op.drop_index("ix_ai_models_version", table_name="ai_models")
    op.drop_index("ix_ai_models_name", table_name="ai_models")
    op.drop_table("ai_models")
