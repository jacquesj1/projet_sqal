# Import Données CSV Réelles

**Date**: 12 Janvier 2026
**Objectif**: Importer les 74 lots réels depuis le CSV Euralis vers la base de données

---

## Description

Le script `import_csv_real_data.py` importe les données de production réelles depuis le fichier CSV `data/2023/Pretraite_End_2024_claude.csv`.

**Données importées**:
- **74 lots** avec métadonnées complètes
- **Historiques de gavage jour par jour** (doses réelles vs théoriques)
- **ITM réels** calculés depuis production terrain
- **Informations gaveurs** (nom, site, souche)

**Tables remplies**:
- `lots` - Métadonnées des 74 lots
- `gaveurs` - Gaveurs extraits du CSV (créés si manquants)
- `gavage_lot_quotidien` - Historique jour par jour (11-27 jours × 74 lots ≈ 1200+ enregistrements)

---

## Prérequis

### 1. Fichier CSV

Vérifier présence du fichier:
```bash
ls backend-api/data/2023/Pretraite_End_2024_claude.csv
```

**Contenu attendu**: 74 lignes + header, 174 colonnes

### 2. Base de Données

Tables `lots`, `gaveurs`, `gavage_lot_quotidien` doivent exister.

Vérifier:
```bash
psql -d gaveurs_db -c "\d lots"
psql -d gaveurs_db -c "\d gaveurs"
psql -d gaveurs_db -c "\d gavage_lot_quotidien"
```

### 3. Python

Environnement virtuel avec `asyncpg`:
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

**Preview (dry-run - aucune insertion)**:
```cmd
cd backend-api
scripts\import_csv_data.bat --dry-run
```

**Import réel**:
```cmd
scripts\import_csv_data.bat
```

### Linux/Mac

**Preview**:
```bash
cd backend-api
source venv/bin/activate
python scripts/import_csv_real_data.py --dry-run
```

**Import réel**:
```bash
python scripts/import_csv_real_data.py
```

---

## Exemple de Sortie

### Dry-Run
```
================================================================================
IMPORT DONNÉES RÉELLES CSV → BASE DE DONNÉES
================================================================================

⚠️  MODE DRY-RUN: Aucune insertion en base

📂 Fichier CSV: backend-api/data/2023/Pretraite_End_2024_claude.csv
🔌 Connexion DB: SKIP (dry-run)

📋 Lecture CSV...
   74 lots trouvés

[1/74] Traitement lot LL4801665...
✅ [DRY-RUN] Lot LL4801665:
   - Date: 2024-01-05 → 2024-01-16 (11j)
   - Canards: 1016 | Souche: mulard | Site: Bretagne
   - Gaveur: RENAULT Isabelle (ID: 1)
   - ITM: 16.62 | Sigma: 0.148469863 | Dose totale: 8420g
   J1 (2024-01-05): 198g (théo: 200g)
   J2 (2024-01-06): 220g (théo: 220g)
   J3 (2024-01-07): 240g (théo: 240g)

[2/74] Traitement lot LL4801763...
✅ [DRY-RUN] Lot LL4801763:
   - Date: 2024-01-06 → 2024-01-17 (11j)
   - Canards: 1445 | Souche: mulard | Site: Bretagne
   - Gaveur: PORS LAN (ID: 2)
   - ITM: 19.03 | Sigma: 0 | Dose totale: 7994g
   J1 (2024-01-06): 202g (théo: 200g)
   J2 (2024-01-07): 225g (théo: 220g)
   J3 (2024-01-08): 249g (théo: 240g)

...

================================================================================
RÉSUMÉ IMPORT
================================================================================
✅ Lots importés: 74
⚠️  Lots skippés: 0

💡 Pour importer réellement, relancer sans --dry-run
```

### Import Réel
```
================================================================================
IMPORT DONNÉES RÉELLES CSV → BASE DE DONNÉES
================================================================================

📂 Fichier CSV: backend-api/data/2023/Pretraite_End_2024_claude.csv
🔌 Connexion DB: OK

📋 Lecture CSV...
   74 lots trouvés

[1/74] Traitement lot LL4801665...
✅ Lot LL4801665 créé (ID: 123)
   📊 11 jours de gavage insérés

[2/74] Traitement lot LL4801763...
✅ Lot LL4801763 créé (ID: 124)
   📊 11 jours de gavage insérés

...

================================================================================
RÉSUMÉ IMPORT
================================================================================
✅ Lots importés: 74
⚠️  Lots skippés: 0

🎉 Import terminé avec succès!

Prochaine étape:
   python scripts/generate_sqal_test_data.py --nb-lots 74 --samples-per-lot 30
```

---

## Vérification Post-Import

### 1. Compter les lots
```sql
SELECT COUNT(*) as nb_lots,
       COUNT(DISTINCT gaveur_id) as nb_gaveurs,
       MIN(date_debut_gavage) as premiere_date,
       MAX(date_debut_gavage) as derniere_date
FROM lots
WHERE code_lot LIKE 'LL%';
```

**Attendu**:
```
 nb_lots | nb_gaveurs | premiere_date | derniere_date
---------+------------+---------------+---------------
      74 |         ~30 | 2024-01-05    | 2024-01-31
```

### 2. Vérifier historiques gavage
```sql
SELECT COUNT(*) as nb_enregistrements,
       COUNT(DISTINCT lot_id) as nb_lots,
       MIN(date_gavage) as premiere_date,
       MAX(date_gavage) as derniere_date
FROM gavage_lot_quotidien glq
INNER JOIN lots l ON glq.lot_id = l.id
WHERE l.code_lot LIKE 'LL%';
```

**Attendu**:
```
 nb_enregistrements | nb_lots | premiere_date | derniere_date
--------------------+---------+---------------+---------------
              ~1200 |      74 | 2024-01-05    | 2024-02-15
```

### 3. Vérifier ITM réels
```sql
SELECT code_lot, itm, sigma, nombre_canards, souche, gaveur_id
FROM lots
WHERE code_lot IN ('LL4801665', 'LL4801763')
ORDER BY code_lot;
```

**Attendu**:
```
 code_lot   |  itm  |    sigma     | nombre_canards | souche | gaveur_id
------------+-------+--------------+----------------+--------+-----------
 LL4801665  | 16.62 | 0.148469863  |           1016 | mulard |       123
 LL4801763  | 19.03 | 0.000000000  |           1445 | mulard |       124
```

### 4. Tester endpoint API
```bash
curl http://localhost:8000/api/lots?limit=5

# Vérifier qu'on a bien des lots LL*
# {"id": 123, "code_lot": "LL4801665", "itm": 16.62, ...}
```

---

## Mapping CSV → Base de Données

### Colonnes Lot

| CSV                     | Base (lots)           | Transformation                          |
|-------------------------|-----------------------|-----------------------------------------|
| Code_lot                | code_lot              | Direct                                  |
| Gaveur                  | gaveur_id             | Créer gaveur si absent → FK             |
| GEO                     | site_origine          | BRETAGNE → Bretagne                     |
| Souche                  | souche                | "CF80* - M15 V2E SFM" → mulard          |
| Quantite_accrochee      | nombre_canards        | Direct                                  |
| Debut_du_lot            | date_debut_gavage     | Parse DD/MM/YYYY                        |
| duree_gavage            | duree_gavage_prevue   | Direct                                  |
| ITM                     | itm                   | Decimal                                 |
| Sigma                   | sigma                 | Decimal                                 |
| total_cornReal          | (pas stocké au niveau lot) | Utilisé pour historique     |

### Colonnes Gavage Quotidien

| CSV                     | Base (gavage_lot_quotidien) | Transformation                  |
|-------------------------|-----------------------------|---------------------------------|
| feedCornReal_1..27      | dose_totale_jour_g          | Par jour (1-27)                 |
| feedTarget_1..27        | dose_theorique_g            | Par jour (1-27)                 |
| Debut_du_lot + jour     | date_gavage                 | date_debut + timedelta(jour-1)  |
| (calculé)               | dose_matin_g                | dose_totale * 0.5               |
| (calculé)               | dose_soir_g                 | dose_totale * 0.5               |
| (calculé)               | ecart_dose_pct              | (réel - théo) / théo * 100      |

---

## Gestion des Doublons

Le script gère les doublons intelligemment:

- **Lots**: Skip si `code_lot` existe déjà
- **Gaveurs**: Réutilise ID existant si `nom` existe
- **Gavage quotidien**: `ON CONFLICT (lot_id, date_gavage) DO NOTHING`

Vous pouvez relancer le script sans risque - il ignorera les lots déjà importés.

---

## Suppression des Données Importées

### Supprimer tous les lots importés (ATTENTION: IRREVERSIBLE)
```sql
-- Sauvegarder les IDs avant suppression
SELECT id, code_lot FROM lots WHERE code_lot LIKE 'LL%';

-- Supprimer (cascade supprimera gavage_lot_quotidien aussi)
DELETE FROM lots WHERE code_lot LIKE 'LL%';
```

### Supprimer seulement l'historique gavage
```sql
DELETE FROM gavage_lot_quotidien
WHERE lot_id IN (SELECT id FROM lots WHERE code_lot LIKE 'LL%');
```

---

## Prochaines Étapes

Après import réussi:

1. **Générer données SQAL** sur ces lots:
   ```bash
   python scripts/generate_sqal_test_data.py --nb-lots 74 --samples-per-lot 30
   ```

2. **Tester Network Graph** avec données réelles:
   ```
   http://localhost:3000/analytics
   ```
   → Les 13 variables de production auront des données authentiques

3. **Tester Analytics Qualité**:
   ```
   http://localhost:3000/analytics/qualite
   ```
   → Corrélations ITM réel (16.62, 19.03) ↔ Grades SQAL

4. **Préparer démo client** avec lots réels:
   - Lot LL4801665: Isabelle RENAULT, ITM 16.62 (excellent)
   - Lot LL4801763: PORS LAN, ITM 19.03 (bon)

---

**Auteur**: Claude Sonnet 4.5
**Date**: 12 Janvier 2026
