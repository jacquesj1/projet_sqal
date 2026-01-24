# Guide Setup Base de Données - TimescaleDB

## Vue d'ensemble

Le système utilise **TimescaleDB** (PostgreSQL + extension time-series) avec 3 schémas principaux:

1. **Schéma Gaveurs** (gaveurs-v3) - Tables de base pour gavage individuel
2. **Schéma Euralis** (backend-api) - Tables multi-sites et agrégation
3. **Schéma SQAL** (backend-api) - Capteurs IoT et qualité

## 🚀 Setup Initial

### 1. Démarrer TimescaleDB

```bash
docker-compose up -d timescaledb
```

Vérifier que le container est démarré:
```bash
docker-compose ps timescaledb
```

### 2. Appliquer les schémas dans l'ordre

**Important**: Les schémas doivent être appliqués dans cet ordre exact.

#### Schéma 1: Base Gaveurs (tables essentielles)

```bash
docker-compose exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db \
  < gaveurs-v3/gaveurs-ai-blockchain/database/init.sql
```

**Tables créées** (12):
- `gaveurs` - Gaveurs individuels
- `canards` - Canards en gavage
- `gavage_data` - Hypertable des données de gavage
- `abattoirs` - Abattoirs référencés
- `lot_mais` - Lots de maïs
- `meteo_data` - Hypertable météo
- `alertes` - Hypertable alertes ⭐
- `blockchain` - Hypertable blockchain (traçabilité)
- Et autres...

#### Schéma 2: Euralis Multi-sites

```bash
docker-compose exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db \
  < backend-api/scripts/complete_timescaledb_schema.sql
```

**Tables créées** (12):
- `sites_euralis` - 3 sites (71, 40, 32)
- `gaveurs_euralis` - Gaveurs Euralis (multi-sites)
- `lots_gavage` - Lots avec 174 colonnes (import CSV Euralis)
- `doses_journalieres` - Hypertable doses
- `alertes_euralis` - Hypertable alertes Euralis
- `previsions_production` - Prévisions Prophet
- `gaveurs_clusters` - Résultats K-Means
- `anomalies_detectees` - Résultats Isolation Forest
- `planning_abattages` - Résultats Hungarian
- `formules_pysr` - Formules PySR sauvegardées
- `performances_sites` - Vue matérialisée
- `statistiques_globales` - Stats temps réel

#### Schéma 3: SQAL (Capteurs IoT)

```bash
docker-compose exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db \
  < backend-api/scripts/sqal_timescaledb_schema.sql
```

**Tables créées** (7):
- `sqal_devices` - Dispositifs ESP32
- `sqal_sensor_samples` - Hypertable capteurs (VL53L8CH ToF + AS7341 spectral)
- `sqal_quality_grades` - Grades qualité calculés
- `sqal_ml_models` - Modèles ML sauvegardés
- `sqal_alerts` - Alertes qualité
- Et agrégats...

#### Schéma 4: Consumer Feedback

```bash
docker-compose exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db \
  < backend-api/scripts/consumer_feedback_schema.sql
```

**Tables créées** (7):
- `consumer_products` - Produits avec QR codes
- `consumer_feedbacks` - Hypertable feedbacks consommateurs
- `qr_codes` - Codes QR avec blockchain
- `feedback_aggregates` - Agrégats temps réel
- Et autres...

### 3. Vérifier les tables

```bash
docker-compose exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db -c "\dt"
```

Vous devriez voir **38+ tables**.

### 4. Vérifier les hypertables

```bash
docker-compose exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db \
  -c "SELECT hypertable_name FROM timescaledb_information.hypertables;"
```

Vous devriez voir:
- `gavage_data`
- `doses_journalieres`
- `sqal_sensor_samples`
- `consumer_feedbacks`
- `alertes`
- `alertes_euralis`
- `blockchain`
- `meteo_data`

## 🔧 Troubleshooting

### Erreur: "relation does not exist"

**Symptôme**:
```
asyncpg.exceptions.UndefinedTableError: relation "alertes" does not exist
```

**Solution**: Appliquer le schéma gaveurs (étape 2.1)

### Erreur: "password authentication failed"

**Symptôme**:
```
asyncpg.exceptions.InvalidPasswordError: password authentication failed for user "gaveurs_user"
```

**Solution**: Vérifier les credentials dans docker-compose.yml:
```yaml
timescaledb:
  environment:
    POSTGRES_USER: gaveurs_admin
    POSTGRES_PASSWORD: gaveurs_secure_2024
```

### Erreur: "already exists"

**Symptôme**:
```
ERROR:  relation "gaveurs" already exists
```

**Solution**: Normal si vous ré-appliquez un schéma. Les `CREATE TABLE IF NOT EXISTS` évitent les erreurs.

### Base de données vide après reset

**Symptôme**: Toutes les tables ont disparu après `docker-compose down -v`

**Solution**:
1. Le flag `-v` supprime les volumes (données persistantes)
2. Ré-appliquer tous les schémas dans l'ordre (étapes 2.1 à 2.4)
3. Générer des données de test:
   ```bash
   python scripts/generate_test_data.py --gaveurs 10 --lots 20
   ```

## 📊 Politique de Rétention et Compression

TimescaleDB compresse et purge automatiquement les vieilles données:

| Hypertable | Compression | Rétention |
|------------|-------------|-----------|
| `gavage_data` | 7 jours | 2 ans |
| `doses_journalieres` | 7 jours | 2 ans |
| `sqal_sensor_samples` | 7 jours | 1 an |
| `consumer_feedbacks` | 30 jours | 2 ans |
| `alertes` | 7 jours | 6 mois |
| `alertes_euralis` | 30 jours | 1 an |

## 🧪 Générer des Données de Test

```bash
python scripts/generate_test_data.py \
  --gaveurs 10 \
  --lots 20 \
  --samples 50 \
  --feedbacks 20
```

Options:
- `--gaveurs N` - Nombre de gaveurs à créer
- `--lots N` - Nombre de lots à créer
- `--samples N` - Nombre d'échantillons SQAL par lot
- `--feedbacks N` - Nombre de feedbacks consommateurs

## 🔍 Commandes Utiles

### Connexion psql

```bash
docker-compose exec timescaledb psql -U gaveurs_admin -d gaveurs_db
```

### Taille de la base

```sql
SELECT pg_size_pretty(pg_database_size('gaveurs_db')) as taille;
```

### Taille des hypertables

```sql
SELECT hypertable_name,
       pg_size_pretty(total_bytes) as taille_totale,
       pg_size_pretty(compressed_total_bytes) as taille_compressée
FROM timescaledb_information.hypertables
ORDER BY total_bytes DESC;
```

### Nombre de lignes par table

```sql
SELECT
  schemaname,
  tablename,
  n_live_tup as lignes_actives
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

### Rafraîchir les vues matérialisées

```sql
CALL refresh_continuous_aggregate('doses_journalieres_hourly', NULL, NULL);
CALL refresh_continuous_aggregate('doses_journalieres_daily', NULL, NULL);
CALL refresh_continuous_aggregate('performances_sites', NULL, NULL);
```

## 📚 Ressources

- **Documentation TimescaleDB**: https://docs.timescale.com/
- **Schémas SQL**: `backend-api/scripts/*.sql`
- **Modèles Pydantic**: `backend-api/app/models/schemas.py`
- **Migrations**: `backend-api/scripts/db_migrate.py`

---

**Dernière mise à jour**: 2025-12-26
**Version**: 3.0.0
