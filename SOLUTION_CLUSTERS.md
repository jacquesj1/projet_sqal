# 🔍 Diagnostic - Problème Carte Clusters

## Problème Identifié

**Les gaveurs ne s'affichent PAS sur la carte** car le backend retourne des **statistiques de clusters agrégées**, PAS des gaveurs individuels.

### Données Retournées (console.log)

```javascript
clusters = [
  {
    cluster_id: 0,
    nom: "Excellent",
    nb_gaveurs: 1,          // ← Nombre total, pas liste de gaveurs!
    itm_moyen: 17.345,
    mortalite_moyenne: 0,
    production_totale_kg: 2,
    recommandation: "Partager bonnes pratiques...",
    couleur: "#10b981"
  },
  // ... 4 autres clusters similaires
]
```

### Ce qu'il faudrait pour la carte

```javascript
clusters = [
  {
    gaveur_id: 1,
    nom: "Jean Martin",
    cluster: 0,              // Cluster d'appartenance
    itm_moyen: 17.5,
    mortalite: 0.5,
    site_code: "LL",         // Site d'attache
    latitude: 48.xxx,        // Coordonnées GPS
    longitude: -3.xxx
  },
  // ... autres gaveurs individuels
]
```

## Solutions Possibles

### Solution 1: Modifier le Backend (RECOMMANDÉ)

**Créer un nouvel endpoint** qui retourne les **gaveurs individuels avec leurs clusters**:

```python
# backend-api/app/routers/euralis.py

@router.get("/analytics/gaveurs-by-cluster")
async def get_gaveurs_by_cluster(request: Request):
    """Retourne liste complète des gaveurs avec leur cluster assigné"""
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                g.id as gaveur_id,
                g.nom,
                g.prenom,
                g.site_origine as site_code,
                AVG(ld.itm_moyen) as itm_moyen,
                AVG(ld.mortalite_pct) as mortalite,
                -- Calcul cluster basé sur ITM (exemple simplifié)
                CASE
                    WHEN AVG(ld.itm_moyen) >= 17 THEN 0  -- Excellent
                    WHEN AVG(ld.itm_moyen) >= 15.5 THEN 1  -- Très bon
                    WHEN AVG(ld.itm_moyen) >= 14.5 THEN 2  -- Bon
                    WHEN AVG(ld.itm_moyen) >= 13.5 THEN 3  -- À améliorer
                    ELSE 4  -- Critique
                END as cluster
            FROM gaveurs g
            LEFT JOIN lots_gavage lg ON g.id = lg.gaveur_id
            LEFT JOIN lots_details_csv ld ON lg.code_lot = ld.code_lot
            WHERE ld.itm_moyen IS NOT NULL
            GROUP BY g.id, g.nom, g.prenom, g.site_origine
            ORDER BY itm_moyen DESC
        """)

        return [dict(row) for row in rows]
```

**Puis dans le frontend**, appeler ce nouvel endpoint:

```typescript
// euralis-frontend/lib/euralis/api.ts
async getGaveursWithClusters(): Promise<GaveurCluster[]> {
  return this.fetch<GaveurCluster[]>('/api/euralis/analytics/gaveurs-by-cluster');
}

// page.tsx
const clustersData = await euralisAPI.getGaveursWithClusters(); // Au lieu de getGaveurClusters()
```

### Solution 2: Affichage Adaptatif Frontend (RAPIDE)

Détecter le format des données et afficher soit:
- **Carte géographique** si gaveurs individuels
- **Cartes statistiques** si clusters agrégés

C'est la solution que j'ai commencé à implémenter.

### Solution 3: Générer des Gaveurs Fictifs (DÉMO)

Pour la démo, générer des gaveurs fictifs répartis selon les stats:

```typescript
// Générer nb_gaveurs fictifs par cluster
const gaveursGeneres = clusters.flatMap((cluster, clusterIdx) => {
  return Array.from({ length: cluster.nb_gaveurs }, (_, i) => ({
    gaveur_id: clusterIdx * 100 + i,
    nom: `Gaveur ${i+1}`,
    cluster: clusterIdx,
    itm_moyen: cluster.itm_moyen + (Math.random() - 0.5),
    mortalite: cluster.mortalite_moyenne + (Math.random() - 0.5),
    site_code: ['LL', 'LS', 'MT'][i % 3]
  }));
});
```

## Recommandation

👉 **Solution 1** est la meilleure: modifier le backend pour retourner les gaveurs individuels avec leurs clusters.

Cela permettra d'avoir la vraie carte interactive avec les vraies données.
