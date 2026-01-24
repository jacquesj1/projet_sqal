# 📡 Guide de Configuration du Simulateur ESP32

**Fichier**: `simulator/config_foiegras.yaml`
**Version**: 1.0

---

## 🎯 Vue d'ensemble

Le simulateur ESP32 génère des données réalistes de capteurs ToF (VL53L8CH) et spectraux (AS7341) pour tester le dashboard SQAL. La configuration est entièrement pilotée par le fichier YAML.

---

## 📊 Distribution des Grades par Défaut

Le profil **`foiegras_standard_barquette`** (par défaut) génère une distribution réaliste :

| Grade | Probabilité | Score attendu | Signification |
|-------|-------------|---------------|---------------|
| **A+** | 15% | > 0.85 | Premium - Extra quality |
| **A** | 40% | 0.70 - 0.85 | Good - Standard quality |
| **B** | 30% | 0.55 - 0.70 | Acceptable - Acceptable quality |
| **C** | 10% | 0.40 - 0.55 | Low - Déclassé (1er choix) |
| **REJECT** | 5% | < 0.40 | Defective - À rejeter |

**Total** : 100% (85% conformes = A+ + A, 15% non-conformes = B + C + REJECT)

---

## ⚙️ Paramètres du Simulateur

### Ligne de Commande

```bash
python esp32_simulator.py [OPTIONS]
```

**Options disponibles** :

| Option | Description | Défaut | Exemple |
|--------|-------------|--------|---------|
| `--device-id` | Identifiant ESP32 | Auto-généré | `ESP32-A001` |
| `--location` | Emplacement physique | `Ligne A` | `Ligne_Production_B` |
| `--url` | URL WebSocket backend | `ws://localhost:8000/ws/sensors/` | `ws://192.168.1.100:8000/ws/sensors/` |
| `--rate` | Fréquence échantillonnage (Hz) | `1.0` | `0.5` (1 sample/2s), `2.0` (2 samples/s) |
| `--duration` | Durée simulation (secondes) | Infini | `3600` (1 heure) |

### Exemples d'Utilisation

**Test rapide (1 échantillon toutes les 2 secondes)** :
```bash
python esp32_simulator.py --rate 0.5
```

**Production réaliste (1 échantillon par seconde)** :
```bash
python esp32_simulator.py --rate 1.0 --location "Ligne_A" --device-id "ESP32-PROD-001"
```

**Test intensif (2 échantillons par seconde, 30 minutes)** :
```bash
python esp32_simulator.py --rate 2.0 --duration 1800
```

**Simulation multi-lignes** (lancer plusieurs instances) :
```bash
# Terminal 1
python esp32_simulator.py --rate 0.5 --location "Ligne_A" --device-id "ESP32-A001"

# Terminal 2
python esp32_simulator.py --rate 0.5 --location "Ligne_B" --device-id "ESP32-B001"

# Terminal 3
python esp32_simulator.py --rate 0.5 --location "Ligne_C" --device-id "ESP32-C001"
```

---

## 🔧 Modification de la Configuration YAML

### Fichier : `simulator/config_foiegras.yaml`

### 1. Changer la Distribution des Grades

**Scénario** : Production de haute qualité (plus de A+, moins de rejets)

```yaml
quality:
  premium:
    weight: 0.30        # 30% de A+ (au lieu de 15%)
  good:
    weight: 0.50        # 50% de A (au lieu de 40%)
  acceptable:
    weight: 0.15        # 15% de B (au lieu de 30%)
  low:
    weight: 0.04        # 4% de C (au lieu de 10%)
  defective:
    weight: 0.01        # 1% de REJECT (au lieu de 5%)
```

**Résultat** : 80% conformes (A+ + A), 20% non-conformes

---

**Scénario** : Production problématique (test alertes)

```yaml
quality:
  premium:
    weight: 0.05        # 5% de A+
  good:
    weight: 0.20        # 20% de A
  acceptable:
    weight: 0.35        # 35% de B
  low:
    weight: 0.25        # 25% de C
  defective:
    weight: 0.15        # 15% de REJECT
```

**Résultat** : 25% conformes, 75% non-conformes (alertes garanties !)

---

### 2. Ajuster les Paramètres de Qualité

**Premium (A+)** - Pour tester Cpk élevé :

```yaml
premium:
  weight: 0.15
  freshness:
    min: 0.90
    max: 1.0
    mean: 0.95          # Très frais
  fat_quality:
    min: 0.90
    max: 1.0
    mean: 0.95          # Excellente qualité lipidique
  oxidation_level:
    min: 0.0
    max: 0.1
    mean: 0.05          # Presque pas d'oxydation
  surface_uniformity:
    min: 0.90
    max: 0.98
    mean: 0.94          # Très uniforme
  thickness_variation:
    min: 0.5            # Variation minimale
    max: 1.5
    mean: 1.0
```

**Defective (REJECT)** - Pour tester alertes :

```yaml
defective:
  weight: 0.05
  freshness:
    min: 0.0
    max: 0.30
    mean: 0.15          # Très dégradé
  fat_quality:
    min: 0.0
    max: 0.30
    mean: 0.15          # Mauvaise qualité
  oxidation_level:
    min: 0.7
    max: 1.0
    mean: 0.85          # Très oxydé
  surface_uniformity:
    min: 0.30
    max: 0.50
    mean: 0.40          # Très irrégulier
  thickness_variation:
    min: 8.0            # Grande variation
    max: 15.0
    mean: 12.0
```

---

### 3. Modifier les Dimensions du Produit

**Produit plus grand** :

```yaml
product:
  length_mm: 250        # au lieu de 200
  width_mm: 130         # au lieu de 100
  margin_percent: 15
  type: "normal"
```

**Produit irrégulier** :

```yaml
product:
  length_mm: 200
  width_mm: 100
  margin_percent: 20    # Plus de marge pour rotation
  type: "irregular"     # Forme irrégulière
```

---

### 4. Ajuster les Capteurs

**VL53L8CH - Résolution plus élevée** :

```yaml
sensor_vl53l8ch:
  resolution: 16        # 16x16 au lieu de 8x8 (256 zones)
  height_mm: 100
  n_bins: 128
  bin_size_mm: 37.5
```

**AS7341 - Temps d'intégration plus long** :

```yaml
sensor_as7341:
  enabled: true
  integration_time_ms: 500  # au lieu de 100 (plus précis, plus lent)
  gain: 16                  # au lieu de 4 (plus sensible)
  noise_std: 2.0           # au lieu de 5.0 (moins de bruit)
```

---

## 📈 Impact sur les KPIs du Dashboard

### Cp/Cpk (Process Capability)

**Pour obtenir Cpk > 1.33 (Capable)** :
- Réduire `thickness_variation` dans les profils quality
- Augmenter le poids des profils `premium` et `good`

```yaml
premium:
  thickness_variation:
    min: 0.5
    max: 1.5
    mean: 1.0           # Faible variation
```

**Pour obtenir Cpk < 1.0 (Incapable)** - Test alertes :
- Augmenter `thickness_variation`
- Augmenter le poids de `defective`

```yaml
defective:
  thickness_variation:
    min: 8.0
    max: 15.0
    mean: 12.0          # Grande variation
```

---

### Indice de Maturité (Spectral Ratio)

**Pour obtenir "Optimal" (ratio > 2.0)** :
- Augmenter intensité canal rouge (F8_680nm)
- Réduire intensité NIR

**Pour obtenir "Out of spec" (ratio < 1.0)** - Test alertes :
- Augmenter `oxidation_level` (réduit le ratio)

```yaml
defective:
  oxidation_level:
    min: 0.8
    max: 1.0
    mean: 0.9           # Très oxydé → ratio faible
```

---

### Score de Fraîcheur

**Pour obtenir score > 90 (Excellent)** :
- `freshness: min=0.90, max=1.0, mean=0.95`

**Pour obtenir score < 50 (Faible)** :
- `freshness: min=0.0, max=0.3, mean=0.15`

---

### Homogénéité Couleur (CV%)

**Pour obtenir "Excellent" (CV < 5%)** :
- Profils avec `surface_uniformity` élevée
- Faible `thickness_variation`

**Pour obtenir "Low" (CV > 20%)** :
- Profils avec `surface_uniformity` faible
- Forte `thickness_variation`

---

## 🧪 Configurations de Test Prédéfinies

### Configuration 1 : Production Parfaite

**Objectif** : Tester tous les KPIs au vert

```yaml
default_profile: "foiegras_premium_only"

profiles:
  foiegras_premium_only:
    # ... (copier foiegras_standard_barquette)
    quality:
      premium:
        weight: 1.0     # 100% premium
      good:
        weight: 0.0
      acceptable:
        weight: 0.0
      low:
        weight: 0.0
      defective:
        weight: 0.0
```

**Résultat attendu** :
- Conformité : 100%
- Cpk : > 1.5 (Capable)
- Fraîcheur : > 95/100
- Toutes les alertes : 0

---

### Configuration 2 : Production en Alerte

**Objectif** : Déclencher toutes les alertes possibles

```yaml
default_profile: "foiegras_defective_only"

profiles:
  foiegras_defective_only:
    # ... (copier foiegras_standard_barquette)
    quality:
      premium:
        weight: 0.0
      good:
        weight: 0.0
      acceptable:
        weight: 0.0
      low:
        weight: 0.3     # 30% C
      defective:
        weight: 0.7     # 70% REJECT
```

**Résultat attendu** :
- Conformité : 0%
- Cpk : < 0.8 (Incapable) ⚠️
- Fraîcheur : < 40/100 ⚠️
- Alertes multiples : Cpk, couleur, dimension, maturité, qualité

---

### Configuration 3 : Production Réaliste Mixte

**Objectif** : Répartition naturelle (déjà par défaut)

Utiliser `foiegras_standard_barquette` tel quel.

**Résultat attendu** :
- Conformité : 85-90%
- Cpk : 1.0-1.4 (Capable/Acceptable)
- Fraîcheur : 80-92/100
- Alertes occasionnelles

---

## 🔍 Vérifier les Données Générées

### Dans les Logs du Simulateur

```
INFO - Sample #42: Grade=A+, Quality=0.89, Thickness=50.1mm, DeltaE=1.8
INFO - Sample #43: Grade=A, Quality=0.78, Thickness=49.8mm, DeltaE=2.3
INFO - Sample #44: Grade=B, Quality=0.62, Thickness=51.2mm, DeltaE=4.1
INFO - Sample #45: Grade=REJECT, Quality=0.32, Thickness=45.3mm, DeltaE=9.2
```

**Vérifier** :
- Distribution des grades correspond aux poids configurés
- Valeurs de Quality/Thickness/DeltaE cohérentes

---

### Dans TimescaleDB

```sql
-- Distribution des grades (après 100 échantillons)
SELECT fusion_final_grade, COUNT(*), ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS percentage
FROM sensor_samples
GROUP BY fusion_final_grade
ORDER BY COUNT(*) DESC;
```

**Résultat attendu** (config par défaut) :
```
 fusion_final_grade | count | percentage
--------------------+-------+------------
 A                  |    40 |       40.0
 B                  |    30 |       30.0
 A+                 |    15 |       15.0
 C                  |    10 |       10.0
 REJECT             |     5 |        5.0
```

---

## 📝 Checklist de Configuration

- [ ] Profil YAML chargé : `default_profile` défini
- [ ] Poids des profils quality somment à 1.0 (100%)
- [ ] Dimensions produit cohérentes avec container
- [ ] Résolution capteur VL53L8CH : 8 ou 16
- [ ] AS7341 activé : `enabled: true`
- [ ] URL backend correcte : `ws://localhost:8000/ws/sensors/`
- [ ] Fréquence échantillonnage adaptée : 0.5-2.0 Hz

---

## 🚀 Recommandations

### Pour Tests Développement
```bash
python esp32_simulator.py --rate 0.5 --duration 600
# 0.5 Hz = 1 sample/2s
# 600s = 10 minutes
# Total: ~300 échantillons
```

### Pour Tests Intégration
```bash
python esp32_simulator.py --rate 1.0
# 1 Hz = 1 sample/s
# Durée illimitée (CTRL+C pour arrêter)
# ~3600 échantillons/heure
```

### Pour Tests de Charge
```bash
# Lancer 3 simulateurs en parallèle
python esp32_simulator.py --rate 2.0 --device-id ESP32-A &
python esp32_simulator.py --rate 2.0 --device-id ESP32-B &
python esp32_simulator.py --rate 2.0 --device-id ESP32-C &
# Total: 6 samples/s = 21600 échantillons/heure
```

---

**Fichiers de référence** :
- Configuration complète : `simulator/config_foiegras.yaml`
- Code simulateur : `simulator/esp32_simulator.py`
- Guide de test : `START_TESTING.md`
