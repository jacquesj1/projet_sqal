# SQAL Simulator - Specification des Donnees JSON

Ce document decrit exhaustivement les structures de donnees JSON envoyees par le simulateur SQAL au backend via WebSocket.

## Table des matieres

1. [Vue d'ensemble](#vue-densemble)
2. [Message HELLO (Identification)](#message-hello-identification)
3. [Message SENSOR_DATA (Mesure)](#message-sensor_data-mesure)
4. [Message HEARTBEAT](#message-heartbeat)
5. [Donnees VL53L8CH (ToF)](#donnees-vl53l8ch-tof)
6. [Donnees AS7341 (Spectral)](#donnees-as7341-spectral)
7. [Donnees Fusion](#donnees-fusion)
8. [Metriques Metier Foie Gras](#metriques-metier-foie-gras)
9. [Profils de Qualite](#profils-de-qualite)
10. [Schemas JSON Complets](#schemas-json-complets)

---

## Vue d'ensemble

Le simulateur SQAL emule un ESP32 equipe de deux capteurs I2C :
- **VL53L8CH** : Capteur Time-of-Flight (ToF) 8x8 pixels - mesure les distances/hauteurs
- **AS7341** : Spectrometre 10 canaux (415nm a NIR) - analyse spectrale couleur

Le simulateur communique avec le backend via WebSocket (`ws://localhost:8000/ws/sensors/`) et envoie trois types de messages :

| Type | Description | Frequence |
|------|-------------|-----------|
| `esp32_hello` | Identification de l'ESP32 | 1x au demarrage |
| `sensor_data` | Donnees capteurs + analyse | Configurable (1 Hz par defaut) |
| `heartbeat` | Etat de sante | Toutes les 30 secondes |

---

## Message HELLO (Identification)

Envoye une seule fois apres la connexion WebSocket.

```json
{
  "type": "esp32_hello",
  "device_id": "ESP32-A1B2C3D4",
  "mac_address": "24:0A:C4:12:34:56",
  "location": "Ligne A",
  "ip_address": "192.168.1.150",
  "firmware_version": "1.0.0",
  "sensors": {
    "vl53l8ch": "0x29",
    "as7341": "0x39"
  },
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

### Champs

| Champ | Type | Description |
|-------|------|-------------|
| `type` | string | Toujours `"esp32_hello"` |
| `device_id` | string | Identifiant unique ESP32 (format: `ESP32-XXXXXXXX`) |
| `mac_address` | string | Adresse MAC Espressif (OUI: `24:0A:C4`) |
| `location` | string | Position physique (`"Ligne A"`, `"Ligne B"`, `"Ligne C"`) |
| `ip_address` | string | IP locale assignee par DHCP |
| `firmware_version` | string | Version du firmware simulateur |
| `sensors` | object | Adresses I2C des capteurs |
| `timestamp` | string | ISO 8601 UTC |

---

## Message SENSOR_DATA (Mesure)

Message principal contenant toutes les donnees d'une inspection.

```json
{
  "type": "sensor_data",
  "timestamp": "2024-01-15T14:30:05.123Z",
  "sample_id": "FG-A1B2C3D4",
  "device_id": "ESP32-A1B2C3D4",
  "location": "Ligne A",

  "vl53l8ch": { /* Analyse VL53L8CH - voir section dediee */ },
  "as7341": { /* Analyse AS7341 - voir section dediee */ },
  "fusion": { /* Resultat fusion - voir section dediee */ },
  "meta": { /* Metadonnees capteur */ },

  "lot_abattage": "LOT-20240115-A1B2",
  "eleveur": "Ferme Martin",
  "provenance": "Perigord, France"
}
```

---

## Message HEARTBEAT

Envoye toutes les 30 secondes pour signaler que l'ESP32 est actif.

```json
{
  "type": "heartbeat",
  "device_id": "ESP32-A1B2C3D4",
  "status": "online",
  "uptime": 3600,
  "stats": {
    "measurements_sent": 120,
    "measurements_buffered": 0,
    "reconnections": 0,
    "i2c_errors": 0,
    "uptime_seconds": 3600
  },
  "buffer_size": 0,
  "timestamp": "2024-01-15T15:30:00.000Z"
}
```

### Champs stats

| Champ | Type | Description |
|-------|------|-------------|
| `measurements_sent` | integer | Nombre total de mesures envoyees |
| `measurements_buffered` | integer | Mesures en attente dans le buffer local |
| `reconnections` | integer | Nombre de reconnexions depuis le boot |
| `i2c_errors` | integer | Erreurs de communication I2C |
| `uptime_seconds` | integer | Temps de fonctionnement en secondes |

---

## Donnees VL53L8CH (ToF)

Le capteur VL53L8CH fournit une matrice 8x8 de mesures de distance.

### Sortie de `VL53L8CH_DataAnalyzer.process()`

La methode `process()` de l'analyseur retourne la structure suivante :

```json
{
  "timestamp": 1705326605.123,
  "processing_time_s": 0.045,

  "stats": {
    "volume_mm3": 125000.5,
    "volume_trapezoidal_mm3": 124500.0,
    "volume_simpson_mm3": 124800.0,
    "volume_spline_mm3": 124600.0,
    "average_height_mm": 45.2,
    "max_height_mm": 52.1,
    "min_height_mm": 38.5,
    "height_range_mm": 13.6,
    "height_variation_mm": 3.2,
    "occupied_pixels": 48,
    "base_area_mm2": 9000.0,
    "surface_uniformity": 0.85
  },

  "bins_analysis": {
    "multi_peak_count": [[1,1,1,1,1,1,1,1], ...],
    "surface_roughness": [[0.12,0.15,...], ...],
    "signal_quality": [[0.85,0.88,...], ...],
    "texture_score": [[0.25,0.28,...], ...],
    "density_score": [[3500,3600,...], ...],
    "peak_bin_map": [[45,46,...], ...]
  },

  "reflectance_analysis": {
    "mean_reflectance_pct": 45.2,
    "std_reflectance_pct": 8.5,
    "low_reflectance_fraction": 0.05,
    "high_reflectance_fraction": 0.02,
    "local_variations": [
      [2, 3, 15.2],
      [5, 6, 13.8]
    ]
  },

  "amplitude_consistency": {
    "mean_amplitude": 108.5,
    "std_amplitude": 12.3,
    "outlier_fraction": 0.03,
    "consistency_ok": true
  },

  "defects": [
    {
      "pos": [3, 5],
      "type": "foreign_body",
      "severity": 0.65,
      "deviation_mm": -12.5
    },
    {
      "pos": [6, 2],
      "type": "surface_deformation",
      "severity": 0.42,
      "deviation_mm": 8.3
    }
  ],

  "quality_score": 0.87,

  "score_breakdown": {
    "volume_score": 0.85,
    "texture_score": 0.88,
    "density_score": 0.90,
    "signal_quality_score": 0.85,
    "reflectance_score": 0.88,
    "consistency_score": 0.92,
    "defect_penalty": 0.05
  },

  "grade": "Grade A - Excellente qualite"
}
```

#### Description `bins_analysis` (Analyse histogrammes ToF)

| Champ | Type | Dimensions | Description |
|-------|------|------------|-------------|
| `multi_peak_count` | int[][] | 8x8 | Nombre de pics detectes par zone |
| `surface_roughness` | float[][] | 8x8 | Rugosite de surface (std/max) |
| `signal_quality` | float[][] | 8x8 | Qualite du signal (max/total) |
| `texture_score` | float[][] | 8x8 | Score texture (entropie normalisee, 0-1) |
| `density_score` | float[][] | 8x8 | Score densite (energie totale) |
| `peak_bin_map` | int[][] | 8x8 | Indice du bin principal par zone |

#### Description `reflectance_analysis`

| Champ | Type | Description |
|-------|------|-------------|
| `mean_reflectance_pct` | float | Reflectance moyenne (%) |
| `std_reflectance_pct` | float | Ecart-type reflectance |
| `low_reflectance_fraction` | float | Fraction pixels < 30% |
| `high_reflectance_fraction` | float | Fraction pixels > 80% |
| `local_variations` | array | Anomalies locales [i, j, std] |

#### Description `amplitude_consistency`

| Champ | Type | Description |
|-------|------|-------------|
| `mean_amplitude` | float | Amplitude moyenne |
| `std_amplitude` | float | Ecart-type amplitude |
| `outlier_fraction` | float | Fraction outliers (z-score > 2.5) |
| `consistency_ok` | boolean | True si outlier_fraction < seuil |

#### Description `defects` (Defauts detectes)

| Champ | Type | Description |
|-------|------|-------------|
| `pos` | [int, int] | Position [ligne, colonne] dans la matrice 8x8 |
| `type` | string | `"foreign_body"` ou `"surface_deformation"` |
| `severity` | float | Severite 0-1 |
| `deviation_mm` | float | Ecart a la mediane (negatif = corps etranger) |

#### Calcul du `quality_score`

Le score est calcule avec la ponderation suivante :

| Composante | Poids | Description |
|------------|-------|-------------|
| volume | 15% | Volume dans plage attendue (350k-1050k mm³) |
| texture | 20% | Inverse de l'entropie moyenne |
| density | 20% | Densite moyenne / seuil |
| signal_quality | 15% | Qualite signal moyenne |
| reflectance | 15% | Penalite anomalies reflectance |
| consistency | 15% | Consistance du signal |

Penalite defauts : `min(1.0, somme_severites / nb_defauts)`

### Structure complete `vl53l8ch`

```json
{
  "timestamp": 1705326605.123,

  "stats": {
    "volume_mm3": 125000.5,
    "volume_trapezoidal_mm3": 124500.0,
    "volume_simpson_mm3": 124800.0,
    "volume_spline_mm3": 124600.0,
    "average_height_mm": 45.2,
    "max_height_mm": 52.1,
    "min_height_mm": 38.5,
    "height_range_mm": 13.6,
    "height_variation_mm": 3.2,
    "occupied_pixels": 48,
    "base_area_mm2": 9000.0,
    "surface_uniformity": 0.85,
    "uniformity": 0.85
  },

  "distance_matrix": [
    [55, 52, 48, 45, 45, 48, 52, 55],
    [52, 48, 42, 40, 40, 42, 48, 52],
    [48, 42, 38, 35, 35, 38, 42, 48],
    [45, 40, 35, 32, 32, 35, 40, 45],
    [45, 40, 35, 32, 32, 35, 40, 45],
    [48, 42, 38, 35, 35, 38, 42, 48],
    [52, 48, 42, 40, 40, 42, 48, 52],
    [55, 52, 48, 45, 45, 48, 52, 55]
  ],

  "reflectance_matrix": [
    [120, 125, 130, 135, 135, 130, 125, 120],
    [125, 130, 140, 145, 145, 140, 130, 125],
    [130, 140, 150, 155, 155, 150, 140, 130],
    [135, 145, 155, 160, 160, 155, 145, 135],
    [135, 145, 155, 160, 160, 155, 145, 135],
    [130, 140, 150, 155, 155, 150, 140, 130],
    [125, 130, 140, 145, 145, 140, 130, 125],
    [120, 125, 130, 135, 135, 130, 125, 120]
  ],

  "amplitude_matrix": [
    [90, 95, 100, 105, 105, 100, 95, 90],
    [95, 100, 110, 115, 115, 110, 100, 95],
    [100, 110, 120, 125, 125, 120, 110, 100],
    [105, 115, 125, 130, 130, 125, 115, 105],
    [105, 115, 125, 130, 130, 125, 115, 105],
    [100, 110, 120, 125, 125, 120, 110, 100],
    [95, 100, 110, 115, 115, 110, 100, 95],
    [90, 95, 100, 105, 105, 100, 95, 90]
  ],

  "reflectance_analysis": {
    "avg_reflectance": 140.5,
    "reflectance_uniformity": 0.88,
    "optical_anomalies": []
  },

  "amplitude_consistency": {
    "avg_amplitude": 108.5,
    "amplitude_std": 12.3,
    "amplitude_variance": 151.29,
    "signal_stability": 0.92
  },

  "defects": [],

  "quality_score": 0.87,
  "grade": "A",

  "score_breakdown": {
    "volume_score": 0.85,
    "uniformity_score": 0.88,
    "reflectance_score": 0.90,
    "amplitude_score": 0.88,
    "defect_penalty": 0.0
  },

  "volume_mm3": 124500.0,
  "base_area_mm2": 9000.0,
  "average_height_mm": 45.2,
  "max_height_mm": 52.1,
  "min_height_mm": 38.5,
  "height_range_mm": 13.6,
  "surface_uniformity": 0.85
}
```

### Description des matrices

| Matrice | Dimensions | Unite | Description |
|---------|------------|-------|-------------|
| `distance_matrix` | 8x8 | mm | Distance capteur-surface (100mm = tapis nu) |
| `reflectance_matrix` | 8x8 | 0-255 | Reflectance optique de la surface |
| `amplitude_matrix` | 8x8 | 0-255 | Amplitude du signal retour |

### Description des statistiques

| Champ | Type | Unite | Description |
|-------|------|-------|-------------|
| `volume_mm3` | float | mm³ | Volume calcule (somme simple) |
| `volume_trapezoidal_mm3` | float | mm³ | Volume methode trapezoidale |
| `volume_simpson_mm3` | float | mm³ | Volume methode Simpson |
| `volume_spline_mm3` | float | mm³ | Volume interpolation spline |
| `average_height_mm` | float | mm | Hauteur moyenne du produit |
| `max_height_mm` | float | mm | Hauteur maximale |
| `min_height_mm` | float | mm | Hauteur minimale |
| `height_range_mm` | float | mm | Ecart max-min |
| `height_variation_mm` | float | mm | Ecart-type des hauteurs |
| `occupied_pixels` | integer | - | Pixels avec produit (>5% du max) |
| `base_area_mm2` | float | mm² | Surface totale de la grille |
| `surface_uniformity` | float | 0-1 | Uniformite de surface |

### Grades VL53L8CH

| Grade | Score | Description |
|-------|-------|-------------|
| `A+` | >= 0.85 | Excellence |
| `A` | 0.75 - 0.85 | Bonne qualite |
| `B` | 0.60 - 0.75 | Qualite acceptable |
| `C` | 0.45 - 0.60 | Qualite limite |
| `REJECT` | < 0.45 | Rejete |

---

## Donnees AS7341 (Spectral)

Le spectrometre AS7341 fournit 10 canaux spectraux.

### Sortie de `AS7341_DataAnalyzer.process()`

La methode `process()` de l'analyseur retourne la structure suivante :

```json
{
  "spectral_ratios": {
    "violet_orange_ratio": 0.35,
    "nir_violet_ratio": 1.45,
    "discoloration_index": 1.52,
    "lipid_oxidation_index": 0.95,
    "freshness_meat_index": 0.48,
    "oil_oxidation_index": 0.62,
    "red_violet_ratio": 1.30,
    "green_red_ratio": 1.45,
    "yellow_blue_ratio": 1.27,
    "normalized_clear": 0.088
  },

  "quality_metrics": {
    "freshness_index": 0.92,
    "fat_quality_index": 0.88,
    "color_uniformity": 0.85,
    "oxidation_index": 0.12,
    "overall_grade": "A",
    "quality_score": 0.87,
    "defects_detected": []
  },

  "grade": "A",
  "quality_score": 0.87,

  "defects": [
    "Oxydation lipidique excessive (Violet/Orange > 0.55)",
    "Jaunissement excessif (decoloration > 2.0)"
  ],

  "meta": {
    "device_id": "ESP32-A1B2C3D4",
    "mac_address": "24:0A:C4:12:34:56",
    "location": "Ligne A"
  },

  "quality_js": {
    "score": 88,
    "classification": "Tres bon",
    "ratios": {
      "red_green": 1.48,
      "red_blue": 1.55,
      "yellow_blue": 1.32,
      "ir_red": 0.52
    },
    "deviations": {
      "red_green": 0.01,
      "red_blue": 0.03,
      "yellow_blue": 0.02,
      "ir_red": 0.04,
      "average": 0.025
    }
  }
}
```

#### Description `spectral_ratios` (Ratios calcules)

| Ratio | Formule | Plage optimale | Plage acceptable | Signification |
|-------|---------|----------------|------------------|---------------|
| `violet_orange_ratio` | F1(415nm) / F7(630nm) | 0.25-0.45 | 0.20-0.55 | Oxydation lipides |
| `nir_violet_ratio` | NIR(910nm) / F1(415nm) | 1.2-1.8 | 1.0-2.0 | Structure/homogeneite |
| `discoloration_index` | (F5+F6) / (F1+F2) | 1.3-1.7 | 1.1-2.0 | Jaunissement |
| `lipid_oxidation_index` | (F7+F8) / F4 | 0.8-1.2 | 0.7-1.4 | Oxydation acides gras (TBARS) |
| `freshness_meat_index` | (F1+F2) / (F7+F8) | 0.35-0.65 | 0.25-0.75 | Fraicheur viande |
| `oil_oxidation_index` | (F1+F3) / (F5+F6) | 0.5-0.8 | 0.4-0.9 | Oxydation huiles/graisses |
| `red_violet_ratio` | F8(680nm) / F1(415nm) | - | - | Oxydation hemoglobine |
| `green_red_ratio` | F5(555nm) / F8(680nm) | - | - | Couleur |
| `yellow_blue_ratio` | F6(590nm) / F3(480nm) | - | - | Jaunissement simple |
| `normalized_clear` | Clear / 65535 | - | - | Intensite globale |

#### Description `quality_metrics` (Indices de qualite)

| Indice | Plage | Calcul | Description |
|--------|-------|--------|-------------|
| `freshness_index` | 0-1 | 60% violet_orange + 40% freshness_meat | 1.0 = tres frais |
| `fat_quality_index` | 0-1 | 60% lipid_oxidation + 40% oil_oxidation | 1.0 = excellent gras |
| `color_uniformity` | 0-1 | Base sur discoloration_index | 1.0 = couleur uniforme |
| `oxidation_index` | 0-1 | 1.0 - fat_quality_index | 0.0 = pas d'oxydation |
| `quality_score` | 0-1 | Moyenne ponderee (voir ci-dessous) | Score global |

#### Calcul du `quality_score` AS7341

```
quality_score = freshness_index * 0.35
             + fat_quality_index * 0.30
             + color_uniformity * 0.20
             + (1.0 - oxidation_index) * 0.15
```

#### Description `defects` (Anomalies detectees)

Liste des anomalies spectrales detectees :

| Condition | Message |
|-----------|---------|
| violet_orange < 0.20 | "Ratio Violet/Orange anormalement bas (< 0.20)" |
| violet_orange > 0.55 | "Oxydation lipidique excessive (Violet/Orange > 0.55)" |
| nir_violet < 1.0 | "Structure inhomogene (NIR/Violet < 1.0)" |
| nir_violet > 2.0 | "Anomalie structurelle (NIR/Violet > 2.0)" |
| discoloration < 1.1 | "Indice decoloration anormal (< 1.1)" |
| discoloration > 2.0 | "Jaunissement excessif (decoloration > 2.0)" |
| lipid_oxidation < 0.7 | "Indice oxydation lipidique bas (< 0.7)" |
| lipid_oxidation > 1.4 | "Oxydation acides gras elevee (TBARS > 1.4)" |
| freshness_meat < 0.25 | "Degradation pigments hemiques (freshness < 0.25)" |
| freshness_meat > 0.75 | "Indice fraicheur anormal (> 0.75)" |

#### Description `quality_js` (Methode JavaScript alternative)

Score calcule selon la methode du fichier `production-simulator-timescaledb.js` :

| Ratio JS | Formule | Valeur ideale | Signification |
|----------|---------|---------------|---------------|
| `red_green` | F7(630nm) / F5(555nm) | 1.5 | Maturite |
| `red_blue` | F7(630nm) / F2(445nm) | 1.6 | Graisse |
| `yellow_blue` | F6(590nm) / F2(445nm) | 1.3 | Coloration |
| `ir_red` | NIR(910nm) / F7(630nm) | 0.5 | Teneur eau |

Score JS = `100 - (deviation_moyenne * 100)`, borne entre 60 et 100.

Classification JS :
- >= 90 : "Excellent"
- 80-89 : "Tres bon"
- 70-79 : "Bon"
- < 70 : "Acceptable"

### Structure complete `as7341`

```json
{
  "channels": {
    "F1_415nm": 1250,
    "F2_445nm": 1480,
    "F3_480nm": 1720,
    "F4_515nm": 2100,
    "F5_555nm": 2350,
    "F6_590nm": 2180,
    "F7_630nm": 1950,
    "F8_680nm": 1620,
    "Clear": 5800,
    "NIR": 980
  },

  "integration_time": 100,
  "gain": 8,

  "spectral_ratios": {
    "violet_orange": 0.35,
    "nir_violet": 1.45,
    "discoloration_index": 1.52,
    "lipid_oxidation_index": 0.95,
    "freshness_meat_index": 0.48,
    "oil_oxidation_index": 0.62,
    "red_green": 1.48,
    "red_blue": 1.55,
    "yellow_blue": 1.32,
    "ir_red": 0.52
  },

  "quality_metrics": {
    "freshness_index": 0.92,
    "fat_quality_index": 0.88,
    "color_uniformity": 0.85,
    "oxidation_index": 0.08,
    "overall_grade": "A",
    "quality_score": 0.87,
    "defects_detected": []
  },

  "freshness_index": 0.92,
  "fat_quality_index": 0.88,
  "oxidation_index": 0.08,
  "color_uniformity": 0.85,

  "defects": [],

  "quality_score": 0.87,
  "grade": "A",

  "js_quality": {
    "score": 88,
    "classification": "Tres bon",
    "ratios": {
      "red_green": 1.48,
      "red_blue": 1.55,
      "yellow_blue": 1.32,
      "ir_red": 0.52
    },
    "deviations": {
      "red_green": 0.01,
      "red_blue": 0.03,
      "yellow_blue": 0.02,
      "ir_red": 0.04,
      "average": 0.025
    }
  }
}
```

### Canaux spectraux AS7341

| Canal | Longueur d'onde | Couleur | Usage principal |
|-------|-----------------|---------|-----------------|
| `F1_415nm` | 415 nm | Violet | Detection oxydation |
| `F2_445nm` | 445 nm | Indigo | Base ratio couleur |
| `F3_480nm` | 480 nm | Bleu | Qualite gras |
| `F4_515nm` | 515 nm | Cyan | Reference oxydation |
| `F5_555nm` | 555 nm | Vert | Fraicheur |
| `F6_590nm` | 590 nm | Jaune | Coloration |
| `F7_630nm` | 630 nm | Orange | Maturite |
| `F8_680nm` | 680 nm | Rouge | Qualite gras |
| `Clear` | Large bande | - | Luminosite totale |
| `NIR` | ~910 nm | Proche IR | Teneur en eau/gras |

### Ratios spectraux calcules

| Ratio | Formule | Plage optimale | Signification |
|-------|---------|----------------|---------------|
| `violet_orange` | F1/F7 | 0.25-0.45 | Oxydation lipides |
| `nir_violet` | NIR/F1 | 1.2-1.8 | Structure/homogeneite |
| `discoloration_index` | (F5+F6)/(F1+F2) | 1.3-1.7 | Jaunissement |
| `lipid_oxidation_index` | (F7+F8)/F4 | 0.8-1.2 | Oxydation acides gras |
| `freshness_meat_index` | (F1+F2)/(F7+F8) | 0.35-0.65 | Fraicheur |
| `oil_oxidation_index` | (F1+F3)/(F5+F6) | 0.5-0.8 | Oxydation huiles |
| `red_green` | F7/F5 | 1.2-1.8 | Maturite (JS) |
| `red_blue` | F7/F2 | 1.3-1.8 | Graisse (JS) |
| `yellow_blue` | F6/F2 | 1.1-1.5 | Coloration (JS) |
| `ir_red` | NIR/F7 | 0.4-0.6 | Teneur eau (JS) |

### Indices de qualite

| Indice | Plage | Description |
|--------|-------|-------------|
| `freshness_index` | 0.0-1.0 | 1.0 = tres frais |
| `fat_quality_index` | 0.0-1.0 | 1.0 = excellent gras |
| `color_uniformity` | 0.0-1.0 | 1.0 = couleur uniforme |
| `oxidation_index` | 0.0-1.0 | 0.0 = pas d'oxydation |

---

## Donnees Fusion

Resultat de la fusion des analyses ToF et spectrale.

### Structure complete `fusion`

```json
{
  "sample_id": "FG-A1B2C3D4",
  "final_grade": "A",
  "final_score": 0.856,

  "tof_score": 0.87,
  "spectral_score": 0.84,
  "tof_contribution": 0.60,
  "spectral_contribution": 0.40,

  "vl53l8ch_grade": "A",
  "vl53l8ch_score": 0.87,
  "as7341_grade": "A",
  "as7341_score": 0.84,

  "fusion_mode": "ToF + Spectral",

  "combined_defects": [],
  "defects": [],
  "num_defects": 0,

  "metrics": {
    "tof_grade": "A",
    "spectral_grade": "A",
    "freshness_index": 0.92,
    "fat_quality_index": 0.88,
    "volume_mm3": 124500.0
  },

  "foie_gras_metrics": { /* Voir section dediee */ }
}
```

### Ponderation fusion

La fusion utilise une ponderation fixe :
- **ToF (VL53L8CH)** : 60% - Structure et volume
- **Spectral (AS7341)** : 40% - Couleur et qualite

```
final_score = (tof_score * 0.60) + (spectral_score * 0.40)
```

### Regles de grade final

1. **Rejet automatique** si l'un des capteurs donne `REJECT`
2. **Rejet** si nombre total de defauts >= 5
3. Sinon, attribution par score :

| Score | Grade |
|-------|-------|
| >= 0.85 | A+ |
| 0.75 - 0.85 | A |
| 0.60 - 0.75 | B |
| 0.45 - 0.60 | C |
| < 0.45 | REJECT |

---

## Metriques Metier Foie Gras

Enrichissement specifique au domaine foie gras.

### Structure complete `foie_gras_metrics`

```json
{
  "lobe_thickness_mm": 48.5,
  "thickness_std_mm": 2.8,
  "thickness_category": "extra",
  "is_irregular_lobe": false,

  "estimated_volume_cm3": 425.0,
  "estimated_weight_g": 402.5,

  "fill_level_mm": 49.2,
  "fill_level_percent": 98.4,
  "fill_conformity": "conforme",
  "fill_deviation_mm": -0.8,

  "dimensional_conformity_score": 95.0,
  "dimensional_conformity_percent": 95.0,

  "l_star": 70.5,
  "a_star": 5.2,
  "b_star": 20.8,
  "delta_e": 1.8,
  "reference_id": "cru_extra",

  "color_score_premium": 92.0,
  "color_conformity_percent": 92.0,

  "has_hematoma": false,
  "hematoma_severity": 0.0,
  "has_bile_traces": false,
  "bile_severity": 0.0,
  "has_oxidation": false,
  "oxidation_severity": 0.05,

  "defect_rate_percent": 0.0,

  "process_cp": 1.45,
  "process_cpk": 1.38,
  "process_capability": "excellent",
  "process_mean": 48.2,
  "process_std": 2.1,
  "is_centered": true,

  "global_quality_score_100": 85.6,

  "has_critical_color_deviation": false,
  "has_underfill": false,
  "has_oxidation_trend": false,

  "is_compliant": true,
  "is_downgraded": false,
  "is_rejected": false
}
```

### Categories d'epaisseur de lobe

| Categorie | Epaisseur (mm) | Description |
|-----------|----------------|-------------|
| `extra` | 45-60 | Lobe epais premium |
| `premier_choix` | 35-45 | Lobe standard |
| `deuxieme_choix` | 25-35 | Lobe fin |
| `hors_norme` | 0-25 | Rejet |

### Calcul du poids estime

```
Densite foie gras cru = 0.947 g/cm³ (a 20°C)
Poids (g) = Volume (mm³) / 1000 * 0.947 * variabilite(±3%)
```

### Colorimetrie L*a*b*

| Parametre | Reference cru_extra | Plage acceptable |
|-----------|---------------------|------------------|
| L* (Luminosite) | 70.0 | 65-75 |
| a* (Rouge-Vert) | 5.0 | 2-10 |
| b* (Jaune-Bleu) | 20.0 | 15-25 |

### Seuils Delta E (ecart couleur)

| Delta E | Interpretation |
|---------|----------------|
| < 2.0 | Excellent (imperceptible) |
| 2.0 - 5.0 | Acceptable (perceptible mais OK) |
| > 8.0 | Critique (rejet) |

### Indicateurs de capabilite processus (Cp/Cpk)

| Valeur | Capabilite |
|--------|------------|
| >= 1.67 | Excellent |
| 1.33 - 1.67 | Bon |
| 1.0 - 1.33 | Acceptable |
| < 1.0 | Insuffisant |

---

## Profils de Qualite

Le simulateur selectionne aleatoirement un profil de qualite selon les poids definis.

### Distribution des profils

| Profil | Poids | Grade attendu | Score |
|--------|-------|---------------|-------|
| `premium` | 15% | A+ | > 0.85 |
| `good` | 40% | A | > 0.75 |
| `acceptable` | 30% | B | > 0.65 |
| `low` | 10% | C | > 0.50 |
| `defective` | 5% | REJECT | < 0.50 |

### Parametres par profil

#### Profil `premium` (15%)

```json
{
  "freshness": { "min": 0.90, "max": 1.0, "mean": 0.95 },
  "fat_quality": { "min": 0.90, "max": 1.0, "mean": 0.95 },
  "oxidation_level": { "min": 0.0, "max": 0.1, "mean": 0.05 },
  "surface_uniformity": { "min": 0.85, "max": 0.98, "mean": 0.92 },
  "thickness_variation": { "min": 0.5, "max": 2.0, "mean": 1.0 },
  "temperature": { "min": 19.0, "max": 21.0, "mean": 20.0 },
  "ambient_light": { "min": 95.0, "max": 105.0, "mean": 100.0 }
}
```

#### Profil `good` (40%)

```json
{
  "freshness": { "min": 0.75, "max": 0.95, "mean": 0.85 },
  "fat_quality": { "min": 0.75, "max": 0.95, "mean": 0.85 },
  "oxidation_level": { "min": 0.05, "max": 0.25, "mean": 0.15 },
  "surface_uniformity": { "min": 0.75, "max": 0.90, "mean": 0.82 },
  "thickness_variation": { "min": 1.5, "max": 3.5, "mean": 2.5 },
  "temperature": { "min": 18.0, "max": 22.0, "mean": 20.0 },
  "ambient_light": { "min": 85.0, "max": 115.0, "mean": 100.0 }
}
```

#### Profil `acceptable` (30%)

```json
{
  "freshness": { "min": 0.60, "max": 0.80, "mean": 0.70 },
  "fat_quality": { "min": 0.60, "max": 0.80, "mean": 0.70 },
  "oxidation_level": { "min": 0.20, "max": 0.40, "mean": 0.30 },
  "surface_uniformity": { "min": 0.65, "max": 0.85, "mean": 0.75 },
  "thickness_variation": { "min": 2.5, "max": 4.5, "mean": 3.5 },
  "temperature": { "min": 17.0, "max": 23.0, "mean": 20.0 },
  "ambient_light": { "min": 75.0, "max": 125.0, "mean": 100.0 }
}
```

#### Profil `low` (10%)

```json
{
  "freshness": { "min": 0.45, "max": 0.65, "mean": 0.55 },
  "fat_quality": { "min": 0.45, "max": 0.65, "mean": 0.55 },
  "oxidation_level": { "min": 0.35, "max": 0.55, "mean": 0.45 },
  "surface_uniformity": { "min": 0.55, "max": 0.75, "mean": 0.65 },
  "thickness_variation": { "min": 3.5, "max": 5.5, "mean": 4.5 },
  "temperature": { "min": 16.0, "max": 24.0, "mean": 20.0 },
  "ambient_light": { "min": 70.0, "max": 130.0, "mean": 100.0 }
}
```

#### Profil `defective` (5%)

```json
{
  "freshness": { "min": 0.20, "max": 0.50, "mean": 0.35 },
  "fat_quality": { "min": 0.20, "max": 0.50, "mean": 0.35 },
  "oxidation_level": { "min": 0.50, "max": 0.80, "mean": 0.65 },
  "surface_uniformity": { "min": 0.40, "max": 0.60, "mean": 0.50 },
  "thickness_variation": { "min": 5.0, "max": 7.0, "mean": 6.0 },
  "temperature": { "min": 15.0, "max": 25.0, "mean": 20.0 },
  "ambient_light": { "min": 60.0, "max": 140.0, "mean": 100.0 }
}
```

---

## Schemas JSON Complets

### Schema complet d'un message `sensor_data`

```json
{
  "type": "sensor_data",
  "timestamp": "2024-01-15T14:30:05.123Z",
  "sample_id": "FG-A1B2C3D4",
  "device_id": "ESP32-A1B2C3D4",
  "location": "Ligne A",

  "vl53l8ch": {
    "timestamp": 1705326605.123,
    "stats": {
      "volume_mm3": 125000.5,
      "volume_trapezoidal_mm3": 124500.0,
      "volume_simpson_mm3": 124800.0,
      "volume_spline_mm3": 124600.0,
      "average_height_mm": 45.2,
      "max_height_mm": 52.1,
      "min_height_mm": 38.5,
      "height_range_mm": 13.6,
      "height_variation_mm": 3.2,
      "occupied_pixels": 48,
      "base_area_mm2": 9000.0,
      "surface_uniformity": 0.85,
      "uniformity": 0.85
    },
    "distance_matrix": [[55,52,48,45,45,48,52,55],[52,48,42,40,40,42,48,52],[48,42,38,35,35,38,42,48],[45,40,35,32,32,35,40,45],[45,40,35,32,32,35,40,45],[48,42,38,35,35,38,42,48],[52,48,42,40,40,42,48,52],[55,52,48,45,45,48,52,55]],
    "reflectance_matrix": [[120,125,130,135,135,130,125,120],[125,130,140,145,145,140,130,125],[130,140,150,155,155,150,140,130],[135,145,155,160,160,155,145,135],[135,145,155,160,160,155,145,135],[130,140,150,155,155,150,140,130],[125,130,140,145,145,140,130,125],[120,125,130,135,135,130,125,120]],
    "amplitude_matrix": [[90,95,100,105,105,100,95,90],[95,100,110,115,115,110,100,95],[100,110,120,125,125,120,110,100],[105,115,125,130,130,125,115,105],[105,115,125,130,130,125,115,105],[100,110,120,125,125,120,110,100],[95,100,110,115,115,110,100,95],[90,95,100,105,105,100,95,90]],
    "reflectance_analysis": {
      "avg_reflectance": 140.5,
      "reflectance_uniformity": 0.88,
      "optical_anomalies": []
    },
    "amplitude_consistency": {
      "avg_amplitude": 108.5,
      "amplitude_std": 12.3,
      "amplitude_variance": 151.29,
      "signal_stability": 0.92
    },
    "defects": [],
    "quality_score": 0.87,
    "grade": "A",
    "score_breakdown": {
      "volume_score": 0.85,
      "uniformity_score": 0.88,
      "reflectance_score": 0.90,
      "amplitude_score": 0.88,
      "defect_penalty": 0.0
    },
    "volume_mm3": 124500.0,
    "base_area_mm2": 9000.0,
    "average_height_mm": 45.2,
    "max_height_mm": 52.1,
    "min_height_mm": 38.5,
    "height_range_mm": 13.6,
    "surface_uniformity": 0.85
  },

  "as7341": {
    "channels": {
      "F1_415nm": 1250,
      "F2_445nm": 1480,
      "F3_480nm": 1720,
      "F4_515nm": 2100,
      "F5_555nm": 2350,
      "F6_590nm": 2180,
      "F7_630nm": 1950,
      "F8_680nm": 1620,
      "Clear": 5800,
      "NIR": 980
    },
    "integration_time": 100,
    "gain": 8,
    "spectral_ratios": {
      "violet_orange": 0.35,
      "nir_violet": 1.45,
      "discoloration_index": 1.52,
      "lipid_oxidation_index": 0.95,
      "freshness_meat_index": 0.48,
      "oil_oxidation_index": 0.62,
      "red_green": 1.48,
      "red_blue": 1.55,
      "yellow_blue": 1.32,
      "ir_red": 0.52
    },
    "quality_metrics": {
      "freshness_index": 0.92,
      "fat_quality_index": 0.88,
      "color_uniformity": 0.85,
      "oxidation_index": 0.08,
      "overall_grade": "A",
      "quality_score": 0.87,
      "defects_detected": []
    },
    "freshness_index": 0.92,
    "fat_quality_index": 0.88,
    "oxidation_index": 0.08,
    "color_uniformity": 0.85,
    "defects": [],
    "quality_score": 0.87,
    "grade": "A"
  },

  "fusion": {
    "sample_id": "FG-A1B2C3D4",
    "final_grade": "A",
    "final_score": 0.856,
    "tof_score": 0.87,
    "spectral_score": 0.84,
    "tof_contribution": 0.60,
    "spectral_contribution": 0.40,
    "vl53l8ch_grade": "A",
    "vl53l8ch_score": 0.87,
    "as7341_grade": "A",
    "as7341_score": 0.84,
    "fusion_mode": "ToF + Spectral",
    "combined_defects": [],
    "defects": [],
    "num_defects": 0,
    "metrics": {
      "tof_grade": "A",
      "spectral_grade": "A",
      "freshness_index": 0.92,
      "fat_quality_index": 0.88,
      "volume_mm3": 124500.0
    },
    "foie_gras_metrics": {
      "lobe_thickness_mm": 48.5,
      "thickness_std_mm": 2.8,
      "thickness_category": "extra",
      "is_irregular_lobe": false,
      "estimated_volume_cm3": 425.0,
      "estimated_weight_g": 402.5,
      "fill_level_mm": 49.2,
      "fill_level_percent": 98.4,
      "fill_conformity": "conforme",
      "fill_deviation_mm": -0.8,
      "dimensional_conformity_score": 95.0,
      "dimensional_conformity_percent": 95.0,
      "l_star": 70.5,
      "a_star": 5.2,
      "b_star": 20.8,
      "delta_e": 1.8,
      "reference_id": "cru_extra",
      "color_score_premium": 92.0,
      "color_conformity_percent": 92.0,
      "has_hematoma": false,
      "hematoma_severity": 0.0,
      "has_bile_traces": false,
      "bile_severity": 0.0,
      "has_oxidation": false,
      "oxidation_severity": 0.05,
      "defect_rate_percent": 0.0,
      "process_cp": 1.45,
      "process_cpk": 1.38,
      "process_capability": "excellent",
      "process_mean": 48.2,
      "process_std": 2.1,
      "is_centered": true,
      "global_quality_score_100": 85.6,
      "has_critical_color_deviation": false,
      "has_underfill": false,
      "has_oxidation_trend": false,
      "is_compliant": true,
      "is_downgraded": false,
      "is_rejected": false
    }
  },

  "meta": {
    "device_id": "ESP32-A1B2C3D4",
    "firmware_version": "1.0.0",
    "temperature_c": 20.0,
    "humidity_percent": 45.0,
    "config_profile": "foiegras_standard_barquette"
  },

  "lot_abattage": "LOT-20240115-A1B2",
  "eleveur": "Ferme Martin",
  "provenance": "Perigord, France"
}
```

---

## Annexe : Configuration Capteurs

### VL53L8CH (ToF)

| Parametre | Valeur par defaut | Description |
|-----------|-------------------|-------------|
| Resolution | 8x8 | Grille de mesure (64 zones) |
| Height sensor | 100 mm | Hauteur capteur au-dessus du tapis |
| Zone size | 37.5 mm | Taille d'une zone |
| N bins | 128 | Bins d'histogramme ToF |
| Bin size | 37.5 mm | Taille d'un bin |

### AS7341 (Spectral)

| Parametre | Valeur par defaut | Description |
|-----------|-------------------|-------------|
| Integration time | 100 ms | Temps d'integration (50-500ms) |
| Gain | 4 | Gain capteur (1, 4, 16, 64) |
| Noise std | 5.0 | Ecart-type bruit gaussien |

---

*Document genere le 2024-01-15 - Version 1.0*
