# Sprint 5 - Build Docker Julia en Cours

**Date**: 11 Janvier 2026
**Statut**: BUILD EN COURS (5-15 min estimés)

---

## Ce qui est en train de se passer

Le build de l'image Docker avec support Julia pour PySR v2 est **en cours d'exécution**.

### Approche Finale (3ème essai)

Après avoir testé plusieurs stratégies, nous utilisons maintenant:

**Dockerfile.julia - Stratégie retenue**:
```dockerfile
FROM julia:1.9  # Image Julia officielle comme base

# Installer Python 3.11 + dépendances système
# Installer SymbolicRegression.jl (package Julia pour PySR)
# Installer requirements Python (FastAPI, PySR, etc.)
# Copier code application
```

### Pourquoi les 2 premières tentatives ont échoué

**Tentative 1**: Télécharger Julia depuis julialang-s3
- Problème: URLs 404 pour Julia 1.10.0, 1.11.2, 1.9.4
- Cause: Structure d'URLs changée ou versions obsolètes

**Tentative 2**: Multi-stage build (copier Julia depuis image officielle)
- Problème: Bibliothèques partagées manquantes (`libopenlibm.so` not found)
- Cause: Dépendances Julia incompatibles entre images Debian

**Tentative 3** (EN COURS): Partir de Julia, ajouter Python
- Avantage: Toutes les dépendances Julia déjà présentes
- Compatibilité: Même base Debian pour Julia et Python

---

## Étapes du Build en Cours

1. [x] Pull image julia:1.9 (~ 1 GB)
2. [x] Installer Python 3.11 + dev tools
3. [ ] Installer SymbolicRegression.jl (~ 5 min)
4. [ ] Installer requirements Python (~ 2 min)
5. [ ] Finaliser image

**Temps estimé total**: 10-15 minutes

---

## Progression Observée

```
#7 [ 2/11] RUN apt-get update && apt-get install -y ...
  - python3.11, python3.11-dev installés
  - build-essential, gcc, g++, gfortran installés
  - postgresql-client installé

État: Installation des dépendances Python en cours...
```

---

## Prochaines Étapes (Après Build)

### 1. Vérifier taille image

```bash
docker images | grep gaveurs-backend
```

**Attendu**: ~ 1.5-2 GB (vs 300 MB sans Julia)

### 2. Tester démarrage conteneur

```bash
docker-compose up -d backend
docker-compose logs -f backend
```

### 3. Valider Julia accessible

```bash
docker exec gaveurs_backend julia --version
# → julia version 1.9.x
```

### 4. Valider PySR fonctionne

```bash
docker exec gaveurs_backend python -c "import pysr; print(pysr.__version__)"
# → 0.x.x
```

### 5. Tester endpoint PySR v2

```bash
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3468&age_moyen=90&poids_foie_cible=400&duree_gavage=14&race=Mulard&auto_save=false"
```

**Attendu**:
```json
{
  "courbe_theorique": [
    {"jour": 1, "dose_g": 202.1},
    ...
    {"jour": 14, "dose_g": 462.6}
  ],
  "total_aliment_g": 4652.6,
  "metadata": {"modele_version": "v2.0"}
}
```

---

## Si le Build Réussit

Tout le Sprint 5 sera **100% FONCTIONNEL** :

- [x] Modèle PySR v2 entraîné (sans overflow)
- [x] Algorithme courbe prédictive v2 (amélioration 7g)
- [x] Code backend mis à jour
- [x] Documentation complète
- [x] Docker avec Julia installé
- [ ] Tests endpoint validés

---

## Si le Build Échoue

Solutions de repli disponibles:

### Option A: Fallback v1 temporaire

Modifier `pysr_predictor.py`:
```python
if os.getenv('APP_ENV') == 'production':
    model_path = "model_pysr_GavIA.pkl"  # v1
else:
    model_path = "model_pysr_GavIA_v2.pkl"  # v2
```

### Option B: NumPy pur (sans Julia)

Extraire équation PySR et coder en NumPy:
```python
# Équation: x2 + 64.66*x4 + 304.54
dose = X_scaled[0][2] + (64.66 * X_scaled[0][4]) + 304.54
```

---

## Fichiers Créés/Modifiés

- [backend-api/Dockerfile.julia](backend-api/Dockerfile.julia) - Nouveau Dockerfile avec Julia
- [docker-compose.yml](docker-compose.yml) - Modifié pour utiliser Dockerfile.julia
- [backend-api/models/model_pysr_GavIA_v2.pkl](backend-api/models/model_pysr_GavIA_v2.pkl) - Modèle v2 (58 KB)
- [backend-api/models/scaler_pysr_v2.pkl](backend-api/models/scaler_pysr_v2.pkl) - Scaler (569 bytes)
- [backend-api/app/ml/pysr_predictor.py](backend-api/app/ml/pysr_predictor.py) - Mis à jour pour v2

---

## Monitoring Build

### Voir logs en temps réel

```bash
tail -f build_julia_python.log
```

### Vérifier statut Docker

```bash
docker ps -a | grep backend
```

### Estimer temps restant

Le build total prend typiquement:
- 2-3 min: Téléchargement images
- 5-7 min: Installation SymbolicRegression.jl
- 2-3 min: Installation requirements Python
- **Total**: 10-15 minutes

---

**Statut actuel**: Compilation en cours...
**Prochaine vérification**: Dans 5 minutes
**Journal**: [build_julia_python.log](build_julia_python.log)

---

**Auteur**: Claude Sonnet 4.5
**Sprint**: 5 - PySR v2 + Julia Docker
