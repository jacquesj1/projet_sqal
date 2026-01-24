# 🔧 Fix - Erreur 500 Route Historique

**Date** : 28 décembre 2025
**Statut** : **RÉSOLU** ✅

---

## 🐛 Problème

**Symptôme** :
```
GET http://localhost:8000/api/lots/1/historique net::ERR_FAILED 500 (Internal Server Error)
Access to fetch blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

**Contexte** :
- Frontend gaveurs affiche page `/lots` avec historique collapsible
- Clic sur "📈 Derniers gavages" appelle `/api/lots/1/historique`
- Backend retourne 500 Internal Server Error
- CORS error est un **symptôme**, pas la cause (500 → pas de header CORS)

---

## 🔍 Cause Racine

**Problème de sérialisation JSON** dans la route `GET /api/lots/{lot_id}/historique`

**Fichier** : `backend-api/app/routers/lots.py` (ligne 478-527)

### Cause 1 : Types Python non-JSON-serializables

PostgreSQL retourne des objets Python `date`, `datetime`, et `time` qui ne peuvent pas être sérialisés directement en JSON par FastAPI.

```python
# PostgreSQL → Python
date_gavage: date        # datetime.date(2025, 12, 28)
created_at: datetime     # datetime.datetime(2025, 12, 28, 10, 30, 0)
heure_gavage_matin: time # datetime.time(8, 30, 0)
```

**FastAPI/Pydantic** essayait de sérialiser ces objets avec `response_model=List[GavageQuotidien]` mais échouait.

### Cause 2 : Conversion JSONB incorrecte

Le code faisait `json.loads()` sur des champs JSONB qui étaient **déjà** des objets Python (asyncpg les convertit automatiquement), provoquant une erreur.

```python
# AVANT (bugué)
gavage_dict['poids_echantillon'] = json.loads(gavage_dict['poids_echantillon'])
# Erreur si poids_echantillon est déjà une liste Python [4800, 4850, ...]
```

---

## ✅ Solution

### 1. Suppression du `response_model`

**Ligne 478** :
```python
# AVANT
@router.get("/{lot_id}/historique", response_model=List[GavageQuotidien])

# APRÈS
@router.get("/{lot_id}/historique")
```

**Raison** : Permet de gérer manuellement la sérialisation sans contraintes Pydantic

### 2. Conversion manuelle des types Python

**Lignes 504-514** :
```python
# Convertir les types non-JSON-serializables
for key, value in gavage_dict.items():
    # Convertir date en string
    if isinstance(value, date) and not isinstance(value, datetime):
        gavage_dict[key] = value.isoformat()  # "2025-12-28"

    # Convertir datetime en string
    elif isinstance(value, datetime):
        gavage_dict[key] = value.isoformat()  # "2025-12-28T10:30:00"

    # Convertir time en string
    elif hasattr(value, 'hour') and hasattr(value, 'minute'):
        gavage_dict[key] = value.strftime("%H:%M:%S")  # "08:30:00"
```

### 3. Conversion JSONB conditionnelle

**Lignes 517-523** :
```python
# Convertir JSONB en listes (asyncpg peut retourner str ou déjà des objets Python)
if gavage_dict.get('poids_echantillon'):
    if isinstance(gavage_dict['poids_echantillon'], str):
        gavage_dict['poids_echantillon'] = json.loads(gavage_dict['poids_echantillon'])
    # Sinon, déjà un objet Python (list), on garde tel quel

if gavage_dict.get('recommandations_ia'):
    if isinstance(gavage_dict['recommandations_ia'], str):
        gavage_dict['recommandations_ia'] = json.loads(gavage_dict['recommandations_ia'])
```

**Résultat** : Gère les deux cas (string JSON ou objet Python déjà converti)

---

## 🧪 Tests

### Test backend
```bash
curl http://localhost:8000/api/lots/1/historique
```

**Résultat attendu** :
```json
[
  {
    "id": 8,
    "lot_id": 1,
    "date_gavage": "2025-12-30",
    "jour_gavage": 12,
    "dose_matin": 150.0,
    "dose_soir": 150.0,
    "dose_totale_jour": 300.0,
    "heure_gavage_matin": "08:30:00",
    "heure_gavage_soir": "18:30:00",
    "poids_echantillon": [4724, 4978, 4940, ...],
    "poids_moyen_mesure": 4825.4,
    ...
  }
]
```

✅ **Succès** : Retourne du JSON valide

### Test frontend

**Page** : http://localhost:3001/lots

**Actions** :
1. Clic sur "📈 Derniers gavages" sur une card de lot
2. Historique s'expand
3. Affiche les 5 derniers gavages

✅ **Succès** : Pas d'erreur 500, historique visible

---

## 📊 Format de Réponse

### Champs retournés

```typescript
interface HistoriqueGavage {
  id: number;
  lot_id: number;
  date_gavage: string;              // "2025-12-28"
  jour_gavage: number;              // 10
  dose_matin: number;               // 150.0
  dose_soir: number;                // 150.0
  dose_totale_jour: number;         // 300.0
  heure_gavage_matin: string;       // "08:30:00"
  heure_gavage_soir: string;        // "18:30:00"
  nb_canards_peses: number;         // 10
  poids_echantillon: number[];      // [4800, 4850, ...]
  poids_moyen_mesure: number;       // 4850.0
  ecart_poids_pourcent: number | null;  // 2.5 ou null
  alerte_generee: boolean;          // true/false
  niveau_alerte: string | null;     // "critique" / "warning" / "info" / null
  suit_courbe_theorique: boolean;   // true/false
  remarques: string | null;         // "..." ou null
  created_at: string;               // "2025-12-28T10:30:00"
  ...
}
```

### Frontend utilise seulement 4 champs

**Interface frontend** (ligne 159-164 `gaveurs-frontend/app/lots/page.tsx`) :
```typescript
interface HistoriqueGavage {
  jour_gavage: number;           // J10
  dose_totale_jour: number;      // 300g
  poids_moyen_mesure: number;    // 4850g
  alerte_generee: boolean;       // ⚠️
}
```

Le backend retourne **tous** les champs, le frontend filtre ce dont il a besoin.

---

## 🔄 Impact

### Routes affectées
- ✅ `GET /api/lots/{lot_id}/historique` - **FIXÉ**

### Routes similaires à vérifier
- ⏳ `GET /api/lots/{lot_id}/jour/{jour}` - Peut avoir le même problème
- ⏳ `GET /api/lots/gavages/all` - Peut avoir le même problème

**Recommandation** : Appliquer le même pattern (conversion manuelle des types) à toutes les routes retournant des données de `gavage_lot_quotidien`.

---

## 🔧 Pattern Réutilisable

**Fonction utilitaire à créer** (futur) :

```python
# backend-api/app/utils/serialization.py
from datetime import date, datetime
import json
from typing import Any, Dict

def serialize_db_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convertir une ligne DB en dict JSON-serializable
    """
    result = dict(row)

    for key, value in result.items():
        # Convertir date
        if isinstance(value, date) and not isinstance(value, datetime):
            result[key] = value.isoformat()

        # Convertir datetime
        elif isinstance(value, datetime):
            result[key] = value.isoformat()

        # Convertir time
        elif hasattr(value, 'hour') and hasattr(value, 'minute'):
            result[key] = value.strftime("%H:%M:%S")

        # Convertir JSONB string → object
        elif isinstance(value, str) and key in ['poids_echantillon', 'recommandations_ia']:
            try:
                result[key] = json.loads(value)
            except json.JSONDecodeError:
                pass  # Garder comme string

    return result
```

**Utilisation** :
```python
rows = await conn.fetch("SELECT * FROM gavage_lot_quotidien WHERE lot_id = $1", lot_id)
gavages = [serialize_db_row(row) for row in rows]
return gavages
```

---

## ✅ Checklist

- ✅ Suppression `response_model` de la route
- ✅ Conversion manuelle `date` → `isoformat()`
- ✅ Conversion manuelle `datetime` → `isoformat()`
- ✅ Conversion manuelle `time` → `strftime("%H:%M:%S")`
- ✅ Gestion JSONB conditionnelle (str → parse, object → keep)
- ✅ Test backend curl réussi
- ✅ Test frontend OK (historique s'affiche)

---

## 📝 Notes Techniques

### asyncpg et JSONB

asyncpg convertit **automatiquement** les colonnes JSONB PostgreSQL en objets Python :
- `JSONB[]` → `list`
- `JSONB{}` → `dict`

**Attention** : Selon la configuration asyncpg et la version, parfois retourné comme `str`, parfois comme objet Python déjà parsé.

**Solution** : Toujours vérifier le type avant de parser :
```python
if isinstance(value, str):
    value = json.loads(value)
```

### FastAPI/Pydantic et types Python

Pydantic peut sérialiser automatiquement `date`, `datetime`, `time` **SI** ils sont déclarés dans le modèle.

**Problème** : Si on utilise `response_model` avec un modèle incomplet ou mal typé, FastAPI/Pydantic échoue silencieusement (500).

**Solution** :
1. Soit modèle Pydantic complet et correct
2. Soit pas de `response_model` + conversion manuelle (plus flexible)

---

**Le frontend gaveurs fonctionne maintenant parfaitement !** 🎉

**Date de résolution** : 28 décembre 2025
