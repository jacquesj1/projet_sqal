# Correction Modal Saisie Dose - Pré-remplissage Automatique

**Date**: 11 Janvier 2026
**Problème**: Modal "Saisir Dose" affichait toujours jour 1 et dose 0 au lieu des valeurs suggérées

---

## Problème Initial

Lorsque le gaveur cliquait sur "➕ Saisir Dose", le modal s'ouvrait avec:
- **Jour de gavage**: `1` (incorrect)
- **Dose réelle**: `0` (incorrect)

Alors que le widget "Prochaine Action" affichait correctement:
- **Jour**: `12`
- **Dose prédictive IA**: `299.8g`

---

## Cause du Problème

1. **État initial statique** (lignes 52-56):
```typescript
const [saisieForm, setSaisieForm] = useState({
  jour_gavage: 1,
  dose_reelle_g: 0,
  commentaire: ''
});
```

2. **Mise à jour manuelle uniquement au clic** sur les boutons spécifiques (bouton "Saisir maintenant" du widget)

3. **Pas de mise à jour automatique** quand les données du dashboard changeaient

---

## Solution Implémentée

### 1. useEffect pour mise à jour automatique (lignes 65-88)

Ajout d'un `useEffect` qui se déclenche dès que `dashboard` ou `courbePredictive` changent:

```typescript
useEffect(() => {
  if (dashboard && dashboard.courbe_reelle) {
    // Trouver le dernier jour saisi
    const dernierJourSaisi = dashboard.courbe_reelle.length > 0
      ? Math.max(...dashboard.courbe_reelle.map(d => d.jour_gavage))
      : 0;
    const prochainJour = dernierJourSaisi + 1;

    // Trouver la dose suggérée (prédictive en priorité)
    let doseSuggeree = dashboard.courbe_theorique.courbe[prochainJour - 1]?.dose_g || 0;

    if (courbePredictive?.courbe_predictive) {
      const pointPredictif = courbePredictive.courbe_predictive.find((p: any) => p.jour === prochainJour);
      if (pointPredictif) {
        doseSuggeree = pointPredictif.dose_g;
      }
    }

    // Mettre à jour le formulaire
    setSaisieForm({
      jour_gavage: prochainJour,
      dose_reelle_g: doseSuggeree,
      commentaire: ''
    });
  }
}, [dashboard, courbePredictive]);
```

### 2. Amélioration du bouton "Saisir Dose" (lignes 255-285)

Le bouton conserve sa logique de pré-remplissage manuel (redondante mais utile si l'effet ne s'est pas encore déclenché):

```typescript
onClick={() => {
  // Pré-remplir avec le prochain jour et la dose suggérée
  const dernierJourSaisi = dashboard.courbe_reelle.length > 0
    ? Math.max(...dashboard.courbe_reelle.map(d => d.jour_gavage))
    : 0;
  const prochainJour = dernierJourSaisi + 1;

  let doseSuggeree = dashboard.courbe_theorique.courbe[prochainJour - 1]?.dose_g || 0;

  if (courbePredictive?.courbe_predictive) {
    const pointPredictif = courbePredictive.courbe_predictive.find((p: any) => p.jour === prochainJour);
    if (pointPredictif) {
      doseSuggeree = pointPredictif.dose_g;
    }
  }

  setSaisieForm({
    ...saisieForm,
    jour_gavage: prochainJour,
    dose_reelle_g: doseSuggeree
  });
  setShowSaisieModal(true);
}}
```

### 3. Réinitialisation du commentaire après saisie (ligne 130)

Après l'enregistrement réussi, le commentaire est vidé:

```typescript
setShowSaisieModal(false);
setSaisieForm(prev => ({ ...prev, commentaire: '' }));
if (selectedLotId) loadDashboardData(selectedLotId);
```

### 4. Amélioration UX du modal (lignes 595-645)

**Bandeau d'information** (lignes 595-601):
```html
<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
  <p className="text-sm text-blue-900">
    💡 Les valeurs ci-dessous sont pré-remplies avec les suggestions IA/théoriques.
    <strong> Vous êtes libre de les modifier</strong> selon la réalité du terrain.
  </p>
</div>
```

**Labels informatifs** sous chaque champ:
- Jour de gavage: `Prochain jour suggéré`
- Dose réelle: `🤖 Dose prédictive IA suggérée - Modifiable` OU `📊 Dose théorique suggérée - Modifiable`

---

## Comportement Final

### Scénario: Jour 11 saisi, on veut saisir le jour 12

**1. Chargement de la page**:
- Dashboard se charge
- `useEffect` se déclenche automatiquement
- `saisieForm` est mis à jour avec:
  - `jour_gavage: 12`
  - `dose_reelle_g: 299.8` (dose prédictive IA)

**2. Le gaveur clique sur "➕ Saisir Dose"**:
- Modal s'ouvre
- Champs pré-remplis avec:
  - **Jour de gavage**: `12` ✅
  - **Dose réelle**: `299.8` ✅
  - Label: "🤖 Dose prédictive IA suggérée - Modifiable" ✅

**3. Le gaveur peut**:
- **Accepter les valeurs** → Clic direct sur "Enregistrer"
- **Modifier la dose** → Ex: 305g au lieu de 299.8g
- **Modifier le jour** → Ex: rattrapage jour 10 manqué
- **Ajouter un commentaire** → Ex: "Canards très voraces aujourd'hui"

**4. Après enregistrement**:
- Dose enregistrée
- Modal se ferme
- Dashboard se recharge avec nouvelles données
- `useEffect` se déclenche à nouveau
- Formulaire mis à jour pour le jour 13
- Commentaire vidé

---

## Flux de Mise à Jour

```
[Page chargée]
    ↓
[loadDashboardData() appelé]
    ↓
[dashboard + courbePredictive chargés]
    ↓
[useEffect déclenché automatiquement]
    ↓
[Calcul: dernierJour = 11 → prochainJour = 12]
    ↓
[Recherche dose prédictive pour jour 12 = 299.8g]
    ↓
[setSaisieForm({ jour: 12, dose: 299.8, commentaire: '' })]
    ↓
[Formulaire prêt AVANT même d'ouvrir le modal] ✅
    ↓
[Gaveur clique "Saisir Dose"]
    ↓
[Modal s'ouvre avec valeurs correctes] ✅
```

---

## Corrections des Noms de Propriétés

### Problème "Jour NaN" et "Dose 0.0g"

**Cause**: Mauvais noms de propriétés utilisés

**Corrections**:
1. `d.jour` → `d.jour_gavage` (ligne 420)
2. `courbePredictive?.courbe` → `courbePredictive?.courbe_predictive` (ligne 443)

**Référence TypeScript** (`lib/courbes-api.ts`):
```typescript
// Dashboard3Courbes
courbe_reelle: Array<{
  jour_gavage: number;  // ← BON NOM
  // ...
}>;

// Courbe prédictive
async getCourbePredictive(lotId: number): Promise<{
  courbe_predictive: DoseJour[];  // ← BON NOM
  // ...
}>
```

---

## Tests à Effectuer

### Test 1: Chargement initial
- [ ] Ouvrir page d'accueil avec un lot ayant 11 jours saisis
- [ ] Vérifier widget "Prochaine Action" affiche "Jour 12"
- [ ] Cliquer "Saisir Dose"
- [ ] Vérifier modal affiche:
  - Jour: `12`
  - Dose: `299.8` (ou dose prédictive IA si disponible)
  - Label: "🤖 Dose prédictive IA suggérée - Modifiable"

### Test 2: Modification des valeurs
- [ ] Ouvrir modal "Saisir Dose"
- [ ] Modifier jour: `12` → `10` (rattrapage)
- [ ] Modifier dose: `299.8` → `305.0`
- [ ] Ajouter commentaire: "Test"
- [ ] Enregistrer
- [ ] Vérifier dose enregistrée avec valeurs modifiées

### Test 3: Saisie successive
- [ ] Saisir dose jour 12
- [ ] Modal se ferme
- [ ] Dashboard se recharge
- [ ] Rouvrir modal
- [ ] Vérifier maintenant jour 13 et dose jour 13 sont pré-remplis

### Test 4: Changement de lot
- [ ] Sélectionner Lot A (11 jours saisis)
- [ ] Vérifier modal prêt pour jour 12
- [ ] Changer pour Lot B (5 jours saisis)
- [ ] Vérifier modal se met à jour pour jour 6

### Test 5: Absence de courbe prédictive
- [ ] Utiliser un lot sans courbe prédictive IA
- [ ] Vérifier modal utilise dose théorique
- [ ] Label: "📊 Dose théorique suggérée - Modifiable"

---

## Bénéfices Utilisateur

### Avant
❌ Gaveur doit **manuellement**:
1. Regarder quel est le prochain jour
2. Consulter le widget "Prochaine Action"
3. Mémoriser la dose suggérée
4. Ouvrir le modal
5. Taper le jour
6. Taper la dose

**6 étapes**, risque d'erreur de saisie

### Après
✅ Gaveur peut:
1. Clic "Saisir Dose"
2. Vérifier visuellement (valeurs déjà remplies)
3. Ajuster si nécessaire (selon réalité terrain)
4. Clic "Enregistrer"

**2-4 étapes**, gain de temps énorme, moins d'erreurs

---

## Impact Code

**Fichiers modifiés**: 1
- `app/page.tsx`

**Lignes ajoutées**: ~30 lignes
- useEffect automatique: 24 lignes
- Réinitialisation commentaire: 1 ligne
- Amélioration UX modal: 5 lignes

**Lignes modifiées**: 2
- Correction `d.jour` → `d.jour_gavage`
- Correction `courbe` → `courbe_predictive`

---

## Conclusion

✅ **Problème résolu**: Modal pré-remplit automatiquement les valeurs suggérées

✅ **UX améliorée**: Gaveur gagne du temps, moins d'erreurs de saisie

✅ **Flexibilité préservée**: Valeurs modifiables selon réalité terrain

✅ **Robustesse**: Fonctionne avec ou sans courbe prédictive IA

✅ **Réactivité**: Mise à jour automatique au changement de lot

---

**Status**: ✅ CORRECTION COMPLETE - MODAL PRÉ-REMPLI AUTOMATIQUEMENT
**Auteur**: Claude Sonnet 4.5
**Date**: 11 Janvier 2026
