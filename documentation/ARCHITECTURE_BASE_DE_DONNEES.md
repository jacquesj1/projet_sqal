# Architecture de la Base de Données - Système Gaveurs V3.0

## Vue d'ensemble

**Base de données**: `gaveurs_db`
**Type**: PostgreSQL 15 + TimescaleDB (extension time-series)
**Nombre total de tables**: ~40 tables
**Organisation**: 5 groupes fonctionnels distincts

---

## 🏗️ Architecture Duale: 2 Systèmes en Parallèle

### ⚠️ IMPORTANT: Confusion Architecturale Actuelle

Le système contient **DEUX architectures parallèles qui ne sont PAS connectées**:

#### 1. **Système Gaveurs Individuels** (Ancien - Application Gaveurs)
- Table principale: `lots`
- Utilisé par: [gaveurs-frontend](../gaveurs-frontend)
- Scope: Gaveurs individuels travaillant de manière autonome
- Gaveurs référencés dans: `gaveurs` (table)

#### 2. **Système Euralis Multi-Sites** (Nouveau - Dashboard Euralis)
- Table principale: `lots_gavage`
- Utilisé par: [euralis-frontend](../euralis-frontend)
- Scope: 3 sites Euralis (Bretagne, Pays de Loire, Maubourguet)
- Gaveurs référencés dans: `gaveurs_euralis` (table)

**❌ Problème actuel**: Les simulateurs insèrent dans `lots_gavage`, mais le frontend Gaveurs lit `lots` → Jean Martin ne voit pas ses données!

---

## 📊 Groupes de Tables

### Groupe 1: SYSTÈME GAVEURS INDIVIDUELS (Application Gaveurs)

#### Tables principales:

**`gaveurs`** - Gaveurs individuels
```sql
Colonnes clés:
- id (PK)
- nom, prenom, email
- password_hash
- telephone, adresse
- actif (boolean)
- cle_publique_blockchain
```

**`lots`** - Lots de gavage individuels
```sql
Colonnes clés:
- id (PK)
- gaveur_id → gaveurs(id)
- code_lot (UNIQUE)
- nom_lot
- genetique, nb_canards_initial
- date_debut, duree_prevue
- statut: 'preparation', 'en_cours', 'termine', 'abattu'
- poids_moyen_actuel
- taux_mortalite
```

**`canards`** - Canards individuels
```sql
Colonnes clés:
- id (PK)
- lot_id → lots(id)
- gaveur_id → gaveurs(id)
- numero_bague (identifiant unique)
- genetique
- date_naissance, age_jours
- poids_initial, poids_actuel
- statut: 'vivant', 'mort', 'abattu'
```

**`gavage_data`** ⏱️ HYPERTABLE
```sql
Colonnes clés:
- time (TIMESTAMPTZ) ← Partition key
- canard_id → canards(id)
- dose_matin, dose_soir
- poids_actuel
- temperature_stabule, humidite_stabule
- jour_gavage
- pret_abattage (boolean)
```

**`gavage_data_lots`** ⏱️ HYPERTABLE (NOUVEAU - pour simulateurs)
```sql
Colonnes clés:
- time (TIMESTAMPTZ) ← Partition key
- lot_gavage_id → lots_gavage(id)  ⚠️ Pointe vers Euralis!
- jour_gavage (1-14)
- repas ('matin' ou 'soir')
- dose_moyenne, dose_theorique
- poids_moyen_lot
- nb_canards_vivants, nb_canards_morts
- taux_mortalite
- temperature_stabule, humidite_stabule
```

**`alertes`** ⏱️ HYPERTABLE
```sql
Colonnes clés:
- time (TIMESTAMPTZ)
- canard_id → canards(id)
- lot_id → lots(id)
- type_alerte: 'poids_faible', 'mortalite', 'temperature'
- criticite: 'critique', 'elevee', 'moyenne', 'faible'
- acquittee (boolean)
```

**Tables connexes**:
- `gavage_lot_quotidien` - Synthèse quotidienne par lot
- `lots_registry` - Registre centralisé des lots
- `lot_events` - Événements de cycle de vie des lots

---

### Groupe 2: SYSTÈME EURALIS MULTI-SITES (Dashboard Euralis)

#### Tables principales:

**`sites_euralis`** - 3 sites de production
```sql
Colonnes:
- id (PK)
- code (UNIQUE): 'LL' (Bretagne), 'LS' (Pays de Loire), 'MT' (Maubourguet)
- nom, region
- capacite_gavage_max
- nb_gaveurs_actifs
```

**`gaveurs_euralis`** - Gaveurs rattachés aux sites Euralis
```sql
Colonnes clés:
- id (PK)
- nom, prenom, nom_usage
- site_code → sites_euralis(code)
- raison_sociale
- adresse1, adresse2, code_postal, commune
- telephone, email
- actif (boolean)
```

**`lots_gavage`** - Lots de gavage Euralis (174 colonnes du CSV)
```sql
Colonnes clés:
- id (PK)
- code_lot (UNIQUE) ex: 'LL4801665', 'LS2601003'
- site_code → sites_euralis(code)
- gaveur_id → gaveurs_euralis(id)
- debut_lot (DATE)
- duree_gavage_reelle, duree_du_lot
- souche, genetique, geo, saison
- nb_meg (Mise En Gavage)
- nb_enleve, nb_accroches, nb_morts
- itm (Indice Technique Moyen - kg foie/canard)
- itm_cut ('A', 'B', 'C', 'D', 'E')
- sigma (écart type poids foies)
- pctg_perte_gavage (mortalité %)
- total_corn_target, total_corn_real
- code_plan_alimentation
- eleveur, prod_igp_fr
- statut: 'en_cours', 'termine', 'abattu'
- jour_actuel (1-14)
- pret_abattage (boolean)
- poids_moyen_actuel
- taux_mortalite
- genetique, nb_canards_initial
```

**`doses_journalieres`** ⏱️ HYPERTABLE
```sql
Colonnes clés:
- time (TIMESTAMPTZ) ← Partition key
- code_lot (VARCHAR) ← Code du lot Euralis
- lot_id → lots_gavage(id)
- jour (1-27)
- moment ('matin' ou 'soir')
- dose_theorique, dose_reelle
- poids_moyen
- nb_vivants, taux_mortalite
- temperature, humidite
```

**`performances_sites`** 📊 MATERIALIZED VIEW
```sql
Agrégations:
- nb_lots_total, nb_lots_actifs, nb_lots_termines
- itm_moyen, itm_stddev, itm_min, itm_max
- sigma_moyen, sigma_stddev
- mortalite_moyenne, mortalite_max
- production_totale_kg
- total_canards_meg, total_canards_accroches, total_canards_morts
- Refresh manuel: SELECT refresh_continuous_aggregate('performances_sites')
```

**`alertes_euralis`** ⏱️ HYPERTABLE
```sql
Colonnes clés:
- time (TIMESTAMPTZ)
- lot_id → lots_gavage(id)
- gaveur_id → gaveurs_euralis(id)
- site_code → sites_euralis(code)
- type_alerte, criticite
- titre, description
- valeur_observee, valeur_attendue
- acquittee (boolean)
```

**Tables ML/Analytics**:
- `previsions_production` - Prévisions Prophet (7/30/90 jours)
- `gaveurs_clusters` - Clusters K-Means des gaveurs (5 segments)
- `anomalies_detectees` - Anomalies Isolation Forest
- `planning_abattages` - Optimisation hongroise des plannings
- `formules_pysr` - Formules symboliques PySR (prédiction ITM)
- `statistiques_globales` - Stats agrégées système

---

### Groupe 3: SQAL - CONTRÔLE QUALITÉ IOT

**`sqal_devices`** - Dispositifs ESP32
```sql
Colonnes:
- id (PK)
- device_id (UNIQUE) ex: 'ESP32_DEMO_01'
- device_name, location
- ligne_controle ('LIGNE_A', 'LIGNE_B')
- tof_sensor_model ('VL53L8CH')
- spectral_sensor_model ('AS7341')
- status: 'active', 'inactive', 'maintenance'
- last_heartbeat (TIMESTAMPTZ)
```

**`sqal_sensor_samples`** ⏱️ HYPERTABLE
```sql
Colonnes clés:
- time (TIMESTAMPTZ) ← Partition key
- device_id → sqal_devices(device_id)
- lot_id → lots_gavage(id)
- sample_id (SERIAL)
- sample_type: 'foie_entier', 'foie_tranche', 'terrine', 'barquette'
- quality_grade: 'A+', 'A', 'B', 'C', 'D'

# Données ToF VL53L8CH (64 valeurs - matrice 8x8):
- tof_zone_0_0 à tof_zone_7_7 (SMALLINT) - distances en mm

# Données Spectrales AS7341 (10 canaux):
- spectral_415nm, spectral_445nm, spectral_480nm
- spectral_515nm, spectral_555nm, spectral_590nm
- spectral_630nm, spectral_680nm
- spectral_clear, spectral_nir (Near Infrared)

# Métadonnées:
- ambient_light, temperature, pressure
```

**Continuous Aggregates SQAL**:
- `sqal_hourly_stats` - Stats horaires par device
- `sqal_daily_quality_distribution` - Distribution quotidienne des grades
- `sqal_lot_quality_summary` - Synthèse qualité par lot

**Tables connexes**:
- `sqal_ml_models` - Modèles ML entraînés (Random Forest, SVM)
- `sqal_blockchain_txns` - Transactions blockchain (hashes, timestamps)
- `sqal_alerts` - Alertes qualité
- `sqal_pending_lots` - Lots en attente d'inspection

---

### Groupe 4: CONSUMER FEEDBACK - BOUCLE FERMÉE

**`consumer_products`** - Produits consommateur
```sql
Colonnes:
- id (PK)
- lot_id → lots_gavage(id)
- qr_code (UNIQUE) ex: 'QR_LL2601001_001'
- product_type: 'foie_entier', 'terrine', 'barquette', 'mi_cuit'
- quality_grade: 'A+', 'A', 'B', 'C'
- sqal_device_id → sqal_devices(device_id)
- sqal_sample_id
- weight_grams
- production_date, expiry_date
- blockchain_tx_hash
- blockchain_timestamp
- status: 'produced', 'shipped', 'sold', 'consumed'
```

**`consumer_feedbacks`** ⏱️ HYPERTABLE
```sql
Colonnes:
- time (TIMESTAMPTZ) ← Partition key
- id (SERIAL)
- product_id → consumer_products(id)
- qr_code → consumer_products(qr_code)
- lot_id → lots_gavage(id)
- rating (1-5)
- taste_rating, texture_rating, appearance_rating (1-5)
- comment (TEXT)
- consumer_name, consumer_email, consumer_age
- purchase_location
- consumption_date
- would_recommend (boolean)
```

**`qr_codes`** - Codes QR générés
```sql
Colonnes:
- id (PK)
- code (UNIQUE)
- lot_id → lots_gavage(id)
- produit_id → consumer_products(id)
- url_feedback
- blockchain_hash
- date_generation
- scans_count
- last_scan
```

**Tables ML Consumer**:
- `consumer_feedback_ml_data` - Données ML préparées
- `consumer_feedback_ml_insights` - Insights ML (corrélations paramètres → satisfaction)

**Continuous Aggregates Consumer**:
- `consumer_feedback_hourly_stats` - Stats horaires de feedbacks
- `consumer_satisfaction_by_grade` - Satisfaction moyenne par grade qualité

---

### Groupe 5: BLOCKCHAIN & TRAÇABILITÉ

**`blockchain`** - Transactions blockchain
```sql
Colonnes:
- id (PK)
- canard_id → canards(id)
- lot_id → lots(id)
- gaveur_id → gaveurs(id)
- transaction_hash (UNIQUE)
- transaction_type: 'naissance', 'gavage', 'abattage', 'certification'
- smart_contract_address
- block_number
- timestamp_blockchain
- metadata (JSONB)
```

---

## ⏱️ Hypertables TimescaleDB (9 au total)

Tables partitionnées automatiquement par `time` pour performance optimale:

1. **`gavage_data`** - Données de gavage individuelles
2. **`gavage_data_lots`** - Données de gavage au niveau LOT ✨
3. **`doses_journalieres`** - Doses journalières Euralis
4. **`sqal_sensor_samples`** - Échantillons capteurs IoT
5. **`consumer_feedbacks`** - Feedbacks consommateurs
6. **`alertes`** - Alertes système gaveurs
7. **`alertes_euralis`** - Alertes système Euralis
8. *(Autres hypertables selon schémas additionnels)*

**Avantages TimescaleDB**:
- Requêtes ultra-rapides sur données time-series
- Compression automatique des données anciennes
- Continuous Aggregates pour analytics en temps réel
- Retention policies automatiques

---

## 📊 Continuous Aggregates (8 au total)

Vues matérialisées rafraîchies automatiquement:

### Gaveurs:
- `gavage_stats_daily` - Stats quotidiennes de gavage

### Euralis:
- `doses_hourly_stats` - Stats horaires des doses
- `performances_sites` - Performances par site (MATERIALIZED VIEW)

### SQAL:
- `sqal_hourly_stats` - Stats horaires capteurs
- `sqal_daily_quality_distribution` - Distribution quotidienne grades
- `sqal_lot_quality_summary` - Synthèse qualité par lot

### Consumer:
- `consumer_feedback_hourly_stats` - Stats horaires feedbacks
- `consumer_satisfaction_by_grade` - Satisfaction par grade

**Refresh manuel**:
```sql
SELECT refresh_continuous_aggregate('nom_aggregate');
```

---

## 🔗 Relations Clés et Foreign Keys

### Système Gaveurs Individuels:
```
gaveurs (1) ──< (N) lots
lots (1) ──< (N) canards
canards (1) ──< (N) gavage_data
lots (1) ──< (N) alertes
```

### Système Euralis:
```
sites_euralis (1) ──< (N) gaveurs_euralis
gaveurs_euralis (1) ──< (N) lots_gavage
lots_gavage (1) ──< (N) doses_journalieres
lots_gavage (1) ──< (N) alertes_euralis
```

### SQAL:
```
lots_gavage (1) ──< (N) sqal_sensor_samples
sqal_devices (1) ──< (N) sqal_sensor_samples
lots_gavage (1) ──< (N) consumer_products
```

### Consumer:
```
consumer_products (1) ──< (N) consumer_feedbacks
lots_gavage (1) ──< (N) consumer_feedbacks
lots_gavage (1) ──< (N) qr_codes
```

### ⚠️ Incohérence Actuelle:
```
gavage_data_lots.lot_gavage_id → lots_gavage(id)  ← Euralis
                                   ⚠️
                         Devrait pointer vers lots(id) ← Gaveurs
```

---

## 🔧 Vues et Helpers

### Vues:
- `canards_lots` - VIEW mapping canards → lots (backward compatibility)
- `performances_sites` - MATERIALIZED VIEW agrégations Euralis

### Functions:
- `update_updated_at_column()` - Trigger auto-update des timestamps
- `extract_site_from_code_lot()` - Extraction site depuis code_lot
- `calculate_nb_morts()` - Calcul automatique nb morts depuis taux_mortalité

---

## 📈 Volumétrie Estimée

| Table | Type | Volume estimé |
|-------|------|---------------|
| `lots_gavage` | Standard | ~3500 lots/an (3 sites) |
| `doses_journalieres` | Hypertable | ~95k rows/an (3500 lots × 27 jours) |
| `gavage_data_lots` | Hypertable | ~190k rows/an (3500 × 27 × 2 repas) |
| `sqal_sensor_samples` | Hypertable | ~700k rows/an (200 samples × 3500 lots) |
| `consumer_feedbacks` | Hypertable | ~350k rows/an (100 feedbacks × 3500 lots) |
| `canards` | Standard | ~700k canards/an (200 × 3500) |
| `gavage_data` | Hypertable | ~38M rows/an (700k × 27 × 2) |

**Total estimé**: ~40M rows/an pour données time-series

---

## 🚀 Optimisations et Index

### Index principaux:
```sql
-- Lots
CREATE INDEX idx_lots_gavage_code ON lots_gavage(code_lot);
CREATE INDEX idx_lots_gavage_statut ON lots_gavage(statut);
CREATE INDEX idx_lots_gavage_pret ON lots_gavage(pret_abattage) WHERE pret_abattage = true;

-- Hypertables (TimescaleDB crée automatiquement index sur time)
CREATE INDEX idx_gavage_lots_lot_time ON gavage_data_lots(lot_gavage_id, time DESC);
CREATE INDEX idx_doses_lot_jour ON doses_journalieres(lot_id, jour);
CREATE INDEX idx_sqal_device_time ON sqal_sensor_samples(device_id, time DESC);

-- SQAL
CREATE INDEX idx_sqal_lot_grade ON sqal_sensor_samples(lot_id, quality_grade);

-- Consumer
CREATE INDEX idx_consumer_qr ON consumer_feedbacks(qr_code);
CREATE INDEX idx_consumer_rating ON consumer_feedbacks(rating);
```

### Compression TimescaleDB:
```sql
-- Compression automatique après 7 jours
ALTER TABLE gavage_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'canard_id'
);

SELECT add_compression_policy('gavage_data', INTERVAL '7 days');
```

---

## 🔄 Migration et Cohérence

### Problème actuel à résoudre:

**Option 1: Unifier sur `lots_gavage`** (Recommandé)
```sql
-- Migrer données de lots → lots_gavage
-- Modifier gaveurs-frontend pour lire lots_gavage
-- Avantage: Une seule table, architecture simplifiée
```

**Option 2: Créer pont `lots` ↔ `lots_gavage`**
```sql
-- Ajouter colonne lots_gavage_id dans lots
ALTER TABLE lots ADD COLUMN lots_gavage_id INTEGER REFERENCES lots_gavage(id);

-- Modifier gavage_data_lots pour pointer vers lots
ALTER TABLE gavage_data_lots
  ADD COLUMN lot_id INTEGER REFERENCES lots(id);
```

**Option 3: Vue unifiée**
```sql
CREATE VIEW lots_unified AS
SELECT
  id, code_lot, gaveur_id, statut, jour_actuel,
  'gaveurs' as source_system
FROM lots
UNION ALL
SELECT
  id, code_lot, gaveur_id, statut, jour_actuel,
  'euralis' as source_system
FROM lots_gavage;
```

---

## 📝 Commandes Utiles

### Lister toutes les tables:
```sql
\dt
```

### Lister hypertables:
```sql
SELECT hypertable_name FROM timescaledb_information.hypertables;
```

### Voir structure d'une table:
```sql
\d lots_gavage
```

### Voir les continuous aggregates:
```sql
SELECT view_name, materialized_only
FROM timescaledb_information.continuous_aggregates;
```

### Compter les rows par table:
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;
```

---

## 📚 Fichiers Schémas

- `complete_timescaledb_schema.sql` - Schéma Euralis complet (174 colonnes)
- `sqal_timescaledb_schema.sql` - Schéma SQAL (capteurs IoT)
- `consumer_feedback_schema.sql` - Schéma Consumer Feedback
- `lots_schema.sql` - Schéma système gaveurs individuels
- `create_alertes_table.sql` - Alertes gaveurs
- `migration_realtime_simulator.sql` - Schéma pour simulateurs temps réel

---

## 🎯 Recommandations

1. ✅ **Unifier l'architecture** - Choisir entre `lots` et `lots_gavage` comme source unique de vérité
2. ✅ **Corriger gavage_data_lots** - Faire pointer vers la bonne table de lots
3. ✅ **Documenter la séparation** - Si les deux tables coexistent, documenter clairement les use cases
4. ✅ **Ajouter contraintes de données** - Vérifier cohérence entre tables liées
5. ✅ **Monitoring des hypertables** - Alertes sur taille chunks, compression

---

**Version**: 1.0
**Date**: 08 Janvier 2026
**Auteur**: Claude Code
