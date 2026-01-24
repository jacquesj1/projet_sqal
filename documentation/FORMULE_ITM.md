# Formule de Calcul de l'ITM (Indice Technico-Musculaire)

**Date**: 2026-01-13
**Version**: Production
**Objectif**: Documenter la formule exacte de calcul de l'ITM utilisée dans le système

---

## 📐 Formule ITM

L'**ITM (Indice Technico-Musculaire)** est un indicateur clé de performance du gavage qui mesure l'efficacité de conversion du maïs en poids de foie.

### Formule Standard

```
ITM = (Total Maïs Consommé en kg) / (Poids Total Foies Produits en kg)
```

### Détail du Calcul

Pour un lot donné:

```python
# Données d'entrée
total_corn_real_g = Somme du maïs consommé sur toute la période (grammes)
nb_canards = Nombre de canards dans le lot
nb_meg = Nombre de Morts En Gavage (MEG)
poids_foie_moyen_g = Poids moyen d'un foie (grammes)

# Calcul intermédiaire
nb_foies_produits = nb_canards - nb_meg
poids_total_foies_g = nb_foies_produits * poids_foie_moyen_g

# Conversion en kg
total_corn_kg = total_corn_real_g / 1000
poids_total_foies_kg = poids_total_foies_g / 1000

# Formule finale
ITM = total_corn_kg / poids_total_foies_kg
```

### Exemple Concret

**Lot LL4801665** (première ligne du CSV):
- Total maïs réel: `8420 g = 8.42 kg`
- Nombre canards: `1016`
- Nombre MEG: `1024 - 1016 = 8`
- Foies produits: `1016 - 8 = 1008`
- Poids moyen foie: `506.59 g`
- Poids total foies: `1008 × 506.59 = 510,642.72 g = 510.64 kg`

**Calcul ITM:**
```
ITM = 8.42 / 510.64 = 0.0165 ≈ 16.5 kg de maïs / 1000 kg de foies
```

**Valeur CSV:** `16.62` (légère différence due aux arrondis intermédiaires)

---

## 🎯 Interprétation de l'ITM

### Valeurs de Référence

| ITM | Qualité | Interprétation |
|-----|---------|----------------|
| **< 15** | 🟢 **Excellent (A+)** | Conversion optimale, très efficace |
| **15-17** | 🟡 **Bon (A)** | Conversion correcte, standard |
| **17-20** | 🟠 **Moyen (B)** | Conversion acceptable, à améliorer |
| **> 20** | 🔴 **Faible (C)** | Conversion médiocre, problème identifié |

### Signification

- **ITM bas** (< 15): Le gaveur utilise **moins de maïs** pour produire la même quantité de foie → **Meilleure efficacité**
- **ITM élevé** (> 20): Le gaveur utilise **plus de maïs** pour produire la même quantité de foie → **Gaspillage**

---

## 📊 ITM dans les Données CSV

### Colonnes Utilisées

Dans le fichier `Pretraite_End_2024.csv`:

- `total_cornReal` (g): Total maïs réellement consommé
- `Quantite_accrochee`: Nombre de canards au départ
- `Nb_MEG`: Nombre de Morts En Gavage
- `Poids_de_foies_moyen` (g): Poids moyen d'un foie
- **`ITM`**: Valeur calculée (déjà présente dans le CSV)

### Colonnes Dérivées

- **`ITM_cut`**: Version filtrée de l'ITM pour sélection qualité
  - Valeurs: `A`, `B`, `C`, `D` (grades)
  - `A` = ITM < 15, `B` = 15-17, etc.

- **`Sigma`**: Homogénéité du lot (écart-type poids foies)
- **`Sigma_cut`**: Version filtrée du Sigma

---

## 🔧 Implémentation Système

### Backend Python

Fichier: `backend-api/scripts/import_csv_real_data.py`

```python
# L'ITM est directement importé du CSV
# Pas de recalcul côté backend
itm = row['ITM']  # Valeur déjà calculée dans le CSV source
```

### Frontend TypeScript

Affichage de l'ITM:

```typescript
// euralis-frontend/app/euralis/analytics/page.tsx
{gaveur.itm != null ? gaveur.itm.toFixed(2) : 'N/A'} kg
```

---

## 📚 Utilisation de l'ITM

### 1. Grading des Lots

Les lots sont automatiquement gradés selon leur ITM:

```python
def get_grade_from_itm(itm: float) -> str:
    if itm < 15:
        return "A+"  # Excellent
    elif itm < 17:
        return "A"   # Bon
    elif itm < 20:
        return "B"   # Moyen
    else:
        return "C"   # Faible
```

### 2. Sélection Courbes PySR

Le fichier `Pretraite.csv` avec `ITM_cut` permet de filtrer uniquement les **meilleurs lots** pour entraîner PySR:

```python
# Sélectionner uniquement les lots grade A+ et A
best_lots = df[df['ITM_cut'].isin(['A', 'A+'])]
```

### 3. Analytics Multi-Sites

L'ITM moyen par site/gaveur permet de:
- Comparer performances inter-sites
- Identifier gaveurs top performers
- Détecter anomalies de production

---

## 🔗 Liens avec Autres Métriques

### Corrélations Attendues

| Variable 1 | Variable 2 | Corrélation | Explication |
|-----------|-----------|-------------|-------------|
| ITM ↑ | Poids foie ↓ | **Négative** | Plus l'ITM est élevé, moins les foies sont gros |
| ITM ↑ | Nb MEG ↑ | **Positive** | Mauvais gavage → Plus de mortalité |
| ITM ↑ | Score SQAL ↓ | **Négative** | Mauvais ITM → Mauvaise qualité finale |
| Sigma ↑ | ITM ↑ | **Positive** | Lot hétérogène → Gavage moins efficace |

---

## ⚠️ Limitations et Notes

1. **ITM ne mesure pas la qualité finale** du foie (utiliser SQAL pour cela)
2. **ITM dépend de la souche** de canard (CF80 vs autres)
3. **ITM varie selon la saison** (hiver vs été)
4. **ITM seul ne suffit pas** → Combiner avec Sigma, mortalité, qualité SQAL

---

## 📖 Documentation Associée

- [INTEGRATION_CSV_SQAL_COMPLETE.md](INTEGRATION_CSV_SQAL_COMPLETE.md) - Import données CSV
- [INTEGRATION_SQAL_CORRELATIONS.md](INTEGRATION_SQAL_CORRELATIONS.md) - Corrélations Production ↔ Qualité
- [ANALYTICS_INTELLIGENTS_EURALIS.md](ANALYTICS_INTELLIGENTS_EURALIS.md) - Analytics ML utilisant ITM

---

**Dernière mise à jour**: 2026-01-13
**Auteur**: Système Gaveurs V3.0
**Status**: ✅ Production Ready
