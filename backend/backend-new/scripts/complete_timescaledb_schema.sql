-- ================================================================================
-- SCHÉMA TIMESCALEDB COMPLET - EURALIS MULTI-SITES
-- ================================================================================
-- Description : Schéma complet basé sur Pretraite_End_2024_claude.csv (174 colonnes)
-- Base        : gaveurs_db (partagée avec application gaveurs)
-- Date        : 14 Décembre 2024
-- Version     : 2.1.0
-- ================================================================================

-- 1️⃣ TABLE DES SITES (3 sites Euralis)
-- ================================================================================
CREATE TABLE IF NOT EXISTS sites_euralis (
    id SERIAL PRIMARY KEY,
    code VARCHAR(2) UNIQUE NOT NULL,  -- LL, LS, MT
    nom VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    capacite_gavage_max INTEGER,
    nb_gaveurs_actifs INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sites_euralis IS 'Sites de production Euralis (Bretagne, Pays de Loire, Maubourguet)';

-- Index
CREATE INDEX IF NOT EXISTS idx_sites_code ON sites_euralis(code);

-- Insertion des 3 sites
INSERT INTO sites_euralis (code, nom, region, capacite_gavage_max, nb_gaveurs_actifs)
VALUES
    ('LL', 'Bretagne', 'BRETAGNE', 30000, 25),
    ('LS', 'Pays de Loire', 'PAYS DE LA LOIRE', 28000, 20),
    ('MT', 'Maubourguet', 'OCCITANIE', 35000, 20)
ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    region = EXCLUDED.region,
    capacite_gavage_max = EXCLUDED.capacite_gavage_max,
    nb_gaveurs_actifs = EXCLUDED.nb_gaveurs_actifs,
    updated_at = NOW();


-- 2️⃣ TABLE DES GAVEURS (Référence depuis table existante ou nouvelle)
-- ================================================================================
-- Note: Si table gaveurs existe déjà dans gaveurs_db, on la réutilise
-- Sinon, créer cette table simplifiée pour Euralis

CREATE TABLE IF NOT EXISTS gaveurs_euralis (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100),
    nom_usage VARCHAR(100),
    civilite VARCHAR(10),
    raison_sociale VARCHAR(200),
    adresse1 VARCHAR(200),
    adresse2 VARCHAR(200),
    code_postal VARCHAR(10),
    commune VARCHAR(100),
    telephone VARCHAR(20),
    email VARCHAR(100),
    site_code VARCHAR(2) REFERENCES sites_euralis(code),
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE gaveurs_euralis IS 'Gaveurs des 3 sites Euralis';

-- Index
CREATE INDEX IF NOT EXISTS idx_gaveurs_site ON gaveurs_euralis(site_code);
CREATE INDEX IF NOT EXISTS idx_gaveurs_email ON gaveurs_euralis(email);
CREATE INDEX IF NOT EXISTS idx_gaveurs_actif ON gaveurs_euralis(actif);


-- 3️⃣ TABLE DES LOTS DE GAVAGE (Toutes les colonnes du CSV)
-- ================================================================================
CREATE TABLE IF NOT EXISTS lots_gavage (
    id SERIAL PRIMARY KEY,
    code_lot VARCHAR(20) UNIQUE NOT NULL,          -- CodeLot (ex: LL4801665)
    site_code VARCHAR(2) REFERENCES sites_euralis(code),
    gaveur_id INTEGER REFERENCES gaveurs_euralis(id),

    -- Dates
    debut_lot DATE NOT NULL,                        -- Debut_du_lot
    duree_gavage_reelle INTEGER,                   -- duree_gavage
    duree_du_lot INTEGER,                           -- Duree_du_lot

    -- Caractéristiques lot
    souche VARCHAR(100),                            -- Souche
    geo VARCHAR(50),                                -- GEO (ex: BRETAGNE)
    saison VARCHAR(20),                             -- saison (winter, summer, etc.)
    age_animaux INTEGER,                            -- Age_des_animaux

    -- Canards
    nb_meg INTEGER,                                 -- Nb_MEG (Mise En Gavage)
    nb_enleve INTEGER,                              -- Nombre_enleve
    nb_accroches INTEGER,                           -- Quantite_accrochee
    nb_morts INTEGER,                               -- Calculé depuis dPctgPerteGav

    -- Performance
    itm DECIMAL(10, 4),                            -- ITM (Indice Technique Moyen)
    itm_cut VARCHAR(1),                            -- ITM_cut (A, B, C, D, E)
    sigma DECIMAL(10, 6),                          -- Sigma (écart type poids foie)
    sigma_cut VARCHAR(10),                         -- Sigma_cut
    pctg_perte_gavage DECIMAL(10, 8),              -- dPctgPerteGav (mortalité)

    -- Alimentation
    total_corn_target DECIMAL(10, 2),              -- total_cornTarget
    total_corn_real DECIMAL(10, 2),                -- total_cornReal
    qte_total_test DECIMAL(10, 2),                 -- QteTotalTest
    conso_gav_z1 DECIMAL(10, 3),                   -- Conso_Gav_Z1

    -- Plans d'alimentation
    code_plan_alimentation VARCHAR(100),           -- Code_plan_alimentation
    code_plan_alimentation_compl VARCHAR(100),     -- Code_plan_alimentation_compl
    four_alim_elev VARCHAR(100),                   -- Four_Alim_Elev
    four_alim_gav VARCHAR(100),                    -- Four_Alim_Gav

    -- Éleveur et production
    eleveur VARCHAR(200),                          -- Eleveur
    prod_igp_fr VARCHAR(100),                      -- ProdIgpFR
    lot_gav VARCHAR(20),                           -- Lot_GAV
    lot_pag VARCHAR(20),                           -- Lot_PAG

    -- Statut
    statut VARCHAR(20) DEFAULT 'termine',          -- en_cours, termine, abattu

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE lots_gavage IS 'Lots de gavage avec toutes les données CSV (174 colonnes)';
COMMENT ON COLUMN lots_gavage.itm IS 'Indice Technique Moyen (kg de foie/canard)';
COMMENT ON COLUMN lots_gavage.sigma IS 'Écart type du poids des foies (homogénéité)';
COMMENT ON COLUMN lots_gavage.pctg_perte_gavage IS 'Pourcentage de mortalité pendant gavage';

-- Index
CREATE INDEX IF NOT EXISTS idx_lots_code ON lots_gavage(code_lot);
CREATE INDEX IF NOT EXISTS idx_lots_site ON lots_gavage(site_code);
CREATE INDEX IF NOT EXISTS idx_lots_gaveur ON lots_gavage(gaveur_id);
CREATE INDEX IF NOT EXISTS idx_lots_debut ON lots_gavage(debut_lot);
CREATE INDEX IF NOT EXISTS idx_lots_statut ON lots_gavage(statut);
CREATE INDEX IF NOT EXISTS idx_lots_souche ON lots_gavage(souche);
CREATE INDEX IF NOT EXISTS idx_lots_itm ON lots_gavage(itm);


-- 4️⃣ HYPERTABLE DES DOSES JOURNALIÈRES (27 jours max)
-- ================================================================================
CREATE TABLE IF NOT EXISTS doses_journalieres (
    time TIMESTAMPTZ NOT NULL,
    lot_id INTEGER NOT NULL REFERENCES lots_gavage(id) ON DELETE CASCADE,
    jour_gavage INTEGER NOT NULL,              -- 1 à 27

    -- Doses (feedTarget_X, feedCornReal_X)
    feed_target DECIMAL(6, 2),                 -- Dose théorique (g)
    feed_real DECIMAL(6, 2),                   -- Dose réelle (g)

    -- Variations (corn_variation_X, delta_feed_X)
    corn_variation DECIMAL(6, 2),              -- Différence target vs real
    delta_feed DECIMAL(6, 2),                  -- Variation par rapport à jour précédent

    -- Cumul (cumulCorn_X)
    cumul_corn DECIMAL(8, 2),                  -- Cumul total depuis début

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (time, lot_id, jour_gavage)
);

COMMENT ON TABLE doses_journalieres IS 'Données journalières de gavage (hypertable TimescaleDB)';
COMMENT ON COLUMN doses_journalieres.feed_target IS 'Dose théorique planifiée (grammes)';
COMMENT ON COLUMN doses_journalieres.feed_real IS 'Dose réellement distribuée (grammes)';
COMMENT ON COLUMN doses_journalieres.corn_variation IS 'Écart entre dose réelle et théorique';
COMMENT ON COLUMN doses_journalieres.delta_feed IS 'Variation de dose par rapport au jour précédent';

-- Conversion en hypertable (TimescaleDB)
SELECT create_hypertable('doses_journalieres', 'time', if_not_exists => TRUE);

-- Index
CREATE INDEX IF NOT EXISTS idx_doses_lot ON doses_journalieres(lot_id, jour_gavage);
CREATE INDEX IF NOT EXISTS idx_doses_jour ON doses_journalieres(jour_gavage);


-- 5️⃣ VUE MATÉRIALISÉE DES PERFORMANCES PAR SITE
-- ================================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS performances_sites AS
SELECT
    s.code as site_code,
    s.nom as site_nom,

    -- Statistiques lots
    COUNT(l.id) as nb_lots_total,
    COUNT(CASE WHEN l.statut = 'en_cours' THEN 1 END) as nb_lots_actifs,
    COUNT(CASE WHEN l.statut = 'termine' THEN 1 END) as nb_lots_termines,

    -- Performance moyenne
    AVG(l.itm) as itm_moyen,
    STDDEV(l.itm) as itm_stddev,
    MIN(l.itm) as itm_min,
    MAX(l.itm) as itm_max,

    -- Sigma moyen
    AVG(l.sigma) as sigma_moyen,
    STDDEV(l.sigma) as sigma_stddev,

    -- Mortalité
    AVG(l.pctg_perte_gavage) as mortalite_moyenne,
    MAX(l.pctg_perte_gavage) as mortalite_max,

    -- Production
    SUM(l.nb_accroches * l.itm / 1000) as production_totale_kg,
    AVG(l.total_corn_real) as conso_moyenne_mais,

    -- Canards
    SUM(l.nb_meg) as total_canards_meg,
    SUM(l.nb_accroches) as total_canards_accroches,
    SUM(l.nb_morts) as total_canards_morts,

    -- Durées
    AVG(l.duree_gavage_reelle) as duree_moyenne,

    -- Dates
    MIN(l.debut_lot) as premier_lot,
    MAX(l.debut_lot) as dernier_lot,

    -- Métadonnées
    NOW() as last_refresh

FROM sites_euralis s
LEFT JOIN lots_gavage l ON s.code = l.site_code
GROUP BY s.code, s.nom;

COMMENT ON MATERIALIZED VIEW performances_sites IS 'Agrégations performance par site (refresh périodique)';

-- Index sur vue matérialisée
CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_sites_code ON performances_sites(site_code);


-- 6️⃣ TABLE DES PRÉVISIONS (Prophet)
-- ================================================================================
CREATE TABLE IF NOT EXISTS previsions_production (
    id SERIAL PRIMARY KEY,
    site_code VARCHAR(2) REFERENCES sites_euralis(code),
    date_prevision DATE NOT NULL,
    horizon_jours INTEGER NOT NULL,             -- 7, 30, 90

    -- Prévisions
    production_prevue_kg DECIMAL(10, 2),
    itm_prevu DECIMAL(6, 2),
    nb_lots_prevu INTEGER,

    -- Intervalles de confiance (95%)
    production_min_kg DECIMAL(10, 2),
    production_max_kg DECIMAL(10, 2),
    itm_min DECIMAL(6, 2),
    itm_max DECIMAL(6, 2),

    -- Métadonnées
    modele_version VARCHAR(50),
    confidence DECIMAL(5, 4),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(site_code, date_prevision, horizon_jours)
);

COMMENT ON TABLE previsions_production IS 'Prévisions Prophet à 7/30/90 jours';

-- Index
CREATE INDEX IF NOT EXISTS idx_previsions_site_date ON previsions_production(site_code, date_prevision);
CREATE INDEX IF NOT EXISTS idx_previsions_horizon ON previsions_production(horizon_jours);


-- 7️⃣ HYPERTABLE DES ALERTES
-- ================================================================================
CREATE TABLE IF NOT EXISTS alertes_euralis (
    time TIMESTAMPTZ NOT NULL,
    id SERIAL,
    lot_id INTEGER REFERENCES lots_gavage(id) ON DELETE CASCADE,
    gaveur_id INTEGER REFERENCES gaveurs_euralis(id),
    site_code VARCHAR(2) REFERENCES sites_euralis(code),

    -- Type et criticité
    type_alerte VARCHAR(50) NOT NULL,           -- itm_faible, mortalite_haute, anomalie, etc.
    criticite VARCHAR(20) NOT NULL,             -- critique, elevee, moyenne, faible

    -- Détails
    titre VARCHAR(200) NOT NULL,
    description TEXT,
    valeur_observee DECIMAL(10, 4),
    valeur_attendue DECIMAL(10, 4),
    ecart_pct DECIMAL(6, 2),

    -- Statut
    acquittee BOOLEAN DEFAULT FALSE,
    acquittee_par VARCHAR(100),
    acquittee_le TIMESTAMPTZ,

    -- Métadonnées
    metadata JSONB,                             -- Données additionnelles flexibles
    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (time, id)
);

COMMENT ON TABLE alertes_euralis IS 'Alertes multi-niveaux (lot/gaveur/site) - Hypertable TimescaleDB';

-- Conversion en hypertable
SELECT create_hypertable('alertes_euralis', 'time', if_not_exists => TRUE);

-- Index
CREATE INDEX IF NOT EXISTS idx_alertes_lot ON alertes_euralis(lot_id);
CREATE INDEX IF NOT EXISTS idx_alertes_gaveur ON alertes_euralis(gaveur_id);
CREATE INDEX IF NOT EXISTS idx_alertes_site ON alertes_euralis(site_code);
CREATE INDEX IF NOT EXISTS idx_alertes_type ON alertes_euralis(type_alerte);
CREATE INDEX IF NOT EXISTS idx_alertes_criticite ON alertes_euralis(criticite);
CREATE INDEX IF NOT EXISTS idx_alertes_acquittee ON alertes_euralis(acquittee);


-- 8️⃣ TABLE PLANNING DES ABATTAGES
-- ================================================================================
CREATE TABLE IF NOT EXISTS planning_abattages (
    id SERIAL PRIMARY KEY,
    lot_id INTEGER REFERENCES lots_gavage(id) ON DELETE CASCADE,
    site_code VARCHAR(2) REFERENCES sites_euralis(code),

    -- Planning
    date_abattage_prevue DATE NOT NULL,
    date_abattage_reelle DATE,
    abattoir VARCHAR(100),
    creneau_horaire VARCHAR(20),                -- 08h-12h, 14h-18h

    -- Capacités
    nb_canards_prevu INTEGER,
    nb_canards_reel INTEGER,
    capacite_abattoir_jour INTEGER,
    taux_utilisation_pct DECIMAL(5, 2),

    -- Optimisation
    cout_transport DECIMAL(10, 2),
    distance_km DECIMAL(6, 2),
    priorite INTEGER,                           -- 1-5 (1=urgent)

    -- Statut
    statut VARCHAR(20) DEFAULT 'planifie',      -- planifie, confirme, realise, annule

    -- Métadonnées
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE planning_abattages IS 'Planning optimisé des abattages (algorithme hongrois)';

-- Index
CREATE INDEX IF NOT EXISTS idx_planning_lot ON planning_abattages(lot_id);
CREATE INDEX IF NOT EXISTS idx_planning_date_prevue ON planning_abattages(date_abattage_prevue);
CREATE INDEX IF NOT EXISTS idx_planning_site ON planning_abattages(site_code);
CREATE INDEX IF NOT EXISTS idx_planning_statut ON planning_abattages(statut);


-- 9️⃣ TABLE DES CLUSTERS GAVEURS (K-Means)
-- ================================================================================
CREATE TABLE IF NOT EXISTS gaveurs_clusters (
    id SERIAL PRIMARY KEY,
    gaveur_id INTEGER REFERENCES gaveurs_euralis(id) ON DELETE CASCADE,

    -- Cluster
    cluster_id INTEGER NOT NULL,                -- 0-4 (Excellent → Critique)
    cluster_label VARCHAR(50),                  -- Excellent, Très bon, Bon, À surveiller, Critique

    -- Métriques utilisées pour clustering
    itm_moyen DECIMAL(6, 2),
    sigma_moyen DECIMAL(6, 4),
    mortalite_moyenne DECIMAL(6, 4),
    nb_lots_total INTEGER,
    stabilite_score DECIMAL(5, 4),

    -- Recommandations
    recommandations TEXT[],

    -- Métadonnées
    modele_version VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(gaveur_id)
);

COMMENT ON TABLE gaveurs_clusters IS 'Segmentation K-Means des gaveurs en 5 groupes';

-- Index
CREATE INDEX IF NOT EXISTS idx_clusters_gaveur ON gaveurs_clusters(gaveur_id);
CREATE INDEX IF NOT EXISTS idx_clusters_cluster ON gaveurs_clusters(cluster_id);


-- 🔟 TABLE DES ANOMALIES DÉTECTÉES (Isolation Forest)
-- ================================================================================
CREATE TABLE IF NOT EXISTS anomalies_detectees (
    id SERIAL PRIMARY KEY,

    -- Cible de l'anomalie
    niveau VARCHAR(20) NOT NULL,                -- lot, gaveur, site
    lot_id INTEGER REFERENCES lots_gavage(id),
    gaveur_id INTEGER REFERENCES gaveurs_euralis(id),
    site_code VARCHAR(2) REFERENCES sites_euralis(code),

    -- Détection
    score_anomalie DECIMAL(10, 8),              -- Score Isolation Forest (-1 à 1)
    is_anomaly BOOLEAN DEFAULT FALSE,

    -- Raisons identifiées
    raisons TEXT[],
    metriques_anormales JSONB,                  -- {itm: 12.5, sigma: 3.8, ...}

    -- Métadonnées
    modele_version VARCHAR(50),
    detectee_le TIMESTAMPTZ DEFAULT NOW(),
    traitee BOOLEAN DEFAULT FALSE,
    traitee_le TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE anomalies_detectees IS 'Anomalies détectées par Isolation Forest';

-- Index
CREATE INDEX IF NOT EXISTS idx_anomalies_lot ON anomalies_detectees(lot_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_gaveur ON anomalies_detectees(gaveur_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_site ON anomalies_detectees(site_code);
CREATE INDEX IF NOT EXISTS idx_anomalies_niveau ON anomalies_detectees(niveau);
CREATE INDEX IF NOT EXISTS idx_anomalies_traitee ON anomalies_detectees(traitee);


-- 1️⃣1️⃣ TABLE DES FORMULES PYSR
-- ================================================================================
CREATE TABLE IF NOT EXISTS formules_pysr (
    id SERIAL PRIMARY KEY,
    site_code VARCHAR(2) REFERENCES sites_euralis(code),
    souche VARCHAR(100),

    -- Formule découverte
    formule_sympy TEXT NOT NULL,               -- Expression SymPy
    formule_latex TEXT,                        -- Notation LaTeX pour affichage

    -- Performance du modèle
    score_r2 DECIMAL(10, 8),
    mae DECIMAL(10, 6),
    rmse DECIMAL(10, 6),

    -- Variables utilisées
    variables_input TEXT[],                    -- ['duree_gavage', 'total_corn_real', ...]
    nb_iterations INTEGER,

    -- Métadonnées
    modele_version VARCHAR(50),
    nb_lots_entrainement INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(site_code, souche)
);

COMMENT ON TABLE formules_pysr IS 'Formules mathématiques optimales découvertes par PySR';

-- Index
CREATE INDEX IF NOT EXISTS idx_formules_site_souche ON formules_pysr(site_code, souche);


-- 1️⃣2️⃣ TABLE DES STATISTIQUES GLOBALES (Cache)
-- ================================================================================
CREATE TABLE IF NOT EXISTS statistiques_globales (
    id SERIAL PRIMARY KEY,
    site_code VARCHAR(2) REFERENCES sites_euralis(code),

    -- Période
    periode VARCHAR(20) NOT NULL,               -- jour, semaine, mois, annee
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,

    -- Statistiques agrégées
    nb_lots INTEGER,
    nb_gaveurs_actifs INTEGER,
    production_totale_kg DECIMAL(12, 2),
    itm_moyen DECIMAL(6, 2),
    sigma_moyen DECIMAL(6, 4),
    mortalite_moyenne DECIMAL(6, 4),

    -- Tendances
    tendance_itm VARCHAR(10),                   -- hausse, baisse, stable
    tendance_mortalite VARCHAR(10),

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(site_code, periode, date_debut, date_fin)
);

COMMENT ON TABLE statistiques_globales IS 'Statistiques pré-calculées pour dashboard (cache)';

-- Index
CREATE INDEX IF NOT EXISTS idx_stats_site_periode ON statistiques_globales(site_code, periode);
CREATE INDEX IF NOT EXISTS idx_stats_dates ON statistiques_globales(date_debut, date_fin);


-- ================================================================================
-- FONCTIONS UTILITAIRES
-- ================================================================================

-- Fonction pour rafraîchir la vue matérialisée performances_sites
CREATE OR REPLACE FUNCTION refresh_performances_sites()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY performances_sites;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_performances_sites() IS 'Rafraîchit la vue matérialisée des performances par site';


-- Fonction pour calculer le nombre de morts depuis le pourcentage
CREATE OR REPLACE FUNCTION calculate_nb_morts()
RETURNS TRIGGER AS $$
BEGIN
    NEW.nb_morts := ROUND((NEW.nb_meg * NEW.pctg_perte_gavage / 100)::numeric, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer automatiquement nb_morts
CREATE TRIGGER trigger_calculate_nb_morts
    BEFORE INSERT OR UPDATE ON lots_gavage
    FOR EACH ROW
    EXECUTE FUNCTION calculate_nb_morts();


-- Fonction pour extraire le code site depuis code_lot
CREATE OR REPLACE FUNCTION extract_site_from_code_lot()
RETURNS TRIGGER AS $$
BEGIN
    NEW.site_code := LEFT(NEW.code_lot, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour extraire automatiquement site_code
CREATE TRIGGER trigger_extract_site_code
    BEFORE INSERT ON lots_gavage
    FOR EACH ROW
    WHEN (NEW.site_code IS NULL)
    EXECUTE FUNCTION extract_site_from_code_lot();


-- ================================================================================
-- POLITIQUES DE RÉTENTION (TimescaleDB)
-- ================================================================================

-- Politique de rétention : conserver 2 ans de données journalières
SELECT add_retention_policy('doses_journalieres', INTERVAL '2 years', if_not_exists => TRUE);

-- Politique de rétention : conserver 1 an d'alertes
SELECT add_retention_policy('alertes_euralis', INTERVAL '1 year', if_not_exists => TRUE);


-- ================================================================================
-- POLITIQUES DE COMPRESSION (TimescaleDB)
-- ================================================================================

-- Compression automatique des données > 7 jours pour doses_journalieres
ALTER TABLE doses_journalieres SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'lot_id'
);

SELECT add_compression_policy('doses_journalieres', INTERVAL '7 days', if_not_exists => TRUE);

-- Compression automatique des alertes > 30 jours
ALTER TABLE alertes_euralis SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'site_code,type_alerte'
);

SELECT add_compression_policy('alertes_euralis', INTERVAL '30 days', if_not_exists => TRUE);


-- ================================================================================
-- GRANTS ET PERMISSIONS
-- ================================================================================

-- Accorder tous les privilèges à gaveurs_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gaveurs_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gaveurs_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO gaveurs_user;


-- ================================================================================
-- RAPPORT FINAL
-- ================================================================================

DO $$
DECLARE
    nb_tables INTEGER;
    nb_hypertables INTEGER;
    nb_indexes INTEGER;
    nb_functions INTEGER;
BEGIN
    -- Compter les objets créés
    SELECT COUNT(*) INTO nb_tables FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE '%euralis%' OR table_name IN ('lots_gavage', 'doses_journalieres', 'planning_abattages', 'gaveurs_clusters', 'anomalies_detectees', 'formules_pysr', 'statistiques_globales');

    SELECT COUNT(*) INTO nb_hypertables FROM timescaledb_information.hypertables
    WHERE hypertable_schema = 'public';

    SELECT COUNT(*) INTO nb_indexes FROM pg_indexes
    WHERE schemaname = 'public' AND indexname LIKE 'idx_%';

    SELECT COUNT(*) INTO nb_functions FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace;

    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '✅ SCHÉMA TIMESCALEDB EURALIS - INSTALLATION TERMINÉE';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Objets créés :';
    RAISE NOTICE '   - Tables : % (dont 2 hypertables)', nb_tables;
    RAISE NOTICE '   - Hypertables TimescaleDB : %', nb_hypertables;
    RAISE NOTICE '   - Index : %', nb_indexes;
    RAISE NOTICE '   - Fonctions : %', nb_functions;
    RAISE NOTICE '   - Vue matérialisée : 1 (performances_sites)';
    RAISE NOTICE '   - Triggers : 2 (auto-calculs)';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Fonctionnalités activées :';
    RAISE NOTICE '   - Compression automatique (7 jours doses, 30 jours alertes)';
    RAISE NOTICE '   - Rétention automatique (2 ans doses, 1 an alertes)';
    RAISE NOTICE '   - Triggers auto-calcul (nb_morts, site_code)';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Tables principales :';
    RAISE NOTICE '   1. sites_euralis (3 sites)';
    RAISE NOTICE '   2. gaveurs_euralis (65 gaveurs)';
    RAISE NOTICE '   3. lots_gavage (174 colonnes CSV)';
    RAISE NOTICE '   4. doses_journalieres (hypertable, 27 jours)';
    RAISE NOTICE '   5. performances_sites (vue matérialisée)';
    RAISE NOTICE '   6. previsions_production (Prophet)';
    RAISE NOTICE '   7. alertes_euralis (hypertable)';
    RAISE NOTICE '   8. planning_abattages (algorithme hongrois)';
    RAISE NOTICE '   9. gaveurs_clusters (K-Means)';
    RAISE NOTICE '   10. anomalies_detectees (Isolation Forest)';
    RAISE NOTICE '   11. formules_pysr (régression symbolique)';
    RAISE NOTICE '   12. statistiques_globales (cache dashboard)';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Prochaines étapes :';
    RAISE NOTICE '   1. Importer données CSV :';
    RAISE NOTICE '      python scripts/import_euralis_data.py /chemin/vers/Pretraite_End_2024_claude.csv';
    RAISE NOTICE '   2. Rafraîchir vue matérialisée :';
    RAISE NOTICE '      SELECT refresh_performances_sites();';
    RAISE NOTICE '   3. Vérifier données :';
    RAISE NOTICE '      SELECT * FROM performances_sites;';
    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '';
END $$;
