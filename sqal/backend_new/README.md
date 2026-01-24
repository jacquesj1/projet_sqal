# SQAL Backend - FastAPI

Backend FastAPI pour le système de contrôle qualité du foie gras SQAL.

## 🚀 Démarrage Rapide

### Option 1 : Développement Local (Recommandé pour le développement)

**Prérequis :**
- Python 3.11+
- Docker Desktop (pour TimescaleDB et Redis)

**Étapes :**

1. **Démarrer les services Docker (DB + Redis uniquement) :**
   ```bash
   cd ..
   docker-compose up -d timescaledb redis
   ```

2. **Créer l'environnement virtuel Python :**
   ```bash
   cd backend_new
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # Linux/Mac
   source venv/bin/activate
   ```

3. **Installer les dépendances :**
   ```bash
   pip install -r requirements.txt
   ```

4. **Vérifier le fichier `.env` :**
   Le fichier `.env` doit contenir :
   ```env
   DATABASE_URL=postgresql+asyncpg://foiegras_user:foiegras_pass_2025@localhost:5434/foiegras_db
   REDIS_URL=redis://localhost:6380/0
   ```

5. **Démarrer le backend :**
   ```bash
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

6. **Accéder à l'API :**
   - API : http://localhost:8000
   - Documentation interactive : http://localhost:8000/docs
   - Health check : http://localhost:8000/health

---

### Option 2 : Tout dans Docker (Production-like)

**Étapes :**

1. **Démarrer tous les services avec Docker Compose :**
   ```bash
   cd ..
   docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
   ```

2. **Vérifier les conteneurs :**
   ```bash
   docker ps
   ```
   Vous devriez voir :
   - `sqal_timescaledb` (port 5434)
   - `sqal_redis` (port 6380)
   - `sqal_backend_new` (port 8001)

3. **Accéder à l'API :**
   - API : http://localhost:8001
   - Documentation : http://localhost:8001/docs
   - Health check : http://localhost:8001/health

4. **Voir les logs :**
   ```bash
   docker logs -f sqal_backend_new
   ```

---

## 📁 Structure du Projet

```
backend_new/
├── app/
│   ├── core/           # Configuration (DB, cache, blockchain, etc.)
│   ├── models/         # Modèles SQLAlchemy
│   ├── schemas/        # Schémas Pydantic
│   ├── routers/        # Routes API
│   └── main.py         # Point d'entrée FastAPI
├── .env                # Config pour développement LOCAL
├── .env.docker         # Config pour exécution DANS Docker
├── Dockerfile          # Image Docker du backend
├── requirements.txt    # Dépendances Python
└── README.md           # Ce fichier
```

---

## 🔧 Configuration

### Variables d'environnement

| Variable | Description | Local | Docker |
|----------|-------------|-------|--------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `localhost:5434` | `timescaledb:5432` |
| `REDIS_URL` | URL de connexion Redis | `localhost:6380` | `redis:6379` |
| `DEBUG` | Mode debug | `True` | `True` |
| `CORS_ORIGINS` | Origins autorisées CORS | `http://localhost:5173` | `http://localhost:5173` |

### Ports

| Service | Port Local | Port Docker (interne) | Port Docker (externe) |
|---------|------------|----------------------|----------------------|
| Backend FastAPI | 8000 | 8000 | 8001 |
| TimescaleDB | 5434 | 5432 | 5434 |
| Redis | 6380 | 6379 | 6380 |

---

## 🧪 Tests

```bash
# Installer les dépendances de test
pip install -r requirements-test.txt

# Lancer les tests
pytest

# Avec couverture
pytest --cov=app --cov-report=html
```

---

## 📊 Monitoring

### Health Checks

- **Liveness** : `GET /health/liveness` - L'application est-elle vivante ?
- **Readiness** : `GET /health/readiness` - Peut-elle servir du trafic ?
- **Startup** : `GET /health/startup` - A-t-elle fini de démarrer ?
- **Detailed** : `GET /health/detailed` - Informations détaillées

### Métriques Prometheus

- **Endpoint** : `GET /metrics`
- Métriques disponibles :
  - `http_requests_total` - Total des requêtes HTTP
  - `samples_analyzed_total` - Total des échantillons analysés
  - `db_connections_active` - Connexions DB actives
  - `cache_hits_total` / `cache_misses_total` - Performance du cache

---

## 🐛 Dépannage

### Le backend ne se connecte pas à la DB

1. Vérifiez que TimescaleDB tourne :
   ```bash
   docker ps | grep timescaledb
   ```

2. Vérifiez le port dans `.env` :
   - Local : `localhost:5434`
   - Docker : `timescaledb:5432`

3. Testez la connexion :
   ```bash
   docker exec -it sqal_timescaledb psql -U foiegras_user -d foiegras_db
   ```

### Le backend ne se connecte pas à Redis

1. Vérifiez que Redis tourne :
   ```bash
   docker ps | grep redis
   ```

2. Testez la connexion :
   ```bash
   docker exec -it sqal_redis redis-cli ping
   ```

### Erreur "Address already in use"

Un autre processus utilise le port 8000. Changez le port :
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 📚 Documentation API

La documentation interactive Swagger est disponible à :
- http://localhost:8000/docs (développement local)
- http://localhost:8001/docs (Docker)

Documentation ReDoc :
- http://localhost:8000/redoc (développement local)
- http://localhost:8001/redoc (Docker)

---

## 🔐 Sécurité

⚠️ **Important pour la production :**

1. Changez `SECRET_KEY` dans `.env`
2. Utilisez des mots de passe forts pour la DB
3. Activez HTTPS
4. Configurez correctement CORS
5. Activez l'authentification JWT

---

## 📝 Licence

Propriétaire - SQAL Project 2025
