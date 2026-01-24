"""
Blockchain & Traceability API Router
Endpoints for blockchain certification and QR code generation
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

from app.core.database import AsyncSessionLocal
from app.models.sensor import SensorSample
from app.core.blockchain import (
    certify_quality_analysis,
    verify_blockchain_hash,
    generate_qr_code
)

router = APIRouter(prefix="/api/blockchain", tags=["Blockchain"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# ============================================================================
# Request/Response Schemas
# ============================================================================

class CertificationRequest(BaseModel):
    """Request body for blockchain certification"""
    sample_id: str = Field(..., description="Sample ID to certify")
    lot_abattage: Optional[str] = Field(None, description="Slaughter batch number")
    eleveur: Optional[str] = Field(None, description="Farmer name")
    provenance: Optional[str] = Field(None, description="Origin location")
    generate_qr: bool = Field(True, description="Generate QR code")


class CertificationResponse(BaseModel):
    """Response after blockchain certification"""
    sample_id: str
    blockchain_hash: str
    blockchain_timestamp: str
    qr_code_base64: Optional[str] = None
    lot_abattage: Optional[str] = None
    eleveur: Optional[str] = None
    provenance: Optional[str] = None
    status: str
    message: str


class VerificationRequest(BaseModel):
    """Request body for blockchain verification"""
    blockchain_hash: str = Field(..., description="Hash to verify")


class VerificationResponse(BaseModel):
    """Response after verification"""
    blockchain_hash: str
    is_valid: bool
    sample_id: Optional[str] = None
    fusion_final_grade: Optional[str] = None
    fusion_final_score: Optional[float] = None
    timestamp: Optional[str] = None
    message: str


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/certify", response_model=CertificationResponse)
async def certify_sample(
    request: CertificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Certify a sample with blockchain hash and generate QR code

    This endpoint:
    1. Retrieves the sample from the database
    2. Generates a blockchain hash
    3. Generates a QR code (optional)
    4. Updates the sample with blockchain data
    5. Returns the certification

    **Use case**: Manual certification of existing samples
    """
    # Find the sample
    result = await db.execute(
        select(SensorSample).where(SensorSample.sample_id == request.sample_id)
    )
    sample = result.scalar_one_or_none()

    if not sample:
        raise HTTPException(
            status_code=404,
            detail=f"Sample not found: {request.sample_id}"
        )

    # Check if already certified
    if sample.blockchain_hash:
        return CertificationResponse(
            sample_id=sample.sample_id,
            blockchain_hash=sample.blockchain_hash,
            blockchain_timestamp=sample.blockchain_timestamp.isoformat(),
            qr_code_base64=sample.qr_code_base64,
            lot_abattage=sample.lot_abattage,
            eleveur=sample.eleveur,
            provenance=sample.provenance,
            status="already_certified",
            message="Sample already certified"
        )

    # Generate blockchain certification
    try:
        blockchain_cert = certify_quality_analysis(
            sample_id=sample.sample_id,
            device_id=sample.device_id,
            vl53l8ch_score=sample.vl53l8ch_quality_score or 0.0,
            as7341_score=sample.as7341_quality_score or 0.0,
            fusion_final_score=sample.fusion_final_score,
            fusion_final_grade=sample.fusion_final_grade,
            defects=sample.fusion_defects or [],
            lot_abattage=request.lot_abattage,
            eleveur=request.eleveur,
            provenance=request.provenance,
            generate_qr=request.generate_qr
        )

        # Update sample
        sample.blockchain_hash = blockchain_cert["blockchain_hash"]
        sample.blockchain_timestamp = datetime.utcnow()
        sample.qr_code_base64 = blockchain_cert.get("qr_code_base64")
        sample.lot_abattage = request.lot_abattage
        sample.eleveur = request.eleveur
        sample.provenance = request.provenance

        await db.commit()
        await db.refresh(sample)

        return CertificationResponse(
            sample_id=sample.sample_id,
            blockchain_hash=sample.blockchain_hash,
            blockchain_timestamp=sample.blockchain_timestamp.isoformat(),
            qr_code_base64=sample.qr_code_base64,
            lot_abattage=sample.lot_abattage,
            eleveur=sample.eleveur,
            provenance=sample.provenance,
            status="certified",
            message="Sample successfully certified on blockchain"
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Certification failed: {str(e)}"
        )


@router.post("/verify", response_model=VerificationResponse)
async def verify_hash(
    request: VerificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify a blockchain hash

    This endpoint:
    1. Searches for the hash in the database
    2. Verifies hash integrity
    3. Returns sample information if found

    **Use case**: QR code scanning and verification
    """
    # Find sample by blockchain hash
    result = await db.execute(
        select(SensorSample).where(SensorSample.blockchain_hash == request.blockchain_hash)
    )
    sample = result.scalar_one_or_none()

    if not sample:
        return VerificationResponse(
            blockchain_hash=request.blockchain_hash,
            is_valid=False,
            message="Hash not found in database"
        )

    # Verify hash integrity
    quality_data = {
        "timestamp": sample.timestamp.isoformat() if sample.timestamp else None,
        "sample_id": sample.sample_id,
        "device_id": sample.device_id,
        "lot_abattage": sample.lot_abattage,
        "eleveur": sample.eleveur,
        "provenance": sample.provenance,
        "vl53l8ch_score": sample.vl53l8ch_quality_score,
        "as7341_score": sample.as7341_quality_score,
        "fusion_final_score": sample.fusion_final_score,
        "fusion_final_grade": sample.fusion_final_grade,
        "defects": sample.fusion_defects or []
    }

    is_valid = verify_blockchain_hash(request.blockchain_hash, quality_data)

    return VerificationResponse(
        blockchain_hash=sample.blockchain_hash,
        is_valid=is_valid,
        sample_id=sample.sample_id,
        fusion_final_grade=sample.fusion_final_grade,
        fusion_final_score=sample.fusion_final_score,
        timestamp=sample.timestamp.isoformat() if sample.timestamp else None,
        message="Hash verified successfully" if is_valid else "Hash verification failed - data may have been tampered"
    )


@router.get("/sample/{sample_id}")
async def get_blockchain_info(
    sample_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get blockchain information for a sample

    Returns:
    - blockchain_hash
    - blockchain_timestamp
    - qr_code_base64
    - traceability info (lot, eleveur, provenance)
    """
    result = await db.execute(
        select(SensorSample).where(SensorSample.sample_id == sample_id)
    )
    sample = result.scalar_one_or_none()

    if not sample:
        raise HTTPException(
            status_code=404,
            detail=f"Sample not found: {sample_id}"
        )

    if not sample.blockchain_hash:
        raise HTTPException(
            status_code=404,
            detail=f"Sample not certified: {sample_id}"
        )

    return {
        "sample_id": sample.sample_id,
        "blockchain_hash": sample.blockchain_hash,
        "blockchain_timestamp": sample.blockchain_timestamp.isoformat() if sample.blockchain_timestamp else None,
        "qr_code_base64": sample.qr_code_base64,
        "lot_abattage": sample.lot_abattage,
        "eleveur": sample.eleveur,
        "provenance": sample.provenance,
        "fusion_final_grade": sample.fusion_final_grade,
        "fusion_final_score": sample.fusion_final_score,
        "timestamp": sample.timestamp.isoformat() if sample.timestamp else None
    }


@router.get("/qr/{sample_id}")
async def get_qr_code(
    sample_id: str,
    size: int = 256,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate/retrieve QR code for a sample

    Query Parameters:
    - size: QR code size in pixels (default: 256)

    Returns:
    - QR code as base64-encoded PNG
    """
    result = await db.execute(
        select(SensorSample).where(SensorSample.sample_id == sample_id)
    )
    sample = result.scalar_one_or_none()

    if not sample:
        raise HTTPException(
            status_code=404,
            detail=f"Sample not found: {sample_id}"
        )

    if not sample.blockchain_hash:
        raise HTTPException(
            status_code=404,
            detail=f"Sample not certified: {sample_id}"
        )

    # Return cached QR code if available
    if sample.qr_code_base64:
        return {
            "sample_id": sample.sample_id,
            "blockchain_hash": sample.blockchain_hash,
            "qr_code_base64": sample.qr_code_base64,
            "size": 256  # Default size when cached
        }

    # Generate new QR code
    try:
        qr_code_base64 = generate_qr_code(sample.blockchain_hash, size=size)

        # Cache it
        sample.qr_code_base64 = qr_code_base64
        await db.commit()

        return {
            "sample_id": sample.sample_id,
            "blockchain_hash": sample.blockchain_hash,
            "qr_code_base64": qr_code_base64,
            "size": size
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"QR code generation failed: {str(e)}"
        )


@router.get("/stats")
async def get_blockchain_stats(db: AsyncSession = Depends(get_db)):
    """
    Get blockchain certification statistics

    Returns:
    - Total samples
    - Certified samples
    - Certification rate
    - Recent certifications
    """
    from sqlalchemy import func

    # Total samples
    total_result = await db.execute(select(func.count()).select_from(SensorSample))
    total = total_result.scalar()

    # Certified samples
    certified_result = await db.execute(
        select(func.count()).select_from(SensorSample).where(SensorSample.blockchain_hash.isnot(None))
    )
    certified = certified_result.scalar()

    # Recent certifications (last 10)
    recent_result = await db.execute(
        select(SensorSample)
        .where(SensorSample.blockchain_hash.isnot(None))
        .order_by(SensorSample.blockchain_timestamp.desc())
        .limit(10)
    )
    recent_samples = recent_result.scalars().all()

    return {
        "total_samples": total,
        "certified_samples": certified,
        "certification_rate": round((certified / total * 100), 2) if total > 0 else 0,
        "recent_certifications": [
            {
                "sample_id": s.sample_id,
                "blockchain_hash": s.blockchain_hash[:16] + "...",
                "grade": s.fusion_final_grade,
                "timestamp": s.blockchain_timestamp.isoformat() if s.blockchain_timestamp else None
            }
            for s in recent_samples
        ]
    }
