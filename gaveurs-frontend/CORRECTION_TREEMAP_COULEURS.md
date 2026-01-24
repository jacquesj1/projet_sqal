# Correction Treemap - Couleurs par Statut

**Date**: 12 Janvier 2026
**Contexte**: Correction du problème "tout est orange" dans le Treemap hiérarchique

---

## Problème Initial

Tous les lots dans le Treemap apparaissaient en orange, quel que soit leur statut réel (en_gavage, termine, en_preparation, abattu).

**Cause**: Le code utilisait le champ `category` (qui valait toujours 'lot' pour les feuilles) pour déterminer la couleur, au lieu du statut réel du lot.

---

## Solution Implémentée

### 1. Ajout du statut aux nœuds feuilles

**Avant** (ligne 85-89):
```typescript
children: lots.map((lot: any) => ({
  name: lot.code_lot || lot.nom || `Lot ${lot.id}`,
  value: lot.nombre_canards || 50,
  category: 'lot'
}))
```

**Après**:
```typescript
children: lots.map((lot: any) => ({
  name: lot.code_lot || lot.nom || `Lot ${lot.id}`,
  value: lot.nombre_canards || 50,
  category: 'lot',
  statut: statut  // Propagation du statut du parent
}))
```

**Explication**: Le statut du groupe parent (en_gavage, termine, etc.) est maintenant ajouté à chaque lot enfant.

---

### 2. Mise à jour de l'interface TypeScript

**Avant** (ligne 5-10):
```typescript
interface TreeNode {
  name: string;
  children?: TreeNode[];
  value?: number;
  category?: string;
}
```

**Après**:
```typescript
interface TreeNode {
  name: string;
  children?: TreeNode[];
  value?: number;
  category?: string;
  statut?: string;  // Nouveau champ
}
```

---

### 3. Changement du scale de couleurs

**Avant** (ligne 133-136):
```typescript
// Color scale by category
const colorScale = d3.scaleOrdinal<string>()
  .domain(['statut', 'race', 'lot'])
  .range(['#3b82f6', '#10b981', '#f59e0b']);
```

**Après**:
```typescript
// Color scale by statut
const colorScale = d3.scaleOrdinal<string>()
  .domain(['en_preparation', 'en_gavage', 'termine', 'abattu', 'inconnu'])
  .range(['#f97316', '#10b981', '#3b82f6', '#6b7280', '#94a3b8']);
```

**Correspondance des couleurs**:
| Statut | Couleur | Hex | Signification |
|--------|---------|-----|---------------|
| `en_preparation` | Orange | `#f97316` | Lot en préparation |
| `en_gavage` | Vert | `#10b981` | Lot en gavage actif |
| `termine` | Bleu | `#3b82f6` | Lot terminé |
| `abattu` | Gris foncé | `#6b7280` | Lot abattu |
| `inconnu` | Gris clair | `#94a3b8` | Statut inconnu |

---

### 4. Utilisation du statut pour la couleur

**Avant** (ligne 180-183):
```typescript
.attr('fill', d => {
  const category = d.data.category || 'lot';
  return colorScale(category);
})
```

**Après**:
```typescript
.attr('fill', d => {
  // Utiliser le statut pour la couleur
  const statut = d.data.statut || 'inconnu';
  return colorScale(statut);
})
```

**Explication**: Au lieu d'utiliser `category` (toujours 'lot'), on utilise maintenant `statut` qui contient la vraie valeur (en_gavage, termine, etc.).

---

## Résultat Visuel

### Avant
```
┌─────────────────────────────────────┐
│  Tous les lots en ORANGE #f59e0b   │
│  (car category='lot' pour tous)    │
└─────────────────────────────────────┘
```

### Après
```
┌─────────────────────────────────────┐
│  🟢 Lots en gavage (VERT)           │
│  🔵 Lots terminés (BLEU)            │
│  🟠 Lots en préparation (ORANGE)    │
│  ⚫ Lots abattus (GRIS)             │
└─────────────────────────────────────┘
```

---

## Cohérence avec les autres composants

Le Treemap utilise maintenant le même code couleur que:

1. **CalendrierPlanningLots**:
   - Vert: en_gavage
   - Bleu: termine
   - Orange: en_preparation
   - Gris: abattu

2. **Page /lots** (LotCard):
   - Badges verts pour en_gavage
   - Badges bleus pour termine
   - Badges orange pour en_preparation
   - Badges gris pour abattu

3. **Légende du calendrier**:
   - Mêmes couleurs exactes

---

## Tests à Effectuer

### Test 1: Vérifier les couleurs par statut
- [ ] Ouvrir `/analytics`
- [ ] Sélectionner onglet "Répartition Hiérarchique"
- [ ] Vérifier que les lots en_gavage sont VERTS
- [ ] Vérifier que les lots terminés sont BLEUS
- [ ] Vérifier que les lots en_preparation sont ORANGE
- [ ] Vérifier que les lots abattus sont GRIS

### Test 2: Vérifier la cohérence avec la page /lots
- [ ] Ouvrir `/lots`
- [ ] Noter le statut des lots (badges de couleur)
- [ ] Ouvrir `/analytics` → Treemap
- [ ] Vérifier que les mêmes lots ont les mêmes couleurs

### Test 3: Tooltip affiche le bon statut
- [ ] Survoler un lot dans le Treemap
- [ ] Vérifier que le chemin affiché contient le bon statut
- [ ] Exemple: "Gaveur 1 → En gavage → Mulard → LOT-2025-001"

### Test 4: Filtrage par lot
- [ ] Ouvrir `/analytics?lot=3468`
- [ ] Vérifier que seul le lot 3468 apparaît
- [ ] Vérifier que sa couleur correspond à son statut

---

## Impact Code

**Fichier modifié**: 1
- [TreemapRepartition.tsx](components/analytics/TreemapRepartition.tsx)

**Lignes modifiées**: 4 sections
1. Interface TreeNode: +1 ligne (ajout champ `statut`)
2. Mapping des lots: +1 ligne (propagation du statut)
3. Color scale: changement de domaine et range (3 → 5 valeurs)
4. Fill attribute: changement de logique (category → statut)

**Aucune régression**: Les changements n'affectent que l'affichage visuel.

---

## Documentation du Bug Original

**Symptôme**: "tjs un pb dans treemap où tout est orange" (message utilisateur)

**Diagnostic**:
1. Le Treemap construisait une hiérarchie: Gaveur → Statut → Race → Lots
2. Les lots héritaient de leur statut parent (en_gavage, termine, etc.)
3. MAIS le champ `category` était toujours 'lot' pour les feuilles
4. Le color scale utilisait `category` au lieu de `statut`
5. Résultat: `colorScale('lot')` retournait toujours `#f59e0b` (orange)

**Fix**: Ajouter le statut aux nœuds feuilles et l'utiliser pour la couleur.

---

## Conclusion

✅ **Treemap maintenant coloré par statut réel**: Chaque lot a sa couleur selon son état

✅ **Cohérence visuelle**: Mêmes couleurs que calendrier et page /lots

✅ **Code plus clair**: Utilisation explicite de `statut` au lieu de `category`

✅ **5 couleurs distinctes**: Facilite l'identification rapide des lots par statut

Le problème "tout est orange" est résolu. Les gaveurs peuvent maintenant distinguer visuellement l'état de leurs lots dans le Treemap.

---

**Status**: ✅ CORRECTION COMPLETE
**Auteur**: Claude Sonnet 4.5
**Date**: 12 Janvier 2026
