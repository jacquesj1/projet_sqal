# 📡 Simulateur SQAL - Données Fournies Exhaustivement

## 📅 Date : 2026-01-01

---

## 🎯 Vue d'Ensemble

Le **simulateur SQAL** (`simulator-sqal/`) émule un dispositif ESP32 équipé de **2 capteurs I2C** pour le contrôle qualité du foie gras:

1. **VL53L8CH** (Time-of-Flight) - Capteur de distance 3D
2. **AS7341** (Spectral) - Capteur spectral couleur 10 canaux

---

## 📊 Architecture du Simulateur

```
ESP32_Simulator
├── I2C_Bus_Simulator
│   ├── VL53L8CH (ToF)
│   └── AS7341 (Spectral)
├── VL53L8CH_DataAnalyzer
├── AS7341_DataAnalyzer
└── FoieGrasFusionSimulator
    ├── ToFDimensionalAnalyzer (métriques métier)
    ├── SpectralColorAnalyzer (métriques métier)
    └── DefectDetector (détection défauts)
```

---

## 🔬 Données VL53L8CH (Time-of-Flight)

### **Données Brutes**

Le capteur VL53L8CH fournit des **matrices 8×8** (64 pixels):

```json
{
  "distance_matrix": [[d11, d12, ..., d18], ..., [d81, ..., d88]],  // mm
  "reflectance_matrix": [[r11, r12, ..., r18], ..., [r81, ..., r88]],
  "amplitude_matrix": [[a11, a12, ..., a18], ..., [a81, ..., a88]],
  "integration_time": 100,  // ms
  "temperature_c": 22.5
}
```

### **Analyses Calculées**

```json
{
  "volume_mm3": 285463.2,
  "avg_height_mm": 48.5,
  "max_height_mm": 52.3,
  "min_height_mm": 45.1,
  "surface_uniformity": 0.92,  // 0.0-1.0
  "quality_score": 0.85,       // 0.0-1.0
  "grade": "A",                // A+, A, B, C, REJECT
  "defects": [
    {"type": "surface_irregularity", "severity": 0.3}
  ]
}
```

### **Métriques Métier Foie Gras (ToF)**

```json
{
  "lobe_thickness_mm": 48.5,
  "thickness_std_mm": 2.3,
  "thickness_category": "premier_choix",  // extra, premier_choix, deuxieme_choix
  "is_irregular_lobe": false,
  "estimated_volume_cm3": 285.5,
  "fill_level_mm": 48.5,
  "fill_level_percent": 97.0,
  "fill_conformity": true,
  "fill_deviation_mm": -1.5,
  "dimensional_conformity_score": 0.92
}
```

### **Capacité Processus (Cp/Cpk)**

Si ≥10 échantillons historiques:

```json
{
  "process_cp": 1.8,
  "process_cpk": 1.6,
  "process_capability": "capable",  // capable, marginal, incapable
  "process_mean": 48.3,
  "process_std": 1.1,
  "is_centered": true
}
```

---

## 🌈 Données AS7341 (Spectral)

### **Données Brutes**

Le capteur AS7341 fournit **10 canaux spectraux**:

```json
{
  "channels": {
    "F1_415nm": 2345,    // Violet
    "F2_445nm": 3120,    // Indigo
    "F3_480nm": 4890,    // Bleu
    "F4_515nm": 7234,    // Cyan
    "F5_555nm": 9876,    // Vert
    "F6_590nm": 8432,    // Jaune
    "F7_630nm": 6543,    // Orange
    "F8_680nm": 4321,    // Rouge
    "Clear": 45678,      // Lumière totale
    "NIR": 3456          // Proche infrarouge
  },
  "integration_time": 100,  // ms
  "gain": 8
}
```

### **Analyses Calculées**

```json
{
  "freshness_index": 0.95,      // 0.0-1.0
  "fat_quality_index": 0.88,    // 0.0-1.0
  "oxidation_index": 0.05,      // 0.0-1.0 (0 = pas d'oxydation)
  "quality_score": 0.90,        // 0.0-1.0
  "grade": "A+",
  "defects": []
}
```

### **Métriques Métier Foie Gras (Spectral)**

```json
{
  "l_star": 68.5,           // Luminosité CIE L*a*b*
  "a_star": 8.2,            // Composante rouge/vert
  "b_star": 22.3,           // Composante jaune/bleu
  "delta_e": 3.2,           // Écart couleur vs référence
  "reference_id": "cru_extra",
  "color_score_premium": 0.92,
  "has_hematoma": false,
  "hematoma_severity": 0.0,
  "has_bile_traces": false,
  "bile_severity": 0.0,
  "has_oxidation": false,
  "oxidation_severity": 0.05
}
```

---

## 🔀 Fusion Multi-Capteurs

Le simulateur **combine** les données ToF + Spectral:

```json
{
  "sample_id": "FG-A3B2C1D4",
  "final_grade": "A",
  "final_score": 0.87,         // Fusion pondérée 60% ToF + 40% Spectral
  "tof_score": 0.85,
  "spectral_score": 0.90,
  "tof_contribution": 0.60,
  "spectral_contribution": 0.40,
  "num_defects": 0,
  "combined_defects": [],
  "fusion_mode": "ToF + Spectral",
  "foie_gras_metrics": {
    // Toutes les métriques métier combinées (cf sections précédentes)
    "dimensional_conformity_percent": 92.0,
    "color_conformity_percent": 92.0,
    "global_quality_score_100": 87.0,
    "defect_rate_percent": 0.0,
    "has_critical_color_deviation": false,
    "has_underfill": false,
    "has_oxidation_trend": false,
    "is_compliant": true,
    "is_downgraded": false,
    "is_rejected": false
  }
}
```

---

## ⚠️ **PROBLÈME IDENTIFIÉ PAR L'UTILISATEUR**

### **❌ Ce que le simulateur NE fournit PAS actuellement**

Le simulateur **ne fournit PAS de poids de foie réel en grammes** (`poids_foie_g`).

### **❌ Schéma Base de Données**

La table `sqal_sensor_samples` **ne contient PAS** de colonne `poids_foie_g`:

```sql
-- Colonnes existantes:
vl53l8ch_volume_mm3           -- Volume en mm³
vl53l8ch_avg_height_mm        -- Hauteur moyenne
as7341_freshness_index        -- Indices qualité
fusion_final_score            -- Score fusion

-- MANQUANT:
-- poids_foie_g DECIMAL(6,2)  -- ❌ N'existe pas!
```

### **❌ Impact sur le Calcul de Production**

**Problème actuel**:
```sql
-- Formule actuelle (INCORRECTE):
production_totale_kg = SUM(total_corn_real * itm / 1000)
```

Cette formule utilise **ITM comme input** pour estimer la production, alors que:
- ITM = **poids_foie / maïs_total** (c'est un ratio dérivé)
- ITM devrait être **calculé A POSTERIORI** une fois qu'on connaît le poids réel du foie

**Ce qui devrait se passer**:
```
1. SQAL mesure le foie → poids_foie_reel (grammes)
2. Backend calcule ITM = poids_foie_reel / total_corn_real
3. Production = SUM(poids_foie_reel) / 1000 (kg)
```

---

## ✅ Solution Recommandée

### **1. Ajouter Poids Foie au Simulateur**

**Fichier**: `simulator-sqal/foiegras_fusion_simulator.py`

Le simulateur pourrait calculer le **poids estimé** à partir du volume ToF:

```python
def _calculate_liver_weight_from_volume(self, volume_mm3: float) -> float:
    """
    Calcule le poids du foie à partir du volume ToF

    Masse volumique foie gras cru: 0.947 g/cm³ à 20°C
    Source: Int. J. Food Properties (2016) - Thermal properties of duck foie gras
    https://www.tandfonline.com/doi/full/10.1080/10942912.2016.1171776

    Args:
        volume_mm3: Volume mesuré par VL53L8CH (mm³)

    Returns:
        Poids du foie en grammes
    """
    # Conversion mm³ → cm³
    volume_cm3 = volume_mm3 / 1000

    # Masse volumique foie gras de canard (donnée scientifique)
    FOIE_GRAS_DENSITY_G_CM3 = 0.947  # g/cm³ à 20°C

    # Calcul masse: m = ρ × V
    weight_g = volume_cm3 * FOIE_GRAS_DENSITY_G_CM3

    # Ajustement variabilité naturelle (±3% pour tenir compte des variations individuelles)
    import random
    variability = random.gauss(1.0, 0.03)
    return weight_g * variability
```

**Ajout dans fusion_result**:
```python
# Dans la fonction _fuse_results()
estimated_weight_g = self._calculate_liver_weight_from_volume(
    tof_analysis['stats']['volume_trapezoidal_mm3']
)

return {
    ...
    "foie_gras_metrics": {
        ...
        "estimated_weight_g": round(estimated_weight_g, 1),  # ✅ NOUVEAU
    }
}
```

### **2. Ajouter Colonne en Base de Données**

**Fichier**: `backend-api/scripts/sqal_timescaledb_schema.sql`

```sql
ALTER TABLE sqal_sensor_samples
ADD COLUMN poids_foie_estime_g DECIMAL(6,2);

COMMENT ON COLUMN sqal_sensor_samples.poids_foie_estime_g
IS 'Poids estimé du foie à partir du volume ToF (g)';
```

### **3. Lier SQAL aux Lots Gavage**

**Table `sqal_sensor_samples` a déjà** la colonne:
```sql
lot_id INTEGER REFERENCES lots_gavage(id)
```

Il faut:
1. Le simulateur envoie `lot_id` lors de la mesure
2. Backend stocke `poids_foie_estime_g` dans `sqal_sensor_samples`
3. Calculer la moyenne par lot:

```sql
-- Moyenne des poids de foie mesurés par SQAL pour un lot
SELECT
    lot_id,
    AVG(poids_foie_estime_g) as poids_foie_moyen_g,
    COUNT(*) as nb_mesures_sqal
FROM sqal_sensor_samples
WHERE lot_id = $1
GROUP BY lot_id;
```

### **4. Corriger le Calcul de Production**

**Fichier**: `backend-api/app/routers/euralis.py`

```sql
-- NOUVELLE FORMULE (avec données SQAL):
SELECT
    SUM(
        CASE
            WHEN statut IN ('termine', 'abattu')
            THEN (
                -- Si données SQAL disponibles, utiliser poids réel
                SELECT AVG(poids_foie_estime_g) * l.nb_accroches / 1000
                FROM sqal_sensor_samples
                WHERE lot_id = l.id
            )
            -- Sinon fallback sur estimation ITM
            ELSE (total_corn_real * itm / 1000)
        END
    ) as production_totale_kg
FROM lots_gavage l
WHERE statut IN ('termine', 'abattu');
```

Ou plus simplement, si **toutes les mesures passent par SQAL**:

```sql
-- Production = somme directe des poids réels mesurés
SELECT
    SUM(s.poids_foie_estime_g * l.nb_accroches) / 1000 as production_totale_kg
FROM lots_gavage l
JOIN (
    SELECT
        lot_id,
        AVG(poids_foie_estime_g) as poids_foie_moyen_g
    FROM sqal_sensor_samples
    WHERE lot_id IS NOT NULL
    GROUP BY lot_id
) s ON l.id = s.lot_id
WHERE l.statut IN ('termine', 'abattu');
```

### **5. Recalculer ITM A POSTERIORI**

Une fois qu'on a le poids réel:

```sql
-- ITM devient un indicateur dérivé
UPDATE lots_gavage
SET itm = (
    SELECT AVG(poids_foie_estime_g) / (total_corn_real / nb_accroches)
    FROM sqal_sensor_samples
    WHERE lot_id = lots_gavage.id
)
WHERE statut IN ('termine', 'abattu')
  AND total_corn_real IS NOT NULL;
```

---

## 📐 Formule Mathématique Correcte

### **Avec SQAL (recommandé)**

```
1. SQAL mesure chaque canard :
   - Volume ToF (mm³)
   - Couleur spectrale (10 canaux)

2. Calculer poids estimé :
   poids_foie_g = (volume_mm³ / 1000) × densité_g/cm³

3. Stocker dans sqal_sensor_samples :
   INSERT INTO sqal_sensor_samples (
       lot_id, poids_foie_estime_g, ...
   ) VALUES (...);

4. Production totale :
   production_kg = Σ(poids_foie_canard) / 1000

5. ITM dérivé :
   itm = poids_foie_moyen / mais_total_par_canard
```

### **Sans SQAL (fallback actuel)**

```
1. Estimer à partir de l'ITM :
   production_kg = (total_corn_real × itm) / 1000

2. Problème : ITM doit être fourni manuellement ou estimé
```

---

## 🔄 Flux de Données Recommandé

```
┌─────────────┐
│   GAVAGE    │  Enregistre : maïs consommé (total_corn_real)
└──────┬──────┘
       │
       v
┌─────────────┐
│  ABATTAGE   │  Canards abattus → statut = 'abattu'
└──────┬──────┘
       │
       v
┌─────────────┐
│ SQAL ToF +  │  Mesure chaque foie :
│  Spectral   │  - Volume (mm³) → poids estimé (g)
└──────┬──────┘  - Couleur, qualité, défauts
       │
       v
┌─────────────┐
│  DATABASE   │  Stocke sqal_sensor_samples :
│ TimescaleDB │  - lot_id
└──────┬──────┘  - poids_foie_estime_g ✅
       │         - quality_score, grade, etc.
       │
       v
┌─────────────┐
│ CALCUL ITM  │  itm = poids_foie_moyen / mais_total
└──────┬──────┘
       │
       v
┌─────────────┐
│ DASHBOARD   │  Affiche :
│  EURALIS    │  - Production réelle (kg)
└─────────────┘  - ITM dérivé (g/kg)
```

---

## 📊 Exemple Concret

### **Lot LS2512001**

**Données Gavage**:
- 239 canards
- Maïs total: 1,623,288g
- Maïs par canard: 6,792g

**Mesures SQAL** (239 mesures):

Exemple de conversion Volume → Masse:
```
Volume mesuré = 678,500 mm³
Volume en cm³ = 678,500 / 1000 = 678.5 cm³
Masse volumique = 0.947 g/cm³
Masse foie = 678.5 × 0.947 = 642.5 g ✅
```

```json
[
  {"sample_id": "FG-001", "volume_mm3": 678500, "poids_foie_estime_g": 642.5},
  {"sample_id": "FG-002", "volume_mm3": 670800, "poids_foie_estime_g": 635.3},
  ...
  {"sample_id": "FG-239", "volume_mm3": 683200, "poids_foie_estime_g": 646.9}
]
```

**Calcul Production**:
```sql
SELECT
    AVG(poids_foie_estime_g) as poids_moyen_g,
    SUM(poids_foie_estime_g) / 1000 as production_kg,
    AVG(poids_foie_estime_g) / 6792 as itm_calcule
FROM sqal_sensor_samples
WHERE lot_id = (SELECT id FROM lots_gavage WHERE code_lot = 'LS2512001');
```

**Résultat**:
```
poids_moyen_g: 642.0
production_kg: 153.4
itm_calcule: 0.0945  (94.5 g/kg)
```

✅ **ITM est maintenant une conséquence** du poids réel, pas un input!

---

## 📝 Résumé Final

### **Ce que le simulateur SQAL fournit ACTUELLEMENT**

✅ Volume 3D (mm³)
✅ Matrices ToF 8×8
✅ 10 canaux spectraux
✅ Indices qualité (freshness, oxidation, etc.)
✅ Grades (A+, A, B, C, REJECT)
✅ Défauts (hématomes, bile, oxydation)
✅ Métriques métier (épaisseur, couleur L*a*b*, Delta E)

### **Ce que le simulateur SQAL devrait fournir**

❌ **Poids du foie en grammes** (`poids_foie_estime_g`)
❌ **Lien systématique avec lot_id**

### **Impact sur le Calcul de Production**

📌 **Actuellement**: Production estimée à partir de `ITM × maïs_total`
📌 **Recommandé**: Production = somme directe des `poids_foie_reel` mesurés par SQAL
📌 **ITM**: Devient un indicateur dérivé calculé **APRÈS** la mesure

---

## 🚀 Actions Recommandées

1. ✅ Ajouter fonction `_calculate_liver_weight_from_volume()` dans `foiegras_fusion_simulator.py`
2. ✅ Ajouter colonne `poids_foie_estime_g` dans `sqal_sensor_samples`
3. ✅ Modifier simulateur pour envoyer `lot_id` et `poids_foie_estime_g`
4. ✅ Corriger formule de production dans `backend-api/app/routers/euralis.py`
5. ✅ Recalculer ITM comme métrique dérivée

---

**Date**: 2026-01-01
**Statut**: ⚠️ Modification architecturale recommandée
**Priorité**: Haute (impacte la cohérence des données de production)
