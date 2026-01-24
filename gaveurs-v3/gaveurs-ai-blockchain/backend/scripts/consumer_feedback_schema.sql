-- ============================================================================
-- SCHEMA TIMESCALEDB - CONSUMER FEEDBACK & QR CODE TRACEABILITY
-- ============================================================================
-- Système de feedback consommateur intégré à SQAL + Blockchain
-- Permet collecte retours qualité via QR code et amélioration continue IA
-- ============================================================================

-- ============================================================================
-- 1. TABLE PRODUITS (Mapping QR → Lot + Sample SQAL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consumer_products (
    product_id VARCHAR(100) PRIMARY KEY,           -- ID unique produit (ex: FG_LL_20250115_001)
    qr_code VARCHAR(200) UNIQUE NOT NULL,          -- Code QR complet
    qr_signature VARCHAR(64) NOT NULL,             -- Signature cryptographique

    -- Liens production
    lot_id INTEGER REFERENCES lots_gavage(id),     -- Lien lot Euralis
    sample_id VARCHAR(100),                        -- Lien échantillon SQAL (peut être NULL si pas de contrôle)
    site_code VARCHAR(2) REFERENCES sites_euralis(code),

    -- Dates production
    production_date DATE NOT NULL,
    quality_control_date TIMESTAMPTZ,              -- Date contrôle SQAL
    packaging_date DATE,
    best_before_date DATE,

    -- Qualité SQAL (dénormalisé pour performance)
    sqal_quality_score DECIMAL(5,4),               -- Score 0-1
    sqal_grade VARCHAR(10),                         -- A+/A/B/C/REJECT
    sqal_compliance BOOLEAN DEFAULT TRUE,

    -- Métriques lot (dénormalisé)
    lot_itm DECIMAL(6,2),                          -- ITM moyen lot
    lot_avg_weight DECIMAL(8,2),                   -- Poids moyen lot (g)
    gavage_duration_days INTEGER,                  -- Durée gavage

    -- Certifications
    certifications JSONB DEFAULT '[]'::jsonb,      -- ["IGP", "Label Rouge", ...]
    production_method VARCHAR(50) DEFAULT 'traditionnel',

    -- Empreinte environnementale
    carbon_footprint_kg DECIMAL(6,2),
    animal_welfare_score DECIMAL(5,4),

    -- Blockchain
    blockchain_hash VARCHAR(128),
    blockchain_verified BOOLEAN DEFAULT FALSE,

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE                 -- Désactiver si rappel produit
);

-- Index pour recherches rapides
CREATE INDEX idx_consumer_products_qr ON consumer_products(qr_code);
CREATE INDEX idx_consumer_products_lot ON consumer_products(lot_id);
CREATE INDEX idx_consumer_products_sample ON consumer_products(sample_id);
CREATE INDEX idx_consumer_products_site_date ON consumer_products(site_code, production_date);

-- Commentaire
COMMENT ON TABLE consumer_products IS 'Produits finaux avec QR code pour traçabilité consommateur';


-- ============================================================================
-- 2. TABLE FEEDBACKS CONSOMMATEURS (Hypertable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consumer_feedbacks (
    time TIMESTAMPTZ NOT NULL,                     -- Timestamp soumission feedback
    feedback_id SERIAL,
    product_id VARCHAR(100) NOT NULL REFERENCES consumer_products(product_id),

    -- Notations (1-5)
    overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    texture_rating SMALLINT CHECK (texture_rating BETWEEN 1 AND 5),
    flavor_rating SMALLINT CHECK (flavor_rating BETWEEN 1 AND 5),
    color_rating SMALLINT CHECK (color_rating BETWEEN 1 AND 5),
    aroma_rating SMALLINT CHECK (aroma_rating BETWEEN 1 AND 5),
    freshness_rating SMALLINT CHECK (freshness_rating BETWEEN 1 AND 5),

    -- Commentaire
    comment TEXT,

    -- Contexte consommation
    consumption_context VARCHAR(50),               -- home, restaurant, special_event, gift
    consumption_date DATE,

    -- Consommateur (anonymisé)
    consumer_age_range VARCHAR(20),                -- 18-25, 26-35, 36-50, 51-65, 65+
    consumer_region VARCHAR(100),                  -- Région géographique

    -- Recommandation
    would_recommend BOOLEAN,
    repurchase_intent SMALLINT CHECK (repurchase_intent BETWEEN 1 AND 5),

    -- Photos
    photo_urls JSONB DEFAULT '[]'::jsonb,

    -- Métadonnées technique
    device_type VARCHAR(50),                       -- iOS, Android, Web
    app_version VARCHAR(20),
    ip_hash VARCHAR(64),                           -- Hash IP (anti-doublons sans stocker IP)

    -- Modération
    is_verified BOOLEAN DEFAULT FALSE,             -- Achat vérifié
    is_moderated BOOLEAN DEFAULT FALSE,            -- Modéré par équipe
    is_public BOOLEAN DEFAULT TRUE,                -- Visible publiquement
    moderation_notes TEXT,

    -- Récompense (optionnel)
    reward_points_granted INTEGER DEFAULT 0,

    PRIMARY KEY (time, feedback_id)
);

-- Convertir en hypertable
SELECT create_hypertable('consumer_feedbacks', 'time', if_not_exists => TRUE);

-- Index pour analytics
CREATE INDEX idx_feedbacks_product ON consumer_feedbacks(product_id, time DESC);
CREATE INDEX idx_feedbacks_rating ON consumer_feedbacks(overall_rating, time DESC);
CREATE INDEX idx_feedbacks_public ON consumer_feedbacks(is_public, time DESC) WHERE is_public = TRUE;

-- Compression après 30 jours
ALTER TABLE consumer_feedbacks SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'product_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('consumer_feedbacks', INTERVAL '30 days');

-- Rétention 5 ans (données précieuses pour IA long terme)
SELECT add_retention_policy('consumer_feedbacks', INTERVAL '5 years');

-- Commentaire
COMMENT ON TABLE consumer_feedbacks IS 'Feedbacks consommateurs collectés via QR code';


-- ============================================================================
-- 3. VUE MATÉRIALISÉE - STATISTIQUES PRODUITS
-- ============================================================================

CREATE MATERIALIZED VIEW consumer_product_stats AS
SELECT
    p.product_id,
    p.lot_id,
    p.site_code,
    p.production_date,
    p.sqal_quality_score,
    p.sqal_grade,

    -- Statistiques feedbacks
    COUNT(f.feedback_id) as total_feedbacks,
    AVG(f.overall_rating) as avg_overall_rating,
    AVG(f.texture_rating) as avg_texture_rating,
    AVG(f.flavor_rating) as avg_flavor_rating,
    AVG(f.color_rating) as avg_color_rating,
    AVG(f.aroma_rating) as avg_aroma_rating,
    AVG(f.freshness_rating) as avg_freshness_rating,

    -- Répartition notes
    COUNT(*) FILTER (WHERE f.overall_rating = 5) as count_5_stars,
    COUNT(*) FILTER (WHERE f.overall_rating = 4) as count_4_stars,
    COUNT(*) FILTER (WHERE f.overall_rating = 3) as count_3_stars,
    COUNT(*) FILTER (WHERE f.overall_rating = 2) as count_2_stars,
    COUNT(*) FILTER (WHERE f.overall_rating = 1) as count_1_star,

    -- Recommandation
    (COUNT(*) FILTER (WHERE f.would_recommend = TRUE)::FLOAT / NULLIF(COUNT(*), 0) * 100) as recommendation_rate_pct,
    AVG(f.repurchase_intent) as avg_repurchase_intent,

    -- Dernière mise à jour
    MAX(f.time) as last_feedback_date

FROM consumer_products p
LEFT JOIN consumer_feedbacks f ON p.product_id = f.product_id AND f.is_public = TRUE
GROUP BY p.product_id, p.lot_id, p.site_code, p.production_date, p.sqal_quality_score, p.sqal_grade;

-- Index pour recherches rapides
CREATE UNIQUE INDEX idx_product_stats_product ON consumer_product_stats(product_id);
CREATE INDEX idx_product_stats_lot ON consumer_product_stats(lot_id);
CREATE INDEX idx_product_stats_site ON consumer_product_stats(site_code, production_date);
CREATE INDEX idx_product_stats_rating ON consumer_product_stats(avg_overall_rating DESC);

-- Commentaire
COMMENT ON MATERIALIZED VIEW consumer_product_stats IS 'Stats agrégées feedbacks par produit (refresh quotidien)';


-- ============================================================================
-- 4. VUE MATÉRIALISÉE - STATISTIQUES LOTS (Continuous Aggregate)
-- ============================================================================

CREATE MATERIALIZED VIEW consumer_lot_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', f.time) AS bucket,
    p.lot_id,
    p.site_code,

    -- Feedbacks
    COUNT(f.feedback_id) as daily_feedbacks,
    AVG(f.overall_rating) as avg_overall_rating,
    AVG(f.texture_rating) as avg_texture_rating,
    AVG(f.flavor_rating) as avg_flavor_rating,
    AVG(f.freshness_rating) as avg_freshness_rating,

    -- Recommandation
    (COUNT(*) FILTER (WHERE f.would_recommend = TRUE)::FLOAT / NULLIF(COUNT(*), 0) * 100) as recommendation_rate_pct,

    -- Satisfaction
    (COUNT(*) FILTER (WHERE f.overall_rating >= 4)::FLOAT / NULLIF(COUNT(*), 0) * 100) as satisfaction_rate_pct

FROM consumer_feedbacks f
JOIN consumer_products p ON f.product_id = p.product_id
WHERE f.is_public = TRUE
GROUP BY bucket, p.lot_id, p.site_code;

-- Auto-refresh quotidien
SELECT add_continuous_aggregate_policy('consumer_lot_stats',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day'
);

-- Commentaire
COMMENT ON MATERIALIZED VIEW consumer_lot_stats IS 'Stats feedbacks par lot et jour (pour tendances)';


-- ============================================================================
-- 5. VUE MATÉRIALISÉE - STATISTIQUES SITES (Continuous Aggregate)
-- ============================================================================

CREATE MATERIALIZED VIEW consumer_site_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 week', f.time) AS bucket,
    p.site_code,

    -- Feedbacks
    COUNT(f.feedback_id) as weekly_feedbacks,
    AVG(f.overall_rating) as avg_overall_rating,
    AVG(f.texture_rating) as avg_texture_rating,
    AVG(f.flavor_rating) as avg_flavor_rating,
    AVG(f.color_rating) as avg_color_rating,
    AVG(f.aroma_rating) as avg_aroma_rating,
    AVG(f.freshness_rating) as avg_freshness_rating,

    -- Recommandation
    (COUNT(*) FILTER (WHERE f.would_recommend = TRUE)::FLOAT / NULLIF(COUNT(*), 0) * 100) as recommendation_rate_pct,

    -- Satisfaction
    (COUNT(*) FILTER (WHERE f.overall_rating >= 4)::FLOAT / NULLIF(COUNT(*), 0) * 100) as satisfaction_rate_pct,

    -- NPS (Net Promoter Score approximatif)
    (
        (COUNT(*) FILTER (WHERE f.overall_rating = 5)::FLOAT / NULLIF(COUNT(*), 0) * 100) -
        (COUNT(*) FILTER (WHERE f.overall_rating <= 2)::FLOAT / NULLIF(COUNT(*), 0) * 100)
    ) as nps_score

FROM consumer_feedbacks f
JOIN consumer_products p ON f.product_id = p.product_id
WHERE f.is_public = TRUE
GROUP BY bucket, p.site_code;

-- Auto-refresh hebdomadaire
SELECT add_continuous_aggregate_policy('consumer_site_stats',
    start_offset => INTERVAL '2 weeks',
    end_offset => INTERVAL '1 week',
    schedule_interval => INTERVAL '1 week'
);

-- Commentaire
COMMENT ON MATERIALIZED VIEW consumer_site_stats IS 'Stats feedbacks par site et semaine (benchmarking sites)';


-- ============================================================================
-- 6. TABLE ML TRAINING DATA (Corrélation Production ↔ Feedback)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consumer_feedback_ml_data (
    ml_data_id SERIAL PRIMARY KEY,
    feedback_id INTEGER NOT NULL,
    lot_id INTEGER NOT NULL REFERENCES lots_gavage(id),
    sample_id VARCHAR(100),

    -- Métriques production Euralis
    lot_itm DECIMAL(6,2),
    lot_avg_weight DECIMAL(8,2),
    lot_mortality_rate DECIMAL(5,2),
    lot_feed_conversion DECIMAL(6,3),

    -- Qualité SQAL
    sqal_score DECIMAL(5,4),
    sqal_grade VARCHAR(10),
    vl53l8ch_volume_mm3 DECIMAL(10,2),
    vl53l8ch_surface_uniformity DECIMAL(5,4),
    as7341_freshness_index DECIMAL(5,4),
    as7341_fat_quality_index DECIMAL(5,4),
    as7341_oxidation_index DECIMAL(5,4),

    -- Feedback consommateur
    consumer_overall_rating SMALLINT,
    consumer_texture_rating SMALLINT,
    consumer_flavor_rating SMALLINT,
    consumer_freshness_rating SMALLINT,
    consumer_would_recommend BOOLEAN,

    -- Contexte
    site_code VARCHAR(2),
    production_date DATE,
    consumption_delay_days INTEGER,                -- Jours entre production et consommation

    -- Métadonnées ML
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_for_training BOOLEAN DEFAULT FALSE,       -- Marqué quand utilisé pour entraînement
    train_test_split VARCHAR(10),                  -- 'train', 'test', 'validation'

    CONSTRAINT fk_feedback FOREIGN KEY (lot_id) REFERENCES lots_gavage(id)
);

-- Index pour requêtes ML
CREATE INDEX idx_ml_data_lot ON consumer_feedback_ml_data(lot_id);
CREATE INDEX idx_ml_data_site ON consumer_feedback_ml_data(site_code, production_date);
CREATE INDEX idx_ml_data_training ON consumer_feedback_ml_data(used_for_training, train_test_split);

-- Commentaire
COMMENT ON TABLE consumer_feedback_ml_data IS 'Données préparées pour entraînement IA (corrélation prod ↔ feedback)';


-- ============================================================================
-- 7. TABLE ML INSIGHTS (Résultats modèles IA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consumer_feedback_ml_insights (
    insight_id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,              -- ex: "consumer_satisfaction_predictor_v1.2"
    model_version VARCHAR(20) NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Période analysée
    period_start DATE,
    period_end DATE,
    site_code VARCHAR(2),

    -- Corrélations découvertes
    correlations JSONB NOT NULL,                   -- {"itm_vs_flavor": 0.85, "sqal_vs_overall": 0.92, ...}

    -- Feature importance
    feature_importance JSONB NOT NULL,             -- {"sqal_score": 0.45, "itm": 0.32, "freshness": 0.23, ...}

    -- Recommandations production
    recommendations JSONB DEFAULT '[]'::jsonb,     -- ["Augmenter ITM moyen de 5%", "Améliorer uniformité surface", ...]

    -- Prédictions moyennes
    predicted_consumer_score_avg DECIMAL(4,2),     -- Score moyen prédit (1-5)
    prediction_accuracy DECIMAL(5,4),              -- Précision modèle (0-1)
    sample_size INTEGER,                           -- Nombre échantillons utilisés

    -- Métadonnées
    training_metrics JSONB,                        -- MAE, RMSE, R², etc.
    is_active BOOLEAN DEFAULT TRUE                 -- Dernier insight actif pour affichage
);

-- Index
CREATE INDEX idx_ml_insights_model ON consumer_feedback_ml_insights(model_name, model_version);
CREATE INDEX idx_ml_insights_site ON consumer_feedback_ml_insights(site_code, generated_at DESC);
CREATE INDEX idx_ml_insights_active ON consumer_feedback_ml_insights(is_active) WHERE is_active = TRUE;

-- Commentaire
COMMENT ON TABLE consumer_feedback_ml_insights IS 'Insights IA générés depuis corrélations production ↔ feedback';


-- ============================================================================
-- 8. FONCTION - GÉNÉRATION QR CODE
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_qr_code(
    p_lot_id INTEGER,
    p_sample_id VARCHAR DEFAULT NULL,
    p_site_code VARCHAR DEFAULT 'LL'
)
RETURNS VARCHAR AS $$
DECLARE
    v_product_id VARCHAR;
    v_qr_code VARCHAR;
    v_signature VARCHAR;
BEGIN
    -- Générer product_id unique : FG_{site}_{date}_{seq}
    v_product_id := 'FG_' || p_site_code || '_' || TO_CHAR(NOW(), 'YYYYMMDD') || '_' ||
                    LPAD(nextval('consumer_products_seq')::TEXT, 4, '0');

    -- Générer signature cryptographique (SHA256)
    v_signature := encode(digest(v_product_id || p_lot_id::TEXT || COALESCE(p_sample_id, '') || NOW()::TEXT, 'sha256'), 'hex');

    -- Construire QR code : SQAL_{lot_id}_{sample_id}_{product_id}_{signature[:16]}
    v_qr_code := 'SQAL_' || p_lot_id || '_' ||
                 COALESCE(p_sample_id, 'NOSAMPLE') || '_' ||
                 v_product_id || '_' ||
                 SUBSTRING(v_signature, 1, 16);

    RETURN v_qr_code;
END;
$$ LANGUAGE plpgsql;

-- Séquence pour product_id
CREATE SEQUENCE IF NOT EXISTS consumer_products_seq START 1;

-- Commentaire
COMMENT ON FUNCTION generate_qr_code IS 'Génère un QR code unique pour un produit';


-- ============================================================================
-- 9. FONCTION - ENREGISTREMENT PRODUIT APRÈS CONTRÔLE SQAL
-- ============================================================================

CREATE OR REPLACE FUNCTION register_consumer_product(
    p_lot_id INTEGER,
    p_sample_id VARCHAR,
    p_site_code VARCHAR
)
RETURNS TABLE (
    product_id VARCHAR,
    qr_code VARCHAR
) AS $$
DECLARE
    v_product_id VARCHAR;
    v_qr_code VARCHAR;
    v_signature VARCHAR;
    v_sqal_data RECORD;
    v_lot_data RECORD;
BEGIN
    -- Récupérer données SQAL
    SELECT
        fusion_final_score,
        fusion_final_grade,
        fusion_is_compliant,
        vl53l8ch_volume_mm3,
        vl53l8ch_surface_uniformity,
        as7341_freshness_index
    INTO v_sqal_data
    FROM sqal_sensor_samples
    WHERE sample_id = p_sample_id
    ORDER BY time DESC
    LIMIT 1;

    -- Récupérer données lot
    SELECT
        l.code_lot,
        l.itm_moyen,
        l.poids_moyen_final_g,
        l.date_debut_gavage,
        l.date_fin_prevue_gavage,
        EXTRACT(EPOCH FROM (l.date_fin_prevue_gavage - l.date_debut_gavage)) / 86400 as duration_days
    INTO v_lot_data
    FROM lots_gavage l
    WHERE l.id = p_lot_id;

    -- Générer QR code
    v_qr_code := generate_qr_code(p_lot_id, p_sample_id, p_site_code);

    -- Extraire product_id du QR code
    v_product_id := SPLIT_PART(v_qr_code, '_', 4);

    -- Extraire signature
    v_signature := SPLIT_PART(v_qr_code, '_', 5);

    -- Insérer produit
    INSERT INTO consumer_products (
        product_id,
        qr_code,
        qr_signature,
        lot_id,
        sample_id,
        site_code,
        production_date,
        quality_control_date,
        sqal_quality_score,
        sqal_grade,
        sqal_compliance,
        lot_itm,
        lot_avg_weight,
        gavage_duration_days,
        certifications,
        production_method
    ) VALUES (
        v_product_id,
        v_qr_code,
        v_signature,
        p_lot_id,
        p_sample_id,
        p_site_code,
        CURRENT_DATE,
        NOW(),
        v_sqal_data.fusion_final_score,
        v_sqal_data.fusion_final_grade,
        v_sqal_data.fusion_is_compliant,
        v_lot_data.itm_moyen,
        v_lot_data.poids_moyen_final_g,
        v_lot_data.duration_days,
        '["IGP Périgord"]'::jsonb,
        'traditionnel'
    );

    RETURN QUERY SELECT v_product_id, v_qr_code;
END;
$$ LANGUAGE plpgsql;

-- Commentaire
COMMENT ON FUNCTION register_consumer_product IS 'Enregistre un produit après contrôle SQAL et génère QR code';


-- ============================================================================
-- 10. FONCTION - CALCUL DÉLAI CONSOMMATION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_consumption_delay(
    p_product_id VARCHAR,
    p_consumption_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_production_date DATE;
    v_delay_days INTEGER;
BEGIN
    SELECT production_date INTO v_production_date
    FROM consumer_products
    WHERE product_id = p_product_id;

    v_delay_days := p_consumption_date - v_production_date;

    RETURN v_delay_days;
END;
$$ LANGUAGE plpgsql;

-- Commentaire
COMMENT ON FUNCTION calculate_consumption_delay IS 'Calcule délai entre production et consommation (jours)';


-- ============================================================================
-- 11. TRIGGER - AUTO-REMPLISSAGE ML DATA
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_populate_ml_data()
RETURNS TRIGGER AS $$
DECLARE
    v_product RECORD;
    v_sqal RECORD;
    v_lot RECORD;
    v_delay_days INTEGER;
BEGIN
    -- Récupérer produit
    SELECT * INTO v_product FROM consumer_products WHERE product_id = NEW.product_id;

    -- Si pas de sample_id SQAL, skip
    IF v_product.sample_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Récupérer données SQAL
    SELECT
        fusion_final_score,
        fusion_final_grade,
        vl53l8ch_volume_mm3,
        vl53l8ch_surface_uniformity,
        as7341_freshness_index,
        as7341_fat_quality_index,
        as7341_oxidation_index
    INTO v_sqal
    FROM sqal_sensor_samples
    WHERE sample_id = v_product.sample_id
    ORDER BY time DESC
    LIMIT 1;

    -- Récupérer données lot
    SELECT
        itm_moyen,
        poids_moyen_final_g,
        taux_mortalite_pct,
        indice_consommation
    INTO v_lot
    FROM lots_gavage
    WHERE id = v_product.lot_id;

    -- Calculer délai consommation
    v_delay_days := COALESCE(NEW.consumption_date - v_product.production_date, 0);

    -- Insérer dans ML data
    INSERT INTO consumer_feedback_ml_data (
        feedback_id,
        lot_id,
        sample_id,
        lot_itm,
        lot_avg_weight,
        lot_mortality_rate,
        lot_feed_conversion,
        sqal_score,
        sqal_grade,
        vl53l8ch_volume_mm3,
        vl53l8ch_surface_uniformity,
        as7341_freshness_index,
        as7341_fat_quality_index,
        as7341_oxidation_index,
        consumer_overall_rating,
        consumer_texture_rating,
        consumer_flavor_rating,
        consumer_freshness_rating,
        consumer_would_recommend,
        site_code,
        production_date,
        consumption_delay_days
    ) VALUES (
        NEW.feedback_id,
        v_product.lot_id,
        v_product.sample_id,
        v_lot.itm_moyen,
        v_lot.poids_moyen_final_g,
        v_lot.taux_mortalite_pct,
        v_lot.indice_consommation,
        v_sqal.fusion_final_score,
        v_sqal.fusion_final_grade,
        v_sqal.vl53l8ch_volume_mm3,
        v_sqal.vl53l8ch_surface_uniformity,
        v_sqal.as7341_freshness_index,
        v_sqal.as7341_fat_quality_index,
        v_sqal.as7341_oxidation_index,
        NEW.overall_rating,
        NEW.texture_rating,
        NEW.flavor_rating,
        NEW.freshness_rating,
        NEW.would_recommend,
        v_product.site_code,
        v_product.production_date,
        v_delay_days
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer trigger
DROP TRIGGER IF EXISTS trigger_auto_populate_ml_data ON consumer_feedbacks;
CREATE TRIGGER trigger_auto_populate_ml_data
    AFTER INSERT ON consumer_feedbacks
    FOR EACH ROW
    EXECUTE FUNCTION auto_populate_ml_data();

-- Commentaire
COMMENT ON FUNCTION auto_populate_ml_data IS 'Trigger : Auto-remplissage table ML après nouveau feedback';


-- ============================================================================
-- 12. DONNÉES EXEMPLE (OPTIONNEL - À SUPPRIMER EN PROD)
-- ============================================================================

-- Exemple : Enregistrer 3 produits après contrôles SQAL
DO $$
DECLARE
    v_result RECORD;
BEGIN
    -- Produit 1 : Site LL, Lot 1, Sample ESP32_LL_01
    -- (Nécessite que lot_id=1 et sample_id existent)
    -- SELECT * INTO v_result FROM register_consumer_product(1, 'ESP32_LL_01_sample_001', 'LL');
    -- RAISE NOTICE 'Produit 1 créé : % avec QR : %', v_result.product_id, v_result.qr_code;
END $$;


-- ============================================================================
-- RÉSUMÉ SCHEMA
-- ============================================================================

/*
TABLES CRÉÉES (7) :
1. consumer_products           - Produits finaux avec QR code
2. consumer_feedbacks          - Feedbacks consommateurs (hypertable)
3. consumer_feedback_ml_data   - Données ML (corrélation prod ↔ feedback)
4. consumer_feedback_ml_insights - Insights IA générés

VUES MATÉRIALISÉES (3) :
5. consumer_product_stats      - Stats par produit (refresh quotidien)
6. consumer_lot_stats          - Stats par lot et jour (continuous aggregate)
7. consumer_site_stats         - Stats par site et semaine (continuous aggregate)

FONCTIONS (3) :
- generate_qr_code()           - Génère QR code unique
- register_consumer_product()  - Enregistre produit après SQAL
- calculate_consumption_delay()- Calcule délai production → consommation

TRIGGERS (1) :
- auto_populate_ml_data()      - Auto-remplissage ML data après feedback

SÉQUENCES (1) :
- consumer_products_seq        - Séquence product_id

POLITIQUES TIMESCALEDB :
- Compression consumer_feedbacks après 30j
- Rétention consumer_feedbacks 5 ans
- Continuous aggregate consumer_lot_stats (refresh quotidien)
- Continuous aggregate consumer_site_stats (refresh hebdomadaire)

INTÉGRATIONS :
✅ Euralis  : lot_id → lots_gavage.id
✅ SQAL     : sample_id → sqal_sensor_samples.sample_id
✅ Sites    : site_code → sites_euralis.code
✅ Blockchain : blockchain_hash stocké pour vérification
*/
