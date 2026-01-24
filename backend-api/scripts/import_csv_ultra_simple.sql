-- ============================================================================
-- Import CSV Euralis - VERSION ULTRA SIMPLE (sans AWK)
-- ============================================================================

-- Nettoyer d'abord
DELETE FROM lots_gavage WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%';

-- Créer script shell dans le conteneur pour préparer le CSV
\! echo '#!/bin/sh' > /tmp/prepare_csv.sh
\! echo 'tail -n +2 /tmp/import.csv | while IFS=";" read -r c1 c2 c3 c4 c5 c6 c7 c8 c9 c10 c11 c12 c13 c14 c15 c16 c17 c18 c19 c20 c21 c22 c23 c24 c25 c26 c27 c28 c29 c30 c31 c32 c33 c34 c35 c36 c37 c38 c39 c40 c41 c42 c43 c44 c45 c46 c47 c48 c49 c50 c51 c52 c53 c54 c55 c56 c57 c58 c59 c60 c61 c62 c63 c64 c65 c66 c67 c68 c69 c70 c71 c72 c73 c74 c75 c76 c77 c78 c79 c80 c81 c82 c83 c84 c85 c86 c87 c88 c89 c90 c91 c92 c93 c94 c95 c96 c97 c98 c99 c100 c101 c102 c103 c104 c105 c106 c107 c108 c109 c110 c111 c112 c113 c114 c115 c116 c117 c118 c119 c120 c121 c122 c123 c124 c125 c126 c127 c128 c129 c130 c131 c132 c133 c134 c135 c136 c137 c138 c139 c140 c141 c142 c143 c144 c145 c146 c147 c148 c149 c150 c151 c152 c153 c154 c155 c156 c157 c158 c159 c160 c161 c162 c163 c164 c165 c166 c167 c168 c169 c170 c171 c172 c173 c174 c175 c176 c177 c178 c179 c180 c181 c182 c183 c184 c185 c186 c187 c188 c189 c190 c191 c192 c193 c194 c195 c196 c197 c198 rest; do' >> /tmp/prepare_csv.sh
\! echo '  code_lot=$(echo "$c198" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  gaveur=$(echo "$c158" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  debut=$(echo "$c159" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  meg=$(echo "$c161" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  qte=$(echo "$c162" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  duree=$(echo "$c167" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  souche=$(echo "$c182" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  geo=$(echo "$c150" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  itm=$(echo "$c184" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  sigma=$(echo "$c186" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  corn=$(echo "$c59" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  foie=$(echo "$c170" | sed "s/,/./g")' >> /tmp/prepare_csv.sh
\! echo '  echo "$code_lot;$gaveur;$debut;$meg;$qte;$duree;$souche;$geo;$itm;$sigma;$corn;$foie"' >> /tmp/prepare_csv.sh
\! echo 'done > /tmp/import_clean.csv' >> /tmp/prepare_csv.sh
\! chmod +x /tmp/prepare_csv.sh

\echo 'Préparation du CSV propre...'
\! /tmp/prepare_csv.sh

\echo 'Vérification CSV préparé:'
\! head -3 /tmp/import_clean.csv

-- Table temporaire
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

-- Import du CSV préparé
\echo ''
\echo 'Import du CSV nettoyé...'
\COPY csv_import FROM '/tmp/import_clean.csv' WITH (FORMAT CSV, DELIMITER ';', ENCODING 'LATIN1');

SELECT 'Lignes importées: ' || COUNT(*) FROM csv_import;

-- Aperçu
\echo ''
SELECT code_lot, gaveur, LEFT(debut_lot,10) as debut, itm, sigma, total_corn_real as corn, poids_de_foies_moyen as foie
FROM csv_import
WHERE code_lot LIKE 'LL%'
LIMIT 3;

-- Créer gaveurs
INSERT INTO gaveurs_euralis (nom, created_at)
SELECT DISTINCT csv.gaveur, NOW()
FROM csv_import csv
WHERE csv.gaveur != '' AND NOT EXISTS (SELECT 1 FROM gaveurs_euralis g WHERE g.nom = csv.gaveur);

-- Insérer lots
INSERT INTO lots_gavage (
    code_lot, gaveur_id, geo, souche, nb_accroches, debut_lot, duree_du_lot,
    itm, sigma, total_corn_real, nb_meg, poids_foie_moyen_g, statut, created_at
)
SELECT
    csv.code_lot,
    COALESCE(g.id, 1),
    csv.geo,
    CASE WHEN csv.souche ILIKE '%mulard%' OR csv.souche ILIKE '%M15%' THEN 'mulard' ELSE 'autre' END,
    NULLIF(csv.quantite_accrochee, '')::INTEGER,
    NULLIF(csv.debut_lot, '')::TIMESTAMP,
    NULLIF(csv.duree_du_lot, '')::INTEGER,
    NULLIF(csv.itm, '')::DECIMAL,
    NULLIF(csv.sigma, '')::DECIMAL,
    NULLIF(csv.total_corn_real, '')::DECIMAL,
    NULLIF(csv.nb_meg, '')::INTEGER,
    NULLIF(csv.poids_de_foies_moyen, '')::DECIMAL,
    'termine', NOW()
FROM csv_import csv
LEFT JOIN gaveurs_euralis g ON g.nom = csv.gaveur
WHERE csv.code_lot LIKE 'LL%' OR csv.code_lot LIKE 'LS%'
  AND csv.debut_lot != ''
  AND NOT EXISTS (SELECT 1 FROM lots_gavage WHERE code_lot = csv.code_lot);

-- Résumé
\echo ''
\echo '========== RÉSUMÉ =========='
SELECT
    COUNT(*) as nb_lots,
    MIN(debut_lot) as date_min,
    MAX(debut_lot) as date_max,
    ROUND(AVG(itm),2) as itm_moy,
    COUNT(*) FILTER (WHERE poids_foie_moyen_g IS NOT NULL) as avec_foie
FROM lots_gavage WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%';

SELECT code_lot, debut_lot, itm, poids_foie_moyen_g FROM lots_gavage WHERE code_lot LIKE 'LL%' LIMIT 3;

\echo '✅ Import terminé!'
