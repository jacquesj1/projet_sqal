# 📋 TODO List - Session de Demain

**Date de création**: 2026-01-14
**Prévue pour**: 2026-01-15

---

## 🎯 Objectifs Principaux

### 1. Améliorer la Page Clusters Gaveurs ✨
**Statut**: ✅ **TERMINÉ + AMÉLIORÉ**
**Priorité**: Haute
**Durée réelle**: 4 heures (dont 2h bonus migration Leaflet)

**Tâches**:
- [x] Créer visualisation originale des clusters (carte interactive France)
- [x] Créer nouvel endpoint backend `/api/euralis/ml/gaveurs-by-cluster`
- [x] Corriger positions géographiques (LL Bretagne, LS Pays Loire, MT Hautes-Pyrénées)
- [x] Agrandir marqueurs gaveurs (18px) et améliorer visibilité
- [x] Ajouter tooltips interactifs avec détails gaveur
- [x] Documenter solution (MISE_A_JOUR_CLUSTERS.md, INSTRUCTIONS_DEMARRAGE.md)
- [x] **BONUS**: Migration complète vers Leaflet.js (carte OpenStreetMap interactive)
- [x] **BONUS**: Correction critique logique ITM (clusters inversés)
- [x] **BONUS**: Correction endpoint corrélations (variables CSV à 0)

**Livrables**:
- ✅ Page `/euralis/analytics` avec carte Leaflet interactive
- ✅ 49 gaveurs avec données réelles affichés
- ✅ Corrélations 11 variables fonctionnelles (7 CSV + 4 SQAL)
- ✅ Documentation complète (3 fichiers MD, 1125 lignes)

---

### 2. Dashboard Analytics Feedbacks 📊
**Statut**: À démarrer
**Priorité**: Haute
**Durée estimée**: 3-4 heures

**Objectif**: Créer un dashboard complet d'analyse des retours consommateurs

#### Tâches Backend
- [ ] Créer endpoint `GET /api/analytics/feedbacks/overview`
  - Stats globales (moyenne notes, nb feedbacks, tendances)
- [ ] Créer endpoint `GET /api/analytics/feedbacks/trends`
  - Évolution notes par période (jour/semaine/mois)
- [ ] Créer endpoint `GET /api/analytics/feedbacks/correlations`
  - Corrélations feedbacks ↔ paramètres gavage (ITM, durée, etc.)
- [ ] Créer endpoint `GET /api/analytics/feedbacks/wordcloud`
  - Extraction mots-clés des commentaires

#### Tâches Frontend
- [ ] Créer page `/euralis/analytics/feedbacks`
- [ ] Composant: Stats KPIs (moyenne, total, tendance)
- [ ] Composant: Graphique évolution notes (LineChart)
- [ ] Composant: Heatmap satisfaction par lot
- [ ] Composant: Corrélations (ScatterPlot)
- [ ] Composant: Wordcloud commentaires (D3.js)
- [ ] Composant: Top/Flop lots (classement)
- [ ] Filtres période (7j, 30j, 90j, tout)

**Livrable**: Dashboard analytics feedbacks complet et fonctionnel

---

### 3. Sprint 3 - IA Courbes Optimales 🧠
**Statut**: Planification
**Priorité**: Moyenne
**Durée estimée**: 4-6 heures (jour 1 de plusieurs)

**Objectif**: Personnaliser les courbes de gavage par gaveur

#### Tâches Jour 1 - Analyse & Préparation
- [ ] Analyser les données historiques
  - Requête pour extraire performances par gaveur
  - Identifier patterns de succès
- [ ] Créer table `courbes_optimales`
  - Schéma: gaveur_id, souche, ITM_cible, courbe_json, score_performance
- [ ] Créer endpoint `GET /api/ml/gaveur/{id}/performance-history`
  - Historique complet performances gaveur
- [ ] Analyser corrélations gaveur ↔ résultats
  - ITM moyen, mortalité, durée gavage, etc.

#### ML Module (à continuer les jours suivants)
- [ ] Créer `app/ml/courbes_personnalisees.py`
- [ ] Implémenter clustering gaveurs (K-Means)
- [ ] Générer courbes optimales par cluster
- [ ] Endpoint recommandation courbe

**Livrable Jour 1**: Données analysées, table créée, endpoints de base

---

### 4. Tests & Documentation 🧪
**Statut**: Continu
**Priorité**: Moyenne
**Durée estimée**: 1 heure

**Tâches**:
- [ ] Tester le système JWT en conditions réelles
  - Login → navigation → refresh automatique → logout
- [ ] Lancer les 48 tests E2E Playwright
  - `npm run test:e2e:ui`
  - Vérifier que tous passent
- [ ] Tester les nouvelles features (si implémentées)
- [ ] Mettre à jour SESSION_RECAP.md

---

## 🚀 Planning de la Journée

### Matin (9h-12h) - 3 heures
**Focus**: Dashboard Analytics Feedbacks

- 9h00 - 9h30: Backend endpoints (overview + trends)
- 9h30 - 10h30: Backend endpoints (correlations + wordcloud)
- 10h30 - 11h00: Frontend page + routing
- 11h00 - 12h00: Composants Stats KPIs + Graphique évolution

### Après-midi (14h-18h) - 4 heures
**Focus**: Sprint 3 IA + Finalisation

- 14h00 - 15h00: Analyse données historiques gaveurs
- 15h00 - 16h00: Création table + endpoints performance
- 16h00 - 17h00: Dashboard feedbacks - Composants Heatmap + Corrélations
- 17h00 - 17h30: Dashboard feedbacks - Wordcloud + Top/Flop
- 17h30 - 18h00: Tests + Documentation

---

## 📦 Livrable de la Journée

À la fin de la journée, nous aurons:

✅ **Dashboard Analytics Feedbacks complet**:
- 4 endpoints backend
- Page frontend avec 6 composants
- Visualisations: KPIs, évolution, heatmap, corrélations, wordcloud, classement

✅ **Sprint 3 IA - Fondations**:
- Analyse données historiques
- Table courbes_optimales
- Endpoints performance gaveur
- Bases pour ML personnalisé

✅ **Tests validés**:
- JWT fonctionnel
- 48 tests E2E qui passent
- Nouvelles features testées

---

## 🎨 Visualisation Clusters Gaveurs (BONUS)

**Déjà implémenté aujourd'hui** (voir ci-dessous):
- Carte interactive des clusters
- Gaveurs positionnés géographiquement
- Couleurs par cluster (5 couleurs)
- Animations au survol
- Tooltips avec détails gaveur
- Légende interactive

**À tester demain matin** (5-10 min):
- Vérifier rendu sur `/euralis/analytics`
- Tester interactions
- Ajustements si nécessaire

---

## 📝 Notes Importantes

### Variables d'Environnement
Vérifier que `.env.local` contient:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Backend Requis
Le backend doit tourner sur port 8000:
```bash
cd backend-api
uvicorn app.main:app --reload --port 8000
```

### Base de Données
Tables requises pour analytics feedbacks:
- `consumer_feedbacks` (déjà existe)
- `consumer_products` (déjà existe)
- `lots_gavage` (déjà existe)

---

## 🔧 Commandes Utiles

```bash
# Lancer backend
cd backend-api
uvicorn app.main:app --reload --port 8000

# Lancer frontend
cd euralis-frontend
npm run dev

# Tests E2E
npm run test:e2e:ui

# Vérifier santé backend
curl http://localhost:8000/health
```

---

## 📊 Priorisation

Si manque de temps, prioriser dans cet ordre:

1. **Dashboard Analytics Feedbacks** (Priorité 1)
   - Feature très demandée
   - Complète la boucle feedback
   - Visualisations impactantes

2. **Sprint 3 IA - Fondations** (Priorité 2)
   - Analyse données
   - Endpoints de base
   - ML peut être continué plus tard

3. **Tests & Validations** (Priorité 3)
   - Important mais peut être fait en fin de journée
   - Ou début de session suivante

---

## ✅ Critères de Succès

La journée sera réussie si:

- [ ] Dashboard Analytics Feedbacks est fonctionnel avec au moins 4 visualisations
- [ ] Au moins 2 endpoints backend feedbacks sont créés et testés
- [ ] Analyse données historiques gaveurs est complétée
- [ ] Table courbes_optimales est créée
- [ ] Tests E2E passent toujours (48/48)
- [ ] Documentation est à jour

---

## 🎯 Objectif Stretch (si temps)

Si tout est terminé en avance:

- [ ] Ajouter filtres avancés au dashboard feedbacks
- [ ] Implémenter export PDF des rapports feedbacks
- [ ] Créer alertes automatiques si satisfaction < seuil
- [ ] Commencer ML module courbes personnalisées

---

**Préparé le**: 2026-01-14
**Pour le**: 2026-01-15
**Estimé**: 7-8 heures de travail

**Bonne chance pour demain! 🚀**
