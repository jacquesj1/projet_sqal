# Clustering lots (lot_pred)

Ce document décrit le clustering prédictif des lots de gavage (**lot_pred**) utilisé pour construire une segmentation de type :

- `genetique + site_code + cluster_pred`

L’objectif est de produire un **cluster stable** à partir des performances et métriques lots historiques, afin de générer / scorer / publier des courbes de gavage (ex: PySR) par segment.

---

## 1) Vue d’ensemble

- **Algorithme**: KMeans
- **Normalisation**: StandardScaler
- **Entrée**: lots historiques (table `lots_gavage`) + durée calculée via `gavage_data_lots`
- **Sortie**:
  - `cluster_id` (entier)
  - `confidence` (score 0-1 basé sur la distance aux centroides)
- **Persistance**:
  - table des runs: `lot_clustering_runs`
  - table des assignations: `lot_clustering_assignments`

---

## 2) Endpoint API

### Déclenchement (asynchrone)

- **Méthode**: `POST`
- **URL**: `/api/tasks/ml/clustering/lots`

Cet endpoint déclenche une tâche Celery (`cluster_lots_pred_async`) et retourne un `task_id`.

### Paramètres

- `n_clusters` (int, défaut `3`, min `2`, max `20`)
- `random_state` (int, défaut `42`)
- `n_init` (int, défaut `10`)
- `min_lots` (int, défaut `20`) : minimum de lots requis pour exécuter le clustering
- `site_codes` (str optionnel) : liste séparée par virgules, ex: `LL,LS`
- `genetique` (str optionnel) : ex: `mulard`
- `seasons` (str optionnel) : liste séparée par virgules, ex: `ete,hiver`
- `min_duree_gavage` (int optionnel)
- `max_duree_gavage` (int optionnel)
- `features` (str optionnel) : liste séparée par virgules
- `modele_version` (str, défaut `lot_pred_kmeans_v1`)

---

## 3) Exemples curl

### Clustering global (défaut)

```bash
curl.exe -X POST "http://localhost:8000/api/tasks/ml/clustering/lots"
```

### Clustering filtré (sites + génétique + durée 11-14j + features custom)

```bash
curl.exe -X POST "http://localhost:8000/api/tasks/ml/clustering/lots?n_clusters=4&site_codes=LL,LS&genetique=mulard&min_duree_gavage=11&max_duree_gavage=14&features=itm,sigma,pctg_perte_gavage,total_corn_real,nb_meg,duree_gavage"
```

---

## 4) Features supportées

Les features sont whitelistées dans `backend-api/app/ml/euralis/lot_clustering.py`.

Liste (à date) :

- `itm`
- `sigma`
- `pctg_perte_gavage`
- `total_corn_real`
- `nb_meg`
- `duree_gavage`
- `poids_foie_moyen_g`

Si `features` n’est pas fourni, un set par défaut est utilisé.

---

## 5) Tables de persistance

### `lot_clustering_runs`

Stocke un run de clustering :

- `clustering_type` (ex: `lot_pred`)
- `modele_version`
- `params` (JSONB)
- `features` (TEXT[])
- `n_clusters`, `n_lots`, `avg_confidence`
- `created_at`

### `lot_clustering_assignments`

Stocke les assignations :

- `run_id` (FK vers `lot_clustering_runs`)
- `lot_id` (FK vers `lots_gavage`)
- `cluster_id`
- `confidence`
- `created_at`

---

## 6) Notes d’intégration / workflow

- L’endpoint retourne un `task_id`. Une fois la tâche terminée, le résultat contient aussi `run_id`.
- Les tables sont créées en **lazy init** au 1er run (dans la task Celery).
- Ce clustering est prévu pour alimenter la segmentation `genetique + site_code + cluster_pred`.
- Une phase ultérieure est prévue pour le **clustering raffiné J4** (non inclus ici).
