# 🚀 Instructions de Démarrage - Nouvelle Visualisation Clusters

**Pour tester la nouvelle carte interactive des gaveurs**

⚠️ **IMPORTANT**: Une correction critique de la logique ITM a été appliquée. Les clusters sont maintenant correctement classés (ITM bas = Excellent, ITM haut = Critique). Voir [CORRECTION_ITM_LOGIQUE.md](CORRECTION_ITM_LOGIQUE.md) pour détails.

---

## ⚡ Étapes Rapides (2 minutes)

### 1. Redémarrer le Backend

Le backend a besoin d'être redémarré pour activer le nouveau endpoint.

```bash
# Si le backend tourne déjà, l'arrêter (Ctrl+C)

# Puis redémarrer:
cd backend-api
uvicorn app.main:app --reload --port 8000
```

**Vérification**: Vous devriez voir dans les logs:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 2. Tester le Nouveau Endpoint (Optionnel)

Pour vérifier que le backend retourne bien les gaveurs individuels:

```bash
curl http://localhost:8000/api/euralis/ml/gaveurs-by-cluster
```

**Attendu**: Un JSON array avec des gaveurs comme:
```json
[
  {
    "gaveur_id": 1,
    "nom": "Martin",
    "prenom": "Jean",
    "site_code": "LL",
    "cluster": 0,              // ← 0 = Excellent (ITM <= 13)
    "itm_moyen": 12.5,         // ← ITM BAS = BON (peu de maïs, gros foie)
    "mortalite": 0.5,
    "performance_score": 0.95,
    "recommendation": "Partager bonnes pratiques avec autres"
  },
  {
    "gaveur_id": 2,
    "nom": "Dupont",
    "prenom": "Marie",
    "site_code": "LS",
    "cluster": 4,              // ← 4 = Critique (ITM > 17)
    "itm_moyen": 18.2,         // ← ITM ÉLEVÉ = MAUVAIS (beaucoup de maïs, petit foie)
    "mortalite": 3.5,
    "performance_score": 0.52,
    "recommendation": "Formation intensive + suivi quotidien"
  },
  ...
]
```

**⚠️ Vérification Importante**:
- Les gaveurs avec **ITM bas** (12-13) doivent avoir **cluster 0** (Excellent) ✅
- Les gaveurs avec **ITM élevé** (17+) doivent avoir **cluster 4** (Critique) ✅
- Si inversé, la correction n'a pas été appliquée!

### 3. Redémarrer le Frontend (si nécessaire)

Si le frontend ne tourne pas:

```bash
cd euralis-frontend
npm run dev
```

**Vérification**:
```
✓ Ready in 2.3s
○ Local:        http://localhost:3000
```

### 4. Ouvrir la Page Analytics

Dans votre navigateur:

**URL**: http://localhost:3000/euralis/analytics

Puis cliquer sur l'onglet **"Clusters Gaveurs"**

### 5. Vérifier l'Affichage

Vous devriez maintenant voir:

✅ **Carte de France** avec contour bleu
✅ **3 Sites Euralis** (points oranges):
   - LL (Lantic) - en haut à gauche (Bretagne)
   - LS (La Séguinière) - au centre-gauche (Pays de la Loire)
   - MT (Maubourguet) - en bas (Hautes-Pyrénées)

✅ **Gaveurs individuels** (cercles colorés):
   - Vert: Excellent (ITM ≥ 17)
   - Bleu: Très bon (ITM ≥ 15.5)
   - Jaune: Bon (ITM ≥ 14.5)
   - Orange: À améliorer (ITM ≥ 13)
   - Rouge: Critique (ITM < 13)

✅ **Interactions**:
   - Survol d'un gaveur → tooltip avec détails
   - Animation pulsante
   - Légende avec compteurs

### 6. Vérifier la Console (Optionnel)

Ouvrir les DevTools (F12) → Console

Vous devriez voir:
```javascript
🔍 DEBUG Gaveurs chargés: Array(15)
📊 Nombre de gaveurs: 15
```

**Si vous voyez 0 gaveurs**, voir la section Dépannage ci-dessous.

---

## 🔍 Dépannage

### Problème: Aucun gaveur ne s'affiche

**1. Vérifier la console du navigateur**
```javascript
// Devrait afficher:
📊 Nombre de gaveurs: 15

// Si affiche:
📊 Nombre de gaveurs: 0
// → Le backend ne retourne pas de données
```

**2. Vérifier l'endpoint backend**
```bash
curl http://localhost:8000/api/euralis/ml/gaveurs-by-cluster
```

Si retourne `[]` (array vide):
- Les gaveurs n'ont peut-être pas de données de lots dans la base
- Vérifier table `gaveurs_euralis` et `lots_gavage`

**3. Vérifier que le backend a bien redémarré**
```bash
curl http://localhost:8000/docs
```
Chercher l'endpoint `/api/euralis/ml/gaveurs-by-cluster` dans la documentation Swagger.

### Problème: Erreur 404 sur l'endpoint

**Cause**: Le backend n'a pas été redémarré après l'ajout du nouveau endpoint.

**Fix**:
```bash
# Terminal backend
Ctrl+C  # Arrêter
uvicorn app.main:app --reload --port 8000  # Redémarrer
```

### Problème: Erreurs NaN dans la console

**Exemple**:
```
<circle> attribute cx: Expected length, "NaN"
```

**Cause**: Données manquantes dans les objets gaveurs.

**Fix**: Déjà appliqué dans le code avec null checks. Si le problème persiste:
1. Vérifier les données retournées par l'endpoint
2. Ouvrir la console et inspecter `clustersData`

### Problème: Les sites sont mal positionnés

**Vérification**: Les positions devraient être:
- **LL** (Lantic): En haut à gauche (Bretagne)
- **LS** (La Séguinière): Au centre-gauche (Pays de la Loire)
- **MT** (Maubourguet): En bas (Hautes-Pyrénées, près de Pau)

Si ce n'est pas le cas:
1. Vérifier le fichier `euralis-frontend/app/euralis/analytics/page.tsx`
2. Lignes 634-656 doivent avoir les bonnes coordonnées SVG

---

## 📊 Que Voir sur la Carte

### Sites (Points Oranges)

| Site | Ville | Région | Position |
|------|-------|--------|----------|
| **LL** | Lantic | Bretagne | Nord-Ouest |
| **LS** | La Séguinière | Pays de la Loire | Ouest-Centre |
| **MT** | Maubourguet | Hautes-Pyrénées | Sud-Ouest |

### Gaveurs (Cercles Colorés)

⚠️ **CORRECTION APPLIQUÉE**: ITM bas = Bon (peu de maïs pour gros foie)

| Couleur | Cluster | ITM | Description | Signification |
|---------|---------|-----|-------------|---------------|
| 🟢 Vert | Excellent | **≤ 13** | Top performers | ITM bas = Très efficace |
| 🔵 Bleu | Très bon | **13-14.5** | Très bonnes performances | Bon ratio coût/rendement |
| 🟡 Jaune | Bon | **14.5-15.5** | Bonnes performances | Ratio acceptable |
| 🟠 Orange | À améliorer | **15.5-17** | Besoin d'amélioration | Ratio médiocre |
| 🔴 Rouge | Critique | **> 17** | Performances critiques | ITM élevé = Inefficace |

**Rappel ITM**: Poids maïs ingéré / Poids foie → **Plus c'est bas, mieux c'est!**

### Tooltip (au survol)

Affiche:
- Nom complet du gaveur
- Site d'attache (LL/LS/MT)
- ITM moyen en g/kg
- Mortalité en %
- Cluster et score de performance
- Recommandation personnalisée

---

## 🎯 Résumé des Changements

### Ce qui a été modifié:

1. **Backend** (`backend-api/app/routers/euralis.py`):
   - Nouveau endpoint `GET /api/euralis/ml/gaveurs-by-cluster`
   - Retourne gaveurs individuels avec leurs clusters (pas statistiques agrégées)

2. **Frontend API** (`euralis-frontend/lib/euralis/api.ts`):
   - Nouvelle méthode `getGaveursWithClusters()`
   - Appelle le nouveau endpoint

3. **Page Analytics** (`euralis-frontend/app/euralis/analytics/page.tsx`):
   - Utilise le nouveau endpoint
   - Positions géographiques corrigées
   - Gaveurs plus visibles (rayon 18px)
   - Tooltips améliorés

### Ce qui devrait maintenant fonctionner:

✅ Gaveurs visibles sur la carte (avant: invisibles)
✅ Positions géographiques correctes (avant: incorrectes)
✅ Clusters basés sur ITM réel de chaque gaveur
✅ Tooltips avec données complètes
✅ Légende avec compteurs dynamiques

---

## 📝 Notes Importantes

### Base de Données Requise

Le nouvel endpoint requiert:
- Table `gaveurs_euralis` avec colonne `site_code`
- Table `lots_gavage` avec colonnes `gaveur_id`, `itm`, `pctg_perte_gavage`
- Données de lots pour calculer les moyennes ITM

Si aucune donnée n'existe, l'endpoint retournera un array vide `[]`.

### Filtrage par Site (Optionnel)

Le nouvel endpoint supporte un paramètre `site_code`:

```bash
# Tous les gaveurs
curl http://localhost:8000/api/euralis/ml/gaveurs-by-cluster

# Seulement LL
curl http://localhost:8000/api/euralis/ml/gaveurs-by-cluster?site_code=LL

# Seulement LS
curl http://localhost:8000/api/euralis/ml/gaveurs-by-cluster?site_code=LS
```

Pour l'utiliser dans le frontend:
```typescript
// Tous les gaveurs
const gaveurs = await euralisAPI.getGaveursWithClusters();

// Filtré par site
const gaveursLL = await euralisAPI.getGaveursWithClusters('LL');
```

---

## ✅ Checklist de Vérification

Après avoir suivi les étapes ci-dessus:

- [ ] Backend redémarré et accessible sur port 8000
- [ ] Endpoint `/api/euralis/ml/gaveurs-by-cluster` retourne des données
- [ ] Frontend accessible sur http://localhost:3000
- [ ] Page Analytics affiche la carte de France
- [ ] 3 sites (LL, LS, MT) positionnés correctement
- [ ] **Gaveurs visibles** sur la carte (cercles colorés)
- [ ] Tooltips fonctionnent au survol
- [ ] Console affiche "Nombre de gaveurs: X" (X > 0)
- [ ] Légende affiche les 5 clusters avec compteurs

---

## 📚 Documentation Complète

Pour plus de détails techniques:
- **MISE_A_JOUR_CLUSTERS.md** - Documentation complète des changements
- **SOLUTION_CLUSTERS.md** - Analyse du problème initial
- **TODO_DEMAIN.md** - Planning des prochaines features

---

**Bon test! 🚀**

Si les gaveurs apparaissent sur la carte, le problème est résolu! ✅
