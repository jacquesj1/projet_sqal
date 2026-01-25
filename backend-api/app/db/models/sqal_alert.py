from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SQALAlert(Base):
    __tablename__ = "sqal_alerts"

    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    alert_id: Mapped[int] = mapped_column(Integer, primary_key=True)

    sample_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    alert_type: Mapped[str] = mapped_column(String(50))
    severity: Mapped[str] = mapped_column(String(20))
    message: Mapped[str | None] = mapped_column(String, nullable=True)

    data_context: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    is_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_by: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
