# Guide d'Alignement des Données - SQAL System

## 📋 Vue d'ensemble

Ce document décrit l'alignement complet des données entre le **générateur de données** (simulator), le **backend FastAPI**, et le **frontend React/TypeScript**.

---

## 🔄 Flux de Données Complet

```
Simulator (Python)
    ↓ WebSocket (ws://backend:8000/ws/sensors/)
Backend FastAPI
    ↓ TimescaleDB (PostgreSQL)
    ↓ WebSocket Broadcast (ws://backend:8000/ws/realtime/)
Frontend Dashboard (React)
```

---

## 📊 Structure des Données

### 1. VL53L8CH (Time-of-Flight Sensor)

#### Données Brutes
- `distance_matrix`: Matrice 8x8 de distances en mm
- `reflectance_matrix`: Matrice 8x8 de réflectance (0-255)
- `amplitude_matrix`: Matrice 8x8 d'amplitudes de signal

#### Statistiques de Base
- `volume_mm3`: Volume calculé en mm³
- `base_area_mm2`: Surface de base en mm²
- `average_height_mm`: Hauteur moyenne en mm
- `max_height_mm`: Hauteur maximale en mm
- `min_height_mm`: Hauteur minimale en mm
- `height_range_mm`: Plage de hauteurs en mm
- `surface_uniformity`: Score d'uniformité (0.0-1.0)

#### Analyses Détaillées
- `bins_analysis`:
  - `histogram`: Distribution des hauteurs
  - `bin_count`: Nombre de bins
  - `multi_peak_detected`: Détection multi-pics (boolean)
  - `roughness_score`: Score de rugosité (0.0-1.0)
  - `signal_quality`: Qualité du signal (0.0-1.0)
  - `texture_score`: Score de texture (0.0-1.0)
  - `density_score`: Score de densité (0.0-1.0)

- `reflectance_analysis`:
  - `avg_reflectance`: Réflectance moyenne
  - `reflectance_uniformity`: Uniformité de réflectance (0.0-1.0)
  - `optical_anomalies`: Liste d'anomalies optiques détectées

- `amplitude_consistency`:
  - `avg_amplitude`: Amplitude moyenne
  - `amplitude_std`: Écart-type d'amplitude
  - `amplitude_variance`: Variance d'amplitude
  - `signal_stability`: Stabilité du signal (0.0-1.0)
  - `z_scores`: Liste des z-scores

#### Évaluation Qualité
- `defects`: Liste des défauts détectés (e.g., "surface_irregularity", "low_reflectance")
- `quality_score`: Score global de qualité (0.0-1.0)
- `score_breakdown`:
  - `volume_score`: Contribution du volume
  - `uniformity_score`: Contribution de l'uniformité
  - `reflectance_score`: Contribution de la réflectance
  - `amplitude_score`: Contribution de l'amplitude
  - `defect_penalty`: Pénalité pour défauts
- `grade`: Grade final ("A+", "A", "B", "C", "REJECT")

---

### 2. AS7341 (Spectral Sensor)

#### Données Brutes
- `channels`:
  - `F1_415nm`: Violet (415nm)
  - `F2_445nm`: Indigo (445nm)
  - `F3_480nm`: Bleu (480nm)
  - `F4_515nm`: Cyan (515nm)
  - `F5_555nm`: Vert (555nm)
  - `F6_590nm`: Jaune (590nm)
  - `F7_630nm`: Orange (630nm)
  - `F8_680nm`: Rouge (680nm)
  - `Clear`: Canal clair
  - `NIR`: Proche infrarouge
- `integration_time`: Temps d'intégration en ms
- `gain`: Gain du capteur

#### Indices de Qualité
- `freshness_index`: Indice de fraîcheur (0.0-1.0, 1.0 = très frais)
- `fat_quality_index`: Indice de qualité du gras (0.0-1.0)
- `oxidation_index`: Indice d'oxydation (0.0-1.0, 0.0 = pas d'oxydation)
- `color_uniformity`: Uniformité de couleur (0.0-1.0)

#### Analyses Spectrales
- `spectral_analysis`:
  - `total_intensity`: Intensité totale
  - `dominant_wavelength`: Longueur d'onde dominante (nm)
  - `spectral_uniformity`: Uniformité spectrale (0.0-1.0)
  - `spectral_ratios`:
    - `violet_orange_ratio`: F1/F7 - Indicateur d'oxydation
    - `blue_red_ratio`: F3/F8 - Indicateur de fraîcheur
    - `green_red_ratio`: F5/F8 - Indicateur de couleur
    - `nir_clear_ratio`: NIR/Clear - Indicateur de densité
    - `yellow_red_ratio`: F6/F8
    - `cyan_orange_ratio`: F4/F7

#### Analyses Couleur
- `color_analysis`:
  - `rgb`: Valeurs RGB calculées
  - `dominant_color`: Couleur dominante (string)
  - `color_temperature_k`: Température de couleur en Kelvin
  - `color_purity`: Pureté de couleur (0.0-1.0)

#### Évaluation Qualité
- `defects`: Liste des défauts détectés (e.g., "oxidation_detected", "freshness_issue")
- `quality_score`: Score global de qualité (0.0-1.0)
- `score_breakdown`:
  - `freshness_score`: Contribution de la fraîcheur
  - `fat_quality_score`: Contribution de la qualité du gras
  - `oxidation_score`: Contribution de l'oxydation
  - `color_score`: Contribution de la couleur
  - `spectral_consistency_score`: Cohérence spectrale
- `grade`: Grade final ("A+", "A", "B", "C", "REJECT")

---

### 3. Fusion (Multi-Sensor Combination)

- `final_score`: Score combiné final (0.0-1.0)
- `final_grade`: Grade final ("A+", "A", "B", "C", "REJECT")
- `vl53l8ch_score`: Contribution du VL53L8CH au score final
- `as7341_score`: Contribution de l'AS7341 au score final
- `defects`: Liste combinée de tous les défauts détectés (VL53L8CH + AS7341)

**Pondération par défaut**: 60% VL53L8CH + 40% AS7341

**Seuils de Grade**:
- `A+`: score >= 0.85
- `A`: score >= 0.75
- `B`: score >= 0.60
- `C`: score >= 0.45
- `REJECT`: score < 0.45

---

### 4. Metadata

- `device_id`: Identifiant du dispositif
- `firmware_version`: Version du firmware
- `temperature_c`: Température en °C
- `humidity_percent`: Humidité en %
- `config_profile`: Profil de configuration utilisé

---

## 🗄️ Schéma de Base de Données

### Table: `sensor_samples` (Hypertable TimescaleDB)

```sql
CREATE TABLE sensor_samples (
    -- Identifiers
    id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    sample_id VARCHAR(100) NOT NULL UNIQUE,

    -- VL53L8CH Raw Data
    vl53l8ch_distance_matrix JSONB,
    vl53l8ch_reflectance_matrix JSONB,
    vl53l8ch_amplitude_matrix JSONB,
    vl53l8ch_bins_matrix JSONB,

    -- VL53L8CH Basic Metrics
    vl53l8ch_volume_mm3 FLOAT,
    vl53l8ch_avg_height_mm FLOAT,
    vl53l8ch_max_height_mm FLOAT,
    vl53l8ch_min_height_mm FLOAT,
    vl53l8ch_base_area_mm2 FLOAT,
    vl53l8ch_surface_uniformity FLOAT,
    vl53l8ch_defect_count INTEGER,
    vl53l8ch_quality_score FLOAT,
    vl53l8ch_grade VARCHAR(50),

    -- VL53L8CH Detailed Analysis
    vl53l8ch_bins_analysis JSONB,
    vl53l8ch_reflectance_analysis JSONB,
    vl53l8ch_amplitude_consistency JSONB,
    vl53l8ch_score_breakdown JSONB,
    vl53l8ch_defects JSONB,

    -- AS7341 Raw Data
    as7341_channels JSONB,
    as7341_integration_time INTEGER,
    as7341_gain INTEGER,

    -- AS7341 Basic Metrics
    as7341_color_score FLOAT,
    as7341_freshness_score FLOAT,
    as7341_freshness_index FLOAT,
    as7341_fat_quality_index FLOAT,
    as7341_oxidation_index FLOAT,
    as7341_color_uniformity FLOAT,
    as7341_quality_score FLOAT,
    as7341_grade VARCHAR(50),

    -- AS7341 Detailed Analysis
    as7341_spectral_analysis JSONB,
    as7341_color_analysis JSONB,
    as7341_score_breakdown JSONB,
    as7341_defects JSONB,

    -- Fusion Results
    fusion_final_score FLOAT NOT NULL,
    fusion_final_grade VARCHAR(50) NOT NULL,
    fusion_vl53l8ch_score FLOAT,
    fusion_as7341_score FLOAT,
    fusion_confidence FLOAT,
    fusion_defects JSONB,

    -- Metadata
    meta_firmware_version VARCHAR(50),
    meta_temperature_c FLOAT,
    meta_humidity_percent FLOAT,
    meta_config_profile VARCHAR(100),
    processing_time_ms FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hypertable creation
SELECT create_hypertable('sensor_samples', 'timestamp');

-- Indexes
CREATE INDEX idx_device_timestamp ON sensor_samples (device_id, timestamp);
CREATE INDEX idx_grade_timestamp ON sensor_samples (fusion_final_grade, timestamp);
CREATE INDEX idx_score_timestamp ON sensor_samples (fusion_final_score, timestamp);
```

---

## 💻 Types TypeScript Frontend

Fichier: `sqal/src/types/sensor.types.ts`

Contient:
- `VL53L8CHAnalysis`: Interface complète pour VL53L8CH
- `AS7341Analysis`: Interface complète pour AS7341
- `FusionResult`: Interface pour résultats de fusion
- `SensorSample`: Interface complète pour un échantillon
- `SensorWebSocketMessage`: Format de message WebSocket
- `SensorDataResponse`: Format de réponse API

---

## 🎨 Composants Frontend

### Composant Principal: `SensorDataViewer`

Fichier: `sqal/src/components/sensors/SensorDataViewer.tsx`

**Onglets**:
1. **Vue d'ensemble**: Métriques clés et résumé des défauts
2. **VL53L8CH (ToF)**: Statistiques, matrices 8x8, analyses détaillées
3. **AS7341 (Spectral)**: Indices de qualité, canaux spectraux, analyses couleur
4. **Fusion**: Résultats combinés et contributions par capteur
5. **Metadata**: Informations du dispositif

**Visualisations**:
- Matrices 8x8 en heatmap
- Barres de progression pour scores
- Graphiques pour canaux spectraux
- Badges pour grades et défauts
- Cartes métriques pour valeurs clés

---

## 🔌 API WebSocket

### Endpoint Simulator → Backend
**URL**: `ws://backend:8000/ws/sensors/`

**Format du message**:
```json
{
  "type": "sensor_data",
  "timestamp": "2025-10-26T10:30:00.000Z",
  "device_id": "ESP32-FOIEGRAS-001",
  "sample_id": "SAMPLE-20251026-103000-123",
  "vl53l8ch": { ... },
  "as7341": { ... },
  "fusion": { ... },
  "meta": { ... }
}
```

### Endpoint Backend → Frontend
**URL**: `ws://backend:8000/ws/realtime/`

**Format du message**:
```json
{
  "type": "sensor_update",
  "timestamp": "2025-10-26T10:30:00.000Z",
  "device_id": "ESP32-FOIEGRAS-001",
  "sample_id": "SAMPLE-20251026-103000-123",
  "vl53l8ch": { ... },
  "as7341": { ... },
  "fusion": { ... },
  "meta": { ... }
}
```

---

## 📝 Exemple Complet

Voir le fichier `FASTAPI_DEPLOYMENT.md` pour un exemple JSON complet.

---

## 🧪 Tests

### Test End-to-End
```bash
# 1. Démarrer le stack complet
docker-compose -f docker-compose.fastapi.yml up -d

# 2. Vérifier les logs du simulator
docker-compose -f docker-compose.fastapi.yml logs -f simulator

# 3. Vérifier les logs du backend
docker-compose -f docker-compose.fastapi.yml logs -f backend

# 4. Accéder au frontend
open http://localhost:5173

# 5. Exécuter les tests automatisés
./test_fastapi_stack.sh
```

### Vérification de la Base de Données
```sql
-- Voir les échantillons récents
SELECT
    sample_id,
    timestamp,
    device_id,
    fusion_final_grade,
    fusion_final_score,
    vl53l8ch_quality_score,
    as7341_quality_score
FROM sensor_samples
ORDER BY timestamp DESC
LIMIT 10;

-- Vérifier que toutes les données détaillées sont stockées
SELECT
    sample_id,
    vl53l8ch_bins_analysis IS NOT NULL AS has_bins,
    vl53l8ch_reflectance_analysis IS NOT NULL AS has_reflectance,
    as7341_spectral_analysis IS NOT NULL AS has_spectral,
    as7341_color_analysis IS NOT NULL AS has_color
FROM sensor_samples
ORDER BY timestamp DESC
LIMIT 10;
```

---

## 📚 Références

- **Simulator**: `simulator/data_generator.py`
- **Backend Models**: `backend_new/app/models/sensor.py`
- **Backend WebSocket**: `backend_new/app/main.py` (ligne 193-505)
- **Frontend Types**: `sqal/src/types/sensor.types.ts`
- **Frontend Viewer**: `sqal/src/components/sensors/SensorDataViewer.tsx`

---

## ✅ Checklist d'Implémentation

- [x] Modèle backend étendu avec tous les champs JSONB
- [x] Types TypeScript complets alignés avec le générateur
- [x] Endpoint WebSocket mis à jour pour sauvegarder toutes les données
- [x] Composant frontend de visualisation détaillée créé
- [x] Documentation complète
- [ ] Migration de base de données exécutée
- [ ] Tests end-to-end validés
- [ ] Déploiement en production

---

## 🚀 Prochaines Étapes

1. Exécuter la migration de base de données pour ajouter les nouveaux champs
2. Redémarrer le backend pour charger le nouveau modèle
3. Tester le flux complet: simulator → backend → database → frontend
4. Intégrer le composant `SensorDataViewer` dans les pages existantes
5. Ajouter des graphiques supplémentaires pour les tendances historiques
6. Optimiser les requêtes TimescaleDB avec les continuous aggregates

---

**Date de dernière mise à jour**: 2025-10-26
**Version**: 2.0.0
**Auteur**: Claude AI
