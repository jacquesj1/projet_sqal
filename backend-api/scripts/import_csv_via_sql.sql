-- ============================================================================
-- Import CSV Euralis via SQL pur (PostgreSQL)
-- ============================================================================
-- Date: 13 Janvier 2026
-- Fichier: /tmp/import.csv (Pretraite_End_2024.csv)
-- Objectif: Importer 75 lots réels depuis CSV Euralis
-- ============================================================================

-- Étape 1: Créer table temporaire pour import CSV
DROP TABLE IF EXISTS csv_euralis_temp;
CREATE TEMP TABLE csv_euralis_temp (
    CodeLot VARCHAR,
    feedTarget_1 DECIMAL, feedCornReal_1 DECIMAL,
    feedTarget_2 DECIMAL, feedCornReal_2 DECIMAL,
    feedTarget_3 DECIMAL, feedCornReal_3 DECIMAL,
    feedTarget_4 DECIMAL, feedCornReal_4 DECIMAL,
    feedTarget_5 DECIMAL, feedCornReal_5 DECIMAL,
    feedTarget_6 DECIMAL, feedCornReal_6 DECIMAL,
    feedTarget_7 DECIMAL, feedCornReal_7 DECIMAL,
    feedTarget_8 DECIMAL, feedCornReal_8 DECIMAL,
    feedTarget_9 DECIMAL, feedCornReal_9 DECIMAL,
    feedTarget_10 DECIMAL, feedCornReal_10 DECIMAL,
    feedTarget_11 DECIMAL, feedCornReal_11 DECIMAL,
    feedTarget_12 DECIMAL, feedCornReal_12 DECIMAL,
    feedTarget_13 DECIMAL, feedCornReal_13 DECIMAL,
    feedTarget_14 DECIMAL, feedCornReal_14 DECIMAL,
    feedTarget_15 DECIMAL, feedCornReal_15 DECIMAL,
    feedTarget_16 DECIMAL, feedCornReal_16 DECIMAL,
    feedTarget_17 DECIMAL, feedCornReal_17 DECIMAL,
    feedTarget_18 DECIMAL, feedCornReal_18 DECIMAL,
    feedTarget_19 DECIMAL, feedCornReal_19 DECIMAL,
    feedTarget_20 DECIMAL, feedCornReal_20 DECIMAL,
    feedTarget_21 DECIMAL, feedCornReal_21 DECIMAL,
    feedTarget_22 DECIMAL, feedCornReal_22 DECIMAL,
    feedTarget_23 DECIMAL, feedCornReal_23 DECIMAL,
    feedTarget_24 DECIMAL, feedCornReal_24 DECIMAL,
    feedTarget_25 DECIMAL, feedCornReal_25 DECIMAL,
    feedTarget_26 DECIMAL, feedCornReal_26 DECIMAL,
    feedTarget_27 DECIMAL, feedCornReal_27 DECIMAL,
    total_cornTarget DECIMAL,
    total_cornReal DECIMAL,
    -- Colonnes essentielles (il y en a 174 au total, on liste celles dont on a besoin)
    col59 VARCHAR, col60 VARCHAR, col61 VARCHAR, col62 VARCHAR, col63 VARCHAR,
    col64 VARCHAR, col65 VARCHAR, col66 VARCHAR, col67 VARCHAR, col68 VARCHAR,
    col69 VARCHAR, col70 VARCHAR, col71 VARCHAR, col72 VARCHAR, col73 VARCHAR,
    col74 VARCHAR, col75 VARCHAR, col76 VARCHAR, col77 VARCHAR, col78 VARCHAR,
    col79 VARCHAR, col80 VARCHAR, col81 VARCHAR, col82 VARCHAR, col83 VARCHAR,
    col84 VARCHAR, col85 VARCHAR, col86 VARCHAR, col87 VARCHAR, col88 VARCHAR,
    col89 VARCHAR, col90 VARCHAR, col91 VARCHAR, col92 VARCHAR, col93 VARCHAR,
    col94 VARCHAR, col95 VARCHAR, col96 VARCHAR, col97 VARCHAR, col98 VARCHAR,
    col99 VARCHAR, col100 VARCHAR, col101 VARCHAR, col102 VARCHAR, col103 VARCHAR,
    col104 VARCHAR, col105 VARCHAR, col106 VARCHAR, col107 VARCHAR, col108 VARCHAR,
    col109 VARCHAR, col110 VARCHAR, col111 VARCHAR, col112 VARCHAR, col113 VARCHAR,
    col114 VARCHAR, col115 VARCHAR, col116 VARCHAR, col117 VARCHAR, col118 VARCHAR,
    col119 VARCHAR, col120 VARCHAR, col121 VARCHAR, col122 VARCHAR, col123 VARCHAR,
    col124 VARCHAR, col125 VARCHAR, col126 VARCHAR, col127 VARCHAR, col128 VARCHAR,
    col129 VARCHAR, col130 VARCHAR, col131 VARCHAR, col132 VARCHAR, col133 VARCHAR,
    col134 VARCHAR, col135 VARCHAR, col136 VARCHAR, col137 VARCHAR, col138 VARCHAR,
    col139 VARCHAR, col140 VARCHAR, col141 VARCHAR, col142 VARCHAR, col143 VARCHAR,
    col144 VARCHAR, col145 VARCHAR, col146 VARCHAR, col147 VARCHAR, col148 VARCHAR,
    col149 VARCHAR, col150 VARCHAR, col151 VARCHAR, col152 VARCHAR, col153 VARCHAR,
    col154 VARCHAR, col155 VARCHAR, col156 VARCHAR, col157 VARCHAR, col158 VARCHAR,
    Gaveur VARCHAR,
    Debut_du_lot VARCHAR,
    Nombre_enleve VARCHAR,
    Nb_MEG VARCHAR,
    Quantite_accrochee VARCHAR,
    Lot_GAV VARCHAR,
    Lot_PAG VARCHAR,
    Age_des_animaux VARCHAR,
    Duree_du_lot VARCHAR,
    Conso_Gav_Z1 VARCHAR,
    Souche VARCHAR,
    Poids_de_foies_moyen VARCHAR,
    Poids_moyen_de_PCE VARCHAR,
    dPctgPerteGav VARCHAR,
    ITM VARCHAR,
    ITM_cut VARCHAR,
    Sigma VARCHAR,
    Sigma_cut VARCHAR,
    Civilite VARCHAR,
    RaisonSociale VARCHAR,
    NomUsage VARCHAR,
    Adresse1 VARCHAR,
    Adresse2 VARCHAR,
    CodePostal VARCHAR,
    Commune VARCHAR,
    Telephone1 VARCHAR,
    Email VARCHAR,
    Code_lot VARCHAR,
    GEO VARCHAR
);

-- Étape 2: Importer le CSV
\echo 'Import CSV en cours...'
\COPY csv_euralis_temp FROM '/tmp/import.csv' WITH (FORMAT CSV, DELIMITER ';', HEADER true, ENCODING 'LATIN1');

\echo 'CSV importé. Nombre de lignes:'
SELECT COUNT(*) FROM csv_euralis_temp;

-- Étape 3: Créer les gaveurs manquants
\echo 'Création gaveurs...'
INSERT INTO gaveurs (nom, created_at)
SELECT DISTINCT csv.Gaveur, NOW()
FROM csv_euralis_temp csv
WHERE csv.Gaveur IS NOT NULL
  AND csv.Gaveur != ''
  AND NOT EXISTS (SELECT 1 FROM gaveurs g WHERE g.nom = csv.Gaveur)
ORDER BY csv.Gaveur;

\echo 'Gaveurs créés/existants:'
SELECT COUNT(*) FROM gaveurs;

-- Étape 4: Insérer les lots dans lots_gavage
\echo 'Insertion des lots...'
INSERT INTO lots_gavage (
    code_lot,
    gaveur_id,
    site_origine,
    souche,
    nombre_canards,
    date_debut_gavage,
    date_fin_prevue,
    duree_gavage_prevue,
    poids_moyen_initial,
    poids_moyen_actuel,
    poids_moyen_final,
    itm,
    sigma,
    total_corn_real_g,
    nb_meg,
    poids_foie_moyen_g,
    statut,
    created_at
)
SELECT
    csv.Code_lot,
    COALESCE(g.id, 1) as gaveur_id,
    CASE
        WHEN UPPER(csv.GEO) LIKE '%BRETAGNE%' THEN 'Bretagne'
        WHEN UPPER(csv.GEO) LIKE '%SUDOUEST%' THEN 'SudOuest'
        WHEN UPPER(csv.GEO) LIKE '%SUD%OUEST%' THEN 'SudOuest'
        ELSE 'Autre'
    END as site_origine,
    'mulard' as souche,
    NULLIF(csv.Quantite_accrochee, '')::INTEGER,
    NULLIF(csv.Debut_du_lot, '')::TIMESTAMP::DATE,
    NULLIF(csv.Debut_du_lot, '')::TIMESTAMP::DATE + (COALESCE(NULLIF(csv.Duree_du_lot, '')::INTEGER, 11) || ' days')::INTERVAL,
    COALESCE(NULLIF(csv.Duree_du_lot, '')::INTEGER, 11),
    4500.0,  -- Poids initial par défaut
    4500.0,  -- Poids actuel = initial
    6500.0,  -- Poids final estimé
    NULLIF(csv.ITM, '')::DECIMAL,
    NULLIF(csv.Sigma, '')::DECIMAL,
    NULLIF(csv.total_cornReal, '')::DECIMAL,
    COALESCE(NULLIF(csv.Nb_MEG, '')::INTEGER, 0),
    NULLIF(csv.Poids_de_foies_moyen, '')::DECIMAL,
    'termine',
    NOW()
FROM csv_euralis_temp csv
LEFT JOIN gaveurs g ON g.nom = csv.Gaveur
WHERE csv.Code_lot IS NOT NULL
  AND csv.Code_lot != ''
  AND csv.Debut_du_lot IS NOT NULL
  AND csv.Debut_du_lot != ''
  AND NOT EXISTS (SELECT 1 FROM lots WHERE code_lot = csv.Code_lot);

\echo 'Lots insérés:'
SELECT COUNT(*) FROM lots WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%';

-- Étape 5: Vérification
\echo '========================================='
\echo 'RÉSUMÉ IMPORT'
\echo '========================================='

SELECT
    COUNT(*) as nb_lots,
    COUNT(DISTINCT gaveur_id) as nb_gaveurs,
    MIN(date_debut_gavage) as premiere_date,
    MAX(date_debut_gavage) as derniere_date,
    COUNT(*) FILTER (WHERE total_corn_real_g IS NOT NULL) as nb_avec_total_corn,
    COUNT(*) FILTER (WHERE poids_foie_moyen_g IS NOT NULL) as nb_avec_poids_foie,
    COUNT(*) FILTER (WHERE nb_meg > 0) as nb_avec_meg
FROM lots
WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%';

\echo ''
\echo 'Exemples de lots importés:'
SELECT code_lot, itm, sigma, total_corn_real_g, nb_meg, poids_foie_moyen_g, date_debut_gavage
FROM lots
WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%'
ORDER BY date_debut_gavage
LIMIT 5;

\echo ''
\echo '✅ Import terminé!'
