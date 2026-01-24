# État des Algorithmes IA/ML - Système Gaveurs V3.0

Ce document récapitule l'état d'implémentation des **6 algorithmes IA/ML** du système.

---

## ✅ Résumé : TOUS LES ALGORITHMES SONT IMPLÉMENTÉS

Les 6 algorithmes mentionnés dans [CLAUDE.md](CLAUDE.md) sont **100% codés et fonctionnels**.

---

## 📊 Liste des Algorithmes

### 1. ✅ Régression Symbolique (PySR)

**Fichier** : [backend-api/app/ml/symbolic_regression.py](backend-api/app/ml/symbolic_regression.py)

**Objectif** : Découvrir les formules optimales de gavage pour prédire l'ITM (Indice Technique Moyen)

**Technologie** : PySR (PySR Regressor)

**Features utilisées** :
- Doses matin/soir
- Poids matin/soir
- Température stabule
- Humidité stabule
- Génétique canard
- Jour de gavage

**Sorties** :
- Équations symboliques interprétables (ex: `ITM = 0.5*dose_soir + 0.3*poids_matin - 12`)
- Score R² de performance
- Complexité de la formule
- Métriques d'erreur (MAE, MSE)

**Entraînement** :
```python
from app.ml.symbolic_regression import SymbolicRegressionEngine

engine = SymbolicRegressionEngine(db_pool)
df = await engine.load_training_data(genetique="Mulard", limit=10000)
best_model, results = await engine.train_model(df, target="itm")
```

**Stockage** : Table `ml_symbolic_models`

---

### 2. ✅ Optimiseur de Feedback Consommateur (Random Forest)

**Fichier** : [backend-api/app/ml/feedback_optimizer.py](backend-api/app/ml/feedback_optimizer.py)

**Objectif** : **CŒUR DU SYSTÈME** - Boucle fermée qui améliore les courbes d'alimentation selon satisfaction consommateur

**Technologie** : Random Forest Regressor + Gradient Boosting

**Flux de données** :
```
Gaveur → Production → SQAL Quality → QR Code → Consommateur → Feedback (1-5)
   ↑                                                                    ↓
   └─────────────────── IA : Nouvelle courbe optimisée ← ─────────────┘
```

**Features analysées** :
- Corrélation paramètres production ↔ satisfaction
- Importance de chaque métrique (ITM, Sigma, durée gavage, doses)
- Plages optimales pour maximiser satisfaction

**Sorties** :
- `FeedbackInsight` : Insights par métrique (corrélation, importance, recommandation)
- `ImprovedCurve` : Nouvelles courbes d'alimentation optimisées
- Score de satisfaction attendu
- Intervalles de confiance

**Entraînement** :
```python
from app.ml.feedback_optimizer import FeedbackOptimizer

optimizer = FeedbackOptimizer(db_pool)
insights = await optimizer.analyze_feedback_correlations(genetique="Mulard")
improved_curve = await optimizer.generate_improved_curve(
    genetique="Mulard",
    target_satisfaction=4.5
)
```

**Stockage** : Tables `consumer_feedbacks`, `ml_feedback_models`

---

### 3. ✅ Prévisions de Production (Prophet)

**Fichier** : [backend-api/app/ml/euralis/production_forecasting.py](backend-api/app/ml/euralis/production_forecasting.py)

**Objectif** : Prévoir la production de foie gras à 7/30/90 jours par site

**Technologie** : Prophet (Facebook)

**Features** :
- Historique production quotidienne (kg)
- Saisonnalité (weekends, jours fériés)
- Tendances long terme
- Événements spéciaux

**Sorties** :
- Prévisions à J+7, J+30, J+90
- Intervalles de confiance (bande supérieure/inférieure)
- Tendances par site (LL, LS, MT)

**Entraînement** :
```python
from app.ml.euralis.production_forecasting import ProductionForecaster

forecaster = ProductionForecaster()

# Entraîner modèle pour site LL
historical_data = pd.DataFrame({
    'date': [...],
    'production_kg': [...]
})
model = forecaster.train_site_model('LL', historical_data)

# Prédire 30 jours
forecast_df = forecaster.predict(model, periods=30)
```

**Stockage** : Table `euralis_production_forecasts`

---

### 4. ✅ Clustering Gaveurs (K-Means)

**Fichier** : [backend-api/app/ml/euralis/gaveur_clustering.py](backend-api/app/ml/euralis/gaveur_clustering.py)

**Objectif** : Segmenter les gaveurs en 5 groupes de performance homogènes

**Technologie** : K-Means (Scikit-learn)

**Features** :
- ITM moyen
- Sigma moyen
- Mortalité moyenne
- Nombre de lots
- Régularité (variance ITM)

**Clusters** :
1. **Excellent** (20%) - ITM élevé, faible mortalité
2. **Très bon** (25%)
3. **Bon** (30%)
4. **À améliorer** (15%)
5. **Critique** (10%) - ITM faible, forte mortalité

**Sorties** :
- Affectation cluster par gaveur
- Profil du cluster (moyennes, écarts types)
- Recommandations d'amélioration ciblées

**Entraînement** :
```python
from app.ml.euralis.gaveur_clustering import GaveurSegmentation

segmentation = GaveurSegmentation(n_clusters=5)

gaveurs_df = pd.DataFrame({
    'gaveur_id': [...],
    'itm_moyen': [...],
    'sigma_moyen': [...],
    'mortalite_moyenne': [...],
    'nb_lots': [...],
    'regularite': [...]
})

result_df = segmentation.segment_gaveurs(gaveurs_df)
# Ajoute colonnes: cluster, cluster_label, distance_to_center
```

**Stockage** : Table `euralis_gaveur_clusters`

---

### 5. ✅ Détection d'Anomalies (Isolation Forest)

**Fichier** : [backend-api/app/ml/euralis/anomaly_detection.py](backend-api/app/ml/euralis/anomaly_detection.py)

**Objectif** : Détecter lots/gaveurs/sites atypiques à plusieurs niveaux

**Technologie** : Isolation Forest (Scikit-learn)

**Niveaux de détection** :

1. **Niveau Lot** (contamination 10%) :
   - ITM anormal
   - Sigma anormal
   - Mortalité anormale
   - Durée gavage anormale
   - Consommation maïs anormale

2. **Niveau Gaveur** (contamination 15%) :
   - Performance globale atypique
   - Dégradation soudaine
   - Irrégularité excessive

3. **Niveau Site** (contamination 20%) :
   - Production anormale
   - Qualité moyenne dégradée

**Sorties** :
- Score d'anomalie (-1 = anomalie, 1 = normal)
- Anomaly score (distance à la normale)
- Classement par gravité
- Recommandations d'investigation

**Entraînement** :
```python
from app.ml.euralis.anomaly_detection import MultiLevelAnomalyDetector

detector = MultiLevelAnomalyDetector()

# Détection niveau lot
lots_df = pd.DataFrame({...})
result_df = detector.detect_lot_anomalies(lots_df)

# Détection niveau gaveur
gaveurs_df = pd.DataFrame({...})
result_df = detector.detect_gaveur_anomalies(gaveurs_df)

# Détection niveau site
sites_df = pd.DataFrame({...})
result_df = detector.detect_site_anomalies(sites_df)
```

**Stockage** : Tables `euralis_anomalies_lot`, `euralis_anomalies_gaveur`, `euralis_anomalies_site`

---

### 6. ✅ Optimisation Planning Abattages (Algorithme Hongrois)

**Fichier** : [backend-api/app/ml/euralis/abattage_optimization.py](backend-api/app/ml/euralis/abattage_optimization.py)

**Objectif** : Optimiser l'allocation lots → abattoirs en minimisant coûts (transport + urgence + surcharge)

**Technologie** : Algorithme Hongrois (linear_sum_assignment - SciPy)

**Contraintes** :
- Distance site → abattoir
- Capacité abattoir (canards/jour)
- Urgence lot (date fin gavage)
- Coût transport (€/km)

**Fonction de coût** :
```
Coût(lot, abattoir, date) =
  + distance_km * coût_transport_par_km
  + urgence_lot * pénalité_urgence
  + surcharge_abattoir * pénalité_surcharge
```

**Sorties** :
- Planning optimal lot → abattoir → date
- Coût total minimisé
- Taux de remplissage abattoirs
- Économies vs planning naïf

**Entraînement** :
```python
from app.ml.euralis.abattage_optimization import AbattageOptimizer

optimizer = AbattageOptimizer()

lots_ready = [
    {'id': 1, 'site': 'LL', 'nb_canards': 950, 'date_fin_gavage': date(2024, 12, 25), 'urgence': 5},
    {'id': 2, 'site': 'LS', 'nb_canards': 800, 'date_fin_gavage': date(2024, 12, 26), 'urgence': 3},
    ...
]

abattoirs_capacity = {
    'abattoir_1': {'daily_capacity': 5000, 'available_days': [date(2024, 12, 25), ...]},
    'abattoir_2': {'daily_capacity': 3000, 'available_days': [date(2024, 12, 26), ...]}
}

planning = optimizer.optimize_weekly_planning(lots_ready, abattoirs_capacity)
# Retourne: {lot_id: (abattoir_id, date_abattage)}
```

**Stockage** : Table `euralis_abattage_planning`

---

## 🗄️ Stockage des Modèles

Tous les modèles entraînés sont **persistés en base de données** (pas de re-computation) :

| Algorithme | Table(s) de stockage |
|------------|----------------------|
| Régression Symbolique | `ml_symbolic_models` |
| Feedback Optimizer | `consumer_feedbacks`, `ml_feedback_models` |
| Production Forecasting | `euralis_production_forecasts` |
| Gaveur Clustering | `euralis_gaveur_clusters` |
| Anomaly Detection | `euralis_anomalies_lot`, `euralis_anomalies_gaveur`, `euralis_anomalies_site` |
| Abattage Optimization | `euralis_abattage_planning` |

---

## 🚀 Endpoints API

Les algorithmes sont exposés via le backend FastAPI :

```python
# Régression Symbolique
POST /api/ml/symbolic/train
GET  /api/ml/symbolic/predict

# Feedback Optimizer (CORE)
POST /api/consumer/feedback
GET  /api/ml/feedback/insights
GET  /api/ml/feedback/improved-curve

# Production Forecasting
POST /api/euralis/ml/forecast/train
GET  /api/euralis/ml/forecast/predict

# Gaveur Clustering
POST /api/euralis/ml/clustering/segment
GET  /api/euralis/ml/clustering/gaveurs

# Anomaly Detection
POST /api/euralis/ml/anomalies/detect
GET  /api/euralis/ml/anomalies/lots

# Abattage Optimization
POST /api/euralis/ml/abattage/optimize
GET  /api/euralis/ml/abattage/planning
```

Voir [backend-api/app/routers/](backend-api/app/routers/) pour détails.

---

## 📚 Dépendances ML

Installées dans `backend-api/requirements.txt` :

```txt
# Régression Symbolique
pysr>=0.16.0
sympy>=1.12

# Machine Learning classique
scikit-learn>=1.3.0
numpy>=1.24.0
pandas>=2.0.0

# Time Series
prophet>=1.1.5

# Optimisation
scipy>=1.11.0

# Sérialisation modèles
joblib>=1.3.0

# Database
asyncpg>=0.29.0
```

---

## 🧪 Tests

Tous les algorithmes ont des tests unitaires dans `backend-api/tests/ml/` :

```bash
# Tester tous les algos ML
cd backend-api
pytest tests/ml/ -v

# Tester un algo spécifique
pytest tests/ml/test_symbolic_regression.py -v
pytest tests/ml/test_feedback_optimizer.py -v
pytest tests/ml/euralis/test_production_forecasting.py -v
```

---

## 📈 Métriques de Performance

| Algorithme | Métrique principale | Objectif |
|------------|---------------------|----------|
| Régression Symbolique | R² Score | > 0.85 |
| Feedback Optimizer | Satisfaction moyenne | > 4.2/5 |
| Production Forecasting | MAPE | < 10% |
| Gaveur Clustering | Silhouette Score | > 0.6 |
| Anomaly Detection | Precision/Recall | > 0.80 |
| Abattage Optimization | Coût total | Min |

---

## 🔄 Cycle de Vie

1. **Entraînement initial** : Script `scripts/train_ml_models.py`
2. **Ré-entraînement périodique** : Cron job quotidien
3. **Inférence temps réel** : Via endpoints API
4. **Monitoring** : Logs + métriques Prometheus
5. **Mise à jour modèles** : Versioning en DB

---

## 🎯 Roadmap Future

- [ ] Auto-tuning hyperparamètres avec Optuna
- [ ] Explainability avec SHAP
- [ ] Modèles ensemblistes (stacking)
- [ ] MLOps pipeline avec MLflow
- [ ] A/B testing courbes optimisées

---

## 📞 Support

Pour toute question sur les algorithmes ML :

1. Consulter ce document
2. Lire le code source dans `backend-api/app/ml/`
3. Vérifier les tests dans `backend-api/tests/ml/`
4. Consulter [CLAUDE.md](CLAUDE.md) section "AI/ML Modules"

---

**Version** : 3.0.0
**Date** : 22 Décembre 2024
**Statut** : ✅ TOUS IMPLÉMENTÉS ET FONCTIONNELS
