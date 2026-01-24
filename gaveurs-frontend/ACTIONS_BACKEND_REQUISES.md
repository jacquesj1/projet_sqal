# Actions Backend Requises - Alertes

**Date**: 12 Janvier 2026
**Priorité**: HAUTE
**Contexte**: Endpoints alertes manquants causent erreurs CORS et 500

---

## Problème Actuel

L'application frontend appelle des endpoints alertes qui n'existent pas encore dans le backend:

```
❌ GET /api/alertes/gaveur/{id}?acquittee=false → 500 Internal Server Error
❌ GET /api/alertes/dashboard/{id} → Endpoint manquant
❌ POST /api/alertes/{id}/acquitter → Endpoint manquant
```

**Erreur console**:
```
Access to fetch at 'http://localhost:8000/api/alertes/gaveur/1?acquittee=false'
from origin 'http://localhost:3001' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

---

## Solution Temporaire Frontend

La page [app/alertes/page.tsx](app/alertes/page.tsx:24) a été modifiée pour désactiver les appels API:

```typescript
// Endpoints alertes temporairement désactivés (CORS error + 500)
// À réactiver quand le backend aura implémenté:
// - GET /api/alertes/gaveur/{id}
// - GET /api/alertes/dashboard/{id}
// - Configuration CORS pour localhost:3001

setAlertes([]);
setDashboard({ total_actives: 0, par_niveau: {...}, alertes_recentes: [] });
```

La page affiche maintenant "Aucune alerte" au lieu de crasher.

---

## Actions Backend à Effectuer

### 1. Configuration CORS

**Fichier**: `backend-api/app/main.py`

**Problème**: Le backend n'autorise pas les requêtes depuis `localhost:3001`

**Solution**:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Euralis frontend
        "http://localhost:3001",  # Gaveurs frontend ← AJOUTER
        "http://localhost:5173",  # SQAL frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### 2. Créer Endpoint: GET /api/alertes/gaveur/{id}

**Fichier à créer/modifier**: `backend-api/app/routers/alertes.py`

**Fonction**:
```python
from fastapi import APIRouter, Query
from typing import Optional, List
from app.models.schemas import Alerte

router = APIRouter()

@router.get("/api/alertes/gaveur/{gaveur_id}")
async def get_alertes_gaveur(
    gaveur_id: int,
    acquittee: Optional[bool] = Query(None, description="Filtrer par statut acquitté")
) -> List[Alerte]:
    """
    Récupère toutes les alertes d'un gaveur.

    Args:
        gaveur_id: ID du gaveur
        acquittee:
            - None: Toutes les alertes
            - False: Seulement les alertes non acquittées (actives)
            - True: Seulement les alertes acquittées

    Returns:
        Liste des alertes
    """
    # Requête SQL (asyncpg)
    query = """
        SELECT a.id, a.lot_id, a.type, a.niveau, a.message,
               a.acquittee, a.acquittee_par, a.created_at, a.updated_at,
               l.code_lot, l.nombre_canards
        FROM alertes a
        LEFT JOIN lots l ON a.lot_id = l.id
        WHERE l.gaveur_id = $1
    """

    params = [gaveur_id]

    if acquittee is not None:
        query += " AND a.acquittee = $2"
        params.append(acquittee)

    query += " ORDER BY a.created_at DESC LIMIT 100"

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    return [
        {
            "id": row["id"],
            "lot_id": row["lot_id"],
            "code_lot": row["code_lot"],
            "type": row["type"],
            "niveau": row["niveau"],
            "message": row["message"],
            "acquittee": row["acquittee"],
            "acquittee_par": row["acquittee_par"],
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            "nombre_canards": row["nombre_canards"]
        }
        for row in rows
    ]
```

**Schéma Pydantic** (à ajouter dans `app/models/schemas.py`):
```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class Alerte(BaseModel):
    id: int
    lot_id: int
    code_lot: Optional[str]
    type: str  # "ecart_dose", "mortalite", "poids_faible", etc.
    niveau: str  # "warning", "alert", "critical"
    message: str
    acquittee: bool
    acquittee_par: Optional[int]
    created_at: str
    updated_at: Optional[str]
    nombre_canards: Optional[int]
```

---

### 3. Créer Endpoint: GET /api/alertes/dashboard/{gaveur_id}

**Fonction**:
```python
@router.get("/api/alertes/dashboard/{gaveur_id}")
async def get_dashboard_alertes(gaveur_id: int):
    """
    Récupère le tableau de bord des alertes pour un gaveur.

    Returns:
        - total_actives: Nombre d'alertes non acquittées
        - par_niveau: Compteurs par niveau (warning, alert, critical)
        - alertes_recentes: 5 dernières alertes
    """
    async with db_pool.acquire() as conn:
        # Total alertes actives
        total_actives = await conn.fetchval("""
            SELECT COUNT(*)
            FROM alertes a
            JOIN lots l ON a.lot_id = l.id
            WHERE l.gaveur_id = $1 AND a.acquittee = false
        """, gaveur_id)

        # Compteurs par niveau
        par_niveau = await conn.fetch("""
            SELECT a.niveau, COUNT(*) as count
            FROM alertes a
            JOIN lots l ON a.lot_id = l.id
            WHERE l.gaveur_id = $1 AND a.acquittee = false
            GROUP BY a.niveau
        """, gaveur_id)

        niveau_counts = {
            "warning": 0,
            "alert": 0,
            "critical": 0
        }
        for row in par_niveau:
            niveau_counts[row["niveau"]] = row["count"]

        # 5 dernières alertes
        alertes_recentes = await conn.fetch("""
            SELECT a.id, a.lot_id, a.type, a.niveau, a.message,
                   a.created_at, l.code_lot
            FROM alertes a
            JOIN lots l ON a.lot_id = l.id
            WHERE l.gaveur_id = $1
            ORDER BY a.created_at DESC
            LIMIT 5
        """, gaveur_id)

    return {
        "total_actives": total_actives,
        "par_niveau": niveau_counts,
        "alertes_recentes": [
            {
                "id": row["id"],
                "lot_id": row["lot_id"],
                "code_lot": row["code_lot"],
                "type": row["type"],
                "niveau": row["niveau"],
                "message": row["message"],
                "created_at": row["created_at"].isoformat()
            }
            for row in alertes_recentes
        ]
    }
```

**Schéma Pydantic**:
```python
class AlerteDashboard(BaseModel):
    total_actives: int
    par_niveau: dict[str, int]  # {"warning": 5, "alert": 2, "critical": 1}
    alertes_recentes: List[dict]
```

---

### 4. Créer Endpoint: POST /api/alertes/{id}/acquitter

**Fonction**:
```python
@router.post("/api/alertes/{alerte_id}/acquitter")
async def acquitter_alerte(alerte_id: int, gaveur_id: int):
    """
    Marque une alerte comme acquittée.

    Args:
        alerte_id: ID de l'alerte
        gaveur_id: ID du gaveur qui acquitte

    Returns:
        Message de confirmation
    """
    async with db_pool.acquire() as conn:
        # Vérifier que l'alerte existe et appartient au gaveur
        alerte = await conn.fetchrow("""
            SELECT a.id
            FROM alertes a
            JOIN lots l ON a.lot_id = l.id
            WHERE a.id = $1 AND l.gaveur_id = $2
        """, alerte_id, gaveur_id)

        if not alerte:
            raise HTTPException(status_code=404, detail="Alerte non trouvée")

        # Acquitter l'alerte
        await conn.execute("""
            UPDATE alertes
            SET acquittee = true,
                acquittee_par = $2,
                updated_at = NOW()
            WHERE id = $1
        """, alerte_id, gaveur_id)

    return {
        "success": True,
        "message": f"Alerte {alerte_id} acquittée avec succès"
    }
```

---

### 5. Créer Endpoint: GET /api/alertes/lot/{lot_id}

**Fonction** (pour Analytics - CalendrierPlanningLots):
```python
@router.get("/api/alertes/lot/{lot_id}")
async def get_alertes_lot(lot_id: int):
    """
    Récupère les alertes actives d'un lot spécifique.

    Args:
        lot_id: ID du lot

    Returns:
        Liste des alertes actives pour ce lot
    """
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, lot_id, type, niveau, message,
                   acquittee, created_at
            FROM alertes
            WHERE lot_id = $1 AND acquittee = false
            ORDER BY created_at DESC
        """, lot_id)

    return [
        {
            "id": row["id"],
            "lot_id": row["lot_id"],
            "type": row["type"],
            "niveau": row["niveau"],
            "message": row["message"],
            "acquittee": row["acquittee"],
            "created_at": row["created_at"].isoformat()
        }
        for row in rows
    ]
```

---

### 6. Enregistrer le Router

**Fichier**: `backend-api/app/main.py`

```python
from app.routers import alertes

# Ajouter le router alertes
app.include_router(alertes.router, tags=["Alertes"])
```

---

## Structure Table `alertes` (si manquante)

```sql
CREATE TABLE IF NOT EXISTS alertes (
    id SERIAL PRIMARY KEY,
    lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,  -- 'ecart_dose', 'mortalite', 'poids_faible', etc.
    niveau VARCHAR(20) NOT NULL,  -- 'warning', 'alert', 'critical'
    message TEXT NOT NULL,
    acquittee BOOLEAN DEFAULT false,
    acquittee_par INTEGER REFERENCES gaveurs(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    INDEX idx_alertes_lot_id (lot_id),
    INDEX idx_alertes_acquittee (acquittee)
);
```

**Exemples de types d'alertes**:
- `ecart_dose`: Écart significatif entre dose théorique et réelle
- `mortalite`: Taux de mortalité anormal
- `poids_faible`: Poids moyen inférieur à l'objectif
- `temperature`: Température salle hors limites
- `humidite`: Humidité hors limites
- `itm_faible`: ITM (Indice de Transformation Maïs) en dessous du seuil

---

## Logique de Génération des Alertes

Les alertes peuvent être générées automatiquement par:

1. **Trigger SQL** après insertion de dose:
```sql
CREATE OR REPLACE FUNCTION check_ecart_dose()
RETURNS TRIGGER AS $$
BEGIN
    IF ABS((NEW.dose_reelle_g - NEW.dose_theorique_g) / NEW.dose_theorique_g) > 0.15 THEN
        INSERT INTO alertes (lot_id, type, niveau, message)
        VALUES (
            NEW.lot_id,
            'ecart_dose',
            'alert',
            'Écart de dose > 15% au jour ' || NEW.jour_gavage
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ecart_dose
AFTER INSERT ON doses_journalieres
FOR EACH ROW EXECUTE FUNCTION check_ecart_dose();
```

2. **Endpoint POST /api/courbes/reelle** (lors de la saisie dose):
```python
# Après insertion de la dose
if abs(ecart_pct) > 15:
    await conn.execute("""
        INSERT INTO alertes (lot_id, type, niveau, message)
        VALUES ($1, 'ecart_dose', 'alert', $2)
    """, lot_id, f"Écart de dose {ecart_pct:.1f}% au jour {jour_gavage}")
```

3. **Job CRON quotidien** pour vérifier:
- ITM faible
- Mortalité anormale
- Poids moyen insuffisant

---

## Réactiver le Frontend

Une fois les endpoints backend créés, réactiver dans [app/alertes/page.tsx](app/alertes/page.tsx:30):

```typescript
// Décommenter ces lignes:
const [alertesData, dashboardData] = await Promise.all([
  alerteApi.getByGaveur(DEFAULT_GAVEUR_ID, filterAcquittee ? undefined : false),
  alerteApi.getDashboard(DEFAULT_GAVEUR_ID),
]);

if (Array.isArray(alertesData)) {
  setAlertes(alertesData as Alerte[]);
}
setDashboard(dashboardData as AlerteDashboard);
```

Et dans [CalendrierPlanningLots.tsx](components/analytics/CalendrierPlanningLots.tsx:56):

```typescript
// Décommenter:
try {
  const alertesResponse = await fetch(`${apiUrl}/api/alertes/lot/${lot.id}`);
  const alertesData = await alertesResponse.json();
  hasAlerte = Array.isArray(alertesData) && alertesData.length > 0;
} catch (err) {
  console.error(`Erreur chargement alertes lot ${lot.id}:`, err);
}
```

---

## Tests Backend Recommandés

### Test 1: GET /api/alertes/gaveur/1
```bash
curl http://localhost:8000/api/alertes/gaveur/1
# Devrait retourner: []

curl http://localhost:8000/api/alertes/gaveur/1?acquittee=false
# Devrait retourner: []
```

### Test 2: GET /api/alertes/dashboard/1
```bash
curl http://localhost:8000/api/alertes/dashboard/1
# Devrait retourner:
# {
#   "total_actives": 0,
#   "par_niveau": {"warning": 0, "alert": 0, "critical": 0},
#   "alertes_recentes": []
# }
```

### Test 3: POST /api/alertes/1/acquitter
```bash
curl -X POST http://localhost:8000/api/alertes/1/acquitter?gaveur_id=1
# Devrait retourner:
# {"success": true, "message": "Alerte 1 acquittée avec succès"}
```

### Test 4: Vérifier CORS
```bash
curl -H "Origin: http://localhost:3001" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:8000/api/alertes/gaveur/1

# Devrait retourner header:
# Access-Control-Allow-Origin: http://localhost:3001
```

---

## Priorité d'Implémentation

1. **CRITIQUE**: Configuration CORS (5 min)
2. **HAUTE**: GET /api/alertes/gaveur/{id} (30 min)
3. **HAUTE**: GET /api/alertes/lot/{id} (15 min)
4. **MOYENNE**: GET /api/alertes/dashboard/{id} (20 min)
5. **BASSE**: POST /api/alertes/{id}/acquitter (15 min)
6. **FUTURE**: Logique de génération automatique des alertes

**Temps total estimé**: 1h30

---

## Documentation de Référence

- **FastAPI CORS**: https://fastapi.tiangolo.com/tutorial/cors/
- **AsyncPG**: https://magicstack.github.io/asyncpg/
- **Schema table alertes**: `backend-api/scripts/timescaledb_schema.sql`

---

**Status**: ⚠️ EN ATTENTE BACKEND
**Auteur**: Claude Sonnet 4.5
**Date**: 12 Janvier 2026
