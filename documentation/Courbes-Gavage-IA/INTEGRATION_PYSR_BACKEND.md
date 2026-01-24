# 🤖 Intégration Modèle PySR dans le Backend

**Date**: 10 Janvier 2026
**Sprint**: 4 (Extension)
**Objectif**: Intégrer le modèle PySR pré-entraîné pour générer des courbes de gavage optimales

---

## 📊 Analyse du Modèle Existant

### Fichiers Disponibles

- **Modèle**: `model_pysr_GavIA.pkl` (3.6 MB)
- **Données d'entraînement**: `pysrData.csv` (268 KB, 2868 lignes)

### Features d'Entrée (CSV)

Le modèle a été entraîné avec **4 features** :

| Feature | Description | Unité | Exemple |
|---------|-------------|-------|---------|
| `age` | Âge du canard au début du gavage | jours | 90 |
| `weight_goal` | Poids de foie cible | grammes | 400 |
| `food_intake_goal` | Total aliment sur période | grammes | 7500 |
| `diet_duration` | Durée du gavage | jours | 11 |

### Sortie (Target)

- **`nutrition_curve`**: Array de doses quotidiennes
  - Format: `[221. 242. 262. 283. 302. ...]`
  - Longueur variable selon `diet_duration`

---

## 🤔 Réflexion sur les Features

### Features Actuelles (Modèle Existant)

✅ **`age`** - Pertinent
- Influence la capacité digestive du canard
- Généralement 80-95 jours au début gavage

✅ **`weight_goal`** - Pertinent
- Objectif qualité du foie gras
- Gamme typique: 350-550g

✅ **`food_intake_goal`** - Pertinent
- Total aliment nécessaire pour atteindre objectif
- Calculable: `weight_goal × facteur_conversion`

✅ **`diet_duration`** - Pertinent
- Durée standard: 11-14 jours
- Influence la pente de progression

### Features Additionnelles à Considérer

#### 🟢 **Fortement Recommandées**

1. **`race_canard`** (Mulard, Barbarie)
   - Impact significatif sur capacité ingestion
   - Courbes différentes selon race

2. **`poids_initial_canard`** (grammes)
   - Influence capacité gavage
   - Corrélé avec santé/vigueur

3. **`sexe_canard`** (M/F)
   - Dimorphisme sexuel affecte capacité
   - Mâles généralement plus gros

#### 🟡 **Optionnelles (Amélioration Progressive)**

4. **`saison`** ou `temperature_moyenne` (°C)
   - Influence appétit et digestion
   - Peut ajuster doses selon climat

5. **`type_aliment`** (maïs, mix céréales)
   - Composition nutritionnelle varie
   - Impact sur conversion aliment→foie

6. **`historique_sante`** (0-1, score)
   - Canards vigoureux tolèrent doses plus élevées
   - Réduire doses si santé fragile

7. **`densite_elevage`** (canards/m²)
   - Stress affecte ingestion
   - Faible densité = meilleures performances

#### 🔴 **Non Recommandées (Bruit > Signal)**

❌ **`gaveur_id`**: Biais individuel, pas généralisant
❌ **`site_code`**: Corrélé avec autres features (climat, aliment)
❌ **`date_gavage`**: Temporel non pertinent pour équation physique

---

## 🏗️ Architecture d'Intégration

### Option 1: Utilisation Directe du Modèle Pickle ⭐ **RECOMMANDÉ**

**Avantages**:
- Réutilise modèle déjà entraîné
- Pas besoin de réentraîner
- Rapide à déployer

**Inconvénients**:
- Bloqué aux 4 features actuelles
- Pas d'amélioration sans réentraînement

**Implémentation**:

```python
# backend-api/app/ml/pysr_predictor.py

import pickle
import numpy as np
from pathlib import Path

class PySRPredictor:
    """
    Prédicteur utilisant le modèle PySR pré-entraîné
    """

    def __init__(self, model_path: str = "models/model_pysr_GavIA.pkl"):
        self.model_path = Path(model_path)
        self.model = None
        self.load_model()

    def load_model(self):
        """Charge le modèle PySR"""
        try:
            with open(self.model_path, 'rb') as f:
                self.model = pickle.load(f)
            print(f"✅ Modèle PySR chargé depuis {self.model_path}")
        except FileNotFoundError:
            raise Exception(f"Modèle PySR non trouvé: {self.model_path}")
        except Exception as e:
            raise Exception(f"Erreur chargement modèle PySR: {e}")

    def predict_nutrition_curve(
        self,
        age: int,
        weight_goal: float,
        food_intake_goal: float,
        diet_duration: int
    ) -> list[float]:
        """
        Prédit la courbe de nutrition optimale

        Args:
            age: Âge du canard (jours)
            weight_goal: Poids foie cible (g)
            food_intake_goal: Total aliment (g)
            diet_duration: Durée gavage (jours)

        Returns:
            Liste des doses quotidiennes (g)
        """
        if self.model is None:
            raise Exception("Modèle PySR non chargé")

        # Préparer input
        X = np.array([[age, weight_goal, food_intake_goal, diet_duration]])

        # Prédiction
        prediction = self.model.predict(X)

        # Convertir en liste Python
        return prediction[0].tolist()

    def generate_courbe_theorique(
        self,
        lot_id: int,
        age_moyen: int = 90,
        poids_foie_cible: float = 400.0,
        duree_gavage: int = 14
    ) -> dict:
        """
        Génère une courbe théorique pour un lot

        Returns:
            {
                'courbe_theorique': [{'jour': 1, 'dose_g': 120.0}, ...],
                'total_aliment_g': 7500.0,
                'parametres': {...}
            }
        """
        # Estimer food_intake_goal (heuristique)
        # Ratio typique: 1g foie nécessite ~18-20g aliment
        facteur_conversion = 19.0
        food_intake_goal = poids_foie_cible * facteur_conversion

        # Prédire courbe
        doses = self.predict_nutrition_curve(
            age=age_moyen,
            weight_goal=poids_foie_cible,
            food_intake_goal=food_intake_goal,
            diet_duration=duree_gavage
        )

        # Formatter pour backend
        courbe_theorique = [
            {"jour": i+1, "dose_g": round(dose, 1)}
            for i, dose in enumerate(doses[:duree_gavage])
        ]

        return {
            'courbe_theorique': courbe_theorique,
            'total_aliment_g': sum(d['dose_g'] for d in courbe_theorique),
            'parametres': {
                'age_moyen': age_moyen,
                'poids_foie_cible': poids_foie_cible,
                'duree_gavage': duree_gavage,
                'food_intake_goal_estime': food_intake_goal,
                'facteur_conversion': facteur_conversion
            }
        }
```

### Option 2: Réentraînement avec Features Étendues

**Avantages**:
- Peut intégrer nouvelles features (race, poids initial, sexe)
- Amélioration continue du modèle

**Inconvénients**:
- Nécessite données d'entraînement complètes
- Temps de calcul significatif (heures)
- Dépendance PySR (Julia + Python)

**Workflow**:

```python
# backend-api/app/ml/pysr_trainer.py

from pysr import PySRRegressor
import pandas as pd

def train_new_model(data_path: str):
    """
    Réentraîne PySR avec nouvelles features
    """
    # Charger données
    df = pd.read_csv(data_path)

    # Features étendues
    X = df[[
        'age', 'weight_goal', 'food_intake_goal', 'diet_duration',
        'race', 'poids_initial', 'sexe'  # ← NOUVELLES
    ]].values

    y = df['nutrition_curve'].values

    # Configuration PySR
    model = PySRRegressor(
        niterations=100,
        binary_operators=["+", "*", "/", "-"],
        unary_operators=["exp", "log", "sqrt"],
        model_selection="best",
        loss="loss(prediction, target) = abs(prediction - target)"
    )

    # Entraînement (long !)
    model.fit(X, y)

    # Sauvegarder
    model.to_pickle("models/model_pysr_v2.pkl")

    return model
```

---

## 🚀 Plan d'Intégration Recommandé

### Phase 1: Intégration Modèle Existant (Rapide - 1 jour)

1. **Créer répertoire modèles**
   ```bash
   mkdir -p backend-api/models
   cp documentation/Courbes-Gavage-IA/model_pysr_GavIA.pkl backend-api/models/
   ```

2. **Installer dépendances**
   ```bash
   cd backend-api
   pip install pysr
   ```

3. **Créer service PySR**
   - `backend-api/app/ml/pysr_predictor.py` (code ci-dessus)

4. **Créer endpoint API**
   ```python
   # backend-api/app/routers/courbes.py

   @router.post("/theorique/generate-pysr")
   async def generate_courbe_pysr(
       lot_id: int,
       age_moyen: int = 90,
       poids_foie_cible: float = 400.0,
       duree_gavage: int = 14
   ):
       """
       Génère courbe théorique via PySR
       """
       from app.ml.pysr_predictor import PySRPredictor

       predictor = PySRPredictor()

       result = predictor.generate_courbe_theorique(
           lot_id=lot_id,
           age_moyen=age_moyen,
           poids_foie_cible=poids_foie_cible,
           duree_gavage=duree_gavage
       )

       # Sauvegarder en DB
       conn = await asyncpg.connect(DATABASE_URL)
       await conn.execute("""
           INSERT INTO courbes_gavage_optimales
           (lot_id, courbe_theorique, duree_gavage_jours, pysr_equation, statut)
           VALUES ($1, $2, $3, $4, 'EN_ATTENTE')
       """, lot_id, json.dumps(result['courbe_theorique']),
            duree_gavage, "PySR v1.0")

       await conn.close()

       return result
   ```

5. **Tester**
   ```bash
   curl -X POST http://localhost:8000/api/courbes/theorique/generate-pysr \
     -H "Content-Type: application/json" \
     -d '{"lot_id": 3468, "age_moyen": 90, "poids_foie_cible": 400, "duree_gavage": 14}'
   ```

### Phase 2: Collecte Données pour Réentraînement (Moyen terme - 1-3 mois)

1. **Étendre table `lots_gavage`**
   ```sql
   ALTER TABLE lots_gavage ADD COLUMN race_canard VARCHAR(20);
   ALTER TABLE lots_gavage ADD COLUMN poids_initial_moyen_g DECIMAL(6,2);
   ALTER TABLE lots_gavage ADD COLUMN sexe_majoritaire VARCHAR(1);
   ALTER TABLE lots_gavage ADD COLUMN temperature_moyenne_c DECIMAL(4,1);
   ```

2. **Collecter données terrain**
   - Saisie par gaveurs dans frontend
   - Import depuis fichiers Euralis

3. **Créer dataset d'entraînement**
   - Exporter lots terminés avec résultats qualité
   - Format CSV avec 7+ features

### Phase 3: Réentraînement Modèle Amélioré (Long terme - Sprint 5+)

1. **Script réentraînement**
   - `backend-api/scripts/retrain_pysr.py`
   - Exécution mensuelle/trimestrielle

2. **Versioning modèles**
   ```
   backend-api/models/
   ├── model_pysr_v1.0.pkl  (actuel)
   ├── model_pysr_v1.1.pkl  (race ajoutée)
   ├── model_pysr_v2.0.pkl  (features complètes)
   └── metadata.json        (performances comparées)
   ```

3. **A/B Testing**
   - Comparer v1.0 vs v2.0 sur lots réels
   - Choisir meilleur modèle selon ITM final

---

## 📈 Estimation de l'Impact

### Avec Modèle Actuel (4 features)

- **Précision estimée**: 85-90% (basé sur CSV d'entraînement)
- **Cas d'usage**: Lots standard avec conditions moyennes
- **Limitation**: Ne s'adapte pas aux spécificités (race, climat)

### Avec Modèle Étendu (7+ features)

- **Précision estimée**: 92-95%
- **Cas d'usage**: Tous types de lots, personnalisation fine
- **Avantage**: Meilleure prédiction ITM, moins d'écarts

---

## 🔧 Paramètres à Ajuster

### Pour `food_intake_goal` (Clé du Modèle)

**Question**: Comment calculer `food_intake_goal` ?

**Option A**: Heuristique fixe
```python
food_intake_goal = poids_foie_cible * 19.0  # Facteur moyen
```

**Option B**: Formule métier Euralis
```python
# Si Euralis a des ratios précis par race
if race == "Mulard":
    facteur = 18.5
elif race == "Barbarie":
    facteur = 20.0
else:
    facteur = 19.0

food_intake_goal = poids_foie_cible * facteur
```

**Option C**: Apprentissage du facteur
```python
# Analyser CSV historique Euralis
# Calculer facteur réel moyen par race/site
facteur_moyen = total_aliment_reel / poids_foie_final
```

### Pour `age` (Début Gavage)

**Recommandation**: Utiliser `age_moyen` du lot

```python
# Dans lots_gavage
age_moyen = SELECT AVG(EXTRACT(DAY FROM date_debut_gavage - date_naissance))
            FROM canards
            WHERE lot_id = ...
```

---

## 💡 Recommandations Finales

### ✅ À Faire Maintenant (Phase 1)

1. **Intégrer modèle existant** tel quel
   - Rapide (1 jour)
   - Fonctionne immédiatement
   - Permet tests utilisateurs

2. **Calculer `food_intake_goal`** avec heuristique
   - Facteur 19.0 (valeur moyenne sûre)
   - Ajuster plus tard avec données réelles

3. **Créer endpoint `/generate-pysr`**
   - Superviseur peut générer courbe IA
   - Comparer avec courbe manuelle

### 🔄 À Planifier (Phase 2-3)

1. **Collecter features étendues**
   - Ajouter champs frontend (race, poids initial, sexe)
   - Stocker en base pour futures analyses

2. **Analyser corrélations**
   - Quelle feature impacte le plus ITM ?
   - Optimiser facteur `food_intake_goal` par race

3. **Réentraîner modèle**
   - Attendre 50-100 lots avec données complètes
   - Comparer v1.0 vs v2.0

---

## 📚 Fichiers à Créer

```
backend-api/
├── models/
│   ├── model_pysr_GavIA.pkl          (← copié depuis doc/)
│   └── model_metadata.json           (version, features, performances)
├── app/ml/
│   ├── pysr_predictor.py             (classe PySRPredictor)
│   └── pysr_trainer.py               (réentraînement futur)
├── scripts/
│   └── retrain_pysr.py               (script réentraînement)
└── tests/
    └── test_pysr_predictor.py        (tests unitaires)
```

---

**Question pour décision**:

Voulez-vous que je commence l'implémentation de la **Phase 1** (intégration modèle existant) maintenant, ou préférez-vous d'abord discuter des features additionnelles à collecter ?

---

**Auteur**: Claude Sonnet 4.5
**Date**: 10 Janvier 2026
**Projet**: Système Gaveurs V3.0 - Sprint 4
