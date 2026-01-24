-- ================================================================================
-- TESTS DE VALIDATION - Production avec SQAL
-- ================================================================================
-- Description : Tests pour valider le calcul de production basé sur SQAL
-- Date        : 2026-01-01
-- ================================================================================

\echo ''
\echo '================================================================================'
\echo 'TESTS DE VALIDATION - Production avec SQAL'
\echo '================================================================================'
\echo ''

-- ================================================================================
-- Test 1: Vérifier Cohérence Volume → Masse
-- ================================================================================

\echo '----------------------------------------'
\echo 'Test 1: Cohérence Volume → Masse'
\echo '----------------------------------------'

SELECT
    'Test 1' as test_name,
    COUNT(*) as nb_echantillons,
    MIN(vl53l8ch_volume_mm3) as volume_min_mm3,
    MAX(vl53l8ch_volume_mm3) as volume_max_mm3,
    AVG(vl53l8ch_volume_mm3) as volume_moyen_mm3,
    MIN(poids_foie_estime_g) as poids_min_g,
    MAX(poids_foie_estime_g) as poids_max_g,
    AVG(poids_foie_estime_g) as poids_moyen_g,
    -- Vérifier que la formule est correcte
    AVG(poids_foie_estime_g / (vl53l8ch_volume_mm3 / 1000.0)) as densite_moyenne,
    CASE
        WHEN ABS(AVG(poids_foie_estime_g / (vl53l8ch_volume_mm3 / 1000.0)) - 0.947) < 0.05
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as resultat
FROM sqal_sensor_samples
WHERE poids_foie_estime_g IS NOT NULL
  AND vl53l8ch_volume_mm3 IS NOT NULL;

\echo ''

-- ================================================================================
-- Test 2: Cohérence ITM Ancien vs SQAL
-- ================================================================================

\echo '----------------------------------------'
\echo 'Test 2: Cohérence ITM Ancien vs SQAL'
\echo '----------------------------------------'

SELECT
    'Test 2' as test_name,
    l.code_lot,
    l.nb_accroches as nb_canards,
    l.itm as itm_actuel,
    l.total_corn_real / NULLIF(l.nb_accroches, 0) as mais_par_canard_g,
    AVG(s.poids_foie_estime_g) as poids_sqal_moyen_g,
    AVG(s.poids_foie_estime_g) / NULLIF((l.total_corn_real / NULLIF(l.nb_accroches, 0)), 0) as itm_sqal,
    ABS(l.itm - (AVG(s.poids_foie_estime_g) / NULLIF((l.total_corn_real / NULLIF(l.nb_accroches, 0)), 0))) as ecart_itm,
    CASE
        WHEN ABS(l.itm - (AVG(s.poids_foie_estime_g) / NULLIF((l.total_corn_real / NULLIF(l.nb_accroches, 0)), 0))) < 0.01
        THEN '✅ PASS'
        ELSE '⚠️  WARN'
    END as resultat
FROM lots_gavage l
JOIN sqal_sensor_samples s ON l.id = s.lot_id
WHERE l.statut IN ('termine', 'abattu')
  AND s.poids_foie_estime_g IS NOT NULL
  AND l.itm IS NOT NULL
  AND l.total_corn_real IS NOT NULL
GROUP BY l.id, l.code_lot, l.nb_accroches, l.itm, l.total_corn_real
ORDER BY ecart_itm DESC
LIMIT 10;

\echo ''

-- ================================================================================
-- Test 3: Comparaison Production ITM vs SQAL
-- ================================================================================

\echo '----------------------------------------'
\echo 'Test 3: Comparaison Production ITM vs SQAL'
\echo '----------------------------------------'

WITH production_itm AS (
    SELECT
        'Via ITM' as methode,
        SUM(total_corn_real * itm / 1000) as production_kg
    FROM lots_gavage
    WHERE statut IN ('termine', 'abattu')
      AND total_corn_real IS NOT NULL
      AND itm IS NOT NULL
),
production_sqal AS (
    SELECT
        'Via SQAL' as methode,
        SUM(s.poids_moyen_g * l.nb_accroches) / 1000 as production_kg
    FROM lots_gavage l
    JOIN (
        SELECT
            lot_id,
            AVG(poids_foie_estime_g) as poids_moyen_g
        FROM sqal_sensor_samples
        WHERE poids_foie_estime_g IS NOT NULL
        GROUP BY lot_id
    ) s ON l.id = s.lot_id
    WHERE l.statut IN ('termine', 'abattu')
)
SELECT
    'Test 3' as test_name,
    i.methode as methode_itm,
    ROUND(i.production_kg::numeric, 2) as production_itm_kg,
    s.methode as methode_sqal,
    ROUND(s.production_kg::numeric, 2) as production_sqal_kg,
    ROUND(ABS(i.production_kg - s.production_kg)::numeric, 2) as ecart_kg,
    ROUND((ABS(i.production_kg - s.production_kg) / NULLIF(i.production_kg, 0) * 100)::numeric, 2) as ecart_pct,
    CASE
        WHEN ABS(i.production_kg - s.production_kg) / NULLIF(i.production_kg, 0) * 100 < 1
        THEN '✅ PASS'
        WHEN ABS(i.production_kg - s.production_kg) / NULLIF(i.production_kg, 0) * 100 < 5
        THEN '⚠️  WARN'
        ELSE '❌ FAIL'
    END as resultat
FROM production_itm i, production_sqal s;

\echo ''

-- ================================================================================
-- Test 4: Vérifier Trigger ITM
-- ================================================================================

\echo '----------------------------------------'
\echo 'Test 4: Vérifier Trigger ITM'
\echo '----------------------------------------'

SELECT
    'Test 4' as test_name,
    COUNT(DISTINCT l.id) as nb_lots_avec_sqal,
    COUNT(CASE WHEN l.itm IS NOT NULL THEN 1 END) as nb_lots_avec_itm,
    CASE
        WHEN COUNT(DISTINCT l.id) = COUNT(CASE WHEN l.itm IS NOT NULL THEN 1 END)
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as resultat
FROM lots_gavage l
WHERE EXISTS (
    SELECT 1
    FROM sqal_sensor_samples s
    WHERE s.lot_id = l.id
      AND s.poids_foie_estime_g IS NOT NULL
);

\echo ''

-- ================================================================================
-- Test 5: Distribution Poids Foie
-- ================================================================================

\echo '----------------------------------------'
\echo 'Test 5: Distribution Poids Foie'
\echo '----------------------------------------'

SELECT
    'Test 5' as test_name,
    COUNT(*) as nb_echantillons,
    COUNT(CASE WHEN poids_foie_estime_g < 400 THEN 1 END) as nb_legers,
    COUNT(CASE WHEN poids_foie_estime_g >= 400 AND poids_foie_estime_g < 600 THEN 1 END) as nb_standard,
    COUNT(CASE WHEN poids_foie_estime_g >= 600 AND poids_foie_estime_g < 700 THEN 1 END) as nb_bons,
    COUNT(CASE WHEN poids_foie_estime_g >= 700 THEN 1 END) as nb_premium,
    ROUND(AVG(poids_foie_estime_g)::numeric, 1) as poids_moyen_g,
    ROUND(STDDEV(poids_foie_estime_g)::numeric, 1) as ecart_type_g,
    ROUND(MIN(poids_foie_estime_g)::numeric, 1) as poids_min_g,
    ROUND(MAX(poids_foie_estime_g)::numeric, 1) as poids_max_g,
    CASE
        WHEN AVG(poids_foie_estime_g) BETWEEN 400 AND 800
        THEN '✅ PASS'
        ELSE '⚠️  WARN'
    END as resultat
FROM sqal_sensor_samples
WHERE poids_foie_estime_g IS NOT NULL;

\echo ''

-- ================================================================================
-- Test 6: Production par Lot
-- ================================================================================

\echo '----------------------------------------'
\echo 'Test 6: Production par Lot (Top 5)'
\echo '----------------------------------------'

SELECT
    'Test 6' as test_name,
    l.code_lot,
    l.nb_accroches as nb_canards,
    COUNT(s.poids_foie_estime_g) as nb_mesures_sqal,
    ROUND(AVG(s.poids_foie_estime_g)::numeric, 1) as poids_moyen_g,
    ROUND((AVG(s.poids_foie_estime_g) * l.nb_accroches / 1000)::numeric, 2) as production_lot_kg,
    ROUND(l.itm::numeric, 4) as itm_lot,
    CASE
        WHEN COUNT(s.poids_foie_estime_g) >= l.nb_accroches * 0.9
        THEN '✅ PASS'
        ELSE '⚠️  WARN'
    END as resultat
FROM lots_gavage l
JOIN sqal_sensor_samples s ON l.id = s.lot_id
WHERE l.statut IN ('termine', 'abattu')
  AND s.poids_foie_estime_g IS NOT NULL
GROUP BY l.id, l.code_lot, l.nb_accroches, l.itm
ORDER BY production_lot_kg DESC
LIMIT 5;

\echo ''

-- ================================================================================
-- RÉSUMÉ FINAL
-- ================================================================================

\echo '================================================================================'
\echo 'RÉSUMÉ FINAL DES TESTS'
\echo '================================================================================'

\echo ''
\echo 'Légende:'
\echo '  ✅ PASS  : Test réussi'
\echo '  ⚠️  WARN  : Avertissement (vérifier manuellement)'
\echo '  ❌ FAIL  : Test échoué'
\echo ''

\echo '================================================================================'
