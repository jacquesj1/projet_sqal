"""
AI/ML API Router
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timedelta
import uuid

from app.core.database import AsyncSessionLocal
from app.models.ai_model import AIModel, TrainingJob, Dataset, Prediction

router = APIRouter(prefix="/api/ai", tags=["AI/ML"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/metrics/")
async def get_ai_metrics(db: AsyncSession = Depends(get_db)):
    """Get AI metrics"""
    result = await db.execute(select(AIModel).where(AIModel.status == 'active'))
    models = result.scalars().all()

    if not models:
        return {
            "averageAccuracy": 0.0,
            "averageValAccuracy": 0.0,
            "averageLatency": "0ms",
            "performanceHistory": []
        }

    avg_acc = sum(m.accuracy or 0 for m in models) / len(models)
    avg_val_acc = sum(m.val_accuracy or 0 for m in models) / len(models)

    best_model = max(models, key=lambda m: m.val_accuracy or 0) if models else None

    return {
        "averageAccuracy": round(avg_acc, 4),
        "averageValAccuracy": round(avg_val_acc, 4),
        "averageLatency": "50ms",
        "bestModel": {
            "id": str(best_model.id),
            "name": best_model.name,
            "accuracy": best_model.accuracy,
            "valAccuracy": best_model.val_accuracy
        } if best_model else None,
        "performanceHistory": []
    }


@router.get("/models/")
async def get_models(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get all AI models"""
    result = await db.execute(
        select(AIModel)
        .order_by(AIModel.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    models = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(AIModel))
    total = count_result.scalar()

    return {
        "models": [
            {
                "id": str(m.id),
                "name": m.name,
                "type": m.type,
                "version": m.version,
                "status": m.status,
                "accuracy": m.accuracy,
                "valAccuracy": m.val_accuracy,
                "size": m.size_bytes,
                "architecture": m.architecture,
                "createdAt": m.created_at.isoformat() if m.created_at else None,
                "updatedAt": m.updated_at.isoformat() if m.updated_at else None
            }
            for m in models
        ],
        "total": total
    }


@router.get("/models/{model_id}")
async def get_model(model_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific model"""
    result = await db.execute(select(AIModel).where(AIModel.id == uuid.UUID(model_id)))
    model = result.scalar_one_or_none()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    return {
        "id": str(model.id),
        "name": model.name,
        "type": model.type,
        "version": model.version,
        "status": model.status,
        "accuracy": model.accuracy,
        "valAccuracy": model.val_accuracy,
        "precision": model.precision,
        "recall": model.recall,
        "f1Score": model.f1_score,
        "architecture": model.architecture,
        "size": model.size_bytes,
        "parametersCount": model.parameters_count,
        "config": model.config,
        "createdAt": model.created_at.isoformat() if model.created_at else None
    }


@router.post("/models/")
async def create_model(data: dict, db: AsyncSession = Depends(get_db)):
    """Create new AI model"""
    model = AIModel(
        name=data.get("name"),
        type=data.get("type"),
        version=data.get("version"),
        status="inactive",
        architecture=data.get("architecture"),
        config=data.get("config", {})
    )

    db.add(model)
    await db.commit()
    await db.refresh(model)

    return {"id": str(model.id), "message": "Model created successfully"}


@router.patch("/models/{model_id}")
async def update_model(model_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Update model"""
    result = await db.execute(select(AIModel).where(AIModel.id == uuid.UUID(model_id)))
    model = result.scalar_one_or_none()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    for key, value in data.items():
        if hasattr(model, key):
            setattr(model, key, value)

    await db.commit()
    return {"message": "Model updated successfully"}


@router.delete("/models/{model_id}")
async def delete_model(model_id: str, db: AsyncSession = Depends(get_db)):
    """Delete model"""
    result = await db.execute(select(AIModel).where(AIModel.id == uuid.UUID(model_id)))
    model = result.scalar_one_or_none()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    await db.delete(model)
    await db.commit()

    return {"message": "Model deleted successfully"}


@router.post("/models/{model_id}/activate/")
async def activate_model(model_id: str, db: AsyncSession = Depends(get_db)):
    """Activate model"""
    result = await db.execute(select(AIModel).where(AIModel.id == uuid.UUID(model_id)))
    model = result.scalar_one_or_none()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    model.status = "active"
    await db.commit()

    return {"message": "Model activated successfully"}


@router.post("/models/{model_id}/deactivate/")
async def deactivate_model(model_id: str, db: AsyncSession = Depends(get_db)):
    """Deactivate model"""
    result = await db.execute(select(AIModel).where(AIModel.id == uuid.UUID(model_id)))
    model = result.scalar_one_or_none()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    model.status = "inactive"
    await db.commit()

    return {"message": "Model deactivated successfully"}


@router.get("/training/")
async def get_training_jobs(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get training jobs"""
    result = await db.execute(
        select(TrainingJob)
        .order_by(TrainingJob.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    jobs = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(TrainingJob))
    total = count_result.scalar()

    return {
        "trainings": [
            {
                "id": str(j.id),
                "modelType": j.model_type,
                "status": j.status,
                "startedAt": j.started_at.isoformat() if j.started_at else None,
                "completedAt": j.completed_at.isoformat() if j.completed_at else None,
                "currentEpoch": j.current_epoch,
                "totalEpochs": j.total_epochs,
                "accuracy": j.accuracy,
                "valAccuracy": j.val_accuracy,
                "loss": j.loss,
                "valLoss": j.val_loss
            }
            for j in jobs
        ],
        "total": total
    }


@router.post("/training/")
async def create_training_job(data: dict, db: AsyncSession = Depends(get_db)):
    """Create training job"""
    job = TrainingJob(
        model_type=data.get("modelType"),
        total_epochs=data.get("totalEpochs", 10),
        status="pending",
        config=data.get("config", {}),
        dataset_id=uuid.UUID(data["datasetId"]) if data.get("datasetId") else None
    )

    db.add(job)
    await db.commit()
    await db.refresh(job)

    return {"id": str(job.id), "message": "Training job created"}


@router.get("/datasets/")
async def get_datasets(db: AsyncSession = Depends(get_db)):
    """Get datasets"""
    result = await db.execute(select(Dataset).order_by(Dataset.created_at.desc()))
    datasets = result.scalars().all()

    return {
        "datasets": [
            {
                "id": str(d.id),
                "name": d.name,
                "description": d.description,
                "totalSamples": d.total_samples,
                "trainSamples": d.train_samples,
                "valSamples": d.val_samples,
                "testSamples": d.test_samples,
                "sizeBytes": d.size_bytes,
                "createdAt": d.created_at.isoformat() if d.created_at else None
            }
            for d in datasets
        ]
    }


@router.post("/predict/")
async def predict(data: dict, db: AsyncSession = Depends(get_db)):
    """Make prediction"""
    # Placeholder for actual prediction logic
    prediction = Prediction(
        model_id=uuid.UUID(data["modelId"]),
        sample_id=data.get("sampleId"),
        predicted_class=data.get("predictedClass", "A"),
        confidence=0.95,
        probabilities={"A+": 0.1, "A": 0.85, "B": 0.05},
        inference_time_ms=50.0
    )

    db.add(prediction)
    await db.commit()

    return {
        "predictedClass": prediction.predicted_class,
        "confidence": prediction.confidence,
        "probabilities": prediction.probabilities
    }
