# ============================================================================
# SQAL Backend - Sensor Analysis API Endpoints
# REST API endpoints for retrieving historical sensor analysis data
# ============================================================================

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.sensor_data import SensorSample
from app.schemas.sensor_data import (
    VL53L8CHAnalysis,
    AS7341Analysis,
    FusionResult,
    SensorMetadata
)
from app.core.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


# ============================================================================
# VL53L8CH (ToF) Analysis Endpoints
# ============================================================================

@router.get("/vl53l8ch/analysis/")
async def get_vl53l8ch_analysis(
    limit: int = Query(50, ge=1, le=1000, description="Number of records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    min_score: Optional[float] = Query(None, ge=0, le=1, description="Minimum quality score"),
    grade: Optional[str] = Query(None, description="Filter by grade (A+, A, B, C, REJECT)"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get historical VL53L8CH (Time-of-Flight) analysis data
    
    Returns a list of VL53L8CH sensor analyses with optional filtering
    """
    try:
        # Build query
        query = select(SensorSample).order_by(desc(SensorSample.timestamp))
        
        # Apply filters
        if device_id:
            query = query.where(SensorSample.device_id == device_id)
        if start_date:
            query = query.where(SensorSample.timestamp >= start_date)
        if end_date:
            query = query.where(SensorSample.timestamp <= end_date)
        if min_score is not None:
            query = query.where(SensorSample.vl53l8ch_quality_score >= min_score)
        if grade:
            query = query.where(SensorSample.vl53l8ch_grade == grade)
        
        # Apply pagination
        query = query.limit(limit).offset(offset)
        
        # Execute query
        result = await db.execute(query)
        samples = result.scalars().all()
        
        # Format response
        analyses = []
        for sample in samples:
            analysis = {
                "sample_id": sample.sample_id,
                "device_id": sample.device_id,
                "timestamp": sample.timestamp.isoformat(),
                "grade": sample.vl53l8ch_grade,
                "quality_score": sample.vl53l8ch_quality_score,
                "volume_mm3": sample.vl53l8ch_volume_mm3,
                "average_height_mm": sample.vl53l8ch_avg_height_mm,
                "max_height_mm": sample.vl53l8ch_max_height_mm,
                "min_height_mm": sample.vl53l8ch_min_height_mm,
                "surface_uniformity": sample.vl53l8ch_surface_uniformity,
                "defects_count": len(sample.vl53l8ch_defects) if sample.vl53l8ch_defects else 0,
            }
            analyses.append(analysis)
        
        return {
            "total": len(analyses),
            "limit": limit,
            "offset": offset,
            "data": analyses
        }
        
    except Exception as e:
        logger.error(f"Error fetching VL53L8CH analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch VL53L8CH analysis: {str(e)}")


# ============================================================================
# AS7341 (Spectral) Analysis Endpoints
# ============================================================================

@router.get("/as7341/analysis/")
async def get_as7341_analysis(
    limit: int = Query(50, ge=1, le=1000, description="Number of records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    min_score: Optional[float] = Query(None, ge=0, le=1, description="Minimum quality score"),
    grade: Optional[str] = Query(None, description="Filter by grade (A+, A, B, C, REJECT)"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get historical AS7341 (Spectral) analysis data
    
    Returns a list of AS7341 sensor analyses with optional filtering
    """
    try:
        # Build query
        query = select(SensorSample).order_by(desc(SensorSample.timestamp))
        
        # Apply filters
        if device_id:
            query = query.where(SensorSample.device_id == device_id)
        if start_date:
            query = query.where(SensorSample.timestamp >= start_date)
        if end_date:
            query = query.where(SensorSample.timestamp <= end_date)
        if min_score is not None:
            query = query.where(SensorSample.as7341_quality_score >= min_score)
        if grade:
            query = query.where(SensorSample.as7341_grade == grade)
        
        # Apply pagination
        query = query.limit(limit).offset(offset)
        
        # Execute query
        result = await db.execute(query)
        samples = result.scalars().all()
        
        # Format response
        analyses = []
        for sample in samples:
            analysis = {
                "sample_id": sample.sample_id,
                "device_id": sample.device_id,
                "timestamp": sample.timestamp.isoformat(),
                "grade": sample.as7341_grade,
                "quality_score": sample.as7341_quality_score,
                "freshness_index": sample.as7341_freshness_index,
                "fat_quality_index": sample.as7341_fat_quality_index,
                "oxidation_index": sample.as7341_oxidation_index,
                "color_uniformity": sample.as7341_color_uniformity,
                "defects_count": len(sample.as7341_defects) if sample.as7341_defects else 0,
            }
            analyses.append(analysis)
        
        return {
            "total": len(analyses),
            "limit": limit,
            "offset": offset,
            "data": analyses
        }
        
    except Exception as e:
        logger.error(f"Error fetching AS7341 analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch AS7341 analysis: {str(e)}")


# ============================================================================
# Fusion Analysis Endpoints
# ============================================================================

@router.get("/fusion/analysis/")
async def get_fusion_analysis(
    limit: int = Query(50, ge=1, le=1000, description="Number of records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    min_score: Optional[float] = Query(None, ge=0, le=1, description="Minimum final score"),
    grade: Optional[str] = Query(None, description="Filter by final grade (A+, A, B, C, REJECT)"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get historical fusion analysis data (combined VL53L8CH + AS7341)
    
    Returns a list of fusion analyses with optional filtering
    """
    try:
        # Build query
        query = select(SensorSample).order_by(desc(SensorSample.timestamp))
        
        # Apply filters
        if device_id:
            query = query.where(SensorSample.device_id == device_id)
        if start_date:
            query = query.where(SensorSample.timestamp >= start_date)
        if end_date:
            query = query.where(SensorSample.timestamp <= end_date)
        if min_score is not None:
            query = query.where(SensorSample.fusion_final_score >= min_score)
        if grade:
            query = query.where(SensorSample.fusion_final_grade == grade)
        
        # Apply pagination
        query = query.limit(limit).offset(offset)
        
        # Execute query
        result = await db.execute(query)
        samples = result.scalars().all()
        
        # Format response
        analyses = []
        for sample in samples:
            analysis = {
                "sample_id": sample.sample_id,
                "device_id": sample.device_id,
                "timestamp": sample.timestamp.isoformat(),
                "final_grade": sample.fusion_final_grade,
                "final_score": sample.fusion_final_score,
                "vl53l8ch_score": sample.vl53l8ch_quality_score,
                "as7341_score": sample.as7341_quality_score,
                "vl53l8ch_grade": sample.vl53l8ch_grade,
                "as7341_grade": sample.as7341_grade,
                "total_defects": sample.fusion_total_defects,
            }
            analyses.append(analysis)
        
        return {
            "total": len(analyses),
            "limit": limit,
            "offset": offset,
            "data": analyses
        }
        
    except Exception as e:
        logger.error(f"Error fetching fusion analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch fusion analysis: {str(e)}")


# ============================================================================
# Sample Detail Endpoint
# ============================================================================

@router.get("/samples/{sample_id}")
async def get_sample_detail(
    sample_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed information for a specific sample
    
    Returns complete sensor data including VL53L8CH, AS7341, fusion, and metadata
    """
    try:
        # Query sample
        query = select(SensorSample).where(SensorSample.sample_id == sample_id)
        result = await db.execute(query)
        sample = result.scalar_one_or_none()
        
        if not sample:
            raise HTTPException(status_code=404, detail=f"Sample {sample_id} not found")
        
        # Format complete response
        return {
            "sample_id": sample.sample_id,
            "device_id": sample.device_id,
            "timestamp": sample.timestamp.isoformat(),
            "vl53l8ch": {
                "grade": sample.vl53l8ch_grade,
                "quality_score": sample.vl53l8ch_quality_score,
                "volume_mm3": sample.vl53l8ch_volume_mm3,
                "average_height_mm": sample.vl53l8ch_avg_height_mm,
                "max_height_mm": sample.vl53l8ch_max_height_mm,
                "min_height_mm": sample.vl53l8ch_min_height_mm,
                "surface_uniformity": sample.vl53l8ch_surface_uniformity,
                "defects": sample.vl53l8ch_defects,
            },
            "as7341": {
                "grade": sample.as7341_grade,
                "quality_score": sample.as7341_quality_score,
                "freshness_index": sample.as7341_freshness_index,
                "fat_quality_index": sample.as7341_fat_quality_index,
                "oxidation_index": sample.as7341_oxidation_index,
                "color_uniformity": sample.as7341_color_uniformity,
                "defects": sample.as7341_defects,
            },
            "fusion": {
                "final_grade": sample.fusion_final_grade,
                "final_score": sample.fusion_final_score,
                "total_defects": sample.fusion_total_defects,
            },
            "metadata": {
                "firmware_version": sample.firmware_version,
                "temperature_c": sample.temperature_c,
                "humidity_percent": sample.humidity_percent,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sample detail: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch sample detail: {str(e)}")
