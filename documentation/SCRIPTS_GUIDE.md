# Guide Complet des Scripts - Système Gaveurs V3.0

Ce guide documente tous les scripts disponibles pour construire, démarrer, tester et déployer le système complet.

## Table des Matières

1. [Scripts de Build](#scripts-de-build)
2. [Scripts de Démarrage/Arrêt](#scripts-de-démarrageArrêt)
3. [Scripts de Test](#scripts-de-test)
4. [Scripts de Base de Données](#scripts-de-base-de-données)
5. [Scripts de Monitoring](#scripts-de-monitoring)
6. [Docker & Déploiement](#docker--déploiement)
7. [CI/CD](#cicd)

---

## Scripts de Build

### `scripts/build.sh` (Linux/macOS) et `scripts/build.bat` (Windows)

Construit tous les composants du système ou des composants individuels.

#### Usage

```bash
# Linux/macOS
./scripts/build.sh [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]

# Windows
scripts\build.bat [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]
```

#### Exemples

```bash
# Construire tous les composants
./scripts/build.sh all

# Construire uniquement le backend
./scripts/build.sh backend

# Construire uniquement les frontends
./scripts/build.sh frontend-euralis
./scripts/build.sh frontend-gaveurs
./scripts/build.sh frontend-sqal
```

#### Ce que fait le script

1. **Backend** :
   - Crée un environnement virtuel Python si nécessaire
   - Installe/met à jour les dépendances (`requirements.txt`)
   - Compile les fichiers Python
   - Exécute les vérifications de type (mypy) si disponible

2. **Frontends** (Next.js pour Euralis/Gaveurs, Vite pour SQAL) :
   - Installe les dépendances npm
   - Construit l'application en mode production
   - Optimise les assets

3. **Simulator** :
   - Crée un environnement virtuel Python
   - Installe les dépendances
   - Compile les fichiers Python

---

## Scripts de Démarrage/Arrêt

### `scripts/start.sh` / `scripts/start.bat`

Démarre les services du système.

#### Usage

```bash
# Linux/macOS
./scripts/start.sh [all|db|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator|status]

# Windows
scripts\start.bat [all|db|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator|status]
```

#### Exemples

```bash
# Démarrer tous les services
./scripts/start.sh all

# Démarrer uniquement la base de données
./scripts/start.sh db

# Démarrer uniquement le backend
./scripts/start.sh backend

# Vérifier le statut des services
./scripts/start.sh status
```

#### Services et Ports

| Service | Port | URL |
|---------|------|-----|
| TimescaleDB | 5432 | postgresql://localhost:5432 |
| Backend API | 8000 | http://localhost:8000 |
| API Docs | 8000 | http://localhost:8000/docs |
| Frontend Euralis | 3000 | http://localhost:3000 |
| Frontend Gaveurs | 3001 | http://localhost:3001 |
| Frontend SQAL | 5173 | http://localhost:5173 |
| Simulator | - | (Background process) |

#### Ordre de Démarrage (all)

1. TimescaleDB (via Docker)
2. Backend (FastAPI + Uvicorn)
3. Frontend Euralis (Next.js)
4. Frontend Gaveurs (Next.js)
5. Frontend SQAL (Vite)
6. Simulator (Python WebSocket client)

#### Fichiers de PID

Les PIDs des processus sont stockés dans `.pids/` :
- `.pids/backend.pid`
- `.pids/frontend-euralis.pid`
- `.pids/frontend-gaveurs.pid`
- `.pids/frontend-sqal.pid`
- `.pids/simulator.pid`

#### Logs

Les logs sont stockés dans `logs/` :
- `logs/backend.log`
- `logs/frontend-euralis.log`
- `logs/frontend-gaveurs.log`
- `logs/frontend-sqal.log`
- `logs/simulator.log`

### `scripts/stop.sh` / `scripts/stop.bat`

Arrête les services du système.

#### Usage

```bash
# Linux/macOS
./scripts/stop.sh [all|db|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]

# Windows
scripts\stop.bat [all|db|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]
```

#### Exemples

```bash
# Arrêter tous les services
./scripts/stop.sh all

# Arrêter uniquement le backend
./scripts/stop.sh backend
```

#### Fonctionnement

- Envoie un signal SIGTERM aux processus (graceful shutdown)
- Si le processus ne s'arrête pas après 10 secondes, force l'arrêt (SIGKILL)
- Nettoie les fichiers PID
- Pour TimescaleDB : arrête le conteneur Docker (sans le supprimer)

---

## Scripts de Test

### `scripts/run_tests.sh` / `scripts/run_tests.bat`

Exécute les tests du système.

#### Usage

```bash
# Linux/macOS
./scripts/run_tests.sh [all|unit|integration|e2e|websocket|coverage|install]

# Windows
scripts\run_tests.bat [all|unit|integration|e2e|websocket|coverage|install]
```

#### Exemples

```bash
# Installer les dépendances de test
./scripts/run_tests.sh install

# Exécuter tous les tests
./scripts/run_tests.sh all

# Tests unitaires uniquement
./scripts/run_tests.sh unit

# Tests E2E (nécessite backend en cours d'exécution)
./scripts/run_tests.sh e2e

# Tests WebSocket
./scripts/run_tests.sh websocket

# Générer un rapport de couverture
./scripts/run_tests.sh coverage
```

### Tests Disponibles

#### 1. Tests Unitaires (`tests/unit/`)
- Tests des fonctions individuelles
- Pas de dépendances externes
- Exécution rapide

#### 2. Tests d'Intégration (`tests/integration/`)
- Tests des interactions entre composants
- Nécessite la base de données
- Exécution modérée

#### 3. Tests E2E (`tests/e2e/test_complete_flow.py`)
- **Nécessite backend en cours d'exécution**
- Teste le flux complet :
  1. Création de site
  2. Création de gaveur
  3. Création de lot
  4. Génération de courbe d'alimentation
  5. Enregistrement de sessions de gavage
  6. Scan SQAL (qualité)
  7. Génération de QR code
  8. Scan consommateur
  9. Soumission de feedback
  10. Vérification ML data
  11. Optimisation courbe

#### 4. Tests WebSocket (`tests/websocket/test_websocket_flow.py`)
- **Nécessite backend en cours d'exécution**
- Teste les WebSockets :
  - Connexion sensor (/ws/sensors/)
  - Connexion realtime (/ws/realtime/)
  - Envoi de données sensor
  - Réception de broadcasts
  - Tests de stress (rapid streaming)
  - Tests de reconnexion

### Configuration des Tests

Fichier `pytest.ini` à la racine :

```ini
[pytest]
testpaths = tests
addopts = -v --strict-markers --cov=backend/app
markers =
    unit: Unit tests
    integration: Integration tests
    e2e: End-to-end tests
    websocket: WebSocket tests
```

### Couverture de Code

Le rapport de couverture est généré dans :
- `htmlcov/index.html` (format HTML interactif)
- `coverage.xml` (format XML pour CI/CD)
- Terminal (résumé)

---

## Scripts de Base de Données

### `scripts/db_migrate.py`

Applique les migrations de schéma SQL à TimescaleDB.

#### Usage

```bash
python scripts/db_migrate.py [--host HOST] [--port PORT] [--database DB] [--user USER] [--password PASS]
```

#### Exemples

```bash
# Utiliser les valeurs par défaut
python scripts/db_migrate.py

# Spécifier les paramètres de connexion
python scripts/db_migrate.py --host localhost --port 5432 --database gaveurs_db --user gaveurs_admin --password gaveurs_secure_2024
```

#### Ce que fait le script

1. Se connecte à TimescaleDB
2. Vérifie/installe l'extension TimescaleDB
3. Exécute les fichiers SQL dans l'ordre :
   - `backend/scripts/timescaledb_schema.sql` (schéma principal)
   - `backend/scripts/sqal_timescaledb_schema.sql` (schéma SQAL)
   - `backend/scripts/consumer_feedback_schema.sql` (schéma feedback)
4. Vérifie le schéma final (tables, hypertables, continuous aggregates)

#### Dépendances

```bash
pip install asyncpg
```

### `scripts/generate_test_data.py`

Génère des données de test réalistes.

#### Usage

```bash
python scripts/generate_test_data.py [--gaveurs N] [--lots N] [--samples N] [--feedbacks N]
```

#### Exemples

```bash
# Générer des données par défaut
python scripts/generate_test_data.py

# Générer des données personnalisées
python scripts/generate_test_data.py --gaveurs 20 --lots 50 --samples 200 --feedbacks 100
```

#### Données Générées

1. **Sites** (3) : LL, LS, MT
2. **Gaveurs** : Noms/prénoms aléatoires, expérience 1-20 ans
3. **Lots** : Numéros de lot, génétiques variées, ITM 25-30
4. **Sessions de gavage** : 10 sessions par lot (12 jours)
5. **Devices SQAL** : 1 device par site
6. **Samples SQAL** : Données sensor réalistes (VL53L8CH + AS7341)
7. **Produits consommateur** : QR codes avec signatures
8. **Feedbacks consommateur** : Notes 1-5, commentaires

#### Paramètres par Défaut

```bash
--gaveurs 10
--lots 20
--sessions-per-lot 10
--samples 50
--products 30
--feedbacks 20
```

---

## Scripts de Monitoring

### `scripts/health_check.py`

Vérifie l'état de santé de tous les services.

#### Usage

```bash
python scripts/health_check.py
```

#### Vérifications Effectuées

1. **TimescaleDB** :
   - Conteneur Docker en cours d'exécution
   - PostgreSQL accepte les connexions
   - Base de données disponible

2. **Backend API** :
   - Service accessible (http://localhost:8000)
   - Endpoint /health répond OK
   - Base de données connectée

3. **Endpoints API** :
   - `/api/euralis/sites/`
   - `/api/gaveurs/gaveurs/`
   - `/api/sqal/devices/`
   - `/api/consumer/health`

4. **WebSocket Endpoints** :
   - `/ws/sensors/` (ping-pong test)
   - `/ws/realtime/` (connexion test)

5. **Frontends** :
   - Frontend Euralis (http://localhost:3000)
   - Frontend Gaveurs (http://localhost:3001)
   - Frontend SQAL (http://localhost:5173)

#### Codes de Retour

- `0` : Tous les services OK
- `1` : Services OK avec avertissements
- `2` : Échecs détectés

#### Exemple de Sortie

```
===================================================================
Système Gaveurs V3.0 - Health Check
===================================================================
Timestamp: 2024-12-20 10:30:45

[1/7] Checking TimescaleDB...
✓ TimescaleDB........................ OK
  └─ Database is ready
     Container: gaveurs_timescaledb
     Port: 5432

[2/7] Checking Backend API...
✓ Backend API........................ OK
  └─ API is responsive
     URL: http://localhost:8000
     Status: healthy
     Database: connected

...

===================================================================
Health Check Summary
===================================================================
Total checks: 15
✓ Passed:  15
⚠ Warning: 0
✗ Failed:  0

✅ ALL SYSTEMS OPERATIONAL
```

#### Dépendances

```bash
pip install httpx websockets
```

---

## Docker & Déploiement

### `docker-compose.yml`

Orchestre tous les services avec Docker Compose.

#### Services Définis

1. **timescaledb** : Base de données TimescaleDB
2. **backend** : API FastAPI
3. **frontend-euralis** : Next.js (Euralis)
4. **frontend-gaveurs** : Next.js (Gaveurs)
5. **frontend-sqal** : React + Vite (SQAL)
6. **simulator-sqal** : Simulateur Python
7. **nginx** : Reverse proxy (profile: production)
8. **prometheus** : Monitoring (profile: monitoring)
9. **grafana** : Dashboards (profile: monitoring)

#### Usage

```bash
# Démarrer tous les services
docker-compose up -d

# Démarrer avec monitoring
docker-compose --profile monitoring up -d

# Voir les logs
docker-compose logs -f

# Voir les logs d'un service
docker-compose logs -f backend

# Arrêter tous les services
docker-compose down

# Arrêter et supprimer les volumes
docker-compose down -v

# Reconstruire les images
docker-compose build

# Reconstruire et démarrer
docker-compose up -d --build
```

#### Volumes Persistants

- `gaveurs_timescaledb_data` : Données PostgreSQL
- `gaveurs_backend_logs` : Logs backend
- `gaveurs_prometheus_data` : Données Prometheus
- `gaveurs_grafana_data` : Données Grafana

#### Réseau

Tous les services sont sur le réseau `gaveurs_network`.

#### Variables d'Environnement

Définies dans le fichier `docker-compose.yml` :

**Backend** :
- `DATABASE_HOST=timescaledb`
- `DATABASE_PORT=5432`
- `DATABASE_NAME=gaveurs_db`
- `DATABASE_USER=gaveurs_admin`
- `DATABASE_PASSWORD=gaveurs_secure_2024`
- `APP_ENV=production`
- `LOG_LEVEL=info`

**Frontends** :
- `NEXT_PUBLIC_API_URL=http://localhost:8000`
- `VITE_API_URL=http://localhost:8000`
- `VITE_WS_URL=ws://localhost:8000`

### Dockerfiles

Chaque composant a son propre Dockerfile :

#### `backend/Dockerfile`
- Base : `python:3.11-slim`
- Installe les dépendances scientifiques (numpy, scipy, etc.)
- Copie l'application
- Expose le port 8000
- Health check sur `/health`

#### `frontend/Dockerfile` et `gaveurs/Dockerfile`
- Multi-stage build :
  1. **deps** : Installe les dépendances npm
  2. **builder** : Construit l'application Next.js
  3. **runner** : Image de production légère
- Base : `node:18-alpine`
- Utilisateur non-root (nextjs:nodejs)
- Expose le port 3000

#### `sqal/Dockerfile`
- Multi-stage build :
  1. **builder** : Construit l'application Vite
  2. **runner** : Nginx pour servir les fichiers statiques
- Base : `nginx:alpine`
- Expose le port 80
- Configuration nginx personnalisée

#### `simulator-sqal/Dockerfile`
- Base : `python:3.11-slim`
- Installe websockets, numpy, etc.
- Exécute `main.py`

### Build Manuel des Images Docker

```bash
# Backend
cd backend
docker build -t gaveurs-backend:latest .

# Frontend Euralis
cd frontend
docker build -t gaveurs-frontend-euralis:latest .

# Frontend Gaveurs
cd gaveurs
docker build -t gaveurs-frontend-gaveurs:latest .

# Frontend SQAL
cd sqal
docker build -t gaveurs-frontend-sqal:latest .

# Simulator
cd simulator-sqal
docker build -t gaveurs-simulator:latest .
```

---

## CI/CD

### `.github/workflows/ci.yml`

Pipeline CI/CD complet avec GitHub Actions.

#### Jobs

1. **backend-tests** :
   - Python 3.11
   - Service TimescaleDB
   - Migrations de base de données
   - Tests unitaires + couverture
   - Type checking (mypy)
   - Linting (flake8)

2. **frontend-euralis-tests** :
   - Node.js 18
   - Linting
   - Type checking (TypeScript)
   - Build de production
   - Tests Jest

3. **frontend-gaveurs-tests** :
   - Node.js 18
   - Linting
   - Type checking
   - Build de production
   - Tests Jest

4. **frontend-sqal-tests** :
   - Node.js 18
   - Linting
   - Type checking
   - Build Vite
   - Tests Vitest

5. **e2e-tests** :
   - Dépend de tous les tests précédents
   - Service TimescaleDB
   - Démarre le backend
   - Génère des données de test
   - Health check
   - Tests E2E
   - Tests WebSocket

6. **security-scan** :
   - Trivy vulnerability scanner
   - Upload vers GitHub Security

7. **docker-build** :
   - Build de toutes les images Docker
   - Cache avec GitHub Actions

#### Déclencheurs

- Push sur `main` ou `develop`
- Pull requests vers `main` ou `develop`

#### Badges de Status

Ajoutez dans votre README.md :

```markdown
![CI/CD](https://github.com/votre-org/projet-euralis-gaveurs/actions/workflows/ci.yml/badge.svg)
```

---

## Résumé des Scripts

### Build & Déploiement

| Script | Linux/macOS | Windows | Description |
|--------|-------------|---------|-------------|
| Build | `./scripts/build.sh` | `scripts\build.bat` | Construit les composants |
| Start | `./scripts/start.sh` | `scripts\start.bat` | Démarre les services |
| Stop | `./scripts/stop.sh` | `scripts\stop.bat` | Arrête les services |

### Tests

| Script | Plateforme | Description |
|--------|-----------|-------------|
| `./scripts/run_tests.sh` | Linux/macOS | Runner de tests |
| `scripts\run_tests.bat` | Windows | Runner de tests |
| `python -m pytest` | Tous | Pytest direct |

### Base de Données

| Script | Description |
|--------|-------------|
| `python scripts/db_migrate.py` | Migrations SQL |
| `python scripts/generate_test_data.py` | Données de test |

### Monitoring

| Script | Description |
|--------|-------------|
| `python scripts/health_check.py` | Health check complet |

### Docker

| Commande | Description |
|----------|-------------|
| `docker-compose up -d` | Démarre tout |
| `docker-compose down` | Arrête tout |
| `docker-compose logs -f` | Voir les logs |
| `docker-compose ps` | Status des conteneurs |

---

## Workflow de Développement Recommandé

### 1. Première Installation

```bash
# Clone le repository
git clone <repo-url>
cd projet-euralis-gaveurs

# Build tous les composants
./scripts/build.sh all

# Démarrer TimescaleDB
./scripts/start.sh db

# Appliquer les migrations
python scripts/db_migrate.py

# Générer des données de test
python scripts/generate_test_data.py

# Démarrer tous les services
./scripts/start.sh all

# Vérifier la santé
python scripts/health_check.py
```

### 2. Développement Quotidien

```bash
# Démarrer les services nécessaires
./scripts/start.sh backend
./scripts/start.sh frontend-euralis

# Arrêter quand terminé
./scripts/stop.sh all
```

### 3. Tests Avant Commit

```bash
# Installer les dépendances de test
./scripts/run_tests.sh install

# Exécuter tous les tests
./scripts/run_tests.sh all

# Générer un rapport de couverture
./scripts/run_tests.sh coverage
```

### 4. Déploiement avec Docker

```bash
# Build et démarrer
docker-compose up -d --build

# Vérifier les logs
docker-compose logs -f

# Health check
docker-compose exec backend python /app/scripts/health_check.py
```

---

## Dépannage

### Le backend ne démarre pas

```bash
# Vérifier les logs
cat logs/backend.log

# Vérifier la base de données
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db

# Tester la connexion
python scripts/health_check.py
```

### Les tests E2E échouent

```bash
# Vérifier que le backend est démarré
./scripts/start.sh backend

# Attendre que le backend soit prêt
curl http://localhost:8000/health

# Relancer les tests
./scripts/run_tests.sh e2e
```

### Docker Compose ne démarre pas

```bash
# Vérifier les logs d'un service
docker-compose logs backend

# Reconstruire les images
docker-compose build --no-cache

# Supprimer les volumes et redémarrer
docker-compose down -v
docker-compose up -d
```

### Erreur de migration SQL

```bash
# Se connecter à la base de données
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db

# Lister les tables
\dt

# Vérifier les hypertables
SELECT * FROM timescaledb_information.hypertables;

# Supprimer et recréer
DROP DATABASE gaveurs_db;
CREATE DATABASE gaveurs_db;
python scripts/db_migrate.py
```

---

## Améliorations Futures

### Scripts à Ajouter

- ✅ Backup/restore de base de données
- ✅ Script de monitoring continu
- ✅ Script de génération de rapports
- ✅ Script de nettoyage (logs, caches)
- ✅ Script de rollback de migration
- ✅ Script de performance testing (Locust)

### Optimisations

- Cache Docker layers plus efficace
- Parallel builds dans CI/CD
- Tests parallèles avec pytest-xdist
- Pre-commit hooks pour linting

---

## Support

Pour toute question ou problème :

1. Vérifier les logs : `logs/*.log`
2. Exécuter le health check : `python scripts/health_check.py`
3. Consulter la documentation complète dans `documentation/`
4. Ouvrir une issue sur GitHub

---

**Auteur**: Système Gaveurs V3.0 Team
**Version**: 3.0.0
**Dernière mise à jour**: 2024-12-20
