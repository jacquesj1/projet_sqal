"""
Models package
"""
from app.models.sensor import SensorSample, DeviceStatus, QualityAlert, ProductionBatch
from app.models.ai_model import AIModel, TrainingJob, Dataset, Prediction
from app.models.firmware import FirmwareVersion, OTAUpdate, OTAUpdateLog
from app.models.bug_tracking import BugReport, BugComment, BugMetrics
from app.models.user import User, Organization, AuditLog, Device
from app.models.report import Report, ScheduledReport, ReportTemplate

__all__ = [
    # Sensor models
    "SensorSample",
    "DeviceStatus",
    "QualityAlert",
    "ProductionBatch",
    # AI models
    "AIModel",
    "TrainingJob",
    "Dataset",
    "Prediction",
    # Firmware models
    "FirmwareVersion",
    "OTAUpdate",
    "OTAUpdateLog",
    # Bug tracking models
    "BugReport",
    "BugComment",
    "BugMetrics",
    # User models
    "User",
    "Organization",
    "AuditLog",
    "Device",
    # Report models
    "Report",
    "ScheduledReport",
    "ReportTemplate",
]
