# Analyse des Sources de Données - Qualité et ITM

**Date**: 12 Janvier 2026
**Contexte**: Clarification des variables du Network Graph et sources des données de contrôle qualité

---

## Votre Observation Correcte

Vous avez parfaitement raison :

> "je pense que le poid n'est pas le poid de foie mais d canard quand il débute son gavage (si c'est une donnée gavage) donc pas de lien avec ITM"

**Confirmé** : Les champs `poids_moyen_initial`, `poids_moyen_actuel`, `poids_moyen_final` dans la table `lots` représentent le **poids du canard entier** (4-7 kg), **PAS le poids du foie** (400-800g).

---

## Sources des Données Actuelles

### 1. Données de Gavage (CSV Euralis)

**Fichier**: `backend-api/data/2023/Pretraite_End_2024_claude.csv`

**Colonnes disponibles** (174 au total):

#### A. Doses quotidiennes (27 jours max)
```
feedTarget_1 à feedTarget_27  → Dose théorique jour 1 à 27 (grammes)
feedCornReal_1 à feedCornReal_27 → Dose réelle jour 1 à 27 (grammes)
```

#### B. Analyses des écarts
```
corn_variation_1 à corn_variation_27  → % écart dose réelle vs théorique
cumulCorn_1 à cumulCorn_27           → Cumul dose depuis début gavage
delta_feed_1 à delta_feed_27         → Différence dose théorique vs réelle (g)
```

#### C. Métriques globales
```
total_cornTarget    → Dose totale théorique (grammes)
total_cornReal      → Dose totale réelle (grammes)
duree_gavage        → Durée du gavage (jours)
ITM                 → Indice de Transformation Maïs (DÉJÀ CALCULÉ!)
ITM_cut             → ITM catégorisé
Sigma               → Écart-type (variabilité)
Sigma_cut           → Sigma catégorisé
dPctgPerteGav       → Pourcentage de perte au gavage (mortalité)
```

#### D. Informations du lot
```
CodeLot                        → Code unique du lot (ex: LL4801665)
Gaveur                         → Nom du gaveur (ex: "RENAULT Isabelle")
Eleveur                        → Nom de l'éleveur
Souche                         → Race/génétique (ex: "CF80* - M15 V2E SFM")
Quantite_accrochee             → Nombre de canards
Age_des_animaux                → Âge au début du gavage
Code_plan_alimentation         → Plan alimentaire utilisé
GEO, saison, ProdIgpFR         → Contexte production
```

#### E. Informations contacts
```
Civilite, RaisonSociale, NomUsage
Adresse1, Adresse2, CodePostal, Commune
Telephone1, Email
```

**Total**: 174 colonnes

**Données MANQUANTES** dans ce CSV:
- ❌ Poids de foie moyen (poids_foie_moyen)
- ❌ Poids de foie min/max
- ❌ Taux de fonte à la cuisson
- ❌ Classement qualité (A+, A, B, C, D)
- ❌ Poids du canard (début, final)

---

### 2. Données de Contrôle Qualité (SQAL - Capteurs IoT)

**Table**: `sqal_sensor_samples` (hypertable TimescaleDB)

**Capteurs utilisés**:
1. **VL53L8CH** (Time-of-Flight) - Mesure 3D du foie
2. **AS7341** (Spectral) - Analyse spectrale 10 canaux

#### A. Mesures VL53L8CH (ToF)

**Données brutes**:
```sql
vl53l8ch_distance_matrix    → Matrice 8×8 distances (64 pixels)
vl53l8ch_reflectance_matrix → Matrice 8×8 réflectance
vl53l8ch_amplitude_matrix   → Matrice 8×8 amplitude signal
vl53l8ch_integration_time   → Temps d'intégration (ms)
vl53l8ch_temperature_c      → Température capteur
```

**Analyses calculées**:
```sql
vl53l8ch_volume_mm3         → Volume 3D calculé (mm³)
vl53l8ch_avg_height_mm      → Hauteur moyenne (mm)
vl53l8ch_max_height_mm      → Hauteur max (mm)
vl53l8ch_min_height_mm      → Hauteur min (mm)
vl53l8ch_surface_uniformity → Uniformité surface (0.0-1.0)
vl53l8ch_quality_score      → Score qualité VL53L8CH (0.0-1.0)
vl53l8ch_grade              → Grade VL53L8CH (A+, A, B, C, REJECT)
vl53l8ch_defects            → Défauts détectés (JSONB)
```

#### B. Mesures AS7341 (Spectral)

**Données brutes**:
```sql
as7341_channels             → 10 canaux spectraux (415nm à NIR)
                               {F1_415nm, F2_445nm, F3_480nm, F4_515nm,
                                F5_555nm, F6_590nm, F7_630nm, F8_680nm,
                                Clear, NIR}
as7341_integration_time     → Temps d'intégration (ms)
as7341_gain                 → Gain capteur
```

**Analyses calculées**:
```sql
as7341_freshness_index      → Indice fraîcheur (0.0-1.0)
as7341_fat_quality_index    → Indice qualité gras (0.0-1.0)
as7341_oxidation_index      → Indice oxydation (0.0-1.0, 0 = aucune)
as7341_quality_score        → Score qualité AS7341 (0.0-1.0)
as7341_grade                → Grade AS7341 (A+, A, B, C, REJECT)
as7341_spectral_analysis    → Ratios spectraux détaillés (JSONB)
as7341_color_analysis       → Analyse couleur RGB, HSV (JSONB)
```

#### C. Fusion des Capteurs

**Scores combinés**:
```sql
fusion_final_score          → Score final (0.0-1.0) = 60% VL + 40% AS7341
fusion_final_grade          → Grade final (A+, A, B, C, REJECT)
fusion_vl53l8ch_score       → Contribution VL53L8CH (60%)
fusion_as7341_score         → Contribution AS7341 (40%)
fusion_defects              → Défauts combinés (JSONB)
fusion_is_compliant         → Conformité normes (boolean)
```

#### D. Métadonnées
```sql
lot_id                      → Lien avec lot de gavage (optionnel)
device_id                   → Capteur utilisé (ESP32_LL_01, etc.)
time                        → Timestamp mesure
meta_firmware_version       → Version firmware
meta_temperature_c          → Température ambiante
meta_humidity_percent       → Humidité ambiante
```

**Total**: ~40 colonnes de données qualité

---

## Le Problème de l'ITM dans le Network Graph

### Formule Correcte de l'ITM

Vous avez parfaitement raison :

> "l'ITM devrait être en lien avec la dose totale poids final. En effet puisque c'est le poids de foie moyen sur la quantité de maïs ingérée lors du gavage."

**Formule correcte** :
```
ITM = Poids de foie moyen (g) / Dose totale de maïs (kg)
```

**Interprétation** :
- ITM = 16.62 → Il faut 16.62 kg de maïs pour produire 1 kg de foie
- ITM < 18 → Excellente conversion (efficace)
- ITM 18-22 → Bonne conversion
- ITM > 22 → Conversion faible (beaucoup de maïs pour peu de foie)

### Ce que fait actuellement le Network Graph (INCORRECT)

**Ligne 102-107 de NetworkGraphCorrelations.tsx** :
```typescript
// ESTIMATION - PAS DE DONNÉES RÉELLES!
const poidsFoie = lot.poids_foie_moyen || (poidsFinal * 0.10);

// ITM calculé avec ESTIMATION
const itm = lot.itm || (doseTotale > 0 ? poidsFoie / (doseTotale / 1000) : 50);
```

**Problème** :
1. `poidsFinal` = poids du **canard entier** (5000-7000g), pas du foie
2. Estimation 10% = 500-700g de foie (approximatif)
3. Si `lot.itm` est `null`, on utilise l'estimation fausse

### Ce que contient le CSV (CORRECT)

**Ligne 2 du CSV** :
```csv
LL4801665;8400;8420;11;RENAULT Isabelle;1016;CF80* - M15 V2E SFM;0.0078125;16.62;0.148469863
         ↑     ↑    ↑                                                         ↑    ↑
         |     |    |                                                         |    |
         |     |    duree_gavage (11 jours)                                   |    Sigma
         |     total_cornReal (8420g = 8.42kg)                                ITM (16.62)
         total_cornTarget (8400g)
```

**L'ITM réel existe déjà** : `16.62` !

**Mais** : Le poids de foie qui a servi à ce calcul n'est **PAS** dans le CSV.

---

## Gap Analysis - Ce qui Manque

### Dans la Table `lots` (frontend types/lot.ts)

**Champs actuels liés au poids** :
```typescript
poids_moyen_initial?: number;  // Poids CANARD début (4000-5000g)
poids_moyen_actuel?: number;   // Poids CANARD actuel (5000-6000g)
poids_moyen_final?: number;    // Poids CANARD final (6000-7000g)
```

**Champs MANQUANTS** :
```typescript
// ❌ NON DISPONIBLES
poids_foie_moyen?: number;     // Poids foie moyen (400-800g)
poids_foie_min?: number;       // Poids foie minimum
poids_foie_max?: number;       // Poids foie maximum
poids_foie_ecart_type?: number; // Écart-type poids foie

taux_fonte?: number;           // Taux de fonte à cuisson (%)
classement_qualite?: string;   // A+, A, B, C, D
note_fraicheur?: number;       // 0.0-1.0
note_oxydation?: number;       // 0.0-1.0
```

**Champs QUI EXISTENT** :
```typescript
itm?: number | null;           // ✅ Existe (vient du CSV)
sigma?: number | null;         // ✅ Existe (vient du CSV)
pctg_perte_gavage?: number;    // ✅ Existe (= dPctgPerteGav du CSV)
```

---

## Où Sont les Données de Poids de Foie ?

### Hypothèse 1 : Données SQAL Non Liées aux Lots CSV

**Situation actuelle** :
- CSV Euralis 2024 : Contient ITM déjà calculé (16.62, 19.03, etc.)
- Table SQAL : Contient mesures capteurs avec `lot_id` optionnel
- **Pas de lien** entre les lots du CSV et les mesures SQAL

**Lien manquant** :
```sql
-- Table sqal_sensor_samples
lot_id INTEGER REFERENCES lots_gavage(id)  -- ← Optionnel, souvent NULL
```

**Conséquence** :
- Les mesures ToF (volume, hauteur) existent dans SQAL
- Mais on ne sait pas **quel lot CSV** correspond à **quelle mesure SQAL**
- Impossible de corréler ITM ↔ qualité capteurs

### Hypothèse 2 : Poids de Foie Mesuré Manuellement (Non Numérisé)

**Scénario probable** :
1. Gaveur gave les canards (doses enregistrées → CSV)
2. Canards abattus → pesée manuelle des foies
3. ITM calculé : `poids_foie_moyen / dose_totale`
4. ITM enregistré dans CSV (16.62)
5. **Mais** poids_foie_moyen **PAS** enregistré numériquement

**Support** :
- CSV a colonne `ITM` remplie
- CSV n'a **AUCUNE** colonne `poids_foie`
- Schéma table `lots` n'a pas de champ `poids_foie_moyen`

### Hypothèse 3 : Données Qualité dans Autre Source

**Possibilités** :
- Base de données abattoir (externe)
- Système SQAL (capteurs post-abattage)
- Fichiers Excel manuels (non intégrés)

---

## Impact sur le Network Graph

### Variables Actuelles (13)

**Basées sur données DISPONIBLES** :
1. `age_debut` → CSV: `Age_des_animaux`
2. `poids_debut` → `lots.poids_moyen_initial` (CANARD)
3. `poids_final` → `lots.poids_moyen_final` (CANARD)
4. `gain_poids` → `poids_final - poids_debut` (CANARD)
5. `poids_foie` → **ESTIMATION 10%** (FAUX)
6. `dose_moyenne` → CSV: moyenne des `feedCornReal_X`
7. `dose_totale` → CSV: `total_cornReal`
8. `dose_min` → CSV: min des `feedCornReal_X`
9. `dose_max` → CSV: max des `feedCornReal_X`
10. `ecart_moyen` → CSV: moyenne des `corn_variation_X`
11. `nombre_canards` → CSV: `Quantite_accrochee`
12. `duree_gavage` → CSV: `duree_gavage`
13. `itm` → CSV: `ITM` (✅ RÉEL)

### Corrélations Attendues (Problématiques)

**Corrélation dose ↔ poids** :
- ❌ `dose_totale ↔ poids_foie` (FAUX car poids_foie = estimation)
- ✅ `dose_totale ↔ gain_poids_canard` (OK mais pas très pertinent)
- ✅ `dose_totale ↔ itm` (OK car ITM réel du CSV)

**Corrélation ITM ↔ poids** :
- ❌ `itm ↔ poids_foie` (FAUX car poids_foie = estimation)
- ❌ `itm ↔ gain_poids_canard` (PAS DE SENS - ITM concerne le foie)

**Seules corrélations VALIDES actuellement** :
- ✅ `dose_totale ↔ itm` (plus de maïs = ITM dégradé généralement)
- ✅ `dose_totale ↔ gain_poids_canard`
- ✅ `dose_moyenne ↔ dose_totale`
- ✅ `duree_gavage ↔ dose_totale`
- ✅ `ecart_moyen ↔ sigma` (variabilité)

---

## Solutions Possibles

### Solution 1 : Retirer `poids_foie` du Graph (Rapide)

**Action** :
- Retirer variable `poids_foie` du Network Graph
- Garder seulement les 12 autres variables
- Expliquer dans l'interface : "Poids de foie non disponible - ITM utilisé comme proxy"

**Avantage** :
- Honnêteté : pas d'estimation fausse
- Graph reste fonctionnel

**Inconvénient** :
- Perd une variable potentiellement intéressante

### Solution 2 : Calculer Poids Foie depuis ITM (Estimation)

**Formule inverse** :
```typescript
// Depuis ITM = poids_foie / (dose_totale / 1000)
const poidsFoieEstime = itm * (doseTotale / 1000);
```

**Exemple** :
```
ITM = 16.62
dose_totale = 8420g = 8.42 kg
poids_foie_estime = 16.62 × 8.42 = 139.9g  ← FAUX!
```

**Problème** : ITM devrait donner ~500-700g, pas 140g → **Formule ITM différente ?**

**Hypothèse correction** :
```
ITM = (dose_totale / 1000) / (poids_foie / 1000)
    = dose_totale_kg / poids_foie_kg

Donc: poids_foie_kg = dose_totale_kg / ITM
      poids_foie_g = (dose_totale_g / 1000) / ITM × 1000
                   = dose_totale_g / ITM

Exemple:
poids_foie = 8420 / 16.62 = 506.6g  ← PLAUSIBLE!
```

**Action** :
```typescript
// NetworkGraphCorrelations.tsx ligne 102-107
const itm = lot.itm || 16.5; // Valeur moyenne si manquante
const poidsFoie = lot.poids_foie_moyen || (doseTotale / itm);
```

### Solution 3 : Intégrer Données SQAL (Moyen Terme)

**Action** :
1. Lier `sqal_sensor_samples.lot_id` aux lots du CSV
2. Ajouter endpoint `/api/lots/{id}/qualite` :
   ```json
   {
     "lot_id": 3468,
     "poids_foie_moyen": 520.5,
     "poids_foie_min": 480.2,
     "poids_foie_max": 580.1,
     "volume_mm3": 450000,
     "grade_final": "A",
     "score_qualite": 0.92,
     "taux_fonte": 18.5,
     "note_fraicheur": 0.95,
     "note_oxydation": 0.05
   }
   ```
3. Ajouter champs qualité à `types/lot.ts`
4. Mettre à jour Network Graph avec données réelles

**Avantage** :
- Données réelles de capteurs
- Corrélations ITM ↔ qualité visibles

**Inconvénient** :
- Nécessite import données SQAL
- Backend à développer

### Solution 4 : Import Données Poids Foie Manuelles (Long Terme)

**Action** :
1. Demander fichiers Excel/CSV abattoir avec poids foies
2. Créer script d'import `scripts/import_poids_foies.py`
3. Ajouter colonne `poids_foie_moyen` à table `lots`
4. Corréler par `code_lot` (ex: LL4801665)
5. Mettre à jour Network Graph

**Avantage** :
- Données historiques réelles
- Corrélations précises

**Inconvénient** :
- Nécessite source de données externe
- Peut ne pas exister numériquement

---

## Recommandation Immédiate

### Option A : Corriger Estimation Poids Foie (2 minutes)

**Fichier** : `gaveurs-frontend/components/analytics/NetworkGraphCorrelations.tsx`

**Changement ligne 102-107** :
```typescript
// AVANT (FAUX)
const poidsFoie = lot.poids_foie_moyen || (poidsFinal * 0.10);

// APRÈS (MEILLEUR)
const itm = lot.itm || 16.5; // Valeur moyenne si manquante
const poidsFoie = lot.poids_foie_moyen || (doseTotale / itm); // Calcul inverse ITM
```

**Justification** :
- Formule `poids_foie = dose_totale / ITM` donne ~500g (plausible)
- Formule précédente `poids_final × 0.10` donnait ~600g (trop haut)
- Si `lot.itm` existe (vient du CSV), estimation cohérente

### Option B : Retirer Variable Poids Foie (5 minutes)

**Fichier** : `gaveurs-frontend/components/analytics/NetworkGraphCorrelations.tsx`

**Changements** :
1. Ligne 66 : Retirer `poids_foie: []` des variables
2. Ligne 104-105 : Supprimer calcul poids_foie
3. Ligne 107 : ITM calculé avec `dose_totale` uniquement
4. Ligne 207 : Retirer `'poids_foie'` de la catégorisation
5. Ligne 195 : Retirer label `poids_foie: 'Poids foie'`

**Résultat** : 12 variables au lieu de 13, mais **toutes valides**

---

## Conclusion

### Ce que nous savons maintenant :

1. **CSV Euralis** :
   - ✅ Contient doses théoriques/réelles par jour
   - ✅ Contient ITM déjà calculé (16.62, 19.03, etc.)
   - ✅ Contient Sigma, durée, nombre canards
   - ❌ Ne contient PAS le poids de foie

2. **Table `lots` (backend)** :
   - ✅ Contient poids canard (initial, actuel, final)
   - ✅ Contient ITM, Sigma (importés du CSV)
   - ❌ Ne contient PAS poids_foie_moyen

3. **Table `sqal_sensor_samples`** :
   - ✅ Contient mesures qualité détaillées (ToF, spectral)
   - ✅ Contient volumes, grades, scores
   - ⚠️ Lien `lot_id` optionnel (souvent NULL)
   - ❌ Pas de corrélation directe avec lots CSV

4. **Network Graph actuel** :
   - ✅ ITM est réel (vient du CSV)
   - ❌ Poids foie est estimé (10% poids canard) - FAUX
   - ⚠️ Corrélations dose ↔ poids_foie sont trompeuses

### Actions recommandées :

**Immédiat** (aujourd'hui) :
- [ ] Corriger formule poids_foie : `doseTotale / itm` au lieu de `poidsFinal × 0.10`
- [ ] OU retirer variable poids_foie du graph

**Court terme** (cette semaine) :
- [ ] Documenter que poids_foie est estimé (ajouter tooltip)
- [ ] Vérifier si données poids foie existent dans fichiers Excel abattoir

**Moyen terme** (prochaine sprint) :
- [ ] Intégrer données SQAL avec liaison `lot_id`
- [ ] Créer endpoint `/api/lots/{id}/qualite`
- [ ] Ajouter variables qualité au Network Graph

**Long terme** :
- [ ] Import données abattoir (poids foies réels)
- [ ] Boucle fermée complète : gavage → qualité → feedback consommateur

---

**Status** : 📊 ANALYSE COMPLÈTE
**Auteur** : Claude Sonnet 4.5
**Date** : 12 Janvier 2026
