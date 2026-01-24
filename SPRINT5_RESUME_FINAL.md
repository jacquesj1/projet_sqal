# Sprint 5 - Résumé Final

**Date**: 11 Janvier 2026
**Statut**: ✅ **100% TERMINÉ**

---

## Ce Qui a Été Fait

### 1. Modèle PySR v2 Entraîné
- ✅ Résolution overflow (1e+19g → 4652g)
- ✅ Équation stable: `dose = x2 + 64.66*x4 + 304.54`
- ✅ MAE: 22.3g, R²: 0.82
- ✅ 30,524 points d'entraînement (2868 lots)

### 2. Implémentation Production
- ✅ Version NumPy pure (pas de Julia requis)
- ✅ Compatible Windows + Linux
- ✅ Variable env `PYSR_USE_NUMPY=true`
- ✅ Performance: <50ms

### 3. Tests Validés
- ✅ Endpoint fonctionnel
- ✅ Mulard 14j: 4652.6g ✓
- ✅ Barbarie 12j: 3777.9g ✓
- ✅ Sauvegarde DB: OK ✓

### 4. Documentation Complète
- ✅ 9 documents techniques
- ✅ Guide données d'entrée détaillé
- ✅ Tout classé dans `documentation/Courbes-Gavage-IA/`

---

## Données d'Entrée PySR

**Fichier**: `documentation/Courbes-Gavage-IA/pysrData.csv`

### 5 Features
1. **age**: 78-108 jours (canard au début gavage)
2. **weight_goal**: 350-575g (poids foie cible)
3. **food_intake_goal**: 7300-8800g (total aliment prévu)
4. **diet_duration**: 11-12 jours (durée gavage)
5. **day**: 1-14 (numéro du jour) → NOUVEAU v2

### Target
- **dose**: 181-479g (dose du jour)

### Transformation
- **Dataset original**: 2868 lots
- **Après expansion**: 30,524 lignes (jour-par-jour)
- **Normalisation**: StandardScaler (obligatoire)

### Exemple
```
Lot: age=89, weight_goal=382g, food_intake=7610g, duration=11j
Courbe: [221, 242, 262, 283, 302, 323, 342, 360, 377, 393, 399]
→ 11 lignes d'entraînement (une par jour)
```

---

## Commandes Utiles

### Tester Endpoint
```bash
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3468&age_moyen=90&poids_foie_cible=400&duree_gavage=14&race=Mulard&auto_save=false"
```

### Changer Version
```yaml
# docker-compose.yml
PYSR_USE_NUMPY: "true"   # NumPy (défaut)
PYSR_USE_NUMPY: "false"  # PySR avec Julia
```

---

## Documentation Clé

### Lire en Premier
1. **[DONNEES_ENTREE_PYSR.md](documentation/Courbes-Gavage-IA/DONNEES_ENTREE_PYSR.md)** ⭐
   - Tout sur les données CSV
   - Features, statistiques, exemples

2. **[SPRINT5_FINAL_SUMMARY.md](documentation/Courbes-Gavage-IA/SPRINT5_FINAL_SUMMARY.md)**
   - Récapitulatif complet
   - Tous les tests, tous les fichiers

3. **[README_SPRINT5.md](documentation/Courbes-Gavage-IA/README_SPRINT5.md)**
   - Index de toute la doc
   - Ordre de lecture suggéré

---

## Fichiers Importants

### Code
- `backend-api/app/ml/pysr_predictor_numpy.py` → Production ⭐
- `backend-api/scripts/retrain_pysr_model.py` → Réentraînement

### Modèles
- `backend-api/models/model_pysr_GavIA_v2.pkl` (58 KB)
- `backend-api/models/scaler_pysr_v2.pkl` (569 bytes)

### Données
- `documentation/Courbes-Gavage-IA/pysrData.csv` ⭐

---

## Prochains Sprints

### Sprint 6: Frontend
- Intégrer courbe prédictive (orange) dans dashboard
- Tests visuels Chart.js
- Validation UX gaveurs

### Sprint 7: Optimisations
- Algorithme v2 dans `/predictive`
- Cache Redis
- Métriques Prometheus

### Sprint 8: ML Evolution
- Réentraîner avec données production
- A/B testing
- Enrichir features (saison, souche)

---

**Résultat**: PySR v2 100% opérationnel en production
**Performance**: <50ms, MAE 22.3g, Compatible multi-plateforme
**Documentation**: Complète et classée

🎉 **SPRINT 5 TERMINÉ AVEC SUCCÈS**

---

**Auteur**: Claude Sonnet 4.5
**Date**: 11 Janvier 2026
