-- ================================================================================
-- MIGRATION: Ajout colonne poids_foie_estime_g
-- ================================================================================
-- Description : Ajoute la colonne pour stocker le poids du foie calculé depuis
--               le volume ToF mesuré par SQAL
-- Date        : 2026-01-01
-- Formule     : poids_g = (volume_mm³ / 1000) × 0.947 g/cm³
-- Source      : Int. J. Food Properties (2016) - Densité foie gras: 0.947 g/cm³
-- ================================================================================

BEGIN;

-- Ajouter la colonne poids_foie_estime_g
ALTER TABLE sqal_sensor_samples
ADD COLUMN IF NOT EXISTS poids_foie_estime_g DECIMAL(6,2);

-- Commentaire explicatif
COMMENT ON COLUMN sqal_sensor_samples.poids_foie_estime_g IS
'Poids du foie calculé depuis volume ToF (g): masse = (volume_mm³ / 1000) × 0.947 g/cm³
Source scientifique: Int. J. Food Properties (2016) - Thermal properties of duck foie gras
Densité foie gras cru à 20°C: 947 kg/m³ = 0.947 g/cm³';

-- Créer index pour optimiser les requêtes de production
CREATE INDEX IF NOT EXISTS idx_sqal_samples_lot_poids
ON sqal_sensor_samples(lot_id, poids_foie_estime_g)
WHERE lot_id IS NOT NULL AND poids_foie_estime_g IS NOT NULL;

COMMENT ON INDEX idx_sqal_samples_lot_poids IS
'Index pour requêtes de production: agrégation poids par lot';

-- Recalculer poids pour données SQAL existantes (si volume disponible)
UPDATE sqal_sensor_samples
SET poids_foie_estime_g = ROUND((vl53l8ch_volume_mm3 / 1000.0) * 0.947, 1)
WHERE vl53l8ch_volume_mm3 IS NOT NULL
  AND poids_foie_estime_g IS NULL;

-- Afficher statistiques
DO $$
DECLARE
    nb_rows_updated INTEGER;
    nb_total INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_rows_updated
    FROM sqal_sensor_samples
    WHERE poids_foie_estime_g IS NOT NULL;

    SELECT COUNT(*) INTO nb_total
    FROM sqal_sensor_samples;

    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '✅ MIGRATION - Ajout colonne poids_foie_estime_g TERMINÉE';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Statistiques :';
    RAISE NOTICE '   - Total échantillons SQAL : %', nb_total;
    RAISE NOTICE '   - Échantillons avec poids calculé : %', nb_rows_updated;
    RAISE NOTICE '   - Formule : poids_g = (volume_mm³ / 1000) × 0.947';
    RAISE NOTICE '';
    RAISE NOTICE 'Index créé : idx_sqal_samples_lot_poids';
    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '';
END $$;

COMMIT;
