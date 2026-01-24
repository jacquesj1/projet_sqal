# Correction Formule ITM - Poids de Foie

**Date**: 12 Janvier 2026
**Contexte**: Correction de la formule ITM pour utiliser le poids de foie au lieu du gain de poids total

---

## Problème Identifié

**Observation utilisateur**: "Normalement l'ITM devrait être en lien avec la dose totale et le poids final. En effet, puisque c'est le poids de foie moyen sur la quantité de maïs ingérée lors du gavage."

**Erreur dans le code original**:
```typescript
// MAUVAISE formule
const itm = lot.itm || (doseTotale > 0 ? gainPoids / (doseTotale / 1000) : 2.5);
```

Cette formule utilisait le **gain de poids total du canard** au lieu du **poids de foie**.

---

## Définition Correcte de l'ITM

### ITM = Indice de Transformation du Maïs

**Formule correcte**:
```
ITM = Poids de foie moyen (g) / Quantité de maïs ingérée (kg)
```

**Unités**:
- Poids de foie: **grammes** (g)
- Dose totale: **kilogrammes** (kg) → doseTotale / 1000
- ITM: **grammes par kilogramme** (g/kg)

### Interprétation

- **ITM élevé** (ex: 80-100 g/kg): Bonne conversion maïs → foie
- **ITM moyen** (ex: 50-70 g/kg): Conversion moyenne
- **ITM faible** (ex: 30-50 g/kg): Conversion faible

**Objectif**: Maximiser l'ITM (plus de foie pour moins de maïs)

---

## Correction Appliquée

### 1. Ajout de la Variable `poids_foie`

**Avant** (12 variables):
```typescript
const variables: { [key: string]: number[] } = {
  age_debut: [],
  poids_debut: [],
  poids_final: [],
  gain_poids: [],
  dose_moyenne: [],
  dose_totale: [],
  dose_min: [],
  dose_max: [],
  ecart_moyen: [],
  nombre_canards: [],
  duree_gavage: [],
  itm: [],
};
```

**Après** (13 variables):
```typescript
const variables: { [key: string]: number[] } = {
  age_debut: [],
  poids_debut: [],
  poids_final: [],
  gain_poids: [],
  poids_foie: [],        // ← NOUVEAU
  dose_moyenne: [],
  dose_totale: [],
  dose_min: [],
  dose_max: [],
  ecart_moyen: [],
  nombre_canards: [],
  duree_gavage: [],
  itm: [],
};
```

---

### 2. Calcul du Poids de Foie

**Code ajouté**:
```typescript
// Poids de foie (estimation: ~10% du poids final pour canard gavé)
const poidsFoie = lot.poids_foie_moyen || (poidsFinal * 0.10);
```

**Logique**:
1. **Si disponible**: Utilise `lot.poids_foie_moyen` (valeur réelle de la base de données)
2. **Sinon**: Estime à **10% du poids final** du canard

**Pourquoi 10%?**
- Canard mulard gavé: poids moyen ~6-7 kg
- Foie gras: poids moyen ~600-700g
- Ratio: 600g / 6000g ≈ 10%

---

### 3. Formule ITM Corrigée

**Avant** (INCORRECT):
```typescript
// Utilisait gain_poids (gain total du canard)
const itm = lot.itm || (doseTotale > 0 ? gainPoids / (doseTotale / 1000) : 2.5);
```

**Problème**: Si un canard prend 2000g de poids total et mange 10kg de maïs:
- ITM calculé = 2000 / 10 = **200 g/kg** (aberrant!)
- Car le gain de poids inclut muscles, graisse, os, etc. Pas seulement le foie.

**Après** (CORRECT):
```typescript
// ITM (Indice de Transformation Maïs) = poids_foie (g) / dose_totale (kg)
// Formule correcte: ITM = poids de foie moyen / quantité de maïs ingérée
const itm = lot.itm || (doseTotale > 0 ? poidsFoie / (doseTotale / 1000) : 50);
```

**Exemple réaliste**: Si un canard produit 600g de foie avec 10kg de maïs:
- ITM = 600 / 10 = **60 g/kg** ✅

---

### 4. Ajout du Label

**Code ajouté**:
```typescript
const labels: { [key: string]: string } = {
  // ...
  poids_foie: 'Poids foie',  // ← NOUVEAU
  // ...
  itm: 'ITM',
};
```

**Catégorie**: 'canard' (bleu)
```typescript
if (['age_debut', 'poids_debut', 'poids_final', 'gain_poids', 'poids_foie'].includes(varName))
  return 'canard';
```

---

## Corrélations Attendues avec ITM

Avec la formule corrigée, voici les corrélations logiques:

### Corrélations Fortes

**ITM ↔ Poids foie** (positive, r ≈ 0.9):
- Plus le foie est lourd, plus l'ITM est élevé
- **Numérateur direct** dans la formule ITM

**ITM ↔ Dose totale** (négative, r ≈ -0.7):
- Plus on donne de maïs, plus l'ITM diminue (dénominateur)
- **Relation inverse**: ITM = poids_foie / dose_totale

### Corrélations Moyennes

**ITM ↔ Poids final** (positive faible, r ≈ 0.4):
- Canards lourds tendent à avoir des foies plus gros
- Mais pas une relation directe (variabilité génétique)

**ITM ↔ Durée gavage** (négative, r ≈ -0.5):
- Gavage plus long = plus de maïs total
- ITM diminue si le foie n'augmente pas proportionnellement

### Corrélations Faibles

**ITM ↔ Dose moyenne** (faible):
- L'ITM dépend de la dose **totale**, pas de la moyenne quotidienne
- Deux lots peuvent avoir même dose moyenne mais durées différentes

**ITM ↔ Nb canards** (très faible):
- Taille du lot indépendante de l'efficacité de conversion

---

## Visualisation Network Graph

### Avant (formule incorrecte)
```
ITM (violet)
  ↓ (lien rouge fort)
Gain poids (bleu)
  ↑ (lien vert fort)
Dose totale (vert)

Problème: ITM corrélé au gain de poids total
(logique incorrecte)
```

### Après (formule correcte)
```
         Poids foie (bleu)
              ↑ (lien vert TRÈS ÉPAIS r≈0.9)
              │
         ITM (violet)
              ↓ (lien rouge épais r≈-0.7)
              │
       Dose totale (vert)
              ↑ (lien vert)
         Poids final (bleu)

Logique: ITM = f(poids_foie, dose_totale)
```

**Nœud central**: `Poids foie` devrait avoir:
- Lien très fort vers **ITM** (numérateur)
- Lien fort vers **Poids final** (corrélation biologique)
- Lien moyen vers **Dose totale**

---

## Exemple Numérique

### Lot A: Bonne conversion
- Poids foie: **700g**
- Dose totale: **10 kg**
- **ITM = 700 / 10 = 70 g/kg** ✅ (bon)

### Lot B: Conversion moyenne
- Poids foie: **600g**
- Dose totale: **12 kg**
- **ITM = 600 / 12 = 50 g/kg** (moyen)

### Lot C: Conversion faible
- Poids foie: **500g**
- Dose totale: **15 kg**
- **ITM = 500 / 15 = 33 g/kg** (faible)

**Interprétation**:
- Lot A: Meilleure efficacité (70g de foie par kg de maïs)
- Lot B: Efficacité moyenne
- Lot C: Conversion inefficace (trop de maïs pour peu de foie)

---

## Impact sur les Autres Graphiques

### ViolinPlotDistributions.tsx

Ce composant simule déjà le poids de foie:
```typescript
// Formule approximative: poids_foie = dose_moyenne * 0.15 + bruit
const poidsBase = d.dose_reelle_g * 0.15;
const bruit = (Math.random() - 0.5) * 50; // ±25g variabilité
return Math.max(200, poidsBase + bruit); // Min 200g
```

**Cohérent** avec le Network Graph (utilise doses pour estimer foie).

### HeatmapPerformance.tsx

Affiche les écarts de doses, pas directement lié à l'ITM.

**Aucun changement nécessaire.**

---

## Champs Base de Données Recommandés

Pour des calculs précis, la table `lots` devrait avoir:

```sql
-- Champs recommandés table lots
poids_foie_moyen FLOAT,          -- Poids foie moyen à l'abattage (g)
poids_foie_min FLOAT,            -- Foie le plus léger du lot (g)
poids_foie_max FLOAT,            -- Foie le plus lourd du lot (g)
itm FLOAT,                       -- ITM calculé réel
taux_fonte FLOAT,                -- % de fonte à la cuisson
classement_qualite VARCHAR(5),   -- A+, A, B, C, D
```

**Si ces champs sont NULL**: Le composant utilise l'estimation 10% du poids final.

**Si renseignés**: Le composant utilise les valeurs réelles.

---

## Fichier Modifié

[components/analytics/NetworkGraphCorrelations.tsx](components/analytics/NetworkGraphCorrelations.tsx)

**Sections modifiées**:
1. **Ligne 67**: Ajout variable `poids_foie: []`
2. **Lignes 102-107**: Calcul poids_foie + ITM corrigé
3. **Ligne 113**: Push poids_foie dans variables
4. **Ligne 196**: Label "Poids foie"
5. **Ligne 210**: Catégorie 'canard' pour poids_foie

**Lignes ajoutées**: 7
**Formule corrigée**: ITM = poids_foie / (dose_totale / 1000)

---

## Tests à Effectuer

### Test 1: Variable Poids foie visible
- [ ] Ouvrir `/analytics` → "Réseau Corrélations"
- [ ] Compter les nœuds: devrait y avoir **13** (au lieu de 12)
- [ ] Chercher nœud bleu "Poids foie"
- [ ] Devrait être dans le cluster bleu (catégorie canard)

### Test 2: Corrélation ITM ↔ Poids foie
- [ ] Chercher lien entre "ITM" (violet) et "Poids foie" (bleu)
- [ ] Devrait être un lien **VERT TRÈS ÉPAIS** (corrélation positive forte)
- [ ] Survoler: coefficient r devrait être > 0.8

### Test 3: Corrélation ITM ↔ Dose totale
- [ ] Chercher lien entre "ITM" (violet) et "Dose totale" (vert)
- [ ] Devrait être un lien **ROUGE ÉPAIS** (corrélation négative forte)
- [ ] Survoler: coefficient r devrait être < -0.6

### Test 4: Valeurs ITM réalistes
- [ ] Ouvrir console DevTools
- [ ] Vérifier que les valeurs ITM sont entre 30-100 g/kg
- [ ] Pas de valeurs aberrantes (>200 ou <10)

---

## Formule Mathématique Complète

### ITM Standard
```
ITM = (Σ poids_foie_i / n) / (Σ dose_totale_i / 1000)

Où:
  - n = nombre de canards du lot
  - poids_foie_i = poids du foie du canard i (grammes)
  - dose_totale_i = somme des doses du canard i (grammes)
  - Division par 1000 pour convertir g → kg
```

### ITM avec Estimation
Si `poids_foie_moyen` non disponible:
```
ITM ≈ (poids_final_moyen × 0.10) / (dose_totale / 1000)

Où:
  - 0.10 = ratio foie/poids total pour canard gavé (10%)
  - poids_final_moyen en grammes
  - dose_totale en grammes
```

---

## Conclusion

✅ **Formule ITM corrigée**: Utilise poids de foie au lieu de gain de poids total

✅ **13 variables** au lieu de 12 (ajout poids_foie)

✅ **Corrélations logiques**:
   - ITM ↔ Poids foie: **positive forte** (r ≈ 0.9)
   - ITM ↔ Dose totale: **négative forte** (r ≈ -0.7)

✅ **Valeurs réalistes**: 30-100 g/kg au lieu de 2-200

✅ **Estimation intelligente**: 10% du poids final si données réelles manquantes

Le Network Graph affiche maintenant la vraie relation entre ITM, poids de foie et dose totale, conforme à la définition zootechnique de l'Indice de Transformation du Maïs.

---

**Status**: ✅ FORMULE CORRIGÉE
**Auteur**: Claude Sonnet 4.5
**Date**: 12 Janvier 2026
