"""
Admin API Router
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
import uuid

from app.core.database import AsyncSessionLocal
from app.models.user import User, Organization, AuditLog, Device

router = APIRouter(prefix="/api/admin", tags=["Admin"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# ============================================================================
# Users Management
# ============================================================================

@router.get("/users/")
async def get_users(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get all users"""
    result = await db.execute(
        select(User)
        .order_by(User.date_joined.desc())
        .offset(skip)
        .limit(limit)
    )
    users = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(User))
    total = count_result.scalar()

    active_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)
    )
    active = active_result.scalar()

    return {
        "users": [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "firstName": u.first_name,
                "lastName": u.last_name,
                "isActive": u.is_active,
                "isStaff": u.is_staff,
                "roles": u.roles,
                "lastLogin": u.last_login.isoformat() if u.last_login else None,
                "dateJoined": u.date_joined.isoformat() if u.date_joined else None
            }
            for u in users
        ],
        "total": total,
        "active": active
    }


@router.get("/users/{user_id}")
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific user"""
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "isActive": user.is_active,
        "isStaff": user.is_staff,
        "roles": user.roles,
        "organizationId": str(user.organization_id) if user.organization_id else None,
        "preferences": user.preferences,
        "lastLogin": user.last_login.isoformat() if user.last_login else None,
        "dateJoined": user.date_joined.isoformat() if user.date_joined else None
    }


@router.post("/users/")
async def create_user(data: dict, db: AsyncSession = Depends(get_db)):
    """Create user"""
    user = User(
        username=data.get("username"),
        email=data.get("email"),
        first_name=data.get("firstName"),
        last_name=data.get("lastName"),
        is_active=data.get("isActive", True),
        is_staff=data.get("isStaff", False),
        roles=data.get("roles", []),
        organization_id=uuid.UUID(data["organizationId"]) if data.get("organizationId") else None
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {"id": str(user.id), "message": "User created successfully"}


@router.patch("/users/{user_id}")
async def update_user(user_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Update user"""
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for key, value in data.items():
        if hasattr(user, key):
            setattr(user, key, value)

    await db.commit()
    return {"message": "User updated successfully"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """Delete user"""
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()

    return {"message": "User deleted successfully"}


# ============================================================================
# Devices Management
# ============================================================================

@router.get("/devices/")
async def get_devices(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get all devices"""
    result = await db.execute(
        select(Device)
        .order_by(Device.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    devices = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(Device))
    total = count_result.scalar()

    online_result = await db.execute(
        select(func.count()).select_from(Device).where(Device.status == "online")
    )
    online = online_result.scalar()

    offline_result = await db.execute(
        select(func.count()).select_from(Device).where(Device.status == "offline")
    )
    offline = offline_result.scalar()

    return {
        "devices": [
            {
                "id": str(d.id),
                "name": d.name,
                "type": d.type,
                "status": d.status,
                "firmware": d.firmware_version,
                "location": d.location,
                "lastSeen": d.last_seen.isoformat() if d.last_seen else None,
                "totalMeasurements": d.total_measurements,
                "ipAddress": d.ip_address
            }
            for d in devices
        ],
        "total": total,
        "online": online,
        "offline": offline
    }


@router.get("/devices/{device_id}")
async def get_device(device_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific device"""
    result = await db.execute(select(Device).where(Device.id == uuid.UUID(device_id)))
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
        "macAddress": device.mac_address,
        "totalMeasurements": device.total_measurements,
        "lastSeen": device.last_seen.isoformat() if device.last_seen else None,
        "createdAt": device.created_at.isoformat() if device.created_at else None
    }


@router.patch("/devices/{device_id}")
async def update_device(device_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Update device"""
    result = await db.execute(select(Device).where(Device.id == uuid.UUID(device_id)))
    device = result.scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    for key, value in data.items():
        if hasattr(device, key):
            setattr(device, key, value)

    await db.commit()
    return {"message": "Device updated successfully"}


@router.delete("/devices/{device_id}")
async def delete_device(device_id: str, db: AsyncSession = Depends(get_db)):
    """Delete device"""
    result = await db.execute(select(Device).where(Device.id == uuid.UUID(device_id)))
    device = result.scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    await db.delete(device)
    await db.commit()

    return {"message": "Device deleted successfully"}


# ============================================================================
# Audit Logs
# ============================================================================

@router.get("/audit/")
async def get_audit_logs(
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get audit logs"""
    query = select(AuditLog)

    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)

    query = query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(AuditLog))
    total = count_result.scalar()

    return {
        "logs": [
            {
                "id": str(log.id),
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "userId": str(log.user_id) if log.user_id else None,
                "userName": log.user_name,
                "action": log.action,
                "resourceType": log.resource_type,
                "resourceId": log.resource_id,
                "ipAddress": log.ip_address,
                "details": log.details
            }
            for log in logs
        ],
        "total": total
    }


# ============================================================================
# Settings
# ============================================================================

@router.get("/settings/")
async def get_settings():
    """Get system settings"""
    return {
        "systemName": "SQAL",
        "timezone": "UTC",
        "language": "fr",
        "maintenanceMode": False
    }


@router.patch("/settings/")
async def update_settings(data: dict):
    """Update system settings"""
    return {"message": "Settings updated successfully"}
