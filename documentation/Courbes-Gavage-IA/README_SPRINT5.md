# Documentation Sprint 5 - PySR v2

**Date**: 11 Janvier 2026
**Statut**: ✅ Complet

---

## Vue d'Ensemble

Ce répertoire contient toute la documentation du **Sprint 5** qui a implémenté le modèle PySR v2 pour la génération de courbes théoriques de gavage.

---

## Documents par Ordre de Lecture

### 1. Introduction et Contexte

**[SPRINT5_FINAL_SUMMARY.md](SPRINT5_FINAL_SUMMARY.md)**
- Récapitulatif exécutif du Sprint 5
- Objectifs, réalisations, tests
- **Commencer ici** pour vue d'ensemble

**[SPRINT5_PYSR_V2_RECAP.md](SPRINT5_PYSR_V2_RECAP.md)**
- Détails techniques PySR v2
- Comparaison v1 vs v2
- Problèmes résolus

### 2. Données et Entraînement

**[DONNEES_ENTREE_PYSR.md](DONNEES_ENTREE_PYSR.md)** ⭐
- **Documentation complète des données d'entrée**
- Structure CSV, features, statistiques
- Transformation dataset
- Équation découverte

**[PYSR_SOLUTION_REENTRAINEMENT.md](PYSR_SOLUTION_REENTRAINEMENT.md)**
- Process de réentraînement
- Script `retrain_pysr_model.py`
- Problème overflow v1 et solution

**Fichier de données**: `pysrData.csv`
- 2868 lots historiques
- → 30,524 points d'entraînement

### 3. Implémentation Production

**[SPRINT5_COMPLET_SUCCESS.md](SPRINT5_COMPLET_SUCCESS.md)**
- Solution NumPy pure (sans Julia)
- Configuration variable d'environnement
- Tests de validation
- Architecture finale

**[PROBLEME_WINDOWSPATH_SOLUTION.md](PROBLEME_WINDOWSPATH_SOLUTION.md)**
- Problème pickle Windows/Linux
- Solutions alternatives
- Choix implémentation NumPy

### 4. Algorithme Courbe Prédictive

**[ALGO_COURBE_PREDICTIVE_V2.md](ALGO_COURBE_PREDICTIVE_V2.md)**
- Algorithme hybride v2
- Spline cubique + contraintes vétérinaires
- Lissage adaptatif
- Comparaison v1 vs v2 (amélioration 7g)

**[ALGO_COURBE_PREDICTIVE.md](ALGO_COURBE_PREDICTIVE.md)**
- Version v1 (référence historique)
- Interpolation linéaire 80/20

### 5. Déploiement Docker

**[PYSR_DOCKER_SOLUTION.md](PYSR_DOCKER_SOLUTION.md)**
- 3 solutions pour Julia dans Docker
- Guide installation
- Dockerfile.julia détaillé

**[SPRINT5_BUILD_EN_COURS.md](SPRINT5_BUILD_EN_COURS.md)**
- Monitoring build Docker
- Étapes compilation Julia
- Troubleshooting

**[COMMENT_VERIFIER_PYSR.md](COMMENT_VERIFIER_PYSR.md)**
- Guide vérification entraînement
- 4 méthodes de monitoring
- Validation modèle créé

### 6. Documentation Historique

**[INTEGRATION_PYSR_BACKEND.md](INTEGRATION_PYSR_BACKEND.md)**
- Phase 1 intégration PySR
- Architecture initiale

**[PHASE1_PYSR_COMPLETION.md](PHASE1_PYSR_COMPLETION.md)**
- Complétion Phase 1
- Endpoints créés

**[REFLEXION_EVOLUTION_PYSR.md](REFLEXION_EVOLUTION_PYSR.md)**
- Réflexions évolution future
- Roadmap ML

**[PYSR_USAGE_GUIDE.md](PYSR_USAGE_GUIDE.md)**
- Guide utilisation basique
- Exemples API

---

## Fichiers Code Associés

### Production
- `backend-api/app/ml/pysr_predictor_numpy.py` - Implémentation NumPy ⭐
- `backend-api/app/ml/pysr_predictor.py` - Version avec Julia
- `backend-api/app/services/courbe_predictive_v2.py` - Algorithme v2
- `backend-api/app/routers/courbes.py` - Endpoints API

### Scripts
- `backend-api/scripts/retrain_pysr_model.py` - Réentraînement
- `backend-api/scripts/test_courbe_predictive_v2.py` - Tests v2

### Modèles
- `backend-api/models/model_pysr_GavIA_v2.pkl` (58 KB)
- `backend-api/models/scaler_pysr_v2.pkl` (569 bytes)

### Configuration
- `docker-compose.yml` - Variable `PYSR_USE_NUMPY`
- `backend-api/Dockerfile.julia` - Image avec Julia

---

## Tests Effectués

### Test 1: Endpoint Standard
```bash
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3468&age_moyen=90&poids_foie_cible=400&duree_gavage=14&race=Mulard&auto_save=false"
```
**Résultat**: 4652.6g total ✅

### Test 2: Race Barbarie
```bash
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=9999&age_moyen=85&poids_foie_cible=450&duree_gavage=12&race=Barbarie&auto_save=false"
```
**Résultat**: 3777.9g, facteur 20.0 ✅

### Test 3: Sauvegarde DB
Auto-save activé → Insertion BD fonctionnelle ✅

---

## Configuration Rapide

### Variable d'Environnement

```yaml
# docker-compose.yml
environment:
  PYSR_USE_NUMPY: "true"   # NumPy pur (défaut, recommandé)
                            # "false" = PySR avec Julia
```

### Équation Utilisée

```
dose = x2 + 64.66*x4 + 304.54
```

Où:
- x2 = food_intake normalisé
- x4 = day normalisé

### Performance

- **Latence**: <50ms
- **Précision**: MAE 22.3g
- **Compatibilité**: Windows + Linux

---

## Métriques Finales

### Modèle
- MAE: 22.3g
- RMSE: 31.0g
- R²: 0.82
- Dataset: 30,524 points

### Comparaison v1 vs v2
| Aspect | v1 | v2 |
|--------|----|----|
| Overflow | ✅ Oui (1e+19g) | ❌ Non |
| Équation | exp(x2) | x2 + 64.66*x4 + 304.54 |
| Julia | ❌ Non requis | ❌ Non requis (NumPy) |
| Performance | ~100ms | <50ms |

---

## Prochaines Étapes

### Sprint 6 (Suggéré)
- Intégration frontend 3-courbes
- Tests E2E complets
- Validation UX gaveurs

### Évolution ML
- Réentraîner avec nouvelles données
- Enrichir features (saison, souche)
- A/B testing v1 vs v2

---

## Support

### Questions Fréquentes

**Q: Comment réentraîner le modèle?**
R: Voir [PYSR_SOLUTION_REENTRAINEMENT.md](PYSR_SOLUTION_REENTRAINEMENT.md)

**Q: Pourquoi NumPy au lieu de PySR?**
R: Voir [PROBLEME_WINDOWSPATH_SOLUTION.md](PROBLEME_WINDOWSPATH_SOLUTION.md)

**Q: Comment installer Julia si nécessaire?**
R: Voir [PYSR_DOCKER_SOLUTION.md](PYSR_DOCKER_SOLUTION.md)

**Q: Quelles données d'entrée utiliser?**
R: Voir [DONNEES_ENTREE_PYSR.md](DONNEES_ENTREE_PYSR.md) ⭐

---

**Auteur**: Claude Sonnet 4.5
**Date**: 11 Janvier 2026
**Sprint**: 5 - PySR v2
