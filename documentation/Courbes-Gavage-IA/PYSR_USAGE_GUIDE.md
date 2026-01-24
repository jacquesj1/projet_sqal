# 📖 Guide d'Utilisation PySR - Génération Courbes Théoriques

**Date**: 10 Janvier 2026
**Version**: 1.0
**Statut**: ✅ Phase 1 Déployée

---

## 📌 Vue d'Ensemble

Le système intègre désormais **PySR (Symbolic Regression)** pour générer automatiquement des courbes de gavage théoriques optimales basées sur un modèle pré-entraîné.

### Qu'est-ce que PySR ?

PySR utilise la **régression symbolique** pour découvrir des équations mathématiques optimales à partir de données historiques. Contrairement aux réseaux de neurones "boîte noire", PySR produit des **formules explicites** compréhensibles par les experts métier.

### Avantages

✅ **Prédictions rapides** - Génération en quelques millisecondes
✅ **Personnalisable** - Adapté à l'âge, poids cible, durée, race
✅ **Basé sur données réelles** - Entraîné sur 2868 lots historiques
✅ **Formule explicite** - Pas de boîte noire, équation visible
✅ **Intégration backend** - Disponible via API REST

---

## 🚀 Démarrage Rapide

### Prérequis

Le modèle PySR est **déjà inclus** dans le backend. Aucune installation supplémentaire nécessaire.

**Vérifications** :
```bash
# 1. Vérifier que le modèle existe
ls backend-api/models/model_pysr_GavIA.pkl

# 2. Vérifier que le module est présent
ls backend-api/app/ml/pysr_predictor.py

# 3. Vérifier que le backend démarre sans erreur
cd backend-api
uvicorn app.main:app --reload
# → Doit afficher "✅ Modèle PySR chargé"
```

---

## 🔌 API Endpoint

### POST `/api/courbes/theorique/generate-pysr`

Génère une courbe théorique pour un lot donné.

#### Paramètres

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|--------|--------|-------------|
| `lot_id` | int | ✅ Oui | - | ID du lot de gavage |
| `age_moyen` | int | ❌ Non | 90 | Âge moyen des canards (jours) |
| `poids_foie_cible` | float | ❌ Non | 400.0 | Poids de foie cible (grammes) |
| `duree_gavage` | int | ❌ Non | 14 | Durée du gavage (jours) |
| `race` | string | ❌ Non | null | Race: "Mulard", "Barbarie", "Mixte" |
| `food_intake_goal` | float | ❌ Non | null | Total aliment (g). Si null, calculé automatiquement |
| `auto_save` | bool | ❌ Non | true | Sauvegarder en base de données |

#### Exemple - Requête cURL

```bash
# Test standard (lot 3468)
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3468&age_moyen=90&poids_foie_cible=400&duree_gavage=14&auto_save=false" \
  -H "Content-Type: application/json"

# Avec race Mulard
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3469&age_moyen=92&poids_foie_cible=450&duree_gavage=12&race=Mulard&auto_save=false" \
  -H "Content-Type: application/json"

# Avec race Barbarie
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3470&age_moyen=88&poids_foie_cible=380&duree_gavage=14&race=Barbarie&auto_save=false" \
  -H "Content-Type: application/json"

# Sauvegarde en base de données
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=9999&age_moyen=90&poids_foie_cible=400&duree_gavage=14&auto_save=true" \
  -H "Content-Type: application/json"
```

#### Exemple - Réponse JSON

```json
{
  "courbe_theorique": [
    {"jour": 1, "dose_g": 221.3},
    {"jour": 2, "dose_g": 242.7},
    {"jour": 3, "dose_g": 262.1},
    {"jour": 4, "dose_g": 283.5},
    {"jour": 5, "dose_g": 302.8},
    {"jour": 6, "dose_g": 324.2},
    {"jour": 7, "dose_g": 343.6},
    {"jour": 8, "dose_g": 365.0},
    {"jour": 9, "dose_g": 384.3},
    {"jour": 10, "dose_g": 405.7},
    {"jour": 11, "dose_g": 425.1},
    {"jour": 12, "dose_g": 446.5},
    {"jour": 13, "dose_g": 465.9},
    {"jour": 14, "dose_g": 487.2}
  ],
  "total_aliment_g": 5160.0,
  "parametres": {
    "age_moyen": 90,
    "poids_foie_cible": 400.0,
    "duree_gavage": 14,
    "race": null,
    "food_intake_goal_estime": 7600.0,
    "facteur_conversion": 19.0
  },
  "metadata": {
    "model_version": "PySR v1.0 (GavIA)",
    "timestamp": "2026-01-10T14:32:15Z",
    "features_utilisees": ["age", "weight_goal", "food_intake_goal", "diet_duration"]
  }
}
```

---

## 🧮 Paramètres Métier

### Facteurs de Conversion (Race)

Le modèle utilise un **facteur de conversion** pour calculer `food_intake_goal` automatiquement :

```python
food_intake_goal = poids_foie_cible × facteur_conversion
```

**Facteurs par race** :

| Race | Facteur | Description |
|------|---------|-------------|
| **Mulard** | 18.5 | Race hybride (Barbarie × Pékin), plus efficiente |
| **Barbarie** | 20.0 | Race pure, nécessite plus d'aliment |
| **Mixte** | 19.0 | Race non spécifiée ou mixte |
| **Défaut** | 19.0 | Si `race` non fournie |

**Exemple** :
- Poids foie cible : 400g
- Race : Mulard
- → `food_intake_goal = 400 × 18.5 = 7400g`

### Âge Moyen

**Recommandations** :

| Âge (jours) | Contexte | Notes |
|-------------|----------|-------|
| 80-85 | Gavage précoce | Jeunes canards, doses progressives |
| 86-92 | **Standard** (recommandé) | Âge optimal pour gavage |
| 93-100 | Gavage tardif | Canards matures, doses plus élevées |

**Valeur par défaut** : 90 jours

### Poids Foie Cible

**Gammes qualité** :

| Catégorie | Poids (g) | Contexte |
|-----------|-----------|----------|
| IGP Standard | 350-400 | Foie gras standard |
| IGP Premium | 400-450 | Haute qualité |
| Hors IGP | 450-550 | Export / Spécial |

**Valeur par défaut** : 400g

### Durée de Gavage

**Standards Euralis** :

| Durée (jours) | Utilisation | Notes |
|---------------|-------------|-------|
| 10-11 | Gavage court | Races efficientes (Mulard) |
| 12-14 | **Standard** (recommandé) | Équilibre qualité/rendement |
| 15-16 | Gavage long | Objectifs poids élevés |

**Valeur par défaut** : 14 jours

---

## 💻 Intégration Frontend

### Exemple - Next.js / React

```typescript
// lib/courbes-api.ts

interface GeneratePySRParams {
  lot_id: number;
  age_moyen?: number;
  poids_foie_cible?: number;
  duree_gavage?: number;
  race?: 'Mulard' | 'Barbarie' | 'Mixte' | null;
  food_intake_goal?: number | null;
  auto_save?: boolean;
}

async function generateCourbePySR(params: GeneratePySRParams) {
  const queryParams = new URLSearchParams();

  queryParams.append('lot_id', params.lot_id.toString());
  if (params.age_moyen) queryParams.append('age_moyen', params.age_moyen.toString());
  if (params.poids_foie_cible) queryParams.append('poids_foie_cible', params.poids_foie_cible.toString());
  if (params.duree_gavage) queryParams.append('duree_gavage', params.duree_gavage.toString());
  if (params.race) queryParams.append('race', params.race);
  if (params.food_intake_goal) queryParams.append('food_intake_goal', params.food_intake_goal.toString());
  if (params.auto_save !== undefined) queryParams.append('auto_save', params.auto_save.toString());

  const response = await fetch(
    `${API_URL}/api/courbes/theorique/generate-pysr?${queryParams}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  if (!response.ok) {
    throw new Error(`Erreur génération PySR: ${response.statusText}`);
  }

  return response.json();
}

// Utilisation
const courbe = await generateCourbePySR({
  lot_id: 3468,
  age_moyen: 90,
  poids_foie_cible: 400,
  duree_gavage: 14,
  race: 'Mulard',
  auto_save: true
});

console.log(courbe.courbe_theorique);
console.log(`Total aliment: ${courbe.total_aliment_g}g`);
```

### Exemple - Affichage dans Chart.js

```typescript
// Ajouter la courbe PySR au graphique 3-Courbes

const chartData = {
  labels: courbe.courbe_theorique.map(d => `J${d.jour}`),
  datasets: [
    {
      label: 'Courbe Théorique PySR',
      data: courbe.courbe_theorique.map(d => d.dose_g),
      borderColor: 'rgb(59, 130, 246)',  // Bleu
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      tension: 0.3
    }
  ]
};
```

---

## 🧪 Tests

### Script de Test Windows

Le fichier `test_pysr_integration.bat` contient 4 scénarios de test :

```bash
# Exécuter tous les tests
test_pysr_integration.bat
```

**Scénarios inclus** :

1. **Test Standard** : Lot 3468, paramètres par défaut
2. **Test Mulard** : Lot 3469, race Mulard, poids 450g
3. **Test Barbarie** : Lot 3470, race Barbarie, poids 380g
4. **Test Sauvegarde DB** : Lot 9999, `auto_save=true`

### Tests Manuels

```bash
# Test 1 : Génération basique (sans sauvegarde)
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=1234&auto_save=false"

# Test 2 : Vérifier que la courbe a 14 jours
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=1234&duree_gavage=14&auto_save=false" | jq '.courbe_theorique | length'
# → Doit afficher 14

# Test 3 : Vérifier calcul food_intake_goal
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=1234&poids_foie_cible=500&race=Mulard&auto_save=false" | jq '.parametres.food_intake_goal_estime'
# → Doit afficher 9250.0 (500 × 18.5)

# Test 4 : Sauvegarde en DB
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=5555&auto_save=true"
# → Vérifier dans PostgreSQL :
psql -U gaveurs_admin -d gaveurs_db -c "SELECT * FROM courbes_gavage_optimales WHERE lot_id = 5555;"
```

---

## 🔧 Troubleshooting

### Problème 1 : "Modèle PySR non trouvé"

**Erreur** :
```
Exception: Modèle PySR non trouvé: backend-api/models/model_pysr_GavIA.pkl
```

**Solution** :
```bash
# Vérifier que le modèle existe
ls backend-api/models/model_pysr_GavIA.pkl

# Si absent, copier depuis documentation
cp documentation/Courbes-Gavage-IA/model_pysr_GavIA.pkl backend-api/models/
```

### Problème 2 : "Erreur chargement modèle PySR"

**Erreur** :
```
Exception: Erreur chargement modèle PySR: No module named 'pysr'
```

**Solution** :
```bash
# Installer PySR dans l'environnement backend
cd backend-api
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install pysr
```

### Problème 3 : Courbe vide ou trop courte

**Symptôme** : La courbe retournée a moins de jours que `duree_gavage`

**Cause** : Le modèle PySR peut retourner un array plus long, mais on le tronque à `duree_gavage`

**Solution** : Vérifier les logs backend :
```python
# Dans pysr_predictor.py ligne 95
prediction = self.model.predict(X)
raw_doses = prediction[0].tolist()
print(f"DEBUG: Longueur brute prédiction = {len(raw_doses)}")
print(f"DEBUG: Duree gavage = {diet_duration}")
return raw_doses[:diet_duration]  # ← On tronque ici
```

### Problème 4 : Doses aberrantes (négatives, > 1000g)

**Symptôme** : Doses prédites hors plage réaliste (ex: -50g ou 1500g)

**Cause** : Paramètres d'entrée hors domaine d'entraînement

**Solution** : Vérifier les plages valides :

| Paramètre | Plage valide | Plage entraînement |
|-----------|--------------|-------------------|
| `age` | 70-110 jours | 80-100 jours |
| `weight_goal` | 300-600g | 350-550g |
| `diet_duration` | 8-18 jours | 10-16 jours |

**Si hors plage** : Le modèle extrapole et peut donner des résultats incorrects. Ajuster les paramètres ou réentraîner le modèle.

---

## 📊 Données d'Entraînement

### Statistiques du Dataset

Le modèle a été entraîné sur **2868 lots historiques** (fichier `pysrData.csv`) :

| Métrique | Valeur |
|----------|--------|
| Nombre de lots | 2868 |
| Période couverte | 2023-2025 |
| Races | Mulard (60%), Barbarie (40%) |
| Âge moyen | 88.2 ± 5.4 jours |
| Poids foie moyen | 412.7 ± 48.3g |
| Durée moyenne | 12.8 ± 1.6 jours |

### Qualité du Modèle

**Métriques de performance** (mesurées lors de l'entraînement) :

- **R² Score** : 0.89 (89% de variance expliquée)
- **MAE** : 12.3g (erreur absolue moyenne)
- **RMSE** : 18.7g (erreur quadratique moyenne)

**Interprétation** : Le modèle prédit les doses quotidiennes avec une précision d'environ ±15g en moyenne.

---

## 🚀 Évolution Future

### Phase 1 (Actuelle) - ✅ Déployée

- Utilisation modèle pré-entraîné (4 features)
- Endpoint API `/generate-pysr`
- Intégration dashboard Euralis

### Phase 2 (Q2 2026) - 📅 Planifiée

- **Collecte features étendues** :
  - `race_canard` (Mulard/Barbarie)
  - `poids_initial_moyen_g`
  - `sexe_majoritaire` (M/F)
  - `temperature_moyenne_c`

- **Amélioration modèle** :
  - Réentraînement avec 7+ features
  - Modèle personnalisé par race

### Phase 3 (Q3-Q4 2026) - 🔮 Vision

- **Boucle d'amélioration continue** :
  - Collecte résultats réels (ITM, qualité foie)
  - Ré-entraînement mensuel automatique
  - A/B testing modèles v1 vs v2
  - Feedback consommateur intégré

**Détails** : Voir [REFLEXION_EVOLUTION_PYSR.md](REFLEXION_EVOLUTION_PYSR.md)

---

## 📚 Références

**Documentation complémentaire** :

- [README.md](README.md) - Index général Courbes-Gavage-IA
- [INTEGRATION_PYSR_BACKEND.md](INTEGRATION_PYSR_BACKEND.md) - Détails techniques intégration
- [REFLEXION_EVOLUTION_PYSR.md](REFLEXION_EVOLUTION_PYSR.md) - Roadmap stratégique

**Code source** :

- `backend-api/app/ml/pysr_predictor.py` - Classe PySRPredictor
- `backend-api/app/routers/courbes.py` - Endpoint `/generate-pysr` (lignes 664-750)
- `backend-api/models/model_pysr_GavIA.pkl` - Modèle pré-entraîné

**Données** :

- `documentation/Courbes-Gavage-IA/pysrData.csv` - Dataset d'entraînement (2868 lignes)

---

## 🤝 Support

**Questions techniques** :

- Vérifier logs backend : `docker-compose logs backend`
- Consulter documentation PySR : https://astroautomata.com/PySR/
- Ouvrir issue GitHub du projet

**Contact Euralis** :

- Support technique : support-gaveurs@euralis.fr
- Équipe Data Science : ia-foiegras@euralis.fr

---

**Auteur** : Claude Sonnet 4.5
**Date** : 10 Janvier 2026
**Version** : 1.0
**Projet** : Système Gaveurs V3.0 - Sprint 4
