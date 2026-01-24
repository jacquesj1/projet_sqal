# 🎛️ Panneau de Contrôle Simulateurs

Interface web unique pour contrôler et démontrer les 3 simulateurs du système Gaveurs V3.0.

## 🚀 Démarrage Rapide

### 1. Démarrer le Backend

```bash
cd backend-api
uvicorn app.main:app --reload --port 8000
```

### 2. Ouvrir le Panneau de Contrôle

**Option A** - Double-clic sur `index.html`

**Option B** - Serveur HTTP local :
```bash
cd control-panel
python -m http.server 8080
```
Puis ouvrir http://localhost:8080

### 3. Lancer une Démo

Cliquer sur **🚀 Démo Rapide (2 min)** dans l'interface.

Cela démarre automatiquement :
- Simulateur Gavage (1 lot, ×86400 accélération = 1 jour = 1s)
- Lot Monitor (polling 5s)
- Génération de données SQAL

**Durée totale** : ~2 minutes
**Résultat** : 1 lot complet avec QR codes et traçabilité blockchain

---

## 📋 Fonctionnalités

### 3 Scénarios Pré-configurés

| Scénario | Durée | Usage |
|----------|-------|-------|
| 🚀 **Démo Rapide** | 2 min | Présentation commerciale |
| 🧪 **Test Réaliste** | 15 min | Tests fonctionnels |
| 🏭 **Production** | 12-14 jours | Simulation complète |

### Contrôles Individuels

Chaque simulateur peut être démarré/arrêté indépendamment avec des paramètres personnalisés :

**Gavage** :
- Nombre de lots (1-10)
- Accélération (×1 à ×86400)

**Monitor** :
- Intervalle polling (5-300s)
- Échantillons par lot (1-20)

**SQAL** :
- Device ID
- Profil qualité (Standard/Premium/Bio)
- Intervalle mesures (5-300s)

### Monitoring Temps Réel

- 🔌 **WebSocket** : Connexion automatique au backend
- 📊 **Status** : État de chaque simulateur (Arrêté/En cours)
- 📈 **Stats** : Messages envoyés, lots détectés, grades SQAL
- 📝 **Logs** : Logs en direct avec horodatage

---

## 🔧 Architecture

### Frontend (HTML/CSS/JS)

**Fichier unique** : `index.html` (aucune dépendance externe)

**Composants** :
- Interface gradient purple
- 3 cards de contrôle
- Preset scenarios buttons
- WebSocket client (auto-reconnect)
- Log viewers

### Backend API

**Router** : `backend-api/app/routers/simulator_control.py`

**Endpoints** :
```
POST /api/control/gavage/start
POST /api/control/gavage/stop
POST /api/control/monitor/start
POST /api/control/monitor/stop
POST /api/control/sqal/start
POST /api/control/sqal/stop
POST /api/control/stop-all
GET  /api/control/status
WS   /api/control/ws
```

**Process Management** :
- Subprocess Python (`subprocess.Popen`)
- Graceful shutdown (SIGTERM → 5s → SIGKILL)
- Status tracking temps réel
- WebSocket broadcasting

---

## 📖 Documentation Complète

Voir [documentation/CONTROL_PANEL_USAGE.md](../documentation/CONTROL_PANEL_USAGE.md) pour :
- Workflow complet démo 2 minutes
- Troubleshooting détaillé
- Guide d'intégration CI/CD
- Améliorations futures

---

## 🐛 Troubleshooting

### WebSocket ne se connecte pas

```bash
# Vérifier backend
curl http://localhost:8000/health

# Vérifier WebSocket
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8000/api/control/ws
```

### Simulateur ne démarre pas

Tester manuellement :
```bash
# Gavage
cd simulators/gavage_realtime
python main.py --nb-lots 1 --acceleration 1440

# Monitor
cd simulators/sqal
python lot_monitor.py --polling-interval 60

# SQAL
cd simulator-sqal
python src/main.py --device ESP32_LL_01 --interval 30
```

### Logs Backend

```bash
tail -f backend-api/logs/backend.log
```

---

## 🔗 Liens Utiles

- [Documentation Système Complet](../documentation/SYSTEME_COMPLET_BOUCLE_FERMEE.md)
- [Fonctionnement Simulateurs](../documentation/FONCTIONNEMENT_SIMULATEURS.md)
- [Guide Complet Control Panel](../documentation/CONTROL_PANEL_USAGE.md)
- [Backend API Docs](http://localhost:8000/docs)
