# 🐳 Control Panel Docker - Guide d'utilisation

## 📋 Prérequis

- Docker Desktop installé et démarré
- Python 3.11+ installé
- Les conteneurs backend et base de données démarrés

## 🚀 Démarrage Rapide

### 1. Démarrer l'API Docker Control

**Windows**:
```bash
cd control-panel
start-docker-api.bat
```

**Linux/Mac**:
```bash
cd control-panel
chmod +x start-docker-api.sh
./start-docker-api.sh
```

L'API démarre sur **http://localhost:8889**

### 2. Ouvrir le Control Panel

**Dans un nouveau terminal**:
```bash
cd control-panel
python -m http.server 8888
```

Puis ouvrir dans le navigateur: **http://localhost:8888/index-docker.html**

---

## 🎯 Utilisation

### Interface Control Panel

Le control panel affiche:
- ✅ **Status API**: Connexion à l'API Docker
- 📡 **Simulateur SQAL**: Capteurs IoT temps réel
- 🦆 **Simulateur Gavage**: Générateur de données CSV

### Actions disponibles

#### Pour chaque simulateur:

**Démarrer** (▶️):
- Lance le conteneur Docker
- Le simulateur démarre automatiquement

**Arrêter** (⏹️):
- Arrête le conteneur Docker proprement

**Redémarrer** (🔄):
- Redémarre le conteneur (SQAL seulement)

**Logs** (📋):
- Affiche les 100 dernières lignes de logs

### Status des simulateurs

- 🟢 **En cours**: Le conteneur tourne
- 🔴 **Arrêté**: Le conteneur existe mais est arrêté
- ⚪ **Pas créé**: Le conteneur n'a jamais été créé

---

## 🔧 Architecture

```
┌─────────────────────┐
│  Control Panel      │
│  (index-docker.html)│  Port 8888
└──────────┬──────────┘
           │ HTTP
           │ (fetch API)
           ▼
┌─────────────────────┐
│  Docker API         │
│  (docker_api.py)    │  Port 8889
└──────────┬──────────┘
           │ docker-compose
           │ commands
           ▼
┌─────────────────────┐
│  Docker Daemon      │
│  (Conteneurs)       │
└─────────────────────┘
```

---

## 📖 API REST Documentation

L'API expose ces endpoints:

### Status
```bash
GET  /api/simulators/status
```

### Simulateur SQAL
```bash
POST /api/simulators/sqal/start
POST /api/simulators/sqal/stop
POST /api/simulators/sqal/restart
GET  /api/simulators/sqal/logs?lines=50
```

### Simulateur Gavage
```bash
POST /api/simulators/gavage/start
POST /api/simulators/gavage/stop
GET  /api/simulators/gavage/logs?lines=50
```

### Documentation interactive
http://localhost:8889/docs (Swagger UI)

---

## 🐛 Troubleshooting

### L'API ne démarre pas

**Erreur**: `Port 8889 déjà utilisé`

**Solution**:
```bash
# Windows
netstat -ano | findstr 8889
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:8889 | xargs kill -9
```

### Control Panel affiche "API non accessible"

**Vérifications**:

1. **L'API est-elle démarrée?**
   ```bash
   curl http://localhost:8889
   ```

2. **Le port est-il correct?**
   - API: 8889
   - Control Panel: 8888

3. **Firewall bloque-t-il?**
   - Autoriser Python dans le pare-feu Windows

### Les simulateurs ne démarrent pas

**Vérifier Docker**:
```bash
docker ps
docker-compose ps
```

**Vérifier les logs de l'API**:
```bash
# Dans le terminal où tourne docker_api.py
# Les erreurs s'afficheront ici
```

**Reconstruire les images si nécessaire**:
```bash
docker-compose build simulator-sqal simulator-gavage
```

### Le simulateur SQAL ne se connecte pas au backend

**Vérifier que le backend tourne**:
```bash
docker-compose ps backend
```

**Démarrer le backend si nécessaire**:
```bash
docker-compose up -d backend
```

---

## ⚙️ Configuration

### Modifier le port de l'API

Éditer `docker_api.py`:
```python
uvicorn.run(
    app,
    host="0.0.0.0",
    port=8889,  # ← Changer ici
    log_level="info"
)
```

Puis éditer `index-docker.html`:
```javascript
const API_URL = 'http://localhost:8889';  // ← Changer ici
```

### Auto-refresh du status

Par défaut, le status se rafraîchit toutes les 5 secondes.

Pour changer:
```javascript
// Dans index-docker.html
setInterval(updateAllStatus, 5000);  // ← Changer ici (en ms)
```

---

## 📊 Comparaison avec le mode standalone

| Fonctionnalité | Standalone | Docker |
|----------------|------------|--------|
| **Installation Python local** | ✅ Requis | ❌ Pas nécessaire |
| **Interface graphique** | ✅ Oui | ✅ Oui (via API) |
| **Isolation** | ❌ Partage l'OS | ✅ Conteneurs |
| **Production** | ❌ Non recommandé | ✅ Recommandé |
| **Facilité d'utilisation** | ✅ Direct | ⚠️ 2 services à lancer |

---

## 🎯 Recommandation

**Utiliser le mode Docker** si:
- Vous déployez en production
- Vous voulez une isolation complète
- Vous avez déjà Docker installé

**Utiliser le mode standalone** si:
- Vous développez/testez rapidement
- Vous ne voulez pas Docker
- Vous débuggez le code des simulateurs

---

## 🆘 Support

En cas de problème:

1. **Vérifier les logs de l'API**
2. **Vérifier les logs Docker**: `docker-compose logs`
3. **Consulter la documentation Swagger**: http://localhost:8889/docs
4. **Tester les commandes docker-compose manuellement**

---

**Bon pilotage! 🚀**
