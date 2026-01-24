"""
Bug Tracking API Router
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
import uuid

from app.core.database import AsyncSessionLocal
from app.models.bug_tracking import BugReport, BugComment, BugMetrics

router = APIRouter(prefix="/api/bugs", tags=["Bug Tracking"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/")
async def get_bugs(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get bug reports"""
    query = select(BugReport)

    if status:
        query = query.where(BugReport.status == status)
    if severity:
        query = query.where(BugReport.severity == severity)

    query = query.order_by(BugReport.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    bugs = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(BugReport))
    total = count_result.scalar()

    return {
        "bugs": [
            {
                "id": str(b.id),
                "title": b.title,
                "description": b.description,
                "severity": b.severity,
                "priority": b.priority,
                "category": b.category,
                "status": b.status,
                "deviceId": b.device_id,
                "firmwareVersion": b.firmware_version,
                "reportedBy": b.reported_by,
                "assignedTo": b.assigned_to,
                "tags": b.tags,
                "createdAt": b.created_at.isoformat() if b.created_at else None,
                "updatedAt": b.updated_at.isoformat() if b.updated_at else None,
                "resolvedAt": b.resolved_at.isoformat() if b.resolved_at else None
            }
            for b in bugs
        ],
        "total": total
    }


@router.get("/{bug_id}")
async def get_bug(bug_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific bug report"""
    result = await db.execute(
        select(BugReport).where(BugReport.id == uuid.UUID(bug_id))
    )
    bug = result.scalar_one_or_none()

    if not bug:
        raise HTTPException(status_code=404, detail="Bug report not found")

    # Get comments
    comments_result = await db.execute(
        select(BugComment)
        .where(BugComment.bug_report_id == bug.id)
        .order_by(BugComment.created_at.asc())
    )
    comments = comments_result.scalars().all()

    return {
        "id": str(bug.id),
        "title": bug.title,
        "description": bug.description,
        "severity": bug.severity,
        "priority": bug.priority,
        "category": bug.category,
        "status": bug.status,
        "deviceId": bug.device_id,
        "firmwareVersion": bug.firmware_version,
        "sampleId": bug.sample_id,
        "reportedBy": bug.reported_by,
        "reportedByEmail": bug.reported_by_email,
        "assignedTo": bug.assigned_to,
        "assignedAt": bug.assigned_at.isoformat() if bug.assigned_at else None,
        "resolution": bug.resolution,
        "resolvedAt": bug.resolved_at.isoformat() if bug.resolved_at else None,
        "resolvedBy": bug.resolved_by,
        "attachments": bug.attachments,
        "errorLogs": bug.error_logs,
        "reproductionSteps": bug.reproduction_steps,
        "tags": bug.tags,
        "relatedIssues": bug.related_issues,
        "createdAt": bug.created_at.isoformat() if bug.created_at else None,
        "updatedAt": bug.updated_at.isoformat() if bug.updated_at else None,
        "comments": [
            {
                "id": str(c.id),
                "comment": c.comment,
                "author": c.author,
                "isInternal": c.is_internal,
                "createdAt": c.created_at.isoformat() if c.created_at else None
            }
            for c in comments
        ]
    }


@router.post("/")
async def create_bug(data: dict, db: AsyncSession = Depends(get_db)):
    """Create bug report"""
    bug = BugReport(
        title=data.get("title"),
        description=data.get("description"),
        severity=data.get("severity", "medium"),
        priority=data.get("priority", "medium"),
        category=data.get("category"),
        device_id=data.get("deviceId"),
        firmware_version=data.get("firmwareVersion"),
        sample_id=data.get("sampleId"),
        reported_by=data.get("reportedBy"),
        reported_by_email=data.get("reportedByEmail"),
        reproduction_steps=data.get("reproductionSteps"),
        tags=data.get("tags", []),
        status="open"
    )

    db.add(bug)
    await db.commit()
    await db.refresh(bug)

    return {
        "id": str(bug.id),
        "message": "Bug report created successfully"
    }


@router.patch("/{bug_id}")
async def update_bug(bug_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Update bug report"""
    result = await db.execute(
        select(BugReport).where(BugReport.id == uuid.UUID(bug_id))
    )
    bug = result.scalar_one_or_none()

    if not bug:
        raise HTTPException(status_code=404, detail="Bug report not found")

    for key, value in data.items():
        if hasattr(bug, key):
            setattr(bug, key, value)

    await db.commit()

    return {"message": "Bug report updated successfully"}


@router.post("/{bug_id}/comments/")
async def add_bug_comment(bug_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Add comment to bug report"""
    result = await db.execute(
        select(BugReport).where(BugReport.id == uuid.UUID(bug_id))
    )
    bug = result.scalar_one_or_none()

    if not bug:
        raise HTTPException(status_code=404, detail="Bug report not found")

    comment = BugComment(
        bug_report_id=bug.id,
        comment=data.get("comment"),
        author=data.get("author"),
        author_email=data.get("authorEmail"),
        is_internal=data.get("isInternal", "false"),
        attachments=data.get("attachments", [])
    )

    db.add(comment)
    await db.commit()

    return {"message": "Comment added successfully"}


@router.get("/metrics/summary/")
async def get_bug_metrics(db: AsyncSession = Depends(get_db)):
    """Get bug tracking metrics"""
    # Count by status
    total_result = await db.execute(select(func.count()).select_from(BugReport))
    total = total_result.scalar()

    open_result = await db.execute(
        select(func.count()).select_from(BugReport).where(BugReport.status == "open")
    )
    open_count = open_result.scalar()

    in_progress_result = await db.execute(
        select(func.count()).select_from(BugReport).where(BugReport.status == "in_progress")
    )
    in_progress_count = in_progress_result.scalar()

    resolved_result = await db.execute(
        select(func.count()).select_from(BugReport).where(BugReport.status == "resolved")
    )
    resolved_count = resolved_result.scalar()

    # Count by severity
    critical_result = await db.execute(
        select(func.count()).select_from(BugReport).where(BugReport.severity == "critical")
    )
    critical_count = critical_result.scalar()

    return {
        "totalBugs": total,
        "openBugs": open_count,
        "inProgressBugs": in_progress_count,
        "resolvedBugs": resolved_count,
        "criticalBugs": critical_count,
        "avgResolutionTimeHours": 48
    }
