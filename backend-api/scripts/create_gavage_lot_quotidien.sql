-- =============================================================================
-- TABLE: gavage_lot_quotidien
-- =============================================================================
-- Hypertable TimescaleDB pour stocker les données quotidiennes par LOT
-- Remplace l'ancien modèle gavage_data qui stockait par canard individuel
--
-- Date: 09 Janvier 2026
-- =============================================================================

CREATE TABLE IF NOT EXISTS gavage_lot_quotidien (
    id SERIAL,

    -- Référence au lot (VIEW lots qui pointe vers lots_gavage)
    lot_id INTEGER NOT NULL,

    -- Identifiants temporels
    date_gavage DATE NOT NULL,
    jour_gavage INTEGER NOT NULL CHECK (jour_gavage >= 1 AND jour_gavage <= 30),

    -- Doses de maïs (en grammes)
    dose_matin NUMERIC(6, 2) NOT NULL CHECK (dose_matin >= 0),
    dose_soir NUMERIC(6, 2) NOT NULL CHECK (dose_soir >= 0),
    dose_totale_jour NUMERIC(6, 2) GENERATED ALWAYS AS (dose_matin + dose_soir) STORED,

    -- Heures de gavage
    heure_gavage_matin TIME NOT NULL,
    heure_gavage_soir TIME NOT NULL,

    -- Pesée échantillon
    nb_canards_peses INTEGER NOT NULL CHECK (nb_canards_peses > 0),
    poids_echantillon JSONB NOT NULL,  -- Array [4200, 4350, 4180, ...]
    poids_moyen_mesure NUMERIC(8, 2) NOT NULL CHECK (poids_moyen_mesure > 0),

    -- Progression du poids
    gain_poids_jour NUMERIC(8, 2),      -- Calculé: poids_moyen_mesure - poids_veille
    gain_poids_cumule NUMERIC(8, 2),    -- Calculé: poids_moyen_mesure - poids_initial_lot

    -- Environnement
    temperature_stabule NUMERIC(5, 2),   -- °C
    humidite_stabule NUMERIC(5, 2),      -- %

    -- Comparaison avec courbe théorique (PySR)
    dose_theorique_matin NUMERIC(6, 2),
    dose_theorique_soir NUMERIC(6, 2),
    poids_theorique NUMERIC(8, 2),
    ecart_dose_pourcent NUMERIC(5, 2),   -- % d'écart dose réelle vs théorique
    ecart_poids_pourcent NUMERIC(5, 2),  -- % d'écart poids réel vs théorique

    -- Conformité
    suit_courbe_theorique BOOLEAN NOT NULL DEFAULT TRUE,
    raison_ecart TEXT,  -- "Canards fatigués", "Forte chaleur", ...
    remarques TEXT,

    -- Santé
    mortalite_jour INTEGER NOT NULL DEFAULT 0 CHECK (mortalite_jour >= 0),
    cause_mortalite TEXT,
    problemes_sante TEXT,  -- "3 canards toussent", "Bave excessive", ...

    -- Alertes automatiques
    alerte_generee BOOLEAN NOT NULL DEFAULT FALSE,
    niveau_alerte VARCHAR(20),  -- "info", "warning", "critique"
    recommandations_ia JSONB,   -- [{type: "augmenter_dose", message: "...", ajustement: +50g}]

    -- IA activée
    prediction_activee BOOLEAN NOT NULL DEFAULT TRUE,

    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Contrainte unique: un seul gavage par lot + jour
    UNIQUE (lot_id, date_gavage)
);

-- Convertir en hypertable TimescaleDB
SELECT create_hypertable(
    'gavage_lot_quotidien',
    'date_gavage',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_gavage_lot ON gavage_lot_quotidien(lot_id, date_gavage DESC);
CREATE INDEX IF NOT EXISTS idx_gavage_jour ON gavage_lot_quotidien(jour_gavage);
CREATE INDEX IF NOT EXISTS idx_gavage_alerte ON gavage_lot_quotidien(alerte_generee) WHERE alerte_generee = TRUE;

-- Commentaires
COMMENT ON TABLE gavage_lot_quotidien IS
    'Hypertable TimescaleDB stockant les données quotidiennes de gavage par LOT. Les doses sont communes à tout le lot.';

COMMENT ON COLUMN gavage_lot_quotidien.poids_echantillon IS
    'JSONB Array contenant les poids individuels d''un échantillon de canards pesés (ex: 10 sur 200).';

COMMENT ON COLUMN gavage_lot_quotidien.recommandations_ia IS
    'JSONB Array des recommandations générées par l''IA (Random Forest + Prophet) quand écart > seuil.';

-- =============================================================================
-- Vérification
-- =============================================================================

SELECT
    tablename,
    schemaname
FROM pg_tables
WHERE tablename = 'gavage_lot_quotidien';
