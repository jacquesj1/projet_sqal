-- ============================================================================
-- Import CSV Euralis - Colonnes dans le BON ORDRE
-- ============================================================================
-- Colonnes: 198=Code_lot, 158=Gaveur, 159=Debut, 161=Nb_MEG, 162=Quantite,
--           167=Duree, 182=Souche, 150=GEO, 184=ITM, 186=Sigma,
--           59=total_cornReal, 170=Poids_foies
-- ============================================================================

-- Étape 1: Table temporaire
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

-- Étape 2: Import avec les BONS numéros de colonnes
\echo 'Import CSV (colonnes: 198,158,159,161,162,167,182,150,184,186,59,170)...'
\COPY csv_import FROM PROGRAM 'tail -n +2 /tmp/import.csv | cut -d";" -f198,158,159,161,162,167,182,150,184,186,59,170 | sed "s/,/./g"' WITH (FORMAT CSV, DELIMITER ';', ENCODING 'LATIN1');

\echo 'Lignes importées:'
SELECT COUNT(*) FROM csv_import;

\echo ''
\echo 'Aperçu (3 premières lignes):'
SELECT code_lot, gaveur, debut_lot, itm, sigma, total_corn_real, poids_de_foies_moyen
FROM csv_import
LIMIT 3;

-- Étape 3: Créer gaveurs
\echo ''
\echo 'Création gaveurs manquants...'
INSERT INTO gaveurs_euralis (nom, created_at)
SELECT DISTINCT csv.gaveur, NOW()
FROM csv_import csv
WHERE csv.gaveur IS NOT NULL
  AND csv.gaveur != ''
  AND NOT EXISTS (SELECT 1 FROM gaveurs_euralis g WHERE g.nom = csv.gaveur)
ON CONFLICT (nom) DO NOTHING;

-- Étape 4: Insérer lots
\echo 'Insertion lots dans lots_gavage...'
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
        WHEN csv.souche ILIKE '%mulard%' OR csv.souche ILIKE '%M15%' THEN 'mulard'
        WHEN csv.souche ILIKE '%barbarie%' THEN 'barbarie'
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
  AND csv.debut_lot IS NOT NULL
  AND csv.debut_lot != ''
ON CONFLICT (code_lot) DO NOTHING;

-- Étape 5: Résumé
\echo ''
\echo '========================================='
\echo 'RÉSUMÉ IMPORT CSV EURALIS'
\echo '========================================='

SELECT
    COUNT(*) as nb_lots_csv,
    COUNT(DISTINCT gaveur_id) as nb_gaveurs,
    MIN(debut_lot) as premiere_date,
    MAX(debut_lot) as derniere_date,
    AVG(itm) as itm_moyen,
    COUNT(*) FILTER (WHERE total_corn_real IS NOT NULL) as nb_avec_corn,
    COUNT(*) FILTER (WHERE poids_foie_moyen_g IS NOT NULL) as nb_avec_poids_foie,
    COUNT(*) FILTER (WHERE nb_meg > 0) as nb_avec_meg
FROM lots_gavage
WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%';

\echo ''
\echo 'Top 5 lots (triés par date):'
SELECT code_lot, gaveur_id, itm, sigma, total_corn_real, nb_meg, poids_foie_moyen_g, debut_lot
FROM lots_gavage
WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%'
ORDER BY debut_lot
LIMIT 5;

\echo ''
\echo '✅ Import CSV Euralis terminé!'
\echo ''
\echo 'Prochaine étape: Générer données SQAL'
\echo '  scripts/generate_sqal_on_imported_lots.bat'
