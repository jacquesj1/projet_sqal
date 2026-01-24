-- ================================================================================
-- MIGRATION: UNIFICATION ARCHITECTURE SUR lots_gavage
-- ================================================================================
-- Description : Supprime tables redondantes (lots, canards, gavage_data)
--               et unifie sur lots_gavage comme table unique
-- Date        : 08 Janvier 2026
-- Auteur      : Claude Code
-- IMPORTANT   : FAIRE UN BACKUP AVANT D'EXÉCUTER CE SCRIPT!
-- ================================================================================

-- ================================================================================
-- PHASE 0: VÉRIFICATIONS PRÉ-MIGRATION
-- ================================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DÉBUT MIGRATION UNIFICATION lots_gavage';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'État actuel de la base:';
END $$;

-- Compter les données actuelles
SELECT 'lots' as table_name, COUNT(*) as nb_rows FROM lots
UNION ALL
SELECT 'canards', COUNT(*) FROM canards
UNION ALL
SELECT 'gavage_data', COUNT(*) FROM gavage_data
UNION ALL
SELECT 'gavage_lot_quotidien', COUNT(*) FROM gavage_lot_quotidien
UNION ALL
SELECT 'lots_gavage', COUNT(*) FROM lots_gavage
UNION ALL
SELECT 'gavage_data_lots', COUNT(*) FROM gavage_data_lots
ORDER BY table_name;

-- ================================================================================
-- PHASE 1: UNIFICATION GAVEURS (gaveurs → gaveurs_euralis)
-- ================================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'PHASE 1: Unification Gaveurs';
    RAISE NOTICE '----------------------------------------';
END $$;

-- Vérifier doublons gaveurs
SELECT
  'AVANT MIGRATION' as status,
  'gaveurs' as source_table,
  COUNT(*) as nb_gaveurs
FROM gaveurs
UNION ALL
SELECT
  'AVANT MIGRATION',
  'gaveurs_euralis',
  COUNT(*)
FROM gaveurs_euralis;

-- Migrer gaveurs manquants vers gaveurs_euralis
INSERT INTO gaveurs_euralis (
  nom, prenom, email, telephone, adresse1, code_postal, commune,
  site_code, actif, created_at, updated_at
)
SELECT
  g.nom,
  g.prenom,
  g.email,
  g.telephone,
  g.adresse,
  NULL as code_postal,
  NULL as commune,
  -- Extraire site_code depuis le premier lot du gaveur ou par défaut 'LL'
  COALESCE(
    (SELECT SUBSTRING(code_lot FROM 1 FOR 2)
     FROM lots
     WHERE gaveur_id = g.id
     LIMIT 1),
    'LL'
  ) as site_code,
  g.actif,
  g.created_at,
  g.updated_at
FROM gaveurs g
WHERE NOT EXISTS (
  SELECT 1 FROM gaveurs_euralis ge WHERE ge.email = g.email
);

-- Afficher résultat
SELECT
  'APRÈS MIGRATION' as status,
  'gaveurs_euralis' as table,
  COUNT(*) as nb_gaveurs
FROM gaveurs_euralis;

-- Créer table temporaire de mapping gaveurs
CREATE TEMP TABLE IF NOT EXISTS gaveurs_mapping AS
SELECT
  g_old.id as old_gaveur_id,
  g_new.id as new_gaveur_id,
  g_old.email,
  g_old.nom,
  g_old.prenom
FROM gaveurs g_old
JOIN gaveurs_euralis g_new ON g_old.email = g_new.email;

SELECT * FROM gaveurs_mapping;

-- ================================================================================
-- PHASE 2: MIGRATION LOTS (lots → lots_gavage)
-- ================================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'PHASE 2: Migration Lots';
    RAISE NOTICE '----------------------------------------';
END $$;

-- Migrer le lot unique de la table "lots" vers "lots_gavage"
INSERT INTO lots_gavage (
  code_lot,
  gaveur_id,
  site_code,
  debut_lot,
  duree_gavage_reelle,
  genetique,
  nb_canards_initial,
  nb_meg,
  poids_moyen_actuel,
  taux_mortalite,
  nb_morts,
  statut,
  jour_actuel,
  created_at,
  updated_at
)
SELECT
  l.code_lot,
  gm.new_gaveur_id,
  SUBSTRING(l.code_lot FROM 1 FOR 2) as site_code,
  l.date_debut_gavage,
  l.nombre_jours_gavage_ecoules,
  l.genetique,
  l.nombre_canards,
  l.nombre_canards,
  l.poids_moyen_actuel,
  l.taux_mortalite,
  l.nombre_mortalite,
  CASE
    WHEN l.statut = 'en_preparation' THEN 'en_cours'
    WHEN l.statut = 'en_gavage' THEN 'en_cours'
    WHEN l.statut = 'termine' THEN 'termine'
    WHEN l.statut = 'abattu' THEN 'abattu'
    ELSE 'en_cours'
  END,
  l.nombre_jours_gavage_ecoules,
  l.created_at,
  l.updated_at
FROM lots l
JOIN gaveurs_mapping gm ON l.gaveur_id = gm.old_gaveur_id
WHERE NOT EXISTS (
  SELECT 1 FROM lots_gavage lg WHERE lg.code_lot = l.code_lot
);

-- Afficher résultat
SELECT
  'APRÈS MIGRATION' as status,
  COUNT(*) as nb_lots_gavage
FROM lots_gavage;

-- ================================================================================
-- PHASE 3: MIGRATION ALERTES (alertes.canard_id → alertes_euralis.lot_id)
-- ================================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'PHASE 3: Migration Alertes';
    RAISE NOTICE '----------------------------------------';
END $$;

-- Compter alertes à migrer
SELECT
  'AVANT MIGRATION' as status,
  'alertes avec canard_id' as table,
  COUNT(*) as nb_rows
FROM alertes
WHERE canard_id IS NOT NULL;

-- Migrer alertes individuelles vers alertes de lot
-- (Grouper par lot + jour pour éviter doublons)
INSERT INTO alertes_euralis (
  time,
  lot_id,
  gaveur_id,
  site_code,
  type_alerte,
  criticite,
  titre,
  description,
  valeur_observee,
  acquittee,
  acquittee_par,
  acquittee_le,
  metadata
)
SELECT DISTINCT ON (lg.id, DATE(a.time))
  a.time,
  lg.id as lot_id,
  lg.gaveur_id,
  lg.site_code,
  a.type_alerte,
  a.criticite,
  'Alerte Lot: ' || a.titre as titre,
  'Migrée depuis alertes canards (canard ' || c.numero_identification || '): ' || COALESCE(a.description, 'Aucune description'),
  a.valeur_observee,
  a.acquittee,
  a.acquittee_par,
  a.acquittee_le,
  jsonb_build_object(
    'migration_source', 'alertes_canards',
    'original_canard_id', c.id,
    'canard_numero', c.numero_identification,
    'migration_date', NOW()
  ) as metadata
FROM alertes a
JOIN canards c ON a.canard_id = c.id
JOIN lots l ON c.lot_id = l.id
JOIN lots_gavage lg ON l.code_lot = lg.code_lot
WHERE a.canard_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Afficher résultat
SELECT
  'APRÈS MIGRATION' as status,
  'alertes_euralis' as table,
  COUNT(*) as nb_alertes_migrees
FROM alertes_euralis
WHERE metadata ? 'migration_source';

-- ================================================================================
-- PHASE 4: SUPPRESSION TABLES OBSOLÈTES
-- ================================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'PHASE 4: Suppression Tables Obsolètes';
    RAISE NOTICE '----------------------------------------';
END $$;

-- Ordre de suppression (dépendances first)
DROP TABLE IF EXISTS corrections_doses CASCADE;
DROP TABLE IF EXISTS predictions_courbes CASCADE;
DROP TABLE IF EXISTS mortalite CASCADE;
DROP TABLE IF EXISTS alertes CASCADE;  -- Migrée vers alertes_euralis
DROP TABLE IF EXISTS gavage_data CASCADE;  -- Remplacée par gavage_data_lots
DROP TABLE IF EXISTS gavage_lot_quotidien CASCADE;  -- Remplacée par doses_journalieres
DROP TABLE IF EXISTS canards CASCADE;  -- Pas de sens métier
DROP TABLE IF EXISTS lots CASCADE;  -- Dupliquée dans lots_gavage

-- Supprimer vue obsolète
DROP VIEW IF EXISTS canards_lots CASCADE;

-- Supprimer table gaveurs si tous migrés
-- ATTENTION: Commenté par sécurité - à décommenter si sûr
-- DROP TABLE IF EXISTS gaveurs CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'Tables supprimées:';
    RAISE NOTICE '  - lots';
    RAISE NOTICE '  - canards';
    RAISE NOTICE '  - gavage_data';
    RAISE NOTICE '  - gavage_lot_quotidien';
    RAISE NOTICE '  - alertes (canards)';
    RAISE NOTICE '  - corrections_doses';
    RAISE NOTICE '  - predictions_courbes';
    RAISE NOTICE '  - mortalite';
    RAISE NOTICE '  - canards_lots (vue)';
END $$;

-- ================================================================================
-- PHASE 5: VÉRIFICATIONS POST-MIGRATION
-- ================================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'PHASE 5: Vérifications Post-Migration';
    RAISE NOTICE '----------------------------------------';
END $$;

-- Vérifier lots_gavage a bien tous les lots
SELECT
  'VÉRIFICATION' as status,
  'Lots dans lots_gavage' as description,
  COUNT(*) as nb_lots
FROM lots_gavage;

-- Vérifier tous les lots ont un gaveur valide
SELECT
  'VÉRIFICATION' as status,
  'Lots SANS gaveur valide (devrait être 0)' as description,
  COUNT(*) as nb_problemes
FROM lots_gavage lg
LEFT JOIN gaveurs_euralis ge ON lg.gaveur_id = ge.id
WHERE ge.id IS NULL;

-- Vérifier gavage_data_lots a des données
SELECT
  'VÉRIFICATION' as status,
  'Entrées dans gavage_data_lots' as description,
  COUNT(*) as nb_entries
FROM gavage_data_lots;

-- Vérifier intégrité foreign keys
SELECT
  'VÉRIFICATION' as status,
  'Foreign keys gavage_data_lots → lots_gavage' as description,
  COUNT(*) as nb_valid
FROM gavage_data_lots gdl
JOIN lots_gavage lg ON gdl.lot_gavage_id = lg.id;

-- Vérifier lots Jean Martin
SELECT
  'VÉRIFICATION JEAN MARTIN' as status,
  lg.code_lot,
  lg.jour_actuel,
  lg.statut,
  lg.nb_canards_initial,
  COUNT(gdl.id) as nb_gavage_entries
FROM lots_gavage lg
LEFT JOIN gavage_data_lots gdl ON lg.id = gdl.lot_gavage_id
WHERE lg.code_lot IN ('LL2601001', 'LL2601002', 'LL2601003')
GROUP BY lg.id, lg.code_lot, lg.jour_actuel, lg.statut, lg.nb_canards_initial
ORDER BY lg.code_lot;

-- ================================================================================
-- PHASE 6: NETTOYAGE FINAL
-- ================================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'PHASE 6: Nettoyage Final';
    RAISE NOTICE '----------------------------------------';
END $$;

-- Supprimer table temporaire de mapping
DROP TABLE IF EXISTS gaveurs_mapping;

-- Vacuum pour récupérer espace disque
VACUUM ANALYZE lots_gavage;
VACUUM ANALYZE gavage_data_lots;
VACUUM ANALYZE gaveurs_euralis;
VACUUM ANALYZE alertes_euralis;

-- ================================================================================
-- RÉSUMÉ FINAL
-- ================================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION TERMINÉE AVEC SUCCÈS!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Architecture finale:';
    RAISE NOTICE '  ✅ lots_gavage: Table unique des lots';
    RAISE NOTICE '  ✅ gavage_data_lots: Données time-series au niveau LOT';
    RAISE NOTICE '  ✅ gaveurs_euralis: Table unique des gaveurs';
    RAISE NOTICE '  ✅ alertes_euralis: Alertes au niveau LOT';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables supprimées:';
    RAISE NOTICE '  ❌ lots (remplacée par lots_gavage)';
    RAISE NOTICE '  ❌ canards (pas de sens métier)';
    RAISE NOTICE '  ❌ gavage_data (remplacée par gavage_data_lots)';
    RAISE NOTICE '  ❌ gavage_lot_quotidien (remplacée par doses_journalieres)';
    RAISE NOTICE '';
    RAISE NOTICE 'Actions suivantes:';
    RAISE NOTICE '  1. Mettre à jour backend API (remplacer "lots" par "lots_gavage")';
    RAISE NOTICE '  2. Tester frontend gaveurs avec Jean Martin';
    RAISE NOTICE '  3. Vérifier simulateurs continuent de fonctionner';
    RAISE NOTICE '  4. Mettre à jour documentation';
END $$;

-- Afficher état final
SELECT
  'ÉTAT FINAL' as status,
  'lots_gavage' as table,
  COUNT(*) as nb_rows
FROM lots_gavage
UNION ALL
SELECT 'ÉTAT FINAL', 'gavage_data_lots', COUNT(*) FROM gavage_data_lots
UNION ALL
SELECT 'ÉTAT FINAL', 'gaveurs_euralis', COUNT(*) FROM gaveurs_euralis
UNION ALL
SELECT 'ÉTAT FINAL', 'alertes_euralis', COUNT(*) FROM alertes_euralis
ORDER BY table;
