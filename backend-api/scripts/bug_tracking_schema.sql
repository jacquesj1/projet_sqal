-- ============================================================================
-- Bug Tracking Schema for Backend-API
-- Production-ready issue tracking system
-- ============================================================================

-- Bug Reports Table
CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    description TEXT NOT NULL,

    -- Classification
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    category VARCHAR(100),  -- hardware, firmware, backend, frontend, sensor, quality, ml

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix')),

    -- Context
    device_id VARCHAR(100),
    firmware_version VARCHAR(50),
    sample_id VARCHAR(100),

    -- Reporter
    reported_by VARCHAR(200),
    reported_by_email VARCHAR(200),

    -- Assignment
    assigned_to VARCHAR(200),
    assigned_at TIMESTAMPTZ,

    -- Resolution
    resolution TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(200),

    -- Attachments and logs
    attachments JSONB,  -- Array of file paths/URLs
    error_logs JSONB,  -- Error logs and stack traces
    reproduction_steps TEXT,

    -- Metadata
    tags JSONB,  -- Array of tags
    related_issues JSONB,  -- Array of related bug IDs

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Indexes for bug_reports
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON bug_reports(priority);
CREATE INDEX IF NOT EXISTS idx_bug_reports_category ON bug_reports(category);
CREATE INDEX IF NOT EXISTS idx_bug_reports_device_id ON bug_reports(device_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_assigned_to ON bug_reports(assigned_to);

-- Bug Comments Table
CREATE TABLE IF NOT EXISTS bug_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bug_report_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,

    -- Comment content
    comment TEXT NOT NULL,

    -- Author
    author VARCHAR(200) NOT NULL,
    author_email VARCHAR(200),

    -- Metadata
    is_internal BOOLEAN DEFAULT false,  -- Internal comments not visible to reporters
    attachments JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Indexes for bug_comments
CREATE INDEX IF NOT EXISTS idx_bug_comments_bug_report_id ON bug_comments(bug_report_id);
CREATE INDEX IF NOT EXISTS idx_bug_comments_created_at ON bug_comments(created_at);

-- Bug Metrics Table (aggregated statistics)
CREATE TABLE IF NOT EXISTS bug_metrics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,

    -- Counts by status
    total_bugs INTEGER DEFAULT 0,
    open_bugs INTEGER DEFAULT 0,
    in_progress_bugs INTEGER DEFAULT 0,
    resolved_bugs INTEGER DEFAULT 0,
    closed_bugs INTEGER DEFAULT 0,

    -- Counts by severity
    critical_bugs INTEGER DEFAULT 0,
    high_severity_bugs INTEGER DEFAULT 0,
    medium_severity_bugs INTEGER DEFAULT 0,
    low_severity_bugs INTEGER DEFAULT 0,

    -- Resolution metrics
    avg_resolution_time_hours NUMERIC(10, 2),
    avg_response_time_hours NUMERIC(10, 2),

    -- Trends
    new_bugs_today INTEGER DEFAULT 0,
    resolved_today INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for bug_metrics
CREATE INDEX IF NOT EXISTS idx_bug_metrics_date ON bug_metrics(date DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to bug_reports
DROP TRIGGER IF EXISTS update_bug_reports_updated_at ON bug_reports;
CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to bug_comments
DROP TRIGGER IF EXISTS update_bug_comments_updated_at ON bug_comments;
CREATE TRIGGER update_bug_comments_updated_at
    BEFORE UPDATE ON bug_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update bug metrics daily
CREATE OR REPLACE FUNCTION refresh_bug_metrics()
RETURNS void AS $$
BEGIN
    INSERT INTO bug_metrics (
        date,
        total_bugs,
        open_bugs,
        in_progress_bugs,
        resolved_bugs,
        closed_bugs,
        critical_bugs,
        high_severity_bugs,
        medium_severity_bugs,
        low_severity_bugs,
        new_bugs_today,
        resolved_today
    )
    SELECT
        CURRENT_DATE,
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'open'),
        COUNT(*) FILTER (WHERE status = 'in_progress'),
        COUNT(*) FILTER (WHERE status = 'resolved'),
        COUNT(*) FILTER (WHERE status = 'closed'),
        COUNT(*) FILTER (WHERE severity = 'critical'),
        COUNT(*) FILTER (WHERE severity = 'high'),
        COUNT(*) FILTER (WHERE severity = 'medium'),
        COUNT(*) FILTER (WHERE severity = 'low'),
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        COUNT(*) FILTER (WHERE DATE(resolved_at) = CURRENT_DATE)
    FROM bug_reports
    ON CONFLICT (date) DO UPDATE SET
        total_bugs = EXCLUDED.total_bugs,
        open_bugs = EXCLUDED.open_bugs,
        in_progress_bugs = EXCLUDED.in_progress_bugs,
        resolved_bugs = EXCLUDED.resolved_bugs,
        closed_bugs = EXCLUDED.closed_bugs,
        critical_bugs = EXCLUDED.critical_bugs,
        high_severity_bugs = EXCLUDED.high_severity_bugs,
        medium_severity_bugs = EXCLUDED.medium_severity_bugs,
        low_severity_bugs = EXCLUDED.low_severity_bugs,
        new_bugs_today = EXCLUDED.new_bugs_today,
        resolved_today = EXCLUDED.resolved_today;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gaveurs_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gaveurs_admin;
