-- ============================================================================
-- Import CSV Euralis - VERSION FINALE avec AWK pour réordonner
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

-- Étape 2: Import avec AWK pour extraire et RÉORDONNER correctement
-- Ordre: Code_lot(198), Gaveur(158), Debut(159), Nb_MEG(161), Quantite(162), Duree(167), Souche(182), GEO(150), ITM(184), Sigma(186), total_corn(59), poids_foie(170)
\echo 'Import CSV avec réordonnancement AWK...'
\COPY csv_import FROM PROGRAM E'tail -n +2 /tmp/import.csv | awk -F";" \'{gsub(/,/, ".", $0); print $198";"$158";"$159";"$161";"$162";"$167";"$182";"$150";"$184";"$186";"$59";"$170}\'' WITH (FORMAT CSV, DELIMITER ';', ENCODING 'LATIN1');

\echo 'Lignes importées:'
SELECT COUNT(*) FROM csv_import;

\echo ''
\echo 'Aperçu (vérification ordre colonnes):'
SELECT
    code_lot as "Code Lot",
    gaveur as "Gaveur",
    LEFT(debut_lot, 10) as "Date début",
    itm as "ITM",
    sigma as "Sigma",
    total_corn_real as "Total Corn",
    poids_de_foies_moyen as "Poids Foie"
FROM csv_import
WHERE code_lot LIKE 'LL%'
LIMIT 3;

-- Étape 3: Créer gaveurs
\echo ''
\echo 'Création gaveurs manquants...'
INSERT INTO gaveurs_euralis (nom, created_at)
SELECT DISTINCT csv.gaveur, NOW()
FROM csv_import csv
WHERE csv.gaveur IS NOT NULL
  AND csv.gaveur != ''
  AND NOT EXISTS (SELECT 1 FROM gaveurs_euralis g WHERE g.nom = csv.gaveur);

\echo 'Gaveurs dans la base:'
SELECT COUNT(*) as total FROM gaveurs_euralis;

-- Étape 4: Insérer lots
\echo ''
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
  AND csv.code_lot LIKE 'LL%' OR csv.code_lot LIKE 'LS%'
  AND csv.debut_lot IS NOT NULL
  AND csv.debut_lot != ''
  AND NOT EXISTS (SELECT 1 FROM lots_gavage WHERE code_lot = csv.code_lot);

\echo 'Lots insérés.'

-- Étape 5: Résumé
\echo ''
\echo '========================================='
\echo 'RÉSUMÉ IMPORT CSV EURALIS'
\echo '========================================='

SELECT
    COUNT(*) as "Nb lots CSV",
    COUNT(DISTINCT gaveur_id) as "Nb gaveurs",
    TO_CHAR(MIN(debut_lot), 'YYYY-MM-DD') as "1ère date",
    TO_CHAR(MAX(debut_lot), 'YYYY-MM-DD') as "Dernière date",
    ROUND(AVG(itm), 2) as "ITM moyen",
    COUNT(*) FILTER (WHERE total_corn_real IS NOT NULL) as "Avec corn",
    COUNT(*) FILTER (WHERE poids_foie_moyen_g IS NOT NULL) as "Avec poids foie",
    COUNT(*) FILTER (WHERE nb_meg > 0) as "Avec MEG"
FROM lots_gavage
WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%';

\echo ''
\echo 'Exemples de lots importés:'
SELECT
    code_lot as "Code",
    TO_CHAR(debut_lot, 'YYYY-MM-DD') as "Date",
    itm as "ITM",
    sigma as "Sigma",
    total_corn_real as "Corn (g)",
    nb_meg as "MEG",
    poids_foie_moyen_g as "Foie (g)"
FROM lots_gavage
WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%'
ORDER BY debut_lot
LIMIT 5;

\echo ''
\echo '✅ Import CSV Euralis TERMINÉ!'
\echo ''
\echo 'Vérifiez les données ci-dessus.'
\echo 'Si correct, prochaine étape: Générer SQAL'
