# Guide Hypertables TimescaleDB - Comment les Utiliser

## 🎯 Qu'est-ce qu'une Hypertable?

Une **hypertable** est une table TimescaleDB optimisée pour les données **time-series** (séries temporelles). Elle se comporte comme une table PostgreSQL normale, mais est automatiquement **partitionnée** par temps pour des performances maximales.

---

## 📊 Les 10 Hypertables du Système

### État Actuel (08 Jan 2026):

| Hypertable | Groupe | Rows | Statut | Utilisation |
|------------|--------|------|--------|-------------|
| **gavage_data_lots** ✅ | Gaveurs | 1536 | ACTIVE | Données gavage niveau LOT (principale) |
| **doses_journalieres** ✅ | Euralis | 8 | ACTIVE | Dashboard Euralis |
| **sqal_sensor_samples** ✅ | SQAL | 30 | ACTIVE | Capteurs IoT temps réel |
| **gavage_data** ❌ | Gaveurs | 175 | À SUPPRIMER | Obsolète (canards individuels) |
| **gavage_lot_quotidien** ❌ | Gaveurs | ? | À SUPPRIMER | Obsolète (remplacée par doses_journalieres) |
| **alertes** ⚠️ | Gaveurs | ? | À MIGRER | Alertes canards → lots |
| **alertes_euralis** ✅ | Euralis | 0 | OK | Alertes Euralis |
| **consumer_feedbacks** ✅ | Consumer | 0 | OK | Feedbacks consommateurs |
| **sqal_alerts** ✅ | SQAL | 0 | OK | Alertes qualité |
| **blockchain** ✅ | Blockchain | 0 | OK | Transactions blockchain |

---

## 🚀 Comment Utiliser les Hypertables

### 1. Insertion de Données (Comme Table Normale)

```sql
-- Exemple 1: Insérer données gavage (hypertable gavage_data_lots)
INSERT INTO gavage_data_lots (
    time,                    -- ← TOUJOURS timestamp actuel ou spécifique
    lot_gavage_id,
    jour_gavage,
    repas,
    dose_moyenne,
    dose_theorique,
    poids_moyen_lot,
    nb_canards_vivants,
    taux_mortalite,
    temperature_stabule,
    humidite_stabule
) VALUES (
    NOW(),                   -- ← Temps actuel
    3472,                    -- ID du lot LL2601001
    5,                       -- Jour 5
    'matin',                 -- Repas du matin
    305.50,                  -- Dose moyenne
    300.00,                  -- Dose théorique
    5250.00,                 -- Poids moyen
    45,                      -- Canards vivants
    2.17,                    -- Taux mortalité
    18.5,                    -- Température
    65.0                     -- Humidité
);

-- Exemple 2: Insérer capteur SQAL (hypertable sqal_sensor_samples)
INSERT INTO sqal_sensor_samples (
    time,
    device_id,
    lot_id,
    sample_type,
    quality_grade,
    tof_zone_0_0, tof_zone_0_1, ...,  -- 64 valeurs ToF
    spectral_415nm, spectral_445nm, ...  -- 10 canaux spectraux
) VALUES (
    NOW(),
    'ESP32_DEMO_01',
    3472,
    'foie_entier',
    'A+',
    120, 125, ...,          -- Distances ToF en mm
    15000, 18000, ...       -- Valeurs spectrales
);
```

### 2. Requêtes (Comme Table Normale + Optimisations Temps)

```sql
-- ✅ BON: Filtrer par temps (utilise partitionnement)
SELECT *
FROM gavage_data_lots
WHERE time > NOW() - INTERVAL '7 days'
  AND lot_gavage_id = 3472
ORDER BY time DESC;

-- ✅ BON: Agrégation sur période
SELECT
    time_bucket('1 hour', time) AS hour,
    AVG(dose_moyenne) as dose_avg,
    MAX(poids_moyen_lot) as poids_max
FROM gavage_data_lots
WHERE time > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- ❌ MAUVAIS: Sans filtre temps (scan toutes les partitions)
SELECT * FROM gavage_data_lots WHERE lot_gavage_id = 3472;
-- Ajouter TOUJOURS un filtre temps!
```

### 3. Fonctions TimescaleDB Spéciales

#### `time_bucket()` - Agrégation par intervalles
```sql
-- Moyennes horaires
SELECT
    time_bucket('1 hour', time) AS hour,
    lot_gavage_id,
    AVG(dose_moyenne) as dose_moyenne_horaire,
    AVG(poids_moyen_lot) as poids_moyen_horaire
FROM gavage_data_lots
WHERE time > NOW() - INTERVAL '7 days'
GROUP BY hour, lot_gavage_id
ORDER BY hour DESC;

-- Moyennes journalières
SELECT
    time_bucket('1 day', time) AS day,
    COUNT(*) as nb_repas,
    AVG(dose_moyenne) as dose_moyenne_journaliere
FROM gavage_data_lots
WHERE time > NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day DESC;
```

#### `first()` et `last()` - Première/dernière valeur
```sql
-- Dernière dose pour chaque lot
SELECT
    lot_gavage_id,
    last(dose_moyenne, time) as derniere_dose,
    last(time, time) as timestamp_derniere_dose
FROM gavage_data_lots
WHERE time > NOW() - INTERVAL '7 days'
GROUP BY lot_gavage_id;
```

#### `histogram()` - Distribution des valeurs
```sql
-- Distribution des doses
SELECT histogram(dose_moyenne, 250, 450, 10)
FROM gavage_data_lots
WHERE time > NOW() - INTERVAL '7 days';
```

### 4. Continuous Aggregates (Vues Matérialisées Auto-Refresh)

```sql
-- Créer agrégat continu pour stats horaires gavage
CREATE MATERIALIZED VIEW gavage_stats_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    lot_gavage_id,
    AVG(dose_moyenne) as dose_moyenne,
    AVG(poids_moyen_lot) as poids_moyen,
    MAX(taux_mortalite) as taux_mortalite_max,
    COUNT(*) as nb_repas
FROM gavage_data_lots
GROUP BY hour, lot_gavage_id;

-- Politique de refresh automatique (toutes les heures)
SELECT add_continuous_aggregate_policy('gavage_stats_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Requête ultra-rapide (lit la vue pré-calculée)
SELECT * FROM gavage_stats_hourly
WHERE hour > NOW() - INTERVAL '7 days'
ORDER BY hour DESC;
```

### 5. Compression Automatique (Économie d'Espace)

```sql
-- Activer compression (données > 7 jours)
ALTER TABLE gavage_data_lots SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'lot_gavage_id',
    timescaledb.compress_orderby = 'time DESC'
);

-- Politique de compression automatique
SELECT add_compression_policy('gavage_data_lots', INTERVAL '7 days');

-- Vérifier taux de compression
SELECT
    pg_size_pretty(before_compression_total_bytes) as size_before,
    pg_size_pretty(after_compression_total_bytes) as size_after,
    ROUND((1 - after_compression_total_bytes::numeric / before_compression_total_bytes::numeric) * 100, 2) as compression_ratio
FROM timescaledb_information.compression_settings
WHERE hypertable_name = 'gavage_data_lots';
```

### 6. Retention Policies (Suppression Auto Anciennes Données)

```sql
-- Supprimer automatiquement données > 1 an
SELECT add_retention_policy('gavage_data_lots', INTERVAL '365 days');

-- Vérifier politique
SELECT * FROM timescaledb_information.jobs
WHERE proc_name = 'policy_retention';
```

---

## 📈 Cas d'Usage Concrets

### Use Case 1: Dashboard Temps Réel Gavage

```sql
-- Dernières 24h de gavage pour un lot
SELECT
    time,
    jour_gavage,
    repas,
    dose_moyenne,
    poids_moyen_lot,
    nb_canards_vivants,
    taux_mortalite
FROM gavage_data_lots
WHERE lot_gavage_id = 3472
  AND time > NOW() - INTERVAL '24 hours'
ORDER BY time DESC;

-- Évolution du poids moyen par jour
SELECT
    jour_gavage,
    AVG(poids_moyen_lot) as poids_moyen,
    AVG(dose_moyenne) as dose_moyenne
FROM gavage_data_lots
WHERE lot_gavage_id = 3472
GROUP BY jour_gavage
ORDER BY jour_gavage;
```

### Use Case 2: Dashboard SQAL Qualité Temps Réel

```sql
-- Derniers 100 échantillons SQAL
SELECT
    time,
    device_id,
    sample_type,
    quality_grade,
    spectral_415nm,
    spectral_630nm,
    tof_zone_3_3  -- Centre de la matrice 8x8
FROM sqal_sensor_samples
WHERE time > NOW() - INTERVAL '1 hour'
ORDER BY time DESC
LIMIT 100;

-- Distribution des grades qualité (dernières 24h)
SELECT
    quality_grade,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM sqal_sensor_samples
WHERE time > NOW() - INTERVAL '24 hours'
GROUP BY quality_grade
ORDER BY quality_grade;
```

### Use Case 3: Alertes en Temps Réel

```sql
-- Détecter mortalité anormale (> 3%)
INSERT INTO alertes_euralis (
    time,
    lot_id,
    type_alerte,
    criticite,
    titre,
    description,
    valeur_observee
)
SELECT
    NOW(),
    lot_gavage_id,
    'mortalite_elevee',
    'critique',
    'Taux de mortalité anormal',
    'Taux de mortalité supérieur à 3%: ' || taux_mortalite::text || '%',
    taux_mortalite
FROM gavage_data_lots
WHERE time = (SELECT MAX(time) FROM gavage_data_lots WHERE lot_gavage_id = 3472)
  AND taux_mortalite > 3.0
  AND lot_gavage_id = 3472;
```

### Use Case 4: Analyse Historique

```sql
-- Comparer performance lots similaires (30 derniers jours)
SELECT
    lg.code_lot,
    lg.genetique,
    AVG(gdl.dose_moyenne) as dose_moyenne,
    AVG(gdl.poids_moyen_lot) as poids_moyen,
    MAX(gdl.taux_mortalite) as taux_mortalite_max
FROM gavage_data_lots gdl
JOIN lots_gavage lg ON gdl.lot_gavage_id = lg.id
WHERE gdl.time > NOW() - INTERVAL '30 days'
  AND lg.genetique = 'mulard'
GROUP BY lg.code_lot, lg.genetique
ORDER BY dose_moyenne DESC;
```

---

## 🔧 Maintenance et Monitoring

### Vérifier État Hypertables

```sql
-- Liste toutes les hypertables avec stats
SELECT
    h.hypertable_name,
    h.num_dimensions,
    c.total_chunks,
    pg_size_pretty(h.total_bytes) as total_size,
    pg_size_pretty(h.index_bytes) as index_size
FROM timescaledb_information.hypertables h
LEFT JOIN timescaledb_information.hypertables c ON h.hypertable_name = c.hypertable_name
ORDER BY h.total_bytes DESC;
```

### Vérifier Chunks (Partitions)

```sql
-- Voir les chunks d'une hypertable
SELECT
    chunk_name,
    range_start,
    range_end,
    pg_size_pretty(total_bytes) as size
FROM timescaledb_information.chunks
WHERE hypertable_name = 'gavage_data_lots'
ORDER BY range_start DESC
LIMIT 10;
```

### Forcer Compression Manuelle

```sql
-- Compresser chunks spécifiques
SELECT compress_chunk(i.show_chunks)
FROM show_chunks('gavage_data_lots', older_than => INTERVAL '7 days') i;
```

---

## ⚠️ Bonnes Pratiques

### ✅ À FAIRE:

1. **Toujours filtrer par temps** dans les requêtes
2. **Utiliser time_bucket()** pour agrégations
3. **Créer continuous aggregates** pour requêtes fréquentes
4. **Activer compression** pour économiser espace
5. **Définir retention policies** pour nettoyer anciennes données

### ❌ À ÉVITER:

1. ❌ Requêtes sans filtre temps (scan complet)
2. ❌ UPDATE massifs (hypertables optimisées pour INSERT)
3. ❌ DELETE fréquents (utiliser retention policy)
4. ❌ Index sur toutes les colonnes (surcharge)
5. ❌ Oublier de partitionner par entité (segment_by)

---

## 📚 Ressources

- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Best Practices](https://docs.timescale.com/timescaledb/latest/how-to-guides/hypertables/)
- [Compression Guide](https://docs.timescale.com/timescaledb/latest/how-to-guides/compression/)
- [Continuous Aggregates](https://docs.timescale.com/timescaledb/latest/how-to-guides/continuous-aggregates/)

---

**Date**: 08 Janvier 2026
**Version**: 1.0
**Auteur**: Claude Code
