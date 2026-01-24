-- ============================================
-- Système Gaveurs V2.1 - Schéma TimescaleDB
-- Base de données complète pour gavage intelligent
-- ============================================

-- Activer l'extension TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================
-- TABLES DE RÉFÉRENCE
-- ============================================

-- Table des gaveurs
CREATE TABLE gaveurs (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telephone VARCHAR(15) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    adresse TEXT,
    certifications TEXT[],
    actif BOOLEAN DEFAULT true,
    cle_publique_blockchain TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gaveurs_email ON gaveurs(email);
CREATE INDEX idx_gaveurs_telephone ON gaveurs(telephone);

-- Table des abattoirs
CREATE TABLE abattoirs (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(200) NOT NULL,
    adresse TEXT NOT NULL,
    ville VARCHAR(100) NOT NULL,
    code_postal VARCHAR(10) NOT NULL,
    numero_agrement VARCHAR(50) UNIQUE NOT NULL,
    contact_telephone VARCHAR(15) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des lots de maïs
CREATE TABLE lot_mais (
    id SERIAL PRIMARY KEY,
    numero_lot VARCHAR(50) UNIQUE NOT NULL,
    origine VARCHAR(200) NOT NULL,
    date_reception TIMESTAMPTZ NOT NULL,
    taux_humidite NUMERIC(5,2) CHECK (taux_humidite >= 0 AND taux_humidite <= 100),
    qualite_note NUMERIC(3,1) CHECK (qualite_note >= 0 AND qualite_note <= 10),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lot_mais_numero ON lot_mais(numero_lot);

-- Table des canards
CREATE TABLE canards (
    id SERIAL PRIMARY KEY,
    numero_identification VARCHAR(50) UNIQUE NOT NULL,
    gaveur_id INTEGER NOT NULL REFERENCES gaveurs(id),
    genetique VARCHAR(20) NOT NULL CHECK (genetique IN ('mulard', 'barbarie', 'pekin', 'mixte')),
    date_naissance TIMESTAMPTZ NOT NULL,
    origine_elevage VARCHAR(200) NOT NULL,
    numero_lot_canard VARCHAR(50) NOT NULL,
    poids_initial NUMERIC(6,2) NOT NULL CHECK (poids_initial >= 0),
    statut VARCHAR(20) DEFAULT 'en_gavage' CHECK (statut IN ('en_gavage', 'termine', 'decede')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canards_gaveur ON canards(gaveur_id);
CREATE INDEX idx_canards_numero ON canards(numero_identification);
CREATE INDEX idx_canards_genetique ON canards(genetique);
CREATE INDEX idx_canards_statut ON canards(statut);

-- ============================================
-- HYPERTABLES TIMESCALEDB (Séries temporelles)
-- ============================================

-- Table principale des données de gavage
CREATE TABLE gavage_data (
    time TIMESTAMPTZ NOT NULL,
    canard_id INTEGER NOT NULL REFERENCES canards(id),
    
    -- Doses de maïs
    dose_matin NUMERIC(6,2) NOT NULL CHECK (dose_matin >= 0),
    dose_soir NUMERIC(6,2) NOT NULL CHECK (dose_soir >= 0),
    dose_theorique_matin NUMERIC(6,2),
    dose_theorique_soir NUMERIC(6,2),
    
    -- Heures de gavage
    heure_gavage_matin TIME NOT NULL,
    heure_gavage_soir TIME NOT NULL,
    
    -- Poids
    poids_matin NUMERIC(6,2) CHECK (poids_matin >= 0),
    poids_soir NUMERIC(6,2) CHECK (poids_soir >= 0),
    
    -- Conditions environnementales
    temperature_stabule NUMERIC(4,1) NOT NULL CHECK (temperature_stabule >= -20 AND temperature_stabule <= 50),
    humidite_stabule NUMERIC(5,2) CHECK (humidite_stabule >= 0 AND humidite_stabule <= 100),
    qualite_air_co2 NUMERIC(6,1),
    luminosite NUMERIC(6,1),
    
    -- Référence lot maïs
    lot_mais_id INTEGER NOT NULL REFERENCES lot_mais(id),
    
    -- Observations
    remarques TEXT,
    comportement_observe TEXT,
    etat_sanitaire TEXT,
    
    -- Calculs automatiques
    correction_proposee TEXT,
    ecart_dose_matin NUMERIC(6,2),
    ecart_dose_soir NUMERIC(6,2),
    alerte_generee BOOLEAN DEFAULT false,
    
    PRIMARY KEY (time, canard_id)
);

-- Convertir en hypertable
SELECT create_hypertable('gavage_data', 'time');

-- Index pour requêtes rapides
CREATE INDEX idx_gavage_canard_time ON gavage_data (canard_id, time DESC);
CREATE INDEX idx_gavage_time_bucket ON gavage_data (time DESC);
CREATE INDEX idx_gavage_alertes ON gavage_data (alerte_generee, time DESC) WHERE alerte_generee = true;

-- Compression automatique après 7 jours
ALTER TABLE gavage_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'canard_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('gavage_data', INTERVAL '7 days');

-- Rétention: garder 2 ans de données
SELECT add_retention_policy('gavage_data', INTERVAL '2 years');

-- ============================================
-- CONTINUOUS AGGREGATES (Statistiques pré-calculées)
-- ============================================

-- Statistiques journalières par canard
CREATE MATERIALIZED VIEW gavage_daily_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', time) AS day,
    canard_id,
    AVG(poids_matin) as poids_moyen_matin,
    AVG(poids_soir) as poids_moyen_soir,
    AVG(poids_soir - poids_matin) as gain_poids_moyen,
    SUM(dose_matin + dose_soir) as dose_totale_jour,
    AVG(temperature_stabule) as temperature_moyenne,
    AVG(humidite_stabule) as humidite_moyenne,
    COUNT(*) as nb_mesures
FROM gavage_data
GROUP BY day, canard_id;

-- Politique de rafraîchissement continu
SELECT add_continuous_aggregate_policy('gavage_daily_stats',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Statistiques hebdomadaires par génétique
CREATE MATERIALIZED VIEW gavage_weekly_genetics
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 week', gd.time) AS week,
    c.genetique,
    COUNT(DISTINCT gd.canard_id) as nombre_canards,
    AVG(gd.poids_soir - gd.poids_matin) as gain_poids_moyen,
    AVG(gd.dose_matin + gd.dose_soir) as dose_moyenne_totale,
    AVG(gd.temperature_stabule) as temperature_moyenne
FROM gavage_data gd
JOIN canards c ON gd.canard_id = c.id
GROUP BY week, c.genetique;

-- ============================================
-- TABLES D'ALERTES ET NOTIFICATIONS
-- ============================================

CREATE TABLE alertes (
    time TIMESTAMPTZ NOT NULL,
    canard_id INTEGER NOT NULL REFERENCES canards(id),
    niveau VARCHAR(20) NOT NULL CHECK (niveau IN ('critique', 'important', 'info')),
    type_alerte VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    valeur_mesuree NUMERIC(10,2),
    valeur_seuil NUMERIC(10,2),
    sms_envoye BOOLEAN DEFAULT false,
    acquittee BOOLEAN DEFAULT false,
    acquittee_par INTEGER REFERENCES gaveurs(id),
    acquittee_le TIMESTAMPTZ,
    PRIMARY KEY (time, canard_id)
);

SELECT create_hypertable('alertes', 'time');
CREATE INDEX idx_alertes_niveau ON alertes (niveau, time DESC);
CREATE INDEX idx_alertes_non_acquittees ON alertes (acquittee, time DESC) WHERE acquittee = false;

-- ============================================
-- TABLES DE CORRECTIONS ET ML
-- ============================================

-- Historique des corrections de doses
CREATE TABLE corrections_doses (
    id SERIAL PRIMARY KEY,
    canard_id INTEGER NOT NULL REFERENCES canards(id),
    date TIMESTAMPTZ NOT NULL,
    dose_theorique NUMERIC(6,2) NOT NULL,
    dose_reelle NUMERIC(6,2) NOT NULL,
    ecart_absolu NUMERIC(6,2) NOT NULL,
    ecart_pourcentage NUMERIC(5,2) NOT NULL,
    correction_proposee TEXT NOT NULL,
    raison TEXT NOT NULL,
    impact_prevu TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_corrections_canard ON corrections_doses (canard_id, date DESC);
CREATE INDEX idx_corrections_date ON corrections_doses (date DESC);

-- Modèles de Machine Learning sauvegardés
CREATE TABLE ml_models (
    id SERIAL PRIMARY KEY,
    genetique VARCHAR(20) NOT NULL,
    formule_symbolique TEXT NOT NULL,
    score_r2 NUMERIC(5,4) NOT NULL,
    metadata JSONB,
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ml_models_genetique ON ml_models (genetique, created_at DESC);

-- Prédictions de courbes
CREATE TABLE predictions_courbes (
    id SERIAL PRIMARY KEY,
    canard_id INTEGER NOT NULL REFERENCES canards(id),
    date_prediction TIMESTAMPTZ NOT NULL,
    jours_gavage INTEGER[],
    poids_predits NUMERIC(6,2)[],
    doses_recommandees_matin NUMERIC(6,2)[],
    doses_recommandees_soir NUMERIC(6,2)[],
    confiance NUMERIC(3,2) CHECK (confiance >= 0 AND confiance <= 1),
    formule_symbolique TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predictions_canard ON predictions_courbes (canard_id, date_prediction DESC);

-- ============================================
-- BLOCKCHAIN (Traçabilité)
-- ============================================

CREATE TABLE blockchain (
    index INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    type_evenement VARCHAR(50) NOT NULL CHECK (type_evenement IN ('genesis', 'initialisation_canard', 'gavage', 'pesee', 'abattage', 'transport')),
    canard_id INTEGER NOT NULL,
    gaveur_id INTEGER NOT NULL REFERENCES gaveurs(id),
    abattoir_id INTEGER REFERENCES abattoirs(id),
    donnees JSONB NOT NULL,
    hash_precedent VARCHAR(64) NOT NULL,
    hash_actuel VARCHAR(64) NOT NULL,
    signature_numerique TEXT NOT NULL,
    PRIMARY KEY (index, timestamp)
);

SELECT create_hypertable('blockchain', 'timestamp');
CREATE INDEX idx_blockchain_canard ON blockchain (canard_id, timestamp DESC);
CREATE INDEX idx_blockchain_type ON blockchain (type_evenement, timestamp DESC);
CREATE INDEX idx_blockchain_hash ON blockchain (hash_actuel);

-- ============================================
-- TABLES DE MORTALITÉ
-- ============================================

CREATE TABLE mortalite (
    id SERIAL PRIMARY KEY,
    canard_id INTEGER NOT NULL REFERENCES canards(id),
    date_deces TIMESTAMPTZ NOT NULL,
    cause TEXT,
    poids_au_deces NUMERIC(6,2),
    jours_gavage_effectues INTEGER,
    rapport_veterinaire TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mortalite_date ON mortalite (date_deces DESC);

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue des canards en cours avec statistiques
CREATE VIEW canards_actifs_stats AS
SELECT 
    c.id,
    c.numero_identification,
    c.genetique,
    c.gaveur_id,
    g.nom || ' ' || g.prenom as gaveur_nom,
    c.poids_initial,
    EXTRACT(EPOCH FROM (NOW() - c.created_at))/86400 AS jours_gavage,
    COALESCE(last_data.poids_soir, c.poids_initial) as poids_actuel,
    COALESCE(last_data.poids_soir, c.poids_initial) - c.poids_initial as gain_total,
    COALESCE(stats.dose_totale, 0) as dose_totale_consommee,
    COALESCE(alertes_count.nb_alertes, 0) as nombre_alertes
FROM canards c
JOIN gaveurs g ON c.gaveur_id = g.id
LEFT JOIN LATERAL (
    SELECT poids_soir 
    FROM gavage_data 
    WHERE canard_id = c.id 
    ORDER BY time DESC 
    LIMIT 1
) last_data ON true
LEFT JOIN LATERAL (
    SELECT SUM(dose_matin + dose_soir) as dose_totale
    FROM gavage_data
    WHERE canard_id = c.id
) stats ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) as nb_alertes
    FROM alertes
    WHERE canard_id = c.id AND acquittee = false
) alertes_count ON true
WHERE c.statut = 'en_gavage';

-- Vue performance par gaveur
CREATE VIEW performance_gaveurs AS
SELECT 
    g.id,
    g.nom || ' ' || g.prenom as gaveur,
    COUNT(DISTINCT c.id) as nombre_canards_total,
    COUNT(DISTINCT CASE WHEN c.statut = 'en_gavage' THEN c.id END) as canards_en_cours,
    COUNT(DISTINCT CASE WHEN c.statut = 'termine' THEN c.id END) as canards_termines,
    COALESCE(AVG(
        CASE 
            WHEN c.statut = 'termine' 
            THEN (SELECT poids_soir FROM gavage_data WHERE canard_id = c.id ORDER BY time DESC LIMIT 1)
        END
    ), 0) as poids_moyen_final,
    COALESCE(
        COUNT(DISTINCT m.id)::NUMERIC / NULLIF(COUNT(DISTINCT c.id), 0) * 100,
        0
    ) as taux_mortalite_pct,
    COALESCE(corrections_stats.nb_corrections, 0) as corrections_totales,
    COALESCE(corrections_stats.ecart_moyen, 0) as ecart_moyen_pct
FROM gaveurs g
LEFT JOIN canards c ON g.id = c.gaveur_id
LEFT JOIN mortalite m ON c.id = m.canard_id
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as nb_corrections,
        AVG(cd.ecart_pourcentage) as ecart_moyen
    FROM corrections_doses cd
    JOIN canards c2 ON cd.canard_id = c2.id
    WHERE c2.gaveur_id = g.id
    AND cd.date >= NOW() - INTERVAL '30 days'
) corrections_stats ON true
GROUP BY g.id, g.nom, g.prenom, corrections_stats.nb_corrections, corrections_stats.ecart_moyen;

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour calculer l'indice de consommation
CREATE OR REPLACE FUNCTION calculer_indice_consommation(p_canard_id INTEGER)
RETURNS NUMERIC AS $$
DECLARE
    total_mais NUMERIC;
    gain_poids NUMERIC;
    poids_final NUMERIC;
    poids_init NUMERIC;
BEGIN
    -- Dose totale de maïs en kg
    SELECT COALESCE(SUM(dose_matin + dose_soir) / 1000.0, 0)
    INTO total_mais
    FROM gavage_data
    WHERE canard_id = p_canard_id;
    
    -- Poids initial et final
    SELECT poids_initial INTO poids_init FROM canards WHERE id = p_canard_id;
    
    SELECT COALESCE(poids_soir, poids_init)
    INTO poids_final
    FROM gavage_data
    WHERE canard_id = p_canard_id
    ORDER BY time DESC
    LIMIT 1;
    
    gain_poids := poids_final - poids_init;
    
    -- IC = kg maïs consommé / kg de gain de poids
    IF gain_poids > 0 THEN
        RETURN total_mais / (gain_poids / 1000.0);
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gaveurs_updated_at
    BEFORE UPDATE ON gaveurs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_canards_updated_at
    BEFORE UPDATE ON canards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONNÉES D'EXEMPLE (OPTIONNEL)
-- ============================================

-- Insérer un gaveur de test
INSERT INTO gaveurs (nom, prenom, email, telephone, password_hash, adresse)
VALUES 
    ('Dupont', 'Jean', 'jean.dupont@example.com', '+33612345678', 
     '$2b$12$KIXxKj8YP.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU',
     '12 Route des Landes, 40000 Mont-de-Marsan');

-- Insérer un abattoir
INSERT INTO abattoirs (nom, adresse, ville, code_postal, numero_agrement, contact_telephone)
VALUES 
    ('Abattoir des Landes', '5 Zone Industrielle', 'Mont-de-Marsan', '40000', 
     'FR-40-001-001', '+33558123456');

-- Insérer un lot de maïs
INSERT INTO lot_mais (numero_lot, origine, date_reception, taux_humidite, qualite_note)
VALUES 
    ('MAIS-2024-001', 'Ferme Durand, Chalosse', NOW() - INTERVAL '10 days', 14.5, 9.2);

-- ============================================
-- COMMENTAIRES SUR LES TABLES
-- ============================================

COMMENT ON TABLE gavage_data IS 'Hypertable principale des données de gavage avec séries temporelles';
COMMENT ON TABLE blockchain IS 'Blockchain pour traçabilité complète de la naissance à l abattoir';
COMMENT ON TABLE corrections_doses IS 'Historique des corrections proposées par l IA';
COMMENT ON TABLE ml_models IS 'Modèles de machine learning (régression symbolique)';
COMMENT ON TABLE alertes IS 'Alertes générées automatiquement avec notifications SMS';
