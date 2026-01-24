"""
SQLAlchemy Models for User Management
"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid

from app.core.database import Base


class User(Base):
    """User accounts"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(150), unique=True, nullable=False, index=True)
    email = Column(String(254), unique=True, nullable=False, index=True)

    # Profile
    first_name = Column(String(150))
    last_name = Column(String(150))

    # Password (hashed)
    password_hash = Column(String(255))

    # Status
    is_active = Column(Boolean, default=True)
    is_staff = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)

    # Organization
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'))

    # Roles and permissions
    roles = Column(JSONB, default=list)  # List of role names

    # Preferences
    preferences = Column(JSONB, default=dict)

    # Timestamps
    last_login = Column(DateTime(timezone=True))
    date_joined = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)


class Organization(Base):
    """Organizations/Companies"""
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False, unique=True, index=True)

    # Details
    description = Column(String(1000))
    address = Column(String(500))
    contact_email = Column(String(254))
    contact_phone = Column(String(50))

    # Settings
    settings = Column(JSONB, default=dict)

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)


class AuditLog(Base):
    """Audit logs for all user actions"""
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    # User info
    user_id = Column(UUID(as_uuid=True), index=True)
    user_name = Column(String(150))

    # Action details
    action = Column(String(100), nullable=False, index=True)  # create, update, delete, login, logout, etc.
    resource_type = Column(String(100), nullable=False, index=True)  # user, device, model, etc.
    resource_id = Column(String(100))

    # Context
    ip_address = Column(String(100))
    user_agent = Column(String(500))

    # Details
    details = Column(JSONB)  # Additional context about the action
    changes = Column(JSONB)  # What was changed (before/after)

    # Status
    status = Column(String(50), default='success')  # success, failed
    error_message = Column(String(1000))


class Device(Base):
    """Device registry"""
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String(100), unique=True, nullable=False, index=True)

    # Info
    name = Column(String(200))
    type = Column(String(100), nullable=False)  # VL53L8CH, AS7341, FUSION

    # Status
    status = Column(String(50), default='offline')  # online, offline, error, maintenance

    # Firmware
    firmware_version = Column(String(50))

    # Location
    location = Column(String(500))

    # Organization
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'))

    # Network
    ip_address = Column(String(100))
    mac_address = Column(String(100))

    # Statistics
    total_measurements = Column(Integer, default=0)

    # Timestamps
    last_seen = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)
