# 💭 Réflexion Stratégique - Évolution Modèle PySR

**Date**: 10 Janvier 2026
**Type**: Document de réflexion / Roadmap
**Objectif**: Guider l'amélioration progressive du système de génération de courbes IA

---

## 🎯 Vision Globale

Passer d'un **modèle PySR statique à 4 features** à un **système adaptatif multi-critères** capable de s'améliorer continuellement grâce aux données terrain.

### Horizon Temporel

- **Court terme (Sprint 4)**: Intégration modèle existant
- **Moyen terme (3-6 mois)**: Collecte features étendues
- **Long terme (6-12 mois)**: Réentraînement et amélioration continue

---

## 📊 État des Lieux - Modèle Actuel

### Forces

✅ **Modèle déjà entraîné** (3.6 MB, 2868 exemples)
✅ **Équation symbolique** (interprétable, pas boîte noire)
✅ **4 features pertinentes** (age, weight_goal, food_intake_goal, diet_duration)
✅ **Prêt à l'emploi** (intégration rapide)

### Limites

❌ **Features figées** (ne s'adapte pas aux spécificités)
❌ **Facteur de conversion fixe** (food_intake_goal calculé avec heuristique)
❌ **Pas d'apprentissage continu** (modèle statique)
❌ **Généraliste** (ne tient pas compte race, climat, saison)

---

## 🔬 Réflexion sur les Features

### 1. Features Actuelles (v1.0)

| Feature | Pertinence | Disponibilité | Qualité Données |
|---------|-----------|---------------|-----------------|
| `age` | ⭐⭐⭐⭐⭐ | ✅ Facile | Bonne (champ obligatoire) |
| `weight_goal` | ⭐⭐⭐⭐⭐ | ✅ Facile | Bonne (objectif métier) |
| `food_intake_goal` | ⭐⭐⭐⭐ | ⚠️ Calculé | Moyenne (heuristique) |
| `diet_duration` | ⭐⭐⭐⭐⭐ | ✅ Facile | Bonne (standard métier) |

**Analyse** :
- Toutes les features sont pertinentes
- `food_intake_goal` est calculé (ratio × weight_goal) → Peut être amélioré

### 2. Features Candidates pour v2.0

#### Groupe A: Caractéristiques Animales ⭐ **PRIORITÉ HAUTE**

| Feature | Impact Estimé | Difficulté Collecte | Justification |
|---------|--------------|---------------------|---------------|
| `race_canard` | **⭐⭐⭐⭐⭐** | Facile | Capacité ingestion très différente (Mulard vs Barbarie) |
| `poids_initial_g` | **⭐⭐⭐⭐** | Facile | Indicateur santé/vigueur, déjà pesé |
| `sexe` | **⭐⭐⭐** | Moyenne | Dimorphisme, mais souvent lot mixte |
| `historique_sante` | **⭐⭐** | Difficile | Subjectif, nécessite scoring standardisé |

**Recommandation** :
- ✅ **Ajouter immédiatement** : `race_canard`, `poids_initial_g`
- ⏳ **Phase 2** : `sexe` (si données fiables)
- ❌ **Reporter** : `historique_sante` (trop subjectif)

#### Groupe B: Conditions Environnementales ⭐ **PRIORITÉ MOYENNE**

| Feature | Impact Estimé | Difficulté Collecte | Justification |
|---------|--------------|---------------------|---------------|
| `temperature_moyenne_c` | **⭐⭐⭐** | Moyenne | Influence appétit (chaleur ↓ ingestion) |
| `saison` | **⭐⭐** | Facile | Proxy de température, plus simple |
| `densite_elevage` | **⭐⭐** | Difficile | Corrélé avec stress, données souvent manquantes |
| `humidite_moyenne` | **⭐** | Difficile | Impact mineur comparé à température |

**Recommandation** :
- ✅ **Ajouter Phase 2** : `temperature_moyenne_c` OU `saison`
- ❌ **Reporter** : `densite_elevage`, `humidite_moyenne` (ROI faible)

#### Groupe C: Alimentation ⭐ **PRIORITÉ BASSE**

| Feature | Impact Estimé | Difficulté Collecte | Justification |
|---------|--------------|---------------------|---------------|
| `type_aliment` | **⭐⭐⭐** | Moyenne | Composition varie (maïs, mix céréales) |
| `qualite_aliment` | **⭐⭐** | Difficile | Subjectif, pas de scoring standard |
| `fournisseur_aliment` | **⭐** | Facile | Proxy qualité, mais biais commercial |

**Recommandation** :
- ⏳ **Phase 3** : `type_aliment` (si standardisé)
- ❌ **Éviter** : `qualite_aliment`, `fournisseur_aliment`

#### Groupe D: Métadonnées ❌ **NON RECOMMANDÉES**

| Feature | Raison Exclusion |
|---------|------------------|
| `gaveur_id` | Biais individuel, ne généralise pas |
| `site_code` | Déjà capturé par climat/aliment |
| `date_gavage` | Pas de lien causal physique |
| `lot_id` | Identifiant, pas prédicteur |

---

## 🧮 Optimisation de `food_intake_goal`

### Problématique

Actuellement calculé avec **heuristique fixe** :
```python
food_intake_goal = weight_goal × 19.0
```

**Question** : Le facteur 19.0 est-il optimal pour tous les cas ?

### Hypothèses à Tester

**H1** : Le facteur varie selon la race
```python
if race == "Mulard":
    facteur = 18.5  # Plus efficaces
elif race == "Barbarie":
    facteur = 20.0  # Moins efficaces
```

**H2** : Le facteur varie selon l'âge
```python
if age < 85:
    facteur = 19.5  # Jeunes, moins efficaces
elif age > 95:
    facteur = 18.5  # Matures, plus efficaces
else:
    facteur = 19.0
```

**H3** : Le facteur varie selon la saison
```python
if saison == "Été":
    facteur = 19.5  # Chaleur réduit efficacité
elif saison == "Hiver":
    facteur = 18.5  # Froid améliore conversion
```

### Plan de Validation

1. **Analyser données historiques Euralis**
   ```sql
   SELECT
       race_canard,
       AVG(total_aliment_g / poids_foie_final_g) as facteur_reel,
       STDDEV(total_aliment_g / poids_foie_final_g) as ecart_type
   FROM lots_gavage
   WHERE poids_foie_final_g > 0
   GROUP BY race_canard
   ```

2. **Créer lookup table**
   ```python
   FACTEURS_CONVERSION = {
       ("Mulard", "Printemps"): 18.3,
       ("Mulard", "Été"): 19.2,
       ("Barbarie", "Printemps"): 19.8,
       ("Barbarie", "Été"): 20.5,
       # ...
   }
   ```

3. **A/B Testing**
   - Générer courbes avec facteur fixe vs adaptatif
   - Comparer ITM final sur 20-30 lots

---

## 🔄 Stratégie d'Amélioration Continue

### Cycle d'Apprentissage

```
1. COLLECTE DONNÉES TERRAIN
   ↓
2. ANALYSE CORRÉLATIONS
   ↓
3. IDENTIFICATION FEATURES IMPACTANTES
   ↓
4. RÉENTRAÎNEMENT MODÈLE
   ↓
5. A/B TESTING SUR LOTS RÉELS
   ↓
6. DÉPLOIEMENT SI MEILLEUR
   ↓
7. RETOUR À 1
```

### Critères de Succès

**Métrique Primaire** : **Réduction de l'écart ITM prédiction vs réel**

- Modèle v1.0 : Écart moyen ±15% (estimation)
- Modèle v2.0 : Objectif ±10%
- Modèle v3.0 : Objectif ±5%

**Métriques Secondaires** :
- Taux d'acceptation superviseurs (courbe générée vs modifiée manuellement)
- Nombre de lots atteignant objectif poids foie (±20g)
- Réduction mortalité (doses mieux adaptées)

### Fréquence Réentraînement

**Phase Initiale** (6 premiers mois) :
- Réentraîner tous les **2 mois**
- Analyser impact features ajoutées
- Itérer rapidement

**Phase Mature** (après 1 an) :
- Réentraîner tous les **6 mois**
- Amélioration incrémentale
- Focus sur edge cases

---

## 🏗️ Architecture Évolutive

### Versioning Modèles

```
backend-api/models/
├── pysr_v1.0_2024-09-16.pkl    (modèle actuel)
├── pysr_v1.1_2026-03-01.pkl    (+ race, poids_initial)
├── pysr_v2.0_2026-06-01.pkl    (+ température, saison)
├── pysr_v2.1_2026-09-01.pkl    (facteurs conversion adaptatifs)
└── metadata/
    ├── v1.0_metrics.json       (performances, features)
    ├── v1.1_metrics.json
    └── comparison_v1.0_v1.1.json (A/B test results)
```

### API Flexible

```python
@router.post("/theorique/generate-pysr")
async def generate_courbe_pysr(
    lot_id: int,
    # v1.0 features
    age_moyen: int,
    poids_foie_cible: float,
    duree_gavage: int,
    # v2.0 features (optionnelles)
    race: Optional[str] = None,
    poids_initial: Optional[float] = None,
    sexe: Optional[str] = None,
    # v3.0 features (futures)
    temperature_moyenne: Optional[float] = None,
    # Config
    model_version: str = "latest"  # ou "v1.0", "v2.0"
):
    # Sélectionner modèle selon features disponibles
    if race and poids_initial and model_version == "latest":
        model = load_model("pysr_v2.0")
    else:
        model = load_model("pysr_v1.0")  # Fallback
```

---

## 📈 Roadmap Détaillée

### Sprint 4 (Janvier 2026) - ✅ EN COURS

- [x] Analyser modèle PySR existant
- [ ] Intégrer modèle v1.0 dans backend
- [ ] Créer endpoint `/generate-pysr`
- [ ] Tests unitaires PySRPredictor
- [ ] Documentation utilisateur

### Sprint 5 (Février 2026) - 🔄 PRÉPARATION

- [ ] Ajouter champs `race_canard`, `poids_initial_g` dans frontend
- [ ] Modifier schéma DB (`lots_gavage`)
- [ ] Interface superviseur pour saisie features étendues
- [ ] Collecte données sur 20 lots pilotes

### Q2 2026 (Mars-Mai) - 📊 ANALYSE

- [ ] Exporter 50+ lots avec features complètes
- [ ] Analyse corrélations (Python notebooks)
- [ ] Calculer facteurs conversion optimaux par race
- [ ] A/B testing facteur fixe vs adaptatif

### Q3 2026 (Juin-Août) - 🚀 RÉENTRAÎNEMENT

- [ ] Préparer dataset v2.0 (race, poids initial)
- [ ] Réentraîner PySR avec 7 features
- [ ] Comparer performances v1.0 vs v2.0
- [ ] Déployer v2.0 si gain > 10%

### Q4 2026 (Sept-Nov) - 🎯 OPTIMISATION

- [ ] Collecter features climatiques (température, saison)
- [ ] Entraîner v3.0 (climat + alimentation)
- [ ] Système de recommandation multi-modèles
- [ ] Dashboard comparaison courbes (v1.0, v2.0, v3.0, manuelle)

---

## 🤝 Collaboration avec Euralis

### Données Nécessaires

**Demander à Euralis** :
1. **Historique lots CSV étendu**
   - Colonnes actuelles (174) +
   - `race_canard`, `poids_initial_moyen_g`, `sexe_majoritaire`
   - `temperature_moyenne_periode`, `type_aliment`

2. **Expertise métier**
   - Facteurs conversion réels par race (si connus)
   - Seuils qualité foie (A+, A, B selon poids)
   - Pratiques gaveurs performants (best practices)

3. **Validation modèle**
   - Test blind sur 10 lots non utilisés en entraînement
   - Feedback superviseurs sur courbes générées

### Retour Terrain

**Impliquer gaveurs** :
- Questionnaire après gavage : "La courbe IA était-elle adaptée ?"
- Possibilité de signaler jours problématiques (canards fatigués, etc.)
- Suggestions d'ajustements pour futurs lots

---

## ⚠️ Risques et Mitigations

### Risque 1: Overfitting

**Symptôme** : Modèle trop spécifique, mauvaises perfs sur nouveaux lots

**Mitigation** :
- Validation croisée (k-fold) lors réentraînement
- Garder 20% données pour test blind
- Comparer v2.0 sur lots jamais vus

### Risque 2: Features Bruitées

**Symptôme** : Ajout feature qui dégrade performances

**Mitigation** :
- Tester chaque feature isolément
- Calculer feature importance (SHAP values)
- Ne garder que features avec impact > 5%

### Risque 3: Dérive Modèle

**Symptôme** : Modèle perd en précision avec le temps

**Mitigation** :
- Monitoring continu ITM prédit vs réel
- Alertes si écart > 20% sur 5 lots consécutifs
- Pipeline réentraînement automatique (cron job)

### Risque 4: Complexité Excessive

**Symptôme** : Modèle trop compliqué, difficile à interpréter

**Mitigation** :
- Limiter PySR à 10-15 features max
- Privilégier équations simples (max 20 termes)
- Garder version v1.0 comme baseline simple

---

## 💡 Idées Innovantes (Futur)

### 1. Apprentissage par Renforcement

Au lieu de prédire toute la courbe d'un coup :
- **Agent IA** ajuste dose jour par jour
- **Récompense** : Écart minimisé + ITM optimal
- **Environnement** : Simulateur de croissance foie

### 2. Modèles Hybrides

Combiner PySR + Deep Learning :
- **PySR** : Équation de base (interprétable)
- **LSTM** : Ajustements fins (capture patterns temporels)
- **Ensembling** : Moyenne pondérée des deux

### 3. Personnalisation Gaveur

Modèle adaptatif par gaveur :
- Analyse historique performances individuelles
- Biais personnel (tendance sur/sous-dosage)
- Suggestion courbe adaptée au style

### 4. Optimisation Multi-Objectifs

Au lieu de maximiser seulement poids foie :
- **Objectif 1** : Poids foie cible
- **Objectif 2** : Minimiser mortalité
- **Objectif 3** : Minimiser coût aliment
- **Objectif 4** : Maximiser qualité organoleptique

→ Algorithme de Pareto pour trouver compromis optimal

---

## 📚 Ressources et Références

### Papers Scientifiques

1. **PySR Original** : Cranmer (2020) - "Discovering Symbolic Models from Deep Learning with Inductive Biases"
2. **Genetic Programming** : Koza (1992) - "Genetic Programming"
3. **Multi-Objective Optimization** : Deb (2001) - "NSGA-II Algorithm"

### Outils

- **PySR** : https://github.com/MilesCranmer/PySR
- **SymPy** : Manipulation équations symboliques
- **SHAP** : Feature importance
- **MLflow** : Tracking expériences ML

### Datasets de Référence

- CSV Euralis (174 colonnes)
- `pysrData.csv` (2868 exemples, 4 features)
- Futurs exports avec features étendues

---

## ✅ Critères de Décision

### Quand Passer à v2.0 ?

**Conditions TOUTES remplies** :
- [ ] ≥50 lots avec `race_canard` et `poids_initial_g` collectés
- [ ] Analyse corrélations montre impact > 10%
- [ ] Modèle v2.0 réentraîné avec succès
- [ ] Test blind sur 10 lots : écart v2.0 < écart v1.0
- [ ] Approbation superviseur Euralis

### Quand Abandonner une Feature ?

**Si AU MOINS 1 condition** :
- Feature importance < 2% (SHAP values)
- Collecte trop difficile (>30% données manquantes)
- Pas de corrélation significative (p-value > 0.05)
- Dégrade performances en A/B test

---

## 🎯 Conclusion

### Vision Long Terme

Transformer le système de **génération statique** de courbes en **système adaptatif intelligent** qui :

1. **Apprend continuellement** des résultats terrain
2. **S'adapte** aux spécificités (race, climat, saison)
3. **Améliore** progressivement la précision
4. **Personnalise** les recommandations
5. **Optimise** multi-critères (poids, mortalité, coût, qualité)

### Prochaine Action

🚀 **Phase 1 - Intégration modèle v1.0** (Sprint 4)

Permet de :
- Valider l'infrastructure technique
- Collecter premiers retours utilisateurs
- Préparer terrain pour features étendues

**Puis itérer progressivement** selon roadmap Q2-Q4 2026.

---

**Auteur** : Claude Sonnet 4.5
**Date** : 10 Janvier 2026
**Type** : Document de réflexion stratégique
**Projet** : Système Gaveurs V3.0
**Statut** : Vision évolutive - Mise à jour continue
