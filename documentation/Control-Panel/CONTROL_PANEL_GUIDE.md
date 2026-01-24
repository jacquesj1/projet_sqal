# 🎛️ Guide Complet - Control Panel SQAL

**System de pilotage web pour les simulateurs SQAL**

---

## 🚀 Démarrage Rapide (5 minutes)

### Option 1: Docker Complet (RECOMMANDÉ pour démos clients)

```bash
# 1. Construire l'image du simulateur SQAL (première fois seulement)
docker build -t gaveurs_simulator_sqal:latest -f simulator-sqal/Dockerfile simulator-sqal/

# 2. Démarrer toute la stack
docker-compose up -d

# 3. Vérifier que tout fonctionne
docker-compose ps

# Attendez 30-60 secondes que tout démarre...

# 4. Ouvrir le Control Panel
# → http://localhost:5174
```

**Services disponibles** :
- 🎛️ **Control Panel** : http://localhost:5174 (pilotage simulateurs)
- 📊 **SQAL Dashboard** : http://localhost:5173 (visualisation capteurs)
- 🔧 **Backend API** : http://localhost:8000/docs
- 🏢 **Euralis Dashboard** : http://localhost:3001
- 👨‍🌾 **Gaveurs App** : http://localhost:3000

### Option 2: Docker Minimal (DEV - Backend + Control Panel uniquement)

```bash
# 1. Construire l'image du simulateur
docker build -t gaveurs_simulator_sqal:latest -f simulator-sqal/Dockerfile simulator-sqal/

# 2. Démarrer stack minimale
docker-compose -f docker-compose.dev.yml up -d

# 3. Ouvrir le Control Panel
# → http://localhost:5174
```

**Services disponibles** :
- 🎛️ **Control Panel** : http://localhost:5174
- 🔧 **Backend API** : http://localhost:8000/docs
- 🗄️ **TimescaleDB** : localhost:5432
- 🔴 **Redis** : localhost:6379

---

## 🎯 Utilisation du Control Panel

### 1. Interface Principale

#### Dashboard Stats (en haut)
- **Total Simulators** : Nombre total de simulateurs connus
- **Running** : Simulateurs actifs (🟢)
- **Stopped** : Simulateurs arrêtés (⚪)
- **Errors** : Simulateurs en erreur (🔴)

#### Scénarios Pré-configurés
Cliquez sur un scénario pour démarrer plusieurs simulateurs simultanément :

| Scénario | Description | Devices |
|----------|-------------|---------|
| **Multi-Site Demo** | 4 simulateurs sur 3 sites Euralis | ESP32_LL_01, ESP32_LL_02, ESP32_LS_01, ESP32_MT_01 |
| **Stress Test** | 10 simulateurs à 10s d'intervalle | ESP32_STRESS_01 à ESP32_STRESS_10 |
| **Production Demo** | 2 lignes de production | ESP32_DEMO_01, ESP32_DEMO_02 |

#### Table des Simulateurs
- **Device ID** : Identifiant unique (ex: ESP32_LL_01)
- **Status** : État actuel (running/stopped/error/not_found)
- **Location** : Emplacement physique
- **Uptime** : Temps de fonctionnement (format: XXh XXm XXs)
- **Actions** : Boutons Start/Stop/Kill

### 2. Actions Disponibles

#### ▶️ Start (Simulateur arrêté)
- Démarre un simulateur individuel
- Configuration par défaut :
  - Interval: 30s
  - Config profile: `foiegras_standard_barquette`
  - Duration: infinie

#### ⏹️ Stop (Simulateur en cours)
- Arrêt gracieux (timeout 10s)
- Préserve les logs du container

#### 🗑️ Force Kill (Simulateur en cours)
- Arrêt immédiat (`docker kill`)
- Utiliser si le simulateur ne répond plus

#### ⏹️ Stop All
- Arrête TOUS les simulateurs actifs
- Demande confirmation
- Arrêt gracieux pour tous

### 3. Refresh Automatique

Le dashboard se rafraîchit automatiquement. Choisissez la fréquence :

| Intervalle | Usage | CPU |
|------------|-------|-----|
| **2s** | Développement, debugging | Élevé |
| **5s** | Démo en direct | Moyen ⭐ RECOMMANDÉ |
| **10s** | Monitoring continu | Faible |
| **30s** | Surveillance passive | Très faible |

---

## 🎬 Scénarios de Démo Client

### Démo 1: Multi-Site Production (5 minutes)

**Objectif** : Montrer la supervision temps réel de 4 lignes de production sur 3 sites Euralis.

```bash
# 1. Ouvrir Control Panel
http://localhost:5174

# 2. Cliquer "Multi-Site Demo"
# → Démarre ESP32_LL_01, ESP32_LL_02, ESP32_LS_01, ESP32_MT_01

# 3. Attendre 10-15 secondes (simulateurs démarrent)

# 4. Ouvrir SQAL Dashboard dans nouvel onglet
http://localhost:5173

# 5. Montrer les données en temps réel
# - Matrices ToF 8x8 (distance/reflectance/amplitude)
# - Spectral data AS7341 (10 canaux)
# - Grades qualité (A+, A, B, C, D)

# 6. Retour Control Panel
# - Montrer uptime qui augmente
# - Arrêter ESP32_LL_01 individuellement
# - Stats se mettent à jour (Running: 3, Stopped: 1)

# 7. Stop All
# → Tous les simulateurs s'arrêtent
```

### Démo 2: Stress Test Performance (3 minutes)

**Objectif** : Démontrer la robustesse du système sous charge.

```bash
# 1. Control Panel → "Stress Test"
# → 10 simulateurs à 10s d'intervalle

# 2. Montrer dans SQAL Dashboard
# - 10 devices actifs
# - Data flow continu
# - Pas de perte de messages

# 3. Monitoring Backend
docker-compose logs -f backend | grep "saved"

# 4. Stop All
```

### Démo 3: Cycle Complet (10 minutes)

**Objectif** : Parcourir toute la chaîne de traçabilité.

```bash
# 1. Control Panel → "Production Demo" (2 devices)

# 2. SQAL Dashboard → Vérifier données capteurs

# 3. Euralis Dashboard → Supervision multi-sites
http://localhost:3001/euralis/dashboard

# 4. Backend API → Endpoints
http://localhost:8000/docs
# - GET /api/sqal/devices
# - GET /api/sqal/devices/{device_id}/samples

# 5. Base de données
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db
SELECT device_id, COUNT(*), MAX(timestamp)
FROM sqal_sensor_samples
GROUP BY device_id
ORDER BY MAX(timestamp) DESC;

# 6. Control Panel → Stop All
```

---

## 🔧 Configuration Avancée

### Créer un Nouveau Scénario Personnalisé

Éditez [backend-api/app/routers/control_panel.py:252-265](backend-api/app/routers/control_panel.py#L252-L265) :

```python
scenarios = {
    "custom_scenario": [
        {"device_id": "ESP32_CUSTOM_01", "location": "Custom Site A", "interval": 20},
        {"device_id": "ESP32_CUSTOM_02", "location": "Custom Site B", "interval": 25}
    ]
}
```

Puis ajoutez dans [control-panel-frontend/src/components/Dashboard.tsx:191-199](control-panel-frontend/src/components/Dashboard.tsx#L191-L199) :

```tsx
<button
  onClick={() => handleScenario('custom_scenario')}
  className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50"
>
  <h3 className="font-semibold text-gray-900 mb-1">Custom Scenario</h3>
  <p className="text-sm text-gray-600">Description du scénario</p>
</button>
```

### Démarrer un Simulateur via API

```bash
curl -X POST http://localhost:8000/api/control-panel/simulators/start \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ESP32_MANUAL_01",
    "location": "Test Manual",
    "interval": 15,
    "config_profile": "foiegras_standard_barquette",
    "duration": 300
  }'
```

### Récupérer les Logs d'un Simulateur

```bash
curl http://localhost:8000/api/control-panel/simulators/logs/ESP32_LL_01?tail=50
```

### Vérifier les Données en Base

```bash
# Connexion à TimescaleDB
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db

# Requêtes utiles
SELECT device_id, COUNT(*), MAX(timestamp) as last_sample
FROM sqal_sensor_samples
GROUP BY device_id
ORDER BY last_sample DESC;

SELECT * FROM sqal_sensor_samples
WHERE device_id = 'ESP32_LL_01'
ORDER BY timestamp DESC
LIMIT 5;
```

---

## 🐞 Troubleshooting

### Problème 1: Control Panel ne démarre pas

**Symptôme** :
```
Error: Cannot find module 'vite'
```

**Solution** :
```bash
cd control-panel-frontend
npm install
docker-compose build control-panel
docker-compose up -d control-panel
```

### Problème 2: Backend ne peut pas gérer les containers

**Symptôme** :
```
docker.errors.DockerException: Error while fetching server API version
```

**Solution Windows** :
```powershell
# Vérifier Docker Desktop est lancé
docker ps

# Redémarrer backend
docker-compose restart backend
```

**Solution Linux** :
```bash
# Ajouter user au groupe docker
sudo usermod -aG docker $USER
newgrp docker

# Redémarrer backend
docker-compose restart backend
```

### Problème 3: Image simulateur manquante

**Symptôme** :
```
Error: No such image: gaveurs_simulator_sqal:latest
```

**Solution** :
```bash
# Build l'image du simulateur
docker build -t gaveurs_simulator_sqal:latest -f simulator-sqal/Dockerfile simulator-sqal/

# Vérifier
docker images | grep simulator
```

### Problème 4: Simulateurs ne s'arrêtent pas

**Symptôme** :
```
Container still running after stop command
```

**Solution** :
```bash
# Force kill via Docker CLI
docker ps | grep sqal_simulator
docker kill <container_id>

# Ou via Control Panel
# → Bouton "Force Kill" (🗑️)
```

### Problème 5: Pas de données dans SQAL Dashboard

**Symptôme** :
```
No samples found for device
```

**Vérifications** :
```bash
# 1. Backend reçoit les WebSocket messages?
docker-compose logs -f backend | grep "Sensor data received"

# 2. Simulateur envoie bien les données?
docker logs sqal_simulator_esp32_ll_01 | grep "sent"

# 3. Données en base?
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c \
  "SELECT device_id, COUNT(*) FROM sqal_sensor_samples GROUP BY device_id;"
```

---

## 📊 Monitoring

### Logs en Temps Réel

```bash
# Tous les services
docker-compose logs -f

# Backend uniquement
docker-compose logs -f backend

# Control Panel
docker-compose logs -f control-panel

# Simulateur spécifique
docker logs -f sqal_simulator_esp32_ll_01
```

### Métriques Prometheus

```bash
# Métriques backend
curl http://localhost:8000/metrics

# Filtrer simulateurs
curl http://localhost:8000/metrics | grep simulator
```

### Health Checks

```bash
# Backend
curl http://localhost:8000/health

# Control Panel
curl http://localhost:5174/

# Control Panel API
curl http://localhost:8000/api/control-panel/health
```

---

## 🎓 Formation Utilisateurs

### Checklist Démo Client (5 min)

- [ ] Lancer `docker-compose up -d` (attendre 60s)
- [ ] Ouvrir Control Panel (http://localhost:5174)
- [ ] Cliquer "Multi-Site Demo"
- [ ] Montrer stats en temps réel
- [ ] Ouvrir SQAL Dashboard (http://localhost:5173)
- [ ] Montrer données capteurs (ToF + Spectral)
- [ ] Retour Control Panel
- [ ] Arrêter 1 simulateur individuellement
- [ ] Montrer stats mises à jour
- [ ] Cliquer "Stop All"
- [ ] Q&A

### Points Clés à Mentionner

1. **Architecture modulaire** : Backend API unique pour tous les frontends
2. **Temps réel** : WebSocket pour données capteurs instantanées
3. **Scalabilité** : 10+ simulateurs en parallèle sans problème
4. **Production-ready** : Docker + healthchecks + logging
5. **Traçabilité** : TimescaleDB pour historique complet

---

## 📦 Export des Données

### Export CSV des Samples

```sql
-- Connexion à la base
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db

-- Export CSV
\copy (SELECT * FROM sqal_sensor_samples WHERE device_id = 'ESP32_LL_01' ORDER BY timestamp DESC LIMIT 1000) TO '/tmp/samples.csv' CSV HEADER;
```

### Export JSON via API

```bash
# Tous les samples d'un device
curl "http://localhost:8000/api/sqal/devices/ESP32_LL_01/samples?limit=100" > samples.json

# Avec filtres
curl "http://localhost:8000/api/sqal/devices/ESP32_LL_01/samples?limit=50&offset=0&quality_grade=A" > samples_grade_A.json
```

---

## 🔐 Sécurité (TODO - Phase 4)

### Limitations Actuelles

⚠️ **Environnement de développement** - Ne pas exposer en production tel quel :

- Pas d'authentification sur le Control Panel
- Docker socket exposé au backend (risque élevé)
- CORS ouvert à tous les origins (`allow_origins=["*"]`)

### Roadmap Sécurité

- [ ] JWT authentication sur Control Panel
- [ ] Role-based access control (RBAC)
- [ ] Docker socket via proxy sécurisé
- [ ] CORS restreint aux domaines autorisés
- [ ] HTTPS avec certificats SSL
- [ ] Rate limiting sur API Control Panel

---

## 📞 Support

### Logs Utiles

```bash
# Backend logs
docker-compose logs backend | tail -100

# Control Panel build logs
docker-compose build control-panel --no-cache

# Simulateur logs
docker logs sqal_simulator_esp32_ll_01 --tail 50
```

### Commandes de Diagnostic

```bash
# Vérifier tous les containers
docker-compose ps

# Vérifier réseau Docker
docker network inspect gaveurs_network

# Vérifier volumes
docker volume ls | grep gaveurs

# Espace disque
docker system df
```

---

## ✅ Checklist Mise en Production

- [ ] Build image simulateur: `docker build -t gaveurs_simulator_sqal:latest`
- [ ] Tester stack complète: `docker-compose up -d`
- [ ] Vérifier tous les health checks: `docker-compose ps`
- [ ] Tester Control Panel: http://localhost:5174
- [ ] Tester scénario Multi-Site
- [ ] Vérifier données en base TimescaleDB
- [ ] Vérifier logs backend sans erreurs
- [ ] Tester arrêt/redémarrage simulateurs
- [ ] Tester "Stop All"
- [ ] Documenter configuration client spécifique

---

**Créé par** : Claude Code
**Date** : 2026-01-06
**Version** : 1.0.0
