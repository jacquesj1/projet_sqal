# 🚀 Démarrage Stack Complète - Système Gaveurs V3.0

**Guide complet pour démarrer TOUS les services et simulateurs**

---

## 📋 Services Disponibles

### Frontends (5)
| Service | URL | Port | Description |
|---------|-----|------|-------------|
| **Control Panel** | http://localhost:5174 | 5174 | Pilotage simulateurs SQAL |
| **SQAL Dashboard** | http://localhost:5173 | 5173 | Visualisation capteurs IoT |
| **Euralis Dashboard** | http://localhost:3001 | 3001 | Supervision multi-sites |
| **Gaveurs App** | http://localhost:3000 | 3000 | Interface gaveurs individuelle |
| **Traçabilité** | http://localhost:3002 | 3002 | QR codes + feedback consommateurs |

### Backend & Databases
| Service | URL/Port | Description |
|---------|----------|-------------|
| **Backend API** | http://localhost:8000/docs | FastAPI + 15 routers |
| **TimescaleDB** | localhost:5432 | PostgreSQL + time-series |
| **Redis** | localhost:6379 | Cache |
| **Keycloak** | http://localhost:8080 | Auth (optionnel) |

### Simulateurs
| Simulateur | Container | Type | Description |
|-----------|-----------|------|-------------|
| **Gavage One-Shot** | `gaveurs_simulator_gavage` | Batch | Génère CSV de données historiques |
| **Gavage Temps Réel** | `gaveurs_simulator_gavage_realtime` | Continu | WebSocket temps réel (3 lots) |
| **SQAL Docker** | `gaveurs_simulator_sqal` | Continu | Capteurs IoT (ESP32_DOCKER_01) |
| **SQAL Ligne B** | `gaveurs_simulator_sqal_ligne_b` | Continu | Capteurs IoT (ESP32_DOCKER_02) |
| **SQAL Dynamiques** | `sqal_simulator_esp32_*` | À la demande | Via Control Panel |

---

## 🚀 Démarrage Complet

### Étape 1 : Lancer la Stack Principale

```bash
# Démarrer DB, Backend, Control Panel, Frontends
docker-compose up -d
```

**Services lancés** :
- ✅ TimescaleDB
- ✅ Redis
- ✅ Backend API
- ✅ Control Panel
- ✅ Frontend SQAL
- ✅ Frontend Euralis
- ✅ Frontend Gaveurs
- ✅ Frontend Traçabilité

**Temps de démarrage** : 30-60 secondes

### Étape 2 : Lancer les Simulateurs

```bash
# Lancer TOUS les simulateurs
docker-compose --profile simulators --profile simulators-extra up -d \
  simulator-gavage \
  simulator-gavage-realtime \
  simulator-sqal \
  simulator-sqal-ligne-b
```

**Simulateurs lancés** :
- ✅ Simulateur Gavage (one-shot CSV)
- ✅ Simulateur Gavage Temps Réel (WebSocket continu)
- ✅ Simulateur SQAL Docker (ESP32_DOCKER_01)
- ✅ Simulateur SQAL Ligne B (ESP32_DOCKER_02)

### Étape 3 : Vérifier Tout Fonctionne

```bash
# Voir tous les containers
docker ps

# Vérifier backend health
curl http://localhost:8000/health

# Vérifier frontends
curl http://localhost:5174/  # Control Panel
curl http://localhost:5173/  # SQAL Dashboard
curl http://localhost:3001/  # Euralis
curl http://localhost:3000/  # Gaveurs
curl http://localhost:3002/  # Traçabilité
```

---

## 🎯 Utilisation des Simulateurs

### 1. Simulateur Gavage (One-Shot CSV)

**But** : Générer un fichier CSV de données historiques de gavage.

```bash
# Vérifier status
docker ps -a | grep gaveurs_simulator_gavage

# Voir logs
docker logs gaveurs_simulator_gavage

# Fichier généré
ls -lh simulators/data/simulated_gavage_data.csv
```

**Configuration** (docker-compose.yml:280-285) :
- `--nb-lots 100` : 100 lots
- `--nb-gaveurs 65` : 65 gaveurs
- `--output /data/simulated_gavage_data.csv`
- `--start-date 2024-01-01`

**Usage** :
Le CSV généré peut être importé dans la base via l'API Euralis :
```bash
curl -X POST http://localhost:8000/api/euralis/import-csv \
  -F "file=@simulators/data/simulated_gavage_data.csv"
```

### 2. Simulateur Gavage Temps Réel

**But** : Simuler 3 lots de gavage en temps réel via WebSocket.

```bash
# Vérifier status
docker ps | grep gaveurs_simulator_gavage_realtime

# Voir logs (données envoyées)
docker logs -f gaveurs_simulator_gavage_realtime

# Arrêter
docker stop gaveurs_simulator_gavage_realtime

# Redémarrer
docker start gaveurs_simulator_gavage_realtime
```

**Configuration** (docker-compose.yml:347-362) :
- `--backend-url ws://backend:8000/ws/gavage`
- `--nb-lots 3`
- `--acceleration 1440` (1 jour réel = 60 secondes)

**Visualisation** :
1. Ouvrir http://localhost:3000 (Gaveurs App)
2. Voir les lots en cours de gavage
3. Données mises à jour en temps réel

### 3. Simulateurs SQAL (Capteurs IoT)

**But** : Simuler capteurs VL53L8CH (ToF) + AS7341 (Spectral) sur lignes de production.

```bash
# Vérifier status
docker ps | grep gaveurs_simulator_sqal

# Logs SQAL Docker 01
docker logs -f gaveurs_simulator_sqal

# Logs SQAL Ligne B (Docker 02)
docker logs -f gaveurs_simulator_sqal_ligne_b
```

**Devices** :
- `ESP32_DOCKER_01` : Ligne A (30s interval)
- `ESP32_DOCKER_02` : Ligne B (45s interval)

**Visualisation** :
1. Ouvrir http://localhost:5173 (SQAL Dashboard)
2. Voir matrices ToF 8x8 en temps réel
3. Voir spectral data (10 canaux)
4. Grades qualité (A+, A, B, C, D)

### 4. Simulateurs SQAL Dynamiques (Control Panel)

**But** : Créer et gérer des simulateurs à la volée depuis l'interface web.

**Via Frontend** :
1. Ouvrir http://localhost:5174 (Control Panel)
2. Cliquer sur un scénario :
   - **Multi-Site Demo** : 4 devices (ESP32_LL_01/02, ESP32_LS_01, ESP32_MT_01)
   - **Stress Test** : 10 devices (ESP32_STRESS_01-10)
   - **Production Demo** : 2 devices (ESP32_DEMO_01-02)

**Via API** :
```bash
# Démarrer un device spécifique
curl -X POST http://localhost:8000/api/control-panel/simulators/start \
  -H "Content-Type: application/json" \
  --data "{
    \"device_id\": \"ESP32_CUSTOM_01\",
    \"location\": \"Custom Line\",
    \"interval\": 20,
    \"duration\": 0
  }"

# Lancer scénario Multi-Site
curl -X POST http://localhost:8000/api/control-panel/scenarios/start \
  -H "Content-Type: application/json" \
  --data "{\"scenario_name\": \"multi_site\", \"duration\": 0}"

# Arrêter tous les simulateurs
curl -X POST http://localhost:8000/api/control-panel/simulators/stop-all
```

---

## 🎬 Scénarios de Démo Complète

### Démo 1 : Cycle Complet Gavage → Traçabilité (10 minutes)

**Objectif** : Montrer le cycle complet depuis le gavage jusqu'au feedback consommateur.

```bash
# 1. Vérifier tous les services tournent
docker ps

# 2. Ouvrir Gaveurs App
http://localhost:3000

# 3. Lancer simulateur gavage temps réel
docker start gaveurs_simulator_gavage_realtime

# 4. Montrer les lots en cours de gavage (3 lots)
# → Interface Gaveurs App affiche données temps réel

# 5. Ouvrir Euralis Dashboard
http://localhost:3001/euralis/dashboard

# 6. Montrer supervision multi-sites
# → Graphiques, KPIs, alertes

# 7. Ouvrir SQAL Dashboard
http://localhost:5173

# 8. Montrer contrôle qualité
# → Capteurs ToF, Spectral, Grades

# 9. Ouvrir Traçabilité
http://localhost:3002

# 10. Scanner un QR code simulé
# → Affiche historique complet du produit

# 11. Soumettre feedback consommateur
# → Formulaire satisfaction (note 1-5)

# 12. Vérifier feedback en base
curl http://localhost:8000/api/consumer/feedbacks/recent
```

### Démo 2 : Control Panel Multi-Site (5 minutes)

**Objectif** : Montrer la gestion dynamique des simulateurs.

```bash
# 1. Ouvrir Control Panel
http://localhost:5174

# 2. Cliquer "Multi-Site Demo"
# → Démarre 4 simulateurs automatiquement

# 3. Ouvrir SQAL Dashboard dans nouvel onglet
http://localhost:5173

# 4. Montrer données de 4 sites en temps réel
# → ESP32_LL_01, ESP32_LL_02, ESP32_LS_01, ESP32_MT_01

# 5. Retour Control Panel
# → Montrer uptime qui augmente

# 6. Arrêter ESP32_LL_01 individuellement
# → Bouton Stop

# 7. Vérifier dans SQAL Dashboard
# → Plus de données pour ESP32_LL_01

# 8. Cliquer "Stop All"
# → Tous les simulateurs s'arrêtent
```

### Démo 3 : Stress Test Performance (3 minutes)

**Objectif** : Démontrer la robustesse sous charge.

```bash
# 1. Control Panel → "Stress Test"
http://localhost:5174
# → Démarre 10 simulateurs à 10s interval

# 2. Monitoring backend
docker logs -f gaveurs_backend | grep "saved"

# 3. Monitoring database
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db

SELECT device_id, COUNT(*), MAX(timestamp)
FROM sqal_sensor_samples
GROUP BY device_id
ORDER BY MAX(timestamp) DESC;

# 4. SQAL Dashboard
http://localhost:5173
# → 10 devices actifs

# 5. Stop All
# → Control Panel ou API
```

---

## 📊 Monitoring

### Backend Logs

```bash
# Tous les logs
docker logs -f gaveurs_backend

# Filtrer par module
docker logs gaveurs_backend 2>&1 | grep "euralis"
docker logs gaveurs_backend 2>&1 | grep "sqal"
docker logs gaveurs_backend 2>&1 | grep "control"

# Erreurs uniquement
docker logs gaveurs_backend 2>&1 | grep -i error
```

### Simulateurs Logs

```bash
# Gavage temps réel
docker logs -f gaveurs_simulator_gavage_realtime

# SQAL Docker 01
docker logs -f gaveurs_simulator_sqal

# SQAL Ligne B
docker logs -f gaveurs_simulator_sqal_ligne_b

# Dynamiques (Control Panel)
docker logs -f sqal_simulator_esp32_ll_01
```

### Database Queries

```bash
# Connexion
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db

# Samples SQAL
SELECT device_id, COUNT(*), MAX(timestamp) as last
FROM sqal_sensor_samples
GROUP BY device_id
ORDER BY last DESC;

# Gavage data
SELECT COUNT(*), MAX(timestamp) as last
FROM gavage_data;

# Consumer feedbacks
SELECT COUNT(*), AVG(satisfaction_rating), MAX(timestamp)
FROM consumer_feedbacks;

# Quitter
\q
```

### Prometheus Metrics

```bash
# Backend metrics
curl http://localhost:8000/metrics

# Filtrer simulateurs
curl http://localhost:8000/metrics | grep simulator

# Filtrer gavage
curl http://localhost:8000/metrics | grep gavage
```

---

## 🛑 Arrêt des Services

### Arrêt Complet

```bash
# Arrêter tout (frontends + backend + db + simulateurs)
docker-compose --profile simulators --profile simulators-extra down
```

### Arrêt Sélectif

```bash
# Arrêter uniquement les simulateurs
docker stop gaveurs_simulator_gavage_realtime
docker stop gaveurs_simulator_sqal
docker stop gaveurs_simulator_sqal_ligne_b

# Arrêter simulateurs dynamiques (Control Panel)
curl -X POST http://localhost:8000/api/control-panel/simulators/stop-all

# Arrêter frontends seulement
docker stop gaveurs_frontend_euralis
docker stop gaveurs_frontend_gaveurs
docker stop gaveurs_frontend_sqal
docker stop gaveurs_frontend_traceability
docker stop gaveurs_control_panel

# Garder backend + DB
# (backend reste accessible pour API)
```

### Redémarrage

```bash
# Redémarrer un service spécifique
docker restart gaveurs_backend
docker restart gaveurs_simulator_gavage_realtime

# Redémarrer tout
docker-compose restart
```

---

## 🐞 Troubleshooting

### Problème 1 : Simulateur SQAL redémarre en boucle

**Symptôme** :
```
gaveurs_simulator_sqal_ligne_b   Restarting (1) Less than a second ago
```

**Cause** : Argument `--config-profile` non supporté dans `esp32_simulator.py`

**Solution** :
Éditer `docker-compose.yml:311-338` et supprimer `--config-profile`:
```yaml
command: >
  python main.py
  --device ESP32_DOCKER_02
  --location "Ligne B - Docker"
  --backend-url ws://backend:8000/ws/sensors/
  --interval 45
  # --config-profile foiegras_standard_barquette  # ← Commenter cette ligne
```

Puis redémarrer :
```bash
docker-compose up -d simulator-sqal-ligne-b
```

### Problème 2 : Control Panel affiche "Docker not available"

**Solution** :
```bash
# Vérifier backend a accès au socket Docker
docker exec gaveurs_backend python -c "import docker; print(docker.from_env().ping())"

# Si erreur, vérifier docker-compose.yml contient :
# backend:
#   volumes:
#     - /var/run/docker.sock:/var/run/docker.sock:rw
```

### Problème 3 : Simulateur Gavage One-Shot ne démarre pas

**Solution** :
```bash
# Vérifier image existe
docker images | grep gaveurs_simulator_gavage

# Si manquante, builder
docker build -t gaveurs-simulator-gavage:latest -f simulators/Dockerfile.gavage .

# Lancer manuellement
docker-compose --profile simulators up -d simulator-gavage

# Voir logs pour erreur
docker logs gaveurs_simulator_gavage
```

### Problème 4 : Frontends inaccessibles

**Solution** :
```bash
# Vérifier status
docker ps | grep frontend

# Rebuild si nécessaire
docker-compose build frontend-euralis
docker-compose build frontend-gaveurs
docker-compose build frontend-sqal
docker-compose build frontend-traceability
docker-compose build control-panel

# Redémarrer
docker-compose up -d
```

---

## ✅ Checklist Stack Complète

### Services Core
- [ ] TimescaleDB (port 5432)
- [ ] Redis (port 6379)
- [ ] Backend API (port 8000)

### Frontends
- [ ] Control Panel (port 5174)
- [ ] SQAL Dashboard (port 5173)
- [ ] Euralis Dashboard (port 3001)
- [ ] Gaveurs App (port 3000)
- [ ] Traçabilité (port 3002)

### Simulateurs
- [ ] Gavage One-Shot (CSV généré)
- [ ] Gavage Temps Réel (3 lots)
- [ ] SQAL Docker 01 (ESP32_DOCKER_01)
- [ ] SQAL Ligne B (ESP32_DOCKER_02)

### Health Checks
- [ ] `curl http://localhost:8000/health` → 200
- [ ] `curl http://localhost:5174/` → 200
- [ ] `curl http://localhost:5173/` → 200
- [ ] `curl http://localhost:3001/` → 200
- [ ] `curl http://localhost:3000/` → 200
- [ ] `curl http://localhost:3002/` → 200

---

## 📞 Support

Pour plus d'informations :
- [CONTROL_PANEL_SUCCESS.md](CONTROL_PANEL_SUCCESS.md) - Control Panel détails
- [DEMARRAGE_CONTROL_PANEL.md](DEMARRAGE_CONTROL_PANEL.md) - Control Panel quick start
- [CONTROL_PANEL_GUIDE.md](CONTROL_PANEL_GUIDE.md) - Guide complet Control Panel
- [CLAUDE.md](CLAUDE.md) - Documentation complète du projet

---

**Bonne utilisation de la stack complète !** 🎉

**Date** : 2026-01-07
**Version** : 1.0.0
