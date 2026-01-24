# 🔧 Fix Erreurs Backend Euralis - 27 Décembre 2025

## ❌ Problèmes Rencontrés

Lors de l'accès au dashboard Euralis (`http://localhost:3000/euralis/dashboard`), plusieurs erreurs se produisaient :

### 1. Erreurs CORS
```
Access to fetch at 'http://localhost:8000/api/euralis/dashboard/kpis' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

### 2. Erreurs 500 Internal Server Error
- `GET /api/euralis/dashboard/kpis` → 500
- `GET /api/euralis/alertes` → 500
- `GET /api/euralis/sites` → 500

---

## 🔍 Causes Identifiées

### 1. Mauvaise Configuration Database URL
**Fichier** : [backend-api/app/routers/euralis.py](backend-api/app/routers/euralis.py:20-23)

**Problème** :
```python
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/gaveurs_db')
```

Le router Euralis utilisait `localhost:5432` par défaut, mais le backend tourne dans Docker et doit se connecter à `timescaledb:5432` (nom du service Docker).

**Erreur logs** :
```
ConnectionRefusedError: [Errno 111] Connection refused
```

### 2. Colonnes Database Incorrectes

Le code utilisait des noms de colonnes qui n'existent pas dans la base de données :

#### Problème A : Table `lots_gavage`
**Code erroné** :
```python
SUM(nb_canards_accroches * itm / 1000) as production_totale_kg
```

**Erreur** :
```
asyncpg.exceptions.UndefinedColumnError: column "nb_canards_accroches" does not exist
```

**Colonne réelle** : `nb_accroches` (sans `_canards`)

#### Problème B : Table `alertes_euralis`
**Code erroné** :
```python
WHERE severite = 'critique'
```

**Erreur** :
```
asyncpg.exceptions.UndefinedColumnError: column "severite" does not exist
```

**Colonnes réelles** :
- `criticite` au lieu de `severite`
- `titre` au lieu de `message`
- `description` au lieu de `message`
- Pas de colonne `niveau`

### 3. Modèle Pydantic Incorrect

La classe `Alerte` utilisait des champs qui ne correspondaient pas au schéma de la table `alertes_euralis`.

---

## ✅ Solutions Appliquées

### 1. Fix Database URL

**Modification** : [backend-api/app/routers/euralis.py](backend-api/app/routers/euralis.py:20-23)

```python
# AVANT
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/gaveurs_db')

# APRÈS
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://gaveurs_admin:gaveurs_secure_2024@timescaledb:5432/gaveurs_db'
)
```

**Aussi ajouté** : [backend-api/app/routers/euralis.py](backend-api/app/routers/euralis.py:99)

```python
# Disable SSL for Docker internal connections
conn = await asyncpg.connect(DATABASE_URL, ssl=False)
```

### 2. Fix Colonne `nb_accroches`

**Modification** : [backend-api/app/routers/euralis.py](backend-api/app/routers/euralis.py:314)

```python
# AVANT
SUM(nb_canards_accroches * itm / 1000) as production_totale_kg

# APRÈS
SUM(nb_accroches * itm / 1000) as production_totale_kg
```

### 3. Fix Colonnes Alertes

**Modification** : [backend-api/app/routers/euralis.py](backend-api/app/routers/euralis.py:332)

```python
# AVANT
WHERE severite = 'critique'

# APRÈS
WHERE criticite = 'critique'
```

### 4. Fix Modèle Pydantic `Alerte`

**Modification** : [backend-api/app/routers/euralis.py](backend-api/app/routers/euralis.py:80-94)

```python
# AVANT
class Alerte(BaseModel):
    id: int
    time: datetime
    niveau: str
    site_code: Optional[str]
    type_alerte: str
    severite: str
    message: str
    acquittee: bool

# APRÈS
class Alerte(BaseModel):
    id: int
    time: datetime
    lot_id: Optional[int]
    gaveur_id: Optional[int]
    site_code: Optional[str]
    type_alerte: str
    criticite: str
    titre: str
    description: Optional[str]
    valeur_observee: Optional[float]
    valeur_attendue: Optional[float]
    ecart_pct: Optional[float]
    acquittee: bool
```

### 5. Fix Query Alertes Endpoint

**Modification** : [backend-api/app/routers/euralis.py](backend-api/app/routers/euralis.py:516-563)

```python
# AVANT
@router.get("/alertes", response_model=List[Alerte])
async def get_alertes(
    niveau: Optional[str] = None,
    severite: Optional[str] = None,
    ...
):
    query = """
        SELECT id, time, niveau, site_code, type_alerte, severite, message, acquittee
        FROM alertes_euralis
        WHERE 1=1
    """
    if niveau:
        query += f" AND niveau = ${len(params)}"
    if severite:
        query += f" AND severite = ${len(params)}"

# APRÈS
@router.get("/alertes", response_model=List[Alerte])
async def get_alertes(
    criticite: Optional[str] = None,
    ...
):
    query = """
        SELECT id, time, lot_id, gaveur_id, site_code, type_alerte, criticite, titre, description,
               valeur_observee, valeur_attendue, ecart_pct, acquittee
        FROM alertes_euralis
        WHERE 1=1
    """
    if criticite:
        query += f" AND criticite = ${len(params)}"
```

---

## 🧪 Tests de Validation

Après redémarrage du backend Docker :

```bash
# Test 1 : Health check
curl http://localhost:8000/health
# ✅ {"status":"healthy","database":"connected","timestamp":"..."}

# Test 2 : KPIs Dashboard
curl http://localhost:8000/api/euralis/dashboard/kpis
# ✅ {"production_totale_kg":0.0,"nb_lots_actifs":0,"nb_lots_termines":9,...}

# Test 3 : Alertes
curl http://localhost:8000/api/euralis/alertes
# ✅ []

# Test 4 : Sites
curl http://localhost:8000/api/euralis/sites
# ✅ [{"id":1,"code":"LL","nom":"Bretagne",...}, ...]
```

---

## 📊 Résultat Final

**Tous les endpoints Euralis fonctionnent maintenant correctement** :

| Endpoint | Status | Résultat |
|----------|--------|----------|
| `/api/euralis/dashboard/kpis` | ✅ | KPIs retournés |
| `/api/euralis/alertes` | ✅ | Liste vide (pas d'alertes) |
| `/api/euralis/sites` | ✅ | 3 sites (LL, LS, MT) |

**Dashboard Euralis** : `http://localhost:3000/euralis/dashboard`
- ✅ Plus d'erreurs CORS
- ✅ Plus d'erreurs 500
- ✅ Les données se chargent correctement

---

## 🔄 Action Requise

**Redémarrer le backend** (déjà fait) :
```bash
docker-compose restart backend
```

**Vérifier que le dashboard Euralis charge maintenant les données** :
1. Ouvrir `http://localhost:3000/euralis/dashboard`
2. Vérifier que les KPIs s'affichent
3. Vérifier qu'il n'y a plus d'erreurs dans la console

---

## 📝 Schéma des Tables (Référence)

### `lots_gavage`
Colonnes principales utilisées dans les KPIs :
- `nb_accroches` (et non `nb_canards_accroches`)
- `itm`
- `statut` (`en_cours`, `termine`, `abattu`)
- `gaveur_id`
- `pctg_perte_gavage`

### `alertes_euralis`
Colonnes utilisées dans les endpoints :
- `id`, `time`
- `lot_id`, `gaveur_id`, `site_code`
- `type_alerte`
- `criticite` (et non `severite`)
- `titre` (et non `message`)
- `description`
- `valeur_observee`, `valeur_attendue`, `ecart_pct`
- `acquittee`

---

**Date** : 27 décembre 2025
**Fichier modifié** : `backend-api/app/routers/euralis.py`
**Type** : Fix critique pour démo
**Impact** : Dashboard Euralis maintenant fonctionnel
