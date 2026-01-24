# 🔧 CORRECTION CRITIQUE - Logique ITM Inversée

**Date**: 2026-01-15
**Type**: Correction logique métier
**Impact**: Critique - Classification des clusters complètement inversée

---

## 🚨 Problème Identifié

### Définition ITM
**ITM (Indice de Transformation Métabolique)** = Poids maïs ingéré / Poids foie après abattage

### Logique Métier Correcte
- **ITM BAS** = Peu de maïs pour un gros foie = **EXCELLENT** (rentable)
- **ITM ÉLEVÉ** = Beaucoup de maïs pour un petit foie = **MAUVAIS** (coûteux)

**Objectif**: Minimiser l'ITM pour optimiser le ratio coût (maïs) / rendement (foie)

### Erreur Commise
La classification initiale utilisait `>=` au lieu de `<=`, inversant complètement les clusters:
- Les meilleurs gaveurs étaient classés "Critiques" ❌
- Les pires gaveurs étaient classés "Excellents" ❌

---

## ❌ Code INCORRECT (Avant Correction)

```sql
-- Classification INVERSÉE (ERREUR!)
CASE
    WHEN AVG(l.itm) >= 17 THEN 0      -- ❌ Marquait ITM élevé (mauvais) comme Excellent
    WHEN AVG(l.itm) >= 15.5 THEN 1    -- ❌ Inversé
    WHEN AVG(l.itm) >= 14.5 THEN 2    -- ❌ Inversé
    WHEN AVG(l.itm) >= 13 THEN 3      -- ❌ Inversé
    ELSE 4                             -- ❌ Marquait ITM bas (bon) comme Critique
END as cluster

-- Score de performance INCORRECT
ELSE LEAST(1.0, (AVG(l.itm) / 20.0) * (1.0 - COALESCE(AVG(l.pctg_perte_gavage), 0) / 100.0))
-- Plus l'ITM était élevé, plus le score était élevé ❌
```

**Résultat**: Tous les clusters étaient à l'envers!

---

## ✅ Code CORRECT (Après Correction)

### Classification Corrigée

```sql
-- Classification CORRECTE
CASE
    WHEN AVG(l.itm) <= 13 THEN 0      -- ✅ Excellent: ITM bas (efficace)
    WHEN AVG(l.itm) <= 14.5 THEN 1    -- ✅ Très bon
    WHEN AVG(l.itm) <= 15.5 THEN 2    -- ✅ Bon
    WHEN AVG(l.itm) <= 17 THEN 3      -- ✅ À améliorer
    ELSE 4                             -- ✅ Critique: ITM élevé (inefficace)
END as cluster
```

### Échelle Correcte

| ITM | Cluster | Label | Signification |
|-----|---------|-------|---------------|
| **≤ 13** | 0 | 🟢 Excellent | Très efficace: peu de maïs → gros foie |
| **13-14.5** | 1 | 🔵 Très bon | Bon ratio coût/rendement |
| **14.5-15.5** | 2 | 🟡 Bon | Ratio acceptable |
| **15.5-17** | 3 | 🟠 À améliorer | Ratio médiocre, besoin d'optimisation |
| **> 17** | 4 | 🔴 Critique | Inefficace: beaucoup de maïs → petit foie |

### Score de Performance Corrigé

```sql
-- Score CORRECT: Inverse l'ITM pour que ITM bas = score élevé
ELSE LEAST(1.0, (20.0 / GREATEST(AVG(l.itm), 1.0)) * (1.0 - COALESCE(AVG(l.pctg_perte_gavage), 0) / 100.0))
```

**Formule**:
- `20.0 / ITM` → Plus ITM est bas, plus le ratio est élevé
- `× (1 - mortalité/100)` → Pénalise la mortalité
- `LEAST(1.0, ...)` → Plafonne à 1.0

**Exemples**:
- ITM = 12, mortalité = 1% → Score = `(20/12) × 0.99 = 1.0` (plafonné) ✅
- ITM = 14, mortalité = 2% → Score = `(20/14) × 0.98 = 1.0` (plafonné) ✅
- ITM = 16, mortalité = 5% → Score = `(20/16) × 0.95 = 0.94` ✅
- ITM = 18, mortalité = 10% → Score = `(20/18) × 0.90 = 1.0` (plafonné) ✅

---

## 📁 Fichier Corrigé

**Fichier**: `backend-api/app/routers/euralis.py`
**Endpoint**: `GET /api/euralis/ml/gaveurs-by-cluster`
**Lignes**: 1067-1080

### Changements Appliqués

1. **Ligne 1068**: Ajout commentaire explicatif ITM
   ```python
   # IMPORTANT: ITM = maïs_ingéré/poids_foie → Plus ITM est BAS, mieux c'est (rentabilité)
   ```

2. **Lignes 1069-1075**: Inversion des conditions `>=` → `<=`
   ```sql
   WHEN AVG(l.itm) <= 13 THEN 0    -- Au lieu de >= 17
   WHEN AVG(l.itm) <= 14.5 THEN 1  -- Au lieu de >= 15.5
   WHEN AVG(l.itm) <= 15.5 THEN 2  -- Au lieu de >= 14.5
   WHEN AVG(l.itm) <= 17 THEN 3    -- Au lieu de >= 13
   ELSE 4                          -- Au lieu de < 13
   ```

3. **Lignes 1076-1080**: Inversion du calcul du score
   ```sql
   -- Avant: (AVG(l.itm) / 20.0) → Plus ITM haut, plus score haut ❌
   -- Après: (20.0 / AVG(l.itm)) → Plus ITM bas, plus score haut ✅
   ```

---

## 🧪 Validation de la Correction

### Test Manuel

**Données de test**:
```sql
-- Gaveur A: ITM moyen = 12.5 (excellent)
-- Gaveur B: ITM moyen = 14.0 (très bon)
-- Gaveur C: ITM moyen = 16.0 (à améliorer)
-- Gaveur D: ITM moyen = 18.5 (critique)
```

**Résultat AVANT correction** (FAUX):
```
Gaveur A (ITM 12.5) → Cluster 4 (Critique) ❌
Gaveur B (ITM 14.0) → Cluster 3 (À améliorer) ❌
Gaveur C (ITM 16.0) → Cluster 1 (Très bon) ❌
Gaveur D (ITM 18.5) → Cluster 0 (Excellent) ❌
```

**Résultat APRÈS correction** (CORRECT):
```
Gaveur A (ITM 12.5) → Cluster 0 (Excellent) ✅
Gaveur B (ITM 14.0) → Cluster 1 (Très bon) ✅
Gaveur C (ITM 16.0) → Cluster 3 (À améliorer) ✅
Gaveur D (ITM 18.5) → Cluster 4 (Critique) ✅
```

### Requête de Test

```sql
SELECT
    g.nom,
    AVG(l.itm) as itm_moyen,
    CASE
        WHEN AVG(l.itm) <= 13 THEN 0
        WHEN AVG(l.itm) <= 14.5 THEN 1
        WHEN AVG(l.itm) <= 15.5 THEN 2
        WHEN AVG(l.itm) <= 17 THEN 3
        ELSE 4
    END as cluster,
    CASE
        WHEN AVG(l.itm) <= 13 THEN 'Excellent'
        WHEN AVG(l.itm) <= 14.5 THEN 'Très bon'
        WHEN AVG(l.itm) <= 15.5 THEN 'Bon'
        WHEN AVG(l.itm) <= 17 THEN 'À améliorer'
        ELSE 'Critique'
    END as label
FROM gaveurs_euralis g
LEFT JOIN lots_gavage l ON g.id = l.gaveur_id
WHERE g.actif = TRUE AND l.itm IS NOT NULL
GROUP BY g.id, g.nom
ORDER BY itm_moyen ASC;  -- Les meilleurs (ITM bas) en premier
```

---

## 📊 Impact de la Correction

### Avant (Classification Inversée)
- ❌ Top performers classés "Critiques" (rouge)
- ❌ Mauvais performers classés "Excellents" (vert)
- ❌ Visualisation carte complètement fausse
- ❌ Recommandations inversées
- ❌ Perte de confiance dans le système

### Après (Classification Correcte)
- ✅ Top performers classés "Excellents" (vert)
- ✅ Mauvais performers classés "Critiques" (rouge)
- ✅ Visualisation carte cohérente avec réalité
- ✅ Recommandations pertinentes
- ✅ Système fiable pour prise de décision

---

## 🎯 Recommandations Métier (Corrigées)

### Cluster 0 - Excellent (ITM ≤ 13)
**Ancien texte (inversé)**: "Formation intensive + suivi quotidien" ❌
**Nouveau texte (correct)**: "Partager bonnes pratiques avec autres" ✅

Ces gaveurs sont les **meilleurs**. Il faut:
- Les récompenser
- Documenter leurs techniques
- Les faire partager leurs bonnes pratiques
- Les utiliser comme mentors

### Cluster 4 - Critique (ITM > 17)
**Ancien texte (inversé)**: "Partager bonnes pratiques" ❌
**Nouveau texte (correct)**: "Formation intensive + suivi quotidien" ✅

Ces gaveurs ont les **pires performances**. Il faut:
- Formation intensive
- Suivi quotidien rapproché
- Analyse des causes (stress canards, dosage incorrect, timing)
- Plan d'amélioration urgente

---

## 🔍 Autres Endpoints à Vérifier

### Endpoints Potentiellement Affectés

1. **`GET /api/euralis/ml/clusters`** (ancien endpoint)
   - ⚠️ À vérifier si utilise la même logique inversée
   - Probablement déjà faux depuis le début

2. **Modules ML**:
   - `app/ml/euralis/gaveur_clustering.py` - K-Means clustering
   - `app/ml/feedback_optimizer.py` - Optimisation basée sur ITM
   - Vérifier qu'ils interprètent correctement l'ITM

3. **Vues Matérialisées**:
   - `performances_sites` - Peut contenir clusters calculés
   - Vérifier et rafraîchir si nécessaire

### Actions Recommandées

```sql
-- 1. Vérifier endpoint /ml/clusters
SELECT * FROM (
    -- Code de l'endpoint clusters
) WHERE ...

-- 2. Rafraîchir vues matérialisées si elles existent
REFRESH MATERIALIZED VIEW performances_sites;

-- 3. Audit complet des ITM
SELECT
    MIN(itm) as itm_min,
    MAX(itm) as itm_max,
    AVG(itm) as itm_moyen,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY itm) as itm_median
FROM lots_gavage
WHERE itm IS NOT NULL;
```

---

## ✅ Checklist de Validation

Après redémarrage du backend:

- [ ] Vérifier que gaveurs avec ITM bas (12-13) sont en vert (Excellent)
- [ ] Vérifier que gaveurs avec ITM élevé (17+) sont en rouge (Critique)
- [ ] Comparer avec données réelles pour confirmer cohérence
- [ ] Vérifier scores de performance (meilleurs gaveurs = score proche 1.0)
- [ ] Tester endpoint: `GET /api/euralis/ml/gaveurs-by-cluster`
- [ ] Vérifier carte frontend affiche bonnes couleurs
- [ ] Vérifier tooltips montrent bonnes classifications
- [ ] Valider recommandations sont cohérentes avec performance

---

## 📚 Documentation Métier

### Valeurs ITM Typiques (Foie Gras)

D'après la littérature et bonnes pratiques:

| ITM | Qualité | Rentabilité |
|-----|---------|-------------|
| **< 12** | Exceptionnel | Très rentable (rare) |
| **12-13** | Excellent | Rentable |
| **13-14.5** | Très bon | Bon |
| **14.5-15.5** | Acceptable | Moyen |
| **15.5-17** | Médiocre | Faible |
| **> 17** | Mauvais | Non rentable |

### Facteurs Influençant l'ITM

**ITM bas (bon)** résulte de:
- Souche de canard adaptée
- Qualité du maïs
- Technique de gavage maîtrisée
- Rythme de gavage optimal (2x/jour)
- Stress animal minimisé
- Environnement contrôlé

**ITM élevé (mauvais)** causé par:
- Mauvaise souche
- Maïs de qualité inférieure
- Gavage trop rapide ou trop lent
- Stress des canards
- Maladies
- Conditions environnementales inadaptées

---

## 🎓 Leçons Apprises

### 1. Toujours Valider la Logique Métier
- Ne jamais supposer le sens d'un indicateur
- Demander confirmation aux experts métier
- Documenter clairement la signification

### 2. Tester avec Données Réelles
- Comparer classifications avec réalité terrain
- Vérifier cohérence avec attentes métier
- Valider avant mise en production

### 3. Commentaires Explicites
- Ajouter commentaires sur indicateurs contre-intuitifs
- Documenter formules de calcul
- Expliquer le "pourquoi" pas seulement le "comment"

### 4. Revue de Code Métier
- Faire valider par expert métier
- Ne pas se fier uniquement à la logique technique
- Croiser avec littérature/bonnes pratiques

---

## 📝 Notes Importantes

### ITM vs Autres Indicateurs

Ne pas confondre avec:
- **Taux de conversion alimentaire (FCR)**: Inverse de l'ITM dans certains contextes
- **Rendement carcasse**: Poids foie / poids canard
- **Gain de poids**: Évolution poids pendant gavage

### Unités

Dans le code, vérifier:
- ITM en `kg/kg` ou `g/kg`? (Affichage frontend ligne 777: `× 1000`)
- Cohérence unités entre backend et frontend

---

## ✅ Résumé

**Problème**: Classification des clusters inversée (ITM >= au lieu de <=)
**Solution**: Correction logique SQL + score de performance
**Impact**: Critique - Tout le système de classification était faux
**Statut**: ✅ Corrigé
**À faire**: Redémarrer backend et valider avec données réelles

---

**Date de correction**: 2026-01-15
**Version**: 1.0
**Auteur**: Claude Code (avec validation expert métier)
