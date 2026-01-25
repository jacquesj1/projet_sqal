from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SQALDevice(Base):
    __tablename__ = "sqal_devices"

    device_id: Mapped[str] = mapped_column(String(100), primary_key=True)

    device_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    device_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String(20), nullable=True)

    site_code: Mapped[str | None] = mapped_column(String(2), nullable=True)

    status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    config_profile: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
