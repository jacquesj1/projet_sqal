# 🚀 Quick Start - Vérification Installation

Guide rapide pour vérifier que l'architecture backend partagé fonctionne correctement.

---

## ✅ Checklist de Vérification

### 1️⃣ Fichiers Backend Euralis

Vérifier que les fichiers Euralis sont bien dans `gaveurs-v3/` :

```bash
# Router Euralis
ls gaveurs-v3/gaveurs-ai-blockchain/backend/app/routers/euralis.py
# ✅ Devrait exister

# Modules IA/ML Euralis (5 fichiers)
ls gaveurs-v3/gaveurs-ai-blockchain/backend/app/ml/euralis/
# ✅ Devrait contenir :
# - __init__.py
# - multi_site_regression.py
# - production_forecasting.py
# - gaveur_clustering.py
# - anomaly_detection.py
# - abattage_optimization.py

# Scripts Euralis
ls gaveurs-v3/gaveurs-ai-blockchain/backend/scripts/create_euralis_tables.sql
ls gaveurs-v3/gaveurs-ai-blockchain/backend/scripts/import_euralis_data.py
# ✅ Les 2 fichiers devraient exister
```

### 2️⃣ Base de Données

```bash
# Connexion
psql -U postgres

# Vérifier DB
\l gaveurs_db
# ✅ Devrait exister

# Connexion à la DB
\c gaveurs_db

# Vérifier extension TimescaleDB
\dx
# ✅ Devrait afficher timescaledb

# Créer tables Euralis
\i gaveurs-v3/gaveurs-ai-blockchain/backend/scripts/create_euralis_tables.sql
# ✅ Devrait créer 7 tables sans erreur

# Vérifier tables créées
\dt *euralis*
\dt sites_euralis
\dt lots_gavage
\dt doses_journalieres
\dt alertes_euralis
\dt planning_abattages

# Vérifier vue matérialisée
\dv performances_sites
# ✅ Devrait exister

# Vérifier données sites
SELECT * FROM sites_euralis;
# ✅ Devrait afficher 3 sites (LL, LS, MT)
```

### 3️⃣ Backend (serveur FastAPI)

```bash
# Terminal 1 - Démarrer backend
cd gaveurs-v3/gaveurs-ai-blockchain/backend

export DATABASE_URL="postgresql://gaveurs_user:gaveurs_pass@localhost:5432/gaveurs_db"

uvicorn app.main:app --reload --port 8000
# ✅ Devrait démarrer sans erreur
# ✅ Devrait afficher : "Application startup complete"
```

**Tests dans un autre terminal** :

```bash
# Test santé API globale
curl http://localhost:8000/health
# ✅ Devrait retourner : {"status": "healthy", "database": "connected", ...}

# Test santé API Euralis
curl http://localhost:8000/api/euralis/health
# ✅ Devrait retourner : {"status": "healthy", "service": "Euralis API", "sites": 3, ...}

# Test liste sites
curl http://localhost:8000/api/euralis/sites
# ✅ Devrait retourner 3 sites en JSON

# Test KPIs dashboard
curl http://localhost:8000/api/euralis/dashboard/kpis
# ✅ Devrait retourner 7 KPIs (peut être avec des valeurs à 0 si pas de données)
```

**Vérifier documentation Swagger** :
- Ouvrir : http://localhost:8000/docs
- ✅ Devrait afficher toutes les routes
- ✅ Chercher tag "euralis" → devrait afficher 15 routes Euralis

### 4️⃣ Frontend Euralis

```bash
# Terminal 2 - Démarrer frontend
cd euralis-frontend

# Installer dépendances (première fois)
npm install
# ✅ Devrait installer sans erreur

# Démarrer dev server
npm run dev
# ✅ Devrait démarrer sur port 3000
# ✅ Devrait afficher : "Ready in X ms"
```

**Tests dans navigateur** :

1. Ouvrir : http://localhost:3000/euralis/dashboard

2. ✅ **Page devrait se charger sans erreur**

3. ✅ **Vérifier affichage** :
   - Header "EURALIS - Pilotage Multi-Sites"
   - Navigation avec 7 liens
   - 4 cartes KPIs (Production, Lots, Gaveurs, Alertes)
   - 2 métriques (ITM moyen, Mortalité)
   - Tableau des 3 sites
   - Footer

4. ✅ **Vérifier console navigateur** (F12) :
   - Pas d'erreur réseau
   - Les requêtes à `http://localhost:8000/api/euralis/*` devraient réussir

---

## 🔧 Résolution Problèmes Courants

### Problème : Base de données n'existe pas

```bash
psql -U postgres
CREATE DATABASE gaveurs_db;
CREATE USER gaveurs_user WITH PASSWORD 'gaveurs_pass';
GRANT ALL PRIVILEGES ON DATABASE gaveurs_db TO gaveurs_user;
```

### Problème : Extension TimescaleDB manquante

```bash
psql -U postgres -d gaveurs_db
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### Problème : Tables Euralis n'existent pas

```bash
psql -U postgres -d gaveurs_db
\i gaveurs-v3/gaveurs-ai-blockchain/backend/scripts/create_euralis_tables.sql
```

### Problème : Backend ne démarre pas

```bash
cd gaveurs-v3/gaveurs-ai-blockchain/backend

# Vérifier dépendances Python
pip install -r requirements.txt

# Vérifier DATABASE_URL
echo $DATABASE_URL
# Devrait afficher : postgresql://gaveurs_user:gaveurs_pass@localhost:5432/gaveurs_db
```

### Problème : Frontend ne se connecte pas à l'API

```bash
# Vérifier .env.local
cat euralis-frontend/.env.local

# Devrait contenir :
# NEXT_PUBLIC_API_URL=http://localhost:8000

# Vérifier que le backend tourne
curl http://localhost:8000/health
```

### Problème : CORS errors

Le backend devrait déjà avoir CORS configuré pour accepter toutes les origines en dev :

```python
# Dans gaveurs-v3/gaveurs-ai-blockchain/backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ✅ Devrait être configuré
    ...
)
```

---

## 📊 Données de Test

Si vous n'avez pas de données CSV, vous pouvez créer des données de test :

```sql
-- Connexion à la DB
psql -U postgres -d gaveurs_db

-- Insérer lots de test
INSERT INTO lots_gavage (
    code_lot, site_code, debut_lot, itm, sigma,
    pctg_perte_gavage, duree_gavage_reelle, statut
) VALUES
    ('LL4801001', 'LL', '2024-01-15', 15.2, 2.1, 3.2, 10, 'termine'),
    ('LS4801001', 'LS', '2024-01-16', 14.8, 2.3, 2.9, 11, 'termine'),
    ('MT4801001', 'MT', '2024-01-17', 15.5, 2.0, 3.1, 9, 'termine');

-- Vérifier
SELECT code_lot, site_code, itm FROM lots_gavage;

-- Refresh vue matérialisée
REFRESH MATERIALIZED VIEW performances_sites;

-- Vérifier vue
SELECT * FROM performances_sites;
```

Puis recharger le dashboard : http://localhost:3000/euralis/dashboard

---

## ✅ Succès !

Si tous les tests passent, vous avez :

✅ Backend partagé opérationnel (gaveurs + Euralis)
✅ Base de données commune avec tables Euralis
✅ API Euralis fonctionnelle (15 routes)
✅ Frontend Euralis connecté et affichant les données

**Vous êtes prêt à développer les 6 pages restantes !** 🎉

---

## 🚀 Prochaines Étapes

1. **Importer données CSV réelles** (si disponible)
   ```bash
   python gaveurs-v3/gaveurs-ai-blockchain/backend/scripts/import_euralis_data.py /chemin/vers/csv
   ```

2. **Développer pages manquantes** :
   - Sites détaillés
   - Gaveurs analytics
   - Prévisions (Prophet)
   - Qualité
   - Abattages
   - Finance

3. **Intégrer modules IA/ML** dans les endpoints API

4. **Tests et optimisations**

---

**Date** : 14 Décembre 2024
**Version** : 2.1.0 - Backend Partagé
