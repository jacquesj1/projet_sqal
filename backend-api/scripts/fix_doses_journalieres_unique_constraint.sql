-- =============================================================================
-- FIX: Contrainte UNIQUE pour doses_journalieres
-- =============================================================================
-- Problème: L'index UNIQUE partiel ne peut pas être utilisé avec ON CONFLICT
-- Solution: Créer un index UNIQUE complet sur (time, code_lot, jour, moment)
--
-- Date: 09 Janvier 2026
-- =============================================================================

-- 1. Supprimer l'ancien index UNIQUE partiel
DROP INDEX IF EXISTS idx_doses_unique_code_lot_jour_moment;

-- 2. Créer un nouvel index UNIQUE complet
-- Note: Pour TimescaleDB hypertables, la contrainte UNIQUE DOIT inclure la colonne time
CREATE UNIQUE INDEX idx_doses_unique_time_code_lot_jour_moment
    ON doses_journalieres (time, code_lot, jour, moment)
    WHERE code_lot IS NOT NULL AND jour IS NOT NULL AND moment IS NOT NULL;

-- 3. Commentaire
COMMENT ON INDEX idx_doses_unique_time_code_lot_jour_moment IS
    'Contrainte UNIQUE pour ON CONFLICT UPSERT. Inclut time (obligatoire pour hypertable TimescaleDB)';

-- =============================================================================
-- Vérification
-- =============================================================================

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'doses_journalieres'
    AND indexname LIKE '%unique%';
