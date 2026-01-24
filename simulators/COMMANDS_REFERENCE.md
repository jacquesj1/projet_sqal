# Référence Rapide des Commandes - Simulateurs

Guide de référence rapide pour toutes les commandes Docker des simulateurs.

---

## 🏗️ Build

### Build toutes les images

```bash
# Depuis la racine du projet
docker-compose build simulator-gavage simulator-sqal
```

### Build sans cache (après modification code)

```bash
docker-compose build --no-cache simulator-gavage
docker-compose build --no-cache simulator-sqal
```

### Build image spécifique manuellement

```bash
cd simulators

# Gavage
docker build -f Dockerfile.gavage -t gaveurs-simulator-gavage:latest ..

# SQAL
docker build -f Dockerfile.sqal -t gaveurs-simulator-sqal:latest ..
```

---

## 🚀 Démarrage

### Démarrage Standard

```bash
# Infrastructure + SQAL Ligne A
docker-compose up -d

# Ajouter simulateur gavage
docker-compose --profile simulators up simulator-gavage

# Ajouter SQAL Ligne B
docker-compose --profile simulators-extra up -d simulator-sqal-ligne-b
```

### Démarrage Complet (tout)

```bash
# Tous profils activés
docker-compose --profile simulators --profile simulators-extra up -d
```

### Démarrage Sélectif

```bash
# Seulement DB + Backend
docker-compose up -d timescaledb backend

# + SQAL Ligne A
docker-compose up -d simulator-sqal

# + Gavage (one-shot)
docker-compose --profile simulators up simulator-gavage
```

---

## 🔍 Monitoring

### Logs

```bash
# Logs temps réel SQAL
docker-compose logs -f simulator-sqal

# Logs gavage (si running)
docker-compose logs simulator-gavage

# Logs tous simulateurs
docker-compose logs -f simulator-gavage simulator-sqal simulator-sqal-ligne-b

# Dernières 100 lignes
docker-compose logs --tail=100 simulator-sqal
```

### Status

```bash
# Tous les services
docker-compose ps

# Seulement simulateurs
docker-compose ps | grep simulator

# Stats ressources
docker stats gaveurs_simulator_sqal

# Détails container
docker inspect gaveurs_simulator_sqal
```

### Vérifications

```bash
# Vérifier fichier CSV généré
ls -lh simulators/data/

# Vérifier contenu CSV (10 premières colonnes)
head -n 3 simulators/data/simulated_gavage_data.csv | cut -d';' -f1-10

# Vérifier backend reçoit WebSocket
docker-compose logs backend | grep "WebSocket message"

# Test connectivité réseau
docker run --rm --network gaveurs_network curlimages/curl \
  curl http://backend:8000/health
```

---

## ⏹️ Arrêt

### Arrêt Normal

```bash
# Arrêter simulateurs
docker-compose stop simulator-sqal simulator-gavage

# Arrêter tout
docker-compose stop
```

### Arrêt + Suppression

```bash
# Supprimer containers simulateurs
docker-compose rm -f simulator-sqal simulator-gavage

# Supprimer tout
docker-compose down
```

### Cleanup Complet

```bash
# Supprimer containers + volumes
docker-compose down -v

# Supprimer aussi images
docker-compose down --rmi all

# Supprimer données générées
rm -rf simulators/data/*.csv simulators/data/*.json
```

---

## 🔧 Run Manuel (hors docker-compose)

### Simulateur Gavage

```bash
# Run avec paramètres par défaut
docker run --rm \
  -v $(pwd)/simulators/data:/data \
  gaveurs-simulator-gavage

# Run avec paramètres personnalisés
docker run --rm \
  -v $(pwd)/simulators/data:/data \
  gaveurs-simulator-gavage \
  --nb-lots 500 \
  --nb-gaveurs 80 \
  --output /data/lots_2024.csv \
  --start-date 2024-01-01

# Run avec référence CSV
docker run --rm \
  -v $(pwd)/simulators/data:/data \
  -v /path/to/Pretraite_End_2024_claude.csv:/ref.csv:ro \
  gaveurs-simulator-gavage \
  --nb-lots 1000 \
  --reference /ref.csv
```

### Simulateur SQAL

```bash
# Run avec paramètres par défaut
docker run --rm \
  --network gaveurs_network \
  gaveurs-simulator-sqal

# Run avec paramètres personnalisés
docker run --rm \
  --network gaveurs_network \
  gaveurs-simulator-sqal \
  --device ESP32_CUSTOM_01 \
  --location "Ligne C - Site MT" \
  --backend-url ws://backend:8000/ws/sensors/ \
  --interval 45 \
  --config-profile foiegras_premium_entier

# Run en background (daemon)
docker run -d \
  --name sim-sqal-custom \
  --network gaveurs_network \
  gaveurs-simulator-sqal \
  --device ESP32_BG_01 --interval 60
```

---

## 🔄 Redémarrage

### Redémarrage Simple

```bash
# Redémarrer SQAL
docker-compose restart simulator-sqal

# Redémarrer tout
docker-compose restart
```

### Redémarrage avec Rebuild

```bash
# Rebuild + restart SQAL
docker-compose build simulator-sqal
docker-compose up -d simulator-sqal

# Rebuild + restart gavage
docker-compose build simulator-gavage
docker-compose --profile simulators up simulator-gavage
```

---

## 🐛 Dépannage

### Problème : SQAL ne se connecte pas

```bash
# 1. Vérifier backend running
docker-compose ps backend

# 2. Vérifier réseau existe
docker network ls | grep gaveurs

# 3. Tester connectivité
docker run --rm --network gaveurs_network curlimages/curl \
  curl -v http://backend:8000/health

# 4. Vérifier logs backend WebSocket
docker-compose logs backend | grep -i websocket

# 5. Redémarrer SQAL
docker-compose restart simulator-sqal
docker-compose logs -f simulator-sqal
```

### Problème : Gavage ne génère pas de fichier

```bash
# 1. Vérifier répertoire data existe
mkdir -p simulators/data
ls -la simulators/data/

# 2. Vérifier permissions
chmod 777 simulators/data/

# 3. Vérifier montage volume
docker run --rm -v $(pwd)/simulators/data:/data \
  gaveurs-simulator-gavage ls -la /data

# 4. Re-run
docker-compose --profile simulators up simulator-gavage

# 5. Vérifier logs
docker-compose logs simulator-gavage
```

### Problème : "Module not found"

```bash
# 1. Rebuild sans cache
docker-compose build --no-cache simulator-sqal

# 2. Vérifier requirements.txt installé
docker run --rm gaveurs-simulator-sqal pip list

# 3. Vérifier dépendances
docker run --rm gaveurs-simulator-sqal pip list | grep -E "websockets|pandas|numpy"

# 4. Tester import manuel
docker run --rm gaveurs-simulator-sqal python -c "import websockets; print('OK')"
```

### Problème : Port déjà utilisé

```bash
# 1. Identifier processus
lsof -i :8000  # Backend
lsof -i :5173  # SQAL frontend

# 2. Arrêter processus conflictuel
kill -9 <PID>

# 3. Redémarrer
docker-compose up -d
```

---

## 🧪 Tests

### Test Build

```bash
# Build images
docker-compose build simulator-gavage simulator-sqal

# Vérifier images créées
docker images | grep gaveurs-simulator
```

### Test Exécution Gavage

```bash
# Run one-shot
docker-compose --profile simulators up simulator-gavage

# Vérifier sortie
ls -lh simulators/data/
head -n 5 simulators/data/simulated_gavage_data.csv
```

### Test Exécution SQAL

```bash
# Démarrer SQAL
docker-compose up -d simulator-sqal

# Vérifier logs (doit envoyer données)
docker-compose logs -f simulator-sqal | grep "Sending sensor data"

# Arrêter après test
docker-compose stop simulator-sqal
```

### Test WebSocket SQAL → Backend

```bash
# 1. Démarrer backend + SQAL
docker-compose up -d backend simulator-sqal

# 2. Attendre 30s (intervalle SQAL)
sleep 30

# 3. Vérifier backend logs
docker-compose logs backend | grep "WebSocket message received"

# Attendu : Messages WebSocket reçus
```

### Test Multi-Instances SQAL

```bash
# Démarrer 3 instances
docker-compose up -d simulator-sqal simulator-sqal-ligne-b

docker run -d \
  --name sim-sqal-ligne-c \
  --network gaveurs_network \
  gaveurs-simulator-sqal \
  --device ESP32_LIGNE_C --location "Ligne C"

# Vérifier 3 containers running
docker ps | grep simulator-sqal

# Vérifier logs des 3
docker logs gaveurs_simulator_sqal --tail=10
docker logs gaveurs_simulator_sqal_ligne_b --tail=10
docker logs sim-sqal-ligne-c --tail=10
```

---

## 📊 Scénarios d'Usage

### Scénario 1 : Développement Backend Seul

```bash
# Seulement DB + Backend
docker-compose up -d timescaledb backend

# Vérifier
curl http://localhost:8000/health
```

### Scénario 2 : Dev Backend + Simulateur SQAL

```bash
# DB + Backend + SQAL
docker-compose up -d timescaledb backend simulator-sqal

# Logs temps réel
docker-compose logs -f backend simulator-sqal
```

### Scénario 3 : Génération Données Test

```bash
# Infrastructure
docker-compose up -d timescaledb backend

# Générer 1000 lots
docker run --rm -v $(pwd)/simulators/data:/data \
  gaveurs-simulator-gavage \
  --nb-lots 1000 --nb-gaveurs 100

# Importer dans DB
cd backend-api
python scripts/import_euralis_data.py ../simulators/data/simulated_gavage_data.csv
```

### Scénario 4 : Démo Multi-Frontends

```bash
# Tout démarrer
docker-compose up -d

# Ajouter SQAL Ligne B
docker-compose --profile simulators-extra up -d simulator-sqal-ligne-b

# Accès
open http://localhost:3000  # Euralis
open http://localhost:3001  # Gaveurs
open http://localhost:5173  # SQAL
```

### Scénario 5 : Tests Charge

```bash
# Backend + DB
docker-compose up -d timescaledb backend

# Générer 10 000 lots
docker run --rm -v $(pwd)/simulators/data:/data \
  gaveurs-simulator-gavage \
  --nb-lots 10000 --nb-gaveurs 150

# 5 simulateurs SQAL simultanés
for i in {1..5}; do
  docker run -d \
    --name sim-sqal-$i \
    --network gaveurs_network \
    gaveurs-simulator-sqal \
    --device ESP32_LOAD_$i --interval $((i*10))
done

# Monitoring
docker stats $(docker ps -q --filter name=sim-sqal)
```

---

## 🔗 Commandes Utiles Complémentaires

### Accès Shell Container

```bash
# Shell SQAL
docker exec -it gaveurs_simulator_sqal /bin/bash

# Shell Gavage (si running)
docker exec -it gaveurs_simulator_gavage /bin/bash
```

### Copie Fichiers

```bash
# Copier CSV du container vers host
docker cp gaveurs_simulator_gavage:/data/output.csv ./local_copy.csv

# Copier config vers container
docker cp my_config.yaml gaveurs_simulator_sqal:/app/config.yaml
```

### Inspect Détaillé

```bash
# Voir configuration complète
docker inspect gaveurs_simulator_sqal | jq

# Voir variables d'environnement
docker inspect gaveurs_simulator_sqal | jq '.[0].Config.Env'

# Voir volumes montés
docker inspect gaveurs_simulator_sqal | jq '.[0].Mounts'
```

---

## 📝 Alias Pratiques (Optional)

Ajoutez à votre `~/.bashrc` ou `~/.zshrc` :

```bash
# Simulateurs - Alias
alias sim-build="docker-compose build simulator-gavage simulator-sqal"
alias sim-up="docker-compose up -d && docker-compose --profile simulators up"
alias sim-logs="docker-compose logs -f simulator-sqal"
alias sim-status="docker-compose ps | grep simulator"
alias sim-stop="docker-compose stop simulator-sqal simulator-gavage"
alias sim-clean="docker-compose down && rm -rf simulators/data/*.csv"

# Usage
# sim-build  # Build images
# sim-up     # Démarrer tout
# sim-logs   # Voir logs SQAL
```

---

**Version** : 3.0.0
**Dernière mise à jour** : 22 Décembre 2024
