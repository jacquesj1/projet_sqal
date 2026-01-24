-- ============================================================================
-- Import CSV Euralis SIMPLIFIÉ - Colonnes essentielles uniquement
-- ============================================================================
-- Date: 13 Janvier 2026
-- ============================================================================

-- Étape 1: Créer table temporaire SIMPLIFIÉE
DROP TABLE IF EXISTS csv_import;
CREATE TEMP TABLE csv_import (
    code_lot TEXT,
    gaveur TEXT,
    debut_lot TEXT,
    nb_meg TEXT,
    quantite_accrochee TEXT,
    duree_du_lot TEXT,
    souche TEXT,
    geo TEXT,
    itm TEXT,
    sigma TEXT,
    total_corn_real TEXT,
    poids_de_foies_moyen TEXT
);

-- Étape 2: Importer uniquement les colonnes utiles depuis le CSV
\echo 'Import CSV colonnes essentielles...'
\COPY csv_import FROM PROGRAM 'cut -d";" -f174,158,159,161,162,166,168,173,169,171,57,170 /tmp/import.csv' WITH (FORMAT CSV, DELIMITER ';', ENCODING 'LATIN1');

\echo 'Lignes importées:'
SELECT COUNT(*) FROM csv_import;

\echo ''
\echo 'Aperçu données importées:'
SELECT code_lot, gaveur, debut_lot, itm, sigma, poids_de_foies_moyen
FROM csv_import
WHERE code_lot NOT LIKE 'Code%'
LIMIT 3;

-- Étape 3: Créer gaveurs manquants
\echo ''
\echo 'Création gaveurs...'
INSERT INTO gaveurs_euralis (nom, created_at)
SELECT DISTINCT csv.gaveur, NOW()
FROM csv_import csv
WHERE csv.gaveur IS NOT NULL
  AND csv.gaveur != ''
  AND csv.gaveur NOT LIKE 'Gaveur%'
  AND NOT EXISTS (SELECT 1 FROM gaveurs_euralis g WHERE g.nom = csv.gaveur);

-- Étape 4: Insérer les lots
\echo 'Insertion lots...'
INSERT INTO lots_gavage (
    code_lot,
    gaveur_id,
    geo,
    souche,
    nb_accroches,
    debut_lot,
    duree_du_lot,
    itm,
    sigma,
    total_corn_real,
    nb_meg,
    poids_foie_moyen_g,
    statut,
    created_at
)
SELECT
    csv.code_lot,
    COALESCE(g.id, 1),
    csv.geo,
    CASE
        WHEN csv.souche LIKE '%mulard%' OR csv.souche LIKE '%M15%' THEN 'mulard'
        ELSE 'autre'
    END,
    NULLIF(csv.quantite_accrochee, '')::INTEGER,
    NULLIF(csv.debut_lot, '')::TIMESTAMP,
    NULLIF(csv.duree_du_lot, '')::INTEGER,
    NULLIF(csv.itm, '')::DECIMAL,
    NULLIF(csv.sigma, '')::DECIMAL,
    NULLIF(csv.total_corn_real, '')::DECIMAL,
    COALESCE(NULLIF(csv.nb_meg, '')::INTEGER, 0),
    NULLIF(csv.poids_de_foies_moyen, '')::DECIMAL,
    'termine',
    NOW()
FROM csv_import csv
LEFT JOIN gaveurs_euralis g ON g.nom = csv.gaveur
WHERE csv.code_lot IS NOT NULL
  AND csv.code_lot != ''
  AND csv.code_lot NOT LIKE 'Code%'
  AND csv.debut_lot IS NOT NULL
  AND csv.debut_lot != ''
  AND NOT EXISTS (SELECT 1 FROM lots_gavage WHERE code_lot = csv.code_lot);

-- Étape 5: Résumé
\echo ''
\echo '========================================='
\echo 'RÉSUMÉ IMPORT'
\echo '========================================='

SELECT
    COUNT(*) as nb_lots_csv,
    COUNT(DISTINCT gaveur_id) as nb_gaveurs,
    MIN(debut_lot) as premiere_date,
    MAX(debut_lot) as derniere_date,
    COUNT(*) FILTER (WHERE total_corn_real IS NOT NULL) as nb_avec_corn,
    COUNT(*) FILTER (WHERE poids_foie_moyen_g IS NOT NULL) as nb_avec_poids_foie,
    COUNT(*) FILTER (WHERE nb_meg > 0) as nb_avec_meg
FROM lots_gavage
WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%';

\echo ''
\echo 'Exemples lots importés:'
SELECT code_lot, itm, sigma, total_corn_real, nb_meg, poids_foie_moyen_g, debut_lot
FROM lots_gavage
WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%'
ORDER BY debut_lot
LIMIT 5;

\echo ''
\echo '✅ Import terminé!'
