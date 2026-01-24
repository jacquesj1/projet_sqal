# 🏗️ Architecture Unifiée - Projet Euralis Gavage Intelligent

**Intégration complète : Euralis Multi-Sites + SQAL Qualité + Backend Partagé**

---

## 📋 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Globale](#architecture-globale)
3. [Backend Commun (FastAPI)](#backend-commun-fastapi)
4. [Base de Données Commune (TimescaleDB)](#base-de-données-commune-timescaledb)
5. [3 Frontends Séparés](#3-frontends-séparés)
6. [Flux de Données](#flux-de-données)
7. [Intégration WebSocket](#intégration-websocket)
8. [Plan d'Intégration](#plan-dintégration)

---

## 🎯 Vue d'Ensemble

### Les 3 Systèmes

**1. Euralis Multi-Sites** (Supervision gavage)
- 3 sites (LL-Bretagne, LS-Pays de Loire, MT-Maubourguet)
- 65 gaveurs
- Suivi production, ITM, mortalité
- 5 modules IA/ML (PySR, Prophet, K-Means, Isolation Forest, Hongrois)

**2. SQAL** (Contrôle qualité capteurs)
- Analyse foie gras en temps réel
- 2 capteurs IoT (VL53L8CH ToF + AS7341 Spectral)
- Fusion multi-capteurs
- WebSocket temps réel

**3. Simulator-SQAL** (Jumeau numérique)
- Génération données réalistes
- Simulation capteurs I2C
- Envoi WebSocket vers backend

### Principe d'Unification

✅ **1 Backend FastAPI unique** : Port 8000
✅ **1 Base de Données TimescaleDB commune** : gaveurs_db
✅ **3 Frontends séparés** : Euralis (3000), Gaveurs (3001), SQAL (5173)
✅ **WebSocket centralisé** : Communication temps réel

---

## 🏛️ Architecture Globale

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTENDS (3 Applications)                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  📊 Euralis Superviseur     👨‍🌾 Gaveurs Individuel    🔬 SQAL Qualité │
│  Next.js (port 3000)        Next.js (port 3001)       React (5173)   │
│  ├─ Dashboard multi-sites   ├─ Saisie gavage         ├─ Dashboard    │
│  ├─ Sites détaillés         ├─ Historique            ├─ Capteurs     │
│  ├─ Gaveurs analytics       ├─ Blockchain            ├─ Analyses     │
│  ├─ Prévisions (Prophet)    └─ Performance           ├─ IA/ML        │
│  ├─ Qualité (ITM/Sigma)                              ├─ Blockchain   │
│  ├─ Planning abattages                               └─ Alertes      │
│  └─ Finance                                                           │
│                                                                        │
└────────────┬─────────────────────┬─────────────────────┬─────────────┘
             │                     │                     │
             │ HTTP REST           │ HTTP REST           │ WebSocket
             │ /api/euralis/*      │ /api/gaveurs/*      │ /ws/
             │                     │                     │
             ▼                     ▼                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND UNIQUE (FastAPI)                           │
│                        Port 8000                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  🔌 Routers FastAPI                                                   │
│  ├─ /api/euralis/*       [EXISTANT] 15 routes multi-sites            │
│  ├─ /api/gaveurs/*       [EXISTANT] Routes gavage individuel         │
│  └─ /api/sqal/*          [NOUVEAU]  Routes qualité capteurs          │
│                                                                        │
│  📡 WebSocket Endpoints                                               │
│  ├─ /ws/sensors/         [SQAL]    Réception capteurs                │
│  ├─ /ws/realtime/        [SQAL]    Diffusion dashboards              │
│  └─ /ws/gavage/          [EURALIS] Temps réel gavage (futur)         │
│                                                                        │
│  🤖 Modules IA/ML                                                     │
│  ├─ app/ml/euralis/      [EXISTANT] PySR, Prophet, K-Means, etc.     │
│  └─ app/ml/sqal/         [NOUVEAU]  Analyses qualité capteurs        │
│                                                                        │
│  🔐 Services Communs                                                  │
│  ├─ Authentification     Keycloak SSO (SQAL) + JWT (Euralis)         │
│  ├─ Validation           Pydantic                                     │
│  ├─ Rate Limiting        Protection WebSocket                        │
│  └─ Blockchain           Traçabilité (SQAL + Gaveurs)                │
│                                                                        │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             │ PostgreSQL Protocol
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│              BASE DE DONNÉES COMMUNE (TimescaleDB)                    │
│                        gaveurs_db                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  📦 Tables Euralis Multi-Sites (12 tables)                           │
│  ├─ sites_euralis                    [EXISTANT]                      │
│  ├─ gaveurs_euralis                  [EXISTANT]                      │
│  ├─ lots_gavage                      [EXISTANT] 174 colonnes CSV     │
│  ├─ doses_journalieres               [EXISTANT] Hypertable           │
│  ├─ performances_sites               [EXISTANT] Vue matérialisée     │
│  ├─ previsions_production            [EXISTANT]                      │
│  ├─ alertes_euralis                  [EXISTANT] Hypertable           │
│  ├─ planning_abattages               [EXISTANT]                      │
│  ├─ gaveurs_clusters                 [EXISTANT] K-Means              │
│  ├─ anomalies_detectees              [EXISTANT] Isolation Forest     │
│  ├─ formules_pysr                    [EXISTANT]                      │
│  └─ statistiques_globales            [EXISTANT] Cache                │
│                                                                        │
│  🔬 Tables SQAL Qualité (6 tables)                                   │
│  ├─ sqal_sensor_samples              [NOUVEAU]  Hypertable           │
│  │   ├─ VL53L8CH raw (matrices 8x8)                                  │
│  │   ├─ AS7341 raw (10 canaux)                                       │
│  │   ├─ Analyses capteurs                                            │
│  │   └─ Fusion résultats                                             │
│  ├─ sqal_devices                     [NOUVEAU]  ESP32 devices        │
│  ├─ sqal_hourly_stats                [NOUVEAU]  Continuous aggregate │
│  ├─ sqal_ml_models                   [NOUVEAU]  Modèles IA/ML        │
│  ├─ sqal_blockchain_txns             [NOUVEAU]  Transactions         │
│  └─ sqal_alerts                      [NOUVEAU]  Alertes qualité      │
│                                                                        │
│  ⛓️ Tables Blockchain Communes                                        │
│  ├─ blockchain_blocks                [EXISTANT] Blocs                │
│  ├─ blockchain_transactions          [EXISTANT] Transactions         │
│  └─ blockchain_hashes                [EXISTANT] Hash chain           │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                             ▲
                             │ WebSocket
                             │
┌────────────────────────────┴─────────────────────────────────────────┐
│                    SIMULATOR-SQAL (Python)                            │
│                      Jumeau Numérique                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  🎛️ Simulateurs Capteurs                                             │
│  ├─ I2C Bus Simulator                Simulation bus I2C              │
│  ├─ VL53L8CH Simulator               Capteur ToF 8x8                 │
│  ├─ AS7341 Simulator                 Capteur spectral 10 canaux      │
│  ├─ VL53L8CH Analyzer                Analyse ToF (volume, uniformité)│
│  └─ AS7341 Analyzer                  Analyse spectrale (fraîcheur)   │
│                                                                        │
│  🔄 Data Generator                                                    │
│  └─ Envoi WebSocket ws://backend:8000/ws/sensors/                    │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Backend Commun (FastAPI)

### Structure Répertoires

```
gaveurs-v3/gaveurs-ai-blockchain/backend/
├── app/
│   ├── main.py                      # ✅ Point d'entrée unique
│   │   ├─ Router /api/euralis/*     [EXISTANT]
│   │   ├─ Router /api/gaveurs/*     [EXISTANT]
│   │   └─ Router /api/sqal/*        [À AJOUTER]
│   │
│   ├── routers/
│   │   ├── euralis.py               # ✅ 15 routes Euralis
│   │   ├── gavage.py                # ✅ Routes gaveurs
│   │   └── sqal.py                  # ➕ Routes SQAL (À CRÉER)
│   │
│   ├── ml/
│   │   ├── euralis/                 # ✅ 5 modules IA/ML Euralis
│   │   │   ├── multi_site_regression.py
│   │   │   ├── production_forecasting.py
│   │   │   ├── gaveur_clustering.py
│   │   │   ├── anomaly_detection.py
│   │   │   └── abattage_optimization.py
│   │   └── sqal/                    # ➕ Modules IA/ML SQAL (À CRÉER)
│   │       ├── cnn_quality_model.py
│   │       ├── defect_detection.py
│   │       └── quality_prediction.py
│   │
│   ├── websocket/
│   │   ├── sensors_consumer.py      # ➕ WebSocket capteurs (À CRÉER)
│   │   └── realtime_broadcaster.py  # ➕ Broadcast dashboards (À CRÉER)
│   │
│   ├── models/
│   │   ├── euralis.py               # ✅ Modèles Pydantic Euralis
│   │   ├── gavage.py                # ✅ Modèles gaveurs
│   │   └── sqal.py                  # ➕ Modèles SQAL (À CRÉER)
│   │
│   ├── services/
│   │   ├── database.py              # ✅ Connexion DB commune
│   │   ├── blockchain.py            # ✅ Service blockchain
│   │   └── validation.py            # ➕ Validation SQAL (À CRÉER)
│   │
│   └── config/
│       └── settings.py              # ✅ Configuration unique
│
└── scripts/
    ├── complete_timescaledb_schema.sql  # ✅ Schéma Euralis
    ├── sqal_timescaledb_schema.sql      # ➕ Schéma SQAL (À CRÉER)
    └── import_euralis_data.py           # ✅ Import CSV Euralis
```

### Modification `main.py`

```python
# gaveurs-v3/gaveurs-ai-blockchain/backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import euralis, gavage, sqal  # ➕ Ajouter sqal
from app.websocket import sensors_consumer, realtime_broadcaster  # ➕ Nouveau

app = FastAPI(
    title="Système Gaveurs + Euralis + SQAL - API Unifiée",
    description="Backend partagé pour gavage, supervision multi-sites, et contrôle qualité",
    version="3.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Euralis
        "http://localhost:3001",  # Gaveurs
        "http://localhost:5173",  # SQAL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers REST
app.include_router(euralis.router)  # ✅ EXISTANT
app.include_router(gavage.router)   # ✅ EXISTANT
app.include_router(sqal.router)     # ➕ NOUVEAU

# WebSocket
app.add_websocket_route("/ws/sensors/", sensors_consumer.websocket_sensors)  # ➕ NOUVEAU
app.add_websocket_route("/ws/realtime/", realtime_broadcaster.websocket_realtime)  # ➕ NOUVEAU
```

---

## 💾 Base de Données Commune (TimescaleDB)

### Schéma Unifié `gaveurs_db`

#### Tables Euralis (✅ EXISTANTES - 12 tables)

| Table | Type | Description |
|-------|------|-------------|
| `sites_euralis` | Standard | 3 sites LL, LS, MT |
| `gaveurs_euralis` | Standard | 65 gaveurs |
| `lots_gavage` | Standard | Lots avec 174 colonnes CSV |
| `doses_journalieres` | Hypertable | 27 jours doses par lot |
| `performances_sites` | Vue matérialisée | Agrégations performance |
| `previsions_production` | Standard | Prévisions Prophet 7/30/90j |
| `alertes_euralis` | Hypertable | Alertes multi-niveaux |
| `planning_abattages` | Standard | Planning optimisé hongrois |
| `gaveurs_clusters` | Standard | Segmentation K-Means |
| `anomalies_detectees` | Standard | Isolation Forest |
| `formules_pysr` | Standard | Formules PySR |
| `statistiques_globales` | Standard | Cache dashboard |

#### Tables SQAL (➕ À CRÉER - 6 tables)

**1. sqal_sensor_samples (Hypertable)**

```sql
CREATE TABLE sqal_sensor_samples (
    time TIMESTAMPTZ NOT NULL,
    sample_id VARCHAR(100) PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,

    -- VL53L8CH Raw (8x8 matrices)
    vl53l8ch_distance_matrix DECIMAL(6,2)[][] NOT NULL,  -- 8x8
    vl53l8ch_reflectance_matrix INTEGER[][] NOT NULL,    -- 8x8
    vl53l8ch_amplitude_matrix INTEGER[][] NOT NULL,      -- 8x8

    -- VL53L8CH Analyzed
    vl53l8ch_volume_mm3 DECIMAL(10,2),
    vl53l8ch_avg_height_mm DECIMAL(6,2),
    vl53l8ch_surface_uniformity DECIMAL(5,4),
    vl53l8ch_quality_score DECIMAL(5,4),
    vl53l8ch_grade VARCHAR(10),
    vl53l8ch_defects JSONB,

    -- AS7341 Raw (10 canaux)
    as7341_channels JSONB NOT NULL,  -- {F1_415nm: 1234, ...}
    as7341_integration_time INTEGER,
    as7341_gain INTEGER,

    -- AS7341 Analyzed
    as7341_freshness_index DECIMAL(5,4),
    as7341_fat_quality_index DECIMAL(5,4),
    as7341_oxidation_index DECIMAL(5,4),
    as7341_quality_score DECIMAL(5,4),
    as7341_grade VARCHAR(10),
    as7341_defects JSONB,

    -- Fusion
    fusion_final_score DECIMAL(5,4),
    fusion_final_grade VARCHAR(10),
    fusion_vl53l8ch_score DECIMAL(5,4),
    fusion_as7341_score DECIMAL(5,4),
    fusion_defects JSONB,

    -- Metadata
    meta_firmware_version VARCHAR(20),
    meta_temperature_c DECIMAL(5,2),
    meta_humidity_percent DECIMAL(5,2),
    meta_config_profile VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('sqal_sensor_samples', 'time', if_not_exists => TRUE);
SELECT add_retention_policy('sqal_sensor_samples', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_compression_policy('sqal_sensor_samples', INTERVAL '7 days', if_not_exists => TRUE);
```

**2. sqal_devices**

```sql
CREATE TABLE sqal_devices (
    device_id VARCHAR(100) PRIMARY KEY,
    device_name VARCHAR(200),
    firmware_version VARCHAR(20),
    site_code VARCHAR(2) REFERENCES sites_euralis(code),  -- ✅ Lien Euralis
    status VARCHAR(20) DEFAULT 'active',
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**3. sqal_hourly_stats (Continuous Aggregate)**

```sql
CREATE MATERIALIZED VIEW sqal_hourly_stats AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_id,
    COUNT(*) as sample_count,
    AVG(fusion_final_score) as avg_quality,
    COUNT(*) FILTER (WHERE fusion_final_grade = 'A+') as count_a_plus,
    AVG(as7341_freshness_index) as avg_freshness
FROM sqal_sensor_samples
GROUP BY bucket, device_id;

SELECT add_continuous_aggregate_policy('sqal_hourly_stats',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);
```

**4. sqal_ml_models**

```sql
CREATE TABLE sqal_ml_models (
    model_id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    model_type VARCHAR(50),  -- CNN, RandomForest, etc.
    model_file_path TEXT,
    accuracy DECIMAL(5,4),
    trained_at TIMESTAMPTZ DEFAULT NOW()
);
```

**5. sqal_blockchain_txns**

```sql
CREATE TABLE sqal_blockchain_txns (
    txn_id SERIAL PRIMARY KEY,
    sample_id VARCHAR(100) REFERENCES sqal_sensor_samples(sample_id),
    block_id INTEGER,
    hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**6. sqal_alerts**

```sql
CREATE TABLE sqal_alerts (
    alert_id SERIAL PRIMARY KEY,
    sample_id VARCHAR(100),
    device_id VARCHAR(100),
    alert_type VARCHAR(50),  -- defect_detected, low_quality, etc.
    severity VARCHAR(20),    -- critical, high, medium, low
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Schéma Complet à Créer

```sql
-- fichier: sqal_timescaledb_schema.sql
-- À exécuter après complete_timescaledb_schema.sql

-- [Copier les 6 CREATE TABLE ci-dessus]
```

---

## 💻 3 Frontends Séparés

### 1. Euralis Frontend (✅ EXISTANT)

**Port** : 3000
**Technologie** : Next.js 14
**Pages** : 7 pages complètes
**API** : `/api/euralis/*`
**Statut** : Production Ready

### 2. Gaveurs Frontend (✅ EXISTANT)

**Port** : 3001
**Technologie** : Next.js
**Pages** : Saisie gavage, Historique, Blockchain
**API** : `/api/gaveurs/*`
**Statut** : Opérationnel

### 3. SQAL Frontend (➕ EXISTANT SÉPARÉ)

**Port** : 5173
**Technologie** : React + Vite + TypeScript
**Emplacement actuel** : `sqal/` (racine)
**API** : Actuellement `backend_django` (port 8000)
**WebSocket** : `ws://localhost:8000/ws/realtime/`

**Modification nécessaire** :
- Pointer vers le backend FastAPI unifié
- Adapter les types TypeScript
- Conserver l'architecture React existante

---

## 🔄 Flux de Données

### Flux SQAL Temps Réel (WebSocket)

```
1. SIMULATOR-SQAL (Python)
   ├─ Génère données VL53L8CH (8x8)
   ├─ Génère données AS7341 (10 canaux)
   ├─ Analyse avec VL53L8CH_Analyzer
   ├─ Analyse avec AS7341_Analyzer
   ├─ Fusion (score final)
   └─ Envoi WebSocket → ws://backend:8000/ws/sensors/

2. BACKEND FASTAPI
   ├─ Réception WebSocket /ws/sensors/
   ├─ Validation Pydantic
   ├─ Sauvegarde TimescaleDB (sqal_sensor_samples)
   ├─ Insertion blockchain (sqal_blockchain_txns)
   └─ Broadcast WebSocket → /ws/realtime/ (tous les dashboards SQAL)

3. SQAL FRONTEND (React)
   ├─ Réception WebSocket ws://backend:8000/ws/realtime/
   ├─ Mise à jour store Zustand
   └─ Affichage composants temps réel
```

### Flux Euralis (REST + ML)

```
1. CSV Import
   ├─ Lecture Pretraite_End_2024_claude.csv
   └─ Import TimescaleDB (lots_gavage, doses_journalieres)

2. Entraînement ML (Périodique)
   ├─ PySR : Formules ITM par site × souche
   ├─ Prophet : Prévisions 7/30/90 jours
   ├─ K-Means : Clustering gaveurs (5 groupes)
   ├─ Isolation Forest : Détection anomalies
   └─ Hongrois : Planning abattages optimisé

3. Frontend Euralis
   ├─ Requêtes REST /api/euralis/*
   └─ Affichage 7 pages
```

### Flux Gaveurs (REST + Blockchain)

```
1. Saisie Gavage (Frontend Gaveurs)
   └─ POST /api/gaveurs/gavage

2. Backend
   ├─ Validation
   ├─ Sauvegarde TimescaleDB
   └─ Insertion blockchain

3. Affichage
   └─ GET /api/gaveurs/history
```

---

## 🔌 Intégration WebSocket

### Endpoints WebSocket Unifiés

| Endpoint | Producteur | Consommateur | Description |
|----------|------------|--------------|-------------|
| `/ws/sensors/` | Simulator-SQAL | Backend FastAPI | Réception données capteurs |
| `/ws/realtime/` | Backend FastAPI | SQAL Frontend | Broadcast données en temps réel |
| `/ws/gavage/` (futur) | Backend FastAPI | Euralis/Gaveurs | Temps réel gavage |

### Architecture WebSocket

```python
# app/websocket/sensors_consumer.py

from fastapi import WebSocket
from app.services.database import save_sensor_sample
from app.services.blockchain import add_blockchain_txn

async def websocket_sensors(websocket: WebSocket):
    await websocket.accept()

    while True:
        # Réception du simulateur
        data = await websocket.receive_json()

        # Validation Pydantic
        validated = SensorDataMessage(**data)

        # Sauvegarde DB
        sample_id = await save_sensor_sample(db, validated.dict())

        # Blockchain
        await add_blockchain_txn(sample_id, validated.dict())

        # Broadcast vers dashboards
        await broadcast_to_realtime(validated.dict())
```

```python
# app/websocket/realtime_broadcaster.py

connected_dashboards = []

async def websocket_realtime(websocket: WebSocket):
    await websocket.accept()
    connected_dashboards.append(websocket)

    try:
        while True:
            await websocket.receive_text()  # Keep-alive
    except:
        connected_dashboards.remove(websocket)

async def broadcast_to_realtime(data: dict):
    for ws in connected_dashboards:
        await ws.send_json({
            "type": "sensor_update",
            "data": data
        })
```

---

## 📋 Plan d'Intégration

### Phase 1 : Schéma Base de Données (2 heures)

**Objectif** : Créer tables SQAL dans `gaveurs_db`

**Actions** :
1. ✅ Créer `sqal_timescaledb_schema.sql` (6 tables)
2. ✅ Exécuter le script :
   ```bash
   psql -U gaveurs_user -d gaveurs_db -f sqal_timescaledb_schema.sql
   ```
3. ✅ Vérifier tables créées :
   ```sql
   SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'sqal_sensor_samples';
   ```

---

### Phase 2 : Backend Routes SQAL (4 heures)

**Objectif** : Ajouter routes REST `/api/sqal/*`

**Fichiers à créer** :

**1. `app/models/sqal.py`**

```python
from pydantic import BaseModel, Field
from typing import List, Dict

class VL53L8CHData(BaseModel):
    distance_matrix: List[List[float]] = Field(..., min_items=8, max_items=8)
    reflectance_matrix: List[List[int]] = Field(..., min_items=8, max_items=8)
    # ...

class AS7341Data(BaseModel):
    channels: Dict[str, int]
    integration_time: int
    gain: int
    # ...

class FusionResult(BaseModel):
    final_score: float = Field(..., ge=0.0, le=1.0)
    final_grade: str
    # ...

class SensorDataMessage(BaseModel):
    timestamp: str
    device_id: str
    sample_id: str
    vl53l8ch: VL53L8CHData
    as7341: AS7341Data
    fusion: FusionResult
```

**2. `app/routers/sqal.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.models.sqal import SensorDataMessage
from app.services.database import get_db

router = APIRouter(prefix="/api/sqal", tags=["SQAL"])

@router.get("/latest/")
async def get_latest_sample(db: Session = Depends(get_db)):
    """Dernière mesure capteur"""
    # Requête TimescaleDB
    pass

@router.get("/history/")
async def get_history(hours: int = 24, db: Session = Depends(get_db)):
    """Historique mesures"""
    pass

@router.get("/stats/")
async def get_stats(hours: int = 24, db: Session = Depends(get_db)):
    """Statistiques qualité"""
    pass

@router.get("/devices/")
async def get_devices(db: Session = Depends(get_db)):
    """Liste devices ESP32"""
    pass
```

**3. `app/websocket/sensors_consumer.py`** (cf. section WebSocket)

**4. `app/websocket/realtime_broadcaster.py`** (cf. section WebSocket)

---

### Phase 3 : Lien SQAL ↔ Euralis (2 heures)

**Objectif** : Relier qualité capteurs aux lots gavage

**Idée** : Associer chaque mesure SQAL à un lot Euralis

**Modification table** :

```sql
ALTER TABLE sqal_sensor_samples
ADD COLUMN lot_id INTEGER REFERENCES lots_gavage(id);
```

**Usage** :
- Chaque foie gras analysé par SQAL peut être lié à un lot de gavage
- Dashboard Euralis peut afficher la qualité finale des lots
- Corrélation ITM (Euralis) ↔ Quality Score (SQAL)

---

### Phase 4 : Frontend SQAL Pointeur (1 heure)

**Objectif** : Adapter SQAL frontend vers backend unifié

**Fichier** : `sqal/.env`

```env
# AVANT
VITE_API_BASE_URL=http://localhost:8000  # Backend Django

# APRÈS
VITE_API_BASE_URL=http://localhost:8000  # Backend FastAPI unifié
VITE_WS_BASE_URL=ws://localhost:8000
```

**Modifications** : `sqal/src/services/api.ts`

```typescript
// Pas de changement majeur, juste vérifier que les endpoints correspondent
// Backend FastAPI doit exposer les mêmes routes que Django
```

---

### Phase 5 : Tests d'Intégration (3 heures)

**1. Test Backend**

```bash
# Démarrer backend unifié
cd gaveurs-v3/gaveurs-ai-blockchain/backend
uvicorn app.main:app --reload --port 8000

# Vérifier routes
curl http://localhost:8000/api/euralis/health
curl http://localhost:8000/api/sqal/latest/
```

**2. Test Simulator → Backend**

```bash
cd simulator-sqal
python data_generator.py
# Vérifier logs backend : "DATA RECEIVED FROM SIMULATOR"
```

**3. Test Frontends**

```bash
# Terminal 1 : Euralis
cd euralis-frontend
npm run dev  # Port 3000

# Terminal 2 : SQAL
cd sqal
npm run dev  # Port 5173

# Vérifier WebSocket connexions dans console navigateur (F12)
```

---

### Phase 6 : Documentation (1 heure)

**Fichiers à créer/modifier** :

1. ✅ `ARCHITECTURE_UNIFIEE.md` (ce document)
2. ➕ `INTEGRATION_SQAL_EURALIS.md` - Guide détaillé intégration
3. ➕ `WEBSOCKET_UNIFIED_GUIDE.md` - Guide WebSocket unifié
4. ✅ Mettre à jour `README.md` principal

---

## 📊 Tableau de Bord Unifié (Vision Future)

### Dashboard Euralis + SQAL Combiné

```
┌─────────────────────────────────────────────────────────────┐
│  EURALIS + SQAL - DASHBOARD SUPERVISEUR COMPLET             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 KPIs Globaux                                            │
│  ├─ Production : 18 500 kg (Euralis)                        │
│  ├─ Qualité Moyenne : A+ 95% (SQAL)                         │
│  ├─ ITM Moyen : 15.2 kg (Euralis)                           │
│  └─ Taux Conformité : 98.5% (SQAL)                          │
│                                                              │
│  🏭 Par Site                                                │
│  ┌───────────┬────────────┬──────────┬───────────┐          │
│  │ Site      │ Production │ ITM      │ Qualité   │          │
│  ├───────────┼────────────┼──────────┼───────────┤          │
│  │ LL        │ 6 200 kg   │ 15.1 kg  │ A+ 96%    │          │
│  │ LS        │ 5 800 kg   │ 15.3 kg  │ A+ 94%    │          │
│  │ MT        │ 6 500 kg   │ 15.2 kg  │ A  93%    │          │
│  └───────────┴────────────┴──────────┴───────────┘          │
│                                                              │
│  📈 Corrélations ITM ↔ Qualité Capteurs                     │
│  [Graphique scatter plot : ITM (x) vs Quality Score (y)]    │
│                                                              │
│  ⚠️ Alertes Combinées                                       │
│  ├─ [SQAL] Défaut détecté - Lot LL4801234 - Device ESP32-01│
│  ├─ [EURALIS] Mortalité élevée - Lot LS4802145             │
│  └─ [EURALIS] ITM faible - Gaveur Jean Martin               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Récapitulatif

### Ce qui Existe Déjà

✅ Backend FastAPI (port 8000)
✅ TimescaleDB `gaveurs_db`
✅ 12 Tables Euralis + hypertables
✅ 15 Routes API `/api/euralis/*`
✅ 5 Modules IA/ML Euralis
✅ Frontend Euralis (7 pages)
✅ Frontend Gaveurs
✅ Frontend SQAL (séparé)
✅ Simulator-SQAL (fonctionnel)

### Ce qu'il Faut Créer

➕ 6 Tables SQAL dans `gaveurs_db`
➕ Routes `/api/sqal/*` (4-5 endpoints)
➕ WebSocket `/ws/sensors/` et `/ws/realtime/`
➕ Modèles Pydantic SQAL
➕ Script SQL `sqal_timescaledb_schema.sql`
➕ Lien `sqal_sensor_samples.lot_id` → `lots_gavage.id`

---

## 🚀 Démarrage Complet (Après Intégration)

```bash
# 1. Base de données
psql -U gaveurs_user -d gaveurs_db -f complete_timescaledb_schema.sql
psql -U gaveurs_user -d gaveurs_db -f sqal_timescaledb_schema.sql

# 2. Backend unique
cd gaveurs-v3/gaveurs-ai-blockchain/backend
export DATABASE_URL="postgresql://gaveurs_user:gaveurs_pass@localhost:5432/gaveurs_db"
uvicorn app.main:app --reload --port 8000

# 3. Simulator SQAL
cd simulator-sqal
python data_generator.py

# 4. Frontend Euralis
cd euralis-frontend
npm run dev  # Port 3000

# 5. Frontend SQAL
cd sqal
npm run dev  # Port 5173

# 6. Frontend Gaveurs (optionnel)
cd gaveurs-v3/gaveurs-ai-blockchain/frontend
npm run dev -- --port 3001
```

---

**Statut** : Architecture définie, prête pour implémentation
**Prochaine étape** : Phase 1 - Schéma Base de Données

🏗️ **Backend Unifié + 3 Frontends + 1 DB** 🏗️
