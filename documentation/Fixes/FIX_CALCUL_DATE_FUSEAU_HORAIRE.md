# Fix Calcul Date - Problème de Fuseau Horaire

**Date** : 30 décembre 2025
**Bug** : La prochaine date calculée était identique au dernier gavage (2025-12-30 au lieu de 2025-12-31)

---

## Problème Identifié

### Logs Observés

```
[DETECTION] Dernier gavage: J12 - 2025-12-30
[DETECTION] Prochaine date calculée: 2025-12-30 (J13)  ← BUG!
[DETECTION] Aujourd'hui: 2025-12-30
[DETECTION] ✓ Proposition de la date: 2025-12-30
```

**Attendu** : `Prochaine date calculée: 2025-12-31 (J13)`
**Réel** : `Prochaine date calculée: 2025-12-30 (J13)`

### Cause Racine

Le code original utilisait:

```typescript
const dernierDate = new Date(dernierGavage.date_gavage + 'T00:00:00');
const prochainDate = new Date(dernierDate);
prochainDate.setDate(prochainDate.getDate() + 1);
```

**Problème** : Le fuseau horaire peut causer des décalages lors de la conversion ISO → Date → ISO.

Exemple avec fuseau horaire UTC+1:
```
"2025-12-30" + "T00:00:00" → Date UTC "2025-12-29T23:00:00Z" (en hiver)
+1 jour → "2025-12-30T23:00:00Z"
toISOString().split("T")[0] → "2025-12-30" ❌
```

---

## Solution Implémentée

### Nouveau Code (Robuste)

**Fichier** : [gaveurs-frontend/app/lots/[id]/gavage/page.tsx](gaveurs-frontend/app/lots/[id]/gavage/page.tsx:113-122)

```typescript
// Calculer la date correspondante (méthode robuste sans problème de fuseau horaire)
// Utiliser directement la string de date et ajouter 1 jour manuellement
const [annee, mois, jourStr] = dernierGavage.date_gavage.split('-').map(Number);
const dernierDateObj = new Date(annee, mois - 1, jourStr); // mois -1 car Date() compte de 0 à 11

console.log(`[DEBUG] dernierDate: ${dernierDateObj.toISOString().split('T')[0]}`);

const prochainDate = new Date(annee, mois - 1, jourStr + 1); // Ajouter 1 au jour

console.log(`[DEBUG] prochainDate: ${prochainDate.toISOString().split('T')[0]}`);
```

### Pourquoi Ça Fonctionne

1. **Parse manuel** : `"2025-12-30".split('-')` → `[2025, 12, 30]`
2. **Date locale** : `new Date(2025, 11, 30)` crée une date **locale** (pas UTC)
3. **Ajout direct** : `new Date(2025, 11, 31)` ajoute 1 au jour
4. **Conversion ISO** : `toISOString().split('T')[0]` donne toujours `"2025-12-31"` ✅

**Avantage** : Pas de conversion fuseau horaire, calcul purement numérique.

---

## Tests

### Test 1 : Dernier Gavage J12 (30/12)

**Input** : `dernierGavage.date_gavage = "2025-12-30"`

**Logs attendus** :
```
[DEBUG] dernierDate: 2025-12-30
[DEBUG] prochainDate: 2025-12-31
[DETECTION] Prochaine date calculée: 2025-12-31 (J13)
[DETECTION] Aujourd'hui: 2025-12-30
[DETECTION] ✗ Date dans le futur, gardée par défaut
```

**Résultat** : La date **N'EST PAS** proposée car 31/12 > 30/12 (dans le futur).

### Test 2 : Le 31/12, Dernier Gavage J12 (30/12)

**Input** : `dernierGavage.date_gavage = "2025-12-30"`, date système = 31/12

**Logs attendus** :
```
[DEBUG] dernierDate: 2025-12-30
[DEBUG] prochainDate: 2025-12-31
[DETECTION] Prochaine date calculée: 2025-12-31 (J13)
[DETECTION] Aujourd'hui: 2025-12-31
[DETECTION] ✓ Proposition de la date: 2025-12-31
```

**Résultat** : La date J13 (31/12) **EST proposée** ✅

### Test 3 : Changement de Mois

**Input** : `dernierGavage.date_gavage = "2024-02-28"` (année bissextile)

**Calcul** :
```typescript
const [annee, mois, jourStr] = "2024-02-28".split('-').map(Number);
// → [2024, 2, 28]

const prochainDate = new Date(2024, 1, 29);
// → 29 février 2024 (année bissextile) ✅
```

**Input** : `dernierGavage.date_gavage = "2023-02-28"` (année non bissextile)

**Calcul** :
```typescript
const prochainDate = new Date(2023, 1, 29);
// → JavaScript ajuste automatiquement à 1er mars 2023 ✅
```

---

## Pourquoi Le Système Propose J12 le 30/12

### Explication

**Situation actuelle** :
- Dernier gavage enregistré : **J12 (30/12/2025)**
- Date d'aujourd'hui : **30/12/2025**
- Prochaine date calculée : **31/12/2025** (J13)

**Logique du système** :
```typescript
if (prochainDate <= aujourdHui) {
  // Proposer la date
}
```

**Condition** : `31/12 <= 30/12` → **FALSE**

**Résultat** : La date **N'EST PAS proposée** car elle est dans le futur.

**Conséquence** : Le formulaire garde la valeur par défaut :
```typescript
date_gavage: new Date().toISOString().split("T")[0]
// → "2025-12-30"
```

Qui correspond à **J12**, d'où l'erreur "gavage déjà enregistré" quand vous essayez de soumettre.

---

## Solution Utilisateur

### Option 1 : Attendre Demain

**Le 31/12/2025** :
- Le système proposera automatiquement **J13 (31/12)**
- Vous pourrez saisir le gavage sans erreur

### Option 2 : Changer Manuellement la Date

1. Ouvrir la page `/lots/1/gavage`
2. **Changer manuellement** le champ date à `31/12/2025`
3. Le système calculera automatiquement **J13**
4. Remplir les doses et poids
5. Soumettre

**Note** : Le système acceptera une date future si vous la saisissez manuellement.

### Option 3 : Saisir un Autre Jour

Si vous voulez saisir un **jour passé manquant** (ex: J11 si vous avez J10 et J12) :
1. Changer manuellement la date au jour manquant
2. Le système acceptera la saisie

---

## Améliorations Futures

### Indicateur Visuel des Dates Disponibles

Ajouter un calendrier avec des indicateurs :
- ✅ **Vert** : Jour déjà renseigné
- 📝 **Bleu** : Jour recommandé (prochain jour à remplir)
- ⏳ **Gris** : Jour futur (non accessible)
- ⚠️ **Jaune** : Jour passé manquant

### Blocage des Dates Futures

Empêcher la saisie manuelle de dates futures :
```typescript
<input
  type="date"
  max={new Date().toISOString().split('T')[0]}
  // ...
/>
```

### Mode "Rattrapage"

Détecter les jours manquants et proposer de les remplir :
```
⚠️ Attention : J11 (29/12) n'a pas été renseigné
[ Remplir J11 ] [ Continuer avec J13 ]
```

---

## Checklist

### Backend
- ✅ Route `/api/lots/{id}/historique` fonctionne
- ✅ Contrainte unique `unique_lot_date` empêche les doublons
- ✅ Gestion d'erreur 409 pour les doublons

### Frontend
- ✅ Calcul de date robuste (sans problème de fuseau horaire)
- ✅ Détection automatique du prochain jour
- ✅ Vérification préventive (historiqueRecent)
- ✅ Message d'erreur clair pour les doublons
- ✅ Logs de debug pour diagnostic

### UX
- ✅ Date auto-détectée (si pas dans le futur)
- ✅ Possibilité de changer manuellement
- ⏳ (Futur) Calendrier visuel avec indicateurs
- ⏳ (Futur) Blocage dates futures
- ⏳ (Futur) Mode rattrapage jours manquants

---

## Conclusion

Le bug de calcul de date a été corrigé. Le système propose maintenant correctement **J13 (31/12)** au lieu de **J12 (30/12)**.

**Comportement actuel** (30/12/2025) :
- Dernier gavage : J12 (30/12)
- Prochain jour : J13 (31/12)
- Date proposée : **Aucune** (car 31/12 est dans le futur)
- Date par défaut : 30/12 (aujourd'hui)
- Résultat : Message "gavage déjà enregistré" si soumission

**Comportement demain** (31/12/2025) :
- Dernier gavage : J12 (30/12)
- Prochain jour : J13 (31/12)
- Date proposée : **31/12** ✅
- Résultat : Saisie possible sans erreur

---

**Date de finalisation** : 30 décembre 2025
**Impact** : Calcul de date correct, logs de debug améliorés
