-- ================================================================================
-- ROLLBACK: RESTAURATION DEPUIS BACKUP
-- ================================================================================
-- Description : Script de rollback en cas de problème après migration
-- Date        : 08 Janvier 2026
-- Auteur      : Claude Code
-- IMPORTANT   : Ce script restaure depuis un backup PostgreSQL
-- ================================================================================

-- OPTION 1: Restauration complète depuis backup
-- ============================================
--
-- Depuis le terminal:
--
-- # Arrêter backend
-- docker stop gaveurs_backend
--
-- # Restaurer backup
-- docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db < backup_before_migration_YYYYMMDD_HHMMSS.sql
--
-- # Redémarrer backend
-- docker start gaveurs_backend
--

-- OPTION 2: Rollback partiel (si migration échouée en cours)
-- ===========================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DÉBUT ROLLBACK MIGRATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'ATTENTION: Ce script ne peut pas recréer les données supprimées!';
    RAISE NOTICE 'Utilisez la restauration complète depuis backup pour un rollback total.';
END $$;

-- Recréer structures de base (sans données)
-- Note: Les données ne peuvent être récupérées que depuis le backup

CREATE TABLE IF NOT EXISTS lots (
  id SERIAL PRIMARY KEY,
  code_lot VARCHAR(20) UNIQUE NOT NULL,
  site_origine VARCHAR(50) NOT NULL,
  nombre_canards INTEGER NOT NULL,
  genetique VARCHAR(20) NOT NULL,
  date_debut_gavage DATE NOT NULL,
  date_fin_gavage_prevue DATE NOT NULL,
  date_fin_gavage_reelle DATE,
  poids_moyen_initial NUMERIC(8,2) NOT NULL,
  poids_moyen_actuel NUMERIC(8,2) NOT NULL,
  poids_moyen_final NUMERIC(8,2),
  objectif_quantite_mais INTEGER NOT NULL,
  objectif_poids_final INTEGER NOT NULL,
  courbe_theorique JSONB,
  formule_pysr TEXT,
  r2_score_theorique NUMERIC(5,4),
  statut VARCHAR(20) NOT NULL DEFAULT 'en_preparation',
  gaveur_id INTEGER NOT NULL REFERENCES gaveurs(id) ON DELETE CASCADE,
  lot_mais_id INTEGER REFERENCES lot_mais(id),
  nombre_jours_gavage_ecoules INTEGER DEFAULT 0,
  taux_mortalite NUMERIC(5,2) DEFAULT 0.0,
  nombre_mortalite INTEGER DEFAULT 0,
  taux_conformite NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS canards (
  id SERIAL PRIMARY KEY,
  numero_identification VARCHAR(50) UNIQUE NOT NULL,
  gaveur_id INTEGER NOT NULL REFERENCES gaveurs(id),
  genetique VARCHAR(20) NOT NULL CHECK (genetique IN ('mulard', 'barbarie', 'pekin', 'mixte')),
  date_naissance TIMESTAMPTZ NOT NULL,
  origine_elevage VARCHAR(200) NOT NULL,
  numero_lot_canard VARCHAR(50) NOT NULL,
  poids_initial NUMERIC(6,2) NOT NULL CHECK (poids_initial >= 0),
  statut VARCHAR(20) DEFAULT 'en_gavage' CHECK (statut IN ('en_gavage', 'termine', 'decede')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  lot_id INTEGER REFERENCES lots(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS gavage_data (
  time TIMESTAMPTZ NOT NULL,
  canard_id INTEGER NOT NULL REFERENCES canards(id),
  dose_matin NUMERIC(6,2) NOT NULL CHECK (dose_matin >= 0),
  dose_soir NUMERIC(6,2) NOT NULL CHECK (dose_soir >= 0),
  dose_theorique_matin NUMERIC(6,2),
  dose_theorique_soir NUMERIC(6,2),
  heure_gavage_matin TIME NOT NULL,
  heure_gavage_soir TIME NOT NULL,
  poids_matin NUMERIC(6,2) CHECK (poids_matin >= 0),
  poids_soir NUMERIC(6,2) CHECK (poids_soir >= 0),
  temperature_stabule NUMERIC(4,1) NOT NULL CHECK (temperature_stabule BETWEEN -20 AND 50),
  humidite_stabule NUMERIC(5,2) CHECK (humidite_stabule BETWEEN 0 AND 100),
  qualite_air_co2 NUMERIC(6,1),
  luminosite NUMERIC(6,1),
  lot_mais_id INTEGER NOT NULL REFERENCES lot_mais(id),
  remarques TEXT,
  comportement_observe TEXT,
  etat_sanitaire TEXT,
  correction_proposee TEXT,
  ecart_dose_matin NUMERIC(6,2),
  ecart_dose_soir NUMERIC(6,2),
  alerte_generee BOOLEAN DEFAULT FALSE,
  poids_actuel NUMERIC(6,2),
  PRIMARY KEY (time, canard_id)
);

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Structures de base recréées (SANS DONNÉES)';
    RAISE NOTICE '';
    RAISE NOTICE 'Pour restaurer les données, utilisez:';
    RAISE NOTICE '  docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db < backup_before_migration_YYYYMMDD_HHMMSS.sql';
    RAISE NOTICE '';
    RAISE NOTICE 'ROLLBACK TERMINÉ';
END $$;
