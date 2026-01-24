-- =============================================================================
-- AUTO-REFRESH: Materialized View performances_sites
-- =============================================================================
-- Problème: La vue matérialisée performances_sites devient obsolète
-- Solution: Créer une fonction trigger pour refresh automatique
--
-- Date: 09 Janvier 2026
-- =============================================================================

-- 1. Créer une fonction trigger pour rafraîchir la vue après INSERT/UPDATE sur lots_gavage
CREATE OR REPLACE FUNCTION trigger_refresh_performances_sites()
RETURNS TRIGGER AS $$
BEGIN
    -- Rafraîchir la vue matérialisée en mode CONCURRENTLY
    -- (permet les lectures pendant le refresh)
    REFRESH MATERIALIZED VIEW CONCURRENTLY performances_sites;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_refresh_performances_sites() IS
    'Trigger pour rafraîchir automatiquement performances_sites après modifications de lots_gavage';

-- 2. Créer le trigger sur lots_gavage
-- Note: Exécute APRÈS chaque INSERT/UPDATE sur lots_gavage
DROP TRIGGER IF EXISTS trigger_refresh_perf_after_lot_change ON lots_gavage;

CREATE TRIGGER trigger_refresh_perf_after_lot_change
    AFTER INSERT OR UPDATE ON lots_gavage
    FOR EACH STATEMENT  -- Une seule fois par statement (pas par row)
    EXECUTE FUNCTION trigger_refresh_performances_sites();

COMMENT ON TRIGGER trigger_refresh_perf_after_lot_change ON lots_gavage IS
    'Rafraîchit automatiquement la vue performances_sites après modification de lots';

-- 3. Rafraîchir immédiatement la vue
REFRESH MATERIALIZED VIEW CONCURRENTLY performances_sites;

-- =============================================================================
-- Vérification
-- =============================================================================

-- Vérifier que le trigger existe
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_refresh_perf_after_lot_change';

-- Vérifier les données
SELECT site_code, site_nom, nb_lots_total, nb_lots_actifs, last_refresh
FROM performances_sites
ORDER BY site_code;
