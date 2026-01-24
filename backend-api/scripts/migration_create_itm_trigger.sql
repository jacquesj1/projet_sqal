-- ================================================================================
-- MIGRATION: Trigger Calcul ITM Automatique depuis SQAL
-- ================================================================================
-- Description : Calcule automatiquement ITM du lot quand nouvelles mesures SQAL
--               arrivent avec poids_foie_estime_g
-- Date        : 2026-01-01
-- Formule     : ITM = poids_foie_moyen / (total_corn_real / nb_accroches)
-- ================================================================================

BEGIN;

-- ================================================================================
-- Fonction de calcul ITM depuis données SQAL
-- ================================================================================

CREATE OR REPLACE FUNCTION calculate_itm_from_sqal()
RETURNS TRIGGER AS $$
DECLARE
    poids_moyen_g DECIMAL(6,2);
    mais_par_canard_g DECIMAL(10,2);
    itm_calcule DECIMAL(6,4);
    nb_mesures INTEGER;
BEGIN
    -- Calculer poids foie moyen pour le lot depuis SQAL
    SELECT
        AVG(poids_foie_estime_g),
        COUNT(*)
    INTO
        poids_moyen_g,
        nb_mesures
    FROM sqal_sensor_samples
    WHERE lot_id = NEW.lot_id
      AND poids_foie_estime_g IS NOT NULL;

    -- Si pas de mesures, sortir
    IF poids_moyen_g IS NULL OR nb_mesures = 0 THEN
        RETURN NEW;
    END IF;

    -- Mettre à jour ITM du lot
    UPDATE lots_gavage
    SET
        itm = (
            -- ITM = poids_foie_moyen / mais_total_par_canard
            poids_moyen_g / NULLIF((total_corn_real / NULLIF(nb_accroches, 0)), 0)
        ),
        updated_at = NOW()
    WHERE id = NEW.lot_id
      AND total_corn_real IS NOT NULL
      AND nb_accroches > 0;

    -- Logger pour debug
    IF FOUND THEN
        RAISE NOTICE 'ITM recalculé pour lot_id=% : poids_moyen=%g, nb_mesures=%',
            NEW.lot_id, poids_moyen_g, nb_mesures;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_itm_from_sqal IS
'Recalcule automatiquement ITM du lot quand nouvelles mesures SQAL arrivent.
Formule: ITM = poids_foie_moyen_g / (total_corn_real / nb_accroches)';

-- ================================================================================
-- Trigger sur insertion/update SQAL
-- ================================================================================

DROP TRIGGER IF EXISTS trigger_calculate_itm_from_sqal ON sqal_sensor_samples;

CREATE TRIGGER trigger_calculate_itm_from_sqal
AFTER INSERT OR UPDATE ON sqal_sensor_samples
FOR EACH ROW
WHEN (NEW.lot_id IS NOT NULL AND NEW.poids_foie_estime_g IS NOT NULL)
EXECUTE FUNCTION calculate_itm_from_sqal();

COMMENT ON TRIGGER trigger_calculate_itm_from_sqal ON sqal_sensor_samples IS
'Recalcule automatiquement ITM du lot quand nouvelles mesures SQAL avec poids arrivent';

-- ================================================================================
-- Recalculer ITM pour lots existants ayant déjà des mesures SQAL
-- ================================================================================

DO $$
DECLARE
    lot_record RECORD;
    nb_lots_updated INTEGER := 0;
BEGIN
    FOR lot_record IN
        SELECT DISTINCT lot_id
        FROM sqal_sensor_samples
        WHERE lot_id IS NOT NULL
          AND poids_foie_estime_g IS NOT NULL
    LOOP
        UPDATE lots_gavage l
        SET
            itm = (
                SELECT AVG(poids_foie_estime_g) / (l.total_corn_real / NULLIF(l.nb_accroches, 0))
                FROM sqal_sensor_samples
                WHERE lot_id = lot_record.lot_id
                  AND poids_foie_estime_g IS NOT NULL
            ),
            updated_at = NOW()
        WHERE l.id = lot_record.lot_id
          AND l.total_corn_real IS NOT NULL
          AND l.nb_accroches > 0;

        IF FOUND THEN
            nb_lots_updated := nb_lots_updated + 1;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '✅ MIGRATION - Trigger ITM Automatique CRÉÉ';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Fonction créée : calculate_itm_from_sqal()';
    RAISE NOTICE 'Trigger créé   : trigger_calculate_itm_from_sqal';
    RAISE NOTICE '';
    RAISE NOTICE 'Recalcul ITM pour lots existants :';
    RAISE NOTICE '   - Lots mis à jour : %', nb_lots_updated;
    RAISE NOTICE '';
    RAISE NOTICE 'Comportement :';
    RAISE NOTICE '   - Chaque insertion SQAL avec poids → recalcul ITM du lot';
    RAISE NOTICE '   - ITM devient un indicateur dérivé automatiquement';
    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '';
END $$;

COMMIT;
