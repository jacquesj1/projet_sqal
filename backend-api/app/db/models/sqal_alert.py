from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SQALAlert(Base):
    __tablename__ = "sqal_alerts"

    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    alert_id: Mapped[int] = mapped_column(Integer, primary_key=True)

    sample_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lot_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    alert_type: Mapped[str] = mapped_column(String(50))
    severity: Mapped[str] = mapped_column(String(20))

    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message: Mapped[str | None] = mapped_column(String, nullable=True)
    defect_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    threshold_value: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    actual_value: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    deviation_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)

    acknowledged: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    acknowledged_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
