# 🦆 Système Gaveurs V3.0 - Intelligence Artificielle & Blockchain

**Système complet de gestion intelligente de gavage avec boucle de feedback fermée consommateur**

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/your-repo)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-green.svg)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## 📋 Table des Matières

1. [Vue d'ensemble](#-vue-densemble)
2. [Architecture Globale](#-architecture-globale)
3. [Composants Principaux](#-composants-principaux)
4. [Flux de Données](#-flux-de-données)
5. [Installation](#-installation)
6. [Scripts Disponibles](#-scripts-disponibles)
7. [Démarrage Rapide](#-démarrage-rapide)
8. [Tests](#-tests)
9. [Documentation Détaillée](#-documentation-détaillée)
10. [Docker & Déploiement](#-docker--déploiement)
11. [Développement](#-développement)
12. [Production](#-production)
13. [Troubleshooting](#-troubleshooting)

---

## 🎯 Vue d'ensemble

Le **Système Gaveurs V3.0** est une plateforme complète qui révolutionne la production de foie gras en créant une **boucle de feedback fermée** entre producteurs et consommateurs. Le système utilise l'**Intelligence Artificielle**, la **Blockchain** et des **capteurs IoT** pour optimiser continuellement la qualité.

### Problème Résolu

Comment **améliorer continuellement** la production de foie gras en utilisant les retours **réels** des consommateurs ?

### Solution

```
GAVEUR → Production → SQAL Qualité → QR Code → CONSOMMATEUR
   ↑                                                  ↓
   └──────────── IA Optimise Courbes ←───────────────┘
                    (Feedback Loop)
```

### Caractéristiques Principales

- ✅ **Gavage Intelligent** : Courbes d'alimentation optimisées par IA (PySR)
- ✅ **Workflow 3-Courbes** : Théorique (PySR) + Réelle (Gaveur) + Correction IA (Sprint 3 - NOUVEAU)
- ✅ **Supervision Multi-Sites** : Dashboard Euralis (3 sites : LL, LS, MT)
- ✅ **Contrôle Qualité** : SQAL avec capteurs ToF + Spectral
- ✅ **Traçabilité Blockchain** : Hyperledger Fabric
- ✅ **Feedback Consommateur** : QR Code → Avis → Amélioration IA
- ✅ **Temps Réel** : WebSocket pour monitoring live
- ✅ **K-Means Clustering** : Segmentation gaveurs en 5 profils de performance (Sprint 3 - NOUVEAU)

---

## 🏗️ Architecture Globale

### Vue Système Complet

```
┌──────────────────────────────────────────────────────────────────┐
│                       FRONTENDS (3 Applications)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐       │
│  │ Euralis       │  │ Gaveurs       │  │ SQAL Quality   │       │
│  │ Next.js:3000  │  │ Next.js:3001  │  │ React:5173     │       │
│  │               │  │               │  │                │       │
│  │ • Dashboard   │  │ • Saisie      │  │ • Dashboard    │       │
│  │ • Multi-sites │  │ • Blockchain  │  │ • Temps réel   │       │
│  │ • Analytics   │  │ • Alertes     │  │ • Capteurs IoT │       │
│  └───────┬───────┘  └───────┬───────┘  └────────┬───────┘       │
│          │                  │                    │               │
│          └──────────────────┼────────────────────┘               │
│                             ▼                                    │
│         ┌───────────────────────────────────────┐                │
│         │  BACKEND UNIFIÉ (FastAPI) - Port 8000 │                │
│         ├───────────────────────────────────────┤                │
│         │  • /api/euralis/*   (supervision)     │                │
│         │  • /api/gaveurs/*   (gavage)          │                │
│         │  • /api/sqal/*      (qualité)         │                │
│         │  • /api/consumer/*  (feedback + QR)   │                │
│         │  • /ws/sensors/     (WebSocket In)    │                │
│         │  • /ws/realtime/    (WebSocket Out)   │                │
│         └────────────────┬──────────────────────┘                │
│                          │                                       │
│                          ▼                                       │
│         ┌───────────────────────────────────────┐                │
│         │  TimescaleDB (gaveurs_db)             │                │
│         ├───────────────────────────────────────┤                │
│         │  • 38 Tables (Hypertables + Views)    │                │
│         │  • 4 Hypertables (time-series)        │                │
│         │  • 8 Continuous Aggregates            │                │
│         └───────────────────────────────────────┘                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Structure Projet

```
projet-euralis-gaveurs/
├── documentation/                         # ⭐ Documentation complète
│   ├── SYSTEME_COMPLET_BOUCLE_FERMEE.md  # Vue d'ensemble
│   ├── ARCHITECTURE_UNIFIEE.md           # Architecture backend
│   ├── INTEGRATION_SQAL_COMPLETE.md      # Intégration SQAL
│   ├── CONTROL_PANEL_USAGE.md            # 🎛️ Guide panneau de contrôle
│   ├── FONCTIONNEMENT_SIMULATEURS.md     # Fonctionnement simulateurs
│   ├── BLOCKCHAIN_QR_IMPLEMENTATION_REELLE.md  # QR + blockchain
│   └── SQAL_*.md                         # Docs SQAL détaillées
│
├── backend-api/                           # ⭐ Backend Unifié FastAPI
│   ├── app/
│   │   ├── main.py                        # Point d'entrée
│   │   ├── routers/                       # 5 routers API
│   │   │   ├── euralis.py
│   │   │   ├── sqal.py
│   │   │   ├── consumer_feedback.py
│   │   │   └── simulator_control.py       # 🎛️ Contrôle simulateurs
│   │   ├── models/                        # Modèles Pydantic
│   │   ├── services/                      # Services métier
│   │   ├── websocket/                     # WebSocket handlers
│   │   ├── ml/                            # 6 Modules IA
│   │   └── blockchain/                    # Blockchain custom
│   └── scripts/                           # Scripts SQL
│
├── euralis-frontend/                      # ⭐ Frontend Euralis (Next.js)
├── gaveurs-v3/gaveurs-ai-blockchain/frontend/  # Frontend Gaveurs (Next.js)
├── sqal/                                  # ⭐ Frontend SQAL (React + Vite)
├── control-panel/                         # 🎛️ Panneau de contrôle démos
│   └── index.html                         # Interface web unique (HTML/CSS/JS)
├── simulators/                            # ⭐ Simulateurs
│   ├── gavage_realtime/                   # Simulateur gavage
│   └── sqal/                              # Lot Monitor
├── simulator-sqal/                        # ⭐ Simulateur SQAL ESP32
└── consumer-app/                          # App Mobile (futur)
```

---

## 🧩 Composants Principaux

### 1. Backend Unifié (FastAPI)

**Port** : 8000 | **Langage** : Python 3.11+ | **Framework** : FastAPI

**85+ Endpoints REST** (5 routers) :

```python
# Gavage
POST   /api/gavage/                    # Enregistrer gavage
GET    /api/gavage/canard/{id}         # Historique canard
GET    /api/ml/predict-doses/{id}      # Prédiction IA

# Euralis Multi-Sites
GET    /api/euralis/dashboard          # Dashboard global
GET    /api/euralis/lots/actifs        # Lots en cours
GET    /api/euralis/gaveurs/performance # Performance

# SQAL Qualité
GET    /api/sqal/health                # Health check
GET    /api/sqal/samples/latest        # Dernier échantillon
GET    /api/sqal/stats/hourly          # Stats horaires

# Consumer Feedback
GET    /api/consumer/scan/{qr}         # Scan QR (PUBLIC)
POST   /api/consumer/feedback          # Soumettre avis (PUBLIC)
GET    /api/consumer/ml/training-data  # Données ML

# 🎛️ Simulator Control (NOUVEAU)
POST   /api/control/gavage/start       # Démarrer gavage
POST   /api/control/monitor/start      # Démarrer monitor
POST   /api/control/sqal/start         # Démarrer SQAL
POST   /api/control/stop-all           # Arrêter tous
GET    /api/control/status             # Status simulateurs
WS     /api/control/ws                 # Updates temps réel

# WebSocket
WS     /ws/sensors/                    # Simulateur → Backend
WS     /ws/realtime/                   # Backend → Dashboards
```

### 2. Base de Données TimescaleDB

**38 Tables** organisées en 4 groupes :

```sql
-- 12 tables Gavage
gaveurs, canards, gavage_data (hypertable), alertes...

-- 12 tables Euralis
sites_euralis, lots_gavage, performances_sites...

-- 7 tables SQAL
sqal_devices, sqal_sensor_samples (hypertable)...

-- 7 tables Feedback Consommateur
consumer_products, consumer_feedbacks (hypertable)...
```

### 3. Modules IA (6 Algorithmes)

| Module | Algorithme | Usage |
|--------|-----------|-------|
| **symbolic_regression** | PySR | Découverte formules gavage |
| **prophet_forecaster** | Prophet | Prévisions poids, ITM |
| **clustering_gaveurs** | K-Means | Profils performance |
| **anomaly_detector** | Isolation Forest | Détection anomalies |
| **hungarian_optimizer** | Algorithme hongrois | Planning abattages |
| **feedback_optimizer** | Random Forest | **⭐ Optimisation courbes** |

### 4-6. Frontends (3 Applications)

- **Euralis** (Next.js:3000) : Supervision multi-sites, 7 pages
- **Gaveurs** (Next.js:3001) : Gavage individuel, blockchain, 12 pages
- **SQAL** (React:5173) : Contrôle qualité temps réel, 5 pages

### 7. Panneau de Contrôle Simulateurs 🎛️

**Interface web unique** pour démonstrations et tests :
- **Fichier** : `control-panel/index.html` (HTML/CSS/JS embarqué, aucune dépendance)
- **Accès** : Double-clic sur le fichier ou serveur HTTP local
- **Fonctionnalités** :
  - ▶️ Démarrer/Arrêter les 3 simulateurs (Gavage, Monitor, SQAL)
  - 🚀 3 scénarios pré-configurés (Démo 2min, Test 15min, Production 24h)
  - 🔌 WebSocket temps réel (status, stats, logs)
  - 📊 Monitoring en direct de chaque simulateur

**Endpoints Backend** :
```python
POST /api/control/gavage/start       # Démarrer gavage
POST /api/control/monitor/start      # Démarrer monitor
POST /api/control/sqal/start         # Démarrer SQAL
POST /api/control/stop-all           # Arrêter tous
WS   /api/control/ws                 # Mises à jour temps réel
```

**Voir** : [documentation/CONTROL_PANEL_USAGE.md](documentation/CONTROL_PANEL_USAGE.md)

### 8. Simulateurs (3 Types)

**Gavage Temps Réel** (`simulators/gavage_realtime/main.py`) :
- Simule gavage 2×/jour sur 11-14 jours
- Accélération configurable (×1 à ×86400)
- WebSocket → Backend → Frontends

**Lot Monitor** (`simulators/sqal/lot_monitor.py`) :
- Orchestrateur (polling DB toutes les Xs secondes)
- Détecte lots terminés → Lance SQAL
- **N'envoie pas de données** - Lance ESP32 simulator

**SQAL ESP32** (`simulator-sqal/src/main.py`) :
- Jumeau numérique ESP32 complet
- Capteurs simulés : VL53L8CH (ToF 8×8) + AS7341 (Spectral 10ch)
- Génère données qualité réalistes
- WebSocket → Backend temps réel

---

## 🔄 Flux de Données

### Boucle Fermée Complète

```
1. GAVEUR → Saisie gavage
   ↓
2. EURALIS → Agrégation multi-sites
   ↓
3. SQAL → Contrôle qualité (ToF + Spectral)
   ↓
4. QR CODE → Génération (traçabilité blockchain)
   ↓
5. CONSOMMATEUR → Scan QR + Feedback (note 1-5)
   ↓
6. IA → Analyse corrélations (production ↔ satisfaction)
   ↓
7. OPTIMISATION → Nouvelles courbes alimentation
   ↓
8. RETOUR GAVEUR → Amélioration production
   ↓
   └─── 🔄 CYCLE RECOMMENCE
```

**Détails** : Voir [documentation/SYSTEME_COMPLET_BOUCLE_FERMEE.md](documentation/SYSTEME_COMPLET_BOUCLE_FERMEE.md#-flux-de-données-complet)

---

## 🚀 Installation

### Prérequis

- **Python 3.11+**
- **Node.js 18+**
- **Docker** & **Docker Compose** (recommandé)
- **Git**

Ou pour installation manuelle :
- PostgreSQL 14+ avec TimescaleDB 2.11+

---

## 📜 Scripts Disponibles

Le projet inclut des **scripts modulaires** pour faciliter le développement et le déploiement.

### Scripts Build

```bash
# Linux/macOS
./scripts/build.sh [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]

# Windows
scripts\build.bat [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]
```

**Exemples** :
```bash
./scripts/build.sh all        # Construit tout
./scripts/build.sh backend    # Construit uniquement le backend
```

### Scripts Start/Stop

```bash
# Linux/macOS
./scripts/start.sh [all|db|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator|status]
./scripts/stop.sh [all|db|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]

# Windows
scripts\start.bat [all|db|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator|status]
scripts\stop.bat [all|db|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]
```

**Exemples** :
```bash
./scripts/start.sh all      # Démarre tous les services
./scripts/start.sh status   # Affiche le statut
./scripts/stop.sh all       # Arrête tous les services
```

### Scripts de Base de Données

```bash
# Migrations SQL
python scripts/db_migrate.py

# Générer des données de test
python scripts/generate_test_data.py --gaveurs 10 --lots 20 --samples 50 --feedbacks 20
```

### Scripts de Tests

```bash
# Linux/macOS
./scripts/run_tests.sh [all|unit|integration|e2e|websocket|coverage|install]

# Windows
scripts\run_tests.bat [all|unit|integration|e2e|websocket|coverage|install]
```

**Exemples** :
```bash
./scripts/run_tests.sh install    # Installe les dépendances de test
./scripts/run_tests.sh all        # Lance tous les tests
./scripts/run_tests.sh coverage   # Génère un rapport de couverture
```

### Scripts de Monitoring

```bash
# Health check complet
python scripts/health_check.py
```

**Voir le guide complet** : [documentation/SCRIPTS_GUIDE.md](documentation/SCRIPTS_GUIDE.md)

---

## 🚀 Installation Rapide (Docker - Recommandé)

### Méthode 1 : Docker Compose (Plus Simple)

```bash
# 1. Cloner le repository
git clone <repo-url>
cd projet-euralis-gaveurs

# 2. Démarrer tous les services
docker-compose up -d

# 3. Attendre que les services démarrent (30-60 secondes)
docker-compose logs -f

# 4. Vérifier la santé
docker-compose exec backend python /app/scripts/health_check.py

# 5. Services disponibles :
# - Backend API:       http://localhost:8000
# - API Docs:          http://localhost:8000/docs
# - Frontend Euralis:  http://localhost:3000
# - Frontend Gaveurs:  http://localhost:3001
# - Frontend SQAL:     http://localhost:5173
```

**Arrêter les services** :
```bash
docker-compose down
```

### Méthode 2 : Installation Manuelle avec Scripts

```bash
# 1. Cloner le repository
git clone <repo-url>
cd projet-euralis-gaveurs

# 2. Construire tous les composants
./scripts/build.sh all

# 3. Démarrer TimescaleDB (Docker)
./scripts/start.sh db

# 4. Appliquer les migrations
python scripts/db_migrate.py

# 5. Générer des données de test
python scripts/generate_test_data.py

# 6. Démarrer tous les services
./scripts/start.sh all

# 7. Vérifier la santé
python scripts/health_check.py
```

**Services et Ports** :
| Service | Port | URL |
|---------|------|-----|
| TimescaleDB | 5432 | postgresql://localhost:5432 |
| Backend API | 8000 | http://localhost:8000 |
| API Docs | 8000 | http://localhost:8000/docs |
| Frontend Euralis | 3000 | http://localhost:3000 |
| Frontend Gaveurs | 3001 | http://localhost:3001 |
| Frontend SQAL | 5173 | http://localhost:5173 |
| **Control Panel** | - | `control-panel/index.html` |

### Méthode 3 : Installation Manuelle Complète

#### 1. Base de Données (TimescaleDB)

**Option A : Docker (Recommandé)**
```bash
docker run -d \
  --name gaveurs_timescaledb \
  -p 5432:5432 \
  -e POSTGRES_DB=gaveurs_db \
  -e POSTGRES_USER=gaveurs_admin \
  -e POSTGRES_PASSWORD=gaveurs_secure_2024 \
  -v gaveurs_timescaledb_data:/var/lib/postgresql/data \
  timescale/timescaledb:latest-pg15
```

**Option B : Installation Locale**
```bash
# Créer DB
psql -U postgres
```

```sql
CREATE DATABASE gaveurs_db;
CREATE USER gaveurs_admin WITH PASSWORD 'gaveurs_secure_2024';
GRANT ALL PRIVILEGES ON DATABASE gaveurs_db TO gaveurs_admin;
\c gaveurs_db
CREATE EXTENSION IF NOT EXISTS timescaledb;
\q
```

**Appliquer les migrations** :
```bash
python scripts/db_migrate.py
```

#### 2. Backend (FastAPI)

```bash
cd backend

python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt

# Définir les variables d'environnement
export DATABASE_URL="postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db"

# Démarrer le serveur
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Vérification** : `curl http://localhost:8000/health`

#### 3-5. Frontends

**Frontend Euralis (Next.js)**
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev -- -p 3000

# Gaveurs
cd gaveurs-v3/gaveurs-ai-blockchain/frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev -- --port 3001

# SQAL
cd sqal
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
echo "VITE_WS_URL=ws://localhost:8000" >> .env.local
npm run dev
```

### 6. Simulateur SQAL (Optionnel)

```bash
cd simulator-sqal
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python src/main.py --device ESP32_LL_01 --interval 1
```

---

## ⚡ Démarrage Rapide

### Démo Complète (5 Terminaux)

```bash
# Terminal 1: Backend
cd gaveurs-v3/gaveurs-ai-blockchain/backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend Euralis
cd euralis-frontend && npm run dev

# Terminal 3: Frontend Gaveurs
cd gaveurs-v3/gaveurs-ai-blockchain/frontend && npm run dev -- --port 3001

# Terminal 4: Frontend SQAL
cd sqal && npm run dev

# Terminal 5: Simulateur SQAL
cd simulator-sqal && python src/main.py
```

**Accès** :
- Backend API : http://localhost:8000/docs
- Euralis : http://localhost:3000/euralis/dashboard
- Gaveurs : http://localhost:3001
- SQAL : http://localhost:5173

### 🎛️ Démo avec Panneau de Contrôle (Recommandé)

**Le moyen le plus simple pour faire des démonstrations !**

```bash
# 1. Démarrer uniquement le backend
cd backend-api
uvicorn app.main:app --reload --port 8000

# 2. Ouvrir le panneau de contrôle
# Double-clic sur control-panel/index.html
# OU
cd control-panel
python -m http.server 8080
# Puis ouvrir http://localhost:8080

# 3. Dans le panneau de contrôle, cliquer sur :
# 🚀 "Démo Rapide (2 min)"
#
# Cela lance automatiquement :
# - Simulateur Gavage (1 lot, ×86400 accélération)
# - Lot Monitor (polling 5s)
# - Génère des données qualité SQAL
#
# Durée totale : ~2 minutes
# Résultat : 1 lot complet avec QR codes et traçabilité
```

**Endpoints Control Panel** :
```
POST /api/control/gavage/start       # Démarrer gavage
POST /api/control/monitor/start      # Démarrer monitor
POST /api/control/sqal/start         # Démarrer SQAL
POST /api/control/stop-all           # Arrêter tous
WS   /api/control/ws                 # Mises à jour temps réel
```

**Documentation complète** : [documentation/CONTROL_PANEL_USAGE.md](documentation/CONTROL_PANEL_USAGE.md)

### Test Boucle Feedback

```bash
# 1. Attendre échantillon SQAL (grade ≥ B)
curl http://localhost:8000/api/sqal/samples/latest

# 2. Enregistrer produit (génère QR)
curl -X POST http://localhost:8000/api/consumer/internal/register-product \
  -H "Content-Type: application/json" \
  -d '{"lot_id":1,"sample_id":"ESP32_LL_01_sample_001","site_code":"LL"}'

# 3. Scanner QR (consommateur)
curl http://localhost:8000/api/consumer/scan/SQAL_...

# 4. Soumettre feedback
curl -X POST http://localhost:8000/api/consumer/feedback \
  -d '{"qr_code":"SQAL_...","overall_rating":5,"comment":"Excellent!"}'

# 5. Vérifier ML data
curl http://localhost:8000/api/consumer/ml/training-data?min_feedbacks=1
```

---

## 📚 Documentation Détaillée

### Documents Principaux

| Fichier | Description |
|---------|-------------|
| **[SYSTEME_COMPLET_BOUCLE_FERMEE.md](documentation/SYSTEME_COMPLET_BOUCLE_FERMEE.md)** | ⭐ Vue complète, flux bout-en-bout |
| **[ARCHITECTURE_UNIFIEE.md](documentation/ARCHITECTURE_UNIFIEE.md)** | Architecture backend unifié |
| **[INTEGRATION_SQAL_COMPLETE.md](documentation/INTEGRATION_SQAL_COMPLETE.md)** | Intégration SQAL Phase 2 |
| **[SQAL_ARCHITECTURE.md](documentation/SQAL_ARCHITECTURE.md)** | Architecture frontend SQAL |
| **[SQAL_HOW_IT_WORKS.md](documentation/SQAL_HOW_IT_WORKS.md)** | Fonctionnement SQAL (6 étapes) |
| **[SQAL_WEBSOCKET_DATA_FLOW.md](documentation/SQAL_WEBSOCKET_DATA_FLOW.md)** | WebSocket temps réel |
| **[CONTROL_PANEL_USAGE.md](documentation/CONTROL_PANEL_USAGE.md)** | 🎛️ **Guide panneau de contrôle simulateurs** |
| **[FONCTIONNEMENT_SIMULATEURS.md](documentation/FONCTIONNEMENT_SIMULATEURS.md)** | Fonctionnement des 3 simulateurs |
| **[BLOCKCHAIN_QR_IMPLEMENTATION_REELLE.md](documentation/BLOCKCHAIN_QR_IMPLEMENTATION_REELLE.md)** | Implémentation QR codes + blockchain |
| **[ANALYTICS_INTELLIGENTS_EURALIS.md](documentation/ANALYTICS_INTELLIGENTS_EURALIS.md)** | 🧠 **Analytics IA/ML - 5 modules intelligents** |

### Sprint 3 & 4 - Workflow 3-Courbes PySR

| Fichier | Description |
|---------|-------------|
| **[SPRINT3_COMPLETE.md](SPRINT3_COMPLETE.md)** | 🎯 Backend complet workflow 3-courbes (9 endpoints API) |
| **[SPRINT4_COMPLETE.md](SPRINT4_COMPLETE.md)** | 🎨 Frontend complet Euralis + Gaveurs (7 pages) |
| **[documentation/SPRINT3_PYSR_3COURBES_COMPLET.md](documentation/SPRINT3_PYSR_3COURBES_COMPLET.md)** | Documentation technique détaillée Sprint 3 |

**Features Sprint 3/4**:
- ✅ **Courbe Théorique PySR**: Génération équation symbolique optimale
- ✅ **Validation Superviseur**: Workflow Euralis (valider/modifier/rejeter)
- ✅ **Courbe Réelle**: Saisie doses quotidiennes gaveur
- ✅ **Auto-calcul Écarts**: Trigger automatique + alertes >10%
- ✅ **Corrections IA**: Suggestions automatiques lors d'écarts
- ✅ **Dashboard 3-Courbes**: Visualisation Chart.js (théorique + réelle + corrections)
- ✅ **K-Means Clustering**: Segmentation gaveurs (sklearn)

---

## 🛠️ Développement

### Structure Code Backend

```python
app/
├── main.py                    # Point d'entrée FastAPI
├── routers/                   # 5 routers (85+ endpoints)
│   ├── euralis.py             # Supervision multi-sites
│   ├── sqal.py                # Contrôle qualité
│   ├── consumer_feedback.py   # Feedback consommateur + QR
│   └── simulator_control.py   # 🎛️ Contrôle simulateurs (NOUVEAU)
├── models/                    # Modèles Pydantic
├── services/                  # Logique métier
├── websocket/                 # WebSocket handlers
├── ml/                        # 6 Modules IA
│   └── feedback_optimizer.py  # ⭐ Optimisation courbes
└── blockchain/                # Blockchain custom Python
```

### Tests

```bash
# Backend
cd gaveurs-v3/gaveurs-ai-blockchain/backend
pytest tests/

# Frontend
cd euralis-frontend
npm test
```

---

## 🚀 Production

### Docker Compose (Recommandé)

```yaml
version: '3.8'

services:
  timescaledb:
    image: timescale/timescaledb:latest-pg14
    environment:
      POSTGRES_DB: gaveurs_db
      POSTGRES_USER: gaveurs_user
      POSTGRES_PASSWORD: gaveurs_pass
    ports:
      - "5432:5432"

  backend:
    build: ./gaveurs-v3/gaveurs-ai-blockchain/backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://gaveurs_user:gaveurs_pass@timescaledb:5432/gaveurs_db

  frontend-euralis:
    build: ./euralis-frontend
    ports:
      - "3000:3000"

  frontend-gaveurs:
    build: ./gaveurs-v3/gaveurs-ai-blockchain/frontend
    ports:
      - "3001:3001"

  frontend-sqal:
    build: ./sqal
    ports:
      - "5173:80"
```

**Démarrage** : `docker-compose up -d`

---

## 🔧 Troubleshooting

### Backend ne démarre pas

```bash
# Vérifier logs
tail -f backend.log

# Tester connexion DB
psql -U gaveurs_user -d gaveurs_db -c "SELECT 1"

# Vérifier port
lsof -i :8000
```

### Frontend ne se connecte pas

```bash
# Vérifier .env.local
cat euralis-frontend/.env.local

# Test manuel backend
curl http://localhost:8000/health
```

### Simulateur SQAL ne se connecte pas

```bash
# Test WebSocket
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8000/ws/sensors/

# Doit retourner: 101 Switching Protocols
```

---

## 📈 KPIs

### Production
- ITM moyen : 28-32 g/j
- Taux mortalité : <2%
- Poids final : 5500-6500g

### Qualité SQAL
- Score moyen : >0.85
- Taux conformité : >95%
- Distribution grades : A+ (15%), A (40%), B (30%)

### Satisfaction Consommateur
- Note moyenne : >4.3/5
- Taux recommandation : >85%
- NPS : >50

---

## 📄 License

Proprietary - © 2025 A Deep Adventure - JJ

---

## 🎯 Roadmap

### Q1 2025
- ✅ Backend unifié
- ✅ SQAL intégration
- ✅ Système feedback consommateur
- ⏳ App mobile consommateur

### Q2-Q3 2025
- 📋 Collecte 5000+ feedbacks
- 📋 IA prédictive (R² > 0.85)
- 📋 Courbes optimisées 5 génétiques

### Q4 2025
- 📋 Expansion multi-pays
- 📋 IoT capteurs réels (ESP32)
- 📋 Marketplace B2C

---

**🦆 Système Gaveurs V3.0 - L'Excellence en Gavage Intelligent**

*De la ferme à la fourchette, et retour - Boucle de Feedback Fermée*
