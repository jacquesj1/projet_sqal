# Guide Control Panel - Système Gaveurs V3.0

**Date**: 2025-12-26
**Version**: 3.0.0

---

## 📋 Vue d'ensemble

Le **Control Panel** est une interface web pour piloter les simulateurs en mode **standalone** (hors Docker).

**Limitation importante**: Le control panel **ne peut pas** piloter les simulateurs Docker directement.

---

## 🚀 Lancer le Control Panel

### Option 1: Python (Recommandé)

```bash
cd control-panel
python -m http.server 8888
```

Puis accéder à: **http://localhost:8888**

### Option 2: Node.js

```bash
cd control-panel
npx serve -p 8888
```

Puis accéder à: **http://localhost:8888**

### Option 3: VS Code Live Server

1. Installer l'extension "Live Server"
2. Clic droit sur `control-panel/index.html` → "Open with Live Server"

---

## ⚠️ Control Panel vs Docker

### Control Panel (Mode Standalone)

**Avantages**:
- Interface graphique conviviale
- Démarrage/arrêt facile des simulateurs
- Contrôle en temps réel
- Logs visibles dans le navigateur

**Inconvénients**:
- ❌ **Ne fonctionne PAS avec Docker**
- Nécessite Python installé localement
- Les simulateurs s'exécutent sur la machine hôte

**Comment ça marche**:
```
┌──────────────────┐
│  Control Panel   │
│  (Navigateur)    │
└────────┬─────────┘
         │ HTTP requests
         ▼
┌──────────────────┐
│  Simulateur      │
│  Python local    │ (localhost:5000, 5001...)
└──────────────────┘
```

### Docker Compose (Mode Production)

**Avantages**:
- ✅ Isolation complète
- ✅ Pas besoin de Python local
- ✅ Configuration centralisée
- ✅ Redémarrage automatique

**Inconvénients**:
- Pas d'interface graphique (seulement CLI)
- Logs dans le terminal

**Comment ça marche**:
```
┌──────────────────┐
│  docker-compose  │
│  (CLI)           │
└────────┬─────────┘
         │ Docker API
         ▼
┌──────────────────┐
│  Conteneur       │
│  Simulateur      │ (réseau interne gaveurs_network)
└──────────────────┘
```

---

## 🎯 Modes d'utilisation

### Mode 1: Développement avec Control Panel

**Quand l'utiliser**:
- Tests rapides
- Développement de nouveaux simulateurs
- Debugging interactif

**Setup**:

1. **NE PAS démarrer les conteneurs Docker**:
   ```bash
   docker-compose down
   ```

2. **Lancer le control panel**:
   ```bash
   cd control-panel
   python -m http.server 8888
   ```

3. **Accéder à**: http://localhost:8888

4. **Démarrer les simulateurs** depuis l'interface:
   - Cliquer sur "Start SQAL Simulator"
   - Cliquer sur "Start Gavage Simulator"

5. **Les simulateurs tournent en local** (pas en Docker)

### Mode 2: Production avec Docker

**Quand l'utiliser**:
- Déploiement production
- Tests d'intégration complets
- Environnement CI/CD

**Setup**:

```bash
# Démarrer tous les services
docker-compose up -d

# Vérifier les statuts
docker-compose ps

# Voir les logs des simulateurs
docker-compose logs simulator-sqal -f
docker-compose logs simulator-gavage -f

# Arrêter un simulateur
docker-compose stop simulator-sqal

# Redémarrer un simulateur
docker-compose restart simulator-sqal
```

---

## 🔧 Commandes Docker pour piloter les simulateurs

### Simulateur SQAL

```bash
# Démarrer
docker-compose up -d simulator-sqal

# Arrêter
docker-compose stop simulator-sqal

# Redémarrer
docker-compose restart simulator-sqal

# Voir les logs en temps réel
docker-compose logs simulator-sqal -f

# Voir les 50 dernières lignes
docker-compose logs simulator-sqal --tail 50

# Supprimer le conteneur
docker-compose down simulator-sqal
```

### Simulateur Gavage

```bash
# Démarrer (génère un fichier CSV puis s'arrête)
docker-compose up -d simulator-gavage

# Voir les logs
docker-compose logs simulator-gavage

# Le fichier CSV est généré dans:
# ./data/simulated_gavage_data.csv
```

### Tous les simulateurs

```bash
# Démarrer tous
docker-compose up -d simulator-sqal simulator-gavage

# Arrêter tous
docker-compose stop simulator-sqal simulator-gavage

# Voir tous les logs
docker-compose logs simulator-sqal simulator-gavage -f
```

---

## 📊 Configuration des simulateurs Docker

### Modifier l'intervalle d'envoi (SQAL)

Éditer `docker-compose.yml`:

```yaml
simulator-sqal:
  command: >
    python main.py
    --device ESP32_DOCKER_01
    --location "Ligne A - Docker"
    --backend-url ws://backend:8000/ws/sensors/
    --interval 30  # ← Changer ici (en secondes)
    --config-profile foiegras_standard_barquette
```

Puis redémarrer:
```bash
docker-compose up -d simulator-sqal
```

### Modifier le nombre de lots (Gavage)

Éditer `docker-compose.yml`:

```yaml
simulator-gavage:
  command: python main.py --output /data/simulated_gavage_data.csv --nb-lots 100
```

---

## 🆕 Script de pilotage Docker (Optionnel)

Si vous voulez une interface similaire au control panel pour Docker, je peux créer:

### Option A: Script CLI interactif

```bash
./scripts/control-docker-simulators.sh

Menu:
1. Démarrer SQAL
2. Arrêter SQAL
3. Logs SQAL
4. Démarrer Gavage
5. Status tous simulateurs
```

### Option B: API REST pour Docker

Un petit serveur FastAPI qui expose des endpoints:
- `POST /simulators/sqal/start`
- `POST /simulators/sqal/stop`
- `GET /simulators/status`

Le control panel pourrait alors appeler cette API.

**Voulez-vous que je crée l'une de ces options?**

---

## 🐛 Troubleshooting

### Control Panel ne démarre pas

**Problème**: "Access to localhost denied"

**Solution**: Utiliser un serveur HTTP, pas `file://`
```bash
cd control-panel
python -m http.server 8888
```

### Les simulateurs ne démarrent pas depuis le control panel

**Problème**: Les boutons ne fonctionnent pas

**Causes possibles**:
1. **Docker est en cours d'exécution**: Arrêter Docker d'abord
   ```bash
   docker-compose down
   ```

2. **Ports déjà utilisés**: Vérifier que 5000, 5001 sont libres
   ```bash
   netstat -an | grep 5000
   netstat -an | grep 5001
   ```

3. **Python/dépendances manquantes**: Installer les requirements
   ```bash
   cd simulator-sqal
   pip install -r requirements.txt
   ```

### Simulateur Docker redémarre en boucle

**Vérifier les logs**:
```bash
docker-compose logs simulator-sqal --tail 50
```

**Causes fréquentes**:
- Module Python manquant → Reconstruire l'image
  ```bash
  docker-compose build simulator-sqal
  ```

- Backend non accessible → Vérifier que backend est démarré
  ```bash
  docker-compose ps backend
  ```

---

## 📝 Résumé des choix

| Critère | Control Panel | Docker Compose |
|---------|--------------|----------------|
| **Interface** | Web graphique | CLI |
| **Installation** | Python local requis | Docker seulement |
| **Production** | ❌ Non recommandé | ✅ Recommandé |
| **Développement** | ✅ Pratique | ⚠️ Moins flexible |
| **Isolation** | ❌ Partage l'OS | ✅ Conteneurs isolés |
| **Logs** | Navigateur | Terminal/fichiers |
| **Redémarrage auto** | ❌ Non | ✅ Oui |

---

## 🎯 Recommandation

- **Développement rapide**: Control Panel en mode standalone
- **Tests/Production**: Docker Compose
- **Compromis**: Créer un wrapper Docker pour le control panel (voir section "Script de pilotage")

---

**Besoin d'aide?** Demandez-moi de créer le script de pilotage Docker! 🚀
