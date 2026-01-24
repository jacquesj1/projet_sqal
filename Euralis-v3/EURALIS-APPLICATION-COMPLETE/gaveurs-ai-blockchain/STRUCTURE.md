# 📁 Structure du Projet - Système Gaveurs V2.1

## 🎯 Vue d'ensemble

Projet complet full-stack avec IA et blockchain pour le suivi intelligent du gavage.

**Créé le** : 07/12/2025  
**Version** : 2.1.0  
**Technologies** : FastAPI, Next.js, TimescaleDB, PySR, Blockchain, SMS

---

## 📂 Arborescence complète

```
gaveurs-ai-blockchain/
│
├── 📄 README.md                      # Documentation complète
├── 📄 QUICKSTART.md                  # Guide de démarrage rapide
├── 📄 STRUCTURE.md                   # Ce fichier
├── 📄 .env.example                   # Variables d'environnement
├── 📄 .gitignore                     # Exclusions Git
├── 🐳 docker-compose.yml             # Orchestration Docker complète
├── 📊 prometheus.yml                 # Configuration monitoring
├── 🚀 start.sh                       # Script de démarrage automatique
│
├── backend/                          # 🐍 BACKEND PYTHON/FASTAPI
│   ├── 🐳 Dockerfile                 # Image Docker backend
│   ├── 📄 requirements.txt           # Dépendances Python
│   │
│   └── app/                          # Code applicatif
│       ├── 📄 __init__.py
│       ├── 🚀 main.py                # Application FastAPI principale
│       │
│       ├── models/                   # 📊 Modèles de données
│       │   ├── __init__.py
│       │   └── schemas.py            # Schémas Pydantic (Gaveur, Canard, etc.)
│       │
│       ├── services/                 # 🔧 Services métier
│       │   ├── __init__.py
│       │   ├── sms_service.py        # Service SMS (Twilio/OVH)
│       │   └── dose_correction_service.py  # Corrections automatiques
│       │
│       ├── ml/                       # 🤖 Intelligence Artificielle
│       │   ├── __init__.py
│       │   └── symbolic_regression.py # Régression symbolique (PySR)
│       │
│       └── blockchain/               # ⛓️ Blockchain
│           ├── __init__.py
│           └── blockchain_service.py  # Service blockchain complet
│
├── frontend/                         # ⚛️ FRONTEND NEXT.JS (à créer)
│   ├── Dockerfile
│   ├── package.json
│   ├── app/
│   ├── components/
│   └── lib/
│
├── database/                         # 💾 BASE DE DONNÉES
│   ├── 📄 init.sql                   # Schéma TimescaleDB complet
│   └── 📄 test_data.sql              # Données de test
│
└── grafana/                          # 📊 MONITORING (à configurer)
    ├── dashboards/
    └── datasources/
```

---

## 📝 Description détaillée des fichiers

### 📘 Documentation

| Fichier | Description |
|---------|-------------|
| `README.md` | Documentation complète du système avec guide d'utilisation |
| `QUICKSTART.md` | Guide de démarrage en 5 minutes |
| `STRUCTURE.md` | Architecture et organisation du projet (ce fichier) |

### ⚙️ Configuration

| Fichier | Description |
|---------|-------------|
| `.env.example` | Template des variables d'environnement (à copier en .env) |
| `docker-compose.yml` | Orchestration complète : Backend, Frontend, DB, Monitoring |
| `prometheus.yml` | Configuration du monitoring Prometheus |
| `start.sh` | Script de démarrage automatique |

### 🐍 Backend (FastAPI)

#### Fichiers principaux

| Fichier | Description | Lignes de code |
|---------|-------------|----------------|
| `backend/app/main.py` | Application FastAPI avec toutes les routes API | ~400 |
| `backend/requirements.txt` | Dépendances Python (FastAPI, PySR, Twilio, etc.) | ~40 |

#### Modèles de données (`backend/app/models/`)

| Fichier | Description | Contenu |
|---------|-------------|---------|
| `schemas.py` | Tous les schémas Pydantic | Gaveur, Canard, GavageData, Alerte, CorrectionDose, BlockchainRecord, etc. |

#### Services métier (`backend/app/services/`)

| Fichier | Description | Fonctionnalités clés |
|---------|-------------|----------------------|
| `sms_service.py` | Service d'envoi de SMS | ✅ Support Twilio et OVH<br>✅ Alertes critiques<br>✅ Corrections de doses<br>✅ Rappels |
| `dose_correction_service.py` | Corrections automatiques | ✅ Calcul doses théoriques via IA<br>✅ Détection écarts<br>✅ Génération corrections<br>✅ SMS automatiques |

#### Intelligence Artificielle (`backend/app/ml/`)

| Fichier | Description | Fonctionnalités |
|---------|-------------|-----------------|
| `symbolic_regression.py` | Régression symbolique PySR | ✅ Découverte de formules mathématiques<br>✅ Prédiction gain de poids<br>✅ Optimisation multi-objectifs<br>✅ Calcul doses optimales |

#### Blockchain (`backend/app/blockchain/`)

| Fichier | Description | Fonctionnalités |
|---------|-------------|-----------------|
| `blockchain_service.py` | Service blockchain complet | ✅ Initialisation blockchain<br>✅ Enregistrement événements<br>✅ Cryptographie RSA<br>✅ Certificats consommateurs<br>✅ Vérification intégrité |

### 💾 Base de données

| Fichier | Description | Tables créées |
|---------|-------------|---------------|
| `database/init.sql` | Schéma TimescaleDB complet | ✅ gaveurs, canards, gavage_data<br>✅ alertes, corrections_doses<br>✅ blockchain, ml_models<br>✅ Hypertables + Continuous Aggregates |
| `database/test_data.sql` | Données de test | ✅ 2 gaveurs, 7 canards<br>✅ 13 jours de gavage<br>✅ Alertes et corrections |

---

## 🔑 Fonctionnalités par fichier

### 🤖 Intelligence Artificielle

**Fichier** : `backend/app/ml/symbolic_regression.py`

**Fonctions principales** :
- `discover_formula_poids()` : Découvre la formule symbolique optimale
- `predict_gain_poids()` : Prédit le gain de poids d'un canard
- `calculate_optimal_doses()` : Calcule les doses optimales pour atteindre un objectif

**Exemple de formule découverte** :
```python
poids_gain = 0.42*dose_matin^0.8 + 0.38*dose_soir^0.75 - 0.15*temperature + 12.3
```

### 📲 Service SMS

**Fichier** : `backend/app/services/sms_service.py`

**Providers supportés** :
- Twilio (international)
- OVH SMS (France)

**Types de SMS** :
- ✅ Alertes critiques (mortalité, température)
- ✅ Corrections de doses (écart théorique/réel)
- ✅ Rappels de gavage
- ✅ Informations générales

### 🔧 Corrections automatiques

**Fichier** : `backend/app/services/dose_correction_service.py`

**Workflow** :
1. Calcul dose théorique via IA
2. Comparaison avec dose réelle
3. Si écart > 10% → Génération correction
4. Si écart > 25% → Alerte critique + SMS
5. Enregistrement dans historique

### ⛓️ Blockchain

**Fichier** : `backend/app/blockchain/blockchain_service.py`

**Événements traçables** :
- ✅ Genesis (initialisation)
- ✅ Initialisation canard
- ✅ Chaque gavage
- ✅ Pesées
- ✅ Abattage final

**Sécurité** :
- Cryptographie RSA 2048 bits
- Hash SHA-256
- Signature numérique de chaque bloc
- Vérification d'intégrité de la chaîne

---

## 🚀 API Routes principales

### Gaveurs
- `POST /api/gaveurs/` - Créer un gaveur
- `GET /api/gaveurs/{id}` - Obtenir un gaveur

### Canards
- `POST /api/canards/` - Créer un canard
- `GET /api/canards/gaveur/{id}` - Liste des canards d'un gaveur

### Gavage & IA
- `POST /api/gavage/` - Enregistrer un gavage (avec calcul IA automatique)
- `GET /api/gavage/canard/{id}` - Historique de gavage
- `POST /api/ml/discover-formula/{genetique}` - Découvrir formule symbolique
- `GET /api/ml/predict-doses/{canard_id}` - Calculer doses optimales

### Corrections
- `GET /api/corrections/canard/{id}` - Historique corrections
- `GET /api/corrections/gaveur/{id}/stats` - Statistiques corrections

### Blockchain
- `POST /api/blockchain/init` - Initialiser la blockchain
- `GET /api/blockchain/canard/{id}/history` - Historique blockchain
- `GET /api/blockchain/canard/{id}/certificat` - Certificat consommateur
- `GET /api/blockchain/verify` - Vérifier intégrité

### Alertes
- `POST /api/alertes/` - Créer une alerte
- `GET /api/alertes/gaveur/{id}` - Alertes d'un gaveur

---

## 💡 Points techniques importants

### TimescaleDB

**Hypertables** : Tables optimisées pour séries temporelles
- `gavage_data` : Données de gavage (compressées après 7 jours)
- `alertes` : Alertes générées
- `blockchain` : Événements blockchain

**Continuous Aggregates** : Statistiques pré-calculées
- `gavage_daily_stats` : Statistiques journalières
- `gavage_weekly_genetics` : Performance par génétique

### Régression Symbolique (PySR)

**Configuration** :
- 50 iterations par défaut
- Opérateurs : +, -, *, /, ^, exp, log, sqrt
- Population : 30 x 50 individus
- Sélection : Meilleur modèle (best)

**Variables prédictives** :
- dose_matin, dose_soir
- temperature, humidite
- jours_gavage
- poids_initial
- humidite_mais

### Blockchain

**Structure d'un bloc** :
```python
{
  "index": 42,
  "timestamp": "2024-12-07T10:30:00Z",
  "type_evenement": "gavage",
  "canard_id": 123,
  "gaveur_id": 1,
  "donnees": {...},
  "hash_precedent": "abc123...",
  "hash_actuel": "def456...",
  "signature_numerique": "xyz789..."
}
```

---

## 📊 Metrics & Monitoring

### Métriques Prometheus

- `gavages_total` : Nombre total de gavages
- `alertes_total{niveau}` : Alertes par niveau
- `sms_total{type}` : SMS par type
- `http_requests_total` : Requêtes API
- `http_request_duration_seconds` : Latence

### Dashboards Grafana

1. **Vue Globale** : KPIs principaux
2. **Performance IA** : Précision des modèles
3. **Blockchain** : Intégrité et traçabilité

---

## 🔐 Sécurité

- JWT pour authentification (à implémenter)
- Mots de passe hashés avec bcrypt
- Clés RSA 2048 bits pour blockchain
- Validation Pydantic stricte
- Rate limiting (à configurer)

---

## 📦 Technologies utilisées

| Catégorie | Technologies |
|-----------|--------------|
| **Backend** | FastAPI, Uvicorn, asyncpg |
| **Database** | TimescaleDB (PostgreSQL 15) |
| **IA/ML** | PySR, scikit-learn, Prophet, TensorFlow |
| **Blockchain** | PyCryptodome (RSA, SHA-256) |
| **SMS** | Twilio, OVH SMS API |
| **Monitoring** | Prometheus, Grafana |
| **Cache** | Redis |
| **Container** | Docker, Docker Compose |

---

## ✅ Checklist de développement

### ✅ Complété

- [x] Architecture backend FastAPI
- [x] Modèles de données Pydantic
- [x] Service SMS (Twilio + OVH)
- [x] Régression symbolique (PySR)
- [x] Service de corrections automatiques
- [x] Blockchain complète avec cryptographie
- [x] Base de données TimescaleDB
- [x] API REST complète
- [x] Monitoring Prometheus
- [x] Docker Compose
- [x] Documentation complète

### 🚧 À développer (Frontend)

- [ ] Dashboard Next.js
- [ ] Composants de visualisation (graphiques)
- [ ] Interface de saisie de gavage
- [ ] Blockchain explorer
- [ ] Gestion des alertes
- [ ] WebSocket temps réel

### 🔮 Évolutions futures

- [ ] Application mobile (React Native)
- [ ] Vision par ordinateur
- [ ] Assistant vocal
- [ ] Export automatique comptabilité
- [ ] API publique abattoirs

---

## 📞 Support

Pour questions ou assistance :
- 📧 Email : contact@adeep.fr
- 📚 Documentation : README.md
- 🚀 Démarrage rapide : QUICKSTART.md

---

**Système Gaveurs V2.1** - Développé avec ❤️ par A Deep Adventure  
*L'avenir du gavage intelligent* 🦆🤖⛓️
