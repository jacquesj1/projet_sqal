-- ============================================================================
-- Migration: Ajouter colonnes CSV manquantes à la table lots
-- ============================================================================
-- Date: 12 Janvier 2026
-- Objectif: Stocker total_cornReal et nb_meg depuis CSV Euralis
-- ============================================================================

-- Ajouter total_cornReal (dose totale de maïs ingérée en grammes)
ALTER TABLE lots_gavage
ADD COLUMN IF NOT EXISTS total_corn_real_g DECIMAL(10, 2);

COMMENT ON COLUMN lots_gavage.total_corn_real_g IS 'Quantité totale de maïs ingérée en grammes (depuis CSV total_cornReal)';

-- Ajouter nb_meg (nombre de morts en gavage)
ALTER TABLE lots_gavage
ADD COLUMN IF NOT EXISTS nb_meg INTEGER DEFAULT 0;

COMMENT ON COLUMN lots_gavage.nb_meg IS 'Nombre de mortalité en gavage (depuis CSV Nb_MEG)';

-- Ajouter poids_foie_moyen_g (poids moyen des foies en grammes)
ALTER TABLE lots_gavage
ADD COLUMN IF NOT EXISTS poids_foie_moyen_g DECIMAL(8, 2);

COMMENT ON COLUMN lots_gavage.poids_foie_moyen_g IS 'Poids moyen des foies en grammes (depuis CSV Poids_de_foies_moyen)';

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_lots_gavage_total_corn ON lots_gavage(total_corn_real_g) WHERE total_corn_real_g IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lots_gavage_nb_meg ON lots_gavage(nb_meg) WHERE nb_meg > 0;
CREATE INDEX IF NOT EXISTS idx_lots_gavage_poids_foie ON lots_gavage(poids_foie_moyen_g) WHERE poids_foie_moyen_g IS NOT NULL;

-- Vérification
SELECT 'Migration terminée' as status;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'lots_gavage' AND column_name IN ('total_corn_real_g', 'nb_meg', 'poids_foie_moyen_g');
