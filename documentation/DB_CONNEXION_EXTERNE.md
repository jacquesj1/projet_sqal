# Connexion externe à la base de données

## Paramètres de connexion

| Paramètre | LAN / OpenVPN | Tailscale |
|-----------|--------------|-----------|
| **Host** | `192.168.1.103` ou `DEEP_NAS` | `100.97.217.127` |
| **Port** | `5433` | `5433` |
| **Database** | `gaveurs_db` | `gaveurs_db` |
| **User** | `gaveurs_admin` | `gaveurs_admin` |
| **Password** | `gaveurs_secure_2024` | `gaveurs_secure_2024` |

---

## psql (ligne de commande)

```bash
# Via LAN ou OpenVPN
psql -h 192.168.1.103 -p 5433 -U gaveurs_admin -d gaveurs_db

# Via Tailscale
psql -h 100.97.217.127 -p 5433 -U gaveurs_admin -d gaveurs_db
```

### Commandes psql utiles
```sql
-- Lister les tables
\dt

-- Lister les hypertables TimescaleDB
SELECT hypertable_name FROM timescaledb_information.hypertables;

-- Vérifier la connexion
SELECT version();
SELECT now();

-- Taille des tables principales
SELECT
  relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- Quitter
\q
```

---

## DBeaver / DataGrip / pgAdmin

```
Type        : PostgreSQL
Host        : 192.168.1.103  (ou 100.97.217.127 via Tailscale)
Port        : 5433
Database    : gaveurs_db
Username    : gaveurs_admin
Password    : gaveurs_secure_2024
```

> Dans DBeaver : New Connection → PostgreSQL → coller les paramètres ci-dessus

---

## Python (asyncpg / psycopg2)

```python
# asyncpg (utilisé par le backend FastAPI)
DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@192.168.1.103:5433/gaveurs_db"

# psycopg2
import psycopg2
conn = psycopg2.connect(
    host="192.168.1.103",
    port=5433,
    dbname="gaveurs_db",
    user="gaveurs_admin",
    password="gaveurs_secure_2024"
)
```

---

## Variable d'environnement (scripts locaux)

```bash
export DATABASE_URL="postgresql://gaveurs_admin:gaveurs_secure_2024@192.168.1.103:5433/gaveurs_db"

# Puis lancer les scripts de migration/test
python scripts/db_migrate.py
python scripts/generate_test_data.py
```

---

## Connexion directe via SSH (tunnel)

Si le port 5433 n'est pas ouvert sur le routeur :

```bash
# Crée un tunnel SSH : localhost:5433 → NAS:5433
ssh -L 5433:localhost:5433 admin_jj@DEEP_NAS -N

# Puis connecte-toi sur localhost
psql -h localhost -p 5433 -U gaveurs_admin -d gaveurs_db
```

---

## Rappel architecture des ports NAS

| Service | Port hôte | Container | Projet |
|---------|-----------|-----------|--------|
| **gaveurs_timescaledb** | `5433` | `5432` | Gaveurs V3 |
| `geodemo_timescaledb` | `5435` | `5432` | Géopolitique |
| `gaveurs_redis` | `6379` | `6379` | Gaveurs V3 |
| Backend API | `8000` | `8000` | Gaveurs V3 |
| Frontend Euralis | `3001` | `3000` | Gaveurs V3 |
| Frontend Gaveurs | `8088` | `3000` | Gaveurs V3 |
| Frontend SQAL | `5173` | `5173` | Gaveurs V3 |
