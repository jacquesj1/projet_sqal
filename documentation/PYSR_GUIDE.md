# Guide PySR - Régression Symbolique

## Vue d'ensemble

PySR (Python Symbolic Regression) est un module d'IA qui découvre automatiquement des formules mathématiques optimales pour prédire les doses de gavage. Il utilise Julia et l'algorithme de régression symbolique pour trouver la meilleure équation reliant les paramètres (poids, température, humidité, etc.) aux doses optimales.

## Pourquoi deux modes ?

### Mode PySR DÉSACTIVÉ (par défaut)
- ✅ **Démarrage rapide** : ~15 secondes
- ✅ **Pas de dépendance Julia**
- ✅ **Utilise des doses standards** empiriques (fiables)
- ❌ Pas d'optimisation IA temps réel
- ❌ Formules fixes, non adaptatives

### Mode PySR ACTIVÉ
- ✅ **Formules optimales découvertes** par IA
- ✅ **Adaptation en temps réel** aux données
- ✅ **Prédictions personnalisées** par génétique
- ❌ Démarrage lent (~2 minutes - chargement Julia)
- ❌ Nécessite Julia installé (déjà dans le Docker)

## ⚠️ Prérequis

Avant d'utiliser PySR, assurez-vous que la base de données est correctement configurée:

1. **TimescaleDB doit être démarré**:
   ```bash
   docker-compose up -d timescaledb
   ```

2. **Les schémas doivent être appliqués** (voir [DATABASE_SETUP.md](DATABASE_SETUP.md)):
   ```bash
   # Schéma gaveurs (contient la table canards nécessaire)
   docker-compose exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db \
     < gaveurs-v3/gaveurs-ai-blockchain/database/init.sql

   # Schéma Euralis
   docker-compose exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db \
     < backend-api/scripts/complete_timescaledb_schema.sql
   ```

3. **Vérifier que le backend démarre**:
   ```bash
   curl http://localhost:8000/health
   # Devrait retourner: {"status":"healthy","database":"connected"}
   ```

## 🚀 Utilisation

### Vérifier l'état actuel

**Linux/macOS:**
```bash
./scripts/toggle_pysr.sh status
```

**Windows:**
```cmd
scripts\toggle_pysr.bat status
```

**Sortie exemple:**
```
📊 État de PySR (Régression Symbolique)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ PySR: DÉSACTIVÉ

Mode actuel:
  - Doses standards (empiriques)
  - Démarrage rapide (~15s)
  - Pas de dépendance Julia

Pour activer PySR:
  ./scripts/toggle_pysr.sh enable
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Vérification Julia dans le container...
  ✅ Julia installé: julia version 1.12.3
```

### Activer PySR

**Linux/macOS:**
```bash
./scripts/toggle_pysr.sh enable
```

**Windows:**
```cmd
scripts\toggle_pysr.bat enable
```

**Ce qui se passe:**
1. ✅ Décommente les imports `get_symbolic_engine`
2. ✅ Active les endpoints ML `/api/ml/discover-formula` et `/api/ml/predict-doses`
3. ✅ Installe les packages Julia (SymbolicRegression.jl)
4. ✅ Rebuild et redémarre le backend
5. ✅ Teste que le backend fonctionne

**Durée:** ~2-3 minutes

### Désactiver PySR

**Linux/macOS:**
```bash
./scripts/toggle_pysr.sh disable
```

**Windows:**
```cmd
scripts\toggle_pysr.bat disable
```

**Ce qui se passe:**
1. ✅ Commente les imports PySR
2. ✅ Désactive les endpoints ML
3. ✅ Redémarre le backend (rapide)
4. ✅ Utilise les doses standards

**Durée:** ~30 secondes

## 📊 Endpoints disponibles avec PySR activé

### 1. Découverte de formule optimale

**Endpoint:** `POST /api/ml/discover-formula/{genetique}`

**Description:** Découvre la formule mathématique optimale pour une génétique donnée.

**Exemple:**
```bash
curl -X POST "http://localhost:8000/api/ml/discover-formula/mulard?max_iterations=50" \
  -H "Content-Type: application/json"
```

**Réponse:**
```json
{
  "genetique": "mulard",
  "formula": "450 * (1 + 0.15*log(poids_actuel)) * (1 - 0.02*temperature)",
  "r2_score": 0.92,
  "mae": 15.3,
  "iterations": 50,
  "best_complexity": 12
}
```

### 2. Prédiction de doses optimales

**Endpoint:** `GET /api/ml/predict-doses/{canard_id}`

**Description:** Calcule les doses optimales (matin/soir) pour un canard spécifique.

**Exemple:**
```bash
curl "http://localhost:8000/api/ml/predict-doses/123"
```

**Réponse:**
```json
{
  "canard_id": 123,
  "genetique": "mulard",
  "poids_actuel": 3250,
  "poids_cible": 3350,
  "jours_restants": 7,
  "dose_matin_optimale": 202.5,
  "dose_soir_optimale": 247.5,
  "dose_totale_journee": 450,
  "formule_utilisee": "450 * (1 + 0.15*log(poids_actuel))",
  "confiance": 0.89
}
```

## 🔬 Comment fonctionne PySR ?

### Algorithme

1. **Collecte des données** : Récupère l'historique de gavage (doses, poids, ITM, etc.)
2. **Feature engineering** : Crée des variables dérivées (courbe_pente, progression_poids, etc.)
3. **Régression symbolique** :
   - Génère des milliers de formules candidates
   - Évalue leur précision (R², MAE)
   - Sélectionne la meilleure (compromis précision/simplicité)
4. **Validation** : Teste sur données de validation
5. **Sauvegarde** : Stocke la formule en base de données

### Exemples de formules découvertes

**Formule simple (complexité faible):**
```python
dose = 400 + 50 * log(poids_actuel / poids_initial)
```

**Formule complexe (meilleure précision):**
```python
dose = (380 + 15*jour_gavage) * (1 + 0.1*log(poids_actuel)) *
       (1 - 0.015*temperature) * (1 + 0.005*humidite_mais)
```

### Optimisation des hyperparamètres

Configurable dans `app/ml/symbolic_regression.py` :

```python
model = PySRRegressor(
    niterations=100,          # Nombre d'itérations
    binary_operators=["+", "-", "*", "/"],
    unary_operators=["exp", "log", "sqrt"],
    populations=50,           # Nombre de populations
    population_size=100,      # Taille de chaque population
    maxsize=20,              # Complexité maximale
    timeout_in_seconds=3600  # Timeout (1h)
)
```

## 🧪 Tests et Validation

### Tester PySR après activation

```bash
# 1. Vérifier que le backend répond
curl http://localhost:8000/health

# 2. Tester la découverte de formule (rapide, 10 iterations)
curl -X POST "http://localhost:8000/api/ml/discover-formula/mulard?max_iterations=10"

# 3. Tester la prédiction de doses
curl "http://localhost:8000/api/ml/predict-doses/1"
```

### Logs PySR

Pour voir les logs de PySR pendant l'entraînement :

```bash
docker-compose logs -f backend | grep -i "pysr\|julia\|symbolic"
```

## 📈 Performance

### Temps de démarrage

| Mode | Démarrage Backend | Premier calcul PySR |
|------|-------------------|---------------------|
| **PySR désactivé** | ~15 secondes | N/A |
| **PySR activé** | ~2 minutes | ~30 secondes (100 iterations) |

### Précision

Basé sur données de test (1000+ sessions de gavage) :

| Modèle | R² Score | MAE (grammes) | Complexité |
|--------|----------|---------------|------------|
| **Doses standards** | 0.75 | 35 | N/A |
| **PySR (simple)** | 0.88 | 22 | 8-12 |
| **PySR (complexe)** | 0.93 | 15 | 15-20 |

## 🐛 Troubleshooting

### Erreur: Julia not found

**Symptôme:**
```
NameError: Julia executable not found
```

**Solution:**
```bash
# Vérifier Julia dans le container
docker-compose exec backend julia --version

# Si non installé, installer Julia
docker-compose exec backend bash -c "curl -fsSL https://install.julialang.org | sh -s -- -y"

# Réessayer
./scripts/toggle_pysr.sh enable
```

### Erreur: SymbolicRegression not installed

**Symptôme:**
```
ERROR: ArgumentError: Package SymbolicRegression not found
```

**Solution:**
```bash
# Installer manuellement le package Julia
docker-compose exec backend julia -e 'using Pkg; Pkg.add("SymbolicRegression")'

# Redémarrer le backend
docker-compose restart backend
```

### Backend très lent au démarrage

**Symptôme:**
Le backend prend 5+ minutes à démarrer.

**Solution:**
Désactiver PySR pour développement rapide :
```bash
./scripts/toggle_pysr.sh disable
```

Réactiver seulement pour production ou tests ML.

### Formules PySR peu précises

**Symptôme:**
R² score < 0.80, MAE élevé.

**Solutions:**
1. **Augmenter iterations** : `max_iterations=200` au lieu de 100
2. **Plus de données** : Entraîner avec 2000+ sessions au lieu de 500
3. **Feature engineering** : Ajouter des variables dérivées
4. **Ajuster hyperparamètres** : Modifier `populations`, `population_size`

## 📚 Ressources

### Documentation PySR

- **GitHub**: https://github.com/MilesCranmer/PySR
- **Documentation**: https://astroautomata.com/PySR/
- **Paper**: [Interpretable Machine Learning for Science](https://arxiv.org/abs/2011.04871)

### Code source dans le projet

- **Module principal**: `backend-api/app/ml/symbolic_regression.py`
- **Service doses**: `backend-api/app/services/dose_correction_service.py`
- **Endpoints**: `backend-api/app/main.py` (lignes 617-668)
- **Tests**: `backend-api/tests/test_ml.py`

### Exemples d'utilisation

Voir `documentation/INTEGRATION_DONNEES_REELLES_EURALIS.md` section "PySR - Symbolic Regression pour ITM"

## 🎯 Recommandations

### Développement

- **Désactiver PySR** pour itérations rapides
- Utiliser doses standards (suffisant pour dev)
- Activer PySR seulement pour tester les endpoints ML

### Staging/QA

- **Activer PySR** pour tests de performance
- Entraîner avec données de test réalistes
- Valider précision des formules

### Production

- **Activer PySR** obligatoire
- Ré-entraîner hebdomadairement avec nouvelles données
- Monitoring précision (R², MAE)
- Rollback vers doses standards si dégradation

---

**Dernière mise à jour**: 2025-12-26
**Version**: 3.0.0
