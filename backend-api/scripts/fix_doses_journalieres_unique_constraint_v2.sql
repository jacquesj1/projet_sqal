-- =============================================================================
-- FIX V2: Contrainte UNIQUE pour doses_journalieres (Hypertable)
-- =============================================================================
-- Problème: ON CONFLICT ne fonctionne PAS avec index partiel (WHERE clause)
--           sur les hypertables TimescaleDB
-- Solution: Créer un index UNIQUE COMPLET sans WHERE clause
--
-- Date: 09 Janvier 2026
-- =============================================================================

-- 1. Supprimer l'ancien index UNIQUE partiel
DROP INDEX IF EXISTS idx_doses_unique_time_code_lot_jour_moment;
DROP INDEX IF EXISTS idx_doses_unique_code_lot_jour_moment;

-- 2. Ajouter contraintes NOT NULL sur les colonnes (garantir absence de NULL)
ALTER TABLE doses_journalieres
    ALTER COLUMN code_lot SET NOT NULL,
    ALTER COLUMN jour SET NOT NULL,
    ALTER COLUMN moment SET NOT NULL;

-- 3. Créer un nouvel index UNIQUE COMPLET (sans WHERE clause)
-- IMPORTANT: Pour hypertables TimescaleDB, ON CONFLICT requiert un index
--            UNIQUE COMPLET incluant la colonne time
CREATE UNIQUE INDEX idx_doses_unique_time_code_lot_jour_moment
    ON doses_journalieres (time, code_lot, jour, moment);

-- 4. Commentaire
COMMENT ON INDEX idx_doses_unique_time_code_lot_jour_moment IS
    'Contrainte UNIQUE pour ON CONFLICT UPSERT sur hypertable. Index COMPLET (sans WHERE) requis pour ON CONFLICT.';

-- =============================================================================
-- Vérification
-- =============================================================================

-- Vérifier l'index
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'doses_journalieres'
    AND indexname LIKE '%unique%';

-- Vérifier les contraintes NOT NULL
SELECT
    column_name,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'doses_journalieres'
    AND column_name IN ('time', 'code_lot', 'jour', 'moment');
