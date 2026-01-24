"""
Analysis API Router
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timedelta
import uuid

from app.core.database import AsyncSessionLocal
from app.models.sensor import SensorSample

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/history/")
async def get_analysis_history(
    skip: int = 0,
    limit: int = 50,
    grade: Optional[str] = None,
    device_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get analysis history"""
    query = select(SensorSample)

    if grade:
        query = query.where(SensorSample.fusion_final_grade == grade)
    if device_id:
        query = query.where(SensorSample.device_id == device_id)
    if start_date:
        query = query.where(SensorSample.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(SensorSample.timestamp <= datetime.fromisoformat(end_date))

    query = query.order_by(SensorSample.timestamp.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    samples = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(SensorSample))
    total = count_result.scalar()

    return {
        "analyses": [
            {
                "id": str(s.id),
                "time": s.timestamp.isoformat() if s.timestamp else None,
                "deviceId": s.device_id,
                "sampleId": s.sample_id,
                "grade": s.fusion_final_grade,
                "qualityScore": s.fusion_final_score,
                "numDefects": s.vl53l8ch_defect_count or 0,
                "vl53l8chScore": s.vl53l8ch_quality_score,
                "as7341Score": s.as7341_quality_score,
                "vl53l8chGrade": s.vl53l8ch_grade,
                "as7341Grade": s.as7341_grade,
                "defects": s.fusion_defects or [],
                "vl53l8ch": {
                    "volume_mm3": s.vl53l8ch_volume_mm3,
                    "avg_height_mm": s.vl53l8ch_avg_height_mm,
                    "surface_uniformity": s.vl53l8ch_surface_uniformity
                } if s.vl53l8ch_volume_mm3 else None,
                "as7341": {
                    "channels": s.as7341_channels,
                    "freshness_index": s.as7341_freshness_score,
                    "color_score": s.as7341_color_score
                } if s.as7341_channels else None
            }
            for s in samples
        ],
        "pagination": {
            "totalItems": total,
            "totalPages": (total + limit - 1) // limit,
            "currentPage": skip // limit + 1,
            "hasPrevious": skip > 0,
            "hasNext": skip + limit < total
        }
    }


@router.get("/history/{analysis_id}")
async def get_analysis_by_id(analysis_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific analysis"""
    result = await db.execute(
        select(SensorSample).where(SensorSample.id == uuid.UUID(analysis_id))
    )
    sample = result.scalar_one_or_none()

    if not sample:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return {
        "id": str(sample.id),
        "time": sample.timestamp.isoformat() if sample.timestamp else None,
        "deviceId": sample.device_id,
        "sampleId": sample.sample_id,
        "grade": sample.fusion_final_grade,
        "qualityScore": sample.fusion_final_score,
        "vl53l8ch": {
            "distance_matrix": sample.vl53l8ch_distance_matrix,
            "volume_mm3": sample.vl53l8ch_volume_mm3,
            "avg_height_mm": sample.vl53l8ch_avg_height_mm,
            "surface_uniformity": sample.vl53l8ch_surface_uniformity,
            "quality_score": sample.vl53l8ch_quality_score,
            "grade": sample.vl53l8ch_grade
        },
        "as7341": {
            "channels": sample.as7341_channels,
            "color_score": sample.as7341_color_score,
            "freshness_score": sample.as7341_freshness_score,
            "quality_score": sample.as7341_quality_score,
            "grade": sample.as7341_grade
        },
        "fusion": {
            "final_score": sample.fusion_final_score,
            "final_grade": sample.fusion_final_grade,
            "confidence": sample.fusion_confidence,
            "defects": sample.fusion_defects
        }
    }


@router.get("/stats/")
async def get_analysis_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get analysis statistics"""
    query = select(SensorSample)

    if start_date:
        query = query.where(SensorSample.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(SensorSample.timestamp <= datetime.fromisoformat(end_date))

    result = await db.execute(query)
    samples = result.scalars().all()

    if not samples:
        return {
            "totalAnalyses": 0,
            "averageQuality": 0.0,
            "gradeDistribution": {},
            "defectRate": 0.0
        }

    # Calculate statistics
    total = len(samples)
    avg_quality = sum(s.fusion_final_score for s in samples) / total

    grade_dist = {}
    for sample in samples:
        grade = sample.fusion_final_grade
        grade_dist[grade] = grade_dist.get(grade, 0) + 1

    defect_count = sum(1 for s in samples if s.fusion_final_grade in ["C", "REJECT"])
    defect_rate = (defect_count / total * 100) if total > 0 else 0

    return {
        "totalAnalyses": total,
        "averageQuality": round(avg_quality, 3),
        "gradeDistribution": grade_dist,
        "defectRate": round(defect_rate, 2)
    }


@router.get("/grade-distribution/")
async def get_grade_distribution(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get grade distribution"""
    query = select(SensorSample)

    if start_date:
        query = query.where(SensorSample.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(SensorSample.timestamp <= datetime.fromisoformat(end_date))

    result = await db.execute(query)
    samples = result.scalars().all()

    distribution = {}
    for sample in samples:
        grade = sample.fusion_final_grade
        distribution[grade] = distribution.get(grade, 0) + 1

    return {"distribution": distribution}


@router.get("/timeseries/")
async def get_timeseries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    interval: str = "hour",
    db: AsyncSession = Depends(get_db)
):
    """Get time series data"""
    query = select(SensorSample)

    if start_date:
        query = query.where(SensorSample.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(SensorSample.timestamp <= datetime.fromisoformat(end_date))

    query = query.order_by(SensorSample.timestamp.asc())

    result = await db.execute(query)
    samples = result.scalars().all()

    # Group by time interval
    timeseries = []
    for sample in samples:
        timeseries.append({
            "timestamp": sample.timestamp.isoformat() if sample.timestamp else None,
            "qualityScore": sample.fusion_final_score,
            "grade": sample.fusion_final_grade
        })

    return {"timeseries": timeseries}
