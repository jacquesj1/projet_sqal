# Problème WindowsPath - Solution

**Date**: 11 Janvier 2026
**Statut**: RÉSOLU en cours

---

## Problème Identifié

Lors du test de l'endpoint PySR v2 dans Docker :

```
Erreur: cannot instantiate 'WindowsPath' on your system
```

### Cause Racine

Le modèle PySR v2 (`model_pysr_GavIA_v2.pkl`) a été entraîné sur **Windows** et le fichier pickle contient des objets `WindowsPath` de la bibliothèque `pathlib`.

Quand on essaie de charger ce pickle sous **Linux** (Docker), Python ne peut pas instancier `WindowsPath` car ce type n'existe que sur Windows.

### Détails Techniques

```python
# Sur Windows (lors de l'entraînement)
from pathlib import Path
model_path = Path("D:\\GavAI\\...")  # Crée WindowsPath

# Sauvegarde dans pickle
pickle.dump(model, f)  # WindowsPath sérialisé dans le fichier

# Sur Linux (Docker)
model = pickle.load(f)  # ERREUR: WindowsPath n'existe pas sur Linux
```

---

## Solution Implémentée

### Réentraîner le Modèle dans Docker

Commande lancée :
```bash
docker exec gaveurs_backend python /app/app/../scripts/retrain_pysr_model.py
```

**Avantages** :
- Modèle entraîné sur même OS que production (Linux)
- Pas de problème WindowsPath/PosixPath
- Garantit compatibilité totale

**Temps estimé** : 5-10 minutes

---

## Solutions Alternatives (si besoin)

### Option 1: Patcher le Script d'Entraînement

Modifier `retrain_pysr_model.py` pour utiliser `PurePath` au lieu de `Path` :

```python
from pathlib import PurePath

# Au lieu de
MODEL_PATH = BASE_DIR / "models" / "model_pysr_GavIA_v2.pkl"

# Utiliser
MODEL_PATH = str(PurePath(BASE_DIR) / "models" / "model_pysr_GavIA_v2.pkl")
```

### Option 2: Convertir Pickle Windows → Linux

Script de conversion :

```python
import pickle
import sys
from pathlib import PosixPath, WindowsPath

class PathUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module == "pathlib" and name == "WindowsPath":
            return PosixPath
        return super().find_class(module, name)

# Charger modèle Windows
with open('model_pysr_GavIA_v2.pkl', 'rb') as f:
    model = PathUnpickler(f).load()

# Sauvegarder pour Linux
with open('model_pysr_GavIA_v2_linux.pkl', 'wb') as f:
    pickle.dump(model, f)
```

### Option 3: Utiliser Chemins Relatifs String

Dans `pysr_predictor.py`, toujours convertir Path en string :

```python
# Au lieu de
self.model_path = Path(model_path)

# Utiliser
self.model_path = str(model_path) if isinstance(model_path, Path) else model_path
```

---

## Vérification Post-Entraînement

Une fois le réentraînement terminé dans Docker :

### 1. Vérifier Fichiers Créés

```bash
docker exec gaveurs_backend ls -lh /app/models/
# → model_pysr_GavIA_v2.pkl (Linux-compatible)
# → scaler_pysr_v2.pkl (Linux-compatible)
```

### 2. Tester Chargement

```bash
docker exec gaveurs_backend python -c "
import pickle
with open('/app/models/model_pysr_GavIA_v2.pkl', 'rb') as f:
    model = pickle.load(f)
print('Modèle chargé avec succès')
"
```

### 3. Tester Endpoint

```bash
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3468&age_moyen=90&poids_foie_cible=400&duree_gavage=14&race=Mulard&auto_save=false"
```

**Attendu** :
```json
{
  "courbe_theorique": [...],
  "total_aliment_g": 4652.6,
  "metadata": {"modele_version": "v2.0"}
}
```

---

## Prévention Future

### Bonnes Pratiques

1. **Toujours entraîner sur l'OS de production**
   - Si prod = Linux → entraîner dans Docker
   - Si prod = Windows → entraîner sur Windows

2. **Utiliser chemins string dans pickle**
   ```python
   # Avant sauvegarde
   model.path = str(model.path)  # Convertir Path → string
   ```

3. **Tester compatibilité cross-platform**
   ```python
   # Ajouter dans tests
   def test_model_loads_on_linux():
       with open('model.pkl', 'rb') as f:
           model = pickle.load(f)  # Doit fonctionner
   ```

4. **Documenter OS d'entraînement**
   ```python
   import platform
   metadata = {
       'os': platform.system(),
       'python_version': sys.version,
       'trained_at': datetime.now()
   }
   ```

---

## Leçon Apprise

Le problème n'est PAS spécifique à PySR mais général à **pickle + pathlib + cross-platform**.

**Toujours** entraîner les modèles ML sur le même OS que la production, ou éviter d'inclure des objets Path dans les pickles.

---

## Statut Actuel

- [x] Problème identifié
- [x] Solution lancée (réentraînement Docker)
- [ ] Attente fin réentraînement (5-10 min)
- [ ] Test endpoint
- [ ] Validation finale

**Prochaine action** : Attendre logs du réentraînement Docker

---

**Auteur**: Claude Sonnet 4.5
**Date**: 11 Janvier 2026
