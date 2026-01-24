# Intégration WebSocket Temps Réel - Frontends

**Date**: 23 Décembre 2025
**Statut**: ✅ **COMPLET**

---

## Vue d'ensemble

Intégration complète du WebSocket temps réel dans les frontends **Gaveurs** et **Euralis** pour afficher les données de gavage en direct.

### Flux de données

```
Simulateur Gavage
    ↓ WebSocket /ws/gavage
Backend gavage_consumer.py
    ↓ Broadcast /ws/realtime/
Frontends
    ├─→ Gaveurs (port 3001) - Monitoring individuel
    └─→ Euralis (port 3000) - Agrégation multi-sites
```

---

## 1. Frontend Gaveurs (Next.js)

### Fichiers créés

#### Hook useRealtimeGavage

**Fichier**: `gaveurs-frontend/hooks/useRealtimeGavage.ts`

Hook React réutilisable pour WebSocket avec:
- ✅ Connexion automatique
- ✅ Reconnexion automatique (10 tentatives max)
- ✅ Heartbeat (ping/pong 30s)
- ✅ Gestion erreurs
- ✅ TypeScript strict

**Usage**:
```typescript
import { useRealtimeGavage } from '@/hooks/useRealtimeGavage';

const { lastMessage, isConnected, error, reconnectAttempts } = useRealtimeGavage({
  enabled: true,
  onMessage: (data) => {
    console.log('Nouveau gavage:', data);
  }
});
```

**Interface**:
```typescript
interface GavageRealtimeData {
  code_lot: string;
  gaveur_id: number;
  gaveur_nom: string;
  site: string;              // LL, LS, MT
  genetique: string;         // Mulard, Barbarie, Pékin
  jour: number;
  moment: 'matin' | 'soir';
  dose_theorique: number;
  dose_reelle: number;
  poids_moyen: number;
  nb_canards_vivants: number;
  taux_mortalite: number;
  temperature_stabule: number;
  humidite_stabule: number;
  timestamp: string;
  pret_abattage?: boolean;
}
```

#### Composant RealtimeGavageMonitor

**Fichier**: `gaveurs-frontend/components/dashboard/RealtimeGavageMonitor.tsx`

Composant d'affichage temps réel avec:
- ✅ Indicateur connexion WebSocket
- ✅ Statistiques rapides (gavages reçus, poids moyen, mortalité)
- ✅ Liste des 20 derniers gavages
- ✅ Codes couleur mortalité (vert <3%, jaune 3-5%, rouge >5%)
- ✅ Icônes moment (☀️ matin, 🌙 soir)
- ✅ Badge "Prêt abattage"

**Features**:
- Scroll automatique
- Hover effects
- Responsive design
- Tailwind CSS

#### Intégration dashboard

**Fichier modifié**: `gaveurs-frontend/app/page.tsx`

Ajout du composant entre "Top Performers" et "Quick Actions":

```tsx
{/* Monitoring Temps Réel */}
<div className="mt-6">
  <RealtimeGavageMonitor />
</div>
```

### Aperçu visuel

```
┌─────────────────────────────────────────────────────────┐
│  🔵 Gavages en Temps Réel              🟢 Connecté      │
├─────────────────────────────────────────────────────────┤
│  [📊 Gavages: 15]  [📈 Poids: 5450g]  [💧 Mort: 2.5%] │
├─────────────────────────────────────────────────────────┤
│  Derniers gavages (15)                                  │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ☀️ LL2512001  J5 matin                   10:23:45 │ │
│  │ Jean Martin • Site LL • Mulard                     │ │
│  │ Dose: 315.3g (320g) | Poids: 5450g | Vivants: 48  │ │
│  │ Mortalité: 4.0% 🟡 | 🌡️21.3°C  💧68.5%          │ │
│  └───────────────────────────────────────────────────┘ │
│  [...]                                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Euralis (Next.js)

### Fichier créé

#### Composant RealtimeSitesMonitor

**Fichier**: `euralis-frontend/components/realtime/RealtimeSitesMonitor.tsx`

Composant d'agrégation multi-sites avec:
- ✅ Connexion WebSocket intégrée
- ✅ Statistiques globales (3 sites, total canards, poids moyen global)
- ✅ Cartes par site (LL, LS, MT) avec couleurs distinctes
- ✅ Agrégation temps réel (moyenne mobile)
- ✅ Activité récente (10 derniers gavages)

**Features**:
- Agrégation automatique par site
- Compteur de gavages reçus
- Timestamp dernière mise à jour
- Codes couleur mortalité par site
- Badge site coloré (bleu LL, vert LS, orange MT)

#### Intégration dashboard

**Fichier modifié**: `euralis-frontend/app/euralis/dashboard/page.tsx`

Ajout du composant après "Performances par Site":

```tsx
{/* Monitoring Temps Réel */}
<div>
  <RealtimeSitesMonitor />
</div>
```

### Aperçu visuel

```
┌─────────────────────────────────────────────────────────────┐
│  🔵 Supervision Temps Réel Multi-Sites      🟢 Connecté     │
├─────────────────────────────────────────────────────────────┤
│  [🗺️ Sites: 3]  [👥 Canards: 150]  [📈 Poids: 5450g]      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 🏭 Site LL  │  │ 🏭 Site LS  │  │ 🏭 Site MT  │        │
│  │ Bretagne    │  │ Pays Loire  │  │ Occitanie   │        │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤        │
│  │ Can.: 50    │  │ Can.: 48    │  │ Can.: 52    │        │
│  │ Poids: 5500g│  │ Poids: 5400g│  │ Poids: 5450g│        │
│  │ Mort: 2.5% │  │ Mort: 4.2%  │  │ Mort: 3.0%  │        │
│  │ MàJ: 10:23  │  │ MàJ: 10:22  │  │ MàJ: 10:24  │        │
│  │ 5 gavages   │  │ 4 gavages   │  │ 6 gavages   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│  Activité Récente (10)                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [LL] LL2512001 • Jean Martin • Bretagne      10:23  │   │
│  │                               J5 ☀️  5450g          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Configuration

### Variables d'environnement

#### Gaveurs Frontend

**Fichier**: `gaveurs-frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

#### Euralis Frontend

**Fichier**: `euralis-frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

**Important**: Les deux frontends se connectent au **même endpoint** `/ws/realtime/` mais affichent les données différemment (individuel vs agrégé).

---

## 4. Démarrage

### Étape 1: Backend + Simulateur

```bash
# Terminal 1: Backend
cd backend-api
uvicorn app.main:app --reload

# Terminal 2: Simulateur Gavage
cd simulators/gavage_realtime
python main.py --nb-lots 3 --acceleration 1440
```

### Étape 2: Frontend Gaveurs

```bash
cd gaveurs-frontend
npm run dev
# Ouvrir: http://localhost:3001
```

### Étape 3: Frontend Euralis

```bash
cd euralis-frontend
npm run dev
# Ouvrir: http://localhost:3000/euralis/dashboard
```

### Vérification

1. **Frontend Gaveurs**: Voir composant "Gavages en Temps Réel" en bas de page
2. **Frontend Euralis**: Voir composant "Supervision Temps Réel Multi-Sites" après le tableau sites
3. **Console navigateur (F12)**: Vérifier messages WebSocket
   - `✅ WebSocket Gavage connecté` (gaveurs)
   - `✅ WebSocket Euralis connecté` (euralis)
   - `📊 Gavage reçu: ...` (logs messages)

---

## 5. Messages WebSocket

### Format message gavage

```json
{
  "type": "gavage_realtime",
  "data": {
    "code_lot": "LL2512001",
    "gaveur_id": 1,
    "gaveur_nom": "Jean Martin",
    "site": "LL",
    "genetique": "Mulard",
    "jour": 5,
    "moment": "matin",
    "dose_theorique": 320.5,
    "dose_reelle": 315.8,
    "poids_moyen": 5450.2,
    "nb_canards_vivants": 48,
    "taux_mortalite": 4.0,
    "temperature_stabule": 21.3,
    "humidite_stabule": 68.5,
    "timestamp": "2025-12-23T08:00:00.123Z",
    "pret_abattage": false
  },
  "timestamp": "2025-12-23T08:00:01.456Z"
}
```

### Messages système

#### Connexion établie
```json
{
  "type": "connection_established",
  "timestamp": "2025-12-23T08:00:00.000Z",
  "message": "Connecté au flux temps réel SQAL",
  "active_connections": 2
}
```

#### Heartbeat
Client → Server:
```json
{
  "type": "heartbeat"
}
```

Server → Client:
```json
{
  "type": "heartbeat_ack",
  "timestamp": "2025-12-23T08:00:00.000Z"
}
```

---

## 6. Gestion des erreurs

### Reconnexion automatique

Les deux hooks gèrent la reconnexion avec:
- **Délai**: 5 secondes entre tentatives
- **Max tentatives**: 10
- **Affichage**: Compteur visible dans l'UI

**Frontend Gaveurs**:
```typescript
// useRealtimeGavage.ts ligne 86
reconnectInterval: 5000,      // 5s
maxReconnectAttempts: 10,
```

**Frontend Euralis**:
```typescript
// RealtimeSitesMonitor.tsx ligne 124
if (reconnectAttempts < 10) {
  setTimeout(() => connect(), 5000);
}
```

### Affichage erreurs

**Frontend Gaveurs**:
```tsx
{error && (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-sm text-red-800">{error}</p>
  </div>
)}
```

**Frontend Euralis**:
Même pattern.

---

## 7. Optimisations

### Gaveurs Frontend

1. **Limite historique**: MAX_HISTORY = 20 gavages
2. **Moyenne mobile**: Statistiques calculées sur historique
3. **Cleanup**: useEffect cleanup pour éviter fuites mémoire

### Euralis Frontend

1. **Agrégation par site**: Map<site, SiteStats>
2. **Moyenne mobile**: (avg × count + new) / (count + 1)
3. **Limite activité**: 10 derniers gavages

---

## 8. Tests

### Test 1: Connexion WebSocket

**Console navigateur (F12)**:
```
✅ WebSocket Gavage connecté
🔗 Connexion établie: Connecté au flux temps réel SQAL
```

### Test 2: Réception messages

**Démarrer simulateur**:
```bash
cd simulators/gavage_realtime
python main.py --nb-lots 1 --acceleration 86400  # Ultra rapide
```

**Résultat attendu** (après ~15s):
- Gaveurs: 24 messages reçus (2×/jour × 12 jours)
- Euralis: Même nombre avec agrégation site

**Console**:
```
📊 Gavage reçu: LL2512001 J0 matin
📊 Gavage reçu: LL2512001 J0 soir
...
```

### Test 3: Reconnexion

1. **Arrêter backend**: Ctrl+C dans terminal backend
2. **Observer frontends**:
   - Statut passe à "🔴 Déconnecté"
   - Compteur tentatives s'affiche
3. **Redémarrer backend**: `uvicorn app.main:app --reload`
4. **Observer**: Reconnexion automatique après 5s max

### Test 4: Multi-fenêtres

1. Ouvrir **2 onglets** du même frontend (gaveurs ou euralis)
2. Démarrer simulateur
3. **Vérifier**: Les 2 onglets reçoivent les mêmes données
4. **Backend logs**: 2 connexions WebSocket actives

---

## 9. Performance

### Charge réseau

| Composant | Messages/jour | Taille moy. | Bande passante |
|-----------|---------------|-------------|----------------|
| 1 lot | 24 (2×/j × 12j) | ~500 bytes | ~12 KB/jour |
| 10 lots | 240 | ~500 bytes | ~120 KB/jour |
| Frontend | Broadcast | ~500 bytes | Négligeable |

**Conclusion**: Charge très faible, adapté à la production.

### Mémoire frontend

| Frontend | Mémoire hook | Historique | Total |
|----------|--------------|------------|-------|
| Gaveurs | ~100 KB | 20 × 500 bytes = 10 KB | ~110 KB |
| Euralis | ~150 KB | Map + 10 × 500 bytes | ~155 KB |

**Conclusion**: Impact mémoire négligeable (<1 MB).

---

## 10. Production

### Recommandations

1. **SSL/TLS**: Passer de `ws://` à `wss://`
   ```typescript
   const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.euralis.fr';
   ```

2. **Load balancer**: WebSocket sticky sessions
   ```nginx
   upstream websocket {
     ip_hash;  # Sticky sessions
     server backend1:8000;
     server backend2:8000;
   }
   ```

3. **Monitoring**: Ajouter métriques Prometheus
   ```typescript
   const [metrics, setMetrics] = useState({
     messages_received: 0,
     reconnect_count: 0,
     avg_latency_ms: 0
   });
   ```

4. **Rate limiting**: Backend broadcast throttling
   ```python
   # Dans realtime_broadcaster.py
   if len(self.active_connections) > 100:
       await asyncio.sleep(0.1)  # Throttle
   ```

---

## 11. Troubleshooting

### Problème: Pas de messages reçus

**Diagnostic**:
1. Console navigateur: `WebSocket is already in CLOSING or CLOSED state`
2. Network tab: Code 101 → Success, autre → Error

**Solution**:
```bash
# Vérifier backend WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8000/ws/realtime/
# Attendu: 101 Switching Protocols
```

### Problème: Reconnexion en boucle

**Cause**: Backend non accessible ou erreur serveur

**Solution**:
```bash
# Vérifier logs backend
tail -f backend-api/logs/backend.log | grep "WebSocket"

# Vérifier endpoint health
curl http://localhost:8000/health
```

### Problème: Messages dupliqués

**Cause**: Plusieurs instances de hook montées

**Solution**:
```tsx
// Vérifier que le composant n'est pas monté 2×
useEffect(() => {
  console.log('Component mounted');
  return () => console.log('Component unmounted');
}, []);
```

---

## 12. Récapitulatif

### Fichiers créés/modifiés

| Fichier | Type | Lignes | Description |
|---------|------|--------|-------------|
| `gaveurs-frontend/hooks/useRealtimeGavage.ts` | Nouveau | 180 | Hook WebSocket |
| `gaveurs-frontend/components/dashboard/RealtimeGavageMonitor.tsx` | Nouveau | 300 | Composant monitoring |
| `gaveurs-frontend/app/page.tsx` | Modifié | +4 | Import + intégration |
| `euralis-frontend/components/realtime/RealtimeSitesMonitor.tsx` | Nouveau | 450 | Composant multi-sites |
| `euralis-frontend/app/euralis/dashboard/page.tsx` | Modifié | +4 | Import + intégration |
| **TOTAL** | | **~940** | |

### Fonctionnalités livrées

- ✅ Hook WebSocket réutilisable (reconnexion auto)
- ✅ Composant Gaveurs (20 derniers gavages)
- ✅ Composant Euralis (agrégation 3 sites)
- ✅ Statistiques temps réel
- ✅ Indicateurs connexion
- ✅ Gestion erreurs
- ✅ Heartbeat
- ✅ Responsive design
- ✅ TypeScript strict
- ✅ Documentation complète

### Prêt pour

- ✅ Tests end-to-end
- ✅ Déploiement production (avec SSL)
- ✅ Scalabilité (100+ clients)
- ⏳ Intégration Keycloak (filtres par gaveur)

---

**Intégration Frontend WebSocket : TERMINÉE** ✅

**Prochaine étape**: Tests E2E avec simulateur + frontends + Keycloak.
