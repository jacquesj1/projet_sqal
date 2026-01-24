"""
SQLAlchemy Models for Firmware and OTA Updates
"""
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid

from app.core.database import Base


class FirmwareVersion(Base):
    """Firmware version registry"""
    __tablename__ = "firmware_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version = Column(String(50), nullable=False, unique=True, index=True)

    # Version info
    major = Column(Integer, nullable=False)
    minor = Column(Integer, nullable=False)
    patch = Column(Integer, nullable=False)

    # Metadata
    name = Column(String(200))
    description = Column(Text)
    release_notes = Column(Text)

    # File info
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)  # bytes
    file_hash = Column(String(256))  # SHA-256 hash

    # Compatibility
    compatible_devices = Column(JSONB)  # List of compatible device types
    min_required_version = Column(String(50))

    # Status
    status = Column(String(50), default='draft')  # draft, released, deprecated
    is_stable = Column(Boolean, default=False)

    # Timestamps
    released_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)


class OTAUpdate(Base):
    """OTA Update campaigns"""
    __tablename__ = "ota_updates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)

    # Target firmware
    firmware_version_id = Column(UUID(as_uuid=True), ForeignKey('firmware_versions.id'), nullable=False)

    # Target devices
    target_devices = Column(JSONB)  # List of device IDs
    target_device_type = Column(String(100))  # Or update all of a type

    # Scheduling
    scheduled_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Status
    status = Column(String(50), default='pending')  # pending, in_progress, completed, failed, cancelled

    # Progress
    total_devices = Column(Integer, default=0)
    devices_updated = Column(Integer, default=0)
    devices_failed = Column(Integer, default=0)

    # Configuration
    rollout_strategy = Column(String(50), default='all_at_once')  # all_at_once, gradual, scheduled
    rollout_percentage = Column(Integer, default=100)

    # Metadata
    notes = Column(Text)
    created_by = Column(String(200))

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)


class OTAUpdateLog(Base):
    """Individual device OTA update logs"""
    __tablename__ = "ota_update_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ota_update_id = Column(UUID(as_uuid=True), ForeignKey('ota_updates.id'), nullable=False)
    device_id = Column(String(100), nullable=False, index=True)

    # Status
    status = Column(String(50), nullable=False)  # pending, downloading, installing, completed, failed

    # Progress
    download_progress = Column(Integer, default=0)  # 0-100
    install_progress = Column(Integer, default=0)  # 0-100

    # Versions
    previous_version = Column(String(50))
    target_version = Column(String(50), nullable=False)

    # Timing
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Error tracking
    error_message = Column(String(1000))
    retry_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)
