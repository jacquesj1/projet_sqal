# Intégration SQAL dans l'Analyse de Corrélations Euralis

**Date**: 2026-01-13
**Version**: Production Ready
**Objectif**: Créer une boucle fermée Production ↔ Qualité via analyse de corrélations

---

## 🎯 Problématique Résolue

### Avant (Version 1)
L'analyse de corrélations n'utilisait que **7 variables CSV de production**:
- ITM, Sigma, Total corn, Nb morts, Poids foie, Durée gavage, Nb canards

**Limitation**: Aucune validation qualité objective. Impossible de corréler pratiques de production avec qualité finale du produit.

### Après (Version 2 - Actuelle)
L'analyse intègre maintenant **11 variables** (7 production + 4 qualité SQAL):

**Variables Production (CSV)**:
1. ITM - Indice Technico-Musculaire
2. Sigma - Homogénéité du lot
3. Total corn - Dose totale maïs
4. Nb morts - Mortalité
5. Poids foie réel - Poids moyen foies
6. Durée gavage - Nombre de jours
7. Nb canards - Taille du lot

**⭐ Variables Qualité (SQAL IoT)**:
8. Score qualité SQAL - Score fusion capteurs (0-1)
9. Fraîcheur IoT - Indice fraîcheur AS7341 (0-1)
10. Qualité lipides - Indice qualité graisses (0-1)
11. Oxydation - Niveau oxydation (0-1)

**Avantage**: Boucle fermée complète permettant d'identifier quelles pratiques de gavage produisent la meilleure qualité finale.

---

## 🔧 Architecture Technique

### Backend: Nouvel Endpoint SQAL

**Fichier**: `backend-api/app/routers/sqal.py`

**Endpoint ajouté**:
```python
@router.get("/integration/lots-aggregated")
async def get_quality_for_all_lots(request: Request):
    """
    Récupère statistiques qualité SQAL agrégées par lot

    Returns:
        {
            "total_lots": 56,
            "lots": [
                {
                    "lot_id": 121,
                    "nb_echantillons": 30,
                    "score_qualite_moyen": 0.8498,
                    "grade_majoritaire": "A+",
                    "tof_score_moyen": 0.8498,
                    "spectral_score_moyen": 0.8498,
                    "indice_fraicheur": 0.8257,
                    "indice_qualite_gras": 0.7726,
                    "indice_oxydation": 0.1191
                },
                ...
            ]
        }
    """
```

**Query SQL sous-jacente**:
```sql
SELECT
  lot_id,
  COUNT(*) as nb_echantillons,
  ROUND(AVG(fusion_final_score)::numeric, 4) as score_qualite_moyen,
  MODE() WITHIN GROUP (ORDER BY fusion_final_grade) as grade_majoritaire,
  ROUND(AVG(vl53l8ch_quality_score)::numeric, 4) as tof_score_moyen,
  ROUND(AVG(as7341_quality_score)::numeric, 4) as spectral_score_moyen,
  ROUND(AVG(as7341_freshness_index)::numeric, 4) as indice_fraicheur,
  ROUND(AVG(as7341_fat_quality_index)::numeric, 4) as indice_qualite_gras,
  ROUND(AVG(as7341_oxidation_index)::numeric, 4) as indice_oxydation
FROM sqal_sensor_samples
WHERE lot_id IS NOT NULL
GROUP BY lot_id
ORDER BY lot_id
```

**Performances**:
- 56 lots avec données SQAL disponibles
- ~30 échantillons par lot (1680 échantillons total)
- Agrégation en temps réel (<100ms)

---

### Frontend: Modifications Analytics

**Fichier**: `euralis-frontend/app/euralis/analytics/page.tsx`

**Modifications clés**:

#### 1. Chargement données SQAL (ligne 127-137)
```typescript
// ⭐ NOUVEAU: Charger données SQAL agrégées
const sqalResponse = await fetch(`${apiUrl}/api/sqal/integration/lots-aggregated`);
const sqalData = await sqalResponse.json();

// Créer un index des données SQAL par lot_id
const sqalByLot: { [key: number]: any } = {};
for (const sqalLot of sqalData.lots) {
  sqalByLot[sqalLot.lot_id] = sqalLot;
}

console.log(`🔬 Données SQAL chargées: ${sqalData.total_lots} lots avec métriques qualité`);
```

#### 2. Ajout variables SQAL (ligne 167-171)
```typescript
const variables: { [key: string]: number[] } = {
  // Variables CSV (production)
  itm: [], sigma: [], total_corn: [], nb_morts: [],
  poids_foie_reel: [], duree_gavage: [], nb_canards: [],
  // ⭐ NOUVELLES variables SQAL (qualité IoT)
  score_qualite: [], indice_fraicheur: [],
  indice_gras: [], indice_oxydation: [],
};
```

#### 3. Collecte données SQAL par lot (ligne 183-191)
```typescript
// ⭐ Variables SQAL (si disponibles pour ce lot)
const sqalLot = sqalByLot[lot.id];
if (sqalLot) {
  if (sqalLot.score_qualite_moyen != null)
    variables.score_qualite.push(sqalLot.score_qualite_moyen);
  if (sqalLot.indice_fraicheur != null)
    variables.indice_fraicheur.push(sqalLot.indice_fraicheur);
  if (sqalLot.indice_qualite_gras != null)
    variables.indice_gras.push(sqalLot.indice_qualite_gras);
  if (sqalLot.indice_oxydation != null)
    variables.indice_oxydation.push(sqalLot.indice_oxydation);
}
```

#### 4. Labels et catégories (ligne 223-244)
```typescript
const labels: { [key: string]: string } = {
  // Variables CSV
  itm: 'ITM', sigma: 'Homogénéité (σ)', ...
  // ⭐ Variables SQAL
  score_qualite: '🔬 Score qualité SQAL',
  indice_fraicheur: '🌡️ Fraîcheur IoT',
  indice_gras: '🧈 Qualité lipides',
  indice_oxydation: '⚗️ Oxydation',
};

const categories: { [key: string]: string } = {
  // Variables CSV
  itm: 'performance', sigma: 'performance', ...
  // ⭐ Variables SQAL → catégorie "sqal"
  score_qualite: 'sqal', indice_fraicheur: 'sqal',
  indice_gras: 'sqal', indice_oxydation: 'sqal',
};
```

#### 5. Couleur cyan pour nœuds SQAL (ligne 317-318)
```typescript
const colorScale = d3.scaleOrdinal<string>()
  .domain(['performance', 'gavage', 'qualite', 'lot', 'sqal', 'autre'])
  .range(['#8b5cf6', '#10b981', '#ec4899', '#f59e0b', '#06b6d4', '#6b7280']);
  //                                                    ^^^^^^^^ Cyan pour SQAL
```

#### 6. Interface utilisateur mise à jour
- Légende des couleurs inclut "🔵 SQAL IoT"
- Guide d'interprétation explique corrélations Production ↔ Qualité
- Exemples d'insights ajoutés pour variables SQAL

---

## 📊 Données Disponibles

### Couverture
- **58 lots CSV** avec données de production complètes
- **56 lots SQAL** avec métriques qualité IoT
- **~50 lots** ont BOTH production + qualité → corrélations possibles

### Capteurs SQAL
**VL53L8CH (Time-of-Flight)**:
- Matrice 8×8 de distances (40-80mm)
- Détection texture surface foie
- Score qualité basé sur homogénéité spatiale

**AS7341 (Spectral)**:
- 10 canaux spectraux (415nm → NIR)
- Indices calculés:
  - `freshness_index` (0-1): Fraîcheur du produit
  - `fat_quality_index` (0-1): Qualité des lipides
  - `oxidation_index` (0-1): Niveau oxydation (plus bas = mieux)

**Fusion des capteurs**:
- `fusion_final_score` (0-1): Score global qualité
- `fusion_final_grade`: A+, A, B, C, REJECT

---

## 💡 Cas d'Usage Métier

### 1. Prédiction Qualité AVANT Abattage
**Question**: Quels indicateurs de gavage prédisent un bon score qualité SQAL?

**Corrélations recherchées**:
- Si `ITM ↓ ⇔ Score qualité ↑` → Bon ITM garantit qualité
- Si `Sigma ↓ ⇔ Fraîcheur ↑` → Homogénéité améliore conservation
- Si `Nb morts ↑ ⇔ Score qualité ↓` → Mortalité impacte lot entier

**Valeur**: Intervenir PENDANT le gavage si indicateurs dérivent.

---

### 2. Optimisation Conservation Post-Abattage
**Question**: Quelles pratiques de gavage donnent foies moins oxydés?

**Corrélations recherchées**:
- Si `Durée gavage courte ⇔ Oxydation ↓` → Gaver rapidement préserve qualité
- Si `Poids foie ↑ ⇔ Qualité lipides ↓` → Gros foies = risque qualité?

**Valeur**: Adapter pratiques pour maximiser durée de conservation.

---

### 3. Benchmark Gaveurs sur Qualité Finale
**Question**: Quel gaveur produit les meilleurs scores qualité?

**Analyse**:
- Trier lots par `score_qualite_moyen` DESC
- Identifier gaveurs récurrents dans top 20%
- Analyser leurs pratiques (ITM, sigma, doses) pour best practices

**Valeur**: Formation des autres gaveurs basée sur preuves qualité.

---

### 4. Validation Grade Commercial
**Question**: Les lots gradés A+ (ITM < 15) ont-ils réellement meilleur score SQAL?

**Test de corrélation**:
- Grouper lots par grade commercial (A+, A, B)
- Comparer `score_qualite_moyen` par groupe
- Valider que grading interne correspond à qualité mesurée

**Valeur**: Confiance dans système de grading actuel.

---

## 🔬 Exemple de Résultats Attendus

### Corrélations Positives Probables
| Variable 1 | Variable 2 | Interprétation |
|-----------|-----------|----------------|
| ITM bas | Score qualité ↑ | Bon ITM = bonne qualité |
| Fraîcheur IoT ↑ | Oxydation ↓ | Produit frais = peu oxydé |
| Qualité lipides ↑ | Score qualité ↑ | Bons lipides = bon produit |
| Homogénéité ↑ | Fraîcheur ↑ | Lots homogènes mieux conservés |

### Corrélations Négatives Probables
| Variable 1 | Variable 2 | Interprétation |
|-----------|-----------|----------------|
| ITM ↑ | Score qualité ↓ | Mauvais ITM = mauvaise qualité |
| Nb morts ↑ | Fraîcheur ↓ | Mortalité impacte conservation |
| Durée gavage ↑ | Qualité lipides ↓ | Gavage long dégrade graisses |
| Oxydation ↑ | Score qualité ↓ | Oxydation = défaut qualité |

---

## 🚀 Comment Tester

### 1. Vérifier Backend
```bash
# Vérifier endpoint SQAL
curl http://localhost:8000/api/sqal/integration/lots-aggregated | python -m json.tool

# Doit retourner:
# {
#   "total_lots": 56,
#   "lots": [...]
# }
```

### 2. Accéder Frontend
```
URL: http://localhost:3000/euralis/analytics
Onglet: "Corrélations" (5ème onglet)
```

### 3. Observer Network Graph
- **11 nœuds** (au lieu de 7) si données SQAL disponibles
- **Nœuds cyan** (🔵) = Variables SQAL
- **Liens verts/rouges** montrent corrélations Production ↔ Qualité

### 4. Console Browser (F12)
```javascript
// Doit afficher:
🔬 Données SQAL chargées: 56 lots avec métriques qualité
📊 Variables collectées: itm: 58 valeurs, sigma: 58 valeurs, ...,
                         score_qualite: 50 valeurs, indice_fraicheur: 50 valeurs, ...
Network Graph: 11 nœuds, 25 liens
```

---

## 📚 Documentation Associée

- **[GUIDE_DEMO_CLIENT.md](../GUIDE_DEMO_CLIENT.md)** - Guide démo client mis à jour (section 1.4)
- **[INTEGRATION_CSV_SQAL_COMPLETE.md](INTEGRATION_CSV_SQAL_COMPLETE.md)** - Intégration globale CSV + SQAL
- **[SQAL_WEBSOCKET_DATA_FLOW.md](SQAL_WEBSOCKET_DATA_FLOW.md)** - Flux données capteurs SQAL
- **[ANALYTICS_INTELLIGENTS_EURALIS.md](ANALYTICS_INTELLIGENTS_EURALIS.md)** - Analytics ML Euralis

---

## 🎁 Valeur Ajoutée

### Pour Euralis (Superviseurs)
1. **Boucle fermée Production → Qualité** mesurable
2. **Prédiction qualité finale** dès le gavage
3. **Benchmark gaveurs** basé sur qualité objective (capteurs)
4. **Formations data-driven** sur pratiques qui maximisent qualité

### Pour Gaveurs
1. **Validation qualité** de leurs pratiques
2. **Motivation** via reconnaissance qualité (pas que quantité)
3. **Feedback objectif** (capteurs IoT vs. subjectif humain)

### Pour la Qualité (SQAL)
1. **Corrélations retour** vers production
2. **Identification causes** défauts qualité (mortalité? ITM? durée?)
3. **Traçabilité complète** lot → production → qualité

---

## 🔄 Prochaines Étapes Possibles

### Phase 1 (Actuelle) ✅
- Affichage corrélations Production ↔ Qualité
- Network graph interactif D3.js

### Phase 2 (Future)
- **Prédiction qualité** via modèle ML (Random Forest):
  ```
  Input: ITM, sigma, durée, doses
  Output: score_qualite_predit, grade_predit
  ```
- **Alertes proactives**: "Lot 3487 risque grade B (ITM 18.5 → qualité 0.65)"

### Phase 3 (Future)
- **Dashboard qualité prédictive** pour gaveurs
- **Recommandations temps réel**: "Réduire dose J10 pour améliorer qualité finale"
- **Intégration blockchain**: Traçabilité complète Production + Qualité → Consommateur

---

**Dernière mise à jour**: 2026-01-13
**Auteur**: Système Gaveurs V3.0
**Status**: ✅ Production Ready
