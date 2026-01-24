# 🎛️ Control Panel - Explication Détaillée

## 🎯 Qu'est-ce que le Control Panel ?

Le **Control Panel** est une interface web HTML standalone qui permet de **piloter et orchestrer** les 4 simulateurs du système Gaveurs V3.0 pour réaliser des démonstrations end-to-end de la boucle fermée.

```
┌───────────────────────────────────────────────────────────────┐
│                   CONTROL PANEL (HTML)                         │
│                  http://localhost:8080                         │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  🎛️ Interface de Pilotage Unique                              │
│                                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ 🦆 Gavage│  │ 🔍 Monitor│  │ 🔬 SQAL  │  │ 🎭 Consumer│     │
│  │          │  │          │  │          │  │            │     │
│  │ [Status] │  │ [Status] │  │ [Status] │  │ [Status]   │     │
│  │ Params   │  │ Params   │  │ Params   │  │ Params     │     │
│  │ ▶️ Start │  │ ▶️ Start │  │ ▶️ Start │  │ ▶️ Start   │     │
│  │ ⏹️ Stop  │  │ ⏹️ Stop  │  │ ⏹️ Stop  │  │ ⏹️ Stop    │     │
│  │ Logs...  │  │ Logs...  │  │ Logs...  │  │ Logs...    │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                                │
│  📋 Scénarios Pré-configurés:                                 │
│  [🚀 Démo 2min]  [🧪 Test 15min]  [⏹️ Stop All]              │
│                                                                │
│  📊 Monitoring Temps Réel (WebSocket)                         │
│  ├─ Status: En cours / Arrêté                                 │
│  ├─ Stats: Messages envoyés, Errors                           │
│  └─ Logs: Événements en direct                                │
└───────────────────────────────────────────────────────────────┘
```

## 🎬 Pourquoi le Control Panel ?

### Problème Sans Control Panel

Avant, pour démontrer la boucle fermée complète, il fallait :

```bash
# Terminal 1 : Backend
cd backend-api
uvicorn app.main:app --reload --port 8000

# Terminal 2 : Gavage
cd simulators/gavage_realtime
python main.py --nb-lots 1 --acceleration 86400

# Terminal 3 : Monitor
cd simulators/sqal
python lot_monitor.py --polling-interval 5

# Terminal 4 : SQAL
cd simulator-sqal
python src/main.py --device ESP32_LL_01 --interval 30

# Terminal 5 : Consumer
cd simulators/consumer-satisfaction
python main.py --interval 5 --num-feedbacks 20
```

**Problèmes** :
- ❌ 5 terminaux à jongler
- ❌ Synchronisation manuelle difficile
- ❌ Impossible de montrer facilement à un client
- ❌ Risque d'erreurs de commande
- ❌ Pas de visibilité globale

### Solution : Control Panel

Avec le Control Panel :

```bash
# 1 seul fichier HTML à ouvrir
open control-panel/index.html

# OU serveur HTTP simple
cd control-panel
python -m http.server 8080
# Ouvrir http://localhost:8080
```

**Avantages** :
- ✅ Interface visuelle intuitive
- ✅ 1 clic pour démarrer chaque simulateur
- ✅ Monitoring temps réel (WebSocket)
- ✅ Logs centralisés dans chaque card
- ✅ Scénarios pré-configurés (Démo 2min)
- ✅ Parfait pour démo commerciale client

## 🔧 Comment Ça Fonctionne ?

### Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                     CONTROL PANEL (HTML)                     │
│                         Frontend JS                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ HTTP POST + WebSocket
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API (FastAPI) - Port 8000              │
│         Router: app/routers/simulator_control.py            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SimulatorManager (gestionnaire global)                     │
│  ├─ simulators["gavage"]    → SimulatorProcess             │
│  ├─ simulators["monitor"]   → SimulatorProcess             │
│  ├─ simulators["sqal"]      → SimulatorProcess             │
│  └─ simulators["consumer"]  → SimulatorProcess             │
│                                                              │
│  Méthodes:                                                   │
│  ├─ start_gavage(nb_lots, acceleration)                     │
│  ├─ stop_gavage()                                            │
│  ├─ start_monitor(interval)                                 │
│  ├─ stop_monitor()                                           │
│  ├─ start_sqal(device, interval, samples)                   │
│  ├─ stop_sqal()                                              │
│  ├─ start_consumer(interval, num_feedbacks)    ← NOUVEAU    │
│  └─ stop_consumer()                             ← NOUVEAU    │
│                                                              │
│  Endpoints API:                                              │
│  ├─ POST /api/control/gavage/start                          │
│  ├─ POST /api/control/gavage/stop                           │
│  ├─ POST /api/control/monitor/start                         │
│  ├─ POST /api/control/monitor/stop                          │
│  ├─ POST /api/control/sqal/start                            │
│  ├─ POST /api/control/sqal/stop                             │
│  ├─ POST /api/control/consumer/start           ← NOUVEAU    │
│  ├─ POST /api/control/consumer/stop            ← NOUVEAU    │
│  ├─ POST /api/control/stop-all                              │
│  ├─ GET  /api/control/status                                │
│  └─ WS   /api/control/ws                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ subprocess.Popen()
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   SIMULATEURS (Python)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. simulators/gavage_realtime/main.py                      │
│     → Génère gavages 2×/jour sur 14 jours                   │
│                                                              │
│  2. simulators/sqal/lot_monitor.py                          │
│     → Polling DB pour lots terminés                         │
│                                                              │
│  3. simulator-sqal/src/main.py                              │
│     → Simule capteurs IoT ESP32                             │
│                                                              │
│  4. simulators/consumer-satisfaction/main.py    ← NOUVEAU   │
│     → Génère feedbacks consommateurs réalistes              │
└─────────────────────────────────────────────────────────────┘
```

### Flux d'Exécution

#### 1. Démarrage d'un Simulateur

```javascript
// 1. User clique "▶️ Démarrer" dans Control Panel (HTML)
async function startGavage() {
    const lots = document.getElementById('gavage-lots').value; // 1
    const acceleration = document.getElementById('gavage-acceleration').value; // 86400

    // 2. Appel API backend
    const response = await fetch('http://localhost:8000/api/control/gavage/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nb_lots: parseInt(lots),
            acceleration: parseInt(acceleration)
        })
    });

    // 3. Update UI
    if (response.ok) {
        updateStatus('gavage', 'running');
        addLog('gavage', '✅ Simulateur démarré avec succès', 'success');
    }
}
```

```python
# 4. Backend reçoit requête (simulator_control.py)
@router.post("/gavage/start")
async def start_gavage_simulator(params: GavageStartRequest):
    manager.start_gavage(params.nb_lots, params.acceleration)
    await manager.broadcast_status()  # Broadcast WebSocket
    return {"success": True, "message": "..."}

# 5. Manager démarre processus Python
def start_gavage(self, nb_lots: int, acceleration: int) -> bool:
    # Chemin vers simulateur
    simulator_path = "simulators/gavage_realtime/main.py"

    # Lancement subprocess
    sim.process = subprocess.Popen([
        "python",
        simulator_path,
        "--nb-lots", str(nb_lots),
        "--acceleration", str(acceleration)
    ])

    sim.status = "running"
    sim.start_time = datetime.now()
    return True
```

```python
# 6. Simulateur Python tourne en arrière-plan
# simulators/gavage_realtime/main.py
async def main():
    for jour in range(14):
        # Gavage matin
        await send_gavage(lot_id, "matin", dose)
        # Gavage soir
        await send_gavage(lot_id, "soir", dose)
        # Attendre (accéléré)
        await asyncio.sleep(24 * 3600 / acceleration)
```

#### 2. Monitoring Temps Réel (WebSocket)

```javascript
// Control Panel se connecte au WebSocket
function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8000/api/control/ws');

    ws.onopen = () => {
        console.log('✅ WebSocket connecté');
        addLog('gavage', '🔌 WebSocket connecté au backend', 'success');
    };

    // Réception des updates
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // data = {
        //   "timestamp": "2025-01-27T14:30:00",
        //   "simulators": {
        //     "gavage": { "status": "running", "running": true, "uptime": 45, "stats": {...} },
        //     "monitor": { "status": "offline", "running": false, ... },
        //     "sqal": { ... },
        //     "consumer": { ... }
        //   }
        // }
        updateUIFromBackend(data);
    };
}

function updateUIFromBackend(data) {
    // Update status badges
    updateStatus('gavage', data.simulators.gavage.running ? 'running' : 'offline');

    // Update stats
    updateStat('gavage', 'messages', data.simulators.gavage.stats.messages_sent);
}
```

```python
# Backend broadcast status toutes les 2 secondes
@router.websocket("/ws")
async def websocket_control(websocket: WebSocket):
    await websocket.accept()
    manager.websocket_clients.append(websocket)

    while True:
        await asyncio.sleep(2)

        # Update uptime
        for sim in manager.simulators.values():
            if sim.is_running():
                sim.stats["uptime_seconds"] = sim.get_uptime()

        # Broadcast à tous les clients
        await websocket.send_json(manager.get_all_status())
```

#### 3. Arrêt d'un Simulateur

```javascript
// Control Panel
async function stopGavage() {
    const response = await fetch('http://localhost:8000/api/control/gavage/stop', {
        method: 'POST'
    });

    if (response.ok) {
        updateStatus('gavage', 'offline');
        addLog('gavage', '✅ Simulateur arrêté', 'info');
    }
}
```

```python
# Backend
def stop_gavage(self) -> bool:
    sim = self.simulators["gavage"]

    # Graceful shutdown
    if os.name == 'nt':  # Windows
        sim.process.terminate()
    else:  # Unix
        os.kill(sim.process.pid, signal.SIGTERM)

    sim.process.wait(timeout=5)  # Attendre max 5s

    sim.status = "stopped"
    sim.process = None
    return True
```

## 🚀 Scénario de Démo Typique

### Scénario "🚀 Démo Rapide (2 min)"

Quand l'utilisateur clique sur le bouton **"🚀 Démo Rapide (2 min)"** :

```javascript
function launchDemo() {
    // 1. Configurer paramètres optimaux
    document.getElementById('gavage-lots').value = 1;
    document.getElementById('gavage-acceleration').value = 86400; // 1 jour = 1s
    document.getElementById('monitor-interval').value = 5; // Polling 5s
    document.getElementById('consumer-interval').value = 5;
    document.getElementById('consumer-num').value = 20;

    // 2. Logs dans toutes les cards
    addLog('gavage', '🚀 Lancement scénario Démo Rapide (2 min)', 'info');
    addLog('monitor', '🚀 Lancement scénario Démo Rapide (2 min)', 'info');
    addLog('sqal', '🚀 Lancement scénario Démo Rapide (2 min)', 'info');
    addLog('consumer', '🚀 Lancement scénario Démo Rapide (2 min)', 'info');

    // 3. Démarrer Gavage
    startGavage();

    // 4. Démarrer Monitor 1s après
    setTimeout(() => startMonitor(), 1000);

    // 5. Message pour Consumer (démarrage manuel après SQAL)
    setTimeout(() => {
        addLog('consumer', '💡 Attendez que SQAL génère des QR codes avant de démarrer', 'warning');
    }, 2000);
}
```

**Timeline de la Démo** :

```
⏱️ 0:00 - Clic "🚀 Démo Rapide"
       ↓
⏱️ 0:01 - Gavage démarre
       ├─ Logs: "🚀 Démarrage simulateur gavage..."
       ├─ Logs: "📦 1 lots, accélération ×86400"
       └─ Status: "En cours" (badge bleu)
       ↓
⏱️ 0:02 - Monitor démarre automatiquement
       ├─ Logs: "🚀 Démarrage Lot Monitor..."
       └─ Logs: "🔍 Polling: 5s"
       ↓
⏱️ 0:03-0:15 - Gavage simule 14 jours
       ├─ Logs: "📊 Gavage matin J0 envoyé"
       ├─ Logs: "📊 Gavage soir J0 envoyé"
       ├─ Logs: "📊 Gavage matin J1 envoyé"
       ├─ ...
       └─ Stats: "28 gavages envoyés"
       ↓
⏱️ 0:20 - Monitor détecte lot terminé
       ├─ Logs: "🔍 Lot #1 terminé détecté !"
       ├─ Logs: "📦 Création de 5 échantillons SQAL..."
       └─ Logs: "🚀 Démarrage simulateur SQAL automatique"
       ↓
⏱️ 0:25-0:40 - SQAL contrôle qualité
       ├─ Logs SQAL: "🔬 Mesure #1: Grade A+ (96.2)"
       ├─ Logs SQAL: "🔬 Mesure #2: Grade A (88.7)"
       ├─ Logs SQAL: "🔬 Mesure #3: Grade A+ (97.1)"
       ├─ Logs SQAL: "🔬 Mesure #4: Grade A (89.3)"
       ├─ Logs SQAL: "🔬 Mesure #5: Grade B (82.5)"
       └─ Logs SQAL: "🔗 5 QR codes générés avec blockchain"
       ↓
⏱️ 0:45 - User démarre manuellement Consumer
       ├─ Clic "▶️ Démarrer" dans card Consumer
       └─ Logs: "🚀 Démarrage simulateur satisfaction..."
       ↓
⏱️ 0:50-2:30 - Consumer génère 20 feedbacks
       ├─ Logs: "📦 5 produits disponibles"
       ├─ Logs: "🛒 Produit sélectionné: FG_LS_20250127_001"
       ├─ Logs: "📱 Scan QR réussi"
       ├─ Logs: "😊 Feedback #1: 4/5 (Satisfait)"
       ├─ Logs: "😊 Feedback #2: 5/5 (Enthousiaste)"
       ├─ ...
       ├─ Logs: "😊 Feedback #20: 4/5 (Satisfait)"
       └─ Stats: "Note moyenne: 3.8 ⭐"
       ↓
⏱️ 2:30 - FIN DE LA DÉMO
       ↓
       User peut maintenant entraîner l'IA via curl
```

## 📊 Ce que le Control Panel Montre

### Pour Chaque Simulateur (4 Cards)

Chaque card affiche :

1. **Icon** : Emoji représentatif (🦆 🔍 🔬 🎭)

2. **Status Badge** :
   - 🔴 `Arrêté` (rouge) - Process non démarré
   - 🔵 `En cours` (bleu) - Process actif
   - 🟢 `Online` (vert) - WebSocket connecté

3. **Paramètres Configurables** :
   - Gavage : Nombre de lots (1-10), Accélération (×1 à ×86400)
   - Monitor : Intervalle polling (5-300s)
   - SQAL : Device ID, Intervalle mesures (5-300s)
   - Consumer : Intervalle feedbacks (2-300s), Nombre (1-1000)

4. **Boutons Actions** :
   - ▶️ **Démarrer** : Lance le simulateur
   - ⏹️ **Arrêter** : Stoppe le simulateur

5. **Statistiques Temps Réel** :
   - Gavage : Lots actifs, Gavages envoyés
   - Monitor : Lots détectés, Lots inspectés
   - SQAL : Mesures envoyées, Grade moyen
   - Consumer : Feedbacks envoyés, Note moyenne ⭐

6. **Logs en Direct** :
   ```
   [14:30:15] 🚀 Démarrage simulateur gavage...
   [14:30:16] ✅ Simulateur démarré avec succès
   [14:30:17] 📊 Gavage matin J0 envoyé
   [14:30:18] 📊 Gavage soir J0 envoyé
   ...
   ```

## 🎯 Cas d'Usage du Control Panel

### 1. Démo Commerciale Client

**Contexte** : Présentation à un client potentiel (Euralis, distributeur, investisseur)

**Utilisation** :
1. Ouvrir `control-panel/index.html` sur laptop
2. Connecter écran externe / projecteur
3. Cliquer **"🚀 Démo Rapide (2 min)"**
4. Montrer les 4 cards se remplir en direct
5. Expliquer la boucle fermée pendant que ça tourne
6. À la fin, montrer résultats en base :
   ```bash
   psql -U gaveurs_admin -d gaveurs_db -c "SELECT COUNT(*) FROM consumer_feedbacks;"
   # Output: 20
   ```

**Avantage** : Visuel, simple, temps réel, impressionnant

### 2. Tests Développement

**Contexte** : Développeur teste une nouvelle feature

**Utilisation** :
1. Démarrer backend : `uvicorn app.main:app --reload`
2. Ouvrir Control Panel
3. Démarrer simulateur concerné (ex: Consumer pour tester ML)
4. Observer logs en direct
5. Vérifier comportement
6. Arrêter quand terminé

**Avantage** : Pas besoin de taper commandes, logs centralisés

### 3. Tests QA / Validation

**Contexte** : QA valide le flux end-to-end

**Utilisation** :
1. Suivre procédure démo 2 minutes
2. Vérifier chaque étape :
   - ✅ Gavage termine bien après 14 jours
   - ✅ Monitor détecte lot automatiquement
   - ✅ SQAL génère 5 QR codes
   - ✅ Consumer envoie 20 feedbacks
3. Vérifier base de données
4. Entraîner IA et vérifier output

**Avantage** : Reproductible, complet, tracé

### 4. Formation Utilisateurs

**Contexte** : Former gaveurs / techniciens Euralis

**Utilisation** :
1. Montrer Control Panel
2. Expliquer chaque simulateur
3. Faire démo live
4. Laisser utilisateur essayer
5. Expliquer lien avec vraie production

**Avantage** : Pédagogique, interactif

## 🔍 Limitations et Points d'Attention

### ⚠️ Ordre de Démarrage Critique

Le simulateur **Consumer** DOIT attendre que SQAL génère des QR codes :

```
✅ BON ORDRE:
1. Gavage → 2. Monitor → 3. SQAL (auto) → 4. Consumer (manuel)

❌ MAUVAIS ORDRE:
1. Consumer immédiatement
   → Erreur: "Aucun produit disponible"
```

**Solution** : Le Control Panel affiche un warning :
```
💡 Attendez que SQAL génère des QR codes avant de démarrer
```

### ⚠️ Dépendance Backend

Le Control Panel nécessite que le **backend soit démarré** :

```bash
# OBLIGATOIRE AVANT d'ouvrir Control Panel
cd backend-api
uvicorn app.main:app --reload --port 8000
```

Sinon :
```
❌ Erreur: Cannot connect to localhost:8000
💡 Astuce: Vérifiez que le backend est démarré
```

### ⚠️ WebSocket peut se déconnecter

Si le backend redémarre, le WebSocket se ferme. Le Control Panel **auto-reconnecte après 5s** :

```javascript
ws.onclose = () => {
    console.log('🔴 WebSocket fermé, reconnexion dans 5s...');
    setTimeout(connectWebSocket, 5000); // Auto-reconnect
};
```

## 📁 Fichiers du Control Panel

```
control-panel/
├── index.html              ✅ Interface principale (HTML + CSS + JS standalone)
├── README.md              ✅ Documentation usage
├── DEMARRAGE_RAPIDE.md    ✅ Quick start
└── docker_api.py          ⏳ (Optionnel - API Docker avancée)
```

**Fichier principal** : [control-panel/index.html](control-panel/index.html) (~1000 lignes)
- HTML structure (cards, buttons, inputs)
- CSS styling (gradient purple, animations)
- JavaScript logic (fetch API, WebSocket, state management)

**Aucune dépendance externe** : Tout est dans 1 fichier HTML !

## 🎉 Résumé

Le **Control Panel** est :

✅ **Une interface de pilotage unique** pour les 4 simulateurs
✅ **Un outil de démo commerciale** parfait (2 minutes chrono)
✅ **Un outil de développement** pratique (tests rapides)
✅ **Un outil pédagogique** pour expliquer la boucle fermée
✅ **Temps réel** via WebSocket (status, stats, logs)
✅ **Standalone** (1 fichier HTML, 0 dépendance)

**Il permet de démontrer visuellement et de manière interactive que le client est au centre de la boucle fermée**, car on voit en direct :
1. Gavage → SQAL → QR Code → Consumer Scan → Feedback
2. Boucle qui se ferme : Feedback → IA → Recommandations → Retour Gaveur

---

**Fichiers Documentation** :
- [PRESENTATION_BOUCLE_FERMEE.html](PRESENTATION_BOUCLE_FERMEE.html) - Présentation visuelle 7 slides
- [DEMO_READY.md](DEMO_READY.md) - Guide démo step-by-step
- [BOUCLE_FERMEE_COMPLETE.md](BOUCLE_FERMEE_COMPLETE.md) - Vue d'ensemble technique
