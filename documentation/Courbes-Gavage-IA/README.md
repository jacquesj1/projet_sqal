# Documentation Courbes Gavage IA

**Projet**: Système Gaveurs V3.0 - Euralis
**Module**: Courbes de Gavage Intelligentes avec IA
**Dernière MAJ**: 11 Janvier 2026

---

## Vue d'Ensemble

Ce répertoire contient toute la documentation du module **Courbes de Gavage IA**, incluant :
- **Sprint 5** : Modèle PySR v2 (courbes théoriques)
- **Sprint 6** : Dashboard 3-Courbes (intégration frontend/backend)

---

## Sprints Complétés

### ✅ Sprint 5 - PySR v2 (11 Jan 2026)

**Objectif** : Modèle ML pour génération de courbes théoriques

**Réalisations** :
- ✅ PySR v2 avec équation symbolique : `dose = x2 + 64.66*x4 + 304.54`
- ✅ Implémentation NumPy pure (sans Julia)
- ✅ MAE: 22.3g, R²: 0.82 (30,524 points d'entraînement)
- ✅ Performance: <50ms par prédiction

**Documents** :
- **[README_SPRINT5.md](README_SPRINT5.md)** - Index complet Sprint 5
- **[SPRINT5_RESUME_FINAL.md](SPRINT5_RESUME_FINAL.md)** - Résumé exécutif
- **[DONNEES_ENTREE_PYSR.md](DONNEES_ENTREE_PYSR.md)** ⭐ - Données d'entraînement détaillées
- **[ALGO_COURBE_PREDICTIVE_V2.md](ALGO_COURBE_PREDICTIVE_V2.md)** - Algorithme prédictif v2

### ✅ Sprint 6A - Dashboard 3-Courbes (11 Jan 2026)

**Objectif** : Intégration complète du dashboard 3-courbes

**Réalisations** :
- ✅ Upgrade algorithme prédictif v1 → v2 (spline cubique + contraintes)
- ✅ Frontend déjà implémenté (Sprint 4) - validation complète
- ✅ Tests E2E workflow complet passants
- ✅ Amélioration +50% précision, +50% vitesse vs v1

**Documents** :
- **[SPRINT6_RESUME.md](SPRINT6_RESUME.md)** - Résumé exécutif ⭐ **COMMENCER ICI**
- **[SPRINT6_INTEGRATION_3COURBES.md](SPRINT6_INTEGRATION_3COURBES.md)** - Documentation complète

---

## Architecture 3-Courbes

```
┌────────────────────────────────────────────────────────────┐
│                    DASHBOARD 3-COURBES                      │
│           gaveurs-frontend/courbes-sprint3/                 │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 Chart.js - 3 datasets:                                 │
│                                                             │
│  1️⃣ Courbe Théorique (bleu, dashed)                        │
│     • Modèle: PySR v2 NumPy                                │
│     • Équation: dose = x2 + 64.66*x4 + 304.54              │
│     • API: GET /api/courbes/theorique/lot/{id}             │
│                                                             │
│  2️⃣ Courbe Réelle (vert, filled)                           │
│     • Source: Saisies gaveur quotidiennes                  │
│     • API: GET /api/courbes/reelle/lot/{id}                │
│                                                             │
│  3️⃣ Courbe Prédictive (orange, triangle)                   │
│     • Algorithme: v2 spline cubique + contraintes          │
│     • Étapes:                                              │
│       - Spline cubique (progression naturelle)             │
│       - Contraintes vétérinaires (sécurité)                │
│       - Lissage adaptatif (convergence)                    │
│       - Ajustement final (précision)                       │
│     • API: GET /api/courbes/predictive/lot/{id}            │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Guide de Lecture par Profil

### 👨‍💼 Manager / Product Owner

**Commencer par** :
1. [SPRINT6_RESUME.md](SPRINT6_RESUME.md) - Vue d'ensemble Sprint 6A (5 min)
2. [SPRINT5_RESUME_FINAL.md](SPRINT5_RESUME_FINAL.md) - Vue d'ensemble Sprint 5 (5 min)

**Key Metrics** :
- 3 courbes opérationnelles (théorique, réelle, prédictive)
- +50% précision algorithme v2 vs v1
- <50ms temps de calcul
- 100% contraintes vétérinaires respectées

### 👨‍💻 Développeur Backend

**Commencer par** :
1. [SPRINT6_INTEGRATION_3COURBES.md](SPRINT6_INTEGRATION_3COURBES.md) - Implémentation v2
2. [ALGO_COURBE_PREDICTIVE_V2.md](ALGO_COURBE_PREDICTIVE_V2.md) - Détails algorithme
3. [DONNEES_ENTREE_PYSR.md](DONNEES_ENTREE_PYSR.md) - Structure données

**Fichiers code** :
- `backend-api/app/routers/courbes.py` (ligne 536-667)
- `backend-api/app/services/courbe_predictive_v2.py`
- `backend-api/app/ml/pysr_predictor_numpy.py`

### 🎨 Développeur Frontend

**Commencer par** :
1. [SPRINT6_INTEGRATION_3COURBES.md](SPRINT6_INTEGRATION_3COURBES.md) - Section Frontend

**Fichiers code** :
- `gaveurs-frontend/app/lots/[id]/courbes-sprint3/page.tsx`
- `gaveurs-frontend/lib/courbes-api.ts`

### 🔬 Data Scientist / ML Engineer

**Commencer par** :
1. [DONNEES_ENTREE_PYSR.md](DONNEES_ENTREE_PYSR.md) - Dataset complet
2. [PYSR_SOLUTION_REENTRAINEMENT.md](PYSR_SOLUTION_REENTRAINEMENT.md) - Process entraînement
3. [SPRINT5_PYSR_V2_RECAP.md](SPRINT5_PYSR_V2_RECAP.md) - Détails modèle

**Fichiers** :
- `documentation/Courbes-Gavage-IA/pysrData.csv` (2868 lots)
- `backend-api/scripts/retrain_pysr_model.py`
- `backend-api/models/model_pysr_GavIA_v2.pkl`

### 🧪 QA / Testeur

**Commencer par** :
1. [SPRINT6_INTEGRATION_3COURBES.md](SPRINT6_INTEGRATION_3COURBES.md) - Section Tests

**Fichiers tests** :
- `backend-api/tests/e2e/test_3_courbes_workflow.py`

**Commandes** :
```bash
# Tests E2E backend
cd backend-api
python tests/e2e/test_3_courbes_workflow.py

# Test manuel frontend
http://localhost:3001/lots/3468/courbes-sprint3
```

---

## Documents par Type

### 📄 Résumés Exécutifs
- [SPRINT6_RESUME.md](SPRINT6_RESUME.md) - Sprint 6A (2 pages) ⭐
- [SPRINT5_RESUME_FINAL.md](SPRINT5_RESUME_FINAL.md) - Sprint 5 (3 pages)

### 📚 Documentation Complète
- [SPRINT6_INTEGRATION_3COURBES.md](SPRINT6_INTEGRATION_3COURBES.md) - Intégration 3-courbes (14 pages)
- [README_SPRINT5.md](README_SPRINT5.md) - Index Sprint 5
- [SPRINT5_FINAL_SUMMARY.md](SPRINT5_FINAL_SUMMARY.md) - Récap complet Sprint 5

### 🔧 Guides Techniques
- [DONNEES_ENTREE_PYSR.md](DONNEES_ENTREE_PYSR.md) - Structure données ML ⭐
- [ALGO_COURBE_PREDICTIVE_V2.md](ALGO_COURBE_PREDICTIVE_V2.md) - Algorithme v2
- [PYSR_SOLUTION_REENTRAINEMENT.md](PYSR_SOLUTION_REENTRAINEMENT.md) - Réentraînement
- [SPRINT5_COMPLET_SUCCESS.md](SPRINT5_COMPLET_SUCCESS.md) - Implémentation NumPy

### 🐛 Troubleshooting
- [PROBLEME_WINDOWSPATH_SOLUTION.md](PROBLEME_WINDOWSPATH_SOLUTION.md) - Pickle Windows/Linux
- [PYSR_DOCKER_SOLUTION.md](PYSR_DOCKER_SOLUTION.md) - Julia dans Docker
- [COMMENT_VERIFIER_PYSR.md](COMMENT_VERIFIER_PYSR.md) - Vérification entraînement

---

## Quick Start

### 1. Backend - Générer Courbe Théorique

```bash
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3468&age_moyen=90&poids_foie_cible=400&duree_gavage=14&race=Mulard&auto_save=false"
```

### 2. Backend - Saisir Doses Réelles

```bash
curl -X POST "http://localhost:8000/api/courbes/reelle/lot/3468/jour" \
  -H "Content-Type: application/json" \
  -d '{"jour_gavage": 1, "dose_reelle_g": 205.5}'
```

### 3. Backend - Courbe Prédictive v2

```bash
curl -X GET "http://localhost:8000/api/courbes/predictive/lot/3468"
```

### 4. Frontend - Dashboard 3-Courbes

```
http://localhost:3001/lots/3468/courbes-sprint3
```

---

## Configuration

### Variables d'Environnement

```yaml
# docker-compose.yml
environment:
  # PySR v2 - Utiliser NumPy pur (sans Julia)
  PYSR_USE_NUMPY: "true"  # Défaut, recommandé
```

### Paramètres Algorithme v2

```python
# Contraintes vétérinaires
DOSE_MIN_ABSOLUE = 200.0g
DOSE_MAX_ABSOLUE = 800.0g
INCREMENT_MAX_PAR_JOUR = 50.0g
VARIATION_MAX_PERCENT = 15%

# Par race
Mulard: dose_max=750g, increment_max=45g
Barbarie: dose_max=800g, increment_max=50g
```

---

## Métriques Clés

### Modèle PySR v2
- **MAE**: 22.3g
- **RMSE**: 31.0g
- **R²**: 0.82
- **Dataset**: 30,524 points (2868 lots)
- **Performance**: <50ms/prédiction

### Algorithme Prédictif v2
- **Précision finale**: ±5g (vs ±10g en v1)
- **Temps calcul**: <50ms (vs ~100ms en v1)
- **Contraintes vétérinaires**: 100% respectées
- **Lissage courbe**: Variance <200

---

## Support

### Questions Fréquentes

**Q: Comment réentraîner le modèle PySR v2 ?**
R: Voir [PYSR_SOLUTION_REENTRAINEMENT.md](PYSR_SOLUTION_REENTRAINEMENT.md)

**Q: Pourquoi NumPy au lieu de PySR/Julia ?**
R: Voir [PROBLEME_WINDOWSPATH_SOLUTION.md](PROBLEME_WINDOWSPATH_SOLUTION.md)

**Q: Quelles données pour l'entraînement ?**
R: Voir [DONNEES_ENTREE_PYSR.md](DONNEES_ENTREE_PYSR.md) ⭐

**Q: Comment fonctionne l'algorithme prédictif v2 ?**
R: Voir [ALGO_COURBE_PREDICTIVE_V2.md](ALGO_COURBE_PREDICTIVE_V2.md)

**Q: Les 3 courbes ne s'affichent pas ?**
R: Vérifier que le backend retourne `a_des_ecarts: true` sur l'endpoint predictive

**Q: Comment tester le workflow complet ?**
R: `cd backend-api && python tests/e2e/test_3_courbes_workflow.py`

---

**Dernière mise à jour**: 11 Janvier 2026
**Auteur**: Claude Sonnet 4.5
**Projet**: Système Gaveurs V3.0 - Euralis
