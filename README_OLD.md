# 🏢 Application Euralis - Pilotage Multi-Sites

Application de pilotage stratégique pour la coopérative Euralis gérant 3 sites de gavage (Bretagne LL, Pays de Loire LS, Maubourguet MT) avec 65 gaveurs.

---

## 📊 Vue d'ensemble

- **3 sites de production** : LL (Bretagne), LS (Pays de Loire), MT (Maubourguet)
- **65 gaveurs** actifs
- **2 applications frontend** :
  - **Gaveurs** : Saisie individuelle par gaveur
  - **Euralis** : Supervision multi-sites (vue globale)
- **1 backend partagé** : FastAPI avec base de données commune
- **5 modules IA/ML** pour prévisions et optimisation

---

## 🏗️ Architecture (Backend Partagé)

```
projet-euralis-gaveurs/
│
├── gaveurs-v3/
│   └── gaveurs-ai-blockchain/              # ⚡ BACKEND PARTAGÉ (UNIQUE)
│       ├── backend/
│       │   ├── app/
│       │   │   ├── main.py                 # FastAPI avec 2 routers
│       │   │   ├── routers/
│       │   │   │   ├── gavage.py           # Routes gaveurs
│       │   │   │   └── euralis.py          # Routes Euralis ✅
│       │   │   ├── ml/
│       │   │   │   ├── symbolic_regression.py  # ML gaveurs
│       │   │   │   └── euralis/            # ML Euralis (5 modules) ✅
│       │   │   ├── models/
│       │   │   ├── services/
│       │   │   └── blockchain/
│       │   └── scripts/
│       │       ├── create_euralis_tables.sql    # Tables Euralis ✅
│       │       └── import_euralis_data.py       # Import CSV ✅
│       │
│       ├── database/
│       │   └── init.sql                    # Tables gaveurs existantes
│       │
│       └── frontend/                       # Frontend Gaveurs
│
├── euralis-frontend/                       # Frontend Euralis ✅
│   ├── app/euralis/dashboard/
│   ├── components/euralis/
│   └── lib/euralis/
│
└── Euralis-v3/                             # Documentation uniquement
    └── EURALIS-APPLICATION-COMPLETE/
```

### 🔑 Architecture Fonctionnelle

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│  Frontend Euralis        Frontend Gaveurs            │
│  (superviseur)           (individuel)                │
│  Port 3000               Port 3001                   │
│        │                       │                      │
│        └──────────┬────────────┘                      │
│                   │                                   │
│                   ▼                                   │
│         Backend PARTAGÉ (FastAPI)                    │
│         Port 8000                                    │
│         - /api/gaveurs/*  (routes gaveurs)           │
│         - /api/euralis/*  (routes supervision) ✅    │
│                   │                                   │
│                   ▼                                   │
│         Base de Données COMMUNE                      │
│         gaveurs_db (PostgreSQL + TimescaleDB)        │
│         - Tables gaveurs (existantes)                │
│         - Tables Euralis (7 nouvelles) ✅            │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### ✨ Avantages Backend Partagé

✅ **Un seul serveur** : FastAPI (port 8000)
✅ **Une seule DB** : gaveurs_db (données communes)
✅ **Routes préfixées** : `/api/gaveurs/*` et `/api/euralis/*`
✅ **Euralis = Superviseur** : Accès COMPLET à toutes données
✅ **Gaveurs = Individuel** : Vue personnalisée par gaveur

---

## 🚀 Démarrage Rapide

### 1️⃣ Base de Données Commune

```bash
# Connexion PostgreSQL
psql -U postgres

# Créer DB commune
CREATE DATABASE gaveurs_db;
CREATE USER gaveurs_user WITH PASSWORD 'gaveurs_pass';
GRANT ALL PRIVILEGES ON DATABASE gaveurs_db TO gaveurs_user;

# Activer TimescaleDB
\c gaveurs_db
CREATE EXTENSION IF NOT EXISTS timescaledb;

# Tables gaveurs (si pas déjà fait)
\i gaveurs-v3/gaveurs-ai-blockchain/database/init.sql

# Tables Euralis (7 nouvelles)
\i gaveurs-v3/gaveurs-ai-blockchain/backend/scripts/create_euralis_tables.sql
```

### 2️⃣ Import Données CSV Euralis

```bash
cd gaveurs-v3/gaveurs-ai-blockchain/backend

pip install -r requirements.txt

python scripts/import_euralis_data.py /chemin/vers/Pretraite_End_2024_claude.csv
```

### 3️⃣ Backend Partagé (UN SEUL SERVEUR)

```bash
cd gaveurs-v3/gaveurs-ai-blockchain/backend

export DATABASE_URL="postgresql://gaveurs_user:gaveurs_pass@localhost:5432/gaveurs_db"

uvicorn app.main:app --reload --port 8000
```

**Backend accessible** : http://localhost:8000
**Documentation** : http://localhost:8000/docs

### 4️⃣ Frontend Euralis

```bash
cd euralis-frontend

npm install
npm run dev
```

**Euralis accessible** : http://localhost:3000/euralis/dashboard

### 5️⃣ Frontend Gaveurs (optionnel)

```bash
cd gaveurs-v3/gaveurs-ai-blockchain/frontend

npm install
npm run dev -- --port 3001
```

**Gaveurs accessible** : http://localhost:3001

---

## 📡 Routes API Backend Partagé

### Routes Gaveurs (existantes)
- `POST /api/gaveurs/` - Créer gaveur
- `GET /api/gaveurs/{id}` - Détail gaveur
- `POST /api/gavage/` - Enregistrer gavage
- etc.

### Routes Euralis (nouvelles) ✅

**Sites (5)**
- `GET /api/euralis/sites`
- `GET /api/euralis/sites/{code}`
- `GET /api/euralis/sites/{code}/stats`
- `GET /api/euralis/sites/{code}/lots`
- `GET /api/euralis/sites/compare`

**Dashboard (3)**
- `GET /api/euralis/dashboard/kpis`
- `GET /api/euralis/dashboard/charts/production`
- `GET /api/euralis/dashboard/charts/itm`

**Lots (3)**
- `GET /api/euralis/lots`
- `GET /api/euralis/lots/{id}`
- `GET /api/euralis/lots/{id}/doses`

**Alertes (2)**
- `GET /api/euralis/alertes`
- `POST /api/euralis/alertes/{id}/acquitter`

**Santé (1)**
- `GET /api/euralis/health`

---

## 🤖 Modules IA/ML Euralis

**Emplacement** : `gaveurs-v3/gaveurs-ai-blockchain/backend/app/ml/euralis/`

1. **multi_site_regression.py** - PySR (formules optimales)
2. **production_forecasting.py** - Prophet (prévisions)
3. **gaveur_clustering.py** - K-Means (segmentation)
4. **anomaly_detection.py** - Isolation Forest (anomalies)
5. **abattage_optimization.py** - Hongrois (planning)

---

## 📊 Base de Données Commune

### Tables Gaveurs (existantes)
- gaveurs, canards, gavage_data, alertes, blockchain...

### Tables Euralis (7 nouvelles) ✅
1. sites_euralis
2. lots_gavage
3. doses_journalieres (hypertable)
4. performances_sites (vue matérialisée)
5. previsions_production
6. alertes_euralis (hypertable)
7. planning_abattages

---

## 🔍 Tests

```bash
# API backend
curl http://localhost:8000/api/euralis/health
curl http://localhost:8000/api/euralis/sites
curl http://localhost:8000/api/euralis/dashboard/kpis

# Refresh vue
psql -U postgres -d gaveurs_db -c "REFRESH MATERIALIZED VIEW performances_sites;"
```

---

## ✅ Développement COMPLET - Phase 1

### Backend ✅
- [x] **Schéma TimescaleDB complet** (12 tables, 900 lignes SQL)
  - `complete_timescaledb_schema.sql` - Toutes les 174 colonnes CSV
  - 2 Hypertables (doses_journalieres, alertes_euralis)
  - Vue matérialisée (performances_sites)
  - Triggers auto-calcul + Compression/Rétention
- [x] **Router Euralis** intégré dans main.py
- [x] **15 routes API** opérationnelles
- [x] **5 modules IA/ML** complets (~1500 lignes)
  - PySR, Prophet, K-Means, Isolation Forest, Hongrois
- [x] **Script import CSV** (174 colonnes)

### Frontend ✅
- [x] **7 Pages complètes** (Next.js 14 + TypeScript)
  - ✅ Dashboard principal (KPIs + Charts)
  - ✅ Sites (vue détaillée par site)
  - ✅ Gaveurs (analytics + clustering K-Means)
  - ✅ Prévisions (Prophet 7/30/90j)
  - ✅ Qualité (ITM/Sigma + anomalies)
  - ✅ Abattages (planning optimisé)
  - ✅ Finance (revenus/coûts/marge)
- [x] **Composants** KPICard + ProductionChart
- [x] **Client API TypeScript** (20+ méthodes)
- [x] **Navigation complète** (7 liens)

### Simulateur ✅
- [x] **Générateur données réaliste** (`Simulator/gavage_data_simulator.py`)
  - 440 lignes Python
  - 174 colonnes CSV compatibles
  - 5 niveaux performance gaveurs
  - 27 jours doses par lot
  - Calibrage sur données réelles
- [x] **Documentation complète** (`Simulator/README.md` - 250 lignes)

### Documentation ✅
- [x] **README.md** - Architecture générale
- [x] **DEMARRAGE_RAPIDE.md** - Guide 5 minutes
- [x] **QUICKSTART_VERIFICATION.md** - Vérification détaillée
- [x] **MIGRATION_BACKEND_PARTAGE.md** - Migration architecture
- [x] **DEVELOPMENT_COMPLETE_REPORT.md** - Rapport complet (~400 lignes)

### Architecture ✅
- [x] **Backend PARTAGÉ** (gaveurs-v3/) - 1 seul serveur FastAPI
- [x] **DB COMMUNE** (gaveurs_db) - TimescaleDB optimisée
- [x] **2 Frontends** séparés (ports 3000/3001)

---

## 📊 Statistiques du Projet

- **~8600 lignes** de code + documentation
- **24 fichiers** créés/modifiés
- **12 tables** TimescaleDB (2 hypertables)
- **15 routes API** Euralis
- **7 pages** frontend complètes
- **5 modules IA/ML** production-ready
- **174 colonnes CSV** supportées

---

## 🚀 Guides de Démarrage

### 🏃 Ultra-Rapide (5 minutes)
👉 **[DEMARRAGE_RAPIDE.md](DEMARRAGE_RAPIDE.md)** - Installation express

### 🔍 Détaillé (Vérifications)
👉 **[QUICKSTART_VERIFICATION.md](QUICKSTART_VERIFICATION.md)** - Guide étape par étape

### 📖 Complet (Développement)
👉 **[DEVELOPMENT_COMPLETE_REPORT.md](DEVELOPMENT_COMPLETE_REPORT.md)** - Rapport détaillé

---

## 📁 Fichiers Importants

| Fichier | Description |
|---------|-------------|
| `gaveurs-v3/.../complete_timescaledb_schema.sql` | **Schéma complet** (12 tables, 900 lignes) |
| `gaveurs-v3/.../app/routers/euralis.py` | **Router API** (15 routes) |
| `gaveurs-v3/.../app/ml/euralis/` | **5 modules IA/ML** (~1500 lignes) |
| `euralis-frontend/app/euralis/` | **7 pages frontend** (~2800 lignes) |
| `Simulator/gavage_data_simulator.py` | **Simulateur** (440 lignes) |
| `DEMARRAGE_RAPIDE.md` | **Guide 5 min** |
| `DEVELOPMENT_COMPLETE_REPORT.md` | **Rapport complet** |

---

**🏢 Euralis + Gaveurs v2.1.0 - Backend Partagé**
*L'excellence en gavage intelligent multi-sites* 🦆🤖⛓️

**Statut** : ✅ **PRODUCTION READY** - Phase 1 Complète
