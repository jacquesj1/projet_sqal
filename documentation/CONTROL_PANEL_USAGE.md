# 🎛️ Panneau de Contrôle Simulateurs - Guide d'Utilisation

## Vue d'Ensemble

Le panneau de contrôle est une **interface web unique** permettant de contrôler les 3 simulateurs du système Gaveurs V3.0 pour des **démonstrations** et des **tests**.

**Accès**: `d:\GavAI\projet-euralis-gaveurs\control-panel\index.html`

**Fichier unique**: HTML + CSS + JavaScript embarqué (pas de dépendances externes)

---

## Architecture

### Backend API (FastAPI)

**Nouveau router**: `backend-api/app/routers/simulator_control.py`

**Endpoints REST**:
```
POST /api/control/gavage/start       - Démarrer simulateur gavage
POST /api/control/gavage/stop        - Arrêter simulateur gavage
POST /api/control/monitor/start      - Démarrer lot monitor
POST /api/control/monitor/stop       - Arrêter lot monitor
POST /api/control/sqal/start         - Démarrer simulateur SQAL
POST /api/control/sqal/stop          - Arrêter simulateur SQAL
POST /api/control/stop-all           - Arrêter tous les simulateurs
GET  /api/control/status             - Status de tous les simulateurs
```

**WebSocket**:
```
WS /api/control/ws                   - Mises à jour temps réel (toutes les 2s)
```

### Frontend (HTML/CSS/JS)

**Fichier unique**: `control-panel/index.html`

**Fonctionnalités**:
- 3 cards de contrôle (Gavage, Monitor, SQAL)
- 3 scénarios pré-configurés (Démo 2min, Test 15min, Production 24h)
- WebSocket temps réel pour status/stats
- Logs en direct pour chaque simulateur
- Bouton "Arrêter Tout"

---

## Démarrage

### 1. Démarrer le Backend

```bash
cd backend-api
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Vérifier**: http://localhost:8000/docs (Swagger UI)

### 2. Ouvrir le Control Panel

**Méthode 1** - Double-clic sur `control-panel/index.html`

**Méthode 2** - Serveur HTTP simple:
```bash
cd control-panel
python -m http.server 8080
# Ouvrir http://localhost:8080
```

**Connexion WebSocket**:
- Automatique au chargement de la page
- Reconnexion automatique toutes les 5s si déconnexion

---

## Utilisation

### Scénarios Pré-configurés

#### 🚀 Démo Rapide (2 minutes)

**Paramètres**:
- Gavage: 1 lot, ×86400 (1 jour = 1s)
- Monitor: Polling 5s

**Durée totale**: ~2 minutes

**Usage**: Démonstration rapide du système complet

**Workflow**:
1. Clic "Démo Rapide"
2. Gavage démarre → 1 lot, 12 jours gavage = 12s
3. Monitor détecte lot terminé après 12s
4. Monitor lance SQAL automatiquement
5. SQAL effectue 5 mesures qualité

---

#### 🧪 Test Réaliste (15 minutes)

**Paramètres**:
- Gavage: 3 lots, ×1440 (1 jour = 60s)
- Monitor: Polling 60s

**Durée totale**: ~15 minutes

**Usage**: Test semi-réaliste pour validation fonctionnelle

**Workflow**:
1. Clic "Test Réaliste"
2. Gavage démarre → 3 lots, 12 jours = 12 minutes
3. Monitor détecte lots terminés
4. SQAL analyse qualité

---

#### 🏭 Simulation Production (24 heures)

**Paramètres**:
- Gavage: 5 lots, ×1 (temps réel)
- Monitor: Polling 60s

**Durée totale**: 12-14 jours en temps réel

**Usage**: Simulation proche production (pour tests longue durée)

**⚠️ Attention**: Ne pas utiliser en démo ! Durée = 12-14 jours réels

---

### Contrôles Manuels

#### Simulateur Gavage Temps Réel

**Paramètres**:
- `Nombre de lots`: 1-10 lots (défaut: 3)
- `Accélération`:
  - `×1`: Temps réel (1 jour = 24h)
  - `×144`: 1 jour = 10 min
  - `×1440`: 1 jour = 60s ⭐ **Recommandé pour tests**
  - `×86400`: 1 jour = 1s (ultra rapide)

**Boutons**:
- ▶️ Démarrer: Lance subprocess Python
- ⏹️ Arrêter: SIGTERM graceful (5s timeout → SIGKILL)

**Logs affichés**:
```
[15:32:10] 🚀 Démarrage simulateur gavage...
[15:32:10] 📦 3 lots, accélération ×1440
[15:32:11] ✅ Simulateur démarré avec succès
```

**Stats temps réel**:
- Lots actifs
- Messages envoyés (gavages enregistrés)

---

#### Lot Monitor

**Paramètres**:
- `Intervalle polling`: 5-300s (défaut: 60s)
- `Échantillons par lot`: 1-20 (défaut: 5)

**Fonctionnement**:
1. Polling DB toutes les Xs secondes
2. Détecte lots avec `status='pending'` dans `sqal_pending_lots`
3. Pour chaque lot détecté:
   - Lance N mesures ESP32 (échantillons par lot)
   - Met à jour `status='inspected'`

**⚠️ Monitoring seulement** - Ne génère pas de données qualité lui-même !

**Logs affichés**:
```
[15:33:05] 🚀 Démarrage Lot Monitor...
[15:33:05] 🔍 Polling: 60s | Échantillons: 5
[15:33:06] ✅ Lot Monitor démarré
```

**Stats temps réel**:
- Lots détectés
- Lots inspectés

---

#### Simulateur SQAL (ESP32)

**Paramètres**:
- `Device ID`: ESP32_DEMO_01 (ou LL_01, LS_01, MT_01)
- `Profil qualité`:
  - Standard: Grade A-B (barquettes supermarché)
  - Premium: Grade A+-A (terrines haut de gamme)
  - Bio: Grade B-C (production bio, qualité variable)
- `Intervalle mesures`: 5-300s (défaut: 30s)

**Capteurs simulés**:
- **VL53L8CH**: ToF laser 8×8 (relief foie gras)
- **AS7341**: Spectral 10 canaux (couleur, fraîcheur)

**Boutons**:
- ▶️ Démarrer: Lance ESP32 digital twin
- ⏹️ Arrêter: Arrête après mesure en cours

**Logs affichés**:
```
[15:34:15] 🚀 Démarrage simulateur SQAL...
[15:34:15] 📡 Device: ESP32_DEMO_01 | Profil: Standard
[15:34:16] ✅ ESP32 simulator démarré
```

**Stats temps réel**:
- Mesures envoyées
- Grade moyen

---

## Données en Temps Réel (WebSocket)

### Connexion

**URL**: `ws://localhost:8000/api/control/ws`

**Format messages** (reçus toutes les 2s):
```json
{
  "timestamp": "2024-12-23T15:30:00Z",
  "simulators": {
    "gavage": {
      "status": "running",
      "running": true,
      "uptime": 120,
      "stats": {
        "messages_sent": 24,
        "errors": 0,
        "uptime_seconds": 120
      }
    },
    "monitor": {
      "status": "running",
      "running": true,
      "uptime": 60,
      "stats": {
        "messages_sent": 0,
        "errors": 0,
        "uptime_seconds": 60
      }
    },
    "sqal": {
      "status": "stopped",
      "running": false,
      "uptime": 0,
      "stats": {
        "messages_sent": 0,
        "errors": 0,
        "uptime_seconds": 0
      }
    }
  }
}
```

### Indicateurs Status

**3 états visuels**:
- 🔴 **Arrêté** (offline): Fond rouge clair
- 🟢 **En ligne** (online): Fond vert clair
- 🔵 **En cours** (running): Fond bleu clair

**Mise à jour automatique** depuis WebSocket toutes les 2s

---

## Workflow Complet (Démo 2 min)

### Timeline

**T+0s**: Clic "Démo Rapide"
```
→ Backend lance gavage_realtime/main.py (subprocess)
→ Paramètres: 1 lot, ×86400
```

**T+1s à T+12s**: Gavage en cours
```
→ 2 gavages/jour × 12 jours = 24 gavages
→ 1 jour = 1s → 12 jours = 12s
→ WebSocket envoie données vers backend
→ Stockage dans hypertable gavage_data
```

**T+12s**: Lot terminé
```
→ Backend insère dans sqal_pending_lots (status='pending')
→ Lot Monitor détecte (polling 5s)
```

**T+17s**: Monitor détecte lot
```
→ Monitor lance ESP32_Simulator pour ce lot
→ Génère 5 échantillons SQAL
```

**T+17s à T+32s**: Mesures SQAL
```
→ 5 mesures × 3s intervalle = 15s
→ Chaque mesure:
  - ToF 8×8 matrice (64 points)
  - Spectral 10 canaux
  - Grade calculé (A+, A, B, C, D)
→ Stockage dans sqal_sensor_samples
```

**T+32s à T+120s**: Génération produit + QR code
```
→ Backend appelle /api/consumer/internal/register-product
→ Génération QR code: SQAL_{lot}_{sample}_{product}_{sig}
→ Liaison blockchain (custom Python)
→ Produit prêt pour consommateur
```

**Résultat final**:
- 1 lot gavé (12 jours compressés en 12s)
- 5 échantillons SQAL analysés
- 5 produits avec QR code + blockchain
- Données exploitables dans dashboards Euralis/Gaveurs/SQAL

---

## Gestion des Processus

### Backend (SimulatorManager)

**Classe**: `SimulatorManager` dans `simulator_control.py`

**Méthodes**:
```python
def start_gavage(nb_lots, acceleration) -> bool
def stop_gavage() -> bool
def start_monitor(polling_interval) -> bool
def stop_monitor() -> bool
def start_sqal(device_id, interval, nb_samples) -> bool
def stop_sqal() -> bool
```

**Subprocess management**:
```python
# Démarrage
sim.process = subprocess.Popen([
    "python",
    simulator_path,
    "--arg1", "value1"
], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

# Arrêt graceful
if os.name == 'nt':  # Windows
    sim.process.terminate()
else:  # Unix
    os.kill(sim.process.pid, signal.SIGTERM)

sim.process.wait(timeout=5)

# Force kill si timeout
sim.process.kill()
```

### Chemins Simulateurs

**Gavage**:
```
projet-euralis-gaveurs/simulators/gavage_realtime/main.py
```

**Lot Monitor**:
```
projet-euralis-gaveurs/simulators/sqal/lot_monitor.py
```

**SQAL**:
```
projet-euralis-gaveurs/simulator-sqal/src/main.py
```

---

## Troubleshooting

### ❌ WebSocket ne se connecte pas

**Symptôme**: Status reste "Arrêté" même après démarrage

**Causes possibles**:
1. Backend non démarré
2. Port 8000 déjà utilisé
3. CORS bloqué (ne devrait pas arriver avec `allow_origins=["*"]`)

**Solution**:
```bash
# Vérifier backend
curl http://localhost:8000/health

# Vérifier WebSocket
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8000/api/control/ws
# Doit retourner: 101 Switching Protocols

# Vérifier logs backend
tail -f backend-api/logs/backend.log
```

---

### ❌ Simulateur ne démarre pas

**Symptôme**: Erreur "Échec démarrage" dans logs

**Causes possibles**:
1. Chemin simulateur invalide
2. Python non trouvé
3. Dépendances manquantes

**Solution**:
```bash
# Tester manuellement gavage
cd simulators/gavage_realtime
python main.py --nb-lots 1 --acceleration 1440

# Tester monitor
cd simulators/sqal
python lot_monitor.py --polling-interval 60

# Tester SQAL
cd simulator-sqal
python src/main.py --device ESP32_LL_01 --interval 30
```

**Vérifier dépendances**:
```bash
pip install asyncio websockets
```

---

### ❌ Simulateur ne s'arrête pas

**Symptôme**: Status reste "En cours" après arrêt

**Causes possibles**:
1. Processus bloqué
2. Timeout dépassé (force kill déclenché)

**Solution**:
```bash
# Windows
taskkill /F /IM python.exe

# Linux/macOS
pkill -9 python

# Vérifier processus Python actifs
ps aux | grep python  # Linux/macOS
tasklist | findstr python  # Windows
```

---

### ❌ Données ne s'affichent pas dans dashboards

**Symptôme**: Simulateur démarre mais dashboards vides

**Causes possibles**:
1. WebSocket backend ↔ simulateur déconnecté
2. Base de données non accessible
3. Frontends non rafraîchis

**Solution**:
```bash
# Vérifier TimescaleDB
docker ps | grep timescaledb

# Vérifier données gavage
psql -U gaveurs_admin -d gaveurs_db -c "SELECT COUNT(*) FROM gavage_data"

# Vérifier données SQAL
psql -U gaveurs_admin -d gaveurs_db -c "SELECT COUNT(*) FROM sqal_sensor_samples"

# Rafraîchir frontends
# Euralis: http://localhost:3000/euralis/dashboard
# Gaveurs: http://localhost:3001
# SQAL: http://localhost:5173
```

---

## Intégration CI/CD (Futur)

### Tests Automatisés

**Scénario test E2E** avec control panel:
```python
# tests/e2e/test_simulator_control.py

import asyncio
import websockets
import requests

async def test_complete_demo_flow():
    """Test complet: Démarrage → Gavage → Monitor → SQAL → Arrêt"""

    # 1. Vérifier backend
    response = requests.get("http://localhost:8000/health")
    assert response.status_code == 200

    # 2. Connecter WebSocket
    async with websockets.connect("ws://localhost:8000/api/control/ws") as ws:
        # 3. Démarrer gavage
        response = requests.post(
            "http://localhost:8000/api/control/gavage/start",
            json={"nb_lots": 1, "acceleration": 86400}
        )
        assert response.status_code == 200

        # 4. Attendre status update WebSocket
        data = await ws.recv()
        status = json.loads(data)
        assert status["simulators"]["gavage"]["running"] == True

        # 5. Attendre fin gavage (12s + marge)
        await asyncio.sleep(15)

        # 6. Démarrer monitor
        response = requests.post(
            "http://localhost:8000/api/control/monitor/start",
            json={"polling_interval": 5}
        )
        assert response.status_code == 200

        # 7. Attendre détection lot
        await asyncio.sleep(10)

        # 8. Vérifier données dans DB
        # ... tests SQL

        # 9. Arrêter tout
        response = requests.post("http://localhost:8000/api/control/stop-all")
        assert response.status_code == 200
```

---

## Améliorations Futures

### Phase 1 - Fonctionnalités

- [ ] **Pause/Resume**: Mettre en pause simulateurs
- [ ] **Speed control**: Changer accélération à chaud
- [ ] **Logs export**: Télécharger logs en .txt
- [ ] **Stats dashboard**: Graphiques temps réel (Chart.js)
- [ ] **Multi-device**: Contrôler plusieurs ESP32 simultanément
- [ ] **Preset custom**: Sauvegarder scénarios personnalisés

### Phase 2 - UI/UX

- [ ] **Dark mode**: Thème sombre
- [ ] **Mobile responsive**: Adaptation mobile/tablette
- [ ] **Notifications**: Toast notifications (succès/erreur)
- [ ] **Progress bars**: Barre de progression gavage
- [ ] **Graphiques**: Charts temps réel (Chart.js / D3.js)

### Phase 3 - Backend

- [ ] **Authentication**: JWT token pour sécuriser endpoints
- [ ] **Rate limiting**: Limiter appels API (prevent spam)
- [ ] **Logs backend**: Historique actions control panel
- [ ] **Metrics**: Prometheus metrics pour simulateurs
- [ ] **Docker**: Containerisation simulateurs

---

## Ressources

### Documentation

- [SYSTEME_COMPLET_BOUCLE_FERMEE.md](./SYSTEME_COMPLET_BOUCLE_FERMEE.md) - Vue système complète
- [FONCTIONNEMENT_SIMULATEURS.md](./FONCTIONNEMENT_SIMULATEURS.md) - Détails simulateurs
- [BLOCKCHAIN_QR_IMPLEMENTATION_REELLE.md](./BLOCKCHAIN_QR_IMPLEMENTATION_REELLE.md) - QR codes + blockchain

### Code Source

- Backend API: `backend-api/app/routers/simulator_control.py`
- Frontend: `control-panel/index.html`
- Simulateur Gavage: `simulators/gavage_realtime/main.py`
- Lot Monitor: `simulators/sqal/lot_monitor.py`
- Simulateur SQAL: `simulator-sqal/src/main.py`

### Endpoints Backend

**Swagger UI**: http://localhost:8000/docs

**Section**: "Simulator Control"

---

## Support

**Issues GitHub**: https://github.com/anthropics/claude-code/issues

**Documentation complète**: `documentation/`

**Logs backend**: `backend-api/logs/backend.log`

**Contact**: Voir README principal
