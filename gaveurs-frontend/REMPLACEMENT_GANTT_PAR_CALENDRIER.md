# Remplacement Gantt → Calendrier Planning

**Date**: 12 Janvier 2026
**Contexte**: Amélioration de l'UX Analytics suite aux retours utilisateur

---

## Problème Initial

Le diagramme de Gantt Timeline présentait plusieurs limitations:
- ❌ Vue abstraite peu intuitive pour un gaveur
- ❌ Difficile de voir rapidement les lots actifs un jour donné
- ❌ Pas de navigation temporelle facile
- ❌ Pas d'interaction directe avec les lots
- ❌ Données incohérentes avec le Treemap (statuts obsolètes)

---

## Solution Implémentée: Calendrier Interactif

### Nouveau Composant: CalendrierPlanningLots.tsx

**Type de vue**: Calendrier mensuel style Google Calendar / Outlook

**Fonctionnalités principales**:

#### 1. Navigation temporelle
- **Flèches ← →**: Mois précédent/suivant
- **Bouton "Aujourd'hui"**: Retour rapide au mois en cours
- **Jour actuel**: Surligné en bleu foncé

#### 2. Affichage des événements
Chaque jour affiche:
- **Badges colorés** par statut:
  - 🟢 Vert: En gavage
  - 🔵 Bleu: Terminé
  - 🟠 Orange: Préparation
  - ⚫ Gris: Abattu
- **Code lot + Jour**: "LOT-2025-001 J5"
- **Icône alerte** ⚠️: Si alertes actives
- **Limite affichage**: 3 événements max + "+X autres"

#### 3. Interaction clic sur jour
**Modal détaillé** qui s'ouvre avec:
- Liste de tous les lots actifs ce jour
- Pour chaque lot:
  - Code lot
  - Jour de gavage
  - Nombre de canards
  - Statut avec badge coloré
  - Indicateur alerte
- **3 actions rapides**:
  - 📝 Saisir dose → `/lots/{id}/gavage`
  - 📈 Voir courbes → `/lots/{id}/courbes`
  - 📊 Analytics → `/analytics?lot={id}`

#### 4. Légende visuelle
En bas du calendrier:
- Vert: En gavage
- Bleu: Terminé
- Orange: Préparation
- Gris: Abattu
- ⚠️: Alerte active

---

## Architecture Technique

### Fichiers créés/modifiés

**1. Nouveau composant**:
```
components/analytics/CalendrierPlanningLots.tsx (430 lignes)
```

**2. Modifications**:
```
app/analytics/page.tsx
├── Import CalendrierPlanningLots (ligne 21)
├── Type TabId: 'gantt' → 'calendrier' (ligne 26)
├── Tab config: label + description (lignes 104-108)
├── Render: <CalendrierPlanningLots /> (ligne 138)
└── Explications: section calendrier (lignes 220-254)
```

### Logique de chargement des données

```typescript
loadData() {
  // 1. Charger lots du gaveur
  GET /api/lots/gaveur/{id}

  // 2. Pour chaque lot:
  //    a. Charger doses réelles (dates + jours de gavage)
  GET /api/lots/{lotId}/gavage

  //    b. Charger alertes
  GET /api/alertes/lot/{lotId}

  // 3. Construire Map<dateKey, LotEvent[]>
  //    dateKey = "YYYY-MM-DD"
  //    LotEvent = { lot_id, code_lot, statut, jour_gavage, date, nombre_canards, has_alerte }

  // 4. Stocker dans state React
  setEvents(eventsMap)
}
```

### Algorithme génération calendrier

```typescript
getDaysInMonth(date) {
  // 1. Calculer premier et dernier jour du mois
  firstDay = new Date(year, month, 1)
  lastDay = new Date(year, month + 1, 0)

  // 2. Ajouter jours du mois précédent pour compléter semaine
  startOffset = firstDay.getDay() // Lundi = 1

  // 3. Ajouter tous les jours du mois
  for (i = 1 to daysInMonth)

  // 4. Ajouter jours du mois suivant pour atteindre 42 jours (6 semaines)

  // 5. Retourner array de 42 jours
  return days[]
}
```

---

## Bénéfices Utilisateur

### Avant (Gantt)
❌ "Je vois des barres horizontales mais c'est abstrait"
❌ "Je ne sais pas quels lots je gave aujourd'hui"
❌ "Comment je vois mon planning de la semaine ?"
❌ "Les dates ne correspondent pas au Treemap"

### Après (Calendrier)
✅ **Vue familière**: Comme un agenda papier
✅ **Vision quotidienne**: "Lundi j'ai 3 lots, mardi 1 seul"
✅ **Clic = détails**: Modal avec toutes les infos + actions
✅ **Navigation intuitive**: Mois précédent/suivant, retour aujourd'hui
✅ **Cohérence**: Utilise les mêmes données que Treemap
✅ **Planification**: Anticipe les journées chargées

---

## Exemples d'Usage

### Cas 1: Planning de la semaine
**Scénario**: Le gaveur veut voir son planning de la semaine prochaine

**Actions**:
1. Ouvrir `/analytics`
2. Cliquer onglet "Calendrier Planning"
3. Naviguer au mois souhaité (flèches →)
4. Scanner visuellement les jours:
   - Lundi 13/01: 2 badges verts → 2 lots en gavage
   - Mardi 14/01: 3 badges verts → 3 lots en gavage ⚠️ Journée chargée
   - Mercredi 15/01: 1 badge vert → 1 lot en gavage

**Résultat**: Vision claire de la charge de travail

### Cas 2: Détails d'un jour spécifique
**Scénario**: Le gaveur veut voir les lots à gaver aujourd'hui

**Actions**:
1. Cliquer bouton "Aujourd'hui" (retour rapide)
2. Cliquer sur la date du jour (bleu foncé)
3. Modal s'ouvre avec:
   - LOT-2025-001 - Jour 5 - 50 canards - En gavage ✅
   - LOT-2025-003 - Jour 12 - 45 canards - En gavage ⚠️ Alerte
4. Cliquer "📝 Saisir dose" sur LOT-2025-003
5. Redirection vers page de saisie

**Résultat**: Accès rapide aux actions du jour

### Cas 3: Identifier les alertes
**Scénario**: Le gaveur veut voir s'il y a des problèmes cette semaine

**Actions**:
1. Scanner visuellement le calendrier
2. Repérer les icônes ⚠️ rouges
3. Cliquer sur un jour avec alerte
4. Modal affiche le lot concerné avec "⚠️ Alerte active"
5. Cliquer "📊 Analytics" pour analyser

**Résultat**: Détection rapide des lots problématiques

---

## Comparaison Gantt vs Calendrier

| Aspect | Gantt Timeline | Calendrier Planning |
|--------|----------------|---------------------|
| **Vue temporelle** | Barres horizontales continues | Vue mensuelle par jour |
| **Intuitivité** | ⭐⭐ Technique | ⭐⭐⭐⭐⭐ Familier |
| **Vision quotidienne** | ❌ Difficile | ✅ Immédiat |
| **Interaction** | Survol seulement | Clic → Modal détaillé |
| **Navigation** | Scroll horizontal | Mois précédent/suivant |
| **Actions rapides** | ❌ Aucune | ✅ 3 actions par lot |
| **Alertes** | Badge sur barre | Icône ⚠️ par jour |
| **Multi-lots/jour** | ❌ Invisible | ✅ Badges empilés |
| **Planification** | ⭐⭐ Abstract | ⭐⭐⭐⭐⭐ Pratique |

---

## Tests à Effectuer

### Test 1: Navigation temporelle
- [ ] Ouvrir calendrier → Affiche mois en cours
- [ ] Cliquer flèche → : Affiche mois suivant
- [ ] Cliquer flèche ← : Affiche mois précédent
- [ ] Cliquer "Aujourd'hui" : Retour au mois actuel
- [ ] Jour actuel surligné en bleu foncé

### Test 2: Affichage des événements
- [ ] Jours avec gavage affichent badges colorés
- [ ] Badge vert pour lots en gavage
- [ ] Badge bleu pour lots terminés
- [ ] Code lot + jour visible (ex: "LOT-001 J5")
- [ ] Icône ⚠️ si alerte active
- [ ] "+X autres" si plus de 3 lots/jour

### Test 3: Modal de détail
- [ ] Clic sur jour avec événements ouvre modal
- [ ] Modal affiche tous les lots du jour
- [ ] Code lot, jour gavage, canards affichés
- [ ] Badge statut coloré
- [ ] Indicateur alerte si présent
- [ ] 3 boutons d'action fonctionnels
- [ ] Clic bouton X ferme modal
- [ ] Clic en dehors ferme modal

### Test 4: Filtrage par lot
- [ ] Avec `?lot=3468` : Affiche uniquement ce lot
- [ ] Badge filtre violet visible en haut
- [ ] Clic X sur badge enlève filtre
- [ ] Calendrier se met à jour

### Test 5: Cohérence des données
- [ ] Vérifier que lot 3468 "en gavage" apparaît en vert
- [ ] Comparer avec Treemap : statuts identiques
- [ ] Vérifier que dates correspondent aux saisies réelles
- [ ] Alertes affichées cohérentes avec page Alertes

---

## Migration Utilisateur

### Communication
**Message aux gaveurs**:
> 📅 **Nouveauté: Calendrier Planning**
>
> Le graphique Gantt a été remplacé par un calendrier interactif plus pratique!
>
> **Avantages**:
> - 📆 Vue mensuelle familière (comme votre agenda)
> - 👆 Cliquez sur un jour pour voir vos lots
> - ⚡ Actions rapides: Saisir dose, Voir courbes, Analytics
> - 🔔 Alertes visibles d'un coup d'œil
>
> **Où le trouver?**
> Analytics → Onglet "Calendrier Planning"

### Formation
**Pas de formation nécessaire**: Le calendrier est auto-explicatif (interface familière)

---

## Impact Technique

**Fichiers ajoutés**: 1
- `components/analytics/CalendrierPlanningLots.tsx` (430 lignes)

**Fichiers modifiés**: 1
- `app/analytics/page.tsx` (5 sections modifiées)

**Fichiers supprimés**: 0
- `components/analytics/TimelineGanttLots.tsx` (conservé pour historique, non utilisé)

**APIs utilisées**:
- `GET /api/lots/gaveur/{id}`
- `GET /api/lots/{lotId}/gavage`
- `GET /api/alertes/lot/{lotId}`

**Dépendances**: Aucune nouvelle (React, D3.js déjà présents)

---

## Conclusion

✅ **Gantt remplacé par Calendrier**: Interface moderne et intuitive

✅ **UX améliorée**: Navigation familière, interactions riches

✅ **Cohérence des données**: Utilise les mêmes sources que les autres graphiques

✅ **Actions rapides**: Accès direct aux fonctionnalités depuis le calendrier

✅ **Planification facilitée**: Vision claire de la charge de travail quotidienne

Le calendrier répond mieux aux besoins réels des gaveurs qui pensent en termes de "journées de travail" plutôt que de "barres de temps abstraites".

---

**Status**: ✅ CALENDRIER IMPLEMENTÉ - GANTT REMPLACÉ
**Auteur**: Claude Sonnet 4.5
**Date**: 12 Janvier 2026
