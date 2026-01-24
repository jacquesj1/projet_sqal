# Intégration Données Réelles Euralis - Phase 7

## Vue d'ensemble

Guide pour connecter le système aux données réelles d'Euralis et entraîner les modèles IA avec des données de production.

## 1. Sources de Données Euralis

### 1.1 Données Disponibles

Selon CLAUDE.md, le système gère:

```
lots_gavage: 174 colonnes incluant
  - Données gaveur (nom, site, lot)
  - Données canards (race, âge, poids)
  - Données gavage (durées, quantités, ITM)
  - Données qualité (foie, stéatose, mélanose)
  - Données abattage (rendement, classement)
```

### 1.2 Format CSV Euralis

Le système attend un fichier CSV avec 174 colonnes. Structure:

```csv
gaveur_id,site_name,lot_number,race,age_debut,poids_debut,...,itm_final,grade_foie,rendement
GAV001,Site_A,LOT2024001,Mulard,84,4200,...,12.5,A+,82.3
GAV002,Site_B,LOT2024002,Mulard,85,4150,...,11.8,A,79.5
...
```

### Colonnes clés pour l'IA

**Prédicteurs (features)**:
- `age_debut`, `poids_debut` - État initial
- `duree_gavage_j1` à `duree_gavage_j12` - Durées quotidiennes
- `quantite_mais_j1` à `quantite_mais_j12` - Quantités quotidiennes
- `temperature_moyenne`, `humidite_moyenne` - Conditions environnementales

**Cibles (targets)**:
- `itm_final` - Indice Technique Mulard (objectif principal)
- `poids_foie_g` - Poids du foie
- `grade_foie` - Grade qualité (A+, A, B, C)
- `rendement_carcasse` - Rendement final

## 2. API d'Import des Données

### 2.1 Endpoint d'Import CSV

```python
# backend-api/app/routers/euralis_import.py

from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import asyncpg

router = APIRouter(prefix="/api/euralis/import", tags=["Euralis Import"])

@router.post("/lots-csv")
async def import_lots_csv(
    file: UploadFile = File(...),
    db_pool = Depends(get_db_pool)
):
    """
    Importe un fichier CSV de lots Euralis

    Format attendu: 174 colonnes selon schema lots_gavage
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Format invalide. CSV requis.")

    # Lire CSV
    df = pd.read_csv(file.file, encoding='utf-8-sig')

    # Valider les colonnes requises
    required_cols = [
        'gaveur_id', 'site_name', 'lot_number', 'race',
        'age_debut', 'poids_debut', 'itm_final'
    ]
    missing_cols = set(required_cols) - set(df.columns)
    if missing_cols:
        raise HTTPException(400, f"Colonnes manquantes: {missing_cols}")

    # Insérer dans TimescaleDB
    async with db_pool.acquire() as conn:
        rows_inserted = 0
        for _, row in df.iterrows():
            await conn.execute("""
                INSERT INTO lots_gavage (
                    gaveur_id, site_name, lot_number, race,
                    age_debut, poids_debut, itm_final, ...
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, ...)
                ON CONFLICT (lot_number) DO UPDATE SET
                    itm_final = EXCLUDED.itm_final,
                    updated_at = NOW()
            """, row['gaveur_id'], row['site_name'], ...)
            rows_inserted += 1

    return {
        "status": "success",
        "rows_imported": rows_inserted,
        "filename": file.filename
    }

@router.get("/validation-report")
async def validation_report(db_pool = Depends(get_db_pool)):
    """
    Génère un rapport de validation des données importées
    """
    async with db_pool.acquire() as conn:
        # Statistiques générales
        total_lots = await conn.fetchval("SELECT COUNT(*) FROM lots_gavage")
        avg_itm = await conn.fetchval("SELECT AVG(itm_final) FROM lots_gavage")

        # Détection anomalies
        anomalies = await conn.fetch("""
            SELECT lot_number, itm_final, poids_foie_g
            FROM lots_gavage
            WHERE itm_final < 5 OR itm_final > 20  -- ITM anormal
               OR poids_foie_g < 300 OR poids_foie_g > 800  -- Poids anormal
        """)

        return {
            "total_lots": total_lots,
            "average_itm": float(avg_itm),
            "anomalies_count": len(anomalies),
            "anomalies": [dict(a) for a in anomalies]
        }
```

### 2.2 Utilisation

```bash
# Import d'un fichier CSV
curl -X POST "http://localhost:8000/api/euralis/import/lots-csv" \
  -H "Authorization: Bearer <token>" \
  -F "file=@donnees_euralis_2024.csv"

# Rapport de validation
curl "http://localhost:8000/api/euralis/import/validation-report" \
  -H "Authorization: Bearer <token>"
```

## 3. Préparation des Données pour l'IA

### 3.1 Feature Engineering

```python
# backend-api/app/ml/data_preparation.py

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

async def prepare_training_data(db_pool):
    """
    Prépare les données pour l'entraînement des modèles IA
    """
    async with db_pool.acquire() as conn:
        # Récupérer les données
        rows = await conn.fetch("""
            SELECT
                age_debut, poids_debut,
                duree_gavage_j1, duree_gavage_j2, ..., duree_gavage_j12,
                quantite_mais_j1, quantite_mais_j2, ..., quantite_mais_j12,
                temperature_moyenne, humidite_moyenne,
                itm_final, poids_foie_g, grade_foie
            FROM lots_gavage
            WHERE itm_final IS NOT NULL  -- Données complètes uniquement
        """)

    df = pd.DataFrame(rows)

    # Feature engineering
    df['total_duree_gavage'] = df[[f'duree_gavage_j{i}' for i in range(1, 13)]].sum(axis=1)
    df['total_mais'] = df[[f'quantite_mais_j{i}' for i in range(1, 13)]].sum(axis=1)
    df['avg_mais_par_jour'] = df['total_mais'] / df['total_duree_gavage']
    df['progression_poids'] = df['poids_foie_g'] / df['poids_debut']

    # Courbe de gavage (pente et accélération)
    mais_cols = [f'quantite_mais_j{i}' for i in range(1, 13)]
    df['courbe_pente'] = df[mais_cols].apply(
        lambda x: np.polyfit(range(len(x)), x, 1)[0], axis=1
    )

    # Features finales
    feature_cols = [
        'age_debut', 'poids_debut',
        'total_duree_gavage', 'total_mais', 'avg_mais_par_jour',
        'temperature_moyenne', 'humidite_moyenne',
        'courbe_pente', 'progression_poids'
    ] + mais_cols

    X = df[feature_cols]
    y_itm = df['itm_final']
    y_poids = df['poids_foie_g']

    # Split train/test
    X_train, X_test, y_train_itm, y_test_itm = train_test_split(
        X, y_itm, test_size=0.2, random_state=42
    )

    # Normalisation
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    return {
        'X_train': X_train_scaled,
        'X_test': X_test_scaled,
        'y_train': y_train_itm,
        'y_test': y_test_itm,
        'scaler': scaler,
        'feature_names': feature_cols
    }
```

## 4. Entraînement des Modèles IA

### 4.1 PySR - Symbolic Regression (ITM Prediction)

```python
# backend-api/app/ml/train_symbolic_regression.py

from pysr import PySRRegressor
import asyncpg

async def train_pysr_model(db_pool):
    """
    Entraîne un modèle PySR pour découvrir la formule optimale d'ITM
    """
    # Préparer les données
    data = await prepare_training_data(db_pool)

    # Configurer PySR
    model = PySRRegressor(
        niterations=100,
        binary_operators=["+", "-", "*", "/"],
        unary_operators=["exp", "log", "sqrt"],
        model_selection="best",
        maxsize=20,
        timeout_in_seconds=3600,  # 1 heure max
        populations=50,
        population_size=100,
        ncycles_per_iteration=550,
        verbosity=1,
    )

    # Entraîner
    model.fit(data['X_train'], data['y_train'])

    # Évaluer
    train_score = model.score(data['X_train'], data['y_train'])
    test_score = model.score(data['X_test'], data['y_test'])

    # Meilleure équation
    best_equation = model.get_best()[1]

    # Sauvegarder dans DB
    async with db_pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO ml_models (
                model_name, model_type, equation,
                train_score, test_score, feature_names, trained_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        """, 'pysr_itm_predictor', 'symbolic_regression',
             str(best_equation), train_score, test_score,
             data['feature_names'])

    return {
        "equation": str(best_equation),
        "train_r2": train_score,
        "test_r2": test_score,
        "complexity": model.get_best()[0]
    }
```

### 4.2 Prophet - Forecasting Production

```python
# backend-api/app/ml/euralis/train_production_forecasting.py

from prophet import Prophet
import pandas as pd

async def train_prophet_model(db_pool, forecast_days=90):
    """
    Entraîne Prophet pour prévoir la production future
    """
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                DATE(created_at) as ds,
                AVG(itm_final) as y
            FROM lots_gavage
            WHERE created_at >= NOW() - INTERVAL '2 years'
            GROUP BY DATE(created_at)
            ORDER BY ds
        """)

    df = pd.DataFrame(rows)

    # Entraîner Prophet
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False
    )
    model.fit(df)

    # Prédictions
    future = model.make_future_dataframe(periods=forecast_days)
    forecast = model.predict(future)

    # Sauvegarder
    async with db_pool.acquire() as conn:
        for _, row in forecast.tail(forecast_days).iterrows():
            await conn.execute("""
                INSERT INTO ml_production_forecasts (
                    forecast_date, predicted_itm_avg,
                    lower_bound, upper_bound, model_version
                ) VALUES ($1, $2, $3, $4, $5)
            """, row['ds'], row['yhat'], row['yhat_lower'],
                 row['yhat_upper'], 'prophet_v1')

    return {
        "forecast_days": forecast_days,
        "last_prediction": float(forecast.iloc[-1]['yhat']),
        "trend": "upward" if forecast.iloc[-1]['trend'] > forecast.iloc[0]['trend'] else "downward"
    }
```

### 4.3 K-Means - Clustering Gaveurs

```python
# backend-api/app/ml/euralis/train_gaveur_clustering.py

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import numpy as np

async def train_kmeans_clustering(db_pool, n_clusters=5):
    """
    Segmente les gaveurs en clusters de performance
    """
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                gaveur_id,
                AVG(itm_final) as avg_itm,
                STDDEV(itm_final) as std_itm,
                COUNT(*) as nb_lots,
                AVG(poids_foie_g) as avg_poids_foie,
                AVG(rendement_carcasse) as avg_rendement
            FROM lots_gavage
            GROUP BY gaveur_id
            HAVING COUNT(*) >= 10  -- Min 10 lots par gaveur
        """)

    df = pd.DataFrame(rows)

    # Features pour clustering
    features = ['avg_itm', 'std_itm', 'avg_poids_foie', 'avg_rendement']
    X = df[features].values

    # Normalisation
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # K-Means
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    df['cluster'] = kmeans.fit_predict(X_scaled)

    # Nommer les clusters
    cluster_names = {
        0: "Performance Élevée",
        1: "Performance Moyenne-Haute",
        2: "Performance Moyenne",
        3: "Performance Moyenne-Basse",
        4: "Performance Faible"
    }

    # Sauvegarder
    async with db_pool.acquire() as conn:
        for _, row in df.iterrows():
            await conn.execute("""
                UPDATE gaveurs
                SET performance_cluster = $1,
                    cluster_name = $2,
                    updated_at = NOW()
                WHERE gaveur_id = $3
            """, int(row['cluster']),
                 cluster_names[row['cluster']],
                 row['gaveur_id'])

    # Statistiques par cluster
    cluster_stats = df.groupby('cluster')[features].mean()

    return {
        "n_clusters": n_clusters,
        "cluster_stats": cluster_stats.to_dict(),
        "gaveurs_clustered": len(df)
    }
```

## 5. API d'Entraînement

### 5.1 Endpoints pour lancer l'entraînement

```python
# backend-api/app/routers/ml_training.py

@router.post("/train/pysr")
async def train_pysr(background_tasks: BackgroundTasks, db_pool = Depends(get_db_pool)):
    """Lance l'entraînement PySR en arrière-plan"""
    background_tasks.add_task(train_pysr_model, db_pool)
    return {"status": "training_started", "model": "PySR"}

@router.post("/train/prophet")
async def train_prophet(forecast_days: int = 90, db_pool = Depends(get_db_pool)):
    """Lance l'entraînement Prophet"""
    result = await train_prophet_model(db_pool, forecast_days)
    return {"status": "completed", **result}

@router.post("/train/kmeans")
async def train_kmeans(n_clusters: int = 5, db_pool = Depends(get_db_pool)):
    """Lance le clustering K-Means"""
    result = await train_kmeans_clustering(db_pool, n_clusters)
    return {"status": "completed", **result}

@router.post("/train/all")
async def train_all_models(background_tasks: BackgroundTasks, db_pool = Depends(get_db_pool)):
    """Lance l'entraînement de tous les modèles"""
    background_tasks.add_task(train_pysr_model, db_pool)
    background_tasks.add_task(train_prophet_model, db_pool)
    background_tasks.add_task(train_kmeans_clustering, db_pool)
    return {"status": "all_training_started"}
```

### 5.2 Utilisation

```bash
# Entraîner tous les modèles
curl -X POST "http://localhost:8000/api/ml/train/all" \
  -H "Authorization: Bearer <token>"

# Entraîner PySR uniquement
curl -X POST "http://localhost:8000/api/ml/train/pysr" \
  -H "Authorization: Bearer <token>"

# Voir les résultats
curl "http://localhost:8000/api/ml/models/latest" \
  -H "Authorization: Bearer <token>"
```

## 6. Workflow Complet

### Processus d'intégration

```
1. Import CSV Euralis
   ↓
2. Validation données
   ↓
3. Feature engineering
   ↓
4. Entraînement modèles IA
   │
   ├─→ PySR (formule optimale ITM)
   ├─→ Prophet (prévisions production)
   ├─→ K-Means (clustering gaveurs)
   ├─→ Isolation Forest (détection anomalies)
   └─→ Hungarian (optimisation abattage)
   ↓
5. Évaluation et validation
   ↓
6. Déploiement modèles
   ↓
7. Monitoring performance
```

### Script automatisé

```bash
#!/bin/bash
# scripts/train_all_models.sh

# 1. Import données
echo "Import des données Euralis..."
curl -X POST "http://localhost:8000/api/euralis/import/lots-csv" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data/euralis_latest.csv"

# 2. Validation
echo "Validation des données..."
curl "http://localhost:8000/api/euralis/import/validation-report" \
  -H "Authorization: Bearer $TOKEN"

# 3. Entraînement
echo "Entraînement des modèles IA..."
curl -X POST "http://localhost:8000/api/ml/train/all" \
  -H "Authorization: Bearer $TOKEN"

echo "Entraînement lancé. Suivre les logs backend pour progression."
```

## 7. Monitoring et Métriques

### Tableau de bord ML

```python
@router.get("/ml/dashboard")
async def ml_dashboard(db_pool = Depends(get_db_pool)):
    """Métriques des modèles ML"""
    async with db_pool.acquire() as conn:
        models = await conn.fetch("""
            SELECT model_name, train_score, test_score, trained_at
            FROM ml_models
            ORDER BY trained_at DESC
            LIMIT 10
        """)

        return {
            "models": [dict(m) for m in models],
            "total_lots": await conn.fetchval("SELECT COUNT(*) FROM lots_gavage"),
            "avg_itm": await conn.fetchval("SELECT AVG(itm_final) FROM lots_gavage")
        }
```

## 8. Prochaines Étapes

1. ✅ Structure API import données
2. ✅ Feature engineering
3. ✅ Scripts entraînement modèles
4. ⏳ Tests avec données réelles Euralis
5. ⏳ Optimisation hyperparamètres
6. ⏳ Pipeline CI/CD pour ré-entraînement automatique
7. ⏳ A/B testing des modèles
8. ⏳ Dashboard monitoring ML

## Ressources

- [PySR Documentation](https://astroautomata.com/PySR/)
- [Prophet Documentation](https://facebook.github.io/prophet/)
- [Scikit-learn](https://scikit-learn.org/)
