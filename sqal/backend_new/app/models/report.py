"""
SQLAlchemy Models for Report Generation
"""
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid

from app.core.database import Base


class Report(Base):
    """Generated reports"""
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)

    # Report type
    report_type = Column(String(100), nullable=False, index=True)  # quality, production, device_health, etc.

    # Format
    format = Column(String(50), nullable=False)  # pdf, excel, csv, json

    # Status
    status = Column(String(50), nullable=False, default='pending', index=True)  # pending, generating, completed, failed

    # File info
    file_url = Column(String(500))
    file_path = Column(String(500))
    file_size = Column(Integer)  # bytes

    # Report parameters
    parameters = Column(JSONB)  # Date range, filters, etc.

    # Creator
    created_by = Column(String(200))

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True))

    # Error handling
    error_message = Column(String(1000))


class ScheduledReport(Base):
    """Scheduled/recurring reports"""
    __tablename__ = "scheduled_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)

    # Report configuration
    report_config = Column(JSONB, nullable=False)  # Type, format, parameters

    # Schedule
    frequency = Column(String(50), nullable=False)  # daily, weekly, monthly, quarterly
    enabled = Column(Boolean, default=True)

    # Recipients
    recipients = Column(JSONB)  # List of email addresses

    # Execution times
    next_run = Column(DateTime(timezone=True))
    last_run = Column(DateTime(timezone=True))

    # Creator
    created_by = Column(String(200))

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)


class ReportTemplate(Base):
    """Report templates"""
    __tablename__ = "report_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False, unique=True)
    description = Column(Text)

    # Template type
    report_type = Column(String(100), nullable=False)

    # Template content
    template_content = Column(JSONB, nullable=False)  # Template structure/config

    # Styling
    styles = Column(JSONB)  # CSS/styling information

    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)

    # Creator
    created_by = Column(String(200))

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)
