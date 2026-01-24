"""
Sensors API Router
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
import uuid

from app.core.database import AsyncSessionLocal
from app.models.sensor import SensorSample
from app.models.user import Device

router = APIRouter(prefix="/api/sensors", tags=["Sensors"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/vl53l8ch/raw/")
async def get_vl53l8ch_raw(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get VL53L8CH raw data"""
    result = await db.execute(
        select(SensorSample)
        .where(SensorSample.vl53l8ch_distance_matrix.isnot(None))
        .order_by(SensorSample.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    samples = result.scalars().all()

    return {
        "results": [
            {
                "sample_id": s.sample_id,
                "device_id": s.device_id,
                "timestamp": s.timestamp.isoformat() if s.timestamp else None,
                "distances": [val for row in (s.vl53l8ch_distance_matrix or []) for val in row],  # Flatten 8x8 to 64 values
                "distance_matrix": s.vl53l8ch_distance_matrix,
                "reflectance_matrix": s.vl53l8ch_reflectance_matrix,
                "amplitude_matrix": s.vl53l8ch_amplitude_matrix
            }
            for s in samples
        ]
    }


@router.get("/as7341/raw/")
async def get_as7341_raw(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get AS7341 raw data"""
    result = await db.execute(
        select(SensorSample)
        .where(SensorSample.as7341_channels.isnot(None))
        .order_by(SensorSample.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    samples = result.scalars().all()

    return {
        "data": [
            {
                "id": str(s.id),
                "device_id": s.device_id,
                "timestamp": s.timestamp.isoformat() if s.timestamp else None,
                "channels": s.as7341_channels,
                "integration_time": s.as7341_integration_time,
                "gain": s.as7341_gain
            }
            for s in samples
        ]
    }


@router.get("/fusion/")
async def get_fusion_results(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get fusion results"""
    result = await db.execute(
        select(SensorSample)
        .order_by(SensorSample.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    samples = result.scalars().all()

    return {
        "results": [
            {
                "id": str(s.id),
                "time": s.timestamp.isoformat() if s.timestamp else None,
                "deviceId": s.device_id,
                "sampleId": s.sample_id,
                "grade": s.fusion_final_grade,
                "qualityScore": s.fusion_final_score,
                "vl53l8chScore": s.vl53l8ch_quality_score,
                "as7341Score": s.as7341_quality_score,
                "defects": s.fusion_defects or [],
                "numDefects": len(s.fusion_defects) if s.fusion_defects else 0
            }
            for s in samples
        ]
    }


@router.get("/devices/")
async def get_sensor_devices(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get sensor devices"""
    result = await db.execute(
        select(Device)
        .order_by(Device.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    devices = result.scalars().all()

    return {
        "devices": [
            {
                "id": str(d.id),
                "deviceId": d.device_id,
                "name": d.name,
                "type": d.type,
                "status": d.status,
                "firmwareVersion": d.firmware_version,
                "location": d.location,
                "lastSeen": d.last_seen.isoformat() if d.last_seen else None
            }
            for d in devices
        ]
    }


@router.get("/devices/{device_id}")
async def get_sensor_device(device_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific sensor device"""
    result = await db.execute(
        select(Device).where(Device.id == uuid.UUID(device_id))
    )
    device = result.scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    return {
        "id": str(device.id),
        "deviceId": device.device_id,
        "name": device.name,
        "type": device.type,
        "status": device.status,
        "firmwareVersion": device.firmware_version,
        "location": device.location,
        "ipAddress": device.ip_address,
        "totalMeasurements": device.total_measurements,
        "lastSeen": device.last_seen.isoformat() if device.last_seen else None
    }


@router.patch("/devices/{device_id}")
async def update_sensor_device(
    device_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update sensor device"""
    result = await db.execute(
        select(Device).where(Device.id == uuid.UUID(device_id))
    )
    device = result.scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    for key, value in data.items():
        if hasattr(device, key):
            setattr(device, key, value)

    await db.commit()
    return {"message": "Device updated successfully"}


# ============================================================================
# Analysis Endpoints (for frontend dashboard)
# ============================================================================

@router.get("/vl53l8ch/analysis/")
async def get_vl53l8ch_analysis(
    skip: int = 0,
    limit: int = 50,
    device_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get VL53L8CH analysis data (quality scores, grades, metrics)"""
    query = select(SensorSample).order_by(SensorSample.timestamp.desc())
    
    if device_id:
        query = query.where(SensorSample.device_id == device_id)
    
    result = await db.execute(query.offset(skip).limit(limit))
    samples = result.scalars().all()

    return {
        "data": [
            {
                "id": str(s.id),
                "sample_id": s.sample_id,
                "device_id": s.device_id,
                "timestamp": s.timestamp.isoformat() if s.timestamp else None,
                "grade": s.vl53l8ch_grade,
                "quality_score": s.vl53l8ch_quality_score,
                "volume_mm3": s.vl53l8ch_volume_mm3,
                "average_height_mm": s.vl53l8ch_avg_height_mm,
                "max_height_mm": s.vl53l8ch_max_height_mm,
                "min_height_mm": s.vl53l8ch_min_height_mm,
                "surface_uniformity": s.vl53l8ch_surface_uniformity,
                "defects": s.vl53l8ch_defects or [],
            }
            for s in samples
        ],
        "total": len(samples),
        "skip": skip,
        "limit": limit
    }


@router.get("/as7341/analysis/")
async def get_as7341_analysis(
    skip: int = 0,
    limit: int = 50,
    device_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get AS7341 analysis data (quality scores, grades, spectral metrics)"""
    query = select(SensorSample).order_by(SensorSample.timestamp.desc())
    
    if device_id:
        query = query.where(SensorSample.device_id == device_id)
    
    result = await db.execute(query.offset(skip).limit(limit))
    samples = result.scalars().all()

    return {
        "data": [
            {
                "id": str(s.id),
                "sample_id": s.sample_id,
                "device_id": s.device_id,
                "timestamp": s.timestamp.isoformat() if s.timestamp else None,
                "grade": s.as7341_grade,
                "quality_score": s.as7341_quality_score,
                "freshness_index": s.as7341_freshness_index,
                "fat_quality_index": s.as7341_fat_quality_index,
                "oxidation_index": s.as7341_oxidation_index,
                "color_uniformity": s.as7341_color_uniformity,
                "defects": s.as7341_defects or [],
            }
            for s in samples
        ],
        "total": len(samples),
        "skip": skip,
        "limit": limit
    }
