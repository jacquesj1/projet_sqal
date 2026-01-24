# Guide Démarrage Rapide - Simulateurs

Guide express pour démarrer les simulateurs Gavage + SQAL en **5 minutes**.

---

## ⚡ Démarrage Ultra-Rapide (Docker)

```bash
# 1. Build les images (première fois uniquement)
docker-compose build simulator-sqal

# 2. Démarrer backend + database (si pas déjà running)
docker-compose up -d timescaledb backend

# 3. Démarrer simulateur SQAL
docker-compose up -d simulator-sqal

# 4. Générer données gavage (one-shot)
docker-compose --profile simulators up simulator-gavage

# ✅ C'est fait !
```

**Vérification** :

```bash
# Logs SQAL
docker-compose logs -f simulator-sqal

# Vérifier données gavage générées
ls -lh simulators/data/simulated_gavage_data.csv
```

---

## 📊 Simulateur Gavage - Génération CSV

### Usage Basique

```bash
cd simulators/gavage
python main.py --nb-lots 100 --output ../../data/lots.csv
```

### Usage Docker

```bash
docker run --rm \
  -v $(pwd)/simulators/data:/data \
  gaveurs-simulator-gavage \
  --nb-lots 500 \
  --output /data/lots_2024.csv
```

### Paramètres Courants

```bash
# 100 lots, 65 gaveurs, date 2024-01-01
--nb-lots 100 --nb-gaveurs 65 --start-date 2024-01-01

# 1000 lots pour tests de charge
--nb-lots 1000

# Calibrage sur données réelles
--reference /path/to/Pretraite_End_2024_claude.csv
```

**Sortie** : Fichier CSV 174 colonnes compatible Euralis

---

## 🔬 Simulateur SQAL - Capteurs IoT

### Usage Basique

```bash
cd simulators/sqal
python main.py --device ESP32_LOCAL_01 --interval 30
```

### Usage Docker

```bash
docker run --rm \
  --network gaveurs_network \
  gaveurs-simulator-sqal \
  --device ESP32_PROD_01 \
  --location "Ligne A" \
  --backend-url ws://backend:8000/ws/sensors/ \
  --interval 30
```

### Paramètres Courants

```bash
# Device ESP32_LL_01, intervalle 30s
--device ESP32_LL_01 --interval 30

# Location personnalisée
--location "Ligne A - Site Bretagne"

# Backend local (développement)
--backend-url ws://localhost:8000/ws/sensors/

# Backend Docker
--backend-url ws://backend:8000/ws/sensors/

# Profil premium (foies entiers 650-750g)
--config-profile foiegras_premium_entier
```

**Sortie** : Flux WebSocket continu vers backend

---

## 🐳 Docker Compose - Scénarios

### Scénario 1 : Dev local simple (SQAL seulement)

```bash
docker-compose up -d timescaledb backend simulator-sqal
```

### Scénario 2 : Génération données + SQAL

```bash
# Démarrer infra
docker-compose up -d

# Générer données gavage
docker-compose --profile simulators up simulator-gavage

# Vérifier
ls -lh simulators/data/
```

### Scénario 3 : Multi-lignes SQAL (A + B)

```bash
# Ligne A (toujours actif)
docker-compose up -d simulator-sqal

# Ligne B (profil extra)
docker-compose --profile simulators-extra up -d simulator-sqal-ligne-b

# Vérifier
docker-compose ps | grep simulator
```

### Scénario 4 : Production complète

```bash
# Tout démarrer (3 frontends + backend + db + SQAL)
docker-compose up -d

# Ajouter Ligne B
docker-compose --profile simulators-extra up -d simulator-sqal-ligne-b

# Monitoring
docker-compose logs -f simulator-sqal simulator-sqal-ligne-b
```

---

## 🛠️ Commandes Utiles

### Logs

```bash
# Logs temps réel SQAL
docker-compose logs -f simulator-sqal

# Logs gavage (si running)
docker-compose logs simulator-gavage

# Logs tous simulateurs
docker-compose logs -f simulator-gavage simulator-sqal
```

### Status

```bash
# Vérifier containers running
docker-compose ps | grep simulator

# Stats ressources
docker stats gaveurs_simulator_sqal

# Inspect
docker inspect gaveurs_simulator_sqal
```

### Rebuild

```bash
# Rebuild après modification code
docker-compose build --no-cache simulator-sqal
docker-compose up -d simulator-sqal

# Rebuild gavage
docker-compose build --no-cache simulator-gavage
```

### Cleanup

```bash
# Arrêter simulateurs
docker-compose stop simulator-sqal simulator-gavage

# Supprimer containers
docker-compose rm -f simulator-sqal simulator-gavage

# Supprimer données générées
rm -rf simulators/data/*
```

---

## 📈 Vérification Fonctionnement

### Simulateur Gavage

```bash
# 1. Générer données
docker-compose --profile simulators up simulator-gavage

# 2. Vérifier fichier créé
ls -lh simulators/data/simulated_gavage_data.csv

# 3. Voir contenu
head -n 3 simulators/data/simulated_gavage_data.csv | cut -d';' -f1-10
```

**Attendu** : Fichier CSV avec colonnes `CodeLot;Gaveur;ITM;Sigma;...`

### Simulateur SQAL

```bash
# 1. Démarrer SQAL
docker-compose up -d simulator-sqal

# 2. Vérifier logs WebSocket
docker-compose logs -f simulator-sqal | grep "Sending sensor data"

# 3. Vérifier backend reçoit données
docker-compose logs -f backend | grep "WebSocket message received"

# 4. Vérifier dans SQAL frontend
open http://localhost:5173
```

**Attendu** : Messages WebSocket envoyés toutes les 30s

---

## 🐛 Dépannage Rapide

### Problème : Simulateur gavage ne génère pas de fichier

```bash
# Créer répertoire data
mkdir -p simulators/data

# Re-run
docker-compose --profile simulators up simulator-gavage
```

### Problème : SQAL ne se connecte pas au backend

```bash
# Vérifier backend running
docker-compose ps backend

# Vérifier réseau
docker network inspect gaveurs_network

# Tester connectivité
docker run --rm --network gaveurs_network curlimages/curl \
  curl http://backend:8000/health
```

### Problème : "Module not found"

```bash
# Rebuild sans cache
docker-compose build --no-cache simulator-sqal

# Vérifier dépendances
docker run --rm gaveurs-simulator-sqal pip list | grep websockets
```

---

## 🎯 Cas d'Usage Rapides

### Générer 10 000 lots pour tests

```bash
docker run --rm -v $(pwd)/simulators/data:/data \
  gaveurs-simulator-gavage \
  --nb-lots 10000 --nb-gaveurs 100
```

### 3 simulateurs SQAL simultanés

```bash
docker-compose up -d simulator-sqal simulator-sqal-ligne-b

docker run -d --network gaveurs_network \
  --name sim-sqal-ligne-c \
  gaveurs-simulator-sqal \
  --device ESP32_LIGNE_C --location "Ligne C" --interval 60
```

### Tests rapides WebSocket (intervalle 5s)

```bash
docker run --rm --network gaveurs_network \
  gaveurs-simulator-sqal \
  --device ESP32_TEST --interval 5
```

---

## 📚 Prochaines Étapes

1. **Lire documentation complète** : [simulators/README.md](simulators/README.md)
2. **Vérifier algorithmes ML** : [ML_ALGORITHMS_STATUS.md](ML_ALGORITHMS_STATUS.md)
3. **Consulter architecture** : [CLAUDE.md](CLAUDE.md)
4. **Tests E2E** : `./scripts/run_tests.sh e2e`

---

**Temps total** : ~5 minutes ⚡
