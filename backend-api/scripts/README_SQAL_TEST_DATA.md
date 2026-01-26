# Génération de Données Test SQAL

**Date**: 12 Janvier 2026
**Objectif**: Générer des mesures SQAL réalistes pour tester l'endpoint `/api/lots/{id}/qualite`

---

## Description

Le script `generate_sqal_test_data.py` génère des mesures de capteurs IoT SQAL fictives mais réalistes pour les lots existants en base de données.

**Capteurs simulés**:
- **VL53L8CH** (Time-of-Flight 8×8) - Mesure 3D du foie
- **AS7341** (Spectral 10 canaux) - Analyse spectrale (fraîcheur, oxydation)

**Données générées**:
- Poids de foie calculé depuis volume 3D : `poids_g = (volume_mm³ / 1000) × 0.947`
- Grades qualité : A+ (30%), A (40%), B (20%), C (8%), REJECT (2%)
- Scores fusion : 60% VL53L8CH + 40% AS7341
- Indices spectraux : fraîcheur, qualité gras, oxydation
- Matrices ToF 8×8 (distance, reflectance, amplitude)

---

## Prérequis

### 1. Base de Données

**Migration requise** : Colonne `poids_foie_estime_g` doit exister

Vérifier :
```bash
psql -d gaveurs_db -c "\d sensor_samples" | grep poids_foie_estime_g
```

Si absent, appliquer migration :
```bash
alembic upgrade head
```

### 2. Lots Existants

Le script cherche des lots en statut `termine` ou `abattu`.

Vérifier :
```bash
psql -d gaveurs_db -c "SELECT id, code_lot, statut FROM lots WHERE statut IN ('termine', 'abattu') LIMIT 5;"
```

Si aucun lot, créer manuellement ou utiliser `generate_test_data.py`.

### 3. Python

Environnement virtuel avec `asyncpg` :
```bash
cd backend-api
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install asyncpg
```

---

## Utilisation

### Windows

**Méthode simple** (script batch) :
```cmd
cd backend-api
scripts\generate_sqal_data.bat
```

**Avec paramètres** :
```cmd
scripts\generate_sqal_data.bat --nb-lots 10 --samples-per-lot 50
```

### Linux/Mac

**Méthode Python directe** :
```bash
cd backend-api
source venv/bin/activate
python scripts/generate_sqal_test_data.py
```

**Avec paramètres** :
```bash
python scripts/generate_sqal_test_data.py --nb-lots 10 --samples-per-lot 50
```

---

## Paramètres

### --nb-lots N

Nombre de lots à traiter (défaut: 5)

```bash
python scripts/generate_sqal_test_data.py --nb-lots 10
```

Traite les 10 derniers lots en statut `termine` ou `abattu`.

### --samples-per-lot M

Nombre d'échantillons par lot (défaut: 30)

```bash
python scripts/generate_sqal_test_data.py --samples-per-lot 50
```

Génère 50 mesures SQAL par lot.

**Note**: Plus d'échantillons = statistiques plus précises, mais temps d'insertion plus long.

### Combinaison

```bash
python scripts/generate_sqal_test_data.py --nb-lots 3 --samples-per-lot 100
```

Génère 100 échantillons pour 3 lots = 300 mesures totales.

---

## Exemple de Sortie

```
================================================================================
GÉNÉRATION DONNÉES TEST SQAL
================================================================================

📊 5 lot(s) trouvé(s):
   - Lot 3468: LOT-2025-3468 (termine)
   - Lot 3467: LOT-2025-3467 (abattu)
   - Lot 122: LOT-2024-122 (termine)
   - Lot 121: LOT-2024-121 (abattu)
   - Lot 120: LOT-2024-120 (termine)

📱 Device ESP32_LL_01 créé

🔬 Génération 30 échantillons pour lot LOT-2025-3468...
   ✅ 30/30 échantillons insérés
   📊 Distribution grades: {'A': 12, 'A+': 9, 'B': 6, 'C': 2, 'REJECT': 1}

🔬 Génération 30 échantillons pour lot LOT-2025-3467...
   ✅ 30/30 échantillons insérés
   📊 Distribution grades: {'A': 11, 'A+': 10, 'B': 7, 'C': 2, 'REJECT': 0}

...

================================================================================
✅ GÉNÉRATION TERMINÉE
================================================================================
📊 Total échantillons insérés: 150
📦 Lots traités: 5
📱 Device: ESP32_LL_01

Test endpoint qualité:
   curl http://localhost:8000/api/lots/3468/qualite
   curl http://localhost:8000/api/lots/3467/qualite
   curl http://localhost:8000/api/lots/122/qualite
   curl http://localhost:8000/api/lots/121/qualite
   curl http://localhost:8000/api/lots/120/qualite
```

---

## Vérification des Données

### 1. Vérifier insertion

```sql
SELECT COUNT(*) as nb_total,
       COUNT(DISTINCT lot_id) as nb_lots,
       MIN(time) as premiere_mesure,
       MAX(time) as derniere_mesure
FROM sensor_samples
WHERE poids_foie_estime_g IS NOT NULL;
```

**Attendu** (après génération 5 lots × 30 samples) :
```
 nb_total | nb_lots | premiere_mesure      | derniere_mesure
----------+---------+----------------------+---------------------
      150 |       5 | 2026-01-10 08:30:00  | 2026-01-12 16:45:00
```

### 2. Vérifier distribution grades

```sql
SELECT fusion_final_grade,
       COUNT(*) as count,
       ROUND(AVG(fusion_final_score), 3) as avg_score,
       ROUND(AVG(poids_foie_estime_g), 1) as avg_poids_foie
FROM sensor_samples
WHERE poids_foie_estime_g IS NOT NULL
GROUP BY fusion_final_grade
ORDER BY fusion_final_grade;
```

**Attendu** :
```
 fusion_final_grade | count | avg_score | avg_poids_foie
--------------------+-------+-----------+----------------
 A+                 |    45 |     0.952 |          530.2
 A                  |    60 |     0.872 |          505.8
 B                  |    30 |     0.762 |          460.5
 C                  |    12 |     0.645 |          395.3
 REJECT             |     3 |     0.445 |          330.1
```

### 3. Vérifier données pour un lot

```sql
SELECT COUNT(*) as nb_samples,
       ROUND(AVG(poids_foie_estime_g), 1) as poids_foie_moyen,
       MODE() WITHIN GROUP (ORDER BY fusion_final_grade) as grade_majoritaire
FROM sensor_samples
WHERE lot_id = 3468
  AND poids_foie_estime_g IS NOT NULL;
```

**Attendu** :
```
 nb_samples | poids_foie_moyen | grade_majoritaire
------------+------------------+-------------------
         30 |            505.2 | A
```

---

## Test Endpoint Qualité

### 1. Lancer backend

```bash
cd backend-api
uvicorn app.main:app --reload --port 8000
```

### 2. Tester endpoint

**Sans données SQAL** (lot sans mesures) :
```bash
curl http://localhost:8000/api/lots/999/qualite
```

**Réponse** :
```json
{
  "lot_id": 999,
  "has_sqal_data": false,
  "message": "Aucune mesure de contrôle qualité SQAL pour ce lot",
  "nb_echantillons": 0,
  "poids_foie": null
}
```

**Avec données SQAL** (après génération) :
```bash
curl http://localhost:8000/api/lots/3468/qualite
```

**Réponse** :
```json
{
  "lot_id": 3468,
  "has_sqal_data": true,
  "nb_echantillons": 30,
  "poids_foie": {
    "moyen_g": 505.2,
    "min_g": 465.3,
    "max_g": 558.7,
    "ecart_type_g": 28.4
  },
  "volume": {
    "moyen_mm3": 533500,
    "hauteur_moyenne_mm": 82.5,
    "uniformite_surface": 0.872
  },
  "scores": {
    "moyen": 0.862,
    "min": 0.720,
    "max": 0.965
  },
  "grades": {
    "majoritaire": "A",
    "repartition": {
      "A+": 9,
      "A": 12,
      "B": 6,
      "C": 2,
      "REJECT": 1
    },
    "pourcent_a_plus_a": 70.0
  },
  "indices_spectraux": {
    "fraicheur": 0.892,
    "qualite_gras": 0.875,
    "oxydation": 0.082
  },
  "conformite": {
    "nb_conformes": 29,
    "pourcent_conformes": 96.7
  },
  "dates": {
    "premiere_mesure": "2026-01-10T14:22:15Z",
    "derniere_mesure": "2026-01-12T09:18:33Z"
  }
}
```

---

## Paramètres de Génération

### Distribution Grades

Configurable dans `GRADE_DISTRIBUTION` :
```python
GRADE_DISTRIBUTION = {
    'A+': 0.30,     # 30% grade A+
    'A': 0.40,      # 40% grade A
    'B': 0.20,      # 20% grade B
    'C': 0.08,      # 8% grade C
    'REJECT': 0.02  # 2% rejet
}
```

Distribution réaliste pour production de qualité (70% A+/A).

### Paramètres par Grade

Chaque grade a des plages de valeurs réalistes :

**Grade A+** (excellent) :
- Volume foie: 520-580 cm³ → Poids 492-549g
- Uniformité surface: 0.90-0.98
- Fraîcheur: 0.92-0.99
- Oxydation: 0.00-0.05 (très faible)
- Score fusion: 0.92-0.99

**Grade REJECT** (rejet) :
- Volume foie: 280-380 cm³ → Poids 265-360g
- Uniformité surface: 0.30-0.60
- Fraîcheur: 0.40-0.68
- Oxydation: 0.15-0.35 (élevée)
- Score fusion: 0.30-0.58

### Densité Foie Gras

Valeur scientifique utilisée :
```python
FOIE_DENSITY_G_CM3 = 0.947  # g/cm³
```

**Source** : Int. J. Food Properties (2016) - Thermal properties of duck foie gras

Formule :
```
poids_foie (g) = volume_foie (mm³) / 1000 × 0.947
```

Exemple :
- Volume = 533500 mm³ = 533.5 cm³
- Poids = 533.5 × 0.947 = 505.2 g

---

## Dépannage

### Erreur: "relation sensor_samples does not exist"

**Cause** : Schéma SQAL pas créé

**Solution** :
```bash
alembic upgrade head
```

### Erreur: "column poids_foie_estime_g does not exist"

**Cause** : Migration pas appliquée

**Solution** :
```bash
alembic upgrade head
```

### Erreur: "Aucun lot trouvé"

**Cause** : Pas de lots en statut `termine` ou `abattu`

**Solution** : Créer lots de test ou changer statut :
```sql
UPDATE lots SET statut = 'termine' WHERE id IN (122, 3468);
```

### Erreur: "asyncpg not found"

**Cause** : Package Python manquant

**Solution** :
```bash
pip install asyncpg
```

### Endpoint retourne "has_sqal_data": false

**Cause** : Données insérées mais `lot_id` NULL ou différent

**Vérification** :
```sql
SELECT lot_id, COUNT(*)
FROM sensor_samples
WHERE poids_foie_estime_g IS NOT NULL
GROUP BY lot_id;
```

---

## Nettoyage des Données

### Supprimer toutes les données SQAL test

```sql
TRUNCATE TABLE sensor_samples;
```

**Attention** : Supprime TOUTES les mesures SQAL (test et réelles).

### Supprimer données d'un lot spécifique

```sql
DELETE FROM sensor_samples WHERE lot_id = 3468;
```

### Supprimer device test

```sql
DELETE FROM sqal_devices WHERE device_id = 'ESP32_LL_01';
```

---

## Prochaines Étapes

Une fois les données générées et l'endpoint testé :

1. **Intégrer dans Network Graph** :
   - Ajouter variables qualité (grade, fraîcheur, oxydation)
   - Corrélations ITM ↔ qualité visibles

2. **Créer composant QualiteCard** :
   - Afficher grade, poids foie, scores
   - Dans page lot détail

3. **Page Analytics Qualité** :
   - Route `/analytics/qualite`
   - Graphiques ITM vs Grade
   - Distribution qualité par gaveur

---

**Auteur** : Claude Sonnet 4.5
**Date** : 12 Janvier 2026
