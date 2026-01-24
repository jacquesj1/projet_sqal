# 🗺️ Migration vers Leaflet/Mapbox - Guide de Préparation

**Date**: 2026-01-15
**Statut**: Planifié (Option B future)
**Version actuelle**: SVG statique (Option A)

---

## 📋 Objectif

Migrer la carte interactive SVG actuelle vers une vraie bibliothèque de cartographie (Leaflet.js ou Mapbox) pour obtenir:

- 🌍 **Coordonnées GPS réelles** des gaveurs
- 🔍 **Zoom/Pan interactif**
- 🛰️ **Fonds de carte variés** (satellite, terrain, OSM)
- 📍 **Géolocalisation précise** des sites Euralis
- 📊 **Heatmaps** de performance par zone géographique

---

## 🎯 Option B.1 - Leaflet.js (Recommandé)

### Avantages
- ✅ Open-source et gratuit
- ✅ Léger (39KB gzippé)
- ✅ Pas de clé API nécessaire (avec OpenStreetMap)
- ✅ Très bonne intégration React (`react-leaflet`)
- ✅ Plugins riches (heatmap, clustering, etc.)

### Installation

```bash
cd euralis-frontend
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

### Dépendances

```json
{
  "leaflet": "^1.9.4",
  "react-leaflet": "^4.2.1",
  "@types/leaflet": "^1.9.8"
}
```

### Code de Base (Remplacement SVG)

```typescript
'use client';

import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Coordonnées GPS réelles des sites Euralis
const sitesEuralis = [
  { code: 'LL', name: 'Lantic', lat: 48.6167, lng: -3.0833, region: 'Bretagne' },
  { code: 'LS', name: 'La Séguinière', lat: 47.0833, lng: -0.9333, region: 'Pays de la Loire' },
  { code: 'MT', name: 'Maubourguet', lat: 43.4667, lng: 0.0333, region: 'Hautes-Pyrénées' }
];

// Couleurs clusters (identiques à la version SVG)
const clusterColors = {
  0: '#10b981', // Excellent
  1: '#3b82f6', // Très bon
  2: '#eab308', // Bon
  3: '#f97316', // À améliorer
  4: '#ef4444'  // Critique
};

export default function ClustersMapLeaflet({ gaveurs }: { gaveurs: Gaveur[] }) {
  return (
    <MapContainer
      center={[46.603354, 1.888334]} // Centre de la France
      zoom={6}
      style={{ height: '600px', width: '100%' }}
      className="rounded-lg shadow-lg"
    >
      {/* Fond de carte OpenStreetMap */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Sites Euralis */}
      {sitesEuralis.map(site => (
        <Marker
          key={site.code}
          position={[site.lat, site.lng]}
          icon={L.divIcon({
            className: 'custom-site-marker',
            html: `<div class="bg-orange-500 text-white font-bold px-3 py-1 rounded-full shadow-lg">${site.code}</div>`,
            iconSize: [50, 30]
          })}
        >
          <Popup>
            <strong>{site.name}</strong><br />
            {site.region}
          </Popup>
        </Marker>
      ))}

      {/* Gaveurs */}
      {gaveurs.map((gaveur, idx) => {
        // TODO: Remplacer par vraies coordonnées GPS depuis BD
        const site = sitesEuralis[idx % 3];
        const offsetLat = (Math.random() - 0.5) * 0.5;
        const offsetLng = (Math.random() - 0.5) * 0.5;

        return (
          <Circle
            key={gaveur.gaveur_id}
            center={[site.lat + offsetLat, site.lng + offsetLng]}
            radius={3000} // 3km radius
            pathOptions={{
              color: clusterColors[gaveur.cluster],
              fillColor: clusterColors[gaveur.cluster],
              fillOpacity: 0.6
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{gaveur.nom}</p>
                <p>Site: {site.code}</p>
                <p>ITM: {(gaveur.itm_moyen * 1000).toFixed(0)} g/kg</p>
                <p>Mortalité: {gaveur.mortalite?.toFixed(2)}%</p>
                <p className="font-semibold" style={{ color: clusterColors[gaveur.cluster] }}>
                  Cluster {gaveur.cluster}: {['Excellent', 'Très bon', 'Bon', 'À améliorer', 'Critique'][gaveur.cluster]}
                </p>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </MapContainer>
  );
}
```

### CSS Custom pour Leaflet

```css
/* euralis-frontend/app/globals.css */

/* Fix icônes Leaflet manquantes */
.leaflet-default-icon-path {
  background-image: url(https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png);
}

/* Marqueurs sites personnalisés */
.custom-site-marker {
  background: transparent !important;
  border: none !important;
}

/* Popup personnalisé */
.leaflet-popup-content-wrapper {
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

---

## 🎯 Option B.2 - Mapbox GL JS (Alternative Premium)

### Avantages
- ✅ Rendu WebGL ultra-performant
- ✅ Cartes 3D et vues satellite HD
- ✅ Heatmaps natives très performantes
- ✅ Clustering automatique de markers

### Inconvénients
- ❌ Nécessite clé API (gratuit jusqu'à 50k chargements/mois)
- ❌ Plus lourd (262KB)
- ❌ Dépendance commerciale

### Installation

```bash
npm install mapbox-gl react-map-gl
npm install -D @types/mapbox-gl
```

### Code de Base

```typescript
import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function ClustersMapMapbox({ gaveurs }) {
  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        latitude: 46.603354,
        longitude: 1.888334,
        zoom: 6
      }}
      style={{ width: '100%', height: '600px' }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
    >
      {/* Markers ici */}
    </Map>
  );
}
```

---

## 📊 Données Requises pour Migration

### 1. Coordonnées GPS Réelles des Gaveurs

**Table à créer**: `gaveurs_euralis_coordinates`

```sql
CREATE TABLE gaveurs_euralis_coordinates (
  id SERIAL PRIMARY KEY,
  gaveur_id INTEGER REFERENCES gaveurs_euralis(id),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  postal_code VARCHAR(5),
  city VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index géospatial
CREATE INDEX idx_gaveur_coords ON gaveurs_euralis_coordinates
USING GIST(ST_MakePoint(longitude, latitude));
```

**Exemple de données**:
```sql
INSERT INTO gaveurs_euralis_coordinates (gaveur_id, latitude, longitude, city) VALUES
  (1, 48.6100, -3.0700, 'Lantic'),  -- Gaveur près de LL
  (2, 47.0900, -0.9400, 'La Séguinière'),  -- Gaveur près de LS
  (3, 43.4700, 0.0300, 'Maubourguet');  -- Gaveur près de MT
```

### 2. Coordonnées GPS Sites Euralis (Confirmées)

| Site | Commune | Latitude | Longitude | Source |
|------|---------|----------|-----------|--------|
| **LL** | Lantic (22410) | 48.6167 | -3.0833 | OpenStreetMap |
| **LS** | La Séguinière (49280) | 47.0833 | -0.9333 | OpenStreetMap |
| **MT** | Maubourguet (65700) | 43.4667 | 0.0333 | OpenStreetMap |

### 3. API Backend - Nouveaux Endpoints

**`GET /api/euralis/ml/gaveurs-by-cluster-geo`**

Retourne gaveurs avec coordonnées GPS:

```json
[
  {
    "gaveur_id": 1,
    "nom": "Martin",
    "site_code": "LL",
    "cluster": 0,
    "itm_moyen": 12.5,
    "mortalite": 0.5,
    "latitude": 48.6100,
    "longitude": -3.0700,
    "address": "123 Route de Lantic, 22410 Lantic"
  }
]
```

**Backend `euralis.py`**:

```python
@router.get("/ml/gaveurs-by-cluster-geo")
async def get_gaveurs_by_cluster_with_geo(request: Request):
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        query = """
            SELECT
                g.id as gaveur_id,
                g.nom, g.prenom, g.site_code,
                AVG(l.itm) as itm_moyen,
                AVG(l.pctg_perte_gavage) as mortalite,
                CASE
                    WHEN AVG(l.itm) <= 13 THEN 0
                    WHEN AVG(l.itm) <= 14.5 THEN 1
                    WHEN AVG(l.itm) <= 15.5 THEN 2
                    WHEN AVG(l.itm) <= 17 THEN 3
                    ELSE 4
                END as cluster,
                c.latitude,
                c.longitude,
                c.address
            FROM gaveurs_euralis g
            LEFT JOIN lots_gavage l ON g.id = l.gaveur_id
            LEFT JOIN gaveurs_euralis_coordinates c ON g.id = c.gaveur_id
            WHERE g.actif = TRUE AND l.itm IS NOT NULL
            GROUP BY g.id, c.latitude, c.longitude, c.address
        """
        rows = await conn.fetch(query)
        return [dict(row) for row in rows]
```

---

## 🚀 Plan de Migration (4 Étapes)

### Étape 1: Préparation Base de Données (1h)
- [ ] Créer table `gaveurs_euralis_coordinates`
- [ ] Insérer coordonnées GPS des 3 sites Euralis
- [ ] Générer coordonnées fictives pour gaveurs (±50km autour sites)
- [ ] Script Python de géocodage si adresses réelles disponibles

### Étape 2: Backend (1h)
- [ ] Créer endpoint `/api/euralis/ml/gaveurs-by-cluster-geo`
- [ ] Tester retour JSON avec coordonnées
- [ ] Documenter API (Swagger)

### Étape 3: Frontend Leaflet (2h)
- [ ] Installer dépendances `react-leaflet`
- [ ] Créer composant `ClustersMapLeaflet.tsx`
- [ ] Remplacer SVG par `MapContainer` dans `page.tsx`
- [ ] Adapter styles et couleurs
- [ ] Tester zoom/pan, popups

### Étape 4: Features Avancées (optionnel, 2-4h)
- [ ] Clustering automatique (Leaflet.markercluster)
- [ ] Heatmap de performance (Leaflet.heat)
- [ ] Filtres interactifs par cluster
- [ ] Export image de la carte
- [ ] Mesures de distance entre gaveurs

---

## 📚 Ressources

### Leaflet
- **Documentation**: https://leafletjs.com/
- **React Leaflet**: https://react-leaflet.js.org/
- **Plugins**: https://leafletjs.com/plugins.html

### Mapbox
- **Documentation**: https://docs.mapbox.com/mapbox-gl-js/
- **React Map GL**: https://visgl.github.io/react-map-gl/

### Cartes Libres
- **OpenStreetMap**: https://www.openstreetmap.org/
- **Tiles OSM France**: https://tile.openstreetmap.fr/
- **CartoDB**: https://carto.com/basemaps/

### Géocodage (Adresse → GPS)
- **Nominatim (OSM)**: https://nominatim.openstreetmap.org/
- **API Gouvernement FR**: https://adresse.data.gouv.fr/

---

## ⚠️ Points d'Attention

### Performance
- Leaflet gère bien jusqu'à **1000 markers** sans clustering
- Au-delà, utiliser **Leaflet.markercluster** obligatoire
- Mapbox meilleur pour **5000+ markers**

### RGPD / Vie Privée
- ⚠️ Ne jamais afficher adresses exactes sans consentement
- Utiliser **coordonnées approximatives** (±1-5km)
- Option: Zone géographique floue (cercle 10km autour site)

### Fallback SVG
- Garder version SVG actuelle comme fallback
- Détection support WebGL:
  ```typescript
  const hasWebGL = (() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  })();
  ```

---

## 🎯 Comparaison Options

| Critère | SVG Actuel (A) | Leaflet (B.1) | Mapbox (B.2) |
|---------|----------------|---------------|--------------|
| **Précision GPS** | ❌ Approximative | ✅ Exacte | ✅ Exacte |
| **Zoom/Pan** | ❌ Non | ✅ Oui | ✅ Oui |
| **Poids** | ✅ <5KB | ✅ 39KB | ⚠️ 262KB |
| **Coût** | ✅ Gratuit | ✅ Gratuit | ⚠️ Freemium |
| **Offline** | ✅ Oui | ⚠️ Non (tiles) | ⚠️ Non |
| **Heatmap** | ❌ Non | ✅ Plugin | ✅ Natif |
| **Setup** | ✅ 0 config | ✅ Simple | ⚠️ API key |
| **Perf 1000+ markers** | ⚠️ Moyenne | ✅ Bonne (clustering) | ✅ Excellente |

**Recommandation**: **Leaflet (Option B.1)** pour le meilleur rapport fonctionnalités/simplicité.

---

## 📝 Notes de Migration

### Code à Conserver

**Logique de clustering** (déjà correcte):
```typescript
const clusterColors = [
  '#10b981', // 0 - Excellent (ITM ≤ 13)
  '#3b82f6', // 1 - Très bon (13-14.5)
  '#eab308', // 2 - Bon (14.5-15.5)
  '#f97316', // 3 - À améliorer (15.5-17)
  '#ef4444'  // 4 - Critique (> 17)
];
```

**Logique de tooltip** (adapter pour Leaflet Popup):
```typescript
const tooltipContent = `
  <strong>${gaveur.nom}</strong><br>
  Site: ${gaveur.site_code}<br>
  ITM: ${(gaveur.itm_moyen * 1000).toFixed(0)} g/kg<br>
  Mortalité: ${gaveur.mortalite?.toFixed(2)}%<br>
  Cluster: ${['Excellent', 'Très bon', 'Bon', 'À améliorer', 'Critique'][gaveur.cluster]}
`;
```

### Code à Supprimer
- SVG path de la carte France
- Calculs manuels positions (angles, radius)
- Labels régions en dur

---

**Créé le**: 2026-01-15
**Par**: Claude Code
**Version**: 1.0
**Statut**: 📋 Documentation prête, migration à planifier
