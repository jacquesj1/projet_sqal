# ⚡ BRIEF CLAUDE CODE - Euralis (MAJ Structure Répertoires)

## 📁 STRUCTURE DU PROJET

```
projet-euralis-gaveurs/
├── gaveurs-ai-blockchain/          # Backend partagé + App Gaveurs
│   ├── backend/                    # Backend FastAPI (PARTAGÉ)
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── routers/
│   │   │   │   ├── gavage.py      # Routes gaveurs existantes
│   │   │   │   └── euralis.py     # ← NOUVEAU : Routes Euralis
│   │   │   └── ml/
│   │   │       └── euralis/       # ← NOUVEAU : Modules IA/ML Euralis
│   │   │           ├── multi_site_regression.py
│   │   │           ├── production_forecasting.py
│   │   │           ├── gaveur_clustering.py
│   │   │           ├── anomaly_detection.py
│   │   │           └── abattage_optimization.py
│   │   ├── database/
│   │   │   └── init.sql           # Tables gaveurs existantes
│   │   └── scripts/
│   │       ├── import_euralis_data.py  # ← NOUVEAU
│   │       └── create_euralis_tables.sql  # ← NOUVEAU
│   └── ...
│
├── gaveurs-frontend/               # Frontend App Gaveurs (EXISTANT)
│   ├── app/
│   ├── components/
│   └── ...
│
└── euralis-frontend/               # ← NOUVEAU : Frontend App Euralis
    ├── app/
    │   ├── euralis/
    │   │   ├── dashboard/
    │   │   ├── sites/
    │   │   ├── gaveurs/
    │   │   ├── previsions/
    │   │   ├── qualite/
    │   │   ├── abattages/
    │   │   └── finance/
    │   └── layout.tsx
    ├── components/
    │   └── euralis/
    │       ├── kpis/
    │       ├── charts/
    │       ├── tables/
    │       └── planning/
    ├── lib/
    │   └── euralis/
    │       ├── api.ts
    │       ├── types.ts
    │       └── utils.ts
    └── package.json
```

---

## 🎯 MISSION

Développer **Application Euralis de Pilotage Multi-Sites** (3 sites : LL, LS, MT)

---

## 📚 DOCUMENTS À LIRE (IMPÉRATIF)

**Lis ces 2 fichiers dans cet ordre** :

1. `EURALIS_APPLICATION_SPECIFICATIONS.md` (1910 lignes) - Spécifications complètes
2. `EURALIS_RESUME_EXECUTIF.md` (470 lignes) - Vue d'ensemble

---

## 🏗️ Stack Technique

```
Frontend : Next.js 14 + TypeScript + Tailwind CSS
Backend  : FastAPI (PARTAGÉ - dans gaveurs-ai-blockchain/backend/)
Database : TimescaleDB (PARTAGÉE - même DB que gaveurs)
IA/ML    : PySR, Prophet, Scikit-learn, SciPy
```

---

## 📊 Données CSV

**Fichier** : `Pretraite_End_2024_claude.csv`
- 75 lots de gavage (janvier 2024)
- 174 colonnes
- **Séparateur** : `;` (point-virgule)
- **Encoding** : `latin-1`

**Lecture** :
```python
import pandas as pd
df = pd.read_csv('Pretraite_End_2024_claude.csv', sep=';', encoding='latin-1')
```

**Sites identifiés** :
- `LL` : Bretagne (11 lots = 15%)
- `LS` : Pays de Loire (32 lots = 43%)
- `MT` : Maubourguet (32 lots = 42%)

---

## 🗄️ Base de Données

### Emplacement
**Même DB que l'app gaveurs** : `gaveurs_db` (ou nom existant)

### Tables à Créer

**7 nouvelles tables** (SQL complet fourni dans SPECIFICATIONS) :

```sql
-- Fichier: gaveurs-ai-blockchain/backend/scripts/create_euralis_tables.sql

-- 1. Sites Euralis (3 sites)
CREATE TABLE sites_euralis (
    id SERIAL PRIMARY KEY,
    code VARCHAR(2) UNIQUE NOT NULL,  -- LL, LS, MT
    nom VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    ...
);

-- 2. Lots de gavage multi-sites
CREATE TABLE lots_gavage (
    id SERIAL PRIMARY KEY,
    code_lot VARCHAR(20) UNIQUE NOT NULL,
    site_code VARCHAR(2) REFERENCES sites_euralis(code),
    gaveur_id INTEGER REFERENCES gaveurs(id),
    itm DECIMAL(5,2),
    ...
);

-- 3. Doses journalières (TimescaleDB Hypertable)
CREATE TABLE doses_journalieres (
    time TIMESTAMPTZ NOT NULL,
    lot_id INTEGER REFERENCES lots_gavage(id),
    jour_gavage INTEGER,
    feed_target DECIMAL(6,2),
    feed_real DECIMAL(6,2),
    ...
);
SELECT create_hypertable('doses_journalieres', 'time');

-- 4. Prévisions production
CREATE TABLE previsions_production (...);

-- 5. Alertes Euralis
CREATE TABLE alertes_euralis (...);

-- 6. Planning abattages
CREATE TABLE planning_abattages (...);

-- 7. Vue matérialisée performances sites
CREATE MATERIALIZED VIEW performances_sites AS ...;
```

### Script d'Import CSV

**Fichier** : `gaveurs-ai-blockchain/backend/scripts/import_euralis_data.py`

```python
#!/usr/bin/env python3
"""
Script d'import des données CSV Euralis dans la base de données
"""

import pandas as pd
from sqlalchemy import create_engine
import os
from datetime import datetime

# Connexion DB (réutiliser celle de l'app gaveurs)
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/gaveurs_db')
engine = create_engine(DATABASE_URL)

def import_csv(csv_path):
    """Importer les données du CSV Euralis"""
    
    # 1. Lire CSV
    print("📄 Lecture du CSV...")
    df = pd.read_csv(csv_path, sep=';', encoding='latin-1')
    print(f"✅ {len(df)} lignes lues")
    
    # 2. Créer les 3 sites
    print("🏢 Création des sites...")
    sites = [
        {'code': 'LL', 'nom': 'Site Bretagne', 'region': 'Bretagne'},
        {'code': 'LS', 'nom': 'Site Pays de Loire', 'region': 'Pays de Loire'},
        {'code': 'MT', 'nom': 'Site Maubourguet', 'region': 'Occitanie'}
    ]
    pd.DataFrame(sites).to_sql('sites_euralis', engine, if_exists='append', index=False)
    
    # 3. Importer lots
    print("📦 Import des lots...")
    for idx, row in df.iterrows():
        # Extraire site du CodeLot
        code_lot = row['CodeLot']
        site_code = code_lot[:2]  # LL, LS, ou MT
        
        # Créer/récupérer gaveur
        gaveur_nom = row['Gaveur']
        # ... (logique création gaveur si n'existe pas)
        
        # Créer lot
        lot_data = {
            'code_lot': code_lot,
            'site_code': site_code,
            'gaveur_id': gaveur_id,
            'souche': row['Souche'],
            'itm': row['ITM'],
            'sigma': row['Sigma'],
            'duree_gavage_reelle': row['duree_gavage'],
            'pctg_perte_gavage': row['dPctgPerteGav'],
            'total_corn_real': row['total_cornReal'],
            # ... autres champs
        }
        # INSERT lot
        
        # 4. Créer doses journalières (27 jours max)
        for jour in range(1, 28):
            if f'feedCornReal_{jour}' in row and pd.notna(row[f'feedCornReal_{jour}']):
                dose_data = {
                    'time': datetime.now(),  # À ajuster avec vraie date
                    'lot_id': lot_id,
                    'jour_gavage': jour,
                    'feed_target': row[f'feedTarget_{jour}'],
                    'feed_real': row[f'feedCornReal_{jour}'],
                    # ... autres champs
                }
                # INSERT dose
    
    print("✅ Import terminé !")

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python import_euralis_data.py <chemin_csv>")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    import_csv(csv_path)
```

---

## 🔧 Backend (FastAPI)

### Emplacement des Nouveaux Fichiers

```
gaveurs-ai-blockchain/backend/
├── app/
│   ├── routers/
│   │   └── euralis.py              # ← NOUVEAU : Routes Euralis
│   └── ml/
│       └── euralis/                # ← NOUVEAU : Modules IA/ML
│           ├── __init__.py
│           ├── multi_site_regression.py
│           ├── production_forecasting.py
│           ├── gaveur_clustering.py
│           ├── anomaly_detection.py
│           └── abattage_optimization.py
└── scripts/
    ├── create_euralis_tables.sql   # ← NOUVEAU
    └── import_euralis_data.py      # ← NOUVEAU
```

### Routes API à Créer

**Fichier** : `gaveurs-ai-blockchain/backend/app/routers/euralis.py`

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

router = APIRouter(prefix="/api/euralis", tags=["euralis"])

# Sites (5 routes)
@router.get("/sites/")
async def get_sites():
    """Liste des 3 sites Euralis"""
    pass

@router.get("/sites/{code}")
async def get_site_detail(code: str):
    """Détail d'un site (LL/LS/MT)"""
    pass

@router.get("/sites/{code}/stats")
async def get_site_stats(code: str):
    """Statistiques site"""
    pass

# Dashboard (3 routes)
@router.get("/dashboard/kpis")
async def get_dashboard_kpis():
    """KPIs globaux dashboard"""
    pass

@router.get("/dashboard/charts")
async def get_dashboard_charts():
    """Données pour graphiques"""
    pass

# Lots (6 routes)
@router.get("/lots/")
async def get_lots():
    """Liste tous les lots"""
    pass

@router.get("/lots/{id}")
async def get_lot_detail(id: int):
    """Détail d'un lot"""
    pass

# Gaveurs (5 routes)
@router.get("/gaveurs/")
async def get_gaveurs():
    """Liste gaveurs"""
    pass

@router.get("/gaveurs/{id}")
async def get_gaveur_detail(id: int):
    """Détail gaveur (vue Euralis)"""
    pass

@router.get("/gaveurs/ranking")
async def get_gaveurs_ranking():
    """Classement gaveurs"""
    pass

# Prévisions (4 routes)
@router.post("/previsions/production")
async def forecast_production(site_code: str, horizon_days: int = 30):
    """Lancer prévisions Prophet"""
    from app.ml.euralis.production_forecasting import ProductionForecaster
    
    forecaster = ProductionForecaster()
    # ... logique prévision
    pass

@router.post("/previsions/whatif")
async def whatif_simulation(params: dict):
    """Simulation What-If"""
    pass

# Abattages (5 routes)
@router.get("/abattages/planning")
async def get_planning_abattages():
    """Planning abattages"""
    pass

@router.post("/abattages/optimize")
async def optimize_planning():
    """Optimiser planning avec algorithme hongrois"""
    from app.ml.euralis.abattage_optimization import AbattageOptimizer
    
    optimizer = AbattageOptimizer()
    # ... logique optimisation
    pass

# Qualité (4 routes)
@router.get("/qualite/dashboard")
async def get_qualite_dashboard():
    """Dashboard qualité"""
    pass

@router.get("/qualite/anomalies")
async def detect_anomalies():
    """Détecter anomalies"""
    from app.ml.euralis.anomaly_detection import MultiLevelAnomalyDetector
    
    detector = MultiLevelAnomalyDetector()
    # ... logique détection
    pass

# Finance (3 routes)
@router.get("/finance/dashboard")
async def get_finance_dashboard():
    """Dashboard financier"""
    pass

@router.get("/finance/projections")
async def get_projections():
    """Projections CA"""
    pass
```

**TOTAL** : ~35 routes à créer

### Modules IA/ML

**Les 5 fichiers Python avec code complet sont fournis dans EURALIS_APPLICATION_SPECIFICATIONS.md**

Tu dois les copier dans : `gaveurs-ai-blockchain/backend/app/ml/euralis/`

---

## 🎨 Frontend (Next.js)

### Création Nouveau Projet

**Au même niveau que gaveurs-frontend** :

```bash
# Se placer au bon niveau
cd projet-euralis-gaveurs/

# Créer nouveau frontend Euralis
npx create-next-app@latest euralis-frontend \
    --typescript \
    --tailwind \
    --app \
    --no-src-dir

# Installer dépendances
cd euralis-frontend
npm install recharts lucide-react date-fns react-big-calendar @tanstack/react-table
```

### Configuration

**Fichier** : `euralis-frontend/.env.local`

```bash
# API Backend (partagé avec gaveurs)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Mode Euralis
NEXT_PUBLIC_EURALIS_MODE=true

# Sites
NEXT_PUBLIC_SITES=LL,LS,MT
```

### Structure

```
euralis-frontend/
├── app/
│   ├── euralis/
│   │   ├── layout.tsx          # Layout Euralis avec navbar
│   │   ├── dashboard/
│   │   │   └── page.tsx       # Dashboard multi-sites
│   │   ├── sites/
│   │   │   ├── page.tsx       # Liste sites
│   │   │   └── [code]/
│   │   │       └── page.tsx   # Détail site (LL/LS/MT)
│   │   ├── gaveurs/
│   │   │   ├── page.tsx       # Liste gaveurs
│   │   │   └── [id]/
│   │   │       └── page.tsx   # Analytics gaveur
│   │   ├── previsions/
│   │   │   └── page.tsx       # Prévisions & simulations
│   │   ├── qualite/
│   │   │   └── page.tsx       # Contrôle qualité
│   │   ├── abattages/
│   │   │   └── page.tsx       # Planning abattages
│   │   └── finance/
│   │       └── page.tsx       # Dashboard financier
│   └── layout.tsx
├── components/
│   └── euralis/
│       ├── kpis/
│       │   ├── KPICard.tsx
│       │   └── KPIGrid.tsx
│       ├── charts/
│       │   ├── ProductionChart.tsx
│       │   ├── ITMComparisonChart.tsx
│       │   └── ForecastChart.tsx
│       ├── tables/
│       │   ├── LotsTable.tsx
│       │   ├── GaveursTable.tsx
│       │   └── AlertesTable.tsx
│       └── planning/
│           └── CalendrierAbattages.tsx
└── lib/
    └── euralis/
        ├── api.ts      # Client API
        ├── types.ts    # Types TypeScript
        └── utils.ts    # Utilitaires
```

---

## 🚀 ORDRE DE DÉVELOPPEMENT

### Phase 1 : Infrastructure (Semaine 1)

**Backend** :

```bash
cd gaveurs-ai-blockchain/backend

# 1. Créer tables SQL
psql -U postgres -d gaveurs_db -f scripts/create_euralis_tables.sql

# 2. Importer CSV
python scripts/import_euralis_data.py /path/to/Pretraite_End_2024_claude.csv

# 3. Créer routes de base
# Éditer app/routers/euralis.py
# Ajouter dans app/main.py :
# from app.routers import euralis
# app.include_router(euralis.router)

# 4. Tester
uvicorn app.main:app --reload
curl http://localhost:8000/api/euralis/sites/
```

**Frontend** :

```bash
cd euralis-frontend

# 1. Créer layout Euralis
# app/euralis/layout.tsx

# 2. Créer dashboard
# app/euralis/dashboard/page.tsx

# 3. Lancer dev
npm run dev
# http://localhost:3000/euralis/dashboard
```

### Phase 2 : IA/ML (Semaine 2)

```bash
cd gaveurs-ai-blockchain/backend

# 1. Installer dépendances
pip install pysr prophet scikit-learn scipy --break-system-packages

# 2. Copier les 5 modules depuis SPECIFICATIONS
mkdir -p app/ml/euralis
# Copier :
# - multi_site_regression.py
# - production_forecasting.py
# - gaveur_clustering.py
# - anomaly_detection.py
# - abattage_optimization.py

# 3. Créer endpoints ML
# Ajouter dans app/routers/euralis.py

# 4. Tester
python -c "from app.ml.euralis.production_forecasting import ProductionForecaster"
```

### Phase 3-6 : Reste du développement

Voir détails complets dans `BRIEF_POUR_CLAUDE_CODE.md`

---

## ⚠️ POINTS IMPORTANTS

### 1. Backend Partagé

✅ **Réutiliser** le serveur FastAPI existant dans `gaveurs-ai-blockchain/backend/`  
✅ **Ajouter** nouveau router `euralis.py`  
✅ **Préfixer** toutes les routes par `/api/euralis/`  
❌ **Ne PAS** créer un backend séparé  

### 2. Base de Données Partagée

✅ **Même DB** que l'app gaveurs  
✅ **Vérifier** avant CREATE TABLE : `CREATE TABLE IF NOT EXISTS ...`  
✅ **Référencer** tables gaveurs existantes : `REFERENCES gaveurs(id)`  

### 3. Frontend Séparé

✅ **Nouveau projet** Next.js : `euralis-frontend/`  
✅ **Même niveau** que `gaveurs-frontend/`  
✅ **Port différent** si lancés en même temps (3000 vs 3001)  

### 4. CSV

✅ **Séparateur** : `;` (point-virgule)  
✅ **Encoding** : `latin-1`  
✅ **Lecture** : `pd.read_csv(file, sep=';', encoding='latin-1')`  

---

## 📦 Commandes Utiles

### Démarrage Complet

```bash
# Terminal 1 : Backend
cd gaveurs-ai-blockchain/backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 : Frontend Euralis
cd euralis-frontend
npm run dev  # Port 3000

# Terminal 3 : Frontend Gaveurs (optionnel)
cd gaveurs-frontend
npm run dev -- --port 3001  # Port 3001
```

### Tests

```bash
# Tester API Euralis
curl http://localhost:8000/api/euralis/sites/
curl http://localhost:8000/api/euralis/dashboard/kpis

# Tester import CSV
cd gaveurs-ai-blockchain/backend
python scripts/import_euralis_data.py /path/to/Pretraite_End_2024_claude.csv
```

---

## 🎯 Priorités

**P0 (Semaine 1)** :
- [x] Tables SQL créées
- [x] CSV importé
- [x] 10 routes API de base
- [x] Dashboard frontend

**P1 (Semaines 2-3)** :
- [ ] 5 modules IA/ML
- [ ] 25 routes API restantes
- [ ] 5 pages frontend

**P2 (Semaines 4-6)** :
- [ ] Optimisations
- [ ] Tests
- [ ] Production

---

## 📚 Documentation Complète

Tous les détails (SQL complet, code Python IA/ML, interfaces détaillées) sont dans :

✅ **EURALIS_APPLICATION_SPECIFICATIONS.md** (1910 lignes)  
✅ **EURALIS_RESUME_EXECUTIF.md** (470 lignes)  

---

**🚀 Structure de répertoires clarifiée - Prêt à coder ! 🦆**
