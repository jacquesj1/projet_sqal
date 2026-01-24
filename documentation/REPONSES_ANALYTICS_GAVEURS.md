# Réponses - Analytics Gaveurs & Navigation

**Date**: 09 Janvier 2026

---

## 🗺️ Navigation vers Analytics Site

### Chemin Complet (Recommandé)

```
1. Login
   http://localhost:3000/login
   └─→ superviseur@euralis.fr / super123

2. Dashboard ou Navigation Menu
   http://localhost:3000/euralis/dashboard
   └─→ Click "Sites" dans menu

3. Liste Sites
   http://localhost:3000/euralis/sites
   └─→ Sélectionner site (LL/LS/MT)
   └─→ Click carte "Analytics & IA" 💡 (nouvelle carte gradient bleu→violet)

4. Analytics Site ✨
   http://localhost:3000/euralis/sites/LL/analytics
   ✅ Vous y êtes !
```

### Chemins Alternatifs

**Via Vue d'ensemble Site**:
```
/euralis/sites/LL
└─→ Click tab "Analytics" 🧠
→ /euralis/sites/LL/analytics
```

**Via URL Directe**:
```
Taper: http://localhost:3000/euralis/sites/LL/analytics
```

---

## 📋 Vos Questions & Mes Réponses

### Question 1: La page /euralis/gaveurs n'est-elle pas orientée analytics ?

**✅ RÉPONSE: OUI, vous avez raison !**

La page `/euralis/gaveurs` est déjà une page **Analytics Gaveurs Global** (tous gaveurs de tous sites).

**Contenu actuel** ([euralis-frontend/app/euralis/gaveurs/page.tsx](../euralis-frontend/app/euralis/gaveurs/page.tsx)):
- Liste performances tous gaveurs
- Clustering (cluster_id, cluster_label)
- ITM moyen, mortalité, production
- Filtres par site et cluster
- Tri par ITM/production/mortalité

**Donc la structure est**:

```
NIVEAU 1 - GLOBAL
├── /euralis/analytics          → Analytics ML global (Forecasts, Anomalies, Optimization)
└── /euralis/gaveurs            → Analytics Gaveurs global (tous sites) ✅ EXISTE DÉJÀ

NIVEAU 2 - SITE
├── /euralis/sites/[code]/analytics  → Analytics Site (filtré par site) ✅ CRÉÉ SPRINT 1
└── /euralis/sites/[code]/gaveurs    → Liste gaveurs du site (basique) ✅ EXISTE

NIVEAU 3 - GAVEUR INDIVIDUEL
├── /euralis/gaveurs/[id]            → Profil gaveur ⚠️ À CRÉER
└── /euralis/gaveurs/[id]/analytics  → Analytics gaveur individuel ⚠️ À CRÉER
```

**Ce qui manque**: Page **analytics individuel par gaveur** (`/euralis/gaveurs/[id]/analytics`)

---

### Question 2: Accès Gaveurs aux Analytics

**Votre réponse**: "Les analytics propres à leurs données oui"

**✅ COMPRIS ! Voici l'architecture d'accès**:

```
SUPERVISEURS EURALIS (frontend Euralis)
├── ✅ Accès analytics global (/euralis/analytics)
├── ✅ Accès analytics gaveurs global (/euralis/gaveurs)
├── ✅ Accès analytics site (/euralis/sites/LL/analytics)
└── ✅ Accès analytics gaveur individuel (/euralis/gaveurs/123/analytics) - tous gaveurs

GAVEURS INDIVIDUELS (frontend Gaveurs)
├── ❌ PAS d'accès analytics global
├── ❌ PAS d'accès analytics autres gaveurs
└── ✅ Accès UNIQUEMENT leurs propres analytics (/gaveurs/dashboard avec analytics)
```

**Implémentation**:

1. **Frontend Euralis** (superviseurs):
   - Page `/euralis/gaveurs/[id]/analytics` → Voit analytics de **n'importe quel gaveur**
   - Pas de restriction

2. **Frontend Gaveurs** (gaveurs individuels):
   - Page `/dashboard` intègre **leurs propres analytics**
   - Endpoint backend: `GET /api/gaveurs/me/analytics` (JWT required)
   - Filtre automatique par `gaveur_id` extrait du token
   - **Pas d'accès** aux analytics d'autres gaveurs

**Exemple**:

```python
# Backend: backend-api/app/routers/gavage.py

@router.get("/gaveurs/me/analytics")
async def get_my_analytics(
    current_user: User = Depends(get_current_user),  # JWT auth
    conn = Depends(get_db_connection)
):
    """Analytics du gaveur connecté uniquement"""
    gaveur_id = current_user.gaveur_id

    # Performance personnelle
    my_perf = await conn.fetchrow("""
        SELECT * FROM gaveurs_performances WHERE gaveur_id = $1
    """, gaveur_id)

    # Comparaison vs moyenne site
    site_avg = await conn.fetchrow("""
        SELECT AVG(itm) as site_avg FROM gaveurs_performances
        WHERE site_code = $1
    """, current_user.site_code)

    # Recommandations IA personnalisées
    recommendations = await get_personalized_recommendations(gaveur_id)

    return {
        "gaveur_id": gaveur_id,
        "performance": my_perf,
        "vs_site_avg": {
            "itm_diff": my_perf['itm'] - site_avg['site_avg'],
            "better_than": (my_perf['itm'] > site_avg['site_avg'])
        },
        "recommendations": recommendations
    }
```

**Frontend Gaveurs intègre ces analytics dans le dashboard existant**:

```tsx
// gaveurs-frontend/app/dashboard/page.tsx

export default function GaveurDashboard() {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    // Appelle API avec JWT (auto injecté)
    fetch('/api/gaveurs/me/analytics')
      .then(res => res.json())
      .then(data => setAnalytics(data));
  }, []);

  return (
    <div>
      {/* Dashboard existant */}
      <h1>Tableau de Bord</h1>

      {/* Nouvelle section Analytics IA */}
      <section className="mt-8">
        <h2>📊 Vos Analytics IA</h2>

        {/* Performance vs moyenne site */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p>Votre ITM</p>
            <p className="text-3xl">{analytics.performance.itm} kg</p>
          </div>
          <div>
            <p>Moyenne Site</p>
            <p className="text-3xl">{analytics.vs_site_avg.site_avg} kg</p>
            <span className={analytics.vs_site_avg.better_than ? 'text-green' : 'text-red'}>
              {analytics.vs_site_avg.better_than ? '↗ Au-dessus' : '↘ En-dessous'}
            </span>
          </div>
        </div>

        {/* Recommandations IA */}
        <div className="mt-4">
          <h3>💡 Recommandations IA pour vous</h3>
          <ul>
            {analytics.recommendations.map(rec => (
              <li key={rec.id}>{rec.message}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
```

---

### Question 3: Priorité Sprint 2 (Analytics Gaveur Individuel)

**Votre réponse**: "Oui"

**✅ OK ! Voici le plan Sprint 2**:

**Objectif**: Implémenter **Analytics Niveau Gaveur Individuel**

**Pages à créer** (Frontend Euralis):
1. `/euralis/gaveurs/[id]/page.tsx` - Profil gaveur
2. `/euralis/gaveurs/[id]/analytics/page.tsx` - Analytics gaveur (4 tabs)

**Endpoints à créer** (Backend):
1. `GET /api/euralis/gaveurs/{id}` - Détails gaveur
2. `GET /api/euralis/gaveurs/{id}/analytics` - Analytics gaveur
3. `GET /api/euralis/gaveurs/{id}/courbes-optimales` - Courbes PySR + Feedback Optimizer

**Contenu Analytics Gaveur** (4 tabs):

1. **Performance** 📊
   - Graphique évolution ITM gaveur (30j)
   - Comparaison vs moyenne site
   - Comparaison vs moyenne Euralis
   - Rang site (3ème/10) + rang Euralis (12ème/30)

2. **Profil & Cluster** 👥
   - Cluster d'appartenance (ex: "High Performers")
   - Caractéristiques du cluster
   - Autres gaveurs du même cluster
   - Recommandations pour passer au cluster supérieur

3. **Recommandations IA** 💡
   - Courbes gavage optimales (PySR)
   - Doses recommandées (Feedback Optimizer basé sur satisfaction consommateur)
   - Axes d'amélioration personnalisés
   - Benchmarks vs top performers

4. **Prévisions** 🔮
   - Prévision ITM 7j gaveur
   - Prévision production 7j gaveur
   - Alertes préventives (risque mortalité, etc.)

**Pages Frontend Gaveurs** (Sprint 2 bis):
- Intégrer analytics dans dashboard gaveur existant
- Section "Mes Analytics IA" avec données personnelles uniquement

---

### Question 4: Temps Réel vs Batch ML

**Votre réponse**: "Configurable avec par défaut la nuit"

**✅ IMPLÉMENTÉ !**

Fichier créé: [backend-api/app/config/ml_config.py](../backend-api/app/config/ml_config.py)

**Configuration**:

```bash
# .env backend
ML_MODE=batch                    # Mode par défaut ✅
CACHE_TTL_FORECASTS=21600        # 6h cache
CACHE_TTL_CLUSTERS=43200         # 12h cache
CACHE_TTL_ANOMALIES=3600         # 1h cache
BATCH_REFRESH_HOUR=2             # Refresh 2h du matin ✅
ALLOW_FORCE_REFRESH=true         # Autoriser force refresh manuel
```

**Modes disponibles**:

1. **Batch (défaut)** ✅
   - Calculs ML effectués la nuit (2h)
   - Résultats mis en cache
   - Performances optimales
   - Charge serveur maîtrisée

2. **Realtime**
   - Calculs ML à chaque requête
   - Pas de cache
   - Coûteux en ressources
   - Utile pour debug/dev

3. **Force Refresh**
   - Bouton "Actualiser" sur page analytics
   - Paramètre `?force_refresh=true`
   - Recalcule même en mode batch
   - Peut être désactivé (`ALLOW_FORCE_REFRESH=false`)

**Usage**:

```bash
# Mode batch (défaut) - utilise cache
GET /api/euralis/ml/forecasts?site_code=LL

# Force refresh - ignore cache
GET /api/euralis/ml/forecasts?site_code=LL&force_refresh=true
```

**Job Batch** (à implémenter):

```python
# backend-api/app/jobs/ml_refresh.py

import schedule
import time
from app.config.ml_config import MLConfig

async def refresh_all_ml_analytics():
    """Refresh tous les analytics ML (2h du matin)"""
    print(f"[{datetime.now()}] Démarrage refresh ML batch...")

    # 1. Forecasts
    await refresh_forecasts()

    # 2. Clusters
    await refresh_clusters()

    # 3. Anomalies
    await refresh_anomalies()

    # 4. Optimization
    await refresh_optimization()

    print(f"[{datetime.now()}] Refresh ML batch terminé ✅")

# Schedule job
schedule.every().day.at(f"{MLConfig.BATCH_REFRESH_HOUR:02d}:00").do(refresh_all_ml_analytics)

while True:
    schedule.run_pending()
    time.sleep(60)
```

---

## 📊 Architecture Finale Clarifiée

```
┌─────────────────────────────────────────────────────────────────┐
│ NIVEAU 1: EURALIS GLOBAL (Superviseurs uniquement)              │
├─────────────────────────────────────────────────────────────────┤
│ /euralis/dashboard           KPIs temps réel                    │
│ /euralis/analytics           Analytics ML global (Forecasts...) │
│ /euralis/gaveurs             Analytics Gaveurs global ✅        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ NIVEAU 2: SITE (Superviseurs uniquement)                        │
├─────────────────────────────────────────────────────────────────┤
│ /euralis/sites/LL            Vue d'ensemble + tabs navigation   │
│ /euralis/sites/LL/analytics  Analytics Site ✅ SPRINT 1         │
│ /euralis/sites/LL/gaveurs    Liste gaveurs site                 │
│ /euralis/sites/LL/lots       Liste lots site                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ NIVEAU 3: GAVEUR INDIVIDUEL                                     │
├─────────────────────────────────────────────────────────────────┤
│ SUPERVISEURS (Euralis):                                         │
│ /euralis/gaveurs/[id]                Profil ⚠️ SPRINT 2        │
│ /euralis/gaveurs/[id]/analytics      Analytics ⚠️ SPRINT 2     │
│                                                                  │
│ GAVEURS (Frontend Gaveurs):                                     │
│ /dashboard                           Intègre analytics persos   │
│ API: GET /gaveurs/me/analytics       JWT auth (propres données) │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Récapitulatif Décisions

| Question | Réponse | Status |
|----------|---------|--------|
| **Page /euralis/gaveurs = analytics?** | Oui, analytics gaveurs global | ✅ Clarifié |
| **Accès gaveurs à leurs analytics?** | Oui, via frontend gaveurs + JWT | ✅ Compris |
| **Priorité Sprint 2?** | Oui, analytics gaveur individuel | ✅ Planifié |
| **ML temps réel ou batch?** | Configurable, défaut batch nuit | ✅ Implémenté |
| **Navigation vers analytics site?** | Carte cliquable ajoutée | ✅ Corrigé |

---

## 🚀 Prochaines Étapes

### Sprint 2 (2-3 jours)

1. **Backend**:
   - [ ] Endpoint `GET /api/euralis/gaveurs/{id}`
   - [ ] Endpoint `GET /api/euralis/gaveurs/{id}/analytics`
   - [ ] Endpoint `GET /api/euralis/gaveurs/{id}/courbes-optimales`
   - [ ] Endpoint `GET /api/gaveurs/me/analytics` (JWT)

2. **Frontend Euralis**:
   - [ ] Page `/euralis/gaveurs/[id]/page.tsx` (profil)
   - [ ] Page `/euralis/gaveurs/[id]/analytics/page.tsx` (4 tabs)
   - [ ] Navigation depuis liste gaveurs et analytics site

3. **Frontend Gaveurs**:
   - [ ] Section "Mes Analytics IA" dans dashboard
   - [ ] Graphiques performance personnelle
   - [ ] Recommandations IA personnalisées

4. **Job Batch ML**:
   - [ ] Script refresh nuit (2h)
   - [ ] Cache Redis/Memcached
   - [ ] Logs refresh ML

---

**Auteur**: Claude Code
**Date**: 09 Janvier 2026
**Version**: 1.0
