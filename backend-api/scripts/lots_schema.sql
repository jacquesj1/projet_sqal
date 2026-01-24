-- ============================================================================
-- SCHÉMA LOT-CENTRIC - Migration Canard → Lot
-- ============================================================================
-- Date: 28 décembre 2025
-- Description: Création de la table lots et adaptation du modèle de données
--              pour refléter la réalité métier (gaveur gère des LOTS, pas des canards individuels)
-- ============================================================================

-- ============================================================================
-- 1. TABLE LOTS (Nouvelle table principale)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lots (
    id SERIAL PRIMARY KEY,

    -- Identification du lot
    code_lot VARCHAR(20) NOT NULL UNIQUE,  -- LL_XXX (Bretagne), LS_XXX (Pays de Loire), MG_XXX (Maubourguet)
    site_origine VARCHAR(50) NOT NULL,     -- "Bretagne" | "Pays de Loire" | "Maubourguet"

    -- Caractéristiques du lot
    nombre_canards INTEGER NOT NULL CHECK (nombre_canards > 0),
    genetique VARCHAR(20) NOT NULL CHECK (genetique IN ('mulard', 'barbarie', 'pekin', 'mixte')),

    -- Dates de gavage
    date_debut_gavage DATE NOT NULL,
    date_fin_gavage_prevue DATE NOT NULL,
    date_fin_gavage_reelle DATE,

    -- Poids (moyennes du lot)
    poids_moyen_initial DECIMAL(8, 2) NOT NULL CHECK (poids_moyen_initial > 0),  -- Grammes
    poids_moyen_actuel DECIMAL(8, 2) NOT NULL CHECK (poids_moyen_actuel > 0),    -- Grammes (mis à jour quotidiennement)
    poids_moyen_final DECIMAL(8, 2),                                              -- Grammes (rempli à l'abattage)

    -- Objectifs de gavage
    objectif_quantite_mais INTEGER NOT NULL CHECK (objectif_quantite_mais > 0),  -- Grammes totaux par canard
    objectif_poids_final INTEGER NOT NULL CHECK (objectif_poids_final > 0),      -- Grammes

    -- Courbe théorique (fournie par Euralis via PySR)
    courbe_theorique JSONB,  -- Array de {jour: number, poids: number, dose_matin: number, dose_soir: number}
    formule_pysr TEXT,       -- Formule mathématique découverte par PySR
    r2_score_theorique DECIMAL(5, 4),  -- Précision du modèle PySR (0-1)

    -- État du lot
    statut VARCHAR(20) NOT NULL DEFAULT 'en_preparation'
        CHECK (statut IN ('en_preparation', 'en_gavage', 'termine', 'abattu')),

    -- Références
    gaveur_id INTEGER NOT NULL REFERENCES gaveurs(id) ON DELETE CASCADE,
    lot_mais_id INTEGER REFERENCES lot_mais(id),

    -- Statistiques calculées
    nombre_jours_gavage_ecoules INTEGER DEFAULT 0,
    taux_mortalite DECIMAL(5, 2) DEFAULT 0.0,  -- Pourcentage
    nombre_mortalite INTEGER DEFAULT 0,
    taux_conformite DECIMAL(5, 2),             -- Pourcentage de conformité à la courbe théorique

    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Contraintes
    CONSTRAINT valid_date_range CHECK (date_fin_gavage_prevue > date_debut_gavage),
    CONSTRAINT valid_poids_progression CHECK (poids_moyen_actuel >= poids_moyen_initial)
);

-- Index pour performances
CREATE INDEX idx_lots_gaveur ON lots(gaveur_id);
CREATE INDEX idx_lots_statut ON lots(statut);
CREATE INDEX idx_lots_code ON lots(code_lot);
CREATE INDEX idx_lots_site ON lots(site_origine);
CREATE INDEX idx_lots_dates ON lots(date_debut_gavage, date_fin_gavage_prevue);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_lots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lots_updated_at
    BEFORE UPDATE ON lots
    FOR EACH ROW
    EXECUTE FUNCTION update_lots_updated_at();

-- ============================================================================
-- 2. TABLE GAVAGE_LOT_QUOTIDIEN (Remplace gavage_data)
-- ============================================================================
-- Hypertable TimescaleDB pour stocker les données quotidiennes par LOT

CREATE TABLE IF NOT EXISTS gavage_lot_quotidien (
    id SERIAL,

    -- Référence au lot
    lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,

    -- Identification temporelle
    date_gavage DATE NOT NULL,
    jour_gavage INTEGER NOT NULL,  -- J1, J2, J3, ... (calculé depuis date_debut_gavage)

    -- Doses (COMMUNES à tout le lot)
    dose_matin DECIMAL(8, 2) NOT NULL CHECK (dose_matin >= 0),    -- Grammes
    dose_soir DECIMAL(8, 2) NOT NULL CHECK (dose_soir >= 0),      -- Grammes
    dose_totale_jour DECIMAL(8, 2) GENERATED ALWAYS AS (dose_matin + dose_soir) STORED,

    -- Heures de gavage
    heure_gavage_matin TIME NOT NULL,
    heure_gavage_soir TIME NOT NULL,

    -- Pesée (échantillon)
    nb_canards_peses INTEGER NOT NULL CHECK (nb_canards_peses > 0),
    poids_echantillon JSONB NOT NULL,  -- Array de poids individuels [4200, 4150, 4180, ...]
    poids_moyen_mesure DECIMAL(8, 2) NOT NULL CHECK (poids_moyen_mesure > 0),  -- Moyenne calculée

    -- Gain de poids
    gain_poids_jour DECIMAL(8, 2),  -- Par rapport au jour précédent
    gain_poids_cumule DECIMAL(8, 2),  -- Par rapport au poids initial

    -- Conditions environnementales
    temperature_stabule DECIMAL(5, 2),  -- °C
    humidite_stabule DECIMAL(5, 2),     -- %

    -- Conformité à la courbe théorique
    dose_theorique_matin DECIMAL(8, 2),  -- Dose recommandée par PySR
    dose_theorique_soir DECIMAL(8, 2),   -- Dose recommandée par PySR
    poids_theorique DECIMAL(8, 2),       -- Poids attendu selon courbe théorique
    ecart_dose_pourcent DECIMAL(6, 2),   -- % d'écart dose réelle vs théorique
    ecart_poids_pourcent DECIMAL(6, 2),  -- % d'écart poids réel vs théorique

    -- Annotations et écarts
    suit_courbe_theorique BOOLEAN DEFAULT TRUE,
    raison_ecart TEXT,  -- Explication du gaveur si écart volontaire
    remarques TEXT,

    -- Événements spéciaux
    mortalite_jour INTEGER DEFAULT 0,
    cause_mortalite TEXT,
    problemes_sante TEXT,

    -- Alertes générées
    alerte_generee BOOLEAN DEFAULT FALSE,
    niveau_alerte VARCHAR(20) CHECK (niveau_alerte IN ('info', 'warning', 'critique')),

    -- Recommandations IA
    recommandations_ia JSONB,  -- Array de recommandations générées
    prediction_activee BOOLEAN DEFAULT FALSE,

    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Contraintes
    CONSTRAINT unique_lot_date UNIQUE (lot_id, date_gavage),
    CONSTRAINT valid_poids_sample CHECK (jsonb_array_length(poids_echantillon) = nb_canards_peses)
);

-- Convertir en hypertable TimescaleDB
SELECT create_hypertable(
    'gavage_lot_quotidien',
    'date_gavage',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Index pour performances
CREATE INDEX idx_gavage_lot ON gavage_lot_quotidien(lot_id, date_gavage DESC);
CREATE INDEX idx_gavage_jour ON gavage_lot_quotidien(jour_gavage);
CREATE INDEX idx_gavage_alerte ON gavage_lot_quotidien(alerte_generee) WHERE alerte_generee = TRUE;

-- ============================================================================
-- 3. TABLE CANARDS (Adaptation - devient table de référence)
-- ============================================================================
-- Les canards existent toujours individuellement pour la traçabilité blockchain
-- mais le gaveur ne les gère plus individuellement

-- Ajouter colonne lot_id à la table canards existante
ALTER TABLE canards
ADD COLUMN IF NOT EXISTS lot_id INTEGER REFERENCES lots(id) ON DELETE SET NULL;

-- Index
CREATE INDEX IF NOT EXISTS idx_canards_lot ON canards(lot_id);

-- Commentaire sur le changement de modèle
COMMENT ON COLUMN canards.lot_id IS
    'Référence au lot auquel appartient ce canard. Le gaveur gère des LOTS, pas des canards individuels.';

-- ============================================================================
-- 4. VUE MATÉRIALISÉE - Statistiques par lot
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS stats_lots AS
SELECT
    l.id AS lot_id,
    l.code_lot,
    l.statut,

    -- Progression
    l.nombre_jours_gavage_ecoules,
    (l.date_fin_gavage_prevue - l.date_debut_gavage) + 1 AS nombre_jours_prevus,
    ROUND(
        (l.nombre_jours_gavage_ecoules::DECIMAL /
         NULLIF((l.date_fin_gavage_prevue - l.date_debut_gavage) + 1, 0)) * 100,
        2
    ) AS pourcent_avancement,

    -- Poids
    l.poids_moyen_initial,
    l.poids_moyen_actuel,
    l.objectif_poids_final,
    l.poids_moyen_actuel - l.poids_moyen_initial AS gain_total,
    ROUND(
        (l.poids_moyen_actuel - l.poids_moyen_initial)::DECIMAL / NULLIF(l.nombre_jours_gavage_ecoules, 0),
        2
    ) AS gain_moyen_jour,

    -- Doses
    COALESCE(SUM(g.dose_totale_jour), 0) AS dose_totale_donnee,
    l.objectif_quantite_mais,
    ROUND(
        (COALESCE(SUM(g.dose_totale_jour), 0)::DECIMAL / NULLIF(l.objectif_quantite_mais, 0)) * 100,
        2
    ) AS pourcent_objectif_dose,

    -- Conformité
    ROUND(AVG(CASE WHEN g.suit_courbe_theorique THEN 100 ELSE 0 END), 2) AS taux_conformite_declare,
    ROUND(AVG(ABS(COALESCE(g.ecart_poids_pourcent, 0))), 2) AS ecart_moyen_poids,
    COUNT(CASE WHEN ABS(COALESCE(g.ecart_poids_pourcent, 0)) > 10 THEN 1 END) AS jours_hors_tolerance,

    -- Santé
    l.nombre_mortalite,
    l.taux_mortalite,
    COUNT(CASE WHEN g.alerte_generee THEN 1 END) AS nombre_alertes,

    -- Métriques
    l.updated_at AS derniere_mise_a_jour

FROM lots l
LEFT JOIN gavage_lot_quotidien g ON g.lot_id = l.id
GROUP BY l.id;

-- Index sur vue matérialisée
CREATE UNIQUE INDEX idx_stats_lots_id ON stats_lots(lot_id);
CREATE INDEX idx_stats_lots_statut ON stats_lots(statut);

-- Fonction pour rafraîchir la vue
CREATE OR REPLACE FUNCTION refresh_stats_lots()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY stats_lots;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. CONTINUOUS AGGREGATE - Évolution quotidienne par lot
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS evolution_quotidienne_lots
WITH (timescaledb.continuous) AS
SELECT
    lot_id,
    time_bucket('1 day', date_gavage) AS jour,

    -- Agrégation quotidienne
    AVG(poids_moyen_mesure) AS poids_moyen,
    AVG(dose_totale_jour) AS dose_moyenne,
    AVG(temperature_stabule) AS temperature_moyenne,
    AVG(humidite_stabule) AS humidite_moyenne,
    AVG(ecart_poids_pourcent) AS ecart_moyen,
    SUM(mortalite_jour) AS mortalite_totale,
    COUNT(*) AS nombre_enregistrements,

    -- Alertes
    SUM(CASE WHEN alerte_generee THEN 1 ELSE 0 END) AS nombre_alertes

FROM gavage_lot_quotidien
GROUP BY lot_id, jour;

-- Politique de refresh automatique (toutes les heures)
SELECT add_continuous_aggregate_policy('evolution_quotidienne_lots',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- ============================================================================
-- 6. FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction: Calculer le jour de gavage à partir de la date
CREATE OR REPLACE FUNCTION calculer_jour_gavage(p_lot_id INTEGER, p_date_gavage DATE)
RETURNS INTEGER AS $$
DECLARE
    v_date_debut DATE;
    v_jour INTEGER;
BEGIN
    SELECT date_debut_gavage INTO v_date_debut
    FROM lots
    WHERE id = p_lot_id;

    IF v_date_debut IS NULL THEN
        RETURN NULL;
    END IF;

    v_jour := (p_date_gavage - v_date_debut) + 1;
    RETURN v_jour;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Mettre à jour le poids moyen actuel du lot
CREATE OR REPLACE FUNCTION update_poids_moyen_lot()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE lots
    SET
        poids_moyen_actuel = NEW.poids_moyen_mesure,
        nombre_jours_gavage_ecoules = NEW.jour_gavage,
        nombre_mortalite = nombre_mortalite + COALESCE(NEW.mortalite_jour, 0)
    WHERE id = NEW.lot_id;

    -- Mettre à jour le taux de mortalité
    UPDATE lots
    SET taux_mortalite = ROUND((nombre_mortalite::DECIMAL / nombre_canards) * 100, 2)
    WHERE id = NEW.lot_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_poids_lot
    AFTER INSERT ON gavage_lot_quotidien
    FOR EACH ROW
    EXECUTE FUNCTION update_poids_moyen_lot();

-- Fonction: Calculer écart par rapport à la courbe théorique
CREATE OR REPLACE FUNCTION calculer_ecart_theorique(
    p_lot_id INTEGER,
    p_jour INTEGER,
    p_poids_reel DECIMAL
) RETURNS TABLE (
    poids_theorique DECIMAL,
    ecart_pourcent DECIMAL
) AS $$
DECLARE
    v_courbe JSONB;
    v_point JSONB;
    v_poids_theo DECIMAL;
BEGIN
    SELECT courbe_theorique INTO v_courbe
    FROM lots
    WHERE id = p_lot_id;

    IF v_courbe IS NULL THEN
        RETURN QUERY SELECT NULL::DECIMAL, NULL::DECIMAL;
        RETURN;
    END IF;

    -- Trouver le point correspondant au jour
    SELECT value INTO v_point
    FROM jsonb_array_elements(v_courbe)
    WHERE value->>'jour' = p_jour::TEXT;

    IF v_point IS NULL THEN
        RETURN QUERY SELECT NULL::DECIMAL, NULL::DECIMAL;
        RETURN;
    END IF;

    v_poids_theo := (v_point->>'poids')::DECIMAL;

    RETURN QUERY SELECT
        v_poids_theo,
        ROUND(((p_poids_reel - v_poids_theo) / v_poids_theo) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. DONNÉES DE TEST (Optionnel)
-- ============================================================================

-- Insérer un lot de test
INSERT INTO lots (
    code_lot,
    site_origine,
    nombre_canards,
    genetique,
    date_debut_gavage,
    date_fin_gavage_prevue,
    poids_moyen_initial,
    poids_moyen_actuel,
    objectif_quantite_mais,
    objectif_poids_final,
    statut,
    gaveur_id,
    formule_pysr
) VALUES (
    'LL_042',
    'Bretagne',
    200,
    'mulard',
    CURRENT_DATE - INTERVAL '9 days',
    CURRENT_DATE + INTERVAL '5 days',
    4000.0,
    4850.0,
    6300.0,
    6800.0,
    'en_gavage',
    1,  -- Remplacer par un ID gaveur existant
    '0.42*dose_matin^0.8 + 0.38*dose_soir^0.75 - 0.15*temperature + 12.3'
) ON CONFLICT (code_lot) DO NOTHING;

-- ============================================================================
-- 8. COMMENTAIRES SUR LES TABLES
-- ============================================================================

COMMENT ON TABLE lots IS
    'Table principale du modèle LOT-centric. Un gaveur gère des LOTS de ~200 canards, pas des canards individuels.';

COMMENT ON TABLE gavage_lot_quotidien IS
    'Hypertable TimescaleDB stockant les données quotidiennes de gavage par LOT. Les doses sont communes à tout le lot.';

COMMENT ON COLUMN gavage_lot_quotidien.poids_echantillon IS
    'JSONB Array contenant les poids individuels d''un échantillon de canards pesés (ex: 10 sur 200).';

COMMENT ON COLUMN gavage_lot_quotidien.recommandations_ia IS
    'JSONB Array des recommandations générées par l''IA (Random Forest + Prophet) quand écart > seuil.';

-- ============================================================================
-- FIN DU SCHÉMA
-- ============================================================================
