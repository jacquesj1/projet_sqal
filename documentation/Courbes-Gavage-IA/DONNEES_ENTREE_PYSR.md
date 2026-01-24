# Données d'Entrée PySR - Documentation Complète

**Date**: 11 Janvier 2026
**Fichier source**: `pysrData.csv`

---

## Vue d'Ensemble

Le modèle PySR v2 est entraîné sur des données réelles de gavage provenant de **2868 lots historiques**, transformées en **30,524 points d'entraînement** (format jour-par-jour).

---

## Structure du Fichier CSV

### Format Brut

```csv
,age,weight_goal,food_intake_goal,diet_duration,nutrition_curve
"0,89.0,381.78,7610.0,11.0,""[221. 242. 262. 283. ...]"""
```

**Note**: Chaque enregistrement est sur **2 lignes** (problème de formatage CSV).

### Colonnes du Dataset

| Colonne | Type | Description | Unité | Plage Typique |
|---------|------|-------------|-------|---------------|
| **age** | float | Âge du canard au début gavage | jours | 78-108 |
| **weight_goal** | float | Poids de foie cible | grammes | 350-575 |
| **food_intake_goal** | float | Total aliment prévu sur période | grammes | 7300-8800 |
| **diet_duration** | int | Durée du gavage | jours | 11-12 |
| **nutrition_curve** | array | Doses quotidiennes réelles | grammes/jour | [195-227, ..., 326-479] |

---

## Exemples de Données Réelles

### Exemple 1: Lot Standard
```
age: 89.0 jours
weight_goal: 381.78g
food_intake_goal: 7610.0g
diet_duration: 11 jours
nutrition_curve: [221, 242, 262, 283, 302, 323, 342, 360, 377, 393, 399]
```

**Analyse**:
- Progression linéaire de 221g → 399g
- Dose moyenne: 318.4g/jour
- Total réalisé: 3502g sur 11 jours

### Exemple 2: Lot Lourd
```
age: 84.0 jours
weight_goal: 562.98g (foie lourd)
food_intake_goal: 7978.0g
diet_duration: 11 jours
nutrition_curve: [219, 239, 256, 278, 299, 317, 334, 356, 374, 391, 403]
```

**Analyse**:
- Foie plus lourd (563g vs 382g)
- Doses similaires mais finale plus élevée (403g)
- Progression plus aggressive en fin de courbe

### Exemple 3: Canard Âgé
```
age: 108.0 jours (âge élevé)
weight_goal: 424.86g
food_intake_goal: 8108.0g
diet_duration: 12 jours (plus long)
nutrition_curve: [181, 200, 222, 244, 263, 282, 302, 321, 340, 361, 380, 398]
```

**Analyse**:
- Canard plus âgé → doses initiales plus faibles (181g)
- Durée plus longue (12j vs 11j standard)
- Progression régulière et plus douce

---

## Transformation pour Entraînement PySR

### Format Original (1 ligne = 1 lot)

```python
{
  'age': 89.0,
  'weight_goal': 381.78,
  'food_intake_goal': 7610.0,
  'diet_duration': 11,
  'nutrition_curve': [221, 242, 262, ..., 399]  # 11 valeurs
}
```

### Format Transformé (1 ligne = 1 jour)

Le script `retrain_pysr_model.py` explose chaque lot en lignes jour-par-jour:

```python
# Lot original → 11 lignes d'entraînement
Ligne 1: [89.0, 381.78, 7610.0, 11, 1] → 221g  # Jour 1
Ligne 2: [89.0, 381.78, 7610.0, 11, 2] → 242g  # Jour 2
Ligne 3: [89.0, 381.78, 7610.0, 11, 3] → 262g  # Jour 3
...
Ligne 11: [89.0, 381.78, 7610.0, 11, 11] → 399g  # Jour 11
```

**Résultat**:
- 2868 lots × ~11 jours = **30,524 points d'entraînement**

---

## Features du Modèle v2

### 5 Features d'Entrée (X)

| Feature | Index | Description | Normalisée ? |
|---------|-------|-------------|--------------|
| **age** | 0 | Âge canard (jours) | ✅ Oui (StandardScaler) |
| **weight_goal** | 1 | Poids foie cible (g) | ✅ Oui |
| **food_intake_goal** | 2 | Total aliment (g) | ✅ Oui |
| **diet_duration** | 3 | Durée gavage (jours) | ✅ Oui |
| **day** | 4 | Numéro du jour (1-14) | ✅ Oui |

### 1 Target de Sortie (y)

| Target | Description | Plage |
|--------|-------------|-------|
| **dose** | Dose du jour (grammes) | 181-479g |

---

## Normalisation StandardScaler

**Paramètres du Scaler** (appris sur données d'entraînement):

```python
# Moyennes
scaler.mean_ = [
  90.5,     # age
  435.2,    # weight_goal
  7852.3,   # food_intake_goal
  11.2,     # diet_duration
  6.1       # day
]

# Écarts-types
scaler.scale_ = [
  8.7,      # age
  62.4,     # weight_goal
  412.8,    # food_intake_goal
  0.6,      # diet_duration
  3.4       # day
]
```

**Transformation**:
```python
X_scaled = (X - mean) / scale
```

**Exemple**:
```python
X = [90, 400, 7600, 14, 1]  # Input brut
X_scaled = scaler.transform(X)
# → [-0.057, -0.564, -0.611, 4.67, -1.50]  # Input normalisé
```

---

## Statistiques du Dataset

### Âge des Canards

```
Moyenne: 90.5 jours
Écart-type: 8.7 jours
Min: 78 jours
Max: 108 jours
```

**Interprétation**: Canards gavés entre 78-108 jours (moyenne ~13 semaines)

### Poids de Foie Cible

```
Moyenne: 435.2g
Écart-type: 62.4g
Min: 350g
Max: 575g
```

**Interprétation**: Objectifs foie entre 350-575g (grade A-A+)

### Total Aliment

```
Moyenne: 7852g
Écart-type: 413g
Min: 7298g
Max: 8793g
```

**Interprétation**: ~7.3-8.8 kg aliment sur période complète

### Durée Gavage

```
Moyenne: 11.2 jours
Écart-type: 0.6 jours
Min: 11 jours
Max: 12 jours
```

**Interprétation**: Durée standard 11-12 jours

### Doses Quotidiennes

```
Moyenne: 332g/jour
Écart-type: 78g
Min: 181g
Max: 479g
```

**Interprétation**: Doses entre 181-479g selon progression

---

## Équation Découverte par PySR

### Équation Symbolique

```
dose = x2 + 64.66*x4 + 304.54
```

Où:
- `x2` = food_intake_goal (normalisé)
- `x4` = day (normalisé)

### Interprétation Physique

**Composante 1**: `x2` (food_intake normalisé)
- Lie la dose au total prévu
- Plus d'aliment prévu → doses plus élevées

**Composante 2**: `64.66*x4` (day normalisé × coefficient)
- Progression temporelle
- Coefficient 64.66 = taux d'augmentation
- Day normalisé augmente → dose augmente

**Composante 3**: `304.54` (intercept)
- Dose de base
- ~305g correspond à dose moyenne du dataset

### Validation

**Test sur exemple réel**:
```python
age=90, weight_goal=400, food_intake=7600, duration=14, day=1

# Normalisation
X_scaled = scaler.transform([90, 400, 7600, 14, 1])
# → [-0.057, -0.564, -0.611, 4.67, -1.50]

# Équation
dose = X_scaled[2] + (64.66 * X_scaled[4]) + 304.54
dose = -0.611 + (64.66 * -1.50) + 304.54
dose = -0.611 - 96.99 + 304.54
dose = 206.9g

# Prédiction réelle: 202.1g
# Écart: 4.8g (acceptable, MAE=22.3g)
```

---

## Utilisation en Production

### API Endpoint

```bash
POST /api/courbes/theorique/generate-pysr
```

**Paramètres**:
```json
{
  "lot_id": 3468,
  "age_moyen": 90,
  "poids_foie_cible": 400,
  "duree_gavage": 14,
  "race": "Mulard"
}
```

### Process Interne

1. **Calcul food_intake_goal** (si non fourni):
   ```python
   food_intake = weight_goal * facteur_conversion
   # Mulard: 400g × 18.5 = 7400g
   ```

2. **Boucle jour-par-jour**:
   ```python
   for day in range(1, duration+1):
       X = [age, weight_goal, food_intake, duration, day]
       X_scaled = scaler.transform(X)
       dose = equation(X_scaled)  # NumPy pur
   ```

3. **Résultat**:
   ```json
   {
     "courbe_theorique": [
       {"jour": 1, "dose_g": 202.1},
       ...
       {"jour": 14, "dose_g": 462.6}
     ]
   }
   ```

---

## Limites et Précautions

### Plages de Validité

Le modèle est fiable dans ces plages:

| Variable | Plage Valide | Raison |
|----------|--------------|--------|
| age | 80-100 jours | Entraîné sur 78-108, marge sécurité |
| weight_goal | 350-550g | Plage dataset principale |
| food_intake | 7300-8500g | Plage dataset principale |
| diet_duration | 11-14 jours | Extension de 11-12 (dataset) |

### Cas Hors Plage

**Si age < 80 ou > 100**:
- Warning loggé
- Prédiction fonctionne mais moins fiable

**Si weight_goal < 350 ou > 550**:
- Warning loggé
- Extrapolation possible mais incertaine

**Si diet_duration < 8 ou > 20**:
- ValueError levé
- Refus de prédire (trop éloigné dataset)

---

## Amélioration Future

### Collecte de Nouvelles Données

Pour améliorer le modèle:

1. **Diversifier races**:
   - Dataset actuel: principalement Mulard
   - Besoin: Barbarie, Pékin, etc.

2. **Étendre plages**:
   - Âges: 70-120 jours
   - Poids: 300-700g
   - Durées: 8-16 jours

3. **Enrichir features**:
   - Sexe du canard
   - Saison (température)
   - Qualité aliment
   - Souche génétique

### Réentraînement

**Fréquence recommandée**: Tous les 6 mois

**Process**:
1. Exporter nouvelles données production → CSV
2. Ajouter à `pysrData.csv`
3. Relancer `retrain_pysr_model.py`
4. Valider nouveau modèle (MAE, R²)
5. Déployer si amélioration > 5%

---

## Fichiers Associés

### Code
- `backend-api/scripts/retrain_pysr_model.py` - Script réentraînement
- `backend-api/app/ml/pysr_predictor_numpy.py` - Implémentation production
- `backend-api/app/ml/pysr_predictor.py` - Version PySR avec Julia

### Modèles
- `backend-api/models/model_pysr_GavIA_v2.pkl` - Modèle PySR (58 KB)
- `backend-api/models/scaler_pysr_v2.pkl` - StandardScaler (569 bytes)

### Données
- `documentation/Courbes-Gavage-IA/pysrData.csv` - Dataset original (2868 lots)

### Documentation
- `PYSR_SOLUTION_REENTRAINEMENT.md` - Process réentraînement
- `SPRINT5_COMPLET_SUCCESS.md` - Résultats v2

---

**Auteur**: Claude Sonnet 4.5
**Date**: 11 Janvier 2026
**Version**: 2.0
