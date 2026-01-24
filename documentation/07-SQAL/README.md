# 🔬 SQAL - Contrôle Qualité IoT

Documentation du système SQAL (Système de Qualité par Apprentissage en Ligne) avec capteurs ToF et spectraux.

---

## 📚 Documents disponibles

### [INTEGRATION_SQAL_COMPLETE.md](../../INTEGRATION_SQAL_COMPLETE.md)
**Documentation complète de l'intégration SQAL**

- Architecture capteurs IoT
- ESP32 + VL53L8CH (ToF 8x8) + AS7341 (Spectral 10 canaux)
- WebSocket temps réel
- Frontend React+Vite
- Grading automatique (A+, A, B, C, D)
- TimescaleDB hypertables

**Pages**: 800+
**Niveau**: Complet

---

### [SQAL_WEBSOCKET_DATA_FLOW.md](../../SQAL_WEBSOCKET_DATA_FLOW.md)
**Flux de données WebSocket SQAL**

- Messages WebSocket formats
- Protocole communication
- Gestion erreurs
- Reconnexion automatique
- Performance optimisations

**Pages**: 400+
**Niveau**: Développeur

---

### [simulators/sqal/README.md](../../simulators/sqal/README.md)
**Simulateur ESP32 Digital Twin**

- Usage simulateur SQAL
- Profils qualité
- Configuration capteurs
- Exemples données
- Troubleshooting

**Pages**: 300+
**Niveau**: Développeur IoT

---

## 🎯 Vue d'Ensemble

### Architecture SQAL

```
┌─────────────────┐
│   ESP32 Device  │
│  (VL53L8CH +    │
│   AS7341)       │
└────────┬────────┘
         │ WebSocket /ws/sensors/
         ↓
┌─────────────────┐
│   BACKEND       │
│   (FastAPI)     │
│   - Validation  │
│   - Calcul      │
│   - Grading     │
└────────┬────────┘
         │
         ├─→ TimescaleDB (sqal_sensor_samples)
         │
         └─→ WebSocket /ws/realtime/ → Frontend SQAL
```

---

## 🔌 Capteurs IoT

### 1. VL53L8CH - Time of Flight (ToF)

**Description**: Capteur laser 8x8 pour profil de relief 3D

**Spécifications**:
- Résolution: 8x8 = 64 zones
- Portée: 0-400 cm
- Précision: ±1 cm
- Fréquence: jusqu'à 60 Hz

**Mesures**:
```python
# Matrice 8x8 de distances (mm)
tof_matrix = [
  [120, 125, 130, 128, 126, 124, 122, 120],  # Ligne 1
  [118, 122, 127, 129, 128, 125, 121, 118],  # Ligne 2
  [115, 119, 125, 131, 132, 128, 120, 115],  # Ligne 3
  ...
]
```

**Applications SQAL**:
- Profil 3D du foie gras
- Détection irrégularités surface
- Mesure épaisseur
- Détection défauts (trous, bosses)

---

### 2. AS7341 - Spectral Sensor

**Description**: Capteur spectral 10 canaux (visible + NIR)

**Canaux**:
| Canal | Longueur d'onde | Couleur |
|-------|----------------|---------|
| F1 | 415 nm | Violet |
| F2 | 445 nm | Bleu |
| F3 | 480 nm | Cyan |
| F4 | 515 nm | Vert |
| F5 | 555 nm | Vert clair |
| F6 | 590 nm | Jaune |
| F7 | 630 nm | Orange |
| F8 | 680 nm | Rouge |
| NIR | 910 nm | Infrarouge proche |
| Clear | - | Luminosité totale |

**Mesures**:
```python
spectral_data = {
  "F1_415nm": 1250,
  "F2_445nm": 1820,
  "F3_480nm": 2340,
  "F4_515nm": 3100,
  "F5_555nm": 3580,
  "F6_590nm": 3210,
  "F7_630nm": 2890,
  "F8_680nm": 2450,
  "NIR_910nm": 1680,
  "Clear": 24500
}
```

**Applications SQAL**:
- Détection coloration (jaune uniforme = qualité A+)
- Mesure oxydation (ratio rouge/jaune)
- Détection défauts (taches sombres)
- Estimation fraîcheur

---

## 🏆 Grading Automatique

### Algorithme de Notation

**Critères** (4 dimensions):
1. **Relief ToF** (40%)
   - Uniformité surface (écart-type distances)
   - Absence irrégularités majeures

2. **Coloration Spectrale** (30%)
   - Ratio jaune/orange optimal
   - Absence taches

3. **Profil Spectral** (20%)
   - Distribution canaux normale
   - Pic dans le jaune-orange

4. **Fraîcheur NIR** (10%)
   - Ratio NIR/Clear dans fourchette

**Grades**:
| Grade | Score | Critères |
|-------|-------|----------|
| A+ | 95-100 | Excellente qualité, uniforme, couleur optimale |
| A  | 85-94  | Très bonne qualité, légères variations |
| B  | 75-84  | Bonne qualité, quelques défauts mineurs |
| C  | 60-74  | Qualité acceptable, défauts visibles |
| D  | 0-59   | Qualité insuffisante, défauts majeurs |

**Implémentation**:
```python
def calculate_grade(tof_matrix, spectral_data):
    # 1. Score relief
    relief_score = 100 - (np.std(tof_matrix) / 10)  # Uniformité

    # 2. Score coloration
    yellow_ratio = spectral_data["F6_590nm"] / spectral_data["Clear"]
    color_score = 100 if 0.12 < yellow_ratio < 0.15 else 70

    # 3. Score profil spectral
    peak_channel = max(spectral_data, key=spectral_data.get)
    spectral_score = 100 if peak_channel in ["F5_555nm", "F6_590nm"] else 60

    # 4. Score fraîcheur
    nir_ratio = spectral_data["NIR_910nm"] / spectral_data["Clear"]
    freshness_score = 100 if 0.05 < nir_ratio < 0.08 else 50

    # Score pondéré
    total_score = (
        relief_score * 0.4 +
        color_score * 0.3 +
        spectral_score * 0.2 +
        freshness_score * 0.1
    )

    # Grade
    if total_score >= 95: return "A+"
    elif total_score >= 85: return "A"
    elif total_score >= 75: return "B"
    elif total_score >= 60: return "C"
    else: return "D"
```

---

## 📊 Database Schema

### Table Principale

```sql
CREATE TABLE sqal_sensor_samples (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  lot_code VARCHAR(100),
  sample_number INTEGER,

  -- VL53L8CH ToF Matrix (8x8 = 64 valeurs)
  tof_zone_0_0 INTEGER,
  tof_zone_0_1 INTEGER,
  ...
  tof_zone_7_7 INTEGER,

  -- AS7341 Spectral (10 canaux)
  spectral_415nm INTEGER,
  spectral_445nm INTEGER,
  spectral_480nm INTEGER,
  spectral_515nm INTEGER,
  spectral_555nm INTEGER,
  spectral_590nm INTEGER,
  spectral_630nm INTEGER,
  spectral_680nm INTEGER,
  spectral_910nm_nir INTEGER,
  spectral_clear INTEGER,

  -- Métadonnées
  temperature DOUBLE PRECISION,
  humidity DOUBLE PRECISION,

  -- Grading
  quality_score DOUBLE PRECISION,
  quality_grade VARCHAR(5),

  timestamp TIMESTAMPTZ NOT NULL
);

-- Hypertable pour time-series
SELECT create_hypertable('sqal_sensor_samples', 'timestamp');

-- Index
CREATE INDEX idx_sqal_device_time ON sqal_sensor_samples (device_id, timestamp DESC);
CREATE INDEX idx_sqal_lot ON sqal_sensor_samples (lot_code);
CREATE INDEX idx_sqal_grade ON sqal_sensor_samples (quality_grade);
```

### Continuous Aggregates

```sql
-- Agrégation horaire
CREATE MATERIALIZED VIEW sqal_hourly_stats
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', timestamp) AS hour,
  device_id,
  COUNT(*) AS samples_count,
  AVG(quality_score) AS avg_score,
  MODE() WITHIN GROUP (ORDER BY quality_grade) AS most_common_grade
FROM sqal_sensor_samples
GROUP BY hour, device_id;

-- Refresh automatique
SELECT add_continuous_aggregate_policy('sqal_hourly_stats',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```

---

## 🔄 WebSocket Protocol

### Inbound - Simulateur → Backend

**Endpoint**: `ws://localhost:8000/ws/sensors/`

**Message Format**:
```json
{
  "type": "sensor_data",
  "device_id": "ESP32_LL_01",
  "lot_code": "LL-2024-042",
  "sample_number": 3,
  "tof_matrix": [
    [120, 125, 130, 128, 126, 124, 122, 120],
    [118, 122, 127, 129, 128, 125, 121, 118],
    ...
  ],
  "spectral": {
    "F1_415nm": 1250,
    "F2_445nm": 1820,
    ...
  },
  "temperature": 18.5,
  "humidity": 62.3,
  "timestamp": "2024-12-23T14:32:15Z"
}
```

### Outbound - Backend → Frontend

**Endpoint**: `ws://localhost:8000/ws/realtime/`

**Message Format**:
```json
{
  "type": "sqal_sample",
  "data": {
    "device_id": "ESP32_LL_01",
    "lot_code": "LL-2024-042",
    "quality_score": 92.5,
    "quality_grade": "A",
    "relief_uniformity": 0.94,
    "color_score": 88,
    "timestamp": "2024-12-23T14:32:15Z"
  }
}
```

---

## 🖥️ Frontend SQAL

### Architecture

**Stack**: React + Vite + TypeScript + Tailwind CSS

**Port**: 5173

**Localisation**: `sqal/`

### Composants Principaux

1. **RealtimeMonitor** (`src/components/RealtimeMonitor.tsx`)
   - Affichage temps réel samples
   - WebSocket connection status
   - Historique dernières mesures

2. **ToFVisualizer** (`src/components/ToFVisualizer.tsx`)
   - Heatmap 8x8 du relief
   - Visualisation 3D (optionnel)

3. **SpectralChart** (`src/components/SpectralChart.tsx`)
   - Graphique barres 10 canaux
   - Comparaison profil optimal

4. **QualityDashboard** (`src/pages/Dashboard.tsx`)
   - Stats globales (échantillons/jour, grade moyen)
   - Distribution grades (A+, A, B, C, D)
   - Lots en cours d'inspection

---

## 🧪 Simulateur SQAL

### Utilisation

```bash
cd simulators/sqal

# Simuler device ESP32_LL_01
python main.py \
  --device ESP32_LL_01 \
  --backend-url ws://localhost:8000/ws/sensors/ \
  --interval 30 \
  --config-profile foiegras_standard_barquette

# Options:
# --interval: secondes entre mesures (défaut: 30)
# --config-profile: profil qualité (standard, premium, bio)
```

### Profils Qualité

**Standard** (`foiegras_standard_barquette`):
- Relief: variation ±5mm
- Couleur: jaune uniforme
- Grade attendu: A-B

**Premium** (`foiegras_premium_terrine`):
- Relief: variation ±2mm
- Couleur: jaune doré parfait
- Grade attendu: A+-A

**Bio** (`foiegras_bio_entier`):
- Relief: variation ±8mm
- Couleur: jaune orangé naturel
- Grade attendu: B-C

---

## 📈 Monitoring & Performance

### Métriques Clés

| Métrique | Valeur Cible | Alerte |
|----------|--------------|--------|
| Échantillons/heure | 100-200 | <50 ou >300 |
| Grade moyen | A-B | <B |
| Taux rejet (D) | <5% | >10% |
| Latence WebSocket | <100ms | >500ms |
| Perte connexion | 0% | >1% |

### Dashboard Production

**URL**: http://localhost:5173/monitoring

**Affichage**:
- Échantillons temps réel (graphique streaming)
- Distribution grades (pie chart)
- Top 10 lots (table)
- Alertes qualité (liste)

---

## 🔧 Troubleshooting

### Problème: Capteur ToF retourne valeurs aberrantes

**Symptômes**: Distances > 400mm ou < 0mm

**Solutions**:
1. Vérifier calibration ESP32
2. Contrôler câblage I2C
3. Redémarrer device
4. Vérifier température (doit être 15-25°C)

### Problème: Frontend ne reçoit pas données

**Symptômes**: WebSocket connecté mais pas de messages

**Solutions**:
1. Vérifier backend logs: `docker-compose logs backend`
2. Tester endpoint: `curl http://localhost:8000/health`
3. Vérifier simulateur actif: `ps aux | grep main.py`
4. Regarder console navigateur (F12)

### Problème: Grading incohérent

**Symptômes**: Grades A pour échantillons visuellement mauvais

**Solutions**:
1. Recalibrer algorithme grading
2. Vérifier profils qualité simulateur
3. Comparer avec inspection manuelle
4. Ajuster seuils dans `app/services/sqal.py`

---

## 🔗 Liens Documentation

- [Intégration SQAL Complète](../../INTEGRATION_SQAL_COMPLETE.md)
- [WebSocket Data Flow](../../SQAL_WEBSOCKET_DATA_FLOW.md)
- [Simulateur SQAL](../../simulators/sqal/README.md)
- [Architecture](../02-ARCHITECTURE/README.md)
- [Fonctionnalités](../03-FONCTIONNALITES/README.md)

---

**Retour**: [Index principal](../README.md)
