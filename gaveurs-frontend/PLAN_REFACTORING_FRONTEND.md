# Plan de Refactoring Frontend Gaveurs

**Date**: 11 Janvier 2026
**Objectif**: Nettoyer et restructurer le frontend gaveurs autour du Dashboard 3-Courbes comme page centrale

---

## Analyse de l'Existant

### Pages Actuelles (32 pages)

#### Authentification (4 pages)
- `/login` - Page connexion
- `/register` - Page inscription
- `/forgot-password` - Mot de passe oublie
- Layout auth

#### Pages Principales LOTS (7 pages)
- `/` - Accueil (redirige vers /lots)
- `/lots` - Liste des lots ✅ **A GARDER**
- `/lots/[id]/courbes-sprint3` - Dashboard 3-Courbes ⭐ **NOUVELLE PAGE ACCUEIL**
- `/lots/[id]/courbes` - Anciennes courbes (deprecated)
- `/lots/[id]/gavage` - Saisie gavage quotidien ✅ **A GARDER**
- `/lots/[id]/historique` - Historique des saisies ✅ **A GARDER**
- `/lots/[id]/rattrapage` - Suggestions rattrapage (redondant avec courbes-sprint3)
- `/lots/gavages` - Vue globale gavages (?)

#### Pages Secondaires (10 pages)
- `/saisie-rapide` - Saisie rapide multi-lots ✅ **A GARDER**
- `/alertes` - Liste alertes ✅ **A GARDER**
- `/analytics` - Analytics basiques ❌ **A REFAIRE avec D3.js**
- `/dashboard-analytics` - Doublon analytics? ❌ **A SUPPRIMER ou FUSIONNER**
- `/environnement` - Donnees meteo/environnement ✅ **A GARDER**
- `/veterinaires` - Interventions veterinaires ✅ **A GARDER**
- `/certifications` - Certifications qualite ⚠️ **A EVALUER**
- `/photos/upload` - Upload photos foies ⚠️ **A EVALUER (SQAL?)**
- `/scan` - Scanner QR codes ⚠️ **A EVALUER (Blockchain?)**
- `/simulations` - Simulations IA? ⚠️ **A EVALUER**

#### Pages Demo/Dev (2 pages)
- `/demo` - Page demo ❌ **A SUPPRIMER (prod)**
- `/demo/menu` - Menu demo ❌ **A SUPPRIMER (prod)**

#### Pages Blockchain (2 pages)
- `/blockchain` - Integration blockchain ✅ **A GARDER**
- `/blockchain-explorer` - Explorer blockchain ✅ **A GARDER**

#### Pages IA/Training (2 pages)
- `/ai-training` - Entrainement modeles IA ⚠️ **A EVALUER (admin only?)**
- `/gavage` - Page gavage globale? ❌ **DOUBLON?**

#### Pages Systeme (3 pages)
- `/error.tsx` - Page erreur ✅ **A GARDER**
- `/loading.tsx` - Loading global ✅ **A GARDER**
- `/not-found.tsx` - 404 ✅ **A GARDER**

---

## Decision: Pages a Garder/Supprimer/Refaire

### ✅ A GARDER (15 pages)

**Core Gavage**:
1. `/lots` - Liste lots
2. `/lots/[id]/courbes-sprint3` - Dashboard 3-Courbes ⭐
3. `/lots/[id]/gavage` - Saisie quotidienne
4. `/lots/[id]/historique` - Historique
5. `/saisie-rapide` - Saisie rapide

**Suivi & Alertes**:
6. `/alertes` - Alertes
7. `/environnement` - Meteo/environnement
8. `/veterinaires` - Interventions veto

**Blockchain**:
9. `/blockchain` - Integration
10. `/blockchain-explorer` - Explorer

**Auth**:
11. `/login`
12. `/register`
13. `/forgot-password`

**Systeme**:
14. `/error.tsx`
15. `/loading.tsx`
16. `/not-found.tsx`

---

### ❌ A SUPPRIMER (8 pages)

1. `/lots/[id]/courbes` - Remplace par courbes-sprint3
2. `/lots/[id]/rattrapage` - Redondant avec courbes-sprint3 (courbe orange)
3. `/lots/gavages` - Redondant avec /lots
4. `/dashboard-analytics` - Doublon avec /analytics
5. `/gavage` - Doublon avec /lots/[id]/gavage
6. `/demo` - Environnement dev
7. `/demo/menu` - Environnement dev
8. `/certifications` - Peu utilise, fusionner dans /lots/[id]

---

### 🔄 A REFAIRE (1 page)

1. `/analytics` - **Refaire completement avec D3.js**
   - Actuellement: Charts basiques Chart.js
   - Nouveau: Visualisations avancees D3.js
   - Contenu: Heatmaps, Sankey, Network graphs, Violin plots

---

### ⚠️ A EVALUER (4 pages)

1. `/photos/upload` - Utile si integration SQAL manuelle? Sinon supprimer
2. `/scan` - Scanner QR blockchain? A garder si usage reel
3. `/simulations` - Simulations IA? Clarifier usage
4. `/ai-training` - Admin only? Deplacer vers interface Euralis?

---

## Nouvelle Structure Proposee

### Navigation Principale (6 entrees)

```
┌─────────────────────────────────────────────────┐
│  LOGO  |  Dashboard  |  Lots  |  Alertes  |  Analytics  |  Blockchain  │
└─────────────────────────────────────────────────┘
```

**1. Dashboard (/) - NOUVELLE PAGE ACCUEIL** ⭐
- Affiche Dashboard 3-Courbes du lot actif
- Selecteur de lot en haut (dropdown)
- Acces rapide: Saisie quotidienne, Historique
- Widget: Alertes recentes (3 dernieres)
- Widget: Meteo du jour
- **Remplacement**: Actuellement `/` redirige vers `/lots`

**2. Lots (/lots)**
- Liste tous les lots (comme actuellement)
- Filtres: Statut, Date, Race
- Stats rapides: En gavage, Termines, Total canards
- Clic sur lot → Ouvre Dashboard 3-Courbes

**3. Alertes (/alertes)**
- Liste alertes par priorite
- Filtres: Type, Date, Lot
- Actions rapides

**4. Analytics (/analytics)** - REFAIT avec D3.js
- 6 visualisations avancees D3.js
- Performance multi-dimensionnelle
- Predictions IA
- Clustering gaveurs

**5. Blockchain (/blockchain)**
- Menu deroulant:
  - Integration blockchain
  - Explorer
  - Scanner QR (si garde)

**6. Menu Utilisateur (Dropdown)**
- Mon profil
- Environnement/Meteo
- Interventions veterinaires
- Saisie rapide
- Parametres
- Deconnexion

---

## Actions de Refactoring

### Phase 1: Nettoyage (1-2h)

1. **Supprimer pages obsoletes**:
   ```bash
   rm -rf gaveurs-frontend/app/lots/[id]/courbes
   rm -rf gaveurs-frontend/app/lots/[id]/rattrapage
   rm -rf gaveurs-frontend/app/lots/gavages
   rm -rf gaveurs-frontend/app/dashboard-analytics
   rm -rf gaveurs-frontend/app/gavage
   rm -rf gaveurs-frontend/app/demo
   rm -rf gaveurs-frontend/app/certifications
   ```

2. **Evaluer pages a clarifier**:
   - Tester /photos/upload → Supprimer si non utilise
   - Tester /scan → Garder si QR codes fonctionnels
   - Tester /simulations → Supprimer si non utilise
   - Deplacer /ai-training vers Euralis frontend (admin)

---

### Phase 2: Nouvelle Page Accueil (2-3h)

**Fichier**: `gaveurs-frontend/app/page.tsx`

**Fonctionnalites**:
1. **Dashboard 3-Courbes central** (comme `/lots/[id]/courbes-sprint3`)
2. **Selecteur de lot** en haut (dropdown avec recherche)
   - Liste lots actifs (en_gavage)
   - Affiche: "Lot 3468 - Mulard - J7/14"
   - Change de lot dynamiquement sans recharger

3. **Widgets lateraux**:
   - Alertes recentes (3 dernieres)
   - Meteo du jour
   - Prochaine action (J+1 dose suggeree)

4. **Actions rapides** (boutons flottants):
   - Saisir dose du jour
   - Voir historique
   - Ajouter alerte

**Layout**:
```
┌────────────────────────────────────────────────────┐
│  [Selecteur Lot ▼]              [Meteo] [Alertes]  │
├────────────────────────────────────────────────────┤
│                                                    │
│           DASHBOARD 3-COURBES IA                   │
│       (Graphique Chart.js comme Sprint 3)          │
│                                                    │
│  Courbe BLEUE: Theorique (PySR v2)                 │
│  Courbe VERTE: Reelle (saisies gaveur)             │
│  Courbe ORANGE: Predictive IA (rattrapage)         │
│                                                    │
├────────────────────────────────────────────────────┤
│  [Saisir Dose] [Historique] [Alertes] [Analytics]  │
└────────────────────────────────────────────────────┘
```

---

### Phase 3: Analytics D3.js (4-6h)

**Fichier**: `gaveurs-frontend/app/analytics/page.tsx`

**6 Visualisations D3.js**:

1. **Heatmap Performance Gaveurs** (D3.js heatmap)
   - Axes: Jours (X) × Lots (Y)
   - Couleur: Ecart vs theorique (-20% rouge → +20% vert)
   - Interactions: Hover tooltip, click pour details

2. **Sankey Flux Production** (D3.js Sankey)
   - Flux: Lots → Gaveurs → Sites → Qualite SQAL
   - Largeur = volume production

3. **Timeline Gantt Lots** (D3.js timeline)
   - Barres horizontales: Lots en cours
   - Couleur: Statut
   - Evenements: Alertes, interventions

4. **Network Graph Correlations** (D3.js force-directed)
   - Noeuds: Variables (age, race, poids, meteo, aliment)
   - Liens: Correlation avec qualite finale
   - Taille noeud = importance

5. **Treemap Repartition** (D3.js treemap)
   - Hierarchie: Sites → Gaveurs → Lots
   - Taille = production
   - Couleur = performance

6. **Violin Plot Distributions** (D3.js violin)
   - Distributions poids foie par race/site
   - Comparaison statistiques (mediane, quartiles)

**Layout Analytics**:
```
┌─────────────────────────────────────────────────┐
│  Analytics Avancees - Visualisations D3.js     │
├──────────────────┬──────────────────────────────┤
│  Heatmap         │  Sankey Flux                 │
│  Performance     │  Production                  │
├──────────────────┼──────────────────────────────┤
│  Timeline        │  Network Graph               │
│  Gantt Lots      │  Correlations                │
├──────────────────┼──────────────────────────────┤
│  Treemap         │  Violin Plot                 │
│  Repartition     │  Distributions               │
└──────────────────┴──────────────────────────────┘
```

---

### Phase 4: Restructuration Navigation (1h)

**Fichier**: `gaveurs-frontend/components/layout/Header.tsx` (ou similar)

**Nouveau menu principal**:
```tsx
const menuItems = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/lots', label: 'Lots', icon: Package },
  { href: '/alertes', label: 'Alertes', icon: AlertTriangle },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  {
    label: 'Blockchain',
    icon: Link2,
    submenu: [
      { href: '/blockchain', label: 'Integration' },
      { href: '/blockchain-explorer', label: 'Explorer' },
    ]
  },
];
```

**Menu utilisateur** (dropdown):
```tsx
const userMenuItems = [
  { href: '/saisie-rapide', label: 'Saisie Rapide', icon: Zap },
  { href: '/environnement', label: 'Environnement', icon: Cloud },
  { href: '/veterinaires', label: 'Veterinaires', icon: Heart },
  { divider: true },
  { href: '/profile', label: 'Mon Profil', icon: User },
  { href: '/logout', label: 'Deconnexion', icon: LogOut },
];
```

---

## Estimation Temps

| Phase | Tache | Temps |
|-------|-------|-------|
| 1 | Nettoyage pages obsoletes | 1-2h |
| 2 | Nouvelle page accueil Dashboard 3-Courbes | 2-3h |
| 3 | Analytics D3.js (6 visualisations) | 4-6h |
| 4 | Restructuration navigation | 1h |
| **TOTAL** | | **8-12h** |

---

## Priorites

### Priorite 1 (URGENT - Demo Client)
1. Nouvelle page accueil Dashboard 3-Courbes ⭐
2. Nettoyage pages obsoletes
3. Restructuration navigation

**Temps**: 4-6h
**Objectif**: Page accueil professionnelle pour demo

---

### Priorite 2 (IMPORTANT - Apres Demo)
1. Analytics D3.js (6 visualisations)

**Temps**: 4-6h
**Objectif**: Enrichir analytics avec visualisations avancees

---

### Priorite 3 (NICE TO HAVE)
1. Evaluer/supprimer pages secondaires (photos, scan, simulations)
2. Optimisations performance (lazy loading, code splitting)
3. Tests E2E pour nouvelle page accueil

---

## Questions a Clarifier

1. **Page /photos/upload**: Utilise pour upload manuel photos SQAL? Ou supprimer?
2. **Page /scan**: QR codes blockchain fonctionnels? Ou supprimer?
3. **Page /simulations**: Simulations IA accessibles au gaveur? Ou deplacer vers Euralis?
4. **Page /ai-training**: Admin only? Deplacer vers Euralis frontend?

---

## Architecture Fichiers Apres Refactoring

```
gaveurs-frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── page.tsx                          ⭐ NOUVELLE PAGE ACCUEIL (Dashboard 3-Courbes)
│   ├── lots/
│   │   ├── page.tsx                      ✅ Liste lots
│   │   └── [id]/
│   │       ├── gavage/page.tsx           ✅ Saisie quotidienne
│   │       └── historique/page.tsx       ✅ Historique
│   ├── saisie-rapide/page.tsx            ✅ Saisie rapide
│   ├── alertes/page.tsx                  ✅ Alertes
│   ├── analytics/page.tsx                🔄 REFAIT avec D3.js
│   ├── environnement/page.tsx            ✅ Meteo
│   ├── veterinaires/page.tsx             ✅ Interventions
│   ├── blockchain/page.tsx               ✅ Integration
│   ├── blockchain-explorer/page.tsx      ✅ Explorer
│   ├── error.tsx                         ✅ Erreur
│   ├── loading.tsx                       ✅ Loading
│   └── not-found.tsx                     ✅ 404
├── components/
│   ├── dashboard/
│   │   ├── Dashboard3Courbes.tsx         ⭐ Component reutilisable
│   │   ├── LotSelector.tsx               ⭐ Selecteur lot
│   │   └── WidgetAlertes.tsx             ⭐ Widget alertes
│   ├── analytics/
│   │   ├── HeatmapPerformance.tsx        🆕 D3.js
│   │   ├── SankeyFlux.tsx                🆕 D3.js
│   │   ├── TimelineGantt.tsx             🆕 D3.js
│   │   ├── NetworkGraph.tsx              🆕 D3.js
│   │   ├── TreemapRepartition.tsx        🆕 D3.js
│   │   └── ViolinPlot.tsx                🆕 D3.js
│   └── layout/
│       ├── Header.tsx                    🔄 Navigation simplifiee
│       └── Sidebar.tsx                   ⚠️ A evaluer (besoin?)
└── lib/
    └── d3-utils.ts                       🆕 Utilitaires D3.js

PAGES SUPPRIMEES (8):
❌ app/lots/[id]/courbes/
❌ app/lots/[id]/rattrapage/
❌ app/lots/gavages/
❌ app/dashboard-analytics/
❌ app/gavage/
❌ app/demo/
❌ app/demo/menu/
❌ app/certifications/
```

---

## Prochaines Etapes

**Immediate** (maintenant):
1. Confirmer plan avec utilisateur
2. Clarifier questions pages secondaires

**Phase 1** (aujourd'hui):
1. Creer nouvelle page accueil Dashboard 3-Courbes
2. Supprimer pages obsoletes
3. Restructurer navigation

**Phase 2** (apres demo):
1. Creer page analytics D3.js
2. Tests E2E
3. Optimisations performance

---

**Status**: PLAN PRET - EN ATTENTE VALIDATION
**Auteur**: Claude Sonnet 4.5
**Date**: 11 Janvier 2026
