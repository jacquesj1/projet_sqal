# ✅ Solution Complète - Production avec SQAL

## 📅 Date : 2026-01-01

---

## 🎯 Problématique

### **Situation Actuelle (INCORRECTE)**

```sql
-- Formule actuelle
production_kg = SUM(total_corn_real × itm / 1000)
```

**Problèmes**:
1. ❌ Utilise ITM comme **input** pour calculer la production
2. ❌ ITM doit être fourni manuellement ou estimé
3. ❌ Logique inversée: ITM = f(production), pas production = f(ITM)
4. ❌ Pas de lien avec les mesures réelles SQAL

### **Situation Souhaitée (CORRECTE)**

```
1. SQAL mesure le volume ToF → convertit en masse
2. Production = somme des masses réelles
3. ITM = masse / maïs (dérivé automatiquement)
```

---

## 🔬 Données Scientifiques

### **Masse Volumique du Foie Gras**

**Source**: [Thermal properties of duck fatty liver (foie gras) products](https://www.tandfonline.com/doi/full/10.1080/10942912.2016.1171776)
*International Journal of Food Properties*, 2016

```
ρ (foie gras cru) = 947 kg/m³ = 0.947 g/cm³ à 20°C
```

### **Formule de Conversion**

```
masse_foie (g) = (volume_mm³ / 1000) × 0.947

Ou simplifié:
masse_foie (g) = volume_mm³ × 0.000947
```

---

## 🔧 Solution Technique Complète

### **1. Modification du Simulateur SQAL**

**Fichier**: `simulator-sqal/foiegras_fusion_simulator.py`

**Ajouter la méthode**:

```python
def _calculate_liver_weight_from_volume(self, volume_mm3: float) -> float:
    """
    Calcule le poids du foie à partir du volume ToF

    Masse volumique foie gras cru: 0.947 g/cm³ à 20°C
    Source: Int. J. Food Properties (2016)
    https://www.tandfonline.com/doi/full/10.1080/10942912.2016.1171776

    Args:
        volume_mm3: Volume mesuré par VL53L8CH (mm³)

    Returns:
        Poids du foie en grammes
    """
    # Constante scientifique
    FOIE_GRAS_DENSITY_G_CM3 = 0.947  # g/cm³ à 20°C

    # Conversion mm³ → cm³
    volume_cm3 = volume_mm3 / 1000

    # Calcul masse: m = ρ × V
    weight_g = volume_cm3 * FOIE_GRAS_DENSITY_G_CM3

    # Variabilité naturelle ±3%
    import random
    variability = random.gauss(1.0, 0.03)

    return round(weight_g * variability, 1)
```

**Modifier `_fuse_results()` pour ajouter le poids**:

```python
def _fuse_results(self, tof_analysis, spectral_analysis, tof_raw=None, ...):
    # ... code existant ...

    # NOUVEAU: Calcul du poids à partir du volume
    if tof_raw and 'stats' in tof_analysis:
        volume_mm3 = tof_analysis['stats'].get('volume_trapezoidal_mm3', 0)
        estimated_weight_g = self._calculate_liver_weight_from_volume(volume_mm3)
    else:
        estimated_weight_g = None

    return {
        "sample_id": sample_id,
        "final_grade": final_grade,
        "final_score": final_score,
        # ... autres champs ...
        "foie_gras_metrics": {
            # ... métriques existantes ...
            "estimated_weight_g": estimated_weight_g,  # ✅ NOUVEAU
        }
    }
```

---

### **2. Modification du Schéma Base de Données**

**Fichier**: `backend-api/scripts/sqal_timescaledb_schema.sql`

**Migration SQL**:

```sql
-- Ajouter la colonne poids estimé
ALTER TABLE sqal_sensor_samples
ADD COLUMN poids_foie_estime_g DECIMAL(6,2);

COMMENT ON COLUMN sqal_sensor_samples.poids_foie_estime_g IS
'Poids du foie calculé depuis volume ToF (g): masse = (volume_mm³ / 1000) × 0.947 g/cm³';

-- Index pour optimiser les requêtes de production
CREATE INDEX IF NOT EXISTS idx_sqal_samples_lot_poids
ON sqal_sensor_samples(lot_id, poids_foie_estime_g)
WHERE lot_id IS NOT NULL AND poids_foie_estime_g IS NOT NULL;
```

---

### **3. Modification du WebSocket Backend**

**Fichier**: `backend-api/app/routers/sqal.py` ou handler WebSocket

**Lors de la réception des données SQAL**:

```python
async def handle_sqal_sample(data: dict):
    """
    Traite un échantillon SQAL et stocke le poids calculé
    """
    # Extraire données fusion
    fusion = data.get('fusion_result', {})
    metrics = fusion.get('foie_gras_metrics', {})

    # Récupérer le poids estimé
    poids_foie_g = metrics.get('estimated_weight_g')

    # Stocker en base
    await db_pool.execute("""
        INSERT INTO sqal_sensor_samples (
            time,
            sample_id,
            device_id,
            lot_id,
            vl53l8ch_volume_mm3,
            poids_foie_estime_g,  -- ✅ NOUVEAU
            fusion_final_score,
            fusion_final_grade,
            ...
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ...)
    """,
        datetime.utcnow(),
        fusion['sample_id'],
        data['device_id'],
        data.get('lot_id'),
        data['vl53l8ch_raw']['stats']['volume_trapezoidal_mm3'],
        poids_foie_g,  -- ✅ NOUVEAU
        fusion['final_score'],
        fusion['final_grade'],
        ...
    )
```

---

### **4. Modification du Calcul de Production**

**Fichier**: `backend-api/app/routers/euralis.py`

**Remplacer la formule actuelle** (ligne 319-325):

```python
# ANCIENNE FORMULE (INCORRECTE)
stats = await conn.fetchrow("""
    SELECT
        SUM(
            CASE
                WHEN statut IN ('termine', 'abattu') AND total_corn_real IS NOT NULL AND itm IS NOT NULL
                THEN total_corn_real * itm / 1000
                ELSE 0
            END
        ) as production_totale_kg,
        ...
    FROM lots_gavage
""")
```

**Par la NOUVELLE FORMULE**:

```python
# NOUVELLE FORMULE (CORRECTE avec SQAL)
stats = await conn.fetchrow("""
    SELECT
        -- Production avec mesures SQAL (prioritaire)
        COALESCE(
            (
                SELECT SUM(s.poids_moyen_g * l2.nb_accroches) / 1000
                FROM lots_gavage l2
                JOIN (
                    SELECT
                        lot_id,
                        AVG(poids_foie_estime_g) as poids_moyen_g,
                        COUNT(*) as nb_mesures
                    FROM sqal_sensor_samples
                    WHERE poids_foie_estime_g IS NOT NULL
                    GROUP BY lot_id
                ) s ON l2.id = s.lot_id
                WHERE l2.statut IN ('termine', 'abattu')
            ),
            -- Fallback: estimation via ITM si pas de données SQAL
            SUM(
                CASE
                    WHEN statut IN ('termine', 'abattu')
                         AND total_corn_real IS NOT NULL
                         AND itm IS NOT NULL
                    THEN total_corn_real * itm / 1000
                    ELSE 0
                END
            )
        ) as production_totale_kg,

        COUNT(CASE WHEN statut = 'en_cours' THEN 1 END) as nb_lots_actifs,
        COUNT(CASE WHEN statut IN ('termine', 'abattu') THEN 1 END) as nb_lots_termines,
        COUNT(DISTINCT gaveur_id) as nb_gaveurs_actifs,
        AVG(NULLIF(itm, 0)) as itm_moyen_global,
        AVG(NULLIF(pctg_perte_gavage, 0)) as mortalite_moyenne_globale
    FROM lots_gavage
""")
```

---

### **5. Calcul ITM Automatique (Trigger)**

**Créer un trigger pour calculer ITM automatiquement**:

```sql
-- Fonction de calcul ITM depuis données SQAL
CREATE OR REPLACE FUNCTION calculate_itm_from_sqal()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer ITM moyen pour le lot
    UPDATE lots_gavage
    SET
        itm = (
            SELECT AVG(poids_foie_estime_g) / NULLIF((total_corn_real / nb_accroches), 0)
            FROM sqal_sensor_samples
            WHERE lot_id = NEW.lot_id
              AND poids_foie_estime_g IS NOT NULL
        ),
        updated_at = NOW()
    WHERE id = NEW.lot_id
      AND total_corn_real IS NOT NULL
      AND nb_accroches > 0;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur insertion SQAL
CREATE TRIGGER trigger_calculate_itm_from_sqal
AFTER INSERT OR UPDATE ON sqal_sensor_samples
FOR EACH ROW
WHEN (NEW.lot_id IS NOT NULL AND NEW.poids_foie_estime_g IS NOT NULL)
EXECUTE FUNCTION calculate_itm_from_sqal();

COMMENT ON TRIGGER trigger_calculate_itm_from_sqal ON sqal_sensor_samples IS
'Recalcule automatiquement ITM du lot quand nouvelles mesures SQAL arrivent';
```

---

## 📊 Exemple Complet Lot LS2512001

### **1. Données Gavage**

```
Code lot: LS2512001
Canards: 239
Maïs total: 1,623,288 g
Maïs par canard: 6,792 g
Statut: abattu
```

### **2. Mesures SQAL (239 échantillons)**

```json
[
  {
    "sample_id": "FG-LS2512001-001",
    "lot_id": 45,
    "volume_mm3": 678500,
    "poids_foie_estime_g": 642.5
  },
  {
    "sample_id": "FG-LS2512001-002",
    "lot_id": 45,
    "volume_mm3": 670800,
    "poids_foie_estime_g": 635.3
  },
  ...
  {
    "sample_id": "FG-LS2512001-239",
    "lot_id": 45,
    "volume_mm3": 683200,
    "poids_foie_estime_g": 646.9
  }
]
```

### **3. Calcul Production**

```sql
SELECT
    lot_id,
    COUNT(*) as nb_mesures_sqal,
    AVG(poids_foie_estime_g) as poids_moyen_g,
    l.nb_accroches,
    (AVG(poids_foie_estime_g) * l.nb_accroches / 1000) as production_kg
FROM sqal_sensor_samples s
JOIN lots_gavage l ON s.lot_id = l.id
WHERE l.code_lot = 'LS2512001'
GROUP BY lot_id, l.nb_accroches;
```

**Résultat**:
```
lot_id: 45
nb_mesures_sqal: 239
poids_moyen_g: 642.0
nb_accroches: 239
production_kg: 153.4 ✅
```

### **4. Calcul ITM Automatique**

```sql
UPDATE lots_gavage
SET itm = (
    SELECT AVG(poids_foie_estime_g) / (total_corn_real / nb_accroches)
    FROM sqal_sensor_samples
    WHERE lot_id = 45
)
WHERE id = 45;
```

**Résultat**:
```
itm = 642.0 / 6792 = 0.0945 ✅
```

**Affichage dashboard**: `94.5 g/kg` ✅

---

## 🔄 Flux Complet de Données

```
┌──────────────────┐
│   1. GAVAGE      │  Gaveur enregistre maïs consommé
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  2. ABATTAGE     │  Lot passe statut = 'abattu'
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  3. SQAL MESURE  │  Pour chaque canard:
│   (VL53L8CH)     │  - Volume ToF: 678,500 mm³
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ 4. CONVERSION    │  Masse = (V / 1000) × 0.947
│  VOLUME → MASSE  │  Masse = 642.5 g ✅
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ 5. STOCKAGE DB   │  INSERT sqal_sensor_samples:
│  TimescaleDB     │  - lot_id = 45
└────────┬─────────┘  - volume_mm3 = 678500
         │            - poids_foie_estime_g = 642.5 ✅
         │
         v
┌──────────────────┐
│ 6. TRIGGER AUTO  │  UPDATE lots_gavage:
│   CALCUL ITM     │  - itm = 642.0 / 6792 = 0.0945 ✅
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ 7. API DASHBOARD │  GET /api/euralis/dashboard/kpis
│                  │  - production_totale_kg: 153.4 ✅
└────────┬─────────┘  - itm_moyen_global: 0.08 (80 g/kg) ✅
         │
         v
┌──────────────────┐
│ 8. AFFICHAGE     │  Dashboard affiche:
│   UTILISATEUR    │  - Production: 153.4 kg ✅
└──────────────────┘  - ITM: 80 g/kg ✅
```

---

## ✅ Avantages de la Solution

### **1. Précision Scientifique**
- ✅ Basée sur densité mesurée en laboratoire (0.947 g/cm³)
- ✅ Pas d'estimation ou de coefficients empiriques

### **2. Logique Correcte**
- ✅ Production = somme des masses **mesurées**
- ✅ ITM = indicateur **dérivé** automatiquement
- ✅ Flux logique: mesure physique → calcul → indicateurs

### **3. Traçabilité Complète**
- ✅ Chaque foie identifié (sample_id)
- ✅ Volume et masse stockés
- ✅ Lien lot ↔ mesures SQAL

### **4. Temps Réel**
- ✅ Calcul instantané lors de la mesure
- ✅ Trigger met à jour ITM automatiquement
- ✅ Dashboard toujours à jour

### **5. Compatibilité Ascendante**
- ✅ Fallback sur ITM si pas de données SQAL
- ✅ Pas de rupture pour lots anciens
- ✅ Migration progressive possible

---

## 📝 Scripts de Migration

### **Script 1: Ajouter Colonne**

```sql
-- Fichier: backend-api/scripts/migration_add_poids_foie.sql

BEGIN;

-- Ajouter colonne
ALTER TABLE sqal_sensor_samples
ADD COLUMN IF NOT EXISTS poids_foie_estime_g DECIMAL(6,2);

-- Commentaire
COMMENT ON COLUMN sqal_sensor_samples.poids_foie_estime_g IS
'Poids du foie calculé depuis volume ToF (g): masse = (volume_mm³ / 1000) × 0.947 g/cm³';

-- Index
CREATE INDEX IF NOT EXISTS idx_sqal_samples_lot_poids
ON sqal_sensor_samples(lot_id, poids_foie_estime_g)
WHERE lot_id IS NOT NULL AND poids_foie_estime_g IS NOT NULL;

-- Recalculer poids pour données existantes
UPDATE sqal_sensor_samples
SET poids_foie_estime_g = (vl53l8ch_volume_mm3 / 1000.0) * 0.947
WHERE vl53l8ch_volume_mm3 IS NOT NULL
  AND poids_foie_estime_g IS NULL;

COMMIT;
```

### **Script 2: Créer Trigger ITM**

```sql
-- Fichier: backend-api/scripts/migration_create_itm_trigger.sql

BEGIN;

-- Fonction
CREATE OR REPLACE FUNCTION calculate_itm_from_sqal()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE lots_gavage
    SET
        itm = (
            SELECT AVG(poids_foie_estime_g) / NULLIF((total_corn_real / nb_accroches), 0)
            FROM sqal_sensor_samples
            WHERE lot_id = NEW.lot_id
              AND poids_foie_estime_g IS NOT NULL
        ),
        updated_at = NOW()
    WHERE id = NEW.lot_id
      AND total_corn_real IS NOT NULL
      AND nb_accroches > 0;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER trigger_calculate_itm_from_sqal
AFTER INSERT OR UPDATE ON sqal_sensor_samples
FOR EACH ROW
WHEN (NEW.lot_id IS NOT NULL AND NEW.poids_foie_estime_g IS NOT NULL)
EXECUTE FUNCTION calculate_itm_from_sqal();

COMMIT;
```

### **Script 3: Recalculer ITM Lots Existants**

```sql
-- Fichier: backend-api/scripts/migration_recalculate_itm.sql

-- Recalculer ITM pour tous les lots ayant des mesures SQAL
UPDATE lots_gavage l
SET
    itm = s.itm_calcule,
    updated_at = NOW()
FROM (
    SELECT
        lot_id,
        AVG(poids_foie_estime_g) / (
            SELECT (total_corn_real / nb_accroches)
            FROM lots_gavage
            WHERE id = sqal_sensor_samples.lot_id
        ) as itm_calcule
    FROM sqal_sensor_samples
    WHERE poids_foie_estime_g IS NOT NULL
      AND lot_id IS NOT NULL
    GROUP BY lot_id
) s
WHERE l.id = s.lot_id
  AND l.total_corn_real IS NOT NULL
  AND l.nb_accroches > 0;
```

---

## 🧪 Tests de Validation

### **Test 1: Vérifier Conversion Volume → Masse**

```sql
-- Vérifier cohérence avec ITM existant
SELECT
    l.code_lot,
    l.nb_accroches,
    l.itm as itm_actuel,
    l.total_corn_real / l.nb_accroches as mais_par_canard,
    AVG(s.poids_foie_estime_g) as poids_sqal_moyen,
    AVG(s.poids_foie_estime_g) / (l.total_corn_real / l.nb_accroches) as itm_sqal,
    ABS(l.itm - (AVG(s.poids_foie_estime_g) / (l.total_corn_real / l.nb_accroches))) as ecart_itm
FROM lots_gavage l
JOIN sqal_sensor_samples s ON l.id = s.lot_id
WHERE l.statut IN ('termine', 'abattu')
  AND s.poids_foie_estime_g IS NOT NULL
GROUP BY l.id, l.code_lot, l.nb_accroches, l.itm, l.total_corn_real
ORDER BY ecart_itm DESC;
```

**Résultat attendu**: `ecart_itm < 0.005` (cohérence > 95%)

### **Test 2: Production Totale**

```sql
-- Comparer production via ITM vs SQAL
SELECT
    'Via ITM' as methode,
    SUM(total_corn_real * itm / 1000) as production_kg
FROM lots_gavage
WHERE statut IN ('termine', 'abattu')

UNION ALL

SELECT
    'Via SQAL' as methode,
    SUM(s.poids_moyen_g * l.nb_accroches / 1000) as production_kg
FROM lots_gavage l
JOIN (
    SELECT lot_id, AVG(poids_foie_estime_g) as poids_moyen_g
    FROM sqal_sensor_samples
    WHERE poids_foie_estime_g IS NOT NULL
    GROUP BY lot_id
) s ON l.id = s.lot_id
WHERE l.statut IN ('termine', 'abattu');
```

**Résultat attendu**:
```
methode   | production_kg
----------|---------------
Via ITM   | 1070.9
Via SQAL  | 1070.5
```

Écart < 1% ✅

---

## 📚 Références Scientifiques

**Source principale**:
- [Thermal properties of duck fatty liver (foie gras) products](https://www.tandfonline.com/doi/full/10.1080/10942912.2016.1171776)
  *International Journal of Food Properties*, 2016
  **Densité foie gras cru: 947 kg/m³ = 0.947 g/cm³ à 20°C**

**Sources complémentaires**:
- [FAO/INFOODS Density Database](https://www.fao.org/4/ap815e/ap815e.pdf)
- [Aqua-Calc Food Density Reference](https://www.aqua-calc.com/calculate/food-volume-to-weight)

---

## ✅ Checklist d'Implémentation

### **Phase 1: Simulateur**
- [ ] Ajouter méthode `_calculate_liver_weight_from_volume()` dans `foiegras_fusion_simulator.py`
- [ ] Modifier `_fuse_results()` pour inclure `estimated_weight_g`
- [ ] Tester calcul volume → masse avec données réelles

### **Phase 2: Base de Données**
- [ ] Exécuter migration: ajouter colonne `poids_foie_estime_g`
- [ ] Créer index sur `(lot_id, poids_foie_estime_g)`
- [ ] Recalculer poids pour données SQAL existantes

### **Phase 3: Backend**
- [ ] Modifier WebSocket handler pour stocker `poids_foie_estime_g`
- [ ] Créer trigger `calculate_itm_from_sqal()`
- [ ] Modifier formule production dans `/api/euralis/dashboard/kpis`

### **Phase 4: Tests**
- [ ] Test 1: Vérifier cohérence ITM actuel vs SQAL
- [ ] Test 2: Comparer production via ITM vs SQAL
- [ ] Test 3: Vérifier trigger ITM auto-update

### **Phase 5: Documentation**
- [x] Document formule masse (FORMULE_MASSE_FOIE_SQAL.md)
- [x] Document données SQAL (SQAL_SIMULATOR_DATA_COMPLETE.md)
- [x] Document solution complète (ce fichier)

---

**Date**: 2026-01-01
**Statut**: ✅ Solution complète documentée
**Priorité**: 🔴 Haute (impact production)
**Formule clé**: `masse_foie_g = volume_mm³ × 0.000947`
