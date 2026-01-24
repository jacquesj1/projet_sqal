# Index de Documentation - Projet Euralis Gaveurs

**Dernière mise à jour** : 12 Janvier 2026

---

## 📚 Vue d'Ensemble

Ce répertoire contient la documentation complète du projet Euralis Gaveurs, organisée par thématique et date.

**Total documentation** : 10 fichiers, ~2500 lignes
**Période** : 12 Janvier 2026 (Sessions matin + après-midi)

---

## 🗂️ Documentation par Catégorie

### Session 12 Janvier 2026 - Résumés Globaux

| Fichier | Taille | Description |
|---------|--------|-------------|
| **[SESSION_12JAN2026_COMPLETE.md](SESSION_12JAN2026_COMPLETE.md)** | ~500 lignes | 📖 **COMMENCER ICI** - Résumé complet des 2 sessions (matin + après-midi) |
| **[RESUME_SESSION_12JAN2026.md](RESUME_SESSION_12JAN2026.md)** | ~250 lignes | Résumé session matin (Analytics Phase 1) |
| **[SESSION_12JAN2026_SUITE_QUALITE.md](SESSION_12JAN2026_SUITE_QUALITE.md)** | ~650 lignes | Résumé session après-midi (Intégration qualité SQAL) |

### Analytics - Corrections Composants

| Fichier | Taille | Composants | Description |
|---------|--------|------------|-------------|
| **[CORRECTION_API_ENDPOINTS_ANALYTICS.md](CORRECTION_API_ENDPOINTS_ANALYTICS.md)** | 305 lignes | 4 | Correction endpoints API (404 errors) |
| **[CORRECTION_TREEMAP_COULEURS.md](CORRECTION_TREEMAP_COULEURS.md)** | 247 lignes | 1 | Fix "tout orange" → couleurs par statut |
| **[AMELIORATION_NETWORK_GRAPH.md](AMELIORATION_NETWORK_GRAPH.md)** | 315 lignes | 1 | 6 → 13 variables (doses, poids, ITM) |
| **[CORRECTION_NETWORK_GRAPH_VISIBILITE.md](CORRECTION_NETWORK_GRAPH_VISIBILITE.md)** | 328 lignes | 1 | Force simulation D3.js (13 nœuds espacés) |

### Qualité SQAL - Intégration

| Fichier | Taille | Description |
|---------|--------|-------------|
| **[ANALYSE_SOURCES_DONNEES_QUALITE.md](ANALYSE_SOURCES_DONNEES_QUALITE.md)** | 520 lignes | Inventaire CSV (174 col) + SQAL (40 col) + Gap analysis |
| **[CORRECTION_FORMULE_ITM_POIDS_FOIE.md](CORRECTION_FORMULE_ITM_POIDS_FOIE.md)** | 420 lignes | Correction formule ITM + validation données réelles |

### Backend - Actions Requises

| Fichier | Taille | Description |
|---------|--------|-------------|
| **[ACTIONS_BACKEND_REQUISES.md](ACTIONS_BACKEND_REQUISES.md)** | 513 lignes | Endpoints alertes à créer + code Python complet |

---

## 🎯 Guides de Démarrage Rapide

### Pour Comprendre les Corrections Analytics

**Lire dans cet ordre** :
1. [SESSION_12JAN2026_COMPLETE.md](SESSION_12JAN2026_COMPLETE.md) - Vue d'ensemble
2. [CORRECTION_API_ENDPOINTS_ANALYTICS.md](CORRECTION_API_ENDPOINTS_ANALYTICS.md) - Détails API
3. [AMELIORATION_NETWORK_GRAPH.md](AMELIORATION_NETWORK_GRAPH.md) - Variables ajoutées

**Temps de lecture** : ~30 minutes

### Pour Intégrer la Qualité SQAL

**Lire dans cet ordre** :
1. [SESSION_12JAN2026_SUITE_QUALITE.md](SESSION_12JAN2026_SUITE_QUALITE.md) - Vue d'ensemble qualité
2. [ANALYSE_SOURCES_DONNEES_QUALITE.md](ANALYSE_SOURCES_DONNEES_QUALITE.md) - Sources données
3. [CORRECTION_FORMULE_ITM_POIDS_FOIE.md](CORRECTION_FORMULE_ITM_POIDS_FOIE.md) - Formule ITM
4. [backend-api/scripts/README_SQAL_TEST_DATA.md](../backend-api/scripts/README_SQAL_TEST_DATA.md) - Générer données test

**Temps de lecture** : ~45 minutes

### Pour Implémenter les Alertes Backend

**Lire** :
1. [ACTIONS_BACKEND_REQUISES.md](ACTIONS_BACKEND_REQUISES.md) - Code complet FastAPI

**Temps de lecture** : ~20 minutes

---

## 📋 Problèmes Résolus - Index

### API Errors (404)

**Fichier** : [CORRECTION_API_ENDPOINTS_ANALYTICS.md](CORRECTION_API_ENDPOINTS_ANALYTICS.md)

**Problème** :
```
GET /api/lots/{id}/gavage 404 (Not Found)
```

**Solution** : Utiliser `courbesAPI.getDosesReelles(lotId)`

**Composants affectés** :
- CalendrierPlanningLots.tsx
- NetworkGraphCorrelations.tsx
- ViolinPlotDistributions.tsx
- HeatmapPerformance.tsx

---

### Treemap Tout Orange

**Fichier** : [CORRECTION_TREEMAP_COULEURS.md](CORRECTION_TREEMAP_COULEURS.md)

**Problème** : Tous lots affichés en orange quel que soit leur statut

**Cause** : Color scale utilisait `category='lot'` au lieu de `statut`

**Solution** : 4 changements (ajout statut, nouveau color scale, fill par statut)

**Résultat** :
- 🟠 Orange: en_preparation
- 🟢 Vert: en_gavage
- 🔵 Bleu: termine
- ⚫ Gris: abattu

---

### Corrélation Dose-Poids Invisible

**Fichier** : [AMELIORATION_NETWORK_GRAPH.md](AMELIORATION_NETWORK_GRAPH.md)

**Problème** : "J'ai du mal à penser que les doses ne soient pas corrélées au poids"

**Cause** : Seulement 6 variables, poids = valeur par défaut

**Solution** : Ajouter 7 variables (poids réels, doses min/max/totale, ITM, poids foie)

**Résultat** : 13 variables avec corrélations visibles

---

### Nœuds Network Graph Empilés

**Fichier** : [CORRECTION_NETWORK_GRAPH_VISIBILITE.md](CORRECTION_NETWORK_GRAPH_VISIBILITE.md)

**Problème** : "Je ne vois pas tous les nœuds sur le canvas"

**Cause** : Force simulation D3.js paramétrée pour 6 nœuds, pas 13

**Solution** : Ajuster 5 paramètres force simulation (charge -1000, collision 80, etc.)

**Résultat** : 13 nœuds bien espacés, labels complets lisibles

---

### Formule ITM Incorrecte

**Fichier** : [CORRECTION_FORMULE_ITM_POIDS_FOIE.md](CORRECTION_FORMULE_ITM_POIDS_FOIE.md)

**Problème** : "L'ITM devrait être lié au poids de foie, pas du canard"

**Cause** :
```typescript
poidsFoie = poidsFinal * 0.10; // 10% poids canard = faux
```

**Solution** :
```typescript
itm = lot.itm || 16.5; // ITM réel CSV
poidsFoie = doseTotale / itm; // Formule inverse
```

**Validation** : 8420g / 16.62 = 506.6g (plausible vs 600g faux)

---

### Sources de Données Floues

**Fichier** : [ANALYSE_SOURCES_DONNEES_QUALITE.md](ANALYSE_SOURCES_DONNEES_QUALITE.md)

**Problème** : "D'où sort toutes ces données ?"

**Réponse** :
- **CSV Euralis** : 174 colonnes (doses, ITM, sigma)
- **Table SQAL** : Capteurs IoT (poids foie depuis volume 3D)
- **Table lots** : Poids canard (pas foie)

**Gap** : Poids foie réel manquant → estimation depuis ITM

---

## 🔧 Composants Modifiés - Index

### Frontend Components

| Composant | Fichier Doc | Changements |
|-----------|-------------|-------------|
| **CalendrierPlanningLots** | [CORRECTION_API_ENDPOINTS_ANALYTICS.md](CORRECTION_API_ENDPOINTS_ANALYTICS.md) | API endpoint + alertes désactivées |
| **NetworkGraphCorrelations** | [AMELIORATION_NETWORK_GRAPH.md](AMELIORATION_NETWORK_GRAPH.md) + [CORRECTION_NETWORK_GRAPH_VISIBILITE.md](CORRECTION_NETWORK_GRAPH_VISIBILITE.md) + [CORRECTION_FORMULE_ITM_POIDS_FOIE.md](CORRECTION_FORMULE_ITM_POIDS_FOIE.md) | 13 variables + force simulation + ITM + tooltip |
| **ViolinPlotDistributions** | [CORRECTION_API_ENDPOINTS_ANALYTICS.md](CORRECTION_API_ENDPOINTS_ANALYTICS.md) | API endpoint + champs _g |
| **HeatmapPerformance** | [CORRECTION_API_ENDPOINTS_ANALYTICS.md](CORRECTION_API_ENDPOINTS_ANALYTICS.md) | API endpoint + code_lot |
| **TreemapRepartition** | [CORRECTION_TREEMAP_COULEURS.md](CORRECTION_TREEMAP_COULEURS.md) | Couleurs par statut (5 couleurs) |

### Frontend Pages

| Page | Fichier Doc | Changements |
|------|-------------|-------------|
| **app/alertes/page.tsx** | [ACTIONS_BACKEND_REQUISES.md](ACTIONS_BACKEND_REQUISES.md) | Désactivation API temporaire |

### Frontend Types

| Type | Fichier Doc | Changements |
|------|-------------|-------------|
| **types/lot.ts** | [SESSION_12JAN2026_SUITE_QUALITE.md](SESSION_12JAN2026_SUITE_QUALITE.md) | Interface QualiteSQAL (79 lignes) |

### Backend Routes

| Route | Fichier Doc | Changements |
|-------|-------------|-------------|
| **backend-api/app/routers/lots.py** | [SESSION_12JAN2026_SUITE_QUALITE.md](SESSION_12JAN2026_SUITE_QUALITE.md) | Endpoint `/api/lots/{id}/qualite` (162 lignes) |

---

## 🧪 Scripts et Outils

### Script Génération SQAL

**Localisation** : `backend-api/scripts/`

| Fichier | Description |
|---------|-------------|
| **generate_sqal_test_data.py** | Script Python génération données SQAL (580 lignes) |
| **generate_sqal_data.bat** | Script Windows exécution facile |
| **README_SQAL_TEST_DATA.md** | Documentation complète (450 lignes) |

**Usage** :
```bash
cd backend-api
scripts\generate_sqal_data.bat --nb-lots 5 --samples-per-lot 30
```

**Résultat** : 150 mesures SQAL réalistes (grades A+/A/B/C/REJECT)

---

## 📊 Tests à Effectuer - Index

### Tests Analytics

| Test | Fichier Doc | Composant | Temps |
|------|-------------|-----------|-------|
| **Calendrier lots visibles** | [CORRECTION_API_ENDPOINTS_ANALYTICS.md](CORRECTION_API_ENDPOINTS_ANALYTICS.md) | CalendrierPlanningLots | 2 min |
| **Treemap multi-couleurs** | [CORRECTION_TREEMAP_COULEURS.md](CORRECTION_TREEMAP_COULEURS.md) | TreemapRepartition | 2 min |
| **Network Graph 13 nœuds** | [CORRECTION_NETWORK_GRAPH_VISIBILITE.md](CORRECTION_NETWORK_GRAPH_VISIBILITE.md) | NetworkGraphCorrelations | 3 min |
| **Tooltip poids foie** | [CORRECTION_FORMULE_ITM_POIDS_FOIE.md](CORRECTION_FORMULE_ITM_POIDS_FOIE.md) | NetworkGraphCorrelations | 1 min |
| **Corrélation ITM-dose** | [AMELIORATION_NETWORK_GRAPH.md](AMELIORATION_NETWORK_GRAPH.md) | NetworkGraphCorrelations | 2 min |

### Tests Backend Qualité

| Test | Fichier Doc | Endpoint | Temps |
|------|-------------|----------|-------|
| **Générer données SQAL** | [README_SQAL_TEST_DATA.md](../backend-api/scripts/README_SQAL_TEST_DATA.md) | Script Python | 5 min |
| **Endpoint qualité** | [SESSION_12JAN2026_SUITE_QUALITE.md](SESSION_12JAN2026_SUITE_QUALITE.md) | `/api/lots/{id}/qualite` | 3 min |
| **Vérification SQL** | [README_SQAL_TEST_DATA.md](../backend-api/scripts/README_SQAL_TEST_DATA.md) | PostgreSQL | 2 min |

---

## 🚀 Prochaines Étapes - Index

### Court Terme (Cette Semaine)

**Fichier référence** : [SESSION_12JAN2026_COMPLETE.md](SESSION_12JAN2026_COMPLETE.md#prochaines-étapes)

1. ✅ Tester corrections Analytics (calendrier, treemap, network graph)
2. ✅ Générer données SQAL test
3. ✅ Tester endpoint `/api/lots/{id}/qualite`
4. ⏳ Appliquer migration `migration_add_poids_foie.sql`

### Moyen Terme (Prochaine Sprint)

**Fichier référence** : [SESSION_12JAN2026_SUITE_QUALITE.md](SESSION_12JAN2026_SUITE_QUALITE.md#prochaines-étapes)

1. ⏳ Créer composant `QualiteCard.tsx`
2. ⏳ Intégrer variables qualité dans Network Graph (16 variables)
3. ⏳ Page `/analytics/qualite`
4. ⏳ Endpoints alertes backend ([ACTIONS_BACKEND_REQUISES.md](ACTIONS_BACKEND_REQUISES.md))

### Long Terme

**Fichier référence** : [ANALYSE_SOURCES_DONNEES_QUALITE.md](ANALYSE_SOURCES_DONNEES_QUALITE.md#solutions-possibles)

1. ⏳ Import données abattoir (poids foies réels)
2. ⏳ Boucle fermée complète (gavage → SQAL → feedback → optimisation)
3. ⏳ Prédictions ML qualité (Random Forest : grade depuis paramètres)
4. ⏳ Dashboard qualité temps réel (WebSocket)

---

## 📖 Glossaire

### Termes Techniques

| Terme | Définition | Fichier Référence |
|-------|------------|-------------------|
| **ITM** | Indice de Transformation du Maïs = dose_totale (kg) / poids_foie (kg) | [CORRECTION_FORMULE_ITM_POIDS_FOIE.md](CORRECTION_FORMULE_ITM_POIDS_FOIE.md) |
| **SQAL** | Système de Qualité capteurs IoT (ToF + Spectral) | [ANALYSE_SOURCES_DONNEES_QUALITE.md](ANALYSE_SOURCES_DONNEES_QUALITE.md) |
| **VL53L8CH** | Capteur ToF (Time-of-Flight) 8×8 pour mesure 3D volume foie | [README_SQAL_TEST_DATA.md](../backend-api/scripts/README_SQAL_TEST_DATA.md) |
| **AS7341** | Capteur spectral 10 canaux (415nm-NIR) pour fraîcheur/oxydation | [README_SQAL_TEST_DATA.md](../backend-api/scripts/README_SQAL_TEST_DATA.md) |
| **Force Simulation** | Algorithme D3.js pour layout graphe (charge, collision, link) | [CORRECTION_NETWORK_GRAPH_VISIBILITE.md](CORRECTION_NETWORK_GRAPH_VISIBILITE.md) |

### Codes Couleur

| Couleur | Hex | Signification | Composants |
|---------|-----|---------------|------------|
| 🟠 Orange | `#f97316` | en_preparation | Treemap, Calendrier |
| 🟢 Vert | `#10b981` | en_gavage | Treemap, Calendrier, Network (gavage) |
| 🔵 Bleu | `#3b82f6` | termine | Treemap, Calendrier, Network (canard) |
| 🟣 Violet | `#8b5cf6` | performance | Network (ITM) |
| ⚫ Gris | `#6b7280` | abattu | Treemap, Calendrier |

### Grades Qualité

| Grade | Signification | Score Fusion | % Distribution |
|-------|---------------|--------------|----------------|
| **A+** | Excellence | 0.92-0.99 | 30% |
| **A** | Très bon | 0.82-0.92 | 40% |
| **B** | Bon | 0.70-0.82 | 20% |
| **C** | Acceptable | 0.58-0.70 | 8% |
| **REJECT** | Rejet | 0.30-0.58 | 2% |

**Fichier référence** : [README_SQAL_TEST_DATA.md](../backend-api/scripts/README_SQAL_TEST_DATA.md)

---

## 💡 Astuces de Navigation

### Recherche Rapide

**Problème spécifique** :
```markdown
CTRL+F "404" → Trouve CORRECTION_API_ENDPOINTS_ANALYTICS.md
CTRL+F "orange" → Trouve CORRECTION_TREEMAP_COULEURS.md
CTRL+F "ITM" → Trouve CORRECTION_FORMULE_ITM_POIDS_FOIE.md
CTRL+F "qualité" → Trouve ANALYSE_SOURCES_DONNEES_QUALITE.md
```

**Composant spécifique** :
```markdown
CTRL+F "NetworkGraphCorrelations" → Trouve 3 fichiers
CTRL+F "TreemapRepartition" → Trouve 1 fichier
CTRL+F "CalendrierPlanningLots" → Trouve 1 fichier
```

### Ordre de Lecture Recommandé

**Débutant** (première fois) :
1. SESSION_12JAN2026_COMPLETE.md
2. Un fichier de correction au choix
3. README_SQAL_TEST_DATA.md (pour tests)

**Développeur** (implémentation) :
1. SESSION_12JAN2026_SUITE_QUALITE.md
2. ANALYSE_SOURCES_DONNEES_QUALITE.md
3. Code source des composants

**Testeur** (validation) :
1. CORRECTION_API_ENDPOINTS_ANALYTICS.md (tests)
2. README_SQAL_TEST_DATA.md (génération)
3. SESSION_12JAN2026_COMPLETE.md (tests globaux)

---

## 📞 Contact et Contribution

**Auteur** : Claude Sonnet 4.5
**Date documentation** : 12 Janvier 2026
**Projet** : Système Gaveurs Euralis V3.0

**Pour ajouter à cette documentation** :
1. Créer fichier MD dans `gaveurs-frontend/` ou `backend-api/scripts/`
2. Mettre à jour cet index
3. Suivre format existant (# titre, ## sections, tableaux)

---

**Dernière mise à jour index** : 12 Janvier 2026, 18:00
