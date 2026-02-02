# PySR + SQAL : features ajoutées et filtres d’entraînement

## Objectif

Cette note décrit :

- les **features SQAL** injectées dans le dataset PySR lorsque `include_sqal_features=true`
- les **filtres d’entraînement** disponibles via l’API PySR (`premium_mode`)
- les implications pratiques (données requises, cas d’usage)

## Endpoint concerné

- `POST /api/tasks/ml/pysr/train`

Paramètres utiles :

- `genetique` : entraîne sur **tous les lots** de cette génétique (recommandé)
- `lot_id` : optionnel, sert à **déduire la génétique** si `genetique` n’est pas fourni
- `include_sqal_features` : active l’ajout des features SQAL
- `premium_mode` : contrôle le filtre des lots basé sur SQAL (voir plus bas)

## Features SQAL ajoutées (`include_sqal_features=true`)

Les features SQAL ajoutées sont des **agrégats par lot** calculés à partir de `sensor_samples`.

### `sqal_score_mean`

- **Définition** : score SQAL moyen du lot
- **Source** : `sensor_samples.fusion_final_score`
- **Calcul** : `AVG(fusion_final_score)` groupé par `lot_id`
- **Intérêt** : proxy de la qualité moyenne du lot, issu de la fusion capteurs

### `sqal_n_samples`

- **Définition** : nombre d’échantillons SQAL disponibles pour le lot
- **Source** : `sensor_samples`
- **Calcul** : `COUNT(*)` groupé par `lot_id`
- **Intérêt** : proxy de **couverture / confiance** (plus il y a de mesures, plus l’agrégat est fiable)

### Remarques importantes

- Ces features ne sont **pas** les features capteurs brutes (spectres, matrice ToF, etc.).
- Si un lot n’a **aucun** `sensor_samples`, alors les colonnes SQAL restent `NULL`.
- Côté préparation des features, les colonnes SQAL ne sont ajoutées à `X` que si elles contiennent **au moins quelques valeurs non nulles** dans le dataset.

## Filtrage premium via `premium_mode`

Le filtrage premium s’appuie sur l’existence de mesures dans `sensor_samples` et sur le grade :

- condition : `EXISTS (SELECT 1 FROM sensor_samples ss WHERE ss.lot_id = lot_gavage_id AND ss.fusion_final_grade IN (...))`

### `premium_mode=strict`

- lots retenus : `A+`, `A`
- usage : modèle centré sur le très haut de gamme
- risque : dataset plus petit (souvent insuffisant au début si peu de lots SQAL)

### `premium_mode=extended` (par défaut)

- lots retenus : `A+`, `A`, `B`
- usage : compromis entre qualité et volume de données

### `premium_mode=off`

- désactive le filtre premium SQAL (`require_sqal_premium=false`)
- lots retenus : **tous** les lots de la génétique (même sans `sensor_samples`)
- usage : utile pour démarrer l’entraînement quand peu de lots ont des données SQAL

## Exemples d’appels

### Entraîner mulard, strict, avec features SQAL

`A+`/`A` uniquement :

- `POST /api/tasks/ml/pysr/train?genetique=mulard&include_sqal_features=true&premium_mode=strict`

### Entraîner mulard, extended, avec features SQAL

`A+`/`A`/`B` :

- `POST /api/tasks/ml/pysr/train?genetique=mulard&include_sqal_features=true&premium_mode=extended`

### Entraîner mulard, sans filtre premium (recommandé si dataset trop petit)

- `POST /api/tasks/ml/pysr/train?genetique=mulard&include_sqal_features=true&premium_mode=off`

## Objectif foie (scoring) : paramètres et policy Conseil

Le training PySR calcule et persiste des métriques « foie » dans `formules_pysr.metrics->'foie'`.

Ces métriques sont calculées sur les lots d’entraînement (niveau lot), avec une source :

- priorité **mesuré** : `lots_gavage.poids_foie_moyen_g`
- sinon **estimé SQAL** : moyenne de `sensor_samples.poids_foie_estime_g`

### Paramètres de scoring disponibles sur le endpoint PySR

Sur `POST /api/tasks/ml/pysr/train`, paramètres (tous optionnels) :

- `foie_min_g` : borne min (grammes)
- `foie_max_g` : borne max (grammes)
- `foie_target_g` : cible (grammes)
- `foie_weight_range` : poids du % de lots dans la plage `[min,max]`
- `foie_weight_target` : poids du % de lots au-dessus de `target`

Ces paramètres sont **optionnels** :

- si tu les fournis, ils **override** toute policy
- si tu ne les fournis pas, une **policy Conseil** peut fournir les valeurs par défaut

### Policy Conseil (objectifs foie) : endpoints

Le Conseil peut configurer des objectifs par segment (génétique + site + cluster_pred) via :

- `POST /api/euralis/admin/foie-objectives`
- `GET /api/euralis/admin/foie-objectives`
- `POST /api/euralis/admin/foie-objectives/{policy_id}/deactivate`
- `GET /api/euralis/ml/foie-objectives/active?genetique=...&site_code=...&lot_cluster_pred_id=...`

### Exemple PowerShell (recommandé) : créer une policy

```powershell
$body = @{
  genetique     = "pekin"
  foie_min_g    = 420
  foie_max_g    = 680
  foie_target_g = 560
  weight_range  = 0.7
  weight_target = 0.3
  created_by    = "conseil"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/euralis/admin/foie-objectives" -ContentType "application/json" -Body $body
```

### Exemple PowerShell : lire la policy active

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8000/api/euralis/ml/foie-objectives/active?genetique=pekin"
```

### Exemple : training PySR utilisant la policy (pas de params foie)

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/tasks/ml/pysr/train?genetique=pekin"
```

### Exemple : override ponctuel (sans modifier la policy)

```text
POST /api/tasks/ml/pysr/train?genetique=pekin&foie_target_g=575&foie_weight_range=0.6&foie_weight_target=0.4
```

## Phase B : `cluster_refined_j4` + Transition T2 (courbe de rattrapage uniquement)

### Objectif métier

- La **courbe PySR** reste la **référence / contrat**.
- La **courbe de rattrapage** (endpoint `GET /api/courbes/predictive/lot/{lot_id}`) est une **recommandation** qui vise une **convergence progressive** vers la référence, sans « forcer » le gaveur.
- Les écarts au contrat sont **tracés** pour alimenter le **conseil**.

### Clustering Phase B : `lot_refined_j4`

Le clustering `lot_refined_j4` segmente les lots sur la base des données **J1..J4** (features F4), pour piloter ensuite la policy de transition.

Features utilisées (F4) :

- `dose_reelle_j1..dose_reelle_j4`
- `delta_j1..delta_j4` (réel - théorique)
- `delta_cum_j4`
- `delta_abs_mean_j4`

Endpoints :

- `POST /api/tasks/ml/clustering/lots-refined-j4` (déclenche un run)
- `GET /api/euralis/ml/lots/{lot_id}/cluster-refined-j4` (cluster d’un lot)
- `GET /api/euralis/ml/lots-clustering/assignments-refined-j4` (liste assignations)

### Exemple PowerShell : lancer le clustering J4

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/tasks/ml/clustering/lots-refined-j4?n_clusters=3&min_lots=20&min_days=2&site_codes=LL&genetique=pekin"
```

### Policy Conseil T2 : transition (contraintes/lissage de la courbe de rattrapage)

La policy T2 est segmentée par :

- `genetique`
- `site_code` (optionnel)
- `lot_cluster_refined_j4_id` (optionnel)

Elle fournit un JSON `params` appliqué **uniquement** à l’algorithme de rattrapage (v2 spline + contraintes + lissage) — la référence PySR n’est pas modifiée.

Clés de `params` supportées :

- `dose_min_absolue`
- `dose_max_absolue`
- `increment_max_par_jour`
- `variation_max_percent`
- `lissage_seuil_haut_g`
- `lissage_seuil_bas_g`
- `lissage_poids_pred_haut`
- `lissage_poids_pred_moyen`
- `lissage_poids_pred_faible`

Endpoints :

- `POST /api/euralis/admin/transition-policies`
- `GET /api/euralis/admin/transition-policies`
- `POST /api/euralis/admin/transition-policies/{policy_id}/deactivate`
- `GET /api/euralis/ml/transition/active?genetique=...&site_code=...&lot_cluster_refined_j4_id=...`

### Exemple PowerShell : créer une policy T2

```powershell
$body = @{
  genetique = "pekin"
  site_code = "LL"
  lot_cluster_refined_j4_id = 1
  params = @{
    variation_max_percent = 0.12
    increment_max_par_jour = 45
    lissage_seuil_haut_g = 25
    lissage_seuil_bas_g = 10
    lissage_poids_pred_haut = 0.75
    lissage_poids_pred_moyen = 0.65
    lissage_poids_pred_faible = 0.50
  }
  created_by = "conseil"
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/euralis/admin/transition-policies" -ContentType "application/json" -Body $body
```

### P1 : courbe de rattrapage + traçage des écarts au contrat

Endpoint :

- `GET /api/courbes/predictive/lot/{lot_id}`

Comportement :

- Si pas d’écart significatif, la courbe retournée suit la référence.
- Si écart significatif, l’algorithme v2 produit la **portion future** (rattrapage) avec les paramètres `params` de la policy T2 (si une policy active est trouvée).

La réponse inclut :

- `transition_policy_applied` (policy_id + segment résolu)
- `deviations_snapshot_id` : id du snapshot d’écarts (persisté en base)

### Snapshots écarts (contrat)

Les écarts au contrat sont historisés dans la table :

- `lot_contract_deviation_snapshots`

Chaque appel P1 peut générer un snapshot (fenêtre J1..J4 ou jusqu’au dernier jour réel).

## Conséquence sur la taille dataset

Le dataset d’entraînement est agrégé par :

- `lot_gavage_id`
- `genetique`
- `jour_gavage`

Donc on obtient environ **1 ligne par jour** et par lot (avec matin/soir pivotés).

Si le dataset est trop petit, il faut :

- enrichir `sensor_samples` sur **plusieurs lots** (si on veut garder `strict/extended`), ou
- passer temporairement en `premium_mode=off`, ou
- abaisser `PYSR_MIN_SAMPLES` (plutôt pour tests rapides, pas pour production)
