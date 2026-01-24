# Backend Django - FoieGras Quality Analysis System

Backend Django avec WebSocket temps réel pour analyse qualité foie gras (capteurs VL53L8CH + AS7341).

## Architecture

```
Simulateurs Python  →  WebSocket  →  Django Backend  →  TimescaleDB
                                   ↓
                                WebSocket
                                   ↓
                             Frontend Next.js
```

## Installation

### Option 1 : Docker (Recommandé)

```bash
# 1. Copier .env.example vers .env
cp .env.example .env

# 2. Lancer tous les services (TimescaleDB, Redis, Django, Celery)
docker-compose up -d

# 3. Vérifier les logs
docker-compose logs -f django

# 4. Créer superuser Django (optionnel)
docker-compose exec django python manage.py createsuperuser
```

Accès :
- **Backend Django** : http://localhost:8000
- **WebSocket Sensors** : ws://localhost:8000/ws/sensors/
- **WebSocket Dashboard** : ws://localhost:8000/ws/dashboard/
- **Admin Django** : http://localhost:8000/admin
- **TimescaleDB** : localhost:5432 (user: foiegras_user, password: foiegras_pass_2025)

### Option 2 : Installation Manuelle

#### Prérequis
- Python 3.11+
- PostgreSQL 16 + extension TimescaleDB
- Redis 7+

#### Étapes

```bash
# 1. Créer environnement virtuel
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# 2. Installer dépendances
pip install -r requirements.txt

# 3. Installer PostgreSQL + TimescaleDB
# Windows : https://docs.timescale.com/install/latest/self-hosted/installation-windows/
# Linux : https://docs.timescale.com/install/latest/self-hosted/installation-linux/

# 4. Créer base de données
psql -U postgres
CREATE DATABASE foiegras_db;
CREATE USER foiegras_user WITH PASSWORD 'foiegras_pass_2025';
GRANT ALL PRIVILEGES ON DATABASE foiegras_db TO foiegras_user;
\c foiegras_db
CREATE EXTENSION timescaledb;
\q

# 5. Initialiser schema TimescaleDB
psql -U foiegras_user -d foiegras_db -f init_db.sql

# 6. Configurer .env
cp .env.example .env
# Éditer .env avec vos paramètres

# 7. Lancer Redis (terminal séparé)
redis-server

# 8. Lancer Django (WebSocket)
python manage.py migrate  # Créer tables Django (MLTrainingHistory, etc.)
daphne -b 0.0.0.0 -p 8000 config.asgi:application

# 9. Lancer Celery worker (terminal séparé) - optionnel pour ML
celery -A config worker -l info
```

## Structure

```
backend_django/
├── config/                 # Configuration Django
│   ├── settings.py         # Settings (DB, Channels, Celery)
│   ├── asgi.py             # ASGI pour WebSocket
│   ├── routing.py          # WebSocket routes
│   ├── urls.py             # URL routes
│   └── celery.py           # Celery config
├── sensors/                # App gestion capteurs
│   ├── models.py           # Models TimescaleDB
│   ├── consumers.py        # WebSocket consumers ⭐
│   ├── views.py            # REST API historique
│   └── urls.py
├── analysis/               # App analyse + ML
│   ├── service.py          # Service analyse ⭐
│   ├── tasks.py            # Celery tasks ML
│   ├── views.py            # REST API ML
│   └── urls.py
├── docker-compose.yml      # Docker services
├── Dockerfile
├── init_db.sql             # Schema TimescaleDB ⭐
├── requirements.txt
└── manage.py
```

## Utilisation

### 1. Démarrer Backend

```bash
# Docker
docker-compose up -d

# Manuel
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### 2. Lancer Simulateurs (Phase B)

Voir `../backend/simulator_service.py` (à créer en Phase B)

```bash
python ../backend/simulator_service.py
```

### 3. Tester WebSocket

```python
# Test rapide avec wscat
npm install -g wscat
wscat -c ws://localhost:8000/ws/dashboard/

# Envoyer commande
{"command": "get_latest"}
```

### 4. API REST

```bash
# Dernières mesures
curl http://localhost:8000/api/sensors/latest/

# Historique 24h
curl http://localhost:8000/api/sensors/history/?hours=24

# Stats
curl http://localhost:8000/api/sensors/stats/?hours=24
```

## Endpoints

### WebSocket

| Endpoint | Description | Client |
|----------|-------------|--------|
| `ws://localhost:8000/ws/sensors/` | Réception données simulateurs | Simulateur Python |
| `ws://localhost:8000/ws/dashboard/` | Diffusion vers frontend | Next.js Dashboard |

### REST API

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/sensors/latest/` | GET | Dernière mesure |
| `/api/sensors/history/?hours=24` | GET | Historique |
| `/api/sensors/stats/?hours=24` | GET | Statistiques |
| `/api/analysis/models/` | GET | Modèles ML disponibles |
| `/api/analysis/train/` | POST | Déclenchement entraînement |

## TimescaleDB

### Tables Principales

| Table | Type | Description |
|-------|------|-------------|
| `vl53l8ch_raw` | Hypertable | Mesures brutes VL53L8CH |
| `vl53l8ch_analysis` | Hypertable | Résultats analyse VL53L8CH |
| `as7341_raw` | Hypertable | Mesures brutes AS7341 |
| `as7341_analysis` | Hypertable | Résultats analyse AS7341 |
| `fusion_results` | Hypertable | Scores fusion finaux ⭐ |
| `ml_training_history` | Table | Historique entraînements ML |

### Continuous Aggregates

- `fusion_hourly_stats` : Stats par heure (auto-refresh 10min)
- `fusion_eleveur_stats` : Stats par éleveur

### Requêtes Utiles

```sql
-- Stats dernières 24h
SELECT * FROM get_recent_stats(24);

-- Meilleurs éleveurs (dernière semaine)
SELECT eleveur, COUNT(*), AVG(final_quality_score)
FROM fusion_results
WHERE time > NOW() - INTERVAL '7 days'
GROUP BY eleveur
ORDER BY AVG(final_quality_score) DESC;

-- Distribution grades
SELECT final_grade, COUNT(*), ROUND(AVG(final_quality_score), 3)
FROM fusion_results
WHERE time > NOW() - INTERVAL '1 day'
GROUP BY final_grade;
```

## Développement

### Ajouter nouveau model

```python
# sensors/models.py
class MyNewModel(models.Model):
    ...
    class Meta:
        managed = False  # Géré par TimescaleDB
```

### Ajouter endpoint WebSocket

```python
# sensors/consumers.py
async def my_new_command(self, data):
    ...
```

### Ajouter tâche Celery

```python
# analysis/tasks.py
from celery import shared_task

@shared_task
def my_ml_training_task():
    ...
```

## Tests

```bash
# Test connexion TimescaleDB
docker-compose exec timescaledb psql -U foiegras_user -d foiegras_db -c "SELECT NOW();"

# Test Redis
docker-compose exec redis redis-cli ping

# Test fastapi
docker-compose exec django python manage.py check

# Test WebSocket (avec wscat)
wscat -c ws://localhost:8000/ws/dashboard/
```

## Troubleshooting

### Erreur connexion TimescaleDB

```bash
# Vérifier que TimescaleDB est démarré
docker-compose ps timescaledb

# Vérifier logs
docker-compose logs timescaledb

# Recreate DB
docker-compose down -v
docker-compose up -d
```

### Erreur import modules analyse

Vérifier `ANALYSIS_MODULES_PATH` dans `.env` :

```bash
# .env
ANALYSIS_MODULES_PATH=D:\WORK\LABS\SQAL&TOF\Backend\ESP32_TOS_AS7341\NEW\backend
```

### WebSocket ne se connecte pas

```bash
# Vérifier CORS dans config/settings.py
CORS_ALLOWED_ORIGINS = ['http://localhost:3000']

# Vérifier routing.py
# Vérifier logs fastapi
docker-compose logs -f django
```

## Prochaines Étapes

- ✅ **Phase A** : Backend fastapi + TimescaleDB (TERMINÉ)
- ✅ **Phase B** : Service simulateur WebSocket (EN COURS)
- ✅ **Phase C** : Frontend Next.js dashboard
- ⬜ **Phase D** : ML/CNN pipeline

## Support

Pour plus d'infos :
- TimescaleDB docs : https://docs.timescale.com/
- Django Channels : https://channels.readthedocs.io/
- Celery : https://docs.celeryq.dev/
