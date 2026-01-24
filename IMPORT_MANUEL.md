# Guide Import CSV Manuel

**Problème** : La connexion asyncpg depuis Windows vers PostgreSQL dans Docker échoue avec `connection was closed in the middle of operation`.

**Solution** : Import manuel via pgAdmin ou interface Web.

---

## Option 1 : Via pgAdmin (Recommandé)

### 1. Ouvrir pgAdmin
- Connexion : localhost:5432
- Database : gaveurs_db
- User : gaveurs_admin
- Password : gaveurs_secure_2024

### 2. Créer une table temporaire pour import CSV

```sql
CREATE TEMP TABLE csv_import (
    code_lot VARCHAR,
    total_corn_real DECIMAL,
    nb_meg INTEGER,
    poids_de_foies_moyen DECIMAL,
    gaveur VARCHAR,
    debut_du_lot TIMESTAMP,
    quantite_accrochee INTEGER,
    duree_du_lot INTEGER,
    souche VARCHAR,
    geo VARCHAR,
    itm DECIMAL,
    sigma DECIMAL
);
```

### 3. Importer le CSV via pgAdmin Import Tool

- Clic-droit sur la table `csv_import` → Import/Export
- Fichier : `D:\GavAI\projet-euralis-gaveurs\backend-api\data\2023\Pretraite_End_2024.csv`
- Format : CSV
- Header : Yes
- Delimiter : `;`
- Columns : Mapper les colonnes nécessaires

### 4. Insérer dans lots_gavage

```sql
INSERT INTO lots_gavage (
    code_lot, gaveur_id, site_origine, souche,
    nombre_canards, date_debut_gavage, duree_gavage_prevue,
    itm, sigma, total_corn_real_g, nb_meg, poids_foie_moyen_g,
    statut, created_at
)
SELECT
    csv.code_lot,
    COALESCE(g.id, 1) as gaveur_id,
    CASE
        WHEN csv.geo LIKE '%BRETAGNE%' THEN 'Bretagne'
        WHEN csv.geo LIKE '%SUDOUEST%' THEN 'SudOuest'
        ELSE 'Autre'
    END as site_origine,
    'mulard' as souche,
    csv.quantite_accrochee,
    csv.debut_du_lot::date,
    csv.duree_du_lot,
    csv.itm,
    csv.sigma,
    csv.total_corn_real,
    csv.nb_meg,
    csv.poids_de_foies_moyen,
    'termine',
    NOW()
FROM csv_import csv
LEFT JOIN gaveurs g ON g.nom = csv.gaveur
WHERE csv.code_lot LIKE 'LL%';  -- Seulement les lots CSV Euralis
```

---

## Option 2 : Exécuter depuis le conteneur Docker

Si Docker est configuré correctement :

```bash
# Copier le script dans le conteneur
docker cp backend-api/scripts/import_csv_real_data.py gaveurs_backend:/tmp/

# Copier le CSV
docker cp backend-api/data/2023/Pretraite_End_2024.csv gaveurs_backend:/tmp/

# Exécuter l'import
docker exec gaveurs_backend python /tmp/import_csv_real_data.py
```

---

## Option 3 : API Endpoint (Si backend redémarré)

Si le backend a été redémarré avec `--reload` et l'endpoint `/api/lots/import-csv` existe :

```bash
curl -X POST "http://localhost:8000/api/lots/import-csv" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@backend-api/data/2023/Pretraite_End_2024.csv"
```

---

## Vérification Post-Import

```sql
-- Compter les lots importés
SELECT COUNT(*) as nb_lots,
       COUNT(DISTINCT gaveur_id) as nb_gaveurs,
       MIN(date_debut_gavage) as premiere_date,
       MAX(date_debut_gavage) as derniere_date
FROM lots
WHERE code_lot LIKE 'LL%';

-- Vérifier les nouvelles colonnes CSV
SELECT code_lot, itm, sigma, total_corn_real_g, nb_meg, poids_foie_moyen_g
FROM lots
WHERE code_lot LIKE 'LL%'
ORDER BY date_debut_gavage
LIMIT 5;
```

**Résultat attendu** :
- 74-75 lots avec code_lot `LL*`
- Dates : 2024-01-02 à 2024-01-31
- ~30 gaveurs distincts
- Colonnes CSV remplies (total_corn_real_g, nb_meg, poids_foie_moyen_g)

---

**Auteur** : Claude Sonnet 4.5
**Date** : 13 Janvier 2026
