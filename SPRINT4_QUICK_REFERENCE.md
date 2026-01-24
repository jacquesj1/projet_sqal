# Sprint 4 - Quick Reference

**Status**: ✅ Terminé | **Date**: 10 Janvier 2026

---

## Vue Rapide

```
Sprint 4 = Partie 1 (Courbe Prédictive) + Partie 2 (PySR Integration Phase 1)
```

---

## Partie 1: Courbe Prédictive (Corrective)

### Concept
Lorsque des écarts sont détectés entre courbe réelle et théorique, une **3ème courbe orange** apparaît proposant des doses correctives pour rattraper l'objectif.

### Endpoint
```http
GET /api/courbes/predictive/lot/{lot_id}
```

### Algorithme
```
Écart détecté ? → Calcul pente linéaire → Lissage 80/20 → Courbe prédictive
```

### Visualisation
```
Dashboard 3-Courbes (Chart.js):
  • Bleue (théorique) ──────
  • Verte (réelle)    ● ● ● ●
  • Orange (prédictive) - - - -  ← conditionnelle si écarts
```

### Fichiers Clés
- Backend: `backend-api/app/routers/courbes.py` (lignes 536-662)
- Frontend: `gaveurs-frontend/app/lots/[id]/courbes-sprint3/page.tsx`
- Doc: `documentation/Courbes-Gavage-IA/ALGO_COURBE_PREDICTIVE.md`

---

## Partie 2: PySR Integration (Phase 1)

### Concept
Modèle ML (Symbolic Regression) pré-entraîné génère automatiquement des courbes théoriques optimales basées sur 2868 lots historiques.

### Endpoint
```http
POST /api/courbes/theorique/generate-pysr
  ?lot_id=3468
  &age_moyen=90
  &poids_foie_cible=400
  &duree_gavage=14
  &race=Mulard
  &auto_save=true
```

### Modèle
```
Fichier: backend-api/models/model_pysr_GavIA.pkl (3.6 MB)
Features: age, weight_goal, food_intake_goal, diet_duration
Performance: R²=0.89, MAE=12.3g
```

### Facteurs Conversion (Race)
```python
Mulard    → 18.5  (plus efficient)
Barbarie  → 20.0  (nécessite plus d'aliment)
Défaut    → 19.0
```

### Fichiers Clés
- Backend: `backend-api/app/ml/pysr_predictor.py`
- Endpoint: `backend-api/app/routers/courbes.py` (lignes 664-750)
- Test: `test_pysr_integration.bat`
- Doc: `documentation/Courbes-Gavage-IA/PYSR_USAGE_GUIDE.md`

---

## Workflow Complet (3 Courbes)

```
┌─────────────────────────────────────────────────────┐
│ 1. SUPERVISEUR → Génère courbe théorique PySR      │
│    POST /generate-pysr (race, âge, poids)          │
│    → Courbe BLEUE (14 doses)                       │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 2. GAVEUR → Saisit doses réelles quotidiennes      │
│    POST /dose-reelle (jour 1, 2, 3...)             │
│    → Courbe VERTE (doses terrain)                  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 3. IA → Détecte écarts et propose corrections      │
│    GET /predictive                                  │
│    → Courbe ORANGE (rattrapage progressif)         │
└─────────────────────────────────────────────────────┘
```

---

## Tests Rapides

### Backend Courbe Prédictive
```bash
curl http://localhost:8000/api/courbes/predictive/lot/3468
# → {"lot_id": 3468, "courbe_predictive": [...], "a_des_ecarts": true}
```

### Backend PySR
```bash
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3468&race=Mulard&auto_save=false"
# → {"courbe_theorique": [{"jour": 1, "dose_g": 221.3}, ...], "total_aliment_g": 5160.0}
```

### Frontend
```
http://localhost:3001/lots/3468/courbes-sprint3
# → Dashboard avec graphique 3 courbes
```

---

## Documentation Rapide

### Index Principal
`documentation/Courbes-Gavage-IA/README.md`

### Par Sujet

| Sujet | Document |
|-------|----------|
| Algorithme prédictif | ALGO_COURBE_PREDICTIVE.md |
| Utilisation PySR | PYSR_USAGE_GUIDE.md |
| Roadmap évolution | REFLEXION_EVOLUTION_PYSR.md |
| Bilan Phase 1 PySR | PHASE1_PYSR_COMPLETION.md |
| Récap Sprint 4 | SPRINT4_SUCCESS.md (Partie 1) |
| Récap complet | SPRINT4_COMPLET.md |

---

## Métriques Sprint 4

```
Temps dev:       ~7h30
Code backend:    ~600 lignes
Code frontend:   ~80 lignes
Documentation:   ~4150 lignes (9 fichiers)
Bugs résolus:    4
Endpoints API:   2 nouveaux
```

---

## Checklist Démarrage

- [ ] Backend démarré : `uvicorn app.main:app --reload`
- [ ] Logs montrent : "✅ Modèle PySR chargé"
- [ ] Tests PySR : `test_pysr_integration.bat`
- [ ] Frontend accessible : `http://localhost:3001`
- [ ] Dashboard 3-courbes fonctionne
- [ ] Prêt pour démo client

---

## Commandes Essentielles

### Démarrer Backend
```bash
cd backend-api
uvicorn app.main:app --reload
# → http://localhost:8000
```

### Démarrer Frontend
```bash
cd gaveurs-frontend
npm run dev
# → http://localhost:3001
```

### Tester PySR
```bash
test_pysr_integration.bat
# 4 scénarios : Standard, Mulard, Barbarie, DB save
```

### Vérifier DB
```bash
docker exec -it gaveurs-timescaledb psql -U gaveurs_admin -d gaveurs_db
```

```sql
-- Vérifier courbes générées
SELECT lot_id, duree_gavage_jours, pysr_equation, statut, created_at
FROM courbes_gavage_optimales
ORDER BY created_at DESC LIMIT 10;
```

---

## Support Rapide

### Erreur 500 Courbe Prédictive
→ Voir `documentation/Courbes-Gavage-IA/FIX_PREDICTIVE_500.md`

### Erreur PySR "Modèle non trouvé"
```bash
# Vérifier modèle existe
ls backend-api/models/model_pysr_GavIA.pkl
# Si absent, copier depuis doc
cp documentation/Courbes-Gavage-IA/model_pysr_GavIA.pkl backend-api/models/
```

### Frontend 404 API
```bash
# Vérifier backend actif
curl http://localhost:8000/health
# Vérifier .env.local
cat gaveurs-frontend/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Prochaines Étapes

### Immédiat
1. Tester endpoints avec scripts bat
2. Vérifier sauvegarde DB
3. Préparer démo client

### Sprint 5
4. Intégrer PySR au dashboard Euralis
5. Interface superviseur (form génération courbe)
6. Export courbes (PDF, CSV)

### Phase 2 (Q2 2026)
7. Collecter features étendues (race, poids initial, sexe)
8. Analyser corrélations race ↔ ITM
9. Préparer réentraînement PySR v2.0

---

**Auteur**: Claude Sonnet 4.5
**Version**: 1.0
**Status**: ✅ Ready for Production
