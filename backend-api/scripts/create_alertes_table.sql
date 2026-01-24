-- ============================================================================
-- TABLE ALERTES (pour les gaveurs individuels)
-- ============================================================================
-- Cette table stocke les alertes pour chaque canard (différent de alertes_euralis)
-- Structure basée sur les requêtes dans app/ml/anomaly_detection.py et app/main.py
-- ============================================================================

CREATE TABLE IF NOT EXISTS alertes (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    id SERIAL,

    -- Relations
    canard_id INTEGER NOT NULL REFERENCES canards(id) ON DELETE CASCADE,

    -- Type et niveau d'alerte
    niveau VARCHAR(20) NOT NULL,              -- 'critique', 'important', 'info'
    type_alerte VARCHAR(50) NOT NULL,         -- 'poids_faible', 'temperature', 'mortalite', etc.

    -- Contenu de l'alerte
    message TEXT NOT NULL,
    valeur_mesuree DECIMAL(10, 4),
    valeur_seuil DECIMAL(10, 4),

    -- Statut
    acquittee BOOLEAN DEFAULT FALSE,
    acquittee_par VARCHAR(100),
    acquittee_le TIMESTAMPTZ,

    -- SMS
    sms_envoye BOOLEAN DEFAULT FALSE,
    sms_envoye_le TIMESTAMPTZ,

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (time, id)
);

COMMENT ON TABLE alertes IS 'Alertes individuelles pour les canards - Hypertable TimescaleDB';

-- Conversion en hypertable TimescaleDB
SELECT create_hypertable('alertes', 'time', if_not_exists => TRUE);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_alertes_canard ON alertes(canard_id);
CREATE INDEX IF NOT EXISTS idx_alertes_niveau ON alertes(niveau);
CREATE INDEX IF NOT EXISTS idx_alertes_type ON alertes(type_alerte);
CREATE INDEX IF NOT EXISTS idx_alertes_acquittee ON alertes(acquittee);
CREATE INDEX IF NOT EXISTS idx_alertes_sms ON alertes(sms_envoye);

-- Politique de rétention : conserver 6 mois d'alertes
SELECT add_retention_policy('alertes', INTERVAL '6 months', if_not_exists => TRUE);

-- Compression automatique des alertes > 7 jours
ALTER TABLE alertes SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'canard_id,niveau'
);

SELECT add_compression_policy('alertes', INTERVAL '7 days', if_not_exists => TRUE);

COMMENT ON COLUMN alertes.niveau IS 'Niveau: critique, important, info';
COMMENT ON COLUMN alertes.type_alerte IS 'Type: poids_faible, temperature, mortalite, etc.';
COMMENT ON COLUMN alertes.sms_envoye IS 'Indique si un SMS a été envoyé pour cette alerte';
