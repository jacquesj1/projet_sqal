"""
Organizations API Router
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
import uuid

from app.core.database import AsyncSessionLocal
from app.models.user import Organization

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/")
async def get_organizations(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get all organizations"""
    result = await db.execute(
        select(Organization)
        .order_by(Organization.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    organizations = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(Organization))
    total = count_result.scalar()

    return {
        "organizations": [
            {
                "id": str(org.id),
                "name": org.name,
                "description": org.description,
                "contactEmail": org.contact_email,
                "contactPhone": org.contact_phone,
                "isActive": org.is_active,
                "createdAt": org.created_at.isoformat() if org.created_at else None
            }
            for org in organizations
        ],
        "total": total
    }


@router.get("/{org_id}")
async def get_organization(org_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific organization"""
    result = await db.execute(
        select(Organization).where(Organization.id == uuid.UUID(org_id))
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {
        "id": str(org.id),
        "name": org.name,
        "description": org.description,
        "address": org.address,
        "contactEmail": org.contact_email,
        "contactPhone": org.contact_phone,
        "settings": org.settings,
        "isActive": org.is_active,
        "createdAt": org.created_at.isoformat() if org.created_at else None,
        "updatedAt": org.updated_at.isoformat() if org.updated_at else None
    }


@router.post("/")
async def create_organization(data: dict, db: AsyncSession = Depends(get_db)):
    """Create organization"""
    org = Organization(
        name=data.get("name"),
        description=data.get("description"),
        address=data.get("address"),
        contact_email=data.get("contactEmail"),
        contact_phone=data.get("contactPhone"),
        settings=data.get("settings", {}),
        is_active=data.get("isActive", True)
    )

    db.add(org)
    await db.commit()
    await db.refresh(org)

    return {
        "id": str(org.id),
        "message": "Organization created successfully"
    }


@router.patch("/{org_id}")
async def update_organization(
    org_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update organization"""
    result = await db.execute(
        select(Organization).where(Organization.id == uuid.UUID(org_id))
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    for key, value in data.items():
        if hasattr(org, key):
            setattr(org, key, value)

    await db.commit()
    return {"message": "Organization updated successfully"}


@router.delete("/{org_id}")
async def delete_organization(org_id: str, db: AsyncSession = Depends(get_db)):
    """Delete organization"""
    result = await db.execute(
        select(Organization).where(Organization.id == uuid.UUID(org_id))
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    await db.delete(org)
    await db.commit()

    return {"message": "Organization deleted successfully"}
