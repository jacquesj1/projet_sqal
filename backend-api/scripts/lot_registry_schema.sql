-- ==============================================================================
-- Lot Registry Schema - Traçabilité Complète des Lots
-- ==============================================================================
-- Tables pour suivre les lots de bout en bout :
-- Gavage → SQAL → Consumer Feedback
--
-- Auteur: Claude Code
-- Date: 2026-01-07
-- ==============================================================================

-- ============================================================================
-- Table: lots_registry
-- ============================================================================
-- Registre centralisé de tous les lots avec leur état actuel

CREATE TABLE IF NOT EXISTS lots_registry (
    lot_id VARCHAR(50) PRIMARY KEY,
    gaveur_id VARCHAR(50) NOT NULL,
    nb_canards INTEGER NOT NULL CHECK (nb_canards > 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Gavage
    gavage_status VARCHAR(20) NOT NULL DEFAULT 'en_cours',
    gavage_started_at TIMESTAMP,
    gavage_ended_at TIMESTAMP,
    current_day INTEGER DEFAULT 0,
    itm_moyen FLOAT,

    -- SQAL
    sqal_samples TEXT[] DEFAULT '{}',  -- Array of sample_ids
    sqal_grades TEXT[] DEFAULT '{}',   -- Array of grades (A+, A, B, C, D)

    -- Consumer
    consumer_feedbacks TEXT[] DEFAULT '{}',  -- Array of feedback_ids
    average_rating FLOAT,

    -- Blockchain
    blockchain_hash VARCHAR(100),

    -- Metadata
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lots_registry_gaveur ON lots_registry(gaveur_id);
CREATE INDEX IF NOT EXISTS idx_lots_registry_status ON lots_registry(gavage_status);
CREATE INDEX IF NOT EXISTS idx_lots_registry_created ON lots_registry(created_at DESC);

-- ============================================================================
-- Table: lot_events
-- ============================================================================
-- Timeline complète des événements pour chaque lot (traçabilité)

CREATE TABLE IF NOT EXISTS lot_events (
    id SERIAL PRIMARY KEY,
    lot_id VARCHAR(50) NOT NULL REFERENCES lots_registry(lot_id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    data JSONB,
    description TEXT,

    -- Index for fast timeline queries
    CONSTRAINT fk_lot_events_lot FOREIGN KEY (lot_id) REFERENCES lots_registry(lot_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lot_events_lot_id ON lot_events(lot_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_lot_events_type ON lot_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lot_events_timestamp ON lot_events(timestamp DESC);

-- ============================================================================
-- Views: Lot Statistics
-- ============================================================================

-- Vue: Active Lots Summary
CREATE OR REPLACE VIEW v_active_lots_summary AS
SELECT
    COUNT(*) as total_active_lots,
    SUM(nb_canards) as total_active_canards,
    AVG(current_day) as avg_gavage_day,
    AVG(itm_moyen) as avg_itm,
    MIN(created_at) as oldest_lot_date,
    MAX(created_at) as newest_lot_date
FROM lots_registry
WHERE gavage_status = 'en_cours';

-- Vue: Completed Lots Summary
CREATE OR REPLACE VIEW v_completed_lots_summary AS
SELECT
    COUNT(*) as total_completed_lots,
    SUM(nb_canards) as total_completed_canards,
    AVG(current_day) as avg_gavage_duration,
    AVG(itm_moyen) as avg_final_itm,
    AVG(average_rating) as avg_consumer_rating,
    AVG(CARDINALITY(sqal_samples)) as avg_sqal_controls_per_lot
FROM lots_registry
WHERE gavage_status = 'termine';

-- Vue: Lot Traceability (derniers lots avec timeline complète)
CREATE OR REPLACE VIEW v_lot_traceability AS
SELECT
    l.lot_id,
    l.gaveur_id,
    l.nb_canards,
    l.gavage_status,
    l.current_day,
    l.itm_moyen,
    CARDINALITY(l.sqal_samples) as sqal_control_count,
    CARDINALITY(l.consumer_feedbacks) as feedback_count,
    l.average_rating,
    l.created_at,
    l.gavage_started_at,
    l.gavage_ended_at,
    COALESCE(
        EXTRACT(EPOCH FROM (l.gavage_ended_at - l.gavage_started_at)) / 86400,
        EXTRACT(EPOCH FROM (NOW() - l.gavage_started_at)) / 86400
    ) as gavage_duration_days,
    (
        SELECT COUNT(*)
        FROM lot_events e
        WHERE e.lot_id = l.lot_id
    ) as total_events
FROM lots_registry l
ORDER BY l.created_at DESC;

-- ============================================================================
-- Functions: Lot Management
-- ============================================================================

-- Function: Get lot timeline summary
CREATE OR REPLACE FUNCTION get_lot_timeline_summary(p_lot_id VARCHAR)
RETURNS TABLE (
    event_count BIGINT,
    first_event TIMESTAMP,
    last_event TIMESTAMP,
    gavage_events BIGINT,
    sqal_events BIGINT,
    consumer_events BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as event_count,
        MIN(timestamp) as first_event,
        MAX(timestamp) as last_event,
        SUM(CASE WHEN event_type LIKE 'gavage%' THEN 1 ELSE 0 END) as gavage_events,
        SUM(CASE WHEN event_type = 'sqal_control' THEN 1 ELSE 0 END) as sqal_events,
        SUM(CASE WHEN event_type = 'consumer_feedback' THEN 1 ELSE 0 END) as consumer_events
    FROM lot_events
    WHERE lot_id = p_lot_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Link SQAL sample to lot (appelée automatiquement)
CREATE OR REPLACE FUNCTION link_sqal_to_lot(
    p_lot_id VARCHAR,
    p_sample_id VARCHAR,
    p_grade VARCHAR
) RETURNS VOID AS $$
BEGIN
    UPDATE lots_registry
    SET
        sqal_samples = array_append(sqal_samples, p_sample_id),
        sqal_grades = array_append(sqal_grades, p_grade),
        updated_at = NOW()
    WHERE lot_id = p_lot_id;

    INSERT INTO lot_events (lot_id, event_type, data, description)
    VALUES (
        p_lot_id,
        'sqal_control',
        jsonb_build_object('sample_id', p_sample_id, 'grade', p_grade),
        'Contrôle qualité SQAL - Grade: ' || p_grade
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Link consumer feedback to lot
CREATE OR REPLACE FUNCTION link_feedback_to_lot(
    p_lot_id VARCHAR,
    p_feedback_id VARCHAR,
    p_rating INTEGER
) RETURNS VOID AS $$
DECLARE
    v_current_count INTEGER;
    v_current_avg FLOAT;
    v_new_avg FLOAT;
BEGIN
    -- Get current feedback count and average
    SELECT
        CARDINALITY(consumer_feedbacks),
        average_rating
    INTO v_current_count, v_current_avg
    FROM lots_registry
    WHERE lot_id = p_lot_id;

    -- Calculate new average
    IF v_current_avg IS NULL THEN
        v_new_avg := p_rating;
    ELSE
        v_new_avg := ((v_current_avg * v_current_count) + p_rating) / (v_current_count + 1);
    END IF;

    -- Update lot
    UPDATE lots_registry
    SET
        consumer_feedbacks = array_append(consumer_feedbacks, p_feedback_id),
        average_rating = v_new_avg,
        updated_at = NOW()
    WHERE lot_id = p_lot_id;

    -- Add event
    INSERT INTO lot_events (lot_id, event_type, data, description)
    VALUES (
        p_lot_id,
        'consumer_feedback',
        jsonb_build_object('feedback_id', p_feedback_id, 'rating', p_rating),
        'Feedback consommateur - Note: ' || p_rating || '/5'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- Uncomment to insert test data
-- INSERT INTO lots_registry (lot_id, gaveur_id, nb_canards, gavage_status, gavage_started_at, current_day, itm_moyen)
-- VALUES
--     ('LOT_20260107_TEST1', 'G001', 50, 'en_cours', NOW() - INTERVAL '7 days', 7, 485.3),
--     ('LOT_20260107_TEST2', 'G002', 45, 'en_cours', NOW() - INTERVAL '5 days', 5, 452.1),
--     ('LOT_20260107_TEST3', 'G001', 55, 'termine', NOW() - INTERVAL '14 days', 14, 512.7);

-- ============================================================================
-- Grants (adjust based on your user setup)
-- ============================================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON lots_registry TO gaveurs_app;
-- GRANT SELECT, INSERT ON lot_events TO gaveurs_app;
-- GRANT SELECT ON v_active_lots_summary TO gaveurs_app;
-- GRANT SELECT ON v_completed_lots_summary TO gaveurs_app;
-- GRANT SELECT ON v_lot_traceability TO gaveurs_app;
-- GRANT EXECUTE ON FUNCTION get_lot_timeline_summary TO gaveurs_app;
-- GRANT EXECUTE ON FUNCTION link_sqal_to_lot TO gaveurs_app;
-- GRANT EXECUTE ON FUNCTION link_feedback_to_lot TO gaveurs_app;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE lots_registry IS 'Registre centralisé des lots pour traçabilité complète Gavage → SQAL → Consumer';
COMMENT ON TABLE lot_events IS 'Timeline chronologique des événements pour chaque lot';
COMMENT ON COLUMN lots_registry.sqal_samples IS 'Array des sample_ids SQAL liés à ce lot';
COMMENT ON COLUMN lots_registry.consumer_feedbacks IS 'Array des feedback_ids consommateurs liés à ce lot';
COMMENT ON COLUMN lots_registry.average_rating IS 'Note moyenne des feedbacks consommateurs (1-5)';

-- ============================================================================
-- Maintenance
-- ============================================================================

-- Clean old events (keep last 90 days)
-- CREATE OR REPLACE FUNCTION cleanup_old_lot_events() RETURNS VOID AS $$
-- BEGIN
--     DELETE FROM lot_events WHERE timestamp < NOW() - INTERVAL '90 days';
-- END;
-- $$ LANGUAGE plpgsql;

-- ============================================================================
-- End of Schema
-- ============================================================================
