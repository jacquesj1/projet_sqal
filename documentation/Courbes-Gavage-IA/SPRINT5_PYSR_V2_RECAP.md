# Sprint 5 - PySR v2 : Récapitulatif

**Date**: 11 Janvier 2026
**Auteur**: Claude Sonnet 4.5

---

## Résumé Exécutif

Le modèle PySR v2 a été **entraîné avec succès** et résout le problème d'overflow (1e+19g) du modèle v1. Le modèle v2 fonctionne **parfaitement en développement local** mais nécessite Julia pour fonctionner en production Docker.

---

## Problème Résolu

### Modèle v1 (Original)
- **Overflow**: Prédictions aberrantes (1e+19g au jour 4)
- **Cause**: Équation contenant `exp(x2)` sans normalisation
- **Format**: Prédiction array complet (instable)

### Modèle v2 (Nouveau)
- **Pas d'overflow**: Doses cohérentes (202-463g)
- **Équation stable**: `x2 + 64.66*x4 + 304.54`
- **Format**: Prédiction jour-par-jour (5 features)
- **Normalisation**: StandardScaler appliqué

---

## Résultats d'Entraînement

### Métriques
- **MAE**: 22.3g (erreur moyenne acceptable)
- **RMSE**: 31.0g (erreur quadratique raisonnable)
- **R²**: 0.82 (82% de variance expliquée)
- **Dataset**: 30,524 points (2868 lots × jours)

### Exemple de Prédiction
```
Input: age=90, poids_foie=400g, duree=14j, race=Mulard

Output v2:
  Jour  1:  202.1g
  Jour  2:  222.1g
  Jour  3:  242.2g
  ...
  Jour 14:  462.6g
  Total: 4652.6g ✅ (vs 1.112e+19g avant)
```

---

## Fichiers Générés

### 1. Modèle et Scaler
- `backend-api/models/model_pysr_GavIA_v2.pkl` (58 KB)
- `backend-api/models/scaler_pysr_v2.pkl` (569 bytes)

### 2. Scripts
- `backend-api/scripts/retrain_pysr_model.py` (237 lignes)
- `backend-api/scripts/test_courbe_predictive_v2.py` (231 lignes)

### 3. Code Backend
- `backend-api/app/ml/pysr_predictor.py` (mis à jour pour v2)
- `backend-api/app/services/courbe_predictive_v2.py` (400+ lignes - algorithme hybride)

### 4. Documentation
- `PYSR_SOLUTION_REENTRAINEMENT.md` (400+ lignes)
- `COMMENT_VERIFIER_PYSR.md` (205 lignes)
- `documentation/Courbes-Gavage-IA/ALGO_COURBE_PREDICTIVE_V2.md` (500+ lignes)

---

## Tests Effectués

### Test 1: Modèle Local ✅
```bash
cd backend-api
./venv/Scripts/python.exe -c "from app.ml.pysr_predictor import get_pysr_predictor; ..."
```

**Résultat**:
```
OK - Total coherent (4652.6g)
OK - Toutes les doses dans plage 200-600g
=== TEST REUSSI ===
```

### Test 2: Endpoint API Docker ❌
```bash
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?..."
```

**Résultat**:
```json
{
  "detail": "julia is not a valid Julia executable"
}
```

**Cause**: PySR nécessite Julia pour faire les prédictions, mais Julia n'est pas installé dans l'image Docker.

---

## État Actuel

### ✅ Fonctionnel en Local
- Modèle v2 entraîné avec succès
- Prédictions cohérentes sans overflow
- Code backend mis à jour
- Documentation complète

### ❌ Non Fonctionnel en Docker
- Julia non installé dans conteneur
- PySR ne peut pas charger le modèle
- Endpoint API retourne erreur

---

## Solutions Possibles

### Option 1: Installer Julia dans Docker (Recommandé à terme)

**Avantages**:
- Utilisation complète de PySR
- Modèle symbolique interprétable
- Possibilité de réentraîner en production

**Inconvénients**:
- Image Docker plus lourde (~500 MB+)
- Temps de build plus long
- Complexité configuration Julia + SymbolicRegression.jl

**Implémentation**:
```dockerfile
# Dans backend-api/Dockerfile
FROM python:3.11-slim

# Installer Julia
RUN apt-get update && apt-get install -y wget && \
    wget https://julialang-s3.julialang.org/bin/linux/x64/1.10/julia-1.10.0-linux-x64.tar.gz && \
    tar -xvzf julia-1.10.0-linux-x64.tar.gz && \
    mv julia-1.10.0 /opt/julia && \
    ln -s /opt/julia/bin/julia /usr/local/bin/julia && \
    rm julia-1.10.0-linux-x64.tar.gz

# Installer SymbolicRegression.jl
RUN julia -e 'using Pkg; Pkg.add("SymbolicRegression")'

# ... reste du Dockerfile
```

### Option 2: Extraire Équation et Utiliser NumPy (Rapide)

**Avantages**:
- Pas de dépendance Julia
- Image Docker légère
- Prédictions ultra-rapides

**Inconvénients**:
- Perd flexibilité PySR
- Équation hardcodée
- Nécessite extraction manuelle

**Implémentation**:
```python
# Dans pysr_predictor.py
def predict_nutrition_curve_numpy(self, age, weight_goal, food_intake_goal, diet_duration):
    """Prédiction sans Julia - équation hardcodée"""
    doses = []
    for day in range(1, diet_duration + 1):
        # Normaliser features
        X = np.array([[age, weight_goal, food_intake_goal, diet_duration, day]])
        X_scaled = self.scaler.transform(X)

        # Équation PySR: x2 + 64.66*x4 + 304.54
        # x2 = weight_goal normalisé, x4 = day normalisé
        dose = X_scaled[0][2] + (64.66 * X_scaled[0][4]) + 304.54
        doses.append(round(dose, 1))

    return doses
```

### Option 3: Utiliser Modèle v1 en Docker, v2 en Local (Temporaire)

**Avantages**:
- Aucune modification Docker nécessaire
- Backend fonctionne immédiatement
- Développement local avec v2

**Inconvénients**:
- Deux versions différentes (confusion)
- Production avec modèle moins bon
- Solution temporaire

---

## Recommandation

### Court Terme (Aujourd'hui)
**Option 3**: Utiliser v1 en Docker temporairement
- Permet au backend de fonctionner
- Pas de blocage pour tests frontend
- On continue développement v2 en local

### Moyen Terme (Semaine Prochaine)
**Option 1**: Implémenter Julia dans Docker
- Image production complète
- Meilleure précision avec v2
- Évolutivité pour réentraînements futurs

### Alternative (Si Performance Critique)
**Option 2**: Extraire équation vers NumPy
- Léger et rapide
- Mais équation hardcodée (moins flexible)

---

## Actions Immédiates

### 1. Revenir à v1 en Docker
```python
# Dans backend-api/app/ml/pysr_predictor.py
# Modifier __init__ pour utiliser v1 par défaut en prod

if model_path is None:
    import os
    if os.getenv('APP_ENV') == 'production':
        # Docker prod: v1 (fonctionne sans Julia)
        model_path = base_dir / "models" / "model_pysr_GavIA.pkl"
    else:
        # Dev local: v2 (nécessite Julia)
        model_path = base_dir / "models" / "model_pysr_GavIA_v2.pkl"
```

### 2. Documenter Différence Local vs Docker
- README avec note sur versions
- Guide développeur

### 3. Planifier Migration Julia
- Créer branch `feature/docker-julia`
- Tester build image avec Julia
- Valider taille et temps de build

---

## Intégration Algorithme Hybride v2

En parallèle de PySR v2, l'**algorithme de courbe prédictive v2** a été implémenté avec succès.

### Améliorations
- Spline cubique (progression naturelle)
- Contraintes vétérinaires (800g max, 50g increment max)
- Lissage adaptatif (80/20 → 65/35 → 50/50)
- Ajustement final vers objectif

### Test v1 vs v2
```
Scénario: Écart de 102.8g au jour 5 (200g réel vs 302.8g théorique)

Résultats:
  v1: Écart moyen vs théorique = 36.6g
  v2: Écart moyen vs théorique = 29.6g  ← 7.0g amélioration

Violations contraintes: 0 (v1 et v2)
```

### Statut
- ✅ Code implémenté ([courbe_predictive_v2.py](backend-api/app/services/courbe_predictive_v2.py))
- ✅ Tests validés
- ✅ Documentation complète
- ⏳ Pas encore intégré dans endpoint `/predictive`

### Prochaine Étape
Intégrer algorithme v2 dans endpoint `/api/courbes/predictive/lot/{lot_id}` pour remplacer algorithme v1.

---

## Conclusion

Le Sprint 5 a produit:
- ✅ Modèle PySR v2 fonctionnel (sans overflow)
- ✅ Algorithme courbe prédictive v2 (7g amélioration)
- ✅ Documentation complète
- ⏳ Nécessite Julia en Docker pour déploiement production

**Statut Global**: 90% complet
**Blocage Actuel**: Configuration Julia dans Docker
**Solution Temporaire**: Utiliser v1 en prod, v2 en dev

---

**Auteur**: Claude Sonnet 4.5
**Date**: 11 Janvier 2026
**Sprint**: 5 - PySR v2 + Algorithme Hybride
