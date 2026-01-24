# Étapes d'Import CSV - Lots Réels Euralis

**Date**: 12 Janvier 2026
**Objectif**: Importer 75 lots réels depuis CSV Euralis + générer données SQAL

---

## Résumé des Changements

### 1. Network Graph - 20 Variables ✅ TERMINÉ

Le Network Graph de corrélations a été étendu de 16 à **20 variables** :

**Nouvelles variables CSV ajoutées** :
- `poids_foie_reel` - Poids foie réel (Poids_de_foies_moyen)
- `total_corn` - Dose totale maïs (total_cornReal)
- `nb_morts` - Mortalité gavage (Nb_MEG)
- `sigma` - Homogénéité lot (Ecart_Type_Foie_Lot)

**Fichier modifié** : [gaveurs-frontend/components/analytics/NetworkGraphCorrelations.tsx](gaveurs-frontend/components/analytics/NetworkGraphCorrelations.tsx)

**Changements** :
- ✅ Ajout des 4 variables dans `variables` object (lignes 80-84)
- ✅ Population des variables avec données CSV réelles (lignes 135-139)
- ✅ Labels français ajoutés (lignes 266-269)
- ✅ Catégorisation : 3 variables dans catégorie 'csv', sigma dans 'performance'
- ✅ Couleur orange (#f97316) pour catégorie CSV
- ✅ Force de répulsion augmentée de -1200 à -1400 pour 20 nœuds

---

## 2. Migration Base de Données - Colonnes CSV ⏳ EN ATTENTE

### Option A : Via Endpoint API (Recommandé)

**Prérequis** : Redémarrer le backend pour charger le nouvel endpoint

1. **Arrêter le backend** (Ctrl+C dans le terminal backend)

2. **Redémarrer le backend** :
   ```bash
   cd backend-api
   python -m uvicorn app.main:app --reload --port 8000
   ```

3. **Exécuter la migration** :
   ```bash
   curl -X POST "http://localhost:8000/api/lots/migrate/csv-columns" -H "Content-Type: application/json"
   ```

**Résultat attendu** :
```json
{
  "status": "success",
  "message": "Migration CSV columns completed",
  "columns": [
    {"column_name": "nb_meg", "data_type": "integer", "column_default": "0"},
    {"column_name": "poids_foie_moyen_g", "data_type": "numeric", "column_default": null},
    {"column_name": "total_corn_real_g", "data_type": "numeric", "column_default": null}
  ]
}
```

### Option B : Via pgAdmin / SQL

Si l'option A ne fonctionne pas :

1. Ouvrir **pgAdmin**
2. Se connecter à `gaveurs_db`
3. Ouvrir **Query Tool**
4. Exécuter le fichier : [backend-api/scripts/migration_add_csv_columns.sql](backend-api/scripts/migration_add_csv_columns.sql)

**Colonnes ajoutées** :
- `total_corn_real_g` DECIMAL(10,2) - Quantité totale de maïs ingérée
- `nb_meg` INTEGER DEFAULT 0 - Mortalité en gavage
- `poids_foie_moyen_g` DECIMAL(8,2) - Poids moyen des foies

---

## 3. Import CSV - 75 Lots Réels ⏳ PRÊT À EXÉCUTER

### Scripts Créés

1. **Script Python** : [backend-api/scripts/import_csv_real_data.py](backend-api/scripts/import_csv_real_data.py) (373 lignes)
2. **Script Windows** : [backend-api/scripts/import_csv_data.bat](backend-api/scripts/import_csv_data.bat)
3. **Documentation** : [backend-api/scripts/README_IMPORT_CSV.md](backend-api/scripts/README_IMPORT_CSV.md)

### Fichier Source

- **CSV** : [backend-api/data/2023/Pretraite_End_2024_claude.csv](backend-api/data/2023/Pretraite_End_2024_claude.csv)
- **Contenu** : 75 lots réels + 174 colonnes
- **Période** : Janvier - Février 2024

### Exécution (Windows)

**Dry-run** (prévisualisation sans insertion) :
```cmd
cd backend-api
scripts\import_csv_data.bat --dry-run
```

**Import réel** :
```cmd
scripts\import_csv_data.bat
```

### Exécution (Linux/Mac)

```bash
cd backend-api
source venv/bin/activate
python scripts/import_csv_real_data.py --dry-run  # Prévisualisation
python scripts/import_csv_real_data.py             # Import réel
```

### Résultats Attendus

- **74-75 lots** importés dans table `lots_gavage`
- **~1200 enregistrements** dans table `gavage_lot_quotidien` (historique jour par jour)
- **~30 gaveurs** créés/réutilisés dans table `gaveurs`

**Vérification SQL** :
```sql
-- Compter les lots importés
SELECT COUNT(*) as nb_lots,
       COUNT(DISTINCT gaveur_id) as nb_gaveurs,
       MIN(date_debut_gavage) as premiere_date,
       MAX(date_debut_gavage) as derniere_date
FROM lots
WHERE code_lot LIKE 'LL%';

-- Attendu: 74-75 lots, ~30 gaveurs, dates: 2024-01-05 à 2024-01-31
```

---

## 4. Génération SQAL - Lots CSV ⏳ PRÊT À EXÉCUTER

### Scripts Créés

1. **Script modifié** : [backend-api/scripts/generate_sqal_test_data.py](backend-api/scripts/generate_sqal_test_data.py)
   - Ajout de l'argument `--filter-csv`
   - Filtre SQL : `code_lot LIKE 'LL%'`

2. **Script Windows** : [backend-api/scripts/generate_sqal_on_imported_lots.bat](backend-api/scripts/generate_sqal_on_imported_lots.bat)

### Exécution (Windows)

```cmd
cd backend-api
scripts\generate_sqal_on_imported_lots.bat
```

### Exécution (Ligne de commande)

```bash
cd backend-api
python scripts/generate_sqal_test_data.py --nb-lots 75 --samples-per-lot 30 --filter-csv
```

**Paramètres** :
- `--nb-lots 75` : Générer SQAL pour 75 lots max
- `--samples-per-lot 30` : 30 échantillons ToF par lot
- `--filter-csv` : Cibler uniquement les lots CSV (code_lot LIKE 'LL%')

**Résultats attendus** :
- **75 lots** avec données SQAL dans `sqal_sample_lots`
- **~2250 échantillons** ToF 8x8 dans `sqal_sensor_samples`
- **Grades qualité** calculés (A+, A, B, C, REJECT)

---

## 5. Vérification Network Graph 🎯 OBJECTIF

Une fois les étapes 2, 3 et 4 terminées :

### Accéder à la page Analytics Qualité

```
http://localhost:3000/analytics/qualite
```

### Vérifications Attendues

1. **20 nœuds** dans le graphe de réseau (au lieu de 16)
2. **Nouvelles variables CSV visibles** :
   - Poids foie réel
   - Dose totale maïs
   - Mortalité gavage
   - Homogénéité lot
3. **Corrélations calculées** entre les 20 variables
4. **Couleur orange** pour les variables CSV
5. **Données réelles** depuis les 75 lots importés

### Corrélations Intéressantes à Observer

- **ITM ↔ Poids foie réel** : Forte corrélation attendue
- **Dose totale maïs ↔ Poids foie** : Positive
- **Mortalité gavage ↔ ITM** : Négative (plus de morts = ITM moins bon)
- **Homogénéité lot (sigma) ↔ Qualité** : Faible sigma = meilleure qualité

---

## 6. Documentation Démo Client ⏳ À PRÉPARER

À créer après vérification des étapes 1-5 :

- **Scénarios de démo** avec lots réels (LL4801665, LL4801763...)
- **Captures d'écran** du Network Graph 20 variables
- **Analyse des corrélations** entre production et qualité
- **Guide utilisateur** pour interpréter le graphe

---

## État Actuel

| Étape | Statut | Fichiers |
|-------|--------|----------|
| 1. Network Graph 20 variables | ✅ TERMINÉ | NetworkGraphCorrelations.tsx |
| 2. Migration DB colonnes CSV | ⏳ EN ATTENTE REDÉMARRAGE BACKEND | lots.py (endpoint POST /migrate/csv-columns) |
| 3. Import CSV 75 lots | ⏳ PRÊT | import_csv_real_data.py, import_csv_data.bat |
| 4. SQAL sur lots CSV | ⏳ PRÊT | generate_sqal_test_data.py --filter-csv |
| 5. Vérification Network | 🎯 OBJECTIF | http://localhost:3000/analytics/qualite |
| 6. Documentation démo | ⏳ À FAIRE | À créer |

---

## Problèmes Rencontrés

### 1. Connexion PostgreSQL depuis Python (Windows)

**Erreur** : `'utf-8' codec can't decode byte 0xe9 in position 103`

**Cause** : Problème d'encodage avec psycopg2 sur Windows + URL contenant caractères spéciaux dans le mot de passe

**Solution** : Endpoint API `/api/lots/migrate/csv-columns` créé dans le backend

### 2. Backend non redémarré automatiquement

**Erreur** : Endpoint `/migrate/csv-columns` retourne 404

**Cause** : Backend lancé sans `--reload` ou uvicorn ne détecte pas les changements

**Solution** : **Redémarrer manuellement le backend** (Étape 2, Option A)

---

## Commandes Rapides

### Redémarrer tout (après migration DB)

```bash
# Terminal 1 - Backend
cd backend-api
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 - Import CSV
cd backend-api
scripts\import_csv_data.bat  # Windows
# OU: python scripts/import_csv_real_data.py  # Linux/Mac

# Terminal 3 - SQAL
cd backend-api
scripts\generate_sqal_on_imported_lots.bat  # Windows

# Terminal 4 - Frontend
cd gaveurs-frontend
npm run dev
# → http://localhost:3000/analytics/qualite
```

---

**Auteur** : Claude Sonnet 4.5
**Date** : 12 Janvier 2026
**Session** : Continuation Analytics Phase 1
