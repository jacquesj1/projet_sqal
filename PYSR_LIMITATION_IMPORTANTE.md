# ⚠️ Limitation Importante - Modèle PySR

**Date**: 10 Janvier 2026
**Statut**: 🔴 **BLOQUANT**

---

## Problème Identifié

Le modèle PySR (`model_pysr_GavIA.pkl`) **ne fonctionne pas correctement** lors du chargement dans le backend.

### Symptômes

```python
# Prédiction avec:
age=90, weight_goal=400, food_intake_goal=7400, diet_duration=14

# Résultat obtenu:
Jour 1: 0.6g
Jour 2: 0.4g
Jour 3: 3.9g
Jour 4: 1.112e+19g  ← ABERRANT !!!
Jour 5: 2146.3g
...
```

**Total aliment**: 1.11e+19g (au lieu de ~7400g attendus)

### Warning Python

```
<lambdifygenerated-16>:2: RuntimeWarning: overflow encountered in exp
  return 0.227711568800143*exp(x2)
```

### Cause Probable

1. **Incompatibilité équation symbolique** : Le modèle PySR contient une équation avec `exp(x2)` qui déborde
2. **Normalisation manquante** : Les features ne sont probablement pas normalisées comme lors de l'entraînement
3. **Version PySR différente** : Le modèle a peut-être été créé avec une version différente de PySR

---

## Impact

🔴 **L'endpoint `/api/courbes/theorique/generate-pysr` ne peut pas être utilisé en production**

- Les courbes générées sont inutilisables
- Valeurs complètement aberrantes (doses > 1000g, overflow)
- Risque de crash backend si utilisé

---

## Solutions Possibles

### Solution 1: Réentraîner le Modèle (RECOMMANDÉ)

**Étapes**:
1. Récupérer le dataset d'entraînement (`pysrData.csv`)
2. Vérifier le script d'entraînement original
3. Réentraîner PySR avec:
   - Normalisation des features (StandardScaler)
   - Équations plus simples (limiter complexité)
   - Contraintes sur les opérateurs (éviter `exp` non borné)

**Avantages**:
- Solution pérenne
- Modèle fiable et contrôlé

**Inconvénients**:
- Nécessite accès au script d'entraînement original
- Temps de réentraînement (plusieurs heures)

---

### Solution 2: Algorithme Heuristique Temporaire (QUICK FIX)

En attendant le réentraînement, implémenter un algorithme heuristique basé sur les données.

**Approche**:
```python
def generate_courbe_heuristique(
    age_moyen: int,
    poids_foie_cible: float,
    duree_gavage: int,
    race: str
) -> List[float]:
    """
    Génère courbe théorique par heuristique métier
    """
    # Facteur conversion
    facteurs = {"Mulard": 18.5, "Barbarie": 20.0}
    facteur = facteurs.get(race, 19.0)

    # Total aliment nécessaire
    total_aliment = poids_foie_cible * facteur

    # Répartition progressive (courbe croissante)
    # Jour 1 : 60% de la moyenne
    # Jour final : 140% de la moyenne
    doses = []
    dose_moyenne = total_aliment / duree_gavage

    for j in range(duree_gavage):
        # Progression linéaire de 0.6 à 1.4
        facteur_jour = 0.6 + (0.8 * j / (duree_gavage - 1))
        dose = dose_moyenne * facteur_jour
        doses.append(round(dose, 1))

    # Ajuster pour atteindre exactement total_aliment
    diff = total_aliment - sum(doses)
    doses[-1] += round(diff, 1)

    return doses
```

**Avantages**:
- Implémentable immédiatement (15 min)
- Résultats cohérents et prévisibles
- Pas de dépendance PySR

**Inconvénients**:
- Moins précis qu'un vrai modèle ML
- Ne capture pas les patterns complexes

---

### Solution 3: Charger Modèle depuis Serveur Externe

Si Euralis a un serveur ML séparé avec le modèle PySR fonctionnel.

**Approche**:
```python
# Appel API externe
response = requests.post(
    "https://ml.euralis.internal/api/pysr/predict",
    json={
        "age": age_moyen,
        "weight_goal": poids_foie_cible,
        "food_intake_goal": food_intake_goal,
        "diet_duration": duree_gavage
    }
)
courbe = response.json()["doses"]
```

---

## Recommandation Immédiate

### Option A: Désactiver Endpoint (SAFE)

Commentaire l'endpoint dans `courbes.py` et retourner erreur 501 Not Implemented.

```python
@router.post("/theorique/generate-pysr")
async def generate_courbe_pysr(...):
    return JSONResponse(
        status_code=501,
        content={
            "error": "PySR model not available",
            "message": "Modèle PySR temporairement désactivé - voir PYSR_LIMITATION_IMPORTANTE.md"
        }
    )
```

### Option B: Implémenter Heuristique (QUICK FIX)

Remplacer l'appel PySR par l'algorithme heuristique ci-dessus dans `generate_courbe_theorique()`.

**Fichier à modifier**: `backend-api/app/ml/pysr_predictor.py`

```python
def generate_courbe_theorique(self, ...):
    # TEMPORAIRE - Heuristique en attendant modèle PySR fixé
    doses = self._generate_courbe_heuristique(
        age_moyen=age_moyen,
        poids_foie_cible=poids_foie_cible,
        duree_gavage=duree_gavage,
        race=race,
        food_intake_goal=food_intake_goal
    )

    # Formatter comme avant
    courbe_theorique = [...]
    return {
        ...
        'metadata': {
            'algorithme': 'Heuristique linéaire (PySR temporairement indisponible)',
            ...
        }
    }
```

---

## Actions Requises

### Immédiat (Aujourd'hui)

- [ ] **Décider**: Option A (désactiver) ou Option B (heuristique) ?
- [ ] Appliquer la solution choisie
- [ ] Tester endpoint modifié
- [ ] Mettre à jour documentation (`PYSR_USAGE_GUIDE.md`)

### Court Terme (Cette Semaine)

- [ ] Contacter créateur du modèle PySR original
- [ ] Récupérer script d'entraînement et paramètres exacts
- [ ] Analyser `pysrData.csv` pour comprendre normalisation

### Moyen Terme (2 Semaines)

- [ ] Réentraîner modèle PySR avec:
  - Normalisation explicite (StandardScaler)
  - Contraintes opérateurs (limiter exp, log)
  - Validation croisée pour vérifier pas d'overflow
- [ ] Tester nouveau modèle sur dataset complet
- [ ] Déployer modèle PySR v2.0

---

## Questions pour l'Équipe

1. **Qui a créé `model_pysr_GavIA.pkl` ?**
   - Quel script Python a été utilisé ?
   - Quels paramètres PySR (`niterations`, `binary_operators`, etc.) ?

2. **Les données étaient-elles normalisées ?**
   - StandardScaler ? MinMaxScaler ?
   - Fichier scaler sauvegardé quelque part ?

3. **Version PySR utilisée pour entraînement ?**
   - Actuelle : 0.18.1
   - Original : ?

4. **Existe-t-il un environnement où le modèle fonctionne ?**
   - Notebook Jupyter ?
   - Script Python standalone ?
   - Serveur ML dédié ?

---

## Logs d'Erreur

### Test Effectué

```bash
cd backend-api
./venv/Scripts/python.exe -c "
from app.ml.pysr_predictor import get_pysr_predictor

predictor = get_pysr_predictor()
result = predictor.generate_courbe_theorique(
    lot_id=3468,
    age_moyen=90,
    poids_foie_cible=400.0,
    duree_gavage=14,
    race='Mulard'
)
print(result)
"
```

### Résultat

```
<lambdifygenerated-16>:2: RuntimeWarning: overflow encountered in exp
  return 0.227711568800143*exp(x2)

{
  "courbe_theorique": [
    {"jour": 1, "dose_g": 0.6},
    {"jour": 2, "dose_g": 0.4},
    {"jour": 3, "dose_g": 3.9},
    {"jour": 4, "dose_g": 1.112e+19},  ← OVERFLOW !!!
    ...
  ],
  "total_aliment_g": 1.112e+19
}
```

---

## Conclusion Temporaire

**Le modèle PySR ne peut PAS être utilisé en l'état.**

Deux choix:
1. **Désactiver** l'endpoint en attendant modèle fixé
2. **Implémenter heuristique** temporaire pour continuer Sprint 4

Je recommande **Option B** (heuristique) pour permettre démo client avec fonctionnalité dégradée mais fonctionnelle.

---

**Auteur**: Claude Sonnet 4.5
**Date**: 10 Janvier 2026
**Priorité**: 🔴 HAUTE
**Status**: En attente décision
