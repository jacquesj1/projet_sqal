-- ============================================================================
-- MIGRATION: Support Simulateur Gavage Temps Réel
-- Date: 2025-12-23
-- Description: Ajout des tables et colonnes pour simulateur temps réel
-- ============================================================================

-- ============================================================================
-- 1. EXTENSION LOTS_GAVAGE POUR SIMULATION TEMPS RÉEL
-- ============================================================================
-- Ajout colonnes pour tracking état temps réel

ALTER TABLE lots_gavage
ADD COLUMN IF NOT EXISTS genetique VARCHAR(50),  -- Mulard, Barbarie, Pékin
ADD COLUMN IF NOT EXISTS nb_canards_initial INTEGER,
ADD COLUMN IF NOT EXISTS poids_moyen_actuel DECIMAL(8, 2),
ADD COLUMN IF NOT EXISTS taux_mortalite DECIMAL(5, 2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS jour_actuel INTEGER DEFAULT -1,
ADD COLUMN IF NOT EXISTS pret_abattage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN lots_gavage.genetique IS 'Génétique des canards (Mulard, Barbarie, Pékin)';
COMMENT ON COLUMN lots_gavage.nb_canards_initial IS 'Nombre initial de canards dans le lot';
COMMENT ON COLUMN lots_gavage.poids_moyen_actuel IS 'Poids moyen actuel des canards vivants (grammes)';
COMMENT ON COLUMN lots_gavage.taux_mortalite IS 'Taux de mortalité actuel (%)';
COMMENT ON COLUMN lots_gavage.jour_actuel IS 'Jour actuel du gavage (J-1 à J14)';
COMMENT ON COLUMN lots_gavage.pret_abattage IS 'Lot terminé et prêt pour abattage';
COMMENT ON COLUMN lots_gavage.updated_at IS 'Dernière mise à jour du lot';

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_lots_pret_abattage ON lots_gavage(pret_abattage) WHERE pret_abattage = TRUE;
CREATE INDEX IF NOT EXISTS idx_lots_updated ON lots_gavage(updated_at DESC);


-- ============================================================================
-- 2. TABLE DOSES_JOURNALIERES EXTENSION
-- ============================================================================
-- Modification pour supporter code_lot direct et moment (matin/soir)

-- Ajout colonnes si elles n'existent pas
ALTER TABLE doses_journalieres
ADD COLUMN IF NOT EXISTS code_lot VARCHAR(20),
ADD COLUMN IF NOT EXISTS jour INTEGER,
ADD COLUMN IF NOT EXISTS moment VARCHAR(10),  -- 'matin' ou 'soir'
ADD COLUMN IF NOT EXISTS dose_theorique DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS dose_reelle DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS poids_moyen DECIMAL(8, 2),
ADD COLUMN IF NOT EXISTS nb_vivants INTEGER,
ADD COLUMN IF NOT EXISTS taux_mortalite DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS temperature DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS humidite DECIMAL(5, 2);

COMMENT ON COLUMN doses_journalieres.code_lot IS 'Code du lot (référence directe pour simulateur)';
COMMENT ON COLUMN doses_journalieres.jour IS 'Jour du gavage (0 à 14)';
COMMENT ON COLUMN doses_journalieres.moment IS 'Moment du gavage (matin ou soir)';
COMMENT ON COLUMN doses_journalieres.dose_theorique IS 'Dose théorique calculée (grammes)';
COMMENT ON COLUMN doses_journalieres.dose_reelle IS 'Dose réellement administrée (grammes)';
COMMENT ON COLUMN doses_journalieres.poids_moyen IS 'Poids moyen des canards (grammes)';
COMMENT ON COLUMN doses_journalieres.nb_vivants IS 'Nombre de canards vivants';
COMMENT ON COLUMN doses_journalieres.taux_mortalite IS 'Taux de mortalité (%)';
COMMENT ON COLUMN doses_journalieres.temperature IS 'Température stabule (°C)';
COMMENT ON COLUMN doses_journalieres.humidite IS 'Humidité stabule (%)';

-- Contrainte unique pour éviter doublons (code_lot + jour + moment)
CREATE UNIQUE INDEX IF NOT EXISTS idx_doses_unique_realtime
ON doses_journalieres(code_lot, jour, moment)
WHERE code_lot IS NOT NULL AND jour IS NOT NULL AND moment IS NOT NULL;

-- Index pour requêtes temps réel
CREATE INDEX IF NOT EXISTS idx_doses_code_lot ON doses_journalieres(code_lot, time DESC);
CREATE INDEX IF NOT EXISTS idx_doses_jour_moment ON doses_journalieres(jour, moment);


-- ============================================================================
-- 3. TABLE SQAL_PENDING_LOTS (File d'attente contrôle qualité)
-- ============================================================================
-- Lots terminés en attente d'inspection SQAL

CREATE TABLE IF NOT EXISTS sqal_pending_lots (
    id SERIAL PRIMARY KEY,
    code_lot VARCHAR(20) UNIQUE NOT NULL,
    gaveur_id INTEGER,
    gaveur_nom VARCHAR(100),
    site VARCHAR(2),
    genetique VARCHAR(50),

    -- Résultats finaux gavage
    poids_moyen_final DECIMAL(8, 2),
    nb_canards_final INTEGER,
    taux_mortalite DECIMAL(5, 2),

    -- Dates et statut
    date_abattage TIMESTAMPTZ NOT NULL,
    date_inspection_sqal TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, inspected, approved, rejected

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sqal_pending_lots IS 'File d''attente des lots terminés pour contrôle qualité SQAL';
COMMENT ON COLUMN sqal_pending_lots.status IS 'pending: en attente | inspected: inspecté | approved: validé | rejected: refusé';

-- Index
CREATE INDEX IF NOT EXISTS idx_sqal_pending_status ON sqal_pending_lots(status);
CREATE INDEX IF NOT EXISTS idx_sqal_pending_site ON sqal_pending_lots(site);
CREATE INDEX IF NOT EXISTS idx_sqal_pending_date ON sqal_pending_lots(date_abattage DESC);

-- Contrainte FK vers lots_gavage (si code_lot existe)
-- Note: ON DELETE SET NULL pour garder historique même si lot supprimé
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sqal_pending_lots_code'
    ) THEN
        ALTER TABLE sqal_pending_lots
        ADD CONSTRAINT fk_sqal_pending_lots_code
        FOREIGN KEY (code_lot) REFERENCES lots_gavage(code_lot)
        ON DELETE SET NULL;
    END IF;
END $$;


-- ============================================================================
-- 4. VUE TEMPS RÉEL LOTS ACTIFS
-- ============================================================================
-- Vue agrégée des lots en cours de gavage

CREATE OR REPLACE VIEW v_lots_actifs_realtime AS
SELECT
    l.code_lot,
    l.site_code AS site,
    l.gaveur_id,
    g.nom AS gaveur_nom,
    l.genetique,
    l.nb_canards_initial,
    l.poids_moyen_actuel,
    l.taux_mortalite,
    l.jour_actuel,
    l.debut_lot,
    l.pret_abattage,
    l.updated_at,

    -- Dernière dose enregistrée
    (SELECT dose_reelle
     FROM doses_journalieres
     WHERE code_lot = l.code_lot
     ORDER BY time DESC LIMIT 1) AS derniere_dose,

    -- Nombre total de gavages effectués
    (SELECT COUNT(*)
     FROM doses_journalieres
     WHERE code_lot = l.code_lot) AS nb_gavages_effectues

FROM lots_gavage l
LEFT JOIN gaveurs_euralis g ON l.gaveur_id = g.id
WHERE l.pret_abattage = FALSE
  AND l.jour_actuel >= -1  -- Inclut J-1 (préparation)
ORDER BY l.updated_at DESC;

COMMENT ON VIEW v_lots_actifs_realtime IS 'Vue temps réel des lots de gavage actifs';


-- ============================================================================
-- 5. VUE STATISTIQUES TEMPS RÉEL PAR SITE
-- ============================================================================
-- Agrégation temps réel par site

CREATE OR REPLACE VIEW v_stats_realtime_sites AS
SELECT
    site_code AS site,
    COUNT(*) AS nb_lots_actifs,
    SUM(nb_canards_initial) AS total_canards_initial,
    SUM(nb_canards_initial * (1 - taux_mortalite / 100.0)) AS total_canards_vivants_estim,
    AVG(poids_moyen_actuel) AS poids_moyen_global,
    AVG(taux_mortalite) AS taux_mortalite_moyen,
    AVG(jour_actuel) AS jour_moyen,
    MAX(updated_at) AS derniere_mise_a_jour
FROM lots_gavage
WHERE pret_abattage = FALSE
  AND jour_actuel >= 0  -- Exclut J-1
GROUP BY site_code
ORDER BY site_code;

COMMENT ON VIEW v_stats_realtime_sites IS 'Statistiques temps réel agrégées par site Euralis';


-- ============================================================================
-- 6. FONCTION TRIGGER AUTO-UPDATE TIMESTAMP
-- ============================================================================
-- Mise à jour automatique de updated_at

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur lots_gavage
DROP TRIGGER IF EXISTS trigger_lots_gavage_updated_at ON lots_gavage;
CREATE TRIGGER trigger_lots_gavage_updated_at
    BEFORE UPDATE ON lots_gavage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger sur sqal_pending_lots
DROP TRIGGER IF EXISTS trigger_sqal_pending_updated_at ON sqal_pending_lots;
CREATE TRIGGER trigger_sqal_pending_updated_at
    BEFORE UPDATE ON sqal_pending_lots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 7. DONNÉES DE TEST (OPTIONNEL)
-- ============================================================================
-- Exemple de lot simulé pour tests

-- Décommenter pour insérer un lot de test
/*
INSERT INTO lots_gavage (
    code_lot, site_code, gaveur_id, genetique,
    nb_canards_initial, poids_moyen_actuel, taux_mortalite,
    jour_actuel, pret_abattage, debut_lot
) VALUES (
    'LL2512001', 'LL', 1, 'Mulard',
    50, 4500.0, 0.0,
    -1, FALSE, CURRENT_DATE
) ON CONFLICT (code_lot) DO NOTHING;
*/


-- ============================================================================
-- FIN MIGRATION
-- ============================================================================

-- Vérification tables créées
DO $$
BEGIN
    RAISE NOTICE 'Migration terminée avec succès!';
    RAISE NOTICE 'Tables créées/modifiées:';
    RAISE NOTICE '  - lots_gavage (+ 7 colonnes)';
    RAISE NOTICE '  - doses_journalieres (+ 9 colonnes)';
    RAISE NOTICE '  - sqal_pending_lots (nouvelle)';
    RAISE NOTICE 'Vues créées:';
    RAISE NOTICE '  - v_lots_actifs_realtime';
    RAISE NOTICE '  - v_stats_realtime_sites';
END $$;
