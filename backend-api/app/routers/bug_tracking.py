"""
Bug Tracking API Router
Production-ready issue tracking for devices, firmware, sensors, and quality issues
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/bugs", tags=["Bug Tracking 🐛"])


# Pydantic schemas
class BugReportCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=300)
    description: str = Field(..., min_length=10)
    severity: str = Field(..., pattern="^(critical|high|medium|low)$")
    priority: str = Field(..., pattern="^(urgent|high|medium|low)$")
    category: Optional[str] = Field(None, max_length=100)
    device_id: Optional[str] = None
    firmware_version: Optional[str] = None
    sample_id: Optional[str] = None
    reported_by: Optional[str] = None
    reported_by_email: Optional[str] = None
    reproduction_steps: Optional[str] = None
    tags: Optional[List[str]] = []


class BugReportUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    tags: Optional[List[str]] = None


class BugCommentCreate(BaseModel):
    comment: str = Field(..., min_length=1)
    author: str
    author_email: Optional[str] = None
    is_internal: bool = False
    attachments: Optional[List[str]] = []


@router.get("/")
async def get_bugs(
    request: Request,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    """
    Get list of bug reports with optional filtering

    Query parameters:
    - status: open, in_progress, resolved, closed, wont_fix
    - severity: critical, high, medium, low
    - category: hardware, firmware, backend, frontend, sensor, quality, ml
    - assigned_to: assignee name
    - skip: pagination offset
    - limit: max results (default 50, max 200)
    """
    pool = request.app.state.db_pool

    # Build dynamic query
    where_clauses = []
    params = []
    param_count = 1

    if status:
        where_clauses.append(f"status = ${param_count}")
        params.append(status)
        param_count += 1

    if severity:
        where_clauses.append(f"severity = ${param_count}")
        params.append(severity)
        param_count += 1

    if category:
        where_clauses.append(f"category = ${param_count}")
        params.append(category)
        param_count += 1

    if assigned_to:
        where_clauses.append(f"assigned_to = ${param_count}")
        params.append(assigned_to)
        param_count += 1

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Limit validation
    limit = min(limit, 200)

    async with pool.acquire() as conn:
        # Get total count
        count_query = f"SELECT COUNT(*) FROM bug_reports {where_sql}"
        total = await conn.fetchval(count_query, *params)

        # Get bugs
        query = f"""
            SELECT
                id, title, description, severity, priority, category, status,
                device_id, firmware_version, sample_id,
                reported_by, reported_by_email, assigned_to, assigned_at,
                resolution, resolved_at, resolved_by,
                tags, related_issues,
                created_at, updated_at
            FROM bug_reports
            {where_sql}
            ORDER BY created_at DESC
            LIMIT ${param_count} OFFSET ${param_count + 1}
        """
        params.extend([limit, skip])

        rows = await conn.fetch(query, *params)

        bugs = [
            {
                "id": str(row["id"]),
                "title": row["title"],
                "description": row["description"],
                "severity": row["severity"],
                "priority": row["priority"],
                "category": row["category"],
                "status": row["status"],
                "deviceId": row["device_id"],
                "firmwareVersion": row["firmware_version"],
                "sampleId": row["sample_id"],
                "reportedBy": row["reported_by"],
                "reportedByEmail": row["reported_by_email"],
                "assignedTo": row["assigned_to"],
                "assignedAt": row["assigned_at"].isoformat() if row["assigned_at"] else None,
                "resolution": row["resolution"],
                "resolvedAt": row["resolved_at"].isoformat() if row["resolved_at"] else None,
                "resolvedBy": row["resolved_by"],
                "tags": row["tags"] or [],
                "relatedIssues": row["related_issues"] or [],
                "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
                "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else None,
            }
            for row in rows
        ]

        return {
            "bugs": bugs,
            "total": total,
            "skip": skip,
            "limit": limit
        }


@router.get("/{bug_id}")
async def get_bug(request: Request, bug_id: str):
    """Get specific bug report with all details including comments"""
    pool = request.app.state.db_pool

    try:
        bug_uuid = uuid.UUID(bug_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bug ID format")

    async with pool.acquire() as conn:
        # Get bug report
        bug_row = await conn.fetchrow("""
            SELECT
                id, title, description, severity, priority, category, status,
                device_id, firmware_version, sample_id,
                reported_by, reported_by_email, assigned_to, assigned_at,
                resolution, resolved_at, resolved_by,
                attachments, error_logs, reproduction_steps,
                tags, related_issues,
                created_at, updated_at
            FROM bug_reports
            WHERE id = $1
        """, bug_uuid)

        if not bug_row:
            raise HTTPException(status_code=404, detail="Bug report not found")

        # Get comments
        comments_rows = await conn.fetch("""
            SELECT
                id, comment, author, author_email, is_internal,
                attachments, created_at, updated_at
            FROM bug_comments
            WHERE bug_report_id = $1
            ORDER BY created_at ASC
        """, bug_uuid)

        return {
            "id": str(bug_row["id"]),
            "title": bug_row["title"],
            "description": bug_row["description"],
            "severity": bug_row["severity"],
            "priority": bug_row["priority"],
            "category": bug_row["category"],
            "status": bug_row["status"],
            "deviceId": bug_row["device_id"],
            "firmwareVersion": bug_row["firmware_version"],
            "sampleId": bug_row["sample_id"],
            "reportedBy": bug_row["reported_by"],
            "reportedByEmail": bug_row["reported_by_email"],
            "assignedTo": bug_row["assigned_to"],
            "assignedAt": bug_row["assigned_at"].isoformat() if bug_row["assigned_at"] else None,
            "resolution": bug_row["resolution"],
            "resolvedAt": bug_row["resolved_at"].isoformat() if bug_row["resolved_at"] else None,
            "resolvedBy": bug_row["resolved_by"],
            "attachments": bug_row["attachments"] or [],
            "errorLogs": bug_row["error_logs"] or [],
            "reproductionSteps": bug_row["reproduction_steps"],
            "tags": bug_row["tags"] or [],
            "relatedIssues": bug_row["related_issues"] or [],
            "createdAt": bug_row["created_at"].isoformat() if bug_row["created_at"] else None,
            "updatedAt": bug_row["updated_at"].isoformat() if bug_row["updated_at"] else None,
            "comments": [
                {
                    "id": str(row["id"]),
                    "comment": row["comment"],
                    "author": row["author"],
                    "authorEmail": row["author_email"],
                    "isInternal": row["is_internal"],
                    "attachments": row["attachments"] or [],
                    "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
                    "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else None,
                }
                for row in comments_rows
            ]
        }


@router.post("/", status_code=201)
async def create_bug(request: Request, data: BugReportCreate):
    """Create new bug report"""
    pool = request.app.state.db_pool

    async with pool.acquire() as conn:
        bug_id = await conn.fetchval("""
            INSERT INTO bug_reports (
                title, description, severity, priority, category,
                device_id, firmware_version, sample_id,
                reported_by, reported_by_email, reproduction_steps, tags,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'open')
            RETURNING id
        """,
            data.title, data.description, data.severity, data.priority, data.category,
            data.device_id, data.firmware_version, data.sample_id,
            data.reported_by, data.reported_by_email, data.reproduction_steps,
            data.tags or []
        )

        return {
            "id": str(bug_id),
            "message": "Bug report created successfully",
            "status": "open"
        }


@router.patch("/{bug_id}")
async def update_bug(request: Request, bug_id: str, data: BugReportUpdate):
    """Update bug report (partial update)"""
    pool = request.app.state.db_pool

    try:
        bug_uuid = uuid.UUID(bug_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bug ID format")

    # Build dynamic update
    updates = []
    params = []
    param_count = 1

    update_fields = data.dict(exclude_unset=True)

    for field, value in update_fields.items():
        # Map camelCase to snake_case
        db_field = field
        if field == "assignedTo":
            db_field = "assigned_to"
            # Set assigned_at timestamp
            updates.append(f"assigned_at = NOW()")
        elif field == "resolvedBy":
            db_field = "resolved_by"
            # Set resolved_at timestamp
            updates.append(f"resolved_at = NOW()")

        updates.append(f"{db_field} = ${param_count}")
        params.append(value)
        param_count += 1

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(bug_uuid)

    async with pool.acquire() as conn:
        result = await conn.execute(f"""
            UPDATE bug_reports
            SET {', '.join(updates)}
            WHERE id = ${param_count}
        """, *params)

        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Bug report not found")

        return {"message": "Bug report updated successfully"}


@router.post("/{bug_id}/comments", status_code=201)
async def add_bug_comment(request: Request, bug_id: str, data: BugCommentCreate):
    """Add comment to bug report"""
    pool = request.app.state.db_pool

    try:
        bug_uuid = uuid.UUID(bug_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bug ID format")

    async with pool.acquire() as conn:
        # Verify bug exists
        exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM bug_reports WHERE id = $1)", bug_uuid)
        if not exists:
            raise HTTPException(status_code=404, detail="Bug report not found")

        comment_id = await conn.fetchval("""
            INSERT INTO bug_comments (
                bug_report_id, comment, author, author_email, is_internal, attachments
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        """,
            bug_uuid, data.comment, data.author, data.author_email,
            data.is_internal, data.attachments or []
        )

        return {
            "id": str(comment_id),
            "message": "Comment added successfully"
        }


@router.get("/metrics/summary")
async def get_bug_metrics(request: Request):
    """Get bug tracking metrics and statistics"""
    pool = request.app.state.db_pool

    async with pool.acquire() as conn:
        stats = await conn.fetchrow("""
            SELECT
                COUNT(*) as total_bugs,
                COUNT(*) FILTER (WHERE status = 'open') as open_bugs,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_bugs,
                COUNT(*) FILTER (WHERE status = 'resolved') as resolved_bugs,
                COUNT(*) FILTER (WHERE status = 'closed') as closed_bugs,
                COUNT(*) FILTER (WHERE severity = 'critical') as critical_bugs,
                COUNT(*) FILTER (WHERE severity = 'high') as high_severity_bugs,
                COUNT(*) FILTER (WHERE severity = 'medium') as medium_severity_bugs,
                COUNT(*) FILTER (WHERE severity = 'low') as low_severity_bugs,
                COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as new_today,
                COUNT(*) FILTER (WHERE DATE(resolved_at) = CURRENT_DATE) as resolved_today,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
                    FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours
            FROM bug_reports
        """)

        return {
            "totalBugs": stats["total_bugs"],
            "openBugs": stats["open_bugs"],
            "inProgressBugs": stats["in_progress_bugs"],
            "resolvedBugs": stats["resolved_bugs"],
            "closedBugs": stats["closed_bugs"],
            "criticalBugs": stats["critical_bugs"],
            "highSeverityBugs": stats["high_severity_bugs"],
            "mediumSeverityBugs": stats["medium_severity_bugs"],
            "lowSeverityBugs": stats["low_severity_bugs"],
            "newToday": stats["new_today"],
            "resolvedToday": stats["resolved_today"],
            "avgResolutionTimeHours": round(stats["avg_resolution_hours"], 2) if stats["avg_resolution_hours"] else None
        }


@router.get("/metrics/trends")
async def get_bug_trends(request: Request, days: int = 30):
    """Get bug trends over time"""
    pool = request.app.state.db_pool

    async with pool.acquire() as conn:
        trends = await conn.fetch("""
            SELECT
                DATE(created_at) as date,
                COUNT(*) as bugs_created,
                COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
                COUNT(*) FILTER (WHERE severity = 'high') as high_count
            FROM bug_reports
            WHERE created_at >= CURRENT_DATE - $1::interval
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        """, f"{days} days")

        return {
            "trends": [
                {
                    "date": row["date"].isoformat(),
                    "bugsCreated": row["bugs_created"],
                    "criticalCount": row["critical_count"],
                    "highCount": row["high_count"]
                }
                for row in trends
            ]
        }
