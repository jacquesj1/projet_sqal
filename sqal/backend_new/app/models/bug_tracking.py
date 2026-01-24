"""
SQLAlchemy Models for Bug Tracking
"""
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid

from app.core.database import Base


class BugReport(Base):
    """Bug reports and issues"""
    __tablename__ = "bug_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=False)

    # Classification
    severity = Column(String(50), nullable=False, index=True)  # critical, high, medium, low
    priority = Column(String(50), nullable=False, index=True)  # urgent, high, medium, low
    category = Column(String(100), index=True)  # hardware, firmware, backend, frontend, sensor, quality

    # Status
    status = Column(String(50), nullable=False, default='open', index=True)  # open, in_progress, resolved, closed, wont_fix

    # Context
    device_id = Column(String(100), index=True)
    firmware_version = Column(String(50))
    sample_id = Column(String(100))

    # Reporter
    reported_by = Column(String(200))
    reported_by_email = Column(String(200))

    # Assignment
    assigned_to = Column(String(200))
    assigned_at = Column(DateTime(timezone=True))

    # Resolution
    resolution = Column(Text)
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(String(200))

    # Attachments and logs
    attachments = Column(JSONB)  # List of file paths/URLs
    error_logs = Column(JSONB)  # Error logs and stack traces
    reproduction_steps = Column(Text)

    # Metadata
    tags = Column(JSONB)  # List of tags
    related_issues = Column(JSONB)  # List of related bug IDs

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)


class BugComment(Base):
    """Comments on bug reports"""
    __tablename__ = "bug_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bug_report_id = Column(UUID(as_uuid=True), ForeignKey('bug_reports.id'), nullable=False, index=True)

    # Comment content
    comment = Column(Text, nullable=False)

    # Author
    author = Column(String(200), nullable=False)
    author_email = Column(String(200))

    # Metadata
    is_internal = Column(String(10), default='false')  # Internal comments not visible to reporters
    attachments = Column(JSONB)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)


class BugMetrics(Base):
    """Bug tracking metrics and statistics"""
    __tablename__ = "bug_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(DateTime(timezone=True), nullable=False, index=True)

    # Counts
    total_bugs = Column(Integer, default=0)
    open_bugs = Column(Integer, default=0)
    in_progress_bugs = Column(Integer, default=0)
    resolved_bugs = Column(Integer, default=0)
    closed_bugs = Column(Integer, default=0)

    # By severity
    critical_bugs = Column(Integer, default=0)
    high_severity_bugs = Column(Integer, default=0)
    medium_severity_bugs = Column(Integer, default=0)
    low_severity_bugs = Column(Integer, default=0)

    # Resolution metrics
    avg_resolution_time_hours = Column(Integer)
    avg_response_time_hours = Column(Integer)

    # Trends
    new_bugs_today = Column(Integer, default=0)
    resolved_today = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
