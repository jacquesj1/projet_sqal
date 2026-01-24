# Fix Erreur 500 - Gavage Doublon (Contrainte Unique)

**Date** : 30 décembre 2025
**Erreur** : `asyncpg.exceptions.UniqueViolationError: duplicate key value violates unique constraint "7_15_unique_lot_date"`

---

## Problème Identifié

### Erreur Backend

```
asyncpg.exceptions.UniqueViolationError: duplicate key value violates unique constraint "7_15_unique_lot_date"
DETAIL:  Key (lot_id, date_gavage)=(1, 2025-12-30) already exists.
```

### Cause

Un gavage existe déjà pour le lot à la date spécifiée. La contrainte unique `unique_lot_date` empêche d'enregistrer deux gavages pour le même lot le même jour (ce qui est cohérent - **un gavage par jour et par lot**).

### Symptômes

1. **Frontend** : Erreur CORS (car le backend renvoie 500 avant d'envoyer les headers CORS)
2. **Backend** : Exception non gérée qui fait planter la requête
3. **UX** : Message d'erreur générique peu clair pour l'utilisateur

---

## Solutions Implémentées

### 1. Backend - Gestion d'Erreur Explicite

**Fichier** : [backend-api/app/routers/lots.py](backend-api/app/routers/lots.py:438-477)

**Avant** :
```python
# Pas de gestion d'erreur
row = await conn.fetchrow(
    """
    INSERT INTO gavage_lot_quotidien (...)
    VALUES (...)
    RETURNING id
    """,
    ...
)
```

**Après** :
```python
# Gestion explicite de l'erreur de contrainte unique
try:
    row = await conn.fetchrow(
        """
        INSERT INTO gavage_lot_quotidien (...)
        VALUES (...)
        RETURNING id
        """,
        ...
    )
except Exception as e:
    # Détecter erreur de contrainte unique
    if "unique constraint" in str(e) or "duplicate key" in str(e):
        raise HTTPException(
            status_code=409,  # Conflict
            detail=f"Un gavage existe déjà pour le lot {gavage.lot_id} à la date {gavage.date_gavage}. Veuillez choisir une autre date."
        )
    raise
```

**Changements** :
- Status code **409 (Conflict)** au lieu de 500 (Internal Server Error)
- Message explicite pour l'utilisateur
- Détection de la contrainte unique via pattern matching

---

### 2. Frontend - Vérification Préventive

**Fichier** : [gaveurs-frontend/app/lots/[id]/gavage/page.tsx](gaveurs-frontend/app/lots/[id]/gavage/page.tsx:198-210)

**Ajout** : Vérification avant soumission

```typescript
// Vérifier que la date n'est pas déjà enregistrée
const dateExistante = historiqueRecent.find(
  h => h.date_gavage === formData.date_gavage
);
if (dateExistante) {
  alert(
    `⚠️ Un gavage existe déjà pour le ${formData.date_gavage} (J${dateExistante.jour_gavage}).\n\n` +
    `Poids enregistré : ${dateExistante.poids_moyen_mesure}g\n` +
    `Doses : ${dateExistante.dose_matin}g / ${dateExistante.dose_soir}g\n\n` +
    `Veuillez choisir une autre date ou modifier le gavage existant.`
  );
  return;
}
```

**Limites** :
- Vérifie seulement les **3 derniers gavages** (historiqueRecent)
- Ne remplace pas la validation backend (sécurité)

---

### 3. Frontend - Gestion d'Erreur Améliorée

**Fichier** : [gaveurs-frontend/app/lots/[id]/gavage/page.tsx](gaveurs-frontend/app/lots/[id]/gavage/page.tsx:239-266)

**Avant** :
```typescript
if (!response.ok) throw new Error("Erreur enregistrement");

// ...

catch (error) {
  console.error("Erreur:", error);
  alert("❌ Erreur lors de l'enregistrement");
}
```

**Après** :
```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  throw new Error(errorData.detail || "Erreur enregistrement");
}

// ...

catch (error) {
  console.error("Erreur:", error);
  const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";

  // Détecter erreur de doublon
  if (errorMessage.includes("duplicate key") ||
      errorMessage.includes("already exists") ||
      errorMessage.includes("unique constraint")) {
    alert(
      `⚠️ Gavage déjà enregistré pour le ${formData.date_gavage}\n\n` +
      `Un gavage existe déjà pour cette date.\n` +
      `Veuillez choisir une autre date ou consulter l'historique.`
    );
  } else {
    alert(`❌ Erreur lors de l'enregistrement\n\n${errorMessage}`);
  }
}
```

**Changements** :
- Extraction du message d'erreur du backend (`errorData.detail`)
- Détection spécifique de l'erreur de doublon
- Message utilisateur clair et actionnable

---

## Workflow Complet

### Scénario : Tentative de Saisie Doublon

```
1. Gaveur ouvre page de saisie pour lot ID=1
   ↓
2. detectProchainJour() charge historique
   - J10: 2025-12-28
   - J11: 2025-12-29
   - J12: 2025-12-30 ← DÉJÀ ENREGISTRÉ
   ↓
3. Auto-détection propose J13: 2025-12-31 ✅
   ↓
4. Gaveur change manuellement à 2025-12-30 ❌
   ↓
5. VÉRIFICATION PRÉVENTIVE (frontend)
   → dateExistante = trouve J12 dans historiqueRecent
   → Alert: "Un gavage existe déjà pour le 2025-12-30"
   → return (pas d'appel API)
   ↓
6. (Si vérification contournée ou historique incomplet)
   → POST /api/lots/gavage
   ↓
7. BACKEND - Tentative INSERT
   → PostgreSQL: UniqueViolationError
   → Catch exception
   → HTTPException(409, "Un gavage existe déjà...")
   ↓
8. FRONTEND - Gestion erreur
   → response.status = 409
   → errorData.detail = "Un gavage existe déjà..."
   → Détection "already exists"
   → Alert: "⚠️ Gavage déjà enregistré..."
```

---

## Test du Fix

### 1. Créer un Gavage Initial

```bash
curl -X POST http://localhost:8000/api/lots/gavage \
  -H "Content-Type: application/json" \
  -d '{
    "lot_id": 1,
    "date_gavage": "2025-12-30",
    "dose_matin": 180,
    "dose_soir": 180,
    "heure_gavage_matin": "08:30",
    "heure_gavage_soir": "18:30",
    "nb_canards_peses": 10,
    "poids_echantillon": [4800, 4820, 4810, 4830, 4790, 4805, 4815, 4825, 4795, 4835],
    "temperature_stabule": 22,
    "humidite_stabule": 65,
    "suit_courbe_theorique": true,
    "remarques": "Test"
  }'
```

**Résultat attendu** : 201 Created

### 2. Tenter un Doublon

```bash
# MÊME REQUÊTE (même lot_id + date_gavage)
curl -X POST http://localhost:8000/api/lots/gavage \
  -H "Content-Type: application/json" \
  -d '{
    "lot_id": 1,
    "date_gavage": "2025-12-30",
    ...
  }'
```

**AVANT le fix** :
```
500 Internal Server Error
asyncpg.exceptions.UniqueViolationError...
```

**APRÈS le fix** :
```json
{
  "detail": "Un gavage existe déjà pour le lot 1 à la date 2025-12-30. Veuillez choisir une autre date."
}
```
Status: **409 Conflict**

### 3. Test Frontend

**Étapes** :
1. Ouvrir `/lots/1/gavage`
2. Observer date auto-détectée (devrait être J13 si J12 existe)
3. Changer manuellement à une date déjà renseignée (ex: 2025-12-30)
4. Cliquer "Enregistrer"

**Résultat attendu** :
- Vérification préventive bloque l'envoi
- Alert: "Un gavage existe déjà pour le 2025-12-30 (J12)"
- Affiche poids et doses du gavage existant

**Si historique incomplet** (date pas dans les 3 derniers) :
- Appel API effectué
- Backend retourne 409
- Alert: "⚠️ Gavage déjà enregistré pour le 2025-12-30"

---

## Améliorations Futures

### Option 1 : Charger Tout l'Historique pour Vérification

Au lieu de charger seulement 3 gavages, charger **toutes les dates** :

```typescript
const [datesEnregistrees, setDatesEnregistrees] = useState<Set<string>>(new Set());

const detectProchainJour = async (lotData: Lot) => {
  const response = await fetch(`${apiUrl}/api/lots/${lotId}/historique`);
  const historique = await response.json();

  // Extraire toutes les dates
  const dates = new Set(historique.map(h => h.date_gavage));
  setDatesEnregistrees(dates);

  // Dans handleSubmit:
  if (datesEnregistrees.has(formData.date_gavage)) {
    alert("Date déjà enregistrée");
    return;
  }
};
```

**Avantages** :
- Vérification 100% fiable
- Empêche appel API inutile

**Inconvénients** :
- Plus de données transférées (négligeable pour ~14 jours)

### Option 2 : Endpoint de Vérification Dédié

```python
@router.get("/{lot_id}/date-disponible/{date}")
async def check_date_disponible(lot_id: int, date: str):
    """Vérifier si une date est disponible pour saisie"""
    # SELECT COUNT(*) FROM gavage_lot_quotidien WHERE lot_id=$1 AND date_gavage=$2
    return {"disponible": count == 0}
```

Frontend :
```typescript
const verifierDateDisponible = async (date: string) => {
  const response = await fetch(`${apiUrl}/api/lots/${lotId}/date-disponible/${date}`);
  const { disponible } = await response.json();
  return disponible;
};
```

**Avantages** :
- Vérification précise en temps réel
- Peut afficher un indicateur visuel sur le sélecteur de date

**Inconvénients** :
- Requête supplémentaire
- Complexité accrue

### Option 3 : Mode Édition pour Modifier un Gavage Existant

Ajouter une route **PUT** pour modifier un gavage :

```python
@router.put("/gavage/{gavage_id}")
async def update_gavage(gavage_id: int, ...):
    """Modifier un gavage existant"""
    # UPDATE gavage_lot_quotidien SET ... WHERE id = $1
```

**Interface** :
```
Si date déjà enregistrée:
  [ Modifier ce gavage ] [ Choisir autre date ]
```

---

## Notes Techniques

### Contrainte PostgreSQL

```sql
-- Définie dans le schéma TimescaleDB
ALTER TABLE gavage_lot_quotidien
ADD CONSTRAINT "7_15_unique_lot_date"
UNIQUE (lot_id, date_gavage);
```

**Raison** : Empêcher les doublons de saisie (un gavage par jour et par lot).

### Codes HTTP

- **409 Conflict** : Utilisé pour les conflits de ressources (ex: contrainte unique)
- **500 Internal Server Error** : Erreur serveur non gérée (à éviter)
- **422 Unprocessable Entity** : Validation échouée (données invalides)

Dans notre cas, **409 est le bon choix** car :
- La requête est valide
- Les données sont correctes
- Le conflit vient d'une ressource existante

---

## Checklist

### Backend
- ✅ Try/catch autour de l'INSERT
- ✅ Détection de "unique constraint" / "duplicate key"
- ✅ HTTPException(409) avec message clair
- ✅ Status code approprié (409 au lieu de 500)

### Frontend
- ✅ Vérification préventive (historiqueRecent)
- ✅ Extraction errorData.detail du backend
- ✅ Détection pattern "duplicate key" / "already exists"
- ✅ Message utilisateur actionnable
- ✅ Affiche les infos du gavage existant (si dans historique)

### UX
- ✅ Auto-détection du prochain jour disponible
- ✅ Message clair en cas de conflit
- ✅ Suggestion d'action ("choisir autre date")
- ⏳ (Futur) Mode édition pour modifier gavage existant
- ⏳ (Futur) Indicateur visuel des dates déjà renseignées

---

**Date de finalisation** : 30 décembre 2025
**Impact** : Erreur 500 → 409 avec message clair, amélioration de l'UX
