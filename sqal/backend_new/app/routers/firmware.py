"""
Firmware and OTA Updates API Router
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
import uuid
import hashlib

from app.core.database import AsyncSessionLocal
from app.models.firmware import FirmwareVersion, OTAUpdate, OTAUpdateLog

router = APIRouter(prefix="/api/firmware", tags=["Firmware"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/versions/")
async def get_firmware_versions(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get all firmware versions"""
    result = await db.execute(
        select(FirmwareVersion)
        .order_by(FirmwareVersion.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    versions = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(FirmwareVersion))
    total = count_result.scalar()

    return {
        "versions": [
            {
                "id": str(v.id),
                "version": v.version,
                "name": v.name,
                "description": v.description,
                "releaseNotes": v.release_notes,
                "fileSize": v.file_size,
                "fileHash": v.file_hash,
                "status": v.status,
                "isStable": v.is_stable,
                "compatibleDevices": v.compatible_devices,
                "releasedAt": v.released_at.isoformat() if v.released_at else None,
                "createdAt": v.created_at.isoformat() if v.created_at else None
            }
            for v in versions
        ],
        "total": total
    }


@router.get("/versions/{version_id}")
async def get_firmware_version(version_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific firmware version"""
    result = await db.execute(
        select(FirmwareVersion).where(FirmwareVersion.id == uuid.UUID(version_id))
    )
    version = result.scalar_one_or_none()

    if not version:
        raise HTTPException(status_code=404, detail="Firmware version not found")

    return {
        "id": str(version.id),
        "version": version.version,
        "major": version.major,
        "minor": version.minor,
        "patch": version.patch,
        "name": version.name,
        "description": version.description,
        "releaseNotes": version.release_notes,
        "filePath": version.file_path,
        "fileSize": version.file_size,
        "fileHash": version.file_hash,
        "status": version.status,
        "isStable": version.is_stable,
        "compatibleDevices": version.compatible_devices,
        "minRequiredVersion": version.min_required_version,
        "releasedAt": version.released_at.isoformat() if version.released_at else None,
        "createdAt": version.created_at.isoformat() if version.created_at else None
    }


@router.post("/versions/")
async def upload_firmware_version(
    version: str,
    name: str,
    description: Optional[str] = None,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload new firmware version"""
    # Read file content
    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()

    # Parse version (e.g., "1.2.3")
    parts = version.split(".")
    major = int(parts[0]) if len(parts) > 0 else 0
    minor = int(parts[1]) if len(parts) > 1 else 0
    patch = int(parts[2]) if len(parts) > 2 else 0

    # Save file (in production, save to storage)
    file_path = f"/firmware/{file.filename}"

    firmware = FirmwareVersion(
        version=version,
        major=major,
        minor=minor,
        patch=patch,
        name=name,
        description=description,
        file_path=file_path,
        file_size=len(content),
        file_hash=file_hash,
        status="draft"
    )

    db.add(firmware)
    await db.commit()
    await db.refresh(firmware)

    return {
        "id": str(firmware.id),
        "message": "Firmware version uploaded successfully"
    }


@router.delete("/versions/{version_id}")
async def delete_firmware_version(version_id: str, db: AsyncSession = Depends(get_db)):
    """Delete firmware version"""
    result = await db.execute(
        select(FirmwareVersion).where(FirmwareVersion.id == uuid.UUID(version_id))
    )
    version = result.scalar_one_or_none()

    if not version:
        raise HTTPException(status_code=404, detail="Firmware version not found")

    await db.delete(version)
    await db.commit()

    return {"message": "Firmware version deleted successfully"}


@router.get("/ota/")
async def get_ota_updates(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get all OTA updates"""
    result = await db.execute(
        select(OTAUpdate)
        .order_by(OTAUpdate.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    updates = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(OTAUpdate))
    total = count_result.scalar()

    return {
        "updates": [
            {
                "id": str(u.id),
                "name": u.name,
                "firmwareVersionId": str(u.firmware_version_id),
                "status": u.status,
                "totalDevices": u.total_devices,
                "devicesUpdated": u.devices_updated,
                "devicesFailed": u.devices_failed,
                "scheduledAt": u.scheduled_at.isoformat() if u.scheduled_at else None,
                "startedAt": u.started_at.isoformat() if u.started_at else None,
                "completedAt": u.completed_at.isoformat() if u.completed_at else None,
                "rolloutStrategy": u.rollout_strategy,
                "createdAt": u.created_at.isoformat() if u.created_at else None
            }
            for u in updates
        ],
        "total": total
    }


@router.get("/ota/{update_id}")
async def get_ota_update(update_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific OTA update"""
    result = await db.execute(
        select(OTAUpdate).where(OTAUpdate.id == uuid.UUID(update_id))
    )
    update = result.scalar_one_or_none()

    if not update:
        raise HTTPException(status_code=404, detail="OTA update not found")

    # Get update logs
    logs_result = await db.execute(
        select(OTAUpdateLog).where(OTAUpdateLog.ota_update_id == update.id)
    )
    logs = logs_result.scalars().all()

    return {
        "id": str(update.id),
        "name": update.name,
        "firmwareVersionId": str(update.firmware_version_id),
        "targetDevices": update.target_devices,
        "targetDeviceType": update.target_device_type,
        "status": update.status,
        "totalDevices": update.total_devices,
        "devicesUpdated": update.devices_updated,
        "devicesFailed": update.devices_failed,
        "rolloutStrategy": update.rollout_strategy,
        "rolloutPercentage": update.rollout_percentage,
        "notes": update.notes,
        "scheduledAt": update.scheduled_at.isoformat() if update.scheduled_at else None,
        "startedAt": update.started_at.isoformat() if update.started_at else None,
        "completedAt": update.completed_at.isoformat() if update.completed_at else None,
        "logs": [
            {
                "deviceId": log.device_id,
                "status": log.status,
                "downloadProgress": log.download_progress,
                "installProgress": log.install_progress,
                "previousVersion": log.previous_version,
                "targetVersion": log.target_version,
                "errorMessage": log.error_message
            }
            for log in logs
        ]
    }


@router.post("/ota/")
async def create_ota_update(data: dict, db: AsyncSession = Depends(get_db)):
    """Create OTA update campaign"""
    update = OTAUpdate(
        name=data.get("name"),
        firmware_version_id=uuid.UUID(data["firmwareVersionId"]),
        target_devices=data.get("targetDevices", []),
        target_device_type=data.get("targetDeviceType"),
        total_devices=len(data.get("targetDevices", [])),
        rollout_strategy=data.get("rolloutStrategy", "all_at_once"),
        rollout_percentage=data.get("rolloutPercentage", 100),
        notes=data.get("notes"),
        scheduled_at=datetime.fromisoformat(data["scheduledAt"]) if data.get("scheduledAt") else None,
        status="pending"
    )

    db.add(update)
    await db.commit()
    await db.refresh(update)

    # Create logs for each device
    for device_id in data.get("targetDevices", []):
        log = OTAUpdateLog(
            ota_update_id=update.id,
            device_id=device_id,
            target_version=data.get("targetVersion"),
            status="pending"
        )
        db.add(log)

    await db.commit()

    return {
        "id": str(update.id),
        "message": "OTA update created successfully"
    }


@router.post("/ota/{update_id}/cancel/")
async def cancel_ota_update(update_id: str, db: AsyncSession = Depends(get_db)):
    """Cancel OTA update"""
    result = await db.execute(
        select(OTAUpdate).where(OTAUpdate.id == uuid.UUID(update_id))
    )
    update = result.scalar_one_or_none()

    if not update:
        raise HTTPException(status_code=404, detail="OTA update not found")

    update.status = "cancelled"
    await db.commit()

    return {"message": "OTA update cancelled successfully"}
