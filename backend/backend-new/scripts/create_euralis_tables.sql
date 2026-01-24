-- ============================================================================
-- EURALIS - Tables de Base de Données Multi-Sites
-- ============================================================================
-- Description : Création des 7 tables Euralis pour pilotage multi-sites
-- Sites : LL (Bretagne), LS (Pays de Loire), MT (Maubourguet)
-- Date : 2024-12-14
-- ============================================================================

-- ============================================================================
-- 1. TABLE SITES EURALIS
-- ============================================================================
-- 3 sites de production Euralis

CREATE TABLE IF NOT EXISTS sites_euralis (
    id SERIAL PRIMARY KEY,
    code VARCHAR(2) UNIQUE NOT NULL,  -- LL, LS, MT
    nom VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    adresse TEXT,
    responsable_site VARCHAR(100),
    telephone VARCHAR(20),
    email VARCHAR(255),
    capacite_gavage_max INTEGER,
    nb_gaveurs_actifs INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sites_code ON sites_euralis(code);

-- Données initiales des 3 sites
INSERT INTO sites_euralis (code, nom, region, capacite_gavage_max)
VALUES
    ('LL', 'Site Bretagne', 'Bretagne', 50000),
    ('LS', 'Site Pays de Loire', 'Pays de Loire', 80000),
    ('MT', 'Site Maubourguet', 'Occitanie', 80000)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. TABLE LOTS DE GAVAGE MULTI-SITES
-- ============================================================================
-- Extension pour gérer les lots des 3 sites

CREATE TABLE IF NOT EXISTS lots_gavage (
    id SERIAL PRIMARY KEY,
    code_lot VARCHAR(20) UNIQUE NOT NULL,  -- LL4801665, LS4801107, MT...
    site_code VARCHAR(2) NOT NULL REFERENCES sites_euralis(code),
    gaveur_id INTEGER,  -- REFERENCES gaveurs(id) - à créer si nécessaire
    eleveur VARCHAR(100),
    souche VARCHAR(50),  -- CF80*, MMG AS - PKL*, etc.

    -- Dates
    debut_lot DATE NOT NULL,
    fin_lot_prevue DATE,
    fin_lot_reelle DATE,
    date_abattage DATE,

    -- Quantités
    nb_canards_meg INTEGER,  -- Mise En Gavage
    nb_canards_enleves INTEGER,
    nb_canards_accroches INTEGER,  -- Abattus
    nb_canards_morts INTEGER,

    -- Durées
    duree_gavage_prevue INTEGER,
    duree_gavage_reelle INTEGER,
    age_animaux INTEGER,

    -- Performances
    itm DECIMAL(5,2),  -- Indice Technique Moyen
    itm_cut VARCHAR(10),  -- Catégorie ITM
    sigma DECIMAL(5,2),  -- Écart type poids foie
    sigma_cut VARCHAR(10),
    pctg_perte_gavage DECIMAL(5,2),  -- % mortalité

    -- Consommation maïs
    total_corn_target DECIMAL(8,2),  -- kg théorique
    total_corn_real DECIMAL(8,2),    -- kg réel
    qte_total_test DECIMAL(8,2),
    conso_gav_z1 DECIMAL(8,2),

    -- Plans alimentation
    code_plan_alimentation VARCHAR(50),
    four_alim_elev VARCHAR(100),
    four_alim_gav VARCHAR(100),
    code_plan_compl VARCHAR(50),

    -- Qualité
    prod_igp_fr BOOLEAN DEFAULT false,

    -- Statut
    statut VARCHAR(20) DEFAULT 'en_cours',  -- en_cours, termine, abattu

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes Euralis
CREATE INDEX IF NOT EXISTS idx_lots_site ON lots_gavage(site_code);
CREATE INDEX IF NOT EXISTS idx_lots_gaveur ON lots_gavage(gaveur_id);
CREATE INDEX IF NOT EXISTS idx_lots_debut ON lots_gavage(debut_lot);
CREATE INDEX IF NOT EXISTS idx_lots_statut ON lots_gavage(statut);
CREATE INDEX IF NOT EXISTS idx_lots_site_statut ON lots_gavage(site_code, statut);
CREATE INDEX IF NOT EXISTS idx_lots_code ON lots_gavage(code_lot);

-- ============================================================================
-- 3. TABLE DOSES JOURNALIÈRES (TimescaleDB Hypertable)
-- ============================================================================
-- Doses quotidiennes de maïs pour chaque lot (jusqu'à 27 jours)

CREATE TABLE IF NOT EXISTS doses_journalieres (
    time TIMESTAMPTZ NOT NULL,
    lot_id INTEGER NOT NULL REFERENCES lots_gavage(id) ON DELETE CASCADE,
    jour_gavage INTEGER NOT NULL,  -- 1 à 27

    -- Doses
    feed_target DECIMAL(6,2),  -- Dose théorique (g)
    feed_real DECIMAL(6,2),    -- Dose réelle (g)

    -- Calculs
    corn_variation DECIMAL(6,2),  -- Écart
    cumul_corn DECIMAL(8,2),       -- Cumul depuis début
    delta_feed DECIMAL(6,2),       -- Variation vs J-1

    -- Métadonnées
    saisie_par INTEGER,
    remarques TEXT,

    PRIMARY KEY (time, lot_id, jour_gavage)
);

-- Créer hypertable TimescaleDB
SELECT create_hypertable('doses_journalieres', 'time', if_not_exists => TRUE);

-- Index
CREATE INDEX IF NOT EXISTS idx_doses_lot ON doses_journalieres(lot_id, jour_gavage);
CREATE INDEX IF NOT EXISTS idx_doses_time ON doses_journalieres(time DESC);

-- ============================================================================
-- 4. VUE MATÉRIALISÉE PERFORMANCES SITES
-- ============================================================================
-- Agrégations pré-calculées pour analytics rapides

CREATE MATERIALIZED VIEW IF NOT EXISTS performances_sites AS
SELECT
    s.code as site_code,
    s.nom as site_nom,
    DATE_TRUNC('month', l.debut_lot) as mois,

    -- Volumes
    COUNT(DISTINCT l.id) as nb_lots,
    COUNT(DISTINCT l.gaveur_id) as nb_gaveurs,
    SUM(l.nb_canards_meg) as total_canards_meg,
    SUM(l.nb_canards_accroches) as total_canards_abattus,
    SUM(l.nb_canards_morts) as total_canards_morts,

    -- Performances
    AVG(l.itm) as itm_moyen,
    STDDEV(l.itm) as itm_ecart_type,
    AVG(l.sigma) as sigma_moyen,
    AVG(l.pctg_perte_gavage) as mortalite_moyenne,
    AVG(l.duree_gavage_reelle) as duree_moyenne,

    -- Consommation
    SUM(l.total_corn_real) as total_mais_kg,
    AVG(l.total_corn_real / NULLIF(l.nb_canards_meg, 0)) as mais_par_canard_kg,

    -- Production estimée foie gras
    SUM(l.nb_canards_accroches * l.itm / 1000) as production_foie_kg,

    -- Taux de réussite
    AVG(l.nb_canards_accroches::DECIMAL / NULLIF(l.nb_canards_meg, 0) * 100) as taux_reussite_pct

FROM lots_gavage l
JOIN sites_euralis s ON l.site_code = s.code
WHERE l.statut IN ('termine', 'abattu')
GROUP BY s.code, s.nom, DATE_TRUNC('month', l.debut_lot);

-- Index sur vue matérialisée
CREATE INDEX IF NOT EXISTS idx_perf_sites_mois ON performances_sites(mois DESC);
CREATE INDEX IF NOT EXISTS idx_perf_sites_code ON performances_sites(site_code);

-- ============================================================================
-- 5. TABLE PRÉVISIONS PRODUCTION (IA/ML)
-- ============================================================================
-- Stockage des prévisions générées par Prophet

CREATE TABLE IF NOT EXISTS previsions_production (
    id SERIAL PRIMARY KEY,
    site_code VARCHAR(2) REFERENCES sites_euralis(code),
    date_prevision DATE NOT NULL,
    horizon_jours INTEGER NOT NULL,  -- 7, 14, 30, 90 jours

    -- Prévisions
    nb_lots_prevu INTEGER,
    nb_canards_prevu INTEGER,
    production_foie_kg_prevu DECIMAL(10,2),
    chiffre_affaires_prevu DECIMAL(12,2),

    -- Intervalles de confiance
    production_min DECIMAL(10,2),
    production_max DECIMAL(10,2),
    confiance_pct DECIMAL(5,2),

    -- Métadonnées
    methode VARCHAR(50),  -- prophet, arima, regression
    modele_version VARCHAR(20),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_prev_site_date ON previsions_production(site_code, date_prevision DESC);
CREATE INDEX IF NOT EXISTS idx_prev_horizon ON previsions_production(horizon_jours);

-- ============================================================================
-- 6. TABLE ALERTES EURALIS (TimescaleDB Hypertable)
-- ============================================================================
-- Système d'alertes multi-niveaux (coopérative, site, gaveur, lot)

CREATE TABLE IF NOT EXISTS alertes_euralis (
    id SERIAL PRIMARY KEY,
    time TIMESTAMPTZ DEFAULT NOW(),

    -- Scope
    niveau VARCHAR(20) NOT NULL,  -- cooperative, site, gaveur, lot
    site_code VARCHAR(2) REFERENCES sites_euralis(code),
    gaveur_id INTEGER,  -- REFERENCES gaveurs(id)
    lot_id INTEGER REFERENCES lots_gavage(id),

    -- Alerte
    type_alerte VARCHAR(100) NOT NULL,
    severite VARCHAR(20) NOT NULL,  -- critique, important, warning, info
    message TEXT NOT NULL,

    -- Données
    valeur_mesuree DECIMAL(10,2),
    valeur_seuil DECIMAL(10,2),
    valeur_reference DECIMAL(10,2),

    -- Actions
    action_requise TEXT,
    acquittee BOOLEAN DEFAULT false,
    acquittee_par INTEGER,
    acquittee_le TIMESTAMPTZ,

    -- Notifications
    sms_envoye BOOLEAN DEFAULT false,
    email_envoye BOOLEAN DEFAULT false,

    -- Blockchain
    blockchain_hash VARCHAR(64)
);

-- Créer hypertable TimescaleDB
SELECT create_hypertable('alertes_euralis', 'time', if_not_exists => TRUE);

-- Index
CREATE INDEX IF NOT EXISTS idx_alertes_niveau ON alertes_euralis(niveau, severite);
CREATE INDEX IF NOT EXISTS idx_alertes_site ON alertes_euralis(site_code, time DESC);
CREATE INDEX IF NOT EXISTS idx_alertes_acquittee ON alertes_euralis(acquittee);

-- ============================================================================
-- 7. TABLE PLANNING ABATTAGES
-- ============================================================================
-- Gestion du planning des abattages par site

CREATE TABLE IF NOT EXISTS planning_abattages (
    id SERIAL PRIMARY KEY,
    site_code VARCHAR(2) NOT NULL REFERENCES sites_euralis(code),
    abattoir VARCHAR(100) NOT NULL,

    -- Dates
    date_abattage DATE NOT NULL,
    heure_debut TIME,
    heure_fin TIME,

    -- Capacités
    capacite_max INTEGER,
    nb_lots_planifies INTEGER DEFAULT 0,
    nb_canards_planifies INTEGER DEFAULT 0,

    -- Lots associés
    lots_ids INTEGER[],

    -- Statut
    statut VARCHAR(20) DEFAULT 'planifie',  -- planifie, confirme, realise, annule

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_planning_site_date ON planning_abattages(site_code, date_abattage);
CREATE INDEX IF NOT EXISTS idx_planning_statut ON planning_abattages(statut);
CREATE INDEX IF NOT EXISTS idx_planning_date ON planning_abattages(date_abattage DESC);

-- ============================================================================
-- FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour lots_gavage
DROP TRIGGER IF EXISTS update_lots_gavage_updated_at ON lots_gavage;
CREATE TRIGGER update_lots_gavage_updated_at
    BEFORE UPDATE ON lots_gavage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour planning_abattages
DROP TRIGGER IF EXISTS update_planning_abattages_updated_at ON planning_abattages;
CREATE TRIGGER update_planning_abattages_updated_at
    BEFORE UPDATE ON planning_abattages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- POLITIQUE DE REFRESH VUE MATÉRIALISÉE
-- ============================================================================

-- Refresh automatique de performances_sites toutes les heures
-- (À configurer via cron job ou pg_cron si disponible)

-- Commande manuelle de refresh :
-- REFRESH MATERIALIZED VIEW CONCURRENTLY performances_sites;

-- ============================================================================
-- VÉRIFICATIONS ET STATISTIQUES
-- ============================================================================

-- Vérifier les tables créées
DO $$
BEGIN
    RAISE NOTICE '✅ Table sites_euralis : % lignes', (SELECT COUNT(*) FROM sites_euralis);
    RAISE NOTICE '✅ Table lots_gavage créée';
    RAISE NOTICE '✅ Table doses_journalieres (hypertable) créée';
    RAISE NOTICE '✅ Vue matérialisée performances_sites créée';
    RAISE NOTICE '✅ Table previsions_production créée';
    RAISE NOTICE '✅ Table alertes_euralis (hypertable) créée';
    RAISE NOTICE '✅ Table planning_abattages créée';
    RAISE NOTICE '';
    RAISE NOTICE '🏢 Sites Euralis configurés :';
    RAISE NOTICE '   - LL : Bretagne';
    RAISE NOTICE '   - LS : Pays de Loire';
    RAISE NOTICE '   - MT : Maubourguet';
END $$;

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================
