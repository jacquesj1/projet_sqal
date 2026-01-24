# Proposition Architecture Analytics & Intelligence - Euralis

**Date**: 09 Janvier 2026
**Auteur**: Claude Code
**Status**: 📋 Proposition à Valider

---

## 🎯 Objectif

Définir une **architecture cohérente** pour l'analytics et l'intelligence artificielle à **3 niveaux** :
1. **Niveau Global** (Euralis) - Vue multi-sites
2. **Niveau Site** (LL/LS/MT) - Analytics par site
3. **Niveau Gaveur** - Analytics individualisé

---

## 📊 État Actuel

### Pages Existantes

```
euralis-frontend/app/euralis/
├── dashboard/           ✅ KPIs globaux + graphiques
├── analytics/           ✅ Analytics global (Forecasts, Clusters, Anomalies, Optimization)
├── sites/               ✅ Liste des 3 sites
│   └── [code]/
│       ├── page.tsx     ✅ Détails site (stats basiques)
│       ├── gaveurs/     ✅ Liste gaveurs du site
│       └── lots/        ✅ Liste lots du site
├── gaveurs/             ✅ Liste tous gaveurs
├── previsions/          ❓ Prévisions (doublon avec analytics?)
├── qualite/             ❓ Contrôle qualité
├── abattages/           ❓ Planning abattages
└── finance/             ❓ Finances
```

### Modules ML Backend Disponibles

**[backend-api/app/ml/euralis/](../backend-api/app/ml/euralis/)**:
1. `production_forecasting.py` - Prophet (prévisions 7/30/90 jours)
2. `gaveur_clustering.py` - K-Means (5 clusters de performance)
3. `anomaly_detection.py` - Isolation Forest (détection lots anormaux)
4. `abattage_optimization.py` - Hungarian Algorithm (planning optimal)

**[backend-api/app/ml/](../backend-api/app/ml/)**:
5. `symbolic_regression.py` - PySR (formules gavage optimales)
6. `feedback_optimizer.py` - Random Forest (optimisation via feedbacks consommateurs)

### Endpoints API Backend

**Analytics Globaux**:
- `GET /api/euralis/ml/forecasts?days=30` - Prévisions production
- `GET /api/euralis/ml/clusters` - Clustering gaveurs
- `GET /api/euralis/ml/anomalies` - Détection anomalies
- `GET /api/euralis/ml/optimization?days=7` - Plans abattage

**Par Site**:
- `GET /api/euralis/sites/{code}/stats` - Stats site (ITM, mortalité, etc.)
- `GET /api/euralis/sites/{code}/lots` - Lots du site
- `GET /api/euralis/sites/{code}/gaveurs` - Gaveurs du site

**Par Gaveur**:
- Pas d'endpoints analytics spécifiques actuellement ❌

---

## 🏗️ Architecture Proposée

### Principe: Analytics en "Drill-Down"

```
┌──────────────────────────────────────────────────────────────┐
│  NIVEAU 1: EURALIS (Multi-Sites)                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ /euralis/dashboard           ✅ Opérationnel           │  │
│  │  - KPIs globaux (tous sites)                           │  │
│  │  - Graphiques production agrégée                       │  │
│  │  - Alertes critiques                                   │  │
│  │  - Vue d'ensemble temps réel                           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ /euralis/analytics           ✅ Opérationnel           │  │
│  │  - Prévisions Prophet (30j)                            │  │
│  │  - Clustering gaveurs (tous sites)                     │  │
│  │  - Anomalies globales                                  │  │
│  │  - Optimisation abattages (tous sites)                 │  │
│  │  - Insights IA automatiques                            │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              ↓
                         DRILL-DOWN
                              ↓
┌──────────────────────────────────────────────────────────────┐
│  NIVEAU 2: SITE (LL / LS / MT)                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ /euralis/sites/[code]        ✅ Existe (basique)       │  │
│  │  - Stats site (ITM, mortalité, production)             │  │
│  │  - Liste lots récents                                  │  │
│  │  - Liens Gaveurs / Lots                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ /euralis/sites/[code]/analytics  ⚠️ À CRÉER           │  │
│  │  - Prévisions production SITE (7/30j)                  │  │
│  │  - Clustering gaveurs du SITE                          │  │
│  │  - Anomalies lots du SITE                              │  │
│  │  - Performance SITE vs autres sites                    │  │
│  │  - Recommandations IA pour le site                     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              ↓
                         DRILL-DOWN
                              ↓
┌──────────────────────────────────────────────────────────────┐
│  NIVEAU 3: GAVEUR (Individuel)                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ /euralis/gaveurs/[id]        ⚠️ À CRÉER               │  │
│  │  - Profil gaveur (nom, site, contact)                  │  │
│  │  - Statistiques personnelles (ITM, mortalité)          │  │
│  │  - Historique lots                                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ /euralis/gaveurs/[id]/analytics  ⚠️ À CRÉER           │  │
│  │  - Performance gaveur vs moyenne site/euralis          │  │
│  │  - Tendances ITM/mortalité personnelles                │  │
│  │  - Recommandations IA personnalisées                   │  │
│  │  - Cluster d'appartenance (ex: "Top Performers")       │  │
│  │  - Prévisions performance 7j                           │  │
│  │  - Feedback optimizer (courbes gavage optimales)       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🗺️ Navigation Recommandée

### Option 1: Onglet "Analytics" dans Chaque Page (✅ RECOMMANDÉ)

**Avantage**: Navigation claire et cohérente

```
/euralis/sites
├── Tab "Vue d'ensemble"  (liste sites)
└── Tab "Analytics Global" (→ redirige vers /euralis/analytics)

/euralis/sites/LL
├── Tab "Vue d'ensemble"  (stats, lots récents)
├── Tab "Gaveurs"         (→ /euralis/sites/LL/gaveurs)
├── Tab "Lots"            (→ /euralis/sites/LL/lots)
└── Tab "Analytics"       (→ /euralis/sites/LL/analytics) ⚠️ À CRÉER

/euralis/gaveurs/1
├── Tab "Profil"          (infos personnelles, historique)
└── Tab "Analytics"       (→ /euralis/gaveurs/1/analytics) ⚠️ À CRÉER
```

### Option 2: Section "Analytics" dans la Même Page (❌ Non Recommandé)

**Inconvénient**: Page trop longue, scrolling excessif

```
/euralis/sites/LL
├── Section Stats
├── Section Lots Récents
└── Section Analytics (dans la même page)
```

### Option 3: Menu Latéral "Analytics" (Alternative)

**Avantage**: Toujours visible
**Inconvénient**: Prend de l'espace écran

```
┌────────────┬─────────────────────────────────┐
│ Dashboard  │                                 │
│ Sites      │  Contenu Principal              │
│ Analytics  │  (Dashboard / Sites / etc.)     │
│ Gaveurs    │                                 │
│ Lots       │                                 │
│ Qualité    │                                 │
└────────────┴─────────────────────────────────┘
```

---

## 📋 Plan d'Implémentation Recommandé

### Phase 1: Analytics Niveau Site ⭐ PRIORITAIRE

**Objectif**: Permettre drill-down Euralis → Site → Analytics Site

**Pages à créer**:
1. `/euralis/sites/[code]/analytics/page.tsx`

**Contenu**:
```tsx
interface SiteAnalyticsPage {
  tabs: [
    {
      id: 'forecasts',
      label: 'Prévisions',
      content: {
        // Prévisions production SITE uniquement (7/30j)
        // Filtrer forecasts globaux par site_code
        // API: GET /api/euralis/ml/forecasts?site_code=LL&days=30
      }
    },
    {
      id: 'gaveurs',
      label: 'Gaveurs du Site',
      content: {
        // Clustering gaveurs du SITE uniquement
        // Filtrer clusters par site_code
        // API: GET /api/euralis/ml/clusters?site_code=LL
      }
    },
    {
      id: 'anomalies',
      label: 'Anomalies',
      content: {
        // Lots anormaux du SITE uniquement
        // Filtrer anomalies par site_code
        // API: GET /api/euralis/ml/anomalies?site_code=LL
      }
    },
    {
      id: 'performance',
      label: 'Performance',
      content: {
        // Comparaison SITE vs autres sites
        // Graphique évolution ITM/mortalité du site
        // Benchmark: LL vs LS vs MT
        // API: GET /api/euralis/sites/compare
      }
    }
  ],
  kpis: {
    // KPIs spécifiques au site
    // Prévision 7j du SITE
    // Nombre gaveurs du SITE
    // Anomalies du SITE
    // Performance moyenne du SITE
  }
}
```

**Modifications backend nécessaires**:
```python
# backend-api/app/routers/euralis.py

@router.get("/ml/forecasts")
async def get_forecasts(
    days: int = 30,
    site_code: Optional[str] = None  # ✅ AJOUTER
):
    """Prévisions production (optionnel: filtrer par site)"""
    # Si site_code fourni, filtrer par site
    # Sinon, retourner prévisions globales
    pass

@router.get("/ml/clusters")
async def get_clusters(
    site_code: Optional[str] = None  # ✅ AJOUTER
):
    """Clustering gaveurs (optionnel: filtrer par site)"""
    pass

@router.get("/ml/anomalies")
async def get_anomalies(
    site_code: Optional[str] = None  # ✅ AJOUTER
):
    """Anomalies (optionnel: filtrer par site)"""
    pass
```

**Navigation**:
```tsx
// /euralis/sites/[code]/page.tsx

<div className="flex items-center gap-4">
  <button onClick={() => router.push(`/euralis/sites/${siteCode}`)}>
    Vue d'ensemble
  </button>
  <button onClick={() => router.push(`/euralis/sites/${siteCode}/gaveurs`)}>
    Gaveurs
  </button>
  <button onClick={() => router.push(`/euralis/sites/${siteCode}/lots`)}>
    Lots
  </button>
  <button onClick={() => router.push(`/euralis/sites/${siteCode}/analytics`)}>
    📊 Analytics  {/* ✅ NOUVEAU */}
  </button>
</div>
```

---

### Phase 2: Analytics Niveau Gaveur

**Objectif**: Analytics personnalisé par gaveur

**Pages à créer**:
1. `/euralis/gaveurs/[id]/page.tsx` (profil gaveur)
2. `/euralis/gaveurs/[id]/analytics/page.tsx` (analytics gaveur)

**Contenu Analytics Gaveur**:
```tsx
interface GaveurAnalyticsPage {
  tabs: [
    {
      id: 'performance',
      label: 'Performance',
      content: {
        // Graphique évolution ITM gaveur
        // Comparaison gaveur vs moyenne site
        // Comparaison gaveur vs moyenne euralis
        // Tendance: amélioration ou dégradation?
      }
    },
    {
      id: 'cluster',
      label: 'Profil',
      content: {
        // Cluster d'appartenance (ex: "Top Performers")
        // Caractéristiques du cluster
        // Autres gaveurs du même cluster
        // Recommandations pour passer au cluster supérieur
      }
    },
    {
      id: 'recommendations',
      label: 'Recommandations IA',
      content: {
        // Courbes gavage optimales (PySR)
        // Doses recommandées (Feedback Optimizer)
        // Axes d'amélioration personnalisés
        // Benchmarks vs top performers
      }
    },
    {
      id: 'forecasts',
      label: 'Prévisions',
      content: {
        // Prévision production gaveur 7j
        // Prévision ITM 7j
        // Alertes préventives (risque mortalité, etc.)
      }
    }
  ]
}
```

**Endpoints backend nécessaires**:
```python
# backend-api/app/routers/euralis.py

@router.get("/gaveurs/{gaveur_id}/analytics")
async def get_gaveur_analytics(gaveur_id: int):
    """Analytics personnalisé gaveur"""
    return {
        "gaveur_id": gaveur_id,
        "performance": {
            "itm_moyen": 0.62,
            "mortalite": 2.3,
            "tendance_itm": "+5.2%",  # vs mois dernier
            "rank_site": 3,  # 3ème/10 gaveurs du site
            "rank_euralis": 12  # 12ème/30 gaveurs euralis
        },
        "cluster": {
            "cluster_id": 2,
            "label": "High Performers",
            "performance_score": 0.82
        },
        "recommendations": [
            "Augmenter dose matin de 10g (optim IA)",
            "Réduire variation doses (plus stable = meilleur ITM)"
        ],
        "forecasts": {
            "itm_7j": 0.64,
            "production_7j_kg": 450
        }
    }

@router.get("/gaveurs/{gaveur_id}/courbes-optimales")
async def get_gaveur_optimal_curves(gaveur_id: int):
    """Courbes gavage optimales (PySR + Feedback Optimizer)"""
    # Retourner courbes recommandées basées sur:
    # 1. Historique gaveur
    # 2. Feedbacks consommateurs (via Feedback Optimizer)
    # 3. Formules PySR
    pass
```

---

### Phase 3: Consolidation Navigation

**Objectif**: Menu cohérent sur toutes les pages

**Composant Partagé**: `AnalyticsNavigation.tsx`

```tsx
// euralis-frontend/components/AnalyticsNavigation.tsx

interface AnalyticsNavigationProps {
  level: 'global' | 'site' | 'gaveur';
  entityCode?: string;  // Code site (LL/LS/MT) ou ID gaveur
  currentPath: string;
}

export function AnalyticsNavigation({ level, entityCode, currentPath }: AnalyticsNavigationProps) {
  const links = {
    global: [
      { href: '/euralis/dashboard', label: 'Dashboard', icon: Home },
      { href: '/euralis/analytics', label: 'Analytics Global', icon: Brain }
    ],
    site: [
      { href: `/euralis/sites/${entityCode}`, label: 'Vue d'ensemble', icon: Home },
      { href: `/euralis/sites/${entityCode}/gaveurs`, label: 'Gaveurs', icon: Users },
      { href: `/euralis/sites/${entityCode}/lots`, label: 'Lots', icon: Package },
      { href: `/euralis/sites/${entityCode}/analytics`, label: 'Analytics', icon: Brain }
    ],
    gaveur: [
      { href: `/euralis/gaveurs/${entityCode}`, label: 'Profil', icon: User },
      { href: `/euralis/gaveurs/${entityCode}/analytics`, label: 'Analytics', icon: Brain }
    ]
  };

  return (
    <nav className="flex gap-4 border-b border-gray-200">
      {links[level].map(link => (
        <a
          key={link.href}
          href={link.href}
          className={currentPath === link.href ? 'border-b-2 border-blue-600' : ''}
        >
          <link.icon className="h-4 w-4" />
          {link.label}
        </a>
      ))}
    </nav>
  );
}
```

**Utilisation**:
```tsx
// /euralis/sites/[code]/analytics/page.tsx

export default function SiteAnalyticsPage() {
  const params = useParams();
  const pathname = usePathname();

  return (
    <div>
      <AnalyticsNavigation
        level="site"
        entityCode={params.code as string}
        currentPath={pathname}
      />
      {/* Contenu analytics site */}
    </div>
  );
}
```

---

## 🎨 Design System Analytics

### Couleurs par Type Analytics

```tsx
const analyticsColors = {
  forecasts: {
    primary: 'blue-600',    // Prévisions
    bg: 'blue-50',
    border: 'blue-200'
  },
  clusters: {
    primary: 'green-600',   // Clustering
    bg: 'green-50',
    border: 'green-200'
  },
  anomalies: {
    primary: 'orange-600',  // Anomalies
    bg: 'orange-50',
    border: 'orange-200'
  },
  optimization: {
    primary: 'purple-600',  // Optimisation
    bg: 'purple-50',
    border: 'purple-200'
  }
};
```

### Icônes Cohérentes (lucide-react)

```tsx
import {
  Brain,           // Analytics général
  TrendingUp,      // Prévisions/Forecasts
  Users,           // Clustering
  AlertTriangle,   // Anomalies
  Target,          // Optimisation
  Sparkles,        // Insights IA
  BarChart3        // Graphiques
} from 'lucide-react';
```

---

## 📊 Comparaison Options

| Critère | Option 1: Tabs Analytics | Option 2: Section Inline | Option 3: Menu Latéral |
|---------|-------------------------|--------------------------|------------------------|
| **Clarté navigation** | ⭐⭐⭐⭐⭐ Excellente | ⭐⭐⭐ Moyenne | ⭐⭐⭐⭐ Bonne |
| **Facilité implémentation** | ⭐⭐⭐⭐ Facile | ⭐⭐⭐⭐⭐ Très facile | ⭐⭐⭐ Moyenne |
| **Performance** | ⭐⭐⭐⭐ Bonne (lazy load) | ⭐⭐ Mauvaise (tout chargé) | ⭐⭐⭐⭐ Bonne |
| **UX cohérence** | ⭐⭐⭐⭐⭐ Très cohérente | ⭐⭐⭐ Moyenne | ⭐⭐⭐⭐ Cohérente |
| **Scalabilité** | ⭐⭐⭐⭐⭐ Excellente | ⭐⭐ Limitée | ⭐⭐⭐⭐ Bonne |

**Recommandation**: **Option 1 - Tabs Analytics** ✅

---

## 🚀 Roadmap d'Implémentation

### Sprint 1 (1-2 jours): Analytics Niveau Site

**Objectif**: Créer `/euralis/sites/[code]/analytics`

**Tâches**:
- [ ] Créer page `/euralis/sites/[code]/analytics/page.tsx`
- [ ] Ajouter paramètres `site_code` aux endpoints ML backend
- [ ] Implémenter 4 tabs: Prévisions, Gaveurs, Anomalies, Performance
- [ ] Ajouter navigation tabs sur `/euralis/sites/[code]`
- [ ] Tests visuels

**Estimation**: 8-12 heures

---

### Sprint 2 (2-3 jours): Analytics Niveau Gaveur

**Objectif**: Créer profil + analytics gaveur

**Tâches**:
- [ ] Créer page `/euralis/gaveurs/[id]/page.tsx` (profil)
- [ ] Créer page `/euralis/gaveurs/[id]/analytics/page.tsx`
- [ ] Créer endpoint `GET /api/euralis/gaveurs/{id}/analytics`
- [ ] Créer endpoint `GET /api/euralis/gaveurs/{id}/courbes-optimales`
- [ ] Implémenter 4 tabs: Performance, Cluster, Recommandations, Prévisions
- [ ] Tests visuels

**Estimation**: 12-16 heures

---

### Sprint 3 (1 jour): Consolidation Navigation

**Objectif**: Navigation cohérente partout

**Tâches**:
- [ ] Créer composant `AnalyticsNavigation.tsx`
- [ ] Intégrer dans toutes les pages analytics
- [ ] Breadcrumbs cohérents
- [ ] Tests navigation complète (drill-down)

**Estimation**: 4-6 heures

---

### Sprint 4 (1 jour): Optimisations

**Objectif**: Performance et UX

**Tâches**:
- [ ] Lazy loading tabs analytics
- [ ] Caching données ML (React Query)
- [ ] Graphiques interactifs (Chart.js)
- [ ] Loading states cohérents
- [ ] Error handling

**Estimation**: 6-8 heures

---

## 🎯 Décision Recommandée

### Architecture Retenue: Drill-Down avec Tabs

```
1. NIVEAU GLOBAL
   /euralis/dashboard       → KPIs temps réel
   /euralis/analytics       → Analytics ML global

2. NIVEAU SITE
   /euralis/sites/[code]    → Stats site
   /euralis/sites/[code]/analytics  ✅ À CRÉER

3. NIVEAU GAVEUR
   /euralis/gaveurs/[id]    ✅ À CRÉER
   /euralis/gaveurs/[id]/analytics  ✅ À CRÉER
```

### Navigation: Tabs Horizontaux

```tsx
<Tabs>
  <Tab>Vue d'ensemble</Tab>
  <Tab>Gaveurs</Tab>
  <Tab>Lots</Tab>
  <Tab>📊 Analytics</Tab>  {/* Icône pour visibilité */}
</Tabs>
```

### Priorisation

**Phase 1** (prioritaire): Analytics Niveau Site
- Impact: Moyen-Fort
- Complexité: Moyenne
- ROI: ⭐⭐⭐⭐

**Phase 2**: Analytics Niveau Gaveur
- Impact: Fort (gamification, engagement gaveurs)
- Complexité: Moyenne-Haute
- ROI: ⭐⭐⭐⭐⭐

**Phase 3**: Consolidation
- Impact: Moyen (UX)
- Complexité: Faible
- ROI: ⭐⭐⭐

---

## ❓ Questions à Clarifier

1. **Scope Analytics Gaveur**: Accessibles par **superviseurs Euralis uniquement**, ou aussi par **les gaveurs eux-mêmes** via frontend gaveurs?

2. **Temps réel vs Batch**: Les analytics doivent-ils être **temps réel** (calcul à la demande) ou **batch** (pré-calculés nuit)?

3. **Alertes**: Faut-il ajouter des **alertes ML** (ex: "Gaveur 5 montre signes de dégradation ITM")?

4. **Mobile**: L'interface analytics doit-elle être **responsive mobile** dès le début?

5. **Export**: Besoin d'**export Excel/PDF** des rapports analytics?

---

## 📝 Conclusion

**Recommandation finale**: Implémenter architecture **drill-down avec tabs** en **3 sprints** (5-7 jours total).

**Prochaine étape**: Valider cette proposition et démarrer **Sprint 1** (Analytics Niveau Site).

---

**Auteur**: Claude Code
**Date**: 09 Janvier 2026
**Version**: 1.0
**Status**: 📋 Proposition à Valider
