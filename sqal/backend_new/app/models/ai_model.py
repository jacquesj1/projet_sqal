"""
SQLAlchemy Models for AI/ML functionality
"""
from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid

from app.core.database import Base


class AIModel(Base):
    """AI Model registry"""
    __tablename__ = "ai_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    type = Column(String(100), nullable=False)  # classification, regression, etc.
    version = Column(String(50))
    status = Column(String(50), nullable=False, default='inactive')  # active, inactive, training, error

    # Performance metrics
    accuracy = Column(Float)
    val_accuracy = Column(Float)
    precision = Column(Float)
    recall = Column(Float)
    f1_score = Column(Float)

    # Model info
    architecture = Column(String(200))
    size_bytes = Column(Integer)
    parameters_count = Column(Integer)

    # Model artifacts
    model_path = Column(String(500))
    config = Column(JSONB)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)


class TrainingJob(Base):
    """Training job tracking"""
    __tablename__ = "training_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_type = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default='pending')  # pending, running, completed, failed

    # Progress tracking
    current_epoch = Column(Integer, default=0)
    total_epochs = Column(Integer, nullable=False)

    # Metrics
    accuracy = Column(Float)
    val_accuracy = Column(Float)
    loss = Column(Float)
    val_loss = Column(Float)

    # Training config
    config = Column(JSONB)
    dataset_id = Column(UUID(as_uuid=True))

    # Timestamps
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Results
    error_message = Column(String(1000))
    logs = Column(JSONB)  # Training logs


class Dataset(Base):
    """Dataset management"""
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(String(1000))

    # Dataset info
    total_samples = Column(Integer, default=0)
    train_samples = Column(Integer)
    val_samples = Column(Integer)
    test_samples = Column(Integer)

    # Storage
    storage_path = Column(String(500))
    size_bytes = Column(Integer)

    # Metadata
    labels = Column(JSONB)  # List of labels/classes
    statistics = Column(JSONB)  # Dataset statistics

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.utcnow)


class Prediction(Base):
    """ML Prediction results"""
    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), nullable=False)

    # Input data reference
    sample_id = Column(String(100))

    # Prediction results
    predicted_class = Column(String(100))
    confidence = Column(Float)
    probabilities = Column(JSONB)  # Class probabilities

    # Performance
    inference_time_ms = Column(Float)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
