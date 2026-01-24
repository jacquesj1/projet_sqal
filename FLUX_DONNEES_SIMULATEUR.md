# 📊 Flux de Données - Simulateur Gavage → Frontend Gaveurs

## 🔍 État Actuel du Système

### Architecture WebSocket

```
┌─────────────────────────────────────────────────────────────────┐
│                     SIMULATEUR GAVAGE                            │
│                  (gavage_realtime.py)                            │
│                                                                   │
│  Envoie données toutes les 30s pour 3 lots:                     │
│  - LS2512001 (J11, 50 canards)                                   │
│  - LS2512002 (J11, 50 canards)                                   │
│  - LS2512003 (J11, 50 canards)                                   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ WebSocket: ws://localhost:8000/ws/gavage
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND FASTAPI                                │
│                  (app/main.py)                                   │
│                                                                   │
│  @app.websocket("/ws/gavage")                                    │
│  ├─ Reçoit données simulateur                                    │
│  ├─ Enregistre dans TimescaleDB (doses_journalieres)            │
│  └─ Broadcast vers 2 endpoints:                                  │
│      ├─> /ws/realtime/ (supervision multi-sites)                │
│      └─> /ws/gaveur/{id} (gaveur individuel)                     │
└─────────────────────────────────────────────────────────────────┘
                     │                           │
                     │                           │
                     ▼                           ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  FRONTEND EURALIS            │  │  FRONTEND GAVEURS            │
│  Port 3001                   │  │  Port 3000                   │
│                              │  │                              │
│  WebSocket:                  │  │  WebSocket:                  │
│  ws://localhost:8000/        │  │  ws://localhost:8000/        │
│    /ws/realtime/             │  │    /ws/gaveur/1              │
│                              │  │                              │
│  Component:                  │  │  Component:                  │
│  RealtimeSitesMonitor.tsx    │  │  WebSocketContext.tsx        │
│                              │  │                              │
│  Affiche:                    │  │  Affiche:                    │
│  - Stats agrégées 3 sites    │  │  - Données gaveur 1 only     │
│  - Total canards             │  │  - Lot en cours              │
│  - Poids moyen global        │  │  - Doses distribuées         │
│  - Activité récente          │  │  - Alertes                   │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## ✅ Endpoint Backend `/ws/gavage` (Réception Simulateur)

**Fichier**: [backend-api/app/main.py:912-935](backend-api/app/main.py#L912-L935)

```python
@app.websocket("/ws/gavage")
async def websocket_gavage_endpoint(websocket: WebSocket):
    """
    WebSocket pour réception données simulateur Gavage Temps Réel
    Flux: Simulateur → Backend → Frontends (gaveurs + euralis) + TimescaleDB

    Le backend :
    1. Reçoit les données JSON du simulateur
    2. Enregistre dans TimescaleDB (table doses_journalieres)
    3. Broadcast vers /ws/realtime/ (frontend Euralis)
    4. Envoie vers /ws/gaveur/{gaveur_id} (frontend Gaveurs concerné)
    """
```

### Données Reçues du Simulateur

```json
{
  "code_lot": "LS2512001",
  "gaveur_id": 1,
  "gaveur_nom": "Jean Dupont",
  "site": "LS",
  "genetique": "Mulard",
  "jour": 11,
  "moment": "matin",
  "dose_reelle": 450.5,
  "poids_moyen": 6850.0,
  "nb_canards_vivants": 48,
  "taux_mortalite": 4.0,
  "timestamp": "2025-12-27T09:30:00Z"
}
```

---

## 🔄 Endpoint Backend `/ws/realtime/` (Broadcast Euralis)

**Fichier**: [backend-api/app/main.py:886-906](backend-api/app/main.py#L886-L906)

```python
@app.websocket("/ws/realtime/")
async def websocket_realtime_endpoint(websocket: WebSocket):
    """
    WebSocket pour broadcast temps réel vers dashboards SQAL/Euralis
    Flux: Backend → Dashboards supervision multi-sites

    Utilisé par:
    - Frontend Euralis (port 3001)
    - Dashboard SQAL (port 5173)
    """
```

### Frontend Euralis Écoute

**Fichier**: [euralis-frontend/components/realtime/RealtimeSitesMonitor.tsx:76](euralis-frontend/components/realtime/RealtimeSitesMonitor.tsx#L76)

```typescript
const ws = new WebSocket(`${WS_URL}/ws/realtime/`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'gavage_realtime') {
    const gavageData = message.data as GavageRealtimeData;

    // Mise à jour statistiques site
    setSiteStats((prev) => {
      const newStats = new Map(prev);
      const siteCode = gavageData.site;
      // Agrégation des données...
    });
  }
};
```

---

## 🎯 Endpoint Backend `/ws/gaveur/{id}` (Individuel)

**Fichier**: [backend-api/app/main.py:936-980](backend-api/app/main.py#L936-L980)

```python
@app.websocket("/ws/gaveur/{gaveur_id}")
async def websocket_gaveur_endpoint(websocket: WebSocket, gaveur_id: int):
    """
    WebSocket pour un gaveur individuel
    Flux: Backend → Frontend gaveur spécifique

    Envoie UNIQUEMENT les données de gavage concernant ce gaveur
    Filtre par gaveur_id
    """
```

### Frontend Gaveurs Écoute

**Fichier**: [gaveurs-frontend/context/WebSocketContext.tsx:48](gaveurs-frontend/context/WebSocketContext.tsx#L48)

```typescript
const gaveurId = 1; // TODO: Récupérer depuis Keycloak
const ws = new WebSocket(`${WS_URL}/ws/gaveur/${gaveurId}`);

ws.onmessage = (event) => {
  const message: WebSocketMessage = JSON.parse(event.data);
  setLastMessage(message);

  // Notifier les subscribers du type spécifique
  const callbacks = subscribersRef.current.get(message.type);
  if (callbacks) {
    callbacks.forEach((callback) => callback(message.data));
  }
};
```

---

## 🔧 Comment le Backend Distribue les Données

### Broadcaster Realtime

**Fichier**: [backend-api/app/websocket/realtime_broadcaster.py](backend-api/app/websocket/realtime_broadcaster.py)

```python
class RealtimeBroadcaster:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def broadcast(self, message: dict):
        """Envoie message à tous les clients /ws/realtime/"""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)

        # Nettoyer connexions mortes
        self.active_connections -= disconnected
```

### Gavage Consumer (Gaveurs Individuels)

**Fichier**: [backend-api/app/websocket/gavage_consumer.py](backend-api/app/websocket/gavage_consumer.py)

```python
class GavageConsumer:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.gaveur_connections: Dict[int, Set[WebSocket]] = {}

    async def send_to_gaveur(self, gaveur_id: int, message: dict):
        """Envoie message UNIQUEMENT aux WebSockets du gaveur spécifique"""
        if gaveur_id in self.gaveur_connections:
            for ws in self.gaveur_connections[gaveur_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass  # Connexion fermée
```

---

## 🧪 Test du Flux Complet

### 1. Vérifier que le Simulateur Tourne

```bash
docker ps | grep gavage_realtime
# Devrait montrer le container gavage-realtime-simulator
```

### 2. Vérifier Logs Backend

```bash
docker-compose logs -f backend | grep gavage
# Devrait montrer:
# ✅ WebSocket /ws/gavage connecté
# 📊 Données gavage reçues: LS2512001 J11
# 💾 Enregistré dans TimescaleDB
# 📡 Broadcast vers /ws/realtime/
# 📡 Envoyé vers /ws/gaveur/1
```

### 3. Vérifier Frontend Euralis (Port 3001)

Ouvrir http://localhost:3001/euralis/dashboard

**Console devrait montrer**:
```
✅ WebSocket Euralis connecté
📊 Gavage LS: LS2512001 J11
```

**Page devrait afficher**:
- Sites actifs: 3
- Total canards: ~150
- Poids moyen global: ~6850g
- Activité récente: LS2512001, LS2512002, LS2512003

### 4. Vérifier Frontend Gaveurs (Port 3000)

Ouvrir http://localhost:3000

**Console devrait montrer**:
```
WebSocket connecté
```
ou
```
WebSocket déjà connecté, réutilisation
```

**Page devrait afficher** (SI gaveur_id=1 a des lots actifs):
- Dashboard avec indicateur vert 🟢 en bas à gauche
- Données temps réel du gaveur 1 uniquement

---

## ❓ Pourquoi le Frontend Gaveurs ne Voit Pas les Données?

### Scénario Actuel

Si le **frontend gaveurs ne reçoit RIEN** du simulateur, c'est probablement parce que:

1. **Le simulateur envoie vers `/ws/gavage`** ✅
2. **Le backend reçoit les données** ✅
3. **Le backend broadcast vers `/ws/realtime/`** ✅ (Euralis reçoit)
4. **Le backend N'ENVOIE PAS vers `/ws/gaveur/1`** ❌

### Vérification Rapide

Dans les logs backend, cherchez:
```bash
docker-compose logs backend | grep "ws/gaveur"
```

Vous devriez voir:
```
✅ WebSocket connection established for gaveur 1
📡 Envoi données vers gaveur 1: LS2512001
```

Si vous ne voyez que la première ligne mais PAS la deuxième, c'est que le backend ne redistribue pas les données.

---

## 🛠️ Solution: Activer Redistribution Backend → Gaveurs

### Modifier le Handler `/ws/gavage`

**Fichier à modifier**: [backend-api/app/main.py:912-935](backend-api/app/main.py#L912-L935)

```python
@app.websocket("/ws/gavage")
async def websocket_gavage_endpoint(websocket: WebSocket):
    from app.websocket.realtime_broadcaster import realtime_broadcaster
    from app.websocket.gavage_consumer import gavage_consumer

    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # 1. Enregistrer dans TimescaleDB
            await save_to_timescaledb(message)

            # 2. Broadcast vers Euralis (/ws/realtime/)
            await realtime_broadcaster.broadcast({
                "type": "gavage_realtime",
                "data": message
            })

            # 3. NOUVEAU: Envoyer aussi au gaveur concerné
            gaveur_id = message.get('gaveur_id')
            if gaveur_id:
                await gavage_consumer.send_to_gaveur(gaveur_id, {
                    "type": "gavage_update",
                    "data": message
                })
                logger.info(f"📡 Envoyé vers gaveur {gaveur_id}: {message['code_lot']}")

    except WebSocketDisconnect:
        logger.info("Simulateur gavage déconnecté")
```

---

## 📊 Résumé

| Composant | Port | WebSocket | Données Reçues |
|-----------|------|-----------|----------------|
| **Simulateur** | N/A | `/ws/gavage` (émetteur) | Envoie toutes les 30s |
| **Backend** | 8000 | 3 endpoints | Reçoit + Redistribue |
| **Frontend Euralis** | 3001 | `/ws/realtime/` (récepteur) | Tous les gavages ✅ |
| **Frontend Gaveurs** | 3000 | `/ws/gaveur/1` (récepteur) | Gaveur 1 only ⚠️ |

---

## 🎯 Prochaines Étapes

1. **Rafraîchir page** http://localhost:3000 (Ctrl+F5)
2. **Vérifier console** - L'erreur `TypeError: b.filter` devrait disparaître
3. **Vérifier logs backend** - Chercher "📡 Envoyé vers gaveur"
4. **Si pas de données gaveur** → Modifier handler `/ws/gavage` comme ci-dessus

---

**Dernière mise à jour**: 27 décembre 2025, 09:45 UTC
