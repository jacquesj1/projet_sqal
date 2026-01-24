# 🤖 Intelligence Artificielle & Machine Learning

Documentation des 6 modules IA/ML du système Gaveurs V3.0.

---

## 📚 Vue d'ensemble

Le système intègre **6 algorithmes d'intelligence artificielle** pour optimiser la production de foie gras et créer une boucle fermée consommateur → gaveur.

**Localisation code**: `backend-api/app/ml/`

---

## 🧠 Modules IA/ML

### 1. 🔬 Symbolic Regression (PySR)

**Fichier**: `app/ml/symbolic_regression.py`

**Description**: Découverte automatique de formules mathématiques optimales pour le gavage

**Algorithme**: PySR (Symbolic Regression via Evolution)

**Objectif**: Prédire l'ITM (Indice Transformation Maïs) optimal

**Entrées**:
- Poids canard (g)
- Jour de gavage (0-14)
- Dose maïs (g)
- Génétique (Mulard Star, Grimaud)
- Température stabule (°C)
- Humidité (%)

**Sortie**: Formule symbolique (ex: `ITM = 2.3 * sqrt(poids) / (jour + 1)`)

**Usage**:
```python
from app.ml.symbolic_regression import train_symbolic_regression

# Entraînement sur données historiques
formula = await train_symbolic_regression(
    lots_history,
    target='itm',
    iterations=100
)

# Résultat:
# "ITM = 2.34 * poids^0.67 / (dose * 0.98)"
```

**Avantages**:
- ✅ Formule explicable (pas de boîte noire)
- ✅ Transférable entre sites
- ✅ Validable par zootechniciens

**Table DB**: `ml_symbolic_formulas`

---

### 2. 🎯 Feedback Optimizer (Random Forest)

**Fichier**: `app/ml/feedback_optimizer.py`

**Description**: **Cœur de la boucle fermée** - Optimise les paramètres de gavage basé sur le feedback consommateur

**Algorithme**: Random Forest Regressor

**Objectif**: Maximiser la satisfaction consommateur (rating 1-5)

**Entrées**:
- Paramètres production (courbe gavage, doses, conditions)
- Feedback consommateurs (notes, commentaires)
- Blockchain traceability (QR codes)

**Sorties**:
- Nouvelles courbes de gavage optimisées
- Recommandations doses par jour
- Ajustements conditions environnementales

**Flux complet**:
```
1. Gaveur → Saisie gavages
2. Lot terminé → Abattage
3. Produit emballé → QR code généré
4. Consommateur → Scan QR + Feedback (1-5 ⭐)
5. IA analyse corrélations (production ↔ satisfaction)
6. Génère nouvelles courbes optimisées
7. Retour gaveur → Cycle répété 🔄
```

**Usage**:
```python
from app.ml.feedback_optimizer import optimize_from_feedback

# Analyser feedbacks récents
suggestions = await optimize_from_feedback(
    feedbacks_last_30_days,
    current_protocol
)

# Résultat:
# {
#   "dose_j1": 120g → 115g,
#   "dose_j7": 450g → 440g,
#   "temperature": 20°C → 19°C,
#   "expected_rating_improvement": +0.3 ⭐
# }
```

**Tables DB**:
- `consumer_feedbacks` (hypertable)
- `feedback_analysis`
- `optimization_suggestions`

**Documentation**: [SYSTEME_COMPLET_BOUCLE_FERMEE.md](../../SYSTEME_COMPLET_BOUCLE_FERMEE.md)

---

### 3. 📈 Production Forecasting (Prophet)

**Fichier**: `app/ml/euralis/production_forecasting.py`

**Description**: Prévisions de production à court/moyen/long terme

**Algorithme**: Facebook Prophet (séries temporelles)

**Objectifs**: Prédire production future (nombre lots, kg foie gras, ITM moyen)

**Horizons**:
- 7 jours (court terme)
- 30 jours (moyen terme)
- 90 jours (long terme)

**Entrées**:
- Historique production (hypertable `doses_journalieres`)
- Saisonnalité (hiver/été)
- Tendances long terme
- Événements exceptionnels

**Sorties**:
- Graphiques prévisions
- Intervalles de confiance (95%)
- Recommandations planning

**Usage**:
```python
from app.ml.euralis.production_forecasting import forecast_production

# Prévoir 30 jours
forecast = await forecast_production(
    site_code="LL",
    horizon_days=30
)

# Résultat:
# {
#   "forecast": [
#     {"date": "2024-12-24", "lots": 12, "kg": 450, "confidence": 0.92},
#     {"date": "2024-12-25", "lots": 8, "kg": 310, "confidence": 0.89},
#     ...
#   ]
# }
```

**Endpoint API**: `GET /api/euralis/analytics/forecast?horizon=30`

**Table DB**: `production_forecasts`

---

### 4. 👥 Gaveur Clustering (K-Means)

**Fichier**: `app/ml/euralis/gaveur_clustering.py`

**Description**: Segmentation des 65 gaveurs en clusters de performance

**Algorithme**: K-Means (5 clusters)

**Objectif**: Identifier profils gaveurs pour coaching personnalisé

**Clusters**:
1. 🌟 **Elite** (Top 10%) - ITM excellent, faible mortalité
2. ✅ **Bons** (20%) - Au-dessus de la moyenne
3. 📊 **Moyens** (40%) - Performances standard
4. ⚠️ **À améliorer** (20%) - En dessous moyenne
5. 🚨 **Critiques** (10%) - Nécessitent assistance urgente

**Entrées**:
- ITM moyen par gaveur
- Taux mortalité
- Régularité doses
- Respect protocole
- Vitesse gavage

**Sorties**:
- Cluster ID par gaveur
- Recommandations formation
- Plan d'action personnalisé

**Usage**:
```python
from app.ml.euralis.gaveur_clustering import cluster_gaveurs

# Clustering des 65 gaveurs
clusters = await cluster_gaveurs()

# Résultat:
# [
#   {"gaveur_id": 1, "nom": "Jean Dupont", "cluster": "Elite", "itm": 3.2},
#   {"gaveur_id": 2, "nom": "Marie Martin", "cluster": "Bons", "itm": 2.9},
#   ...
# ]
```

**Endpoint API**: `GET /api/euralis/analytics/clusters`

**Table DB**: `gaveur_clusters`

---

### 5. 🔍 Anomaly Detection (Isolation Forest)

**Fichier**: `app/ml/euralis/anomaly_detection.py`

**Description**: Détection automatique d'anomalies de production

**Algorithme**: Isolation Forest

**Objectif**: Alerter sur comportements anormaux avant impact significatif

**Anomalies détectées**:
- Mortalité anormalement élevée
- Chute soudaine poids moyen
- ITM hors normes
- Doses incohérentes
- Conditions stabule aberrantes

**Entrées**:
- Données temps réel (hypertable `doses_journalieres`)
- Historique 6 mois
- Seuils normaux par site

**Sorties**:
- Score anomalie (0-1)
- Type anomalie
- Sévérité (info/warning/critical)
- Actions recommandées

**Usage**:
```python
from app.ml.euralis.anomaly_detection import detect_anomalies

# Détecter anomalies dernières 24h
anomalies = await detect_anomalies(
    site_code="LL",
    hours=24
)

# Résultat:
# [
#   {
#     "lot_code": "LL-2024-042",
#     "anomaly_score": 0.87,
#     "type": "high_mortality",
#     "severity": "critical",
#     "action": "Inspection vétérinaire urgente"
#   }
# ]
```

**Endpoint API**: `GET /api/euralis/analytics/anomalies`

**Table DB**: `anomalies_detected`

---

### 6. 🏭 Abattage Optimization (Hungarian Algorithm)

**Fichier**: `app/ml/euralis/abattage_optimization.py`

**Description**: Optimisation du planning d'abattage multi-sites

**Algorithme**: Hungarian Algorithm (problème d'affectation)

**Objectif**: Minimiser coûts transport + maximiser fraîcheur

**Contraintes**:
- Capacité abattoirs (lots/jour)
- Distance sites → abattoirs
- Fenêtre temps (lots prêts J11-J14)
- Priorité qualité (poids optimal)

**Entrées**:
- Lots prêts abattage (flag `pret_abattage=true`)
- Capacités abattoirs par jour
- Distances sites-abattoirs
- Coûts transport

**Sorties**:
- Planning optimal (quel lot → quel abattoir → quel jour)
- Économies estimées (€)
- Taux remplissage abattoirs

**Usage**:
```python
from app.ml.euralis.abattage_optimization import optimize_abattage_planning

# Optimiser semaine prochaine
planning = await optimize_abattage_planning(
    lots_ready=lots_prets_abattage,
    horizon_days=7
)

# Résultat:
# {
#   "2024-12-24": [
#     {"lot": "LL-2024-042", "abattoir": "Maubourguet", "cost": 120€},
#     {"lot": "LS-2024-018", "abattoir": "Bressuire", "cost": 85€},
#   ],
#   "total_savings": 340€,
#   "capacity_usage": 0.87
# }
```

**Endpoint API**: `POST /api/euralis/analytics/optimize-abattage`

**Table DB**: `abattage_planning`

---

## 📊 Statistiques IA/ML

| Module | Algorithme | Entrées | Sorties | Entraînement | Production |
|--------|-----------|---------|---------|--------------|-----------|
| Symbolic Regression | PySR | Lots historiques | Formules | Offline | Temps réel |
| Feedback Optimizer | Random Forest | Feedbacks | Courbes gavage | Hebdomadaire | Batch |
| Forecasting | Prophet | Time-series | Prévisions | Quotidien | API |
| Clustering | K-Means | Métriques gaveurs | Clusters | Mensuel | API |
| Anomaly Detection | Isolation Forest | Temps réel | Alertes | Offline | Streaming |
| Abattage Optim | Hungarian | Lots + Capacités | Planning | À la demande | API |

---

## 🗄️ Tables Database ML

```sql
-- Formules symbolic regression
CREATE TABLE ml_symbolic_formulas (
  id SERIAL PRIMARY KEY,
  formula TEXT NOT NULL,
  target VARCHAR(50),
  r2_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedbacks consommateurs (hypertable)
CREATE TABLE consumer_feedbacks (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES consumer_products(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  qr_code VARCHAR(100),
  blockchain_hash VARCHAR(256),
  timestamp TIMESTAMPTZ NOT NULL
);
SELECT create_hypertable('consumer_feedbacks', 'timestamp');

-- Analyses feedbacks
CREATE TABLE feedback_analysis (
  id SERIAL PRIMARY KEY,
  analysis_date DATE,
  correlations JSONB,
  insights TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suggestions optimisation
CREATE TABLE optimization_suggestions (
  id SERIAL PRIMARY KEY,
  based_on_analysis_id INTEGER REFERENCES feedback_analysis(id),
  parameter VARCHAR(100),
  current_value DOUBLE PRECISION,
  suggested_value DOUBLE PRECISION,
  expected_improvement DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prévisions production
CREATE TABLE production_forecasts (
  id SERIAL PRIMARY KEY,
  site_code VARCHAR(10),
  forecast_date DATE,
  predicted_lots INTEGER,
  predicted_kg DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clusters gaveurs
CREATE TABLE gaveur_clusters (
  id SERIAL PRIMARY KEY,
  gaveur_id INTEGER REFERENCES gaveurs(id),
  cluster_name VARCHAR(50),
  cluster_id INTEGER,
  performance_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anomalies détectées
CREATE TABLE anomalies_detected (
  id SERIAL PRIMARY KEY,
  lot_code VARCHAR(50),
  anomaly_type VARCHAR(50),
  severity VARCHAR(20),
  score DOUBLE PRECISION,
  description TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planning abattage
CREATE TABLE abattage_planning (
  id SERIAL PRIMARY KEY,
  lot_code VARCHAR(50),
  abattoir VARCHAR(100),
  planned_date DATE,
  estimated_cost DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🧪 Entraînement & Tests

### Entraînement Feedback Optimizer

```bash
cd backend-api
source venv/bin/activate

# Entraîner sur feedbacks 6 derniers mois
python -m app.ml.feedback_optimizer train \
  --months 6 \
  --output models/feedback_rf.pkl

# Tester sur validation set
python -m app.ml.feedback_optimizer test \
  --model models/feedback_rf.pkl \
  --test-data data/feedbacks_test.csv
```

### Clustering Gaveurs

```bash
# Recalculer clusters (mensuel)
python -m app.ml.euralis.gaveur_clustering update

# Résultat:
# ✅ 65 gaveurs clustérisés
# - Elite: 7 gaveurs
# - Bons: 13 gaveurs
# - Moyens: 26 gaveurs
# - À améliorer: 12 gaveurs
# - Critiques: 7 gaveurs
```

---

## 📈 Performance Modules

| Module | Précision | Temps Entraînement | Temps Prédiction |
|--------|-----------|-------------------|------------------|
| Symbolic Regression | R² = 0.89 | 30 min | <1ms |
| Feedback Optimizer | R² = 0.82 | 10 min | <100ms |
| Forecasting | MAPE = 8% | 5 min | <200ms |
| Clustering | Silhouette = 0.71 | 2 min | <50ms |
| Anomaly Detection | F1 = 0.88 | 15 min | <10ms |
| Abattage Optim | - | <1s | <500ms |

---

## 🔗 Liens Documentation

- [Système Boucle Fermée](../../SYSTEME_COMPLET_BOUCLE_FERMEE.md)
- [Fonctionnalités](../03-FONCTIONNALITES/README.md)
- [Architecture](../02-ARCHITECTURE/README.md)
- [SQAL](../07-SQAL/README.md)

---

**Retour**: [Index principal](../README.md)
