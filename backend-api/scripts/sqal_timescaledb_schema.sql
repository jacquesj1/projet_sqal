-- ================================================================================
-- SCHÉMA TIMESCALEDB SQAL - Contrôle Qualité Capteurs
-- ================================================================================
-- Description : Schéma SQAL pour capteurs VL53L8CH (ToF) + AS7341 (Spectral)
-- Base        : gaveurs_db (partagée avec Euralis)
-- Intégration : Backend FastAPI unifié
-- Date        : 15 Décembre 2024
-- Version     : 3.0.0
--
-- DEPRECATED (SQAL ORM Migration Phase 2):
-- - Le backend utilise désormais la table sensor_samples (SQLAlchemy ORM)
-- - Ne pas exécuter ce script sur les environnements de démo/prod
-- - Conserver uniquement à titre d'archive/référence
-- ================================================================================

-- ================================================================================
-- 1️⃣ TABLE DEVICES (ESP32 / Capteurs)
-- ================================================================================

CREATE TABLE IF NOT EXISTS sqal_devices (
    device_id VARCHAR(100) PRIMARY KEY,
    device_name VARCHAR(200),
    device_type VARCHAR(50) DEFAULT 'ESP32',  -- ESP32, Raspberry, etc.
    firmware_version VARCHAR(20),

    -- Lien avec Euralis (site de production)
    site_code VARCHAR(2) REFERENCES sites_euralis(code),  -- LL, LS, MT

    -- Statut
    status VARCHAR(20) DEFAULT 'active',  -- active, inactive, maintenance
    last_seen TIMESTAMPTZ,

    -- Configuration
    config_profile VARCHAR(50),  -- foiegras_premium, standard, etc.

    -- Métadonnées
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sqal_devices IS 'Devices ESP32 avec capteurs VL53L8CH + AS7341';
COMMENT ON COLUMN sqal_devices.site_code IS 'Lien avec sites Euralis (LL/LS/MT)';

-- Index
CREATE INDEX IF NOT EXISTS idx_sqal_devices_site ON sqal_devices(site_code);
CREATE INDEX IF NOT EXISTS idx_sqal_devices_status ON sqal_devices(status);


-- ================================================================================
-- 2️⃣ HYPERTABLE SENSOR_SAMPLES (Données Capteurs + Analyses)
-- ================================================================================

CREATE TABLE IF NOT EXISTS sqal_sensor_samples (
    time TIMESTAMPTZ NOT NULL,
    sample_id VARCHAR(100) NOT NULL,  -- SAMPLE-20251215-103000-123
    device_id VARCHAR(100) NOT NULL REFERENCES sqal_devices(device_id),

    -- Lien optionnel avec lots Euralis
    lot_id INTEGER REFERENCES lots_gavage(id),  -- Permet corrélation ITM ↔ Qualité

    -- ========== VL53L8CH (Time-of-Flight) - DONNÉES BRUTES ==========

    -- Matrices 8x8 (64 pixels)
    vl53l8ch_distance_matrix JSONB NOT NULL,     -- [[d11, d12, ...], [d21, ...], ...]
    vl53l8ch_reflectance_matrix JSONB NOT NULL,  -- [[r11, r12, ...], ...]
    vl53l8ch_amplitude_matrix JSONB NOT NULL,    -- [[a11, a12, ...], ...]

    -- Métadonnées mesure
    vl53l8ch_integration_time INTEGER,           -- ms
    vl53l8ch_temperature_c DECIMAL(5,2),

    -- ========== VL53L8CH - ANALYSES CALCULÉES ==========

    -- Métriques de base
    vl53l8ch_volume_mm3 DECIMAL(10,2),
    vl53l8ch_avg_height_mm DECIMAL(6,2),
    vl53l8ch_max_height_mm DECIMAL(6,2),
    vl53l8ch_min_height_mm DECIMAL(6,2),
    vl53l8ch_surface_uniformity DECIMAL(5,4),   -- 0.0-1.0

    -- Analyses détaillées (JSONB pour flexibilité)
    vl53l8ch_bins_analysis JSONB,               -- Histogramme, multi-peak detection
    vl53l8ch_reflectance_analysis JSONB,        -- Stats reflectance
    vl53l8ch_amplitude_consistency JSONB,       -- Cohérence amplitude

    -- Score et grade
    vl53l8ch_quality_score DECIMAL(5,4),        -- 0.0-1.0
    vl53l8ch_grade VARCHAR(10),                 -- A+, A, B, C, REJECT
    vl53l8ch_score_breakdown JSONB,             -- Détail des composants du score
    vl53l8ch_defects JSONB,                     -- Liste défauts détectés

    -- ========== AS7341 (Spectral) - DONNÉES BRUTES ==========

    -- 10 Canaux spectraux (415nm à NIR)
    as7341_channels JSONB NOT NULL,  -- {F1_415nm: 1234, F2_445nm: 2345, ...}

    -- Métadonnées mesure
    as7341_integration_time INTEGER,  -- ms
    as7341_gain INTEGER,              -- Multiplicateur

    -- ========== AS7341 - ANALYSES CALCULÉES ==========

    -- Indices de qualité
    as7341_freshness_index DECIMAL(5,4),        -- 0.0-1.0
    as7341_fat_quality_index DECIMAL(5,4),      -- 0.0-1.0
    as7341_oxidation_index DECIMAL(5,4),        -- 0.0-1.0 (0 = pas d'oxydation)

    -- Analyses détaillées
    as7341_spectral_analysis JSONB,             -- Ratios spectraux
    as7341_color_analysis JSONB,                -- RGB, HSV, etc.

    -- Score et grade
    as7341_quality_score DECIMAL(5,4),          -- 0.0-1.0
    as7341_grade VARCHAR(10),                   -- A+, A, B, C, REJECT
    as7341_score_breakdown JSONB,
    as7341_defects JSONB,

    -- ========== FUSION (VL53L8CH + AS7341) ==========

    fusion_final_score DECIMAL(5,4) NOT NULL,   -- 0.0-1.0
    fusion_final_grade VARCHAR(10) NOT NULL,    -- A+, A, B, C, REJECT
    fusion_vl53l8ch_score DECIMAL(5,4),         -- Contribution VL53L8CH (60%)
    fusion_as7341_score DECIMAL(5,4),           -- Contribution AS7341 (40%)
    fusion_defects JSONB,                       -- Défauts combinés
    fusion_is_compliant BOOLEAN DEFAULT TRUE,   -- Conforme aux normes

    -- ========== METADATA ==========

    meta_firmware_version VARCHAR(20),
    meta_temperature_c DECIMAL(5,2),
    meta_humidity_percent DECIMAL(5,2),
    meta_config_profile VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (time, sample_id)
);

COMMENT ON TABLE sqal_sensor_samples IS 'Mesures capteurs ToF + Spectral avec analyses (Hypertable)';
COMMENT ON COLUMN sqal_sensor_samples.lot_id IS 'Lien optionnel avec lots Euralis pour corrélation ITM ↔ Qualité';
COMMENT ON COLUMN sqal_sensor_samples.vl53l8ch_distance_matrix IS 'Matrice 8x8 distances (mm) format JSONB';
COMMENT ON COLUMN sqal_sensor_samples.fusion_final_score IS 'Score fusion = 0.6*VL + 0.4*AS7341';

-- Conversion en hypertable (TimescaleDB)
SELECT create_hypertable('sqal_sensor_samples', 'time', if_not_exists => TRUE);

-- Partitionnement par chunks de 7 jours
SELECT set_chunk_time_interval('sqal_sensor_samples', INTERVAL '7 days');

-- Index
CREATE INDEX IF NOT EXISTS idx_sqal_samples_device ON sqal_sensor_samples(device_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_sqal_samples_sample_id ON sqal_sensor_samples(sample_id);
CREATE INDEX IF NOT EXISTS idx_sqal_samples_lot ON sqal_sensor_samples(lot_id) WHERE lot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sqal_samples_grade ON sqal_sensor_samples(fusion_final_grade);
CREATE INDEX IF NOT EXISTS idx_sqal_samples_score ON sqal_sensor_samples(fusion_final_score);


-- ================================================================================
-- 3️⃣ CONTINUOUS AGGREGATE - STATISTIQUES HORAIRES
-- ================================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS sqal_hourly_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_id,

    -- Compteurs
    COUNT(*) as sample_count,
    COUNT(*) FILTER (WHERE fusion_final_grade = 'A+') as count_a_plus,
    COUNT(*) FILTER (WHERE fusion_final_grade = 'A') as count_a,
    COUNT(*) FILTER (WHERE fusion_final_grade = 'B') as count_b,
    COUNT(*) FILTER (WHERE fusion_final_grade = 'C') as count_c,
    COUNT(*) FILTER (WHERE fusion_final_grade = 'REJECT') as count_reject,

    -- Moyennes qualité
    AVG(fusion_final_score) as avg_quality_score,
    MIN(fusion_final_score) as min_quality_score,
    MAX(fusion_final_score) as max_quality_score,

    -- Moyennes indices
    AVG(as7341_freshness_index) as avg_freshness,
    AVG(as7341_fat_quality_index) as avg_fat_quality,
    AVG(as7341_oxidation_index) as avg_oxidation,

    -- VL53L8CH moyennes
    AVG(vl53l8ch_volume_mm3) as avg_volume,
    AVG(vl53l8ch_surface_uniformity) as avg_uniformity,

    -- Conformité
    COUNT(*) FILTER (WHERE fusion_is_compliant = TRUE) as count_compliant,

    -- Métadonnées
    NOW() as last_refresh

FROM sqal_sensor_samples
GROUP BY bucket, device_id;

COMMENT ON MATERIALIZED VIEW sqal_hourly_stats IS 'Statistiques qualité par heure et device (auto-refresh)';

-- Politique de rafraîchissement automatique (toutes les heures)
SELECT add_continuous_aggregate_policy('sqal_hourly_stats',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);


-- ================================================================================
-- 4️⃣ CONTINUOUS AGGREGATE - STATISTIQUES PAR SITE
-- ================================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS sqal_site_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', s.time) AS day,
    d.site_code,

    -- Compteurs
    COUNT(*) as sample_count,
    COUNT(*) FILTER (WHERE s.fusion_final_grade = 'A+') as count_a_plus,

    -- Moyennes
    AVG(s.fusion_final_score) as avg_quality_score,
    AVG(s.as7341_freshness_index) as avg_freshness,

    -- Conformité
    (COUNT(*) FILTER (WHERE s.fusion_is_compliant = TRUE)::FLOAT / COUNT(*) * 100) as compliance_rate_pct,

    NOW() as last_refresh

FROM sqal_sensor_samples s
JOIN sqal_devices d ON s.device_id = d.device_id
WHERE d.site_code IS NOT NULL
GROUP BY day, d.site_code;

COMMENT ON MATERIALIZED VIEW sqal_site_stats IS 'Statistiques qualité par site Euralis (LL/LS/MT)';

-- Politique de rafraîchissement (toutes les 6 heures)
SELECT add_continuous_aggregate_policy('sqal_site_stats',
    start_offset => INTERVAL '1 week',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '6 hours',
    if_not_exists => TRUE
);


-- ================================================================================
-- 5️⃣ TABLE ML_MODELS (Modèles IA/ML)
-- ================================================================================

CREATE TABLE IF NOT EXISTS sqal_ml_models (
    model_id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL,  -- CNN, RandomForest, XGBoost, Prophet
    model_version VARCHAR(20),

    -- Fichier modèle
    model_file_path TEXT,
    model_size_mb DECIMAL(10,2),

    -- Performance
    accuracy DECIMAL(5,4),
    precision_score DECIMAL(5,4),
    recall_score DECIMAL(5,4),
    f1_score DECIMAL(5,4),

    -- Entraînement
    training_samples_count INTEGER,
    training_duration_seconds INTEGER,
    training_loss DECIMAL(10,6),
    validation_loss DECIMAL(10,6),

    -- Métadonnées
    framework VARCHAR(50),  -- TensorFlow, PyTorch, Scikit-learn
    hyperparameters JSONB,
    features_used JSONB,

    -- Statut
    status VARCHAR(20) DEFAULT 'active',  -- active, archived, testing
    is_production BOOLEAN DEFAULT FALSE,

    -- Timestamps
    trained_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sqal_ml_models IS 'Modèles IA/ML pour analyse qualité (CNN, etc.)';

-- Index
CREATE INDEX IF NOT EXISTS idx_sqal_ml_models_type ON sqal_ml_models(model_type);
CREATE INDEX IF NOT EXISTS idx_sqal_ml_models_status ON sqal_ml_models(status, is_production);


-- ================================================================================
-- 6️⃣ TABLE BLOCKCHAIN_TRANSACTIONS (Traçabilité SQAL)
-- ================================================================================

CREATE TABLE IF NOT EXISTS sqal_blockchain_txns (
    txn_id SERIAL PRIMARY KEY,
    sample_id VARCHAR(100) REFERENCES sqal_sensor_samples(sample_id),

    -- Blockchain
    block_id INTEGER,
    block_hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64),

    -- Données hashées
    data_hash VARCHAR(64) NOT NULL,  -- SHA256 des données capteurs

    -- Métadonnées
    merkle_root VARCHAR(64),
    nonce INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sqal_blockchain_txns IS 'Transactions blockchain pour traçabilité mesures SQAL';

-- Index
CREATE INDEX IF NOT EXISTS idx_sqal_blockchain_sample ON sqal_blockchain_txns(sample_id);
CREATE INDEX IF NOT EXISTS idx_sqal_blockchain_block ON sqal_blockchain_txns(block_id);
CREATE INDEX IF NOT EXISTS idx_sqal_blockchain_hash ON sqal_blockchain_txns(block_hash);


-- ================================================================================
-- 7️⃣ HYPERTABLE ALERTS (Alertes Qualité)
-- ================================================================================

CREATE TABLE IF NOT EXISTS sqal_alerts (
    time TIMESTAMPTZ NOT NULL,
    alert_id SERIAL,

    -- Références
    sample_id VARCHAR(100),
    device_id VARCHAR(100) REFERENCES sqal_devices(device_id),
    lot_id INTEGER REFERENCES lots_gavage(id),

    -- Alerte
    alert_type VARCHAR(50) NOT NULL,  -- defect_detected, low_quality, oxidation_high, etc.
    severity VARCHAR(20) NOT NULL,    -- critical, high, medium, low

    -- Détails
    title VARCHAR(200) NOT NULL,
    message TEXT,
    defect_details JSONB,

    -- Valeurs
    threshold_value DECIMAL(10,4),
    actual_value DECIMAL(10,4),
    deviation_pct DECIMAL(6,2),

    -- Statut
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    resolution_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (time, alert_id)
);

COMMENT ON TABLE sqal_alerts IS 'Alertes qualité temps réel (défauts, anomalies) - Hypertable';

-- Conversion en hypertable
SELECT create_hypertable('sqal_alerts', 'time', if_not_exists => TRUE);

-- Index
CREATE INDEX IF NOT EXISTS idx_sqal_alerts_sample ON sqal_alerts(sample_id);
CREATE INDEX IF NOT EXISTS idx_sqal_alerts_device ON sqal_alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_sqal_alerts_lot ON sqal_alerts(lot_id) WHERE lot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sqal_alerts_type ON sqal_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_sqal_alerts_severity ON sqal_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_sqal_alerts_ack ON sqal_alerts(acknowledged);


-- ================================================================================
-- POLITIQUES DE RÉTENTION ET COMPRESSION (TimescaleDB)
-- ================================================================================

-- Rétention : Conserver 90 jours de données brutes
SELECT add_retention_policy('sqal_sensor_samples', INTERVAL '90 days', if_not_exists => TRUE);

-- Rétention alertes : 180 jours
SELECT add_retention_policy('sqal_alerts', INTERVAL '180 days', if_not_exists => TRUE);

-- Compression : Après 7 jours
ALTER TABLE sqal_sensor_samples SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('sqal_sensor_samples', INTERVAL '7 days', if_not_exists => TRUE);

-- Compression alertes : Après 30 jours
ALTER TABLE sqal_alerts SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id,alert_type',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('sqal_alerts', INTERVAL '30 days', if_not_exists => TRUE);


-- ================================================================================
-- FONCTIONS UTILITAIRES
-- ================================================================================

-- Fonction : Obtenir dernière mesure par device
CREATE OR REPLACE FUNCTION get_latest_sqal_sample(p_device_id VARCHAR)
RETURNS TABLE (
    sample_id VARCHAR,
    timestamp TIMESTAMPTZ,
    fusion_grade VARCHAR,
    fusion_score DECIMAL,
    vl_score DECIMAL,
    as_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.sample_id,
        s.time,
        s.fusion_final_grade,
        s.fusion_final_score,
        s.vl53l8ch_quality_score,
        s.as7341_quality_score
    FROM sqal_sensor_samples s
    WHERE s.device_id = p_device_id
    ORDER BY s.time DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_latest_sqal_sample IS 'Retourne dernière mesure pour un device';


-- Fonction : Statistiques période
CREATE OR REPLACE FUNCTION get_sqal_stats_period(
    p_hours INTEGER DEFAULT 24,
    p_device_id VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    total_samples BIGINT,
    avg_quality DECIMAL,
    count_a_plus BIGINT,
    compliance_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_samples,
        AVG(fusion_final_score) as avg_quality,
        COUNT(*) FILTER (WHERE fusion_final_grade = 'A+') as count_a_plus,
        (COUNT(*) FILTER (WHERE fusion_is_compliant = TRUE)::DECIMAL / COUNT(*) * 100) as compliance_rate
    FROM sqal_sensor_samples
    WHERE time > NOW() - (p_hours || ' hours')::INTERVAL
        AND (p_device_id IS NULL OR device_id = p_device_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sqal_stats_period IS 'Statistiques qualité sur une période (défaut 24h)';


-- ================================================================================
-- GRANTS ET PERMISSIONS
-- ================================================================================

-- Accorder tous les privilèges à gaveurs_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gaveurs_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gaveurs_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO gaveurs_user;


-- ================================================================================
-- DONNÉES INITIALES (Devices ESP32 de test)
-- ================================================================================

INSERT INTO sqal_devices (device_id, device_name, firmware_version, site_code, config_profile)
VALUES
    ('ESP32-FOIEGRAS-LL-001', 'Capteur Bretagne 1', 'v1.0.0', 'LL', 'foiegras_premium'),
    ('ESP32-FOIEGRAS-LS-001', 'Capteur Pays de Loire 1', 'v1.0.0', 'LS', 'foiegras_premium'),
    ('ESP32-FOIEGRAS-MT-001', 'Capteur Maubourguet 1', 'v1.0.0', 'MT', 'foiegras_premium')
ON CONFLICT (device_id) DO UPDATE SET
    device_name = EXCLUDED.device_name,
    firmware_version = EXCLUDED.firmware_version,
    updated_at = NOW();


-- ================================================================================
-- RAPPORT FINAL
-- ================================================================================

DO $$
DECLARE
    nb_tables INTEGER;
    nb_hypertables INTEGER;
    nb_continuous_aggs INTEGER;
    nb_functions INTEGER;
BEGIN
    -- Compter les objets créés
    SELECT COUNT(*) INTO nb_tables FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'sqal_%';

    SELECT COUNT(*) INTO nb_hypertables FROM timescaledb_information.hypertables
    WHERE hypertable_schema = 'public' AND hypertable_name LIKE 'sqal_%';

    SELECT COUNT(*) INTO nb_continuous_aggs FROM timescaledb_information.continuous_aggregates
    WHERE view_schema = 'public' AND view_name LIKE 'sqal_%';

    SELECT COUNT(*) INTO nb_functions FROM pg_proc
    WHERE proname LIKE 'get_sqal_%';

    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '✅ SCHÉMA TIMESCALEDB SQAL - INSTALLATION TERMINÉE';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Objets créés :';
    RAISE NOTICE '   - Tables SQAL : %', nb_tables;
    RAISE NOTICE '   - Hypertables : %', nb_hypertables;
    RAISE NOTICE '   - Continuous Aggregates : %', nb_continuous_aggs;
    RAISE NOTICE '   - Fonctions utilitaires : %', nb_functions;
    RAISE NOTICE '   - Devices ESP32 initialisés : 3 (LL, LS, MT)';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Fonctionnalités activées :';
    RAISE NOTICE '   - Compression automatique (7 jours samples, 30 jours alerts)';
    RAISE NOTICE '   - Rétention automatique (90 jours samples, 180 jours alerts)';
    RAISE NOTICE '   - Continuous aggregates (hourly_stats, site_stats)';
    RAISE NOTICE '   - Lien avec tables Euralis (sqal_devices.site_code, sqal_sensor_samples.lot_id)';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Tables principales :';
    RAISE NOTICE '   1. sqal_devices (3 devices ESP32)';
    RAISE NOTICE '   2. sqal_sensor_samples (hypertable - mesures capteurs)';
    RAISE NOTICE '   3. sqal_hourly_stats (continuous aggregate - stats horaires)';
    RAISE NOTICE '   4. sqal_site_stats (continuous aggregate - stats par site)';
    RAISE NOTICE '   5. sqal_ml_models (modèles IA/ML)';
    RAISE NOTICE '   6. sqal_blockchain_txns (traçabilité)';
    RAISE NOTICE '   7. sqal_alerts (hypertable - alertes qualité)';
    RAISE NOTICE '';
    RAISE NOTICE '🔗 Intégration Euralis :';
    RAISE NOTICE '   - sqal_devices.site_code → sites_euralis.code (LL/LS/MT)';
    RAISE NOTICE '   - sqal_sensor_samples.lot_id → lots_gavage.id (corrélation ITM ↔ Qualité)';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Prochaines étapes :';
    RAISE NOTICE '   1. Démarrer backend FastAPI unifié :';
    RAISE NOTICE '      uvicorn app.main:app --reload --port 8000';
    RAISE NOTICE '   2. Lancer simulator SQAL :';
    RAISE NOTICE '      python simulator-sqal/data_generator.py';
    RAISE NOTICE '   3. Vérifier données :';
    RAISE NOTICE '      SELECT * FROM sqal_sensor_samples ORDER BY time DESC LIMIT 5;';
    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '';
END $$;
