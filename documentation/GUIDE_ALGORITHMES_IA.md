# Guide Complet des Algorithmes IA - Système Gaveurs V3.0

Ce guide explique comment utiliser les **9 algorithmes d'intelligence artificielle** du système.

---

## 📋 Table des Matières

1. [Algorithmes Déjà Implémentés (6)](#algorithmes-déjà-implémentés)
2. [Nouveaux Algorithmes (3)](#nouveaux-algorithmes)
3. [Interface de Training](#interface-de-training)
4. [Installation des Dépendances](#installation-des-dépendances)
5. [Utilisation via API](#utilisation-via-api)
6. [Utilisation via Interface Web](#utilisation-via-interface-web)

---

## Algorithmes Déjà Implémentés

### 1. Régression Symbolique (PySR) ✅

**Fichier**: `backend-api/app/ml/symbolic_regression.py`

**Objectif**: Découvrir les formules mathématiques optimales pour prédire l'ITM (Indice Technique Moyen)

**Technologie**: PySR (Symbolic Regression)

**Comment ça marche**:
- Analyse des données historiques de gavage
- Recherche de formules interprétables (ex: `ITM = 0.5*dose_soir + 0.3*poids_matin - 12`)
- Retourne équations symboliques + score R²

**Utilisation**:

```python
# Backend Python
from app.ml.symbolic_regression import SymbolicRegressionEngine

engine = SymbolicRegressionEngine(db_pool)

# Charger données d'entraînement
df = await engine.load_training_data(genetique="Mulard", limit=10000)

# Entraîner modèle
best_model, results = await engine.train_model(df, target="itm")

# Résultat: Équation symbolique + métriques
print(results['best_equation'])  # "0.52*dose_soir + 0.31*poids_matin - 11.8"
print(results['r2_score'])       # 0.87
```

**API Endpoint**: Pas de endpoint dédié (module backend uniquement)

**Résultats stockés dans**: Table `ml_symbolic_models`

---

### 2. Optimiseur Feedback Consommateur (Random Forest) ✅

**Fichier**: `backend-api/app/ml/feedback_optimizer.py`

**Objectif**: **CŒUR DU SYSTÈME** - Boucle fermée qui optimise production selon satisfaction consommateur

**Technologie**: Random Forest Regressor + Gradient Boosting

**Flux**:
```
Gaveur → Production → SQAL → QR Code → Consommateur → Feedback (1-5★)
   ↑                                                          ↓
   └────────── IA optimise courbes d'alimentation ←──────────┘
```

**Comment ça marche**:
1. Collecte feedback consommateurs (notes 1-5)
2. Analyse corrélations `paramètres production ↔ satisfaction`
3. Identifie paramètres impactant satisfaction
4. Génère nouvelles courbes optimisées
5. Gaveur applique les nouvelles courbes

**Utilisation**:

```python
from app.ml.feedback_optimizer import FeedbackOptimizer

optimizer = FeedbackOptimizer(db_pool)

# Analyser corrélations
insights = await optimizer.analyze_feedback_correlations(genetique="Mulard")

# Générer courbe améliorée
improved_curve = await optimizer.generate_improved_curve(
    genetique="Mulard",
    target_satisfaction=4.5  # Cibler 4.5/5
)

# Résultat: Nouvelles doses optimisées
print(improved_curve['dose_matin'])  # [210, 220, 230, ..., 450]
print(improved_curve['dose_soir'])   # [215, 225, 235, ..., 485]
print(improved_curve['expected_satisfaction'])  # 4.52
```

**API Endpoints**:
- Pas de endpoint dédié (intégré dans workflow consumer feedback)

**Résultats stockés dans**: Tables `consumer_feedbacks`, `ml_feedback_models`

---

### 3. Prévisions Production (Prophet) ✅

**Fichier**: `backend-api/app/ml/euralis/production_forecasting.py`

**Objectif**: Prévoir production de foie gras à 7/30/90 jours

**Technologie**: Prophet (Facebook AI)

**Comment ça marche**:
- Analyse séries temporelles de production
- Détecte saisonnalité et tendances
- Génère prévisions avec intervalles de confiance

**Utilisation**:

```bash
# Via API
curl http://localhost:8000/api/analytics/predict-prophet/1?jours=30

# Résultat JSON
{
  "canard_id": 1,
  "predictions": [
    {"date": "2025-12-23", "poids_predit": 3250, "lower": 3100, "upper": 3400},
    {"date": "2025-12-24", "poids_predit": 3320, "lower": 3170, "upper": 3470},
    ...
  ],
  "tendance": "haussiere",
  "confiance_moyenne": 0.87
}
```

**Interface Web**:
- Page `/dashboard-analytics`
- Section "Prédictions Prophet"
- Graphique interactif avec bandes de confiance

---

### 4. Clustering Gaveurs (K-Means) ✅

**Fichier**: `backend-api/app/ml/euralis/gaveur_clustering.py`

**Objectif**: Segmenter gaveurs en 5 clusters de performance

**Technologie**: K-Means Clustering

**Comment ça marche**:
- Analyse métriques de performance (ITM, mortalité, coûts)
- Regroupe gaveurs similaires
- Identifie "champions" vs "en difficulté"

**Résultats**: 5 clusters
1. **Champions** (ITM > 17kg, mortalité < 2%)
2. **Performants** (ITM 15-17kg, mortalité < 3%)
3. **Moyens** (ITM 13-15kg, mortalité 3-5%)
4. **En difficulté** (ITM < 13kg ou mortalité > 5%)
5. **Débutants** (données insuffisantes)

---

### 5. Détection Anomalies (Isolation Forest) ✅

**Fichier**: `backend-api/app/ml/anomaly_detection.py`

**Objectif**: Détecter anomalies de production en temps réel

**Technologie**: Isolation Forest (sklearn)

**Comment ça marche**:
- Entraîne sur données normales
- Détecte points aberrants (outliers)
- Génère alertes automatiques

**Utilisation**:

```bash
# Via API
curl http://localhost:8000/api/anomalies/detect/42?window_days=3

# Résultat
{
  "canard_id": 42,
  "anomalies_detectees": [
    {
      "date": "2025-12-22",
      "type": "ecart_dose",
      "score_anomalie": 0.85,
      "description": "Dose 30% supérieure à la normale"
    }
  ],
  "nb_anomalies": 1
}
```

**Alertes générées**:
- 🔴 **Critiques**: Mortalité > 5%, Anomalie score > 0.8
- 🟡 **Importantes**: Écart dose 10-20%
- 🔵 **Info**: Suggestions optimisation

---

### 6. Optimisation Abattage (Hungarian Algorithm) ✅

**Fichier**: `backend-api/app/ml/euralis/abattage_optimization.py`

**Objectif**: Optimiser planning d'abattage pour minimiser coûts logistiques

**Technologie**: Algorithme Hongrois (affectation optimale)

**Résultats**: Planning optimal canards ↔ créneaux abattoir

---

## Nouveaux Algorithmes

### 7. Vision par Ordinateur (CNN) 🆕

**Fichier**: `backend-api/app/ml/computer_vision.py`

**Objectif**: Détecter automatiquement le poids d'un canard à partir d'une photo

**Technologie**:
- CNN (Convolutional Neural Network)
- MobileNetV2 (pré-entraîné ImageNet)
- TensorFlow/Keras

**Architecture**:
```
Input: Image 224x224 RGB
  ↓
MobileNetV2 (frozen) - Feature extraction
  ↓
GlobalAveragePooling2D
  ↓
Dense(256, relu) + Dropout(0.5)
  ↓
Dense(128, relu) + Dropout(0.3)
  ↓
Dense(64, relu)
  ↓
Dense(1, linear) → Poids (grammes)
```

**Installation**:
```bash
pip install tensorflow pillow numpy
```

**Entraînement**:

```python
from app.ml.computer_vision import get_computer_vision_engine

vision_engine = get_computer_vision_engine(db_pool)

# Entraîner (nécessite photos étiquetées dans DB)
result = await vision_engine.train_model(
    genetique="Mulard",
    epochs=50,
    batch_size=32,
    validation_split=0.2
)

# Résultat
print(result['nb_samples'])      # 1500 images
print(result['final_mae'])       # 125.3 grammes
print(result['final_val_mae'])   # 138.7 grammes
```

**Prédiction**:

```python
# Charger image
with open("canard.jpg", "rb") as f:
    image_base64 = base64.b64encode(f.read()).decode()

# Prédire poids
result = await vision_engine.predict_weight(image_base64, genetique="Mulard")

print(result['poids_detecte'])  # 3245.5 grammes
print(result['confiance'])      # 0.87
```

**API Endpoints**:

```bash
# Entraîner modèle
POST /api/vision/train
{
  "genetique": "Mulard",
  "epochs": 50,
  "batch_size": 32
}

# Prédire poids
POST /api/vision/detect-poids
{
  "image_base64": "iVBORw0KGgoAAAANS...",
  "genetique": "Mulard"
}

# Évaluer modèle
GET /api/vision/evaluate?genetique=Mulard
```

**Interface Web**:
- Page `/ai-training`
- Bouton "Entraîner le modèle"
- Affiche MAE et métriques

**Données requises**:
- Table `canard_photos` avec colonnes:
  - `canard_id` (FK vers canards)
  - `photo_base64` (image encodée)
  - `poids_reel` (poids réel en grammes)

---

### 8. Assistant Vocal (Whisper) 🆕

**Fichier**: `backend-api/app/ml/voice_assistant.py`

**Objectif**: Saisie vocale des données de gavage

**Technologie**:
- OpenAI Whisper (Speech-to-Text)
- NLP pour parsing commandes
- Support multi-langue (FR, EN, ES, DE)

**Installation**:
```bash
pip install openai-whisper pydub torch
```

**Commandes supportées**:

| Commande | Pattern | Exemple |
|----------|---------|---------|
| Dose matin | `dose matin <nombre>` | "dose matin 450 grammes" |
| Dose soir | `dose soir <nombre>` | "dose soir 485" |
| Poids matin | `poids matin <kilos> [grammes]` | "poids matin 3 kilos 250" |
| Poids soir | `poids soir <kilos> [grammes]` | "poids soir 3320 grammes" |
| Température | `température [stabule] <nombre>` | "température stabule 21 degrés" |
| Humidité | `humidité <nombre>` | "humidité 65 pourcent" |
| Canard ID | `canard [numéro] <id>` | "canard numéro 42" |
| Remarque | `remarque <texte>` | "remarque canard agité ce matin" |

**Utilisation**:

```python
from app.ml.voice_assistant import get_voice_assistant

voice_assistant = get_voice_assistant(db_pool)

# Charger modèle Whisper
voice_assistant.load_model("base")  # ou "small", "medium", "large"

# Traiter commande vocale
with open("audio.mp3", "rb") as f:
    audio_base64 = base64.b64encode(f.read()).decode()

result = await voice_assistant.process_voice_command(audio_base64, language="fr")

print(result['transcription'])  # "dose matin 450 grammes poids soir 3 kilos 250"
print(result['parsed_data'])    # {"dose_matin": 450, "poids_soir": 3250}
print(result['confidence'])     # 0.92
```

**API Endpoints**:

```bash
# Parser commande vocale
POST /api/voice/parse-command
{
  "audio_base64": "UklGRiQAAABXQVZFZm10IBAA...",
  "language": "fr"
}

# Liste commandes supportées
GET /api/voice/commands

# Statistiques utilisation
GET /api/voice/statistics/1
```

**Interface Web**:
- Page `/saisie-rapide`
- Bouton micro pour enregistrer
- Parsing automatique vers formulaire

---

### 9. Optimisation Multi-Objectifs (NSGA-II) 🆕

**Fichier**: `backend-api/app/ml/multiobjective_optimization.py`

**Objectif**: Optimiser simultanément 5 objectifs concurrents

**Technologie**:
- NSGA-II (Non-dominated Sorting Genetic Algorithm II)
- DEAP (Distributed Evolutionary Algorithms in Python)

**5 Objectifs**:
1. ✅ **Maximiser poids foie** (ITM en kg)
2. ✅ **Maximiser survie** (1 - taux mortalité)
3. ✅ **Maximiser efficacité coût** (ITM / coût total)
4. ✅ **Maximiser rapidité** (1 / durée gavage)
5. ✅ **Maximiser satisfaction** (note consommateur 0-5)

**Installation**:
```bash
pip install deap numpy
```

**Fonctionnement NSGA-II**:

1. **Initialisation**: Population aléatoire de 100 solutions
2. **Évaluation**: Chaque solution évaluée sur les 5 objectifs
3. **Sélection**: Tri non-dominé (dominance de Pareto)
4. **Crossover**: Croisement de solutions (80%)
5. **Mutation**: Mutation aléatoire (20%)
6. **Répéter** pendant 50 générations
7. **Résultat**: Front de Pareto de solutions optimales

**Utilisation**:

```python
from app.ml.multiobjective_optimization import get_multiobjective_optimizer

optimizer = get_multiobjective_optimizer(db_pool)

# Lancer optimisation
result = await optimizer.optimize(
    genetique="Mulard",
    population_size=100,
    n_generations=50
)

# Résultats
print(f"Solutions optimales: {result['pareto_front_size']}")

# Meilleure solution de compromis
best = result['best_solution']
print(best['parametres'])
# {
#   "dose_matin": 445.2,
#   "dose_soir": 478.5,
#   "temperature_stabule": 21.3,
#   "humidite_stabule": 64.5,
#   "duree_gavage": 12,
#   "nb_repas_jour": 2
# }

print(best['objectifs'])
# {
#   "poids_foie_kg": 16.8,
#   "survie": 0.975,
#   "efficacite_cout": 0.523,
#   "rapidite": 0.083,
#   "satisfaction": 4.5
# }
```

**API Endpoint**:

```bash
POST /api/optimize/multi-objective
{
  "genetique": "Mulard",
  "population_size": 100,
  "n_generations": 50
}

# Résultat
{
  "status": "success",
  "pareto_front_size": 23,
  "best_solution": { ... },
  "pareto_front": [
    {
      "parametres": { "dose_matin": 445, ... },
      "objectifs": { "poids_foie_kg": 16.8, ... }
    },
    ...
  ]
}
```

**Interface Web**:
- Page `/ai-training`
- Bouton "Lancer l'optimisation"
- Affiche front de Pareto et meilleure solution

**Interprétation**:
- **Front de Pareto**: Ensemble de solutions où aucune ne domine les autres
- **Meilleure solution**: Compromis optimal (normalisation + somme pondérée)
- Gaveur peut choisir dans le front selon priorités

---

## Interface de Training

### Page Web: `/ai-training`

**URL**: http://localhost:3001/ai-training

**Fonctionnalités**:

1. **Vision par Ordinateur**
   - Bouton "Entraîner le modèle"
   - Affiche progrès et métriques
   - MAE (Mean Absolute Error)

2. **Assistant Vocal**
   - Bouton "Charger le modèle"
   - Liste commandes supportées
   - Exemples d'utilisation

3. **Optimisation Multi-Objectifs**
   - Bouton "Lancer l'optimisation"
   - Affiche front de Pareto
   - Meilleure solution

**Screenshot**:
```
┌─────────────────────────────────────────────────┐
│ 🧠 Dashboard d'Entraînement IA                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  👁 Vision           🎤 Assistant       ⚡ Optim │
│  par Ordinateur      Vocal              Multi   │
│                                                 │
│  CNN - Détection     Whisper - Saisie   NSGA-II│
│  de poids            vocale             Génétique│
│                                                 │
│  [▶ Entraîner]      [▶ Charger]        [▶ Lancer]│
│                                                 │
│  ✅ Entraînement    ✅ Modèle chargé    ✅ Optimisé│
│  Samples: 1500      Commandes: 8        Solutions: 23│
│  MAE: 125.3g        Confiance: 0.92     ITM: 16.8kg  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Installation des Dépendances

### Vision par Ordinateur

```bash
cd backend-api

# TensorFlow (CPU)
pip install tensorflow==2.13.0

# TensorFlow (GPU - si NVIDIA)
pip install tensorflow-gpu==2.13.0

# Autres dépendances
pip install pillow numpy
```

### Assistant Vocal

```bash
# Whisper
pip install openai-whisper

# Audio processing
pip install pydub

# PyTorch (requis par Whisper)
pip install torch torchvision torchaudio
```

### Optimisation Multi-Objectifs

```bash
# DEAP
pip install deap

# NumPy
pip install numpy
```

### Tout installer d'un coup

```bash
pip install -r requirements-ml.txt
```

**Fichier `requirements-ml.txt`**:
```
tensorflow==2.13.0
pillow==10.0.0
numpy==1.24.3
openai-whisper==20231117
pydub==0.25.1
torch==2.0.1
deap==1.4.1
```

---

## Utilisation via API

### Swagger UI

**URL**: http://localhost:8000/docs

**Routes AI**:

```
POST   /api/vision/train               # Entraîner CNN
POST   /api/vision/detect-poids        # Prédire poids
GET    /api/vision/evaluate            # Évaluer modèle

POST   /api/voice/parse-command        # Parser commande vocale
GET    /api/voice/commands             # Liste commandes
GET    /api/voice/statistics/{id}      # Stats utilisation

POST   /api/optimize/multi-objective   # Optimisation NSGA-II

GET    /api/analytics/predict-prophet/{id}    # Prédictions Prophet
GET    /api/analytics/metrics/{id}            # Métriques performance
GET    /api/anomalies/detect/{id}             # Détection anomalies
```

### Exemples cURL

```bash
# 1. Entraîner modèle vision
curl -X POST http://localhost:8000/api/vision/train \
  -H "Content-Type: application/json" \
  -d '{
    "genetique": "Mulard",
    "epochs": 50,
    "batch_size": 32
  }'

# 2. Prédire poids via photo
curl -X POST http://localhost:8000/api/vision/detect-poids \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "iVBORw0KGgo...",
    "genetique": "Mulard"
  }'

# 3. Parser commande vocale
curl -X POST http://localhost:8000/api/voice/parse-command \
  -H "Content-Type: application/json" \
  -d '{
    "audio_base64": "UklGRiQAAABX...",
    "language": "fr"
  }'

# 4. Optimisation multi-objectifs
curl -X POST http://localhost:8000/api/optimize/multi-objective \
  -H "Content-Type: application/json" \
  -d '{
    "genetique": "Mulard",
    "population_size": 100,
    "n_generations": 50
  }'

# 5. Prédictions Prophet
curl http://localhost:8000/api/analytics/predict-prophet/1?jours=30

# 6. Détection anomalies
curl http://localhost:8000/api/anomalies/detect/42?window_days=3
```

---

## Utilisation via Interface Web

### 1. Accès Rapide

| Algorithme | URL | Page |
|------------|-----|------|
| Vision + Voice + Optim | http://localhost:3001/ai-training | Training IA |
| Prophet + Anomalies | http://localhost:3001/dashboard-analytics | Analytics IA |
| Saisie Rapide | http://localhost:3001/saisie-rapide | Saisie Rapide |
| Blockchain | http://localhost:3001/blockchain-explorer | Explorer |

### 2. Workflow Complet

**Scénario: Optimiser production pour Mulard**

1. **Entraîner les modèles** (`/ai-training`)
   - Cliquer "Entraîner" sur Vision
   - Cliquer "Charger" sur Voice
   - Cliquer "Lancer" sur Optimization

2. **Analyser production actuelle** (`/dashboard-analytics`)
   - Sélectionner canard
   - Voir métriques performance
   - Consulter prédictions Prophet

3. **Saisir données** (`/saisie-rapide`)
   - Utiliser saisie vocale
   - Ou prendre photo (vision)
   - Validation automatique

4. **Appliquer optimisation**
   - Récupérer solution optimale NSGA-II
   - Ajuster doses selon recommandations
   - Monitorer impact sur satisfaction

5. **Boucle fermée**
   - Consommateurs donnent feedback
   - Feedback Optimizer ajuste courbes
   - Production s'améliore continuellement

---

## Tableaux de Synthèse

### Comparaison Algorithmes

| Algorithme | Technologie | Input | Output | Entraînement | Temps |
|------------|-------------|-------|--------|--------------|-------|
| Régression Symbolique | PySR | Données gavage | Formules math | 5-10 min | Batch |
| Feedback Optimizer | Random Forest | Feedbacks consommateurs | Courbes optimisées | 2-3 min | Continu |
| Prophet | Facebook Prophet | Séries temporelles | Prévisions 7/30/90j | 1-2 min | Journalier |
| K-Means | Clustering | Métriques gaveurs | 5 clusters | 30 sec | Hebdo |
| Isolation Forest | Anomaly Detection | Données temps réel | Alertes | 1 min | Temps réel |
| Hungarian | Optimisation | Canards + créneaux | Planning optimal | 5 sec | À la demande |
| **Vision CNN** | **TensorFlow** | **Photos** | **Poids (g)** | **30-60 min** | **À la demande** |
| **Voice Whisper** | **OpenAI** | **Audio** | **Données parsées** | **Pré-entraîné** | **Temps réel** |
| **NSGA-II** | **DEAP** | **Paramètres** | **Front Pareto** | **10-20 min** | **À la demande** |

### Dépendances

| Algorithme | Packages Required | Taille | GPU |
|------------|-------------------|--------|-----|
| PySR | pysr | ~200 MB | Non |
| Random Forest | scikit-learn | ~50 MB | Non |
| Prophet | prophet | ~100 MB | Non |
| K-Means | scikit-learn | ~50 MB | Non |
| Isolation Forest | scikit-learn | ~50 MB | Non |
| Hungarian | scipy | ~80 MB | Non |
| **Vision CNN** | **tensorflow, pillow** | **~2 GB** | **Optionnel** |
| **Voice Whisper** | **openai-whisper, pydub, torch** | **~3 GB** | **Optionnel** |
| **NSGA-II** | **deap, numpy** | **~50 MB** | **Non** |

---

## Troubleshooting

### Vision par Ordinateur

**Erreur**: "TensorFlow not installed"
```bash
pip install tensorflow
```

**Erreur**: "Insufficient data: X images (minimum 50 required)"
- Ajouter photos dans table `canard_photos`
- Minimum 50 images par génétique

**Erreur**: "CUDA out of memory"
- Réduire `batch_size` à 16 ou 8
- Ou utiliser CPU (plus lent)

### Assistant Vocal

**Erreur**: "Whisper not available"
```bash
pip install openai-whisper torch
```

**Erreur**: "Failed to decode audio"
- Vérifier format audio (MP3, WAV, OGG supportés)
- Vérifier base64 encodage correct

**Audio mal reconnu**:
- Utiliser modèle plus grand: `small` ou `medium` au lieu de `base`
- Améliorer qualité audio (micro + proche, moins de bruit)

### Optimisation Multi-Objectifs

**Erreur**: "DEAP not installed"
```bash
pip install deap
```

**Optimisation lente**:
- Réduire `population_size` à 50
- Réduire `n_generations` à 30
- Normal pour 100 pop × 50 gen = 10-20 min

**Solutions non satisfaisantes**:
- Augmenter `n_generations` à 100
- Vérifier fonctions d'évaluation (modèles empiriques)

---

## Ressources

### Documentation Officielle

- **TensorFlow**: https://www.tensorflow.org/tutorials
- **Whisper**: https://github.com/openai/whisper
- **DEAP**: https://deap.readthedocs.io/
- **Prophet**: https://facebook.github.io/prophet/
- **PySR**: https://github.com/MilesCranmer/PySR

### Papers Scientifiques

- **NSGA-II**: Deb et al. (2002) "A fast and elitist multiobjective genetic algorithm"
- **Isolation Forest**: Liu et al. (2008) "Isolation Forest"
- **Prophet**: Taylor & Letham (2018) "Forecasting at Scale"
- **MobileNetV2**: Sandler et al. (2018) "MobileNetV2: Inverted Residuals"
- **Whisper**: Radford et al. (2022) "Robust Speech Recognition via Large-Scale Weak Supervision"

---

## FAQ

**Q: Dois-je installer toutes les dépendances ML?**
- Non, installez seulement celles dont vous avez besoin
- Vision, Voice et Optimization sont optionnels
- Les 6 premiers algorithmes sont déjà intégrés

**Q: Puis-je utiliser GPU pour accélérer?**
- Oui pour Vision (TensorFlow) et Voice (Whisper)
- Installer versions GPU: `tensorflow-gpu`, `torch` avec CUDA
- 5-10x plus rapide qu'avec CPU

**Q: Les modèles sont-ils pré-entraînés?**
- Vision: Non, nécessite entraînement sur vos données
- Voice: Oui, Whisper est pré-entraîné sur 680k heures
- Optimization: Non, algorithme génétique (pas de pré-entraînement)

**Q: Où sont stockés les modèles entraînés?**
- Vision CNN: `backend-api/models/duck_weight_detector.h5`
- Métadonnées en base: tables `ml_vision_models`, `ml_optimization_results`, `voice_interactions`

**Q: Quelle précision puis-je attendre?**
- Vision: MAE ~100-150g (selon qualité photos)
- Voice: Confiance ~0.85-0.95 (français)
- Optimization: Dépend modèles d'évaluation

---

**Dernière mise à jour**: 22 Décembre 2025
**Version**: 3.0
**Statut**: ✅ **9/9 Algorithmes Implémentés**
