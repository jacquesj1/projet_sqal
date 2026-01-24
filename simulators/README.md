# Simulateurs Unifiés - Système Gaveurs V3.0

Ce répertoire contient les **deux simulateurs dockerisés** du système :

1. **Simulateur Gavage** - Génère données métier de gavage (lots, gaveurs, doses journalières)
2. **Simulateur SQAL** - Simule capteurs IoT ESP32 (VL53L8CH ToF + AS7341 Spectral)

---

## 📁 Structure

```
simulators/
├── README.md                    # Ce fichier
├── requirements.txt             # Dépendances Python communes
├── docker-compose.yml           # Orchestration standalone
├── Dockerfile.gavage            # Image Docker simulateur gavage
├── Dockerfile.sqal              # Image Docker simulateur SQAL
├── gavage/                      # Simulateur gavage
│   ├── __init__.py
│   └── main.py                  # Point d'entrée gavage
├── sqal/                        # Simulateur SQAL
│   ├── __init__.py
│   └── main.py                  # Point d'entrée SQAL
└── data/                        # Données générées (créé automatiquement)
```

---

## 🚀 Démarrage Rapide

### Option 1 : Docker Compose (Recommandé)

**Démarrer tous les services + simulateurs :**

```bash
# Depuis la racine du projet
docker-compose up -d

# Simulateur SQAL démarre automatiquement
# Simulateur Gavage nécessite profil "simulators" :
docker-compose --profile simulators up simulator-gavage
```

**Démarrer seulement SQAL Ligne B (extra) :**

```bash
docker-compose --profile simulators-extra up simulator-sqal-ligne-b
```

### Option 2 : Build manuel

```bash
cd simulators

# Build image gavage
docker build -f Dockerfile.gavage -t gaveurs-simulator-gavage:latest .

# Build image SQAL
docker build -f Dockerfile.sqal -t gaveurs-simulator-sqal:latest .

# Run gavage (one-shot)
docker run --rm -v $(pwd)/data:/data gaveurs-simulator-gavage \
  --nb-lots 100 --output /data/output.csv

# Run SQAL (continuous)
docker run --rm --network gaveurs_network gaveurs-simulator-sqal \
  --device ESP32_TEST --backend-url ws://backend:8000/ws/sensors/
```

### Option 3 : Python local (développement)

**Simulateur Gavage :**

```bash
cd simulators/gavage
python main.py --nb-lots 100 --output ../../data/simulated_data.csv
```

**Simulateur SQAL :**

```bash
cd simulators/sqal
python main.py --device ESP32_LOCAL_01 --backend-url ws://localhost:8000/ws/sensors/
```

---

## 📊 Simulateur Gavage

### Description

Génère des **données CSV réalistes** de gavage pour :
- Tests de charge
- Démo clients
- Entraînement modèles IA/ML
- Validation système

### Caractéristiques

- **174 colonnes** compatibles format Euralis
- **65 gaveurs** répartis sur 3 sites (LL, LS, MT)
- **5 niveaux de performance** : Excellent → Faible
- **27 jours de doses journalières** par lot
- **Distributions statistiques** calibrables sur données réelles

### Usage Docker

```bash
docker run --rm \
  -v $(pwd)/data:/data \
  gaveurs-simulator-gavage \
  --nb-lots 500 \
  --nb-gaveurs 80 \
  --output /data/lots_2024.csv \
  --start-date 2024-01-01
```

### Paramètres

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `--nb-lots` | int | 100 | Nombre de lots à générer |
| `--nb-gaveurs` | int | 65 | Nombre de gaveurs |
| `--output` | str | `/data/simulated_gavage_data.csv` | Fichier de sortie |
| `--start-date` | str | `2024-01-01` | Date début (YYYY-MM-DD) |
| `--reference` | str | None | CSV référence pour calibrage |

### Sortie

Fichier CSV avec 174 colonnes :
- **CodeLot**, **Debut_du_lot**, **duree_gavage**
- **ITM**, **Sigma**, **dPctgPerteGav** (mortalité)
- **feedTarget_1** à **feedTarget_27** (doses théoriques)
- **feedCornReal_1** à **feedCornReal_27** (doses réelles)
- Et 100+ autres colonnes métier Euralis

**Exemple de données générées :**

```csv
CodeLot;Gaveur;ITM;Sigma;dPctgPerteGav;feedTarget_1;feedCornReal_1;...
LL0000001;Jean Martin;17.2;1.9;2.1;205;208;...
LS0000002;Sophie Dubois;12.8;2.6;5.8;195;192;...
```

---

## 🔬 Simulateur SQAL - Capteurs IoT

### Description

Simule des **capteurs ESP32** avec bus I2C pour contrôle qualité foie gras en temps réel :

- **VL53L8CH** : Capteur ToF (Time-of-Flight) - Matrices 8x8 distances
- **AS7341** : Capteur spectral - 10 canaux (415nm → NIR)
- **WebSocket** : Envoi temps réel au backend FastAPI

### Caractéristiques

- **Émulation ESP32** complète (boot, WiFi, I2C, buffer local)
- **Reconnexion automatique** si backend offline
- **Buffer local** (100 mesures) pour ne rien perdre
- **Métriques métier foie gras** : poids estimé, grade qualité, anomalies
- **Multi-instances** : Plusieurs lignes de production simultanées

### Usage Docker

```bash
docker run --rm \
  --network gaveurs_network \
  gaveurs-simulator-sqal \
  --device ESP32_PROD_01 \
  --location "Ligne A - Site LL" \
  --backend-url ws://backend:8000/ws/sensors/ \
  --interval 30 \
  --config-profile foiegras_standard_barquette
```

### Paramètres

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `--device` | str | `ESP32_LL_01` | ID unique du device |
| `--location` | str | `Ligne A` | Localisation physique |
| `--backend-url` | str | `ws://backend:8000/ws/sensors/` | URL WebSocket backend |
| `--interval` | float | 30.0 | Intervalle mesures (secondes) |
| `--config-profile` | str | `foiegras_standard_barquette` | Profil de configuration |

### Données envoyées (JSON)

```json
{
  "device_id": "ESP32_DOCKER_01",
  "timestamp": "2024-12-22T15:30:45.123456Z",
  "location": "Ligne A - Docker",
  "sensor_data": {
    "vl53l8ch": {
      "matrix_8x8": [[245, 248, ...], ...],  // 8x8 distances (mm)
      "ambient_light": 1250.5,
      "temperature": 22.3
    },
    "as7341": {
      "spectral_channels": {
        "415nm": 12500,
        "445nm": 15200,
        "480nm": 18900,
        ...
        "NIR": 8500
      },
      "lux": 520.3
    }
  },
  "foie_gras_metrics": {
    "estimated_weight_g": 580.5,
    "quality_grade": "A",
    "confidence": 0.92,
    "anomaly_detected": false
  }
}
```

### Profils de configuration

Fichier `simulator-sqal/config_foiegras.yaml` définit les profils :

- **foiegras_standard_barquette** : Barquettes standards (500-600g)
- **foiegras_premium_entier** : Foies entiers premium (650-750g)
- **foiegras_export_calibre_A** : Export calibre A+ (700-800g)

---

## 🐳 Intégration Docker Compose

Les simulateurs sont intégrés dans le `docker-compose.yml` principal :

```yaml
services:
  # Simulateur Gavage (one-shot, profil "simulators")
  simulator-gavage:
    profiles:
      - simulators

  # Simulateur SQAL Ligne A (always running)
  simulator-sqal:
    restart: unless-stopped

  # Simulateur SQAL Ligne B (extra, profil "simulators-extra")
  simulator-sqal-ligne-b:
    profiles:
      - simulators-extra
```

**Commandes utiles :**

```bash
# Démarrer avec SQAL Ligne A seulement
docker-compose up -d

# Démarrer avec gavage en plus
docker-compose --profile simulators up -d

# Démarrer avec les 2 SQAL + gavage
docker-compose --profile simulators --profile simulators-extra up -d

# Logs simulateur SQAL
docker-compose logs -f simulator-sqal

# Arrêter tout
docker-compose down
```

---

## 📈 Cas d'Usage

### 1. Tests de Charge

```bash
# Générer 10 000 lots pour tester scalabilité backend
docker run --rm -v $(pwd)/data:/data gaveurs-simulator-gavage \
  --nb-lots 10000 --nb-gaveurs 100
```

### 2. Démo Multi-Lignes SQAL

```bash
# 3 simulateurs SQAL simultanés (Lignes A, B, C)
docker-compose up -d simulator-sqal
docker-compose --profile simulators-extra up -d simulator-sqal-ligne-b

docker run -d --network gaveurs_network gaveurs-simulator-sqal \
  --device ESP32_LIGNE_C --location "Ligne C" --interval 60
```

### 3. Entraînement Modèles ML

```bash
# Générer 5000 lots calibrés sur données réelles
docker run --rm -v $(pwd)/data:/data \
  -v /path/to/Pretraite_End_2024_claude.csv:/ref.csv:ro \
  gaveurs-simulator-gavage \
  --nb-lots 5000 --reference /ref.csv
```

### 4. Tests WebSocket

```bash
# Simulateur SQAL avec intervalle 5s pour tests rapides
docker run --rm --network gaveurs_network gaveurs-simulator-sqal \
  --device ESP32_TEST --interval 5 --backend-url ws://backend:8000/ws/sensors/
```

---

## 🔧 Développement

### Modifier le simulateur gavage

```bash
# Éditer Simulator/gavage_data_simulator.py
vim ../Simulator/gavage_data_simulator.py

# Rebuild image
docker build -f Dockerfile.gavage -t gaveurs-simulator-gavage:dev .

# Tester
docker run --rm -v $(pwd)/data:/data gaveurs-simulator-gavage:dev
```

### Modifier le simulateur SQAL

```bash
# Éditer simulator-sqal/esp32_simulator.py
vim ../simulator-sqal/esp32_simulator.py

# Rebuild image
docker build -f Dockerfile.sqal -t gaveurs-simulator-sqal:dev .

# Tester
docker run --rm --network gaveurs_network gaveurs-simulator-sqal:dev
```

### Dépendances

```bash
# Ajouter dépendance dans requirements.txt
echo "scikit-learn>=1.3.0" >> requirements.txt

# Rebuild images
docker-compose build simulator-gavage simulator-sqal
```

---

## 🐛 Dépannage

### Simulateur Gavage ne génère pas de fichier

**Problème** : Volume `/data` non monté

```bash
# Créer répertoire data
mkdir -p simulators/data

# Vérifier montage
docker run --rm -v $(pwd)/data:/data gaveurs-simulator-gavage ls -la /data
```

### Simulateur SQAL ne se connecte pas au backend

**Problème** : Backend pas accessible depuis container

```bash
# Vérifier réseau
docker network inspect gaveurs_network

# Tester connectivité
docker run --rm --network gaveurs_network curlimages/curl:latest \
  curl http://backend:8000/health

# Vérifier backend running
docker-compose ps backend
```

### Erreur "Module not found"

**Problème** : Dépendances manquantes

```bash
# Rebuild sans cache
docker-compose build --no-cache simulator-sqal

# Vérifier requirements.txt installé
docker run --rm gaveurs-simulator-sqal pip list
```

---

## 📊 Monitoring

### Logs en temps réel

```bash
# Tous les simulateurs
docker-compose logs -f simulator-gavage simulator-sqal

# Seulement SQAL
docker-compose logs -f simulator-sqal --tail=100
```

### Métriques

```bash
# Stats container
docker stats gaveurs_simulator_sqal

# Inspect
docker inspect gaveurs_simulator_sqal
```

---

## 🔗 Références

- **Simulateur original gavage** : [../Simulator/README.md](../Simulator/README.md)
- **Simulateur original SQAL** : `../simulator-sqal/`
- **Backend WebSocket** : [../backend-api/app/websocket/](../backend-api/app/websocket/)
- **SQAL Frontend** : [../sqal/](../sqal/)

---

## 📝 Notes

- **Simulateur Gavage** : One-shot (génère CSV puis exit)
- **Simulateur SQAL** : Continuous (envoie mesures en boucle)
- **Données générées** : `simulators/data/` (gitignored)
- **Profils Docker Compose** : `simulators`, `simulators-extra`

---

**Version** : 3.0.0
**Date** : 22 Décembre 2024
**Auteur** : Système Euralis Multi-Sites
