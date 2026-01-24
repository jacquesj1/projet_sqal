# Solution PySR dans Docker - Guide Complet

**Date**: 11 Janvier 2026

---

## Problème

Le modèle PySR v2 fonctionne en développement local mais échoue en Docker avec l'erreur:
```
julia is not a valid Julia executable
```

**Cause**: PySR nécessite Julia pour charger et utiliser les modèles symboliques.

---

## Solution 1: Fallback v1 en Production (Rapide - 5 min)

### Modifier pysr_predictor.py

Ajouter détection d'environnement pour utiliser v1 en Docker, v2 en local.

```python
# backend-api/app/ml/pysr_predictor.py
# Ligne 63-69

if model_path is None:
    base_dir = Path(__file__).parent.parent.parent

    # Détecter environnement
    import os
    app_env = os.getenv('APP_ENV', 'development')

    if app_env == 'production':
        # Docker prod: v1 (sans Julia)
        model_path = base_dir / "models" / "model_pysr_GavIA.pkl"
        scaler_path = None  # v1 n'a pas de scaler
        logger.info("Mode production: utilisation modele PySR v1 (sans Julia)")
    else:
        # Dev local: v2 (avec Julia)
        model_path = base_dir / "models" / "model_pysr_GavIA_v2.pkl"
        scaler_path = base_dir / "models" / "scaler_pysr_v2.pkl"
        logger.info("Mode developpement: utilisation modele PySR v2")
```

### Adapter load_model()

```python
def load_model(self):
    # Charger modèle
    with open(self.model_path, 'rb') as f:
        self.model = pickle.load(f)

    # Charger scaler si v2
    if self.scaler_path and self.scaler_path.exists():
        with open(self.scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        logger.info(f"OK - Modele PySR {self.model_version} + scaler charges")
    else:
        self.scaler = None
        logger.info(f"OK - Modele PySR {self.model_version} charge (sans scaler)")
```

### Adapter predict_nutrition_curve()

```python
def predict_nutrition_curve(self, age, weight_goal, food_intake_goal, diet_duration):
    if self.scaler is not None:
        # v2: Prédiction jour-par-jour avec normalisation
        doses = []
        for day in range(1, diet_duration + 1):
            X = np.array([[age, weight_goal, food_intake_goal, diet_duration, day]])
            X_scaled = self.scaler.transform(X)
            dose = self.model.predict(X_scaled)[0]
            doses.append(round(dose, 1))
        return doses
    else:
        # v1: Prédiction array complet
        X = np.array([[age, weight_goal, food_intake_goal, diet_duration]])
        prediction = self.model.predict(X)
        doses = prediction[0].tolist()[:diet_duration]
        return doses
```

### Redémarrer Backend

```bash
docker-compose restart backend
```

**Avantages**:
- ✅ Rapide (5 min)
- ✅ Pas de modification Docker
- ✅ Backend fonctionne immédiatement

**Inconvénients**:
- ❌ Production avec v1 (moins bon)
- ❌ Deux versions différentes

---

## Solution 2: Installer Julia dans Docker (Production - 1h)

### Créer Dockerfile.julia

```dockerfile
# backend-api/Dockerfile.julia
FROM python:3.11-slim

# Variables d'environnement
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    JULIA_VERSION=1.10.0

# Installer dépendances système
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    git \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Installer Julia
RUN wget https://julialang-s3.julialang.org/bin/linux/x64/1.10/julia-${JULIA_VERSION}-linux-x64.tar.gz && \
    tar -xvzf julia-${JULIA_VERSION}-linux-x64.tar.gz && \
    mv julia-${JULIA_VERSION} /opt/julia && \
    ln -s /opt/julia/bin/julia /usr/local/bin/julia && \
    rm julia-${JULIA_VERSION}-linux-x64.tar.gz

# Vérifier Julia installé
RUN julia --version

# Installer packages Julia
RUN julia -e 'using Pkg; Pkg.add("SymbolicRegression"); Pkg.precompile()'

# Créer répertoires
WORKDIR /app
RUN mkdir -p /app/logs /app/models

# Installer dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier code application
COPY ./app /app/app

# Exposer port
EXPOSE 8000

# Commande de démarrage
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Modifier docker-compose.yml

```yaml
# docker-compose.yml
services:
  backend:
    build:
      context: ./backend-api
      dockerfile: Dockerfile.julia  # Utiliser nouveau Dockerfile
    # ... reste identique
```

### Rebuild et Test

```bash
# Rebuild image (prend ~10-15 min)
docker-compose build backend

# Redémarrer
docker-compose up -d backend

# Tester
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3468&age_moyen=90&poids_foie_cible=400&duree_gavage=14&race=Mulard&auto_save=false"
```

**Avantages**:
- ✅ Production avec v2 (meilleur modèle)
- ✅ Même version dev/prod
- ✅ Possibilité réentraîner en prod

**Inconvénients**:
- ❌ Image plus lourde (~800 MB vs 300 MB)
- ❌ Build plus long (10-15 min)
- ❌ Maintenance Julia en plus

---

## Solution 3: Extraire Équation NumPy (Alternative)

### Analyser Équation PySR

```python
# backend-api/scripts/extract_pysr_equation.py
import pickle
import numpy as np

with open('models/model_pysr_GavIA_v2.pkl', 'rb') as f:
    model = pickle.load(f)

# Afficher équation symbolique
print("Équation PySR:")
print(model.sympy())

# Tester prédiction
X = np.array([[90, 400, 7600, 14, 1]])  # age, weight, food, duration, day
prediction = model.predict(X)
print(f"\nPrédiction: {prediction}")
```

### Implémenter Équation Pure NumPy

D'après les logs, l'équation est: `x2 + 64.66*x4 + 304.54`

```python
# backend-api/app/ml/pysr_predictor_numpy.py
import numpy as np
from sklearn.preprocessing import StandardScaler

class PySRPredictorNumPy:
    """
    Implémentation pure NumPy de l'équation PySR v2
    Ne nécessite pas Julia
    """

    def __init__(self, scaler_path):
        with open(scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)

    def predict_nutrition_curve(self, age, weight_goal, food_intake_goal, diet_duration):
        doses = []

        for day in range(1, diet_duration + 1):
            # Normaliser features
            X = np.array([[age, weight_goal, food_intake_goal, diet_duration, day]])
            X_scaled = self.scaler.transform(X)

            # Équation PySR: x2 + 64.66*x4 + 304.54
            # Indices: 0=age, 1=weight_goal, 2=food_intake, 3=duration, 4=day
            x2 = X_scaled[0][2]  # food_intake normalisé
            x4 = X_scaled[0][4]  # day normalisé

            dose = x2 + (64.66 * x4) + 304.54
            doses.append(round(dose, 1))

        return doses
```

**Avantages**:
- ✅ Pas de Julia nécessaire
- ✅ Image Docker légère
- ✅ Prédictions ultra-rapides

**Inconvénients**:
- ❌ Équation hardcodée (pas flexible)
- ❌ Si réentraînement, faut extraire nouvelle équation
- ❌ Perd pouvoir symbolique PySR

---

## Comparaison Solutions

| Critère | Solution 1 (Fallback v1) | Solution 2 (Julia Docker) | Solution 3 (NumPy) |
|---------|-------------------------|--------------------------|-------------------|
| **Temps implémentation** | 5 min | 1-2h | 30 min |
| **Taille image** | 300 MB | 800 MB | 300 MB |
| **Précision** | Moyenne (v1) | Excellente (v2) | Excellente (v2) |
| **Maintenance** | Facile | Moyenne (Julia) | Facile |
| **Réentraînement** | Possible | Possible | Manuel |
| **Flexibilité** | Haute | Haute | Basse |

---

## Recommandation

### Immédiat (Aujourd'hui)
**Solution 1**: Fallback v1 en production
- Permet tests frontend immédiatement
- Pas de blocage

### Court Terme (Cette Semaine)
**Solution 2**: Implémenter Julia dans Docker
- Production avec meilleur modèle
- Architecture complète

### Alternative (Si Contraintes)
**Solution 3**: NumPy pur
- Si taille image critique
- Si Julia pose problèmes

---

## Étapes d'Implémentation (Solution 2 Recommandée)

### 1. Créer Branch
```bash
git checkout -b feature/docker-julia
```

### 2. Créer Dockerfile.julia
Copier le Dockerfile proposé ci-dessus.

### 3. Tester Build Local
```bash
cd backend-api
docker build -f Dockerfile.julia -t gaveurs-backend-julia .
```

### 4. Tester Conteneur
```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_HOST=host.docker.internal \
  gaveurs-backend-julia
```

### 5. Valider Endpoint
```bash
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?..."
```

### 6. Merger si OK
```bash
git add backend-api/Dockerfile.julia docker-compose.yml
git commit -m "feat: Add Julia support for PySR v2 in Docker"
git push
```

---

## Monitoring Performance

### Métriques à Surveiller

**Taille Image**:
```bash
docker images | grep gaveurs-backend
# v1: ~300 MB
# v2 avec Julia: ~800 MB
```

**Temps Build**:
```bash
time docker-compose build backend
# v1: ~2-3 min
# v2 avec Julia: ~10-15 min
```

**Temps Prédiction**:
```python
import time
start = time.time()
result = predictor.generate_courbe_theorique(...)
elapsed = time.time() - start
print(f"Temps: {elapsed*1000:.1f}ms")
# v1: ~50-100ms
# v2: ~100-200ms
# NumPy pur: ~10-20ms
```

---

## Conclusion

Le modèle PySR v2 est prêt et fonctionne parfaitement en local. Pour le déployer en production Docker:

1. **Court terme**: Utiliser Solution 1 (fallback v1)
2. **Moyen terme**: Implémenter Solution 2 (Julia Docker)
3. **Alternative**: Solution 3 (NumPy pur) si contraintes

**Recommandation finale**: Solution 2 (Julia Docker) pour architecture production complète.

---

**Auteur**: Claude Sonnet 4.5
**Date**: 11 Janvier 2026
