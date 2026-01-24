# Comment Vérifier l'Entraînement PySR

**Date**: 10 Janvier 2026

---

## Méthode 1: Vérifier si Modèle Créé

```bash
ls -lh backend-api/models/
```

**Résultat attendu** :
```
model_pysr_GavIA.pkl       (3.6 MB)  ← Ancien modèle v1
model_pysr_GavIA_v2.pkl    (??  MB)  ← Nouveau modèle v2 ✅
scaler_pysr_v2.pkl         (??  KB)  ← Normaliseur v2 ✅
```

Si les fichiers v2 sont présents → **TERMINÉ** ✅

---

## Méthode 2: Suivre Logs en Temps Réel

```bash
tail -f backend-api/retrain_pysr.log
```

**Ce que vous verrez** :
```
OK - 1819 enregistrements charges
OK - Dataset etendu: 30524 lignes (jour par jour)

=== ENTRAINEMENT PYSR ===
[ Info: Started!
Expressions evaluated per second: 4.95e+03
Hall of Fame:
  Complexity  Loss       Equation
  5           945.2      y = (64.95 * x₄) + 309.06
  ...

OK - Entrainement termine !
=== PERFORMANCE MODELE ===
MAE: 12.5g
RMSE: 18.3g
R²: 0.92

OK - Modele sauvegarde: .../model_pysr_GavIA_v2.pkl
OK - Scaler sauvegarde: .../scaler_pysr_v2.pkl
```

**Quand c'est terminé** : Vous verrez `OK - Modele sauvegarde`

---

## Méthode 3: Vérifier Processus en Cours

```bash
ps aux | grep retrain_pysr
```

**Si actif** : Ligne avec `python scripts/retrain_pysr_model.py`
**Si terminé** : Aucune ligne (ou seulement grep lui-même)

---

## Méthode 4: Voir Dernières Lignes des Logs

```bash
tail -30 backend-api/retrain_pysr.log
```

**Si encore en cours** :
```
17.3%┣███████▋        ┫ 104/600
```

**Si terminé avec succès** :
```
OK - Entrainement termine !
MAE: 12.5g
R²: 0.92
OK - Modele sauvegarde
```

**Si erreur** :
```
ERREUR: ...
Traceback ...
```

---

## Durée Estimée

Avec paramètres actuels (réduits pour vitesse) :
- **niterations**: 20
- **populations**: 10
- **timeout**: 5 minutes

**Temps total** : ~3-7 minutes (dépend CPU)

Avec paramètres production (100+ iterations) :
**Temps total** : ~15-30 minutes

---

## Après Entraînement Terminé

### 1. Vérifier Fichiers Créés

```bash
ls -lh backend-api/models/model_pysr_GavIA_v2.pkl
ls -lh backend-api/models/scaler_pysr_v2.pkl
```

### 2. Voir Performance du Modèle

```bash
grep -A 5 "PERFORMANCE MODELE" backend-api/retrain_pysr.log
```

**Attendu** :
```
MAE: 10-15g    ← Erreur absolue moyenne
RMSE: 15-20g   ← Erreur quadratique
R²: 0.85-0.95  ← Variance expliquée (90% = bon)
```

### 3. Voir Équation Générée

```bash
grep -A 3 "MEILLEURE EQUATION" backend-api/retrain_pysr.log
```

**Exemple** :
```
y = (64.95*x₄) + 309.07 + (x₂/x₃) - 0.014
```

### 4. Tester Prédiction

```bash
grep -A 10 "TEST PREDICTION" backend-api/retrain_pysr.log
```

**Attendu** :
```
Jour 1: 221.3g   ← Dose cohérente (200-300g)
Jour 2: 242.7g
...
Jour 14: 487.2g  ← Pas d'overflow !
```

---

## Que Faire Ensuite

### Si Entraînement Terminé avec Succès ✅

```bash
# 1. Mettre à jour pysr_predictor.py
# → Charger model_pysr_GavIA_v2.pkl + scaler_pysr_v2.pkl

# 2. Tester endpoint
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3468&age_moyen=90&poids_foie_cible=400&duree_gavage=14&auto_save=false"

# 3. Vérifier résultat cohérent (pas d'overflow)
```

### Si Erreur

```bash
# Voir erreur complète
cat backend-api/retrain_pysr.log

# Relancer avec logs visibles
cd backend-api
./venv/Scripts/python.exe scripts/retrain_pysr_model.py
```

---

## Commandes Rapides

```bash
# Tout-en-un : vérifier statut
cd backend-api && (
  echo "=== FICHIERS MODELES ==="
  ls -lh models/ 2>/dev/null || echo "Aucun"
  echo ""
  echo "=== PROCESSUS ACTIF ==="
  ps aux | grep retrain_pysr | grep -v grep || echo "Aucun"
  echo ""
  echo "=== DERNIERES LIGNES LOG ==="
  tail -10 retrain_pysr.log 2>/dev/null || echo "Pas de log"
)
```

---

**Auteur**: Claude Sonnet 4.5
**Date**: 10 Janvier 2026
