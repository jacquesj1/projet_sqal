"""
Reports API Router
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
import uuid

from app.core.database import AsyncSessionLocal
from app.models.report import Report, ScheduledReport, ReportTemplate

router = APIRouter(prefix="/api/reports", tags=["Reports"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/")
async def get_reports(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get all reports"""
    result = await db.execute(
        select(Report)
        .order_by(Report.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    reports = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(Report))
    total = count_result.scalar()

    return {
        "reports": [
            {
                "id": str(r.id),
                "title": r.title,
                "reportType": r.report_type,
                "format": r.format,
                "status": r.status,
                "fileUrl": r.file_url,
                "fileSize": r.file_size,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
                "completedAt": r.completed_at.isoformat() if r.completed_at else None
            }
            for r in reports
        ],
        "total": total
    }


@router.get("/{report_id}")
async def get_report(report_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific report"""
    result = await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return {
        "id": str(report.id),
        "title": report.title,
        "reportType": report.report_type,
        "format": report.format,
        "status": report.status,
        "fileUrl": report.file_url,
        "filePath": report.file_path,
        "fileSize": report.file_size,
        "parameters": report.parameters,
        "createdBy": report.created_by,
        "createdAt": report.created_at.isoformat() if report.created_at else None,
        "completedAt": report.completed_at.isoformat() if report.completed_at else None,
        "errorMessage": report.error_message
    }


@router.post("/")
async def create_report(data: dict, db: AsyncSession = Depends(get_db)):
    """Create new report"""
    report = Report(
        title=data.get("title"),
        report_type=data.get("reportType"),
        format=data.get("format", "pdf"),
        parameters=data.get("parameters", {}),
        created_by=data.get("createdBy"),
        status="pending"
    )

    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Simulate report generation
    # In production, this would trigger a background task
    report.status = "generating"
    await db.commit()

    return {
        "id": str(report.id),
        "message": "Report generation started"
    }


@router.delete("/{report_id}")
async def delete_report(report_id: str, db: AsyncSession = Depends(get_db)):
    """Delete report"""
    result = await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await db.delete(report)
    await db.commit()

    return {"message": "Report deleted successfully"}


# ============================================================================
# Scheduled Reports
# ============================================================================

@router.get("/scheduled/")
async def get_scheduled_reports(db: AsyncSession = Depends(get_db)):
    """Get scheduled reports"""
    result = await db.execute(
        select(ScheduledReport).order_by(ScheduledReport.created_at.desc())
    )
    reports = result.scalars().all()

    return {
        "scheduledReports": [
            {
                "id": str(r.id),
                "name": r.name,
                "reportConfig": r.report_config,
                "frequency": r.frequency,
                "enabled": r.enabled,
                "nextRun": r.next_run.isoformat() if r.next_run else None,
                "lastRun": r.last_run.isoformat() if r.last_run else None,
                "recipients": r.recipients,
                "createdAt": r.created_at.isoformat() if r.created_at else None
            }
            for r in reports
        ]
    }


@router.post("/scheduled/")
async def create_scheduled_report(data: dict, db: AsyncSession = Depends(get_db)):
    """Create scheduled report"""
    report = ScheduledReport(
        name=data.get("name"),
        report_config=data.get("reportConfig", {}),
        frequency=data.get("frequency"),
        enabled=data.get("enabled", True),
        recipients=data.get("recipients", []),
        created_by=data.get("createdBy")
    )

    db.add(report)
    await db.commit()
    await db.refresh(report)

    return {"id": str(report.id), "message": "Scheduled report created"}


@router.patch("/scheduled/{report_id}")
async def update_scheduled_report(
    report_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update scheduled report"""
    result = await db.execute(
        select(ScheduledReport).where(ScheduledReport.id == uuid.UUID(report_id))
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Scheduled report not found")

    for key, value in data.items():
        if hasattr(report, key):
            setattr(report, key, value)

    await db.commit()
    return {"message": "Scheduled report updated"}


@router.delete("/scheduled/{report_id}")
async def delete_scheduled_report(report_id: str, db: AsyncSession = Depends(get_db)):
    """Delete scheduled report"""
    result = await db.execute(
        select(ScheduledReport).where(ScheduledReport.id == uuid.UUID(report_id))
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Scheduled report not found")

    await db.delete(report)
    await db.commit()

    return {"message": "Scheduled report deleted"}


# ============================================================================
# Report Templates
# ============================================================================

@router.get("/templates/")
async def get_templates(db: AsyncSession = Depends(get_db)):
    """Get report templates"""
    result = await db.execute(
        select(ReportTemplate)
        .where(ReportTemplate.is_active == True)
        .order_by(ReportTemplate.created_at.desc())
    )
    templates = result.scalars().all()

    return {
        "templates": [
            {
                "id": str(t.id),
                "name": t.name,
                "description": t.description,
                "reportType": t.report_type,
                "isDefault": t.is_default,
                "createdAt": t.created_at.isoformat() if t.created_at else None
            }
            for t in templates
        ]
    }


@router.post("/templates/")
async def create_template(data: dict, db: AsyncSession = Depends(get_db)):
    """Create report template"""
    template = ReportTemplate(
        name=data.get("name"),
        description=data.get("description"),
        report_type=data.get("reportType"),
        template_content=data.get("templateContent", {}),
        styles=data.get("styles", {}),
        is_default=data.get("isDefault", False),
        created_by=data.get("createdBy")
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return {"id": str(template.id), "message": "Template created"}
