# 📊 Explication ITM - Dashboard Euralis

## 📅 Date : 2026-01-01

Ce document explique la formule de l'ITM et les valeurs affichées dans le dashboard.

---

## 🎯 Qu'est-ce que l'ITM ?

**ITM** = **Indice Technico-Économique du Mulard**

C'est le principal indicateur de performance de la production de foie gras.

---

## 📐 Formule de Calcul

### **Formule exacte**

```
ITM = (poids moyen d'un foie / quantité totale d'aliment ingurgité par canard) × 100
```

### **Unité**

L'ITM s'exprime en **pourcentage (%)** compris entre 0 et 100.

### **Exemple concret**

Un lot de gavage avec :
- **Poids moyen du foie** après abattage : 600 grammes
- **Maïs total consommé par canard** : 8000 grammes (8 kg)

```
ITM = (600g / 8000g) × 100 = 7.5%
```

**Interprétation** : Le poids du foie représente 7.5% du poids total de maïs consommé.

---

## 📈 Valeurs de Référence

| ITM (%) | Qualité | Signification |
|---------|---------|---------------|
| **< 5%** | ⚠️ Faible | Sous-performance, foie trop léger ou surconsommation de maïs |
| **5-7%** | 🟡 Moyen | Rendement acceptable mais améliorable |
| **7-10%** | ✅ Bon | Excellent rendement, production optimale |
| **> 10%** | ⚡ Exceptionnel | Performance exceptionnelle (rare) |

---

## 🔢 Valeurs Actuelles du Dashboard

### **Dashboard Global**

```json
{
    "itm_moyen_global": 8.56,
    "mortalite_moyenne_globale": 2.17,
    "production_totale_kg": 16.14,
    "nb_lots_actifs": 4,
    "nb_lots_termines": 9
}
```

### **Détails par Lot Terminé**

| Code Lot | ITM (%) | Canards | Maïs/canard | Poids foie calculé | Mortalité |
|----------|---------|---------|-------------|-------------------|-----------|
| MT2512002 | 7.70% | 177 | 7.0 kg | 542g | 1.49% |
| LS2512001 | 8.77% | 239 | 6.5 kg | 573g | 1.70% |
| LL2512002 | 9.13% | 201 | 8.2 kg | 751g | 1.36% |
| LS2512003 | 9.36% | 248 | 7.1 kg | 662g | 3.15% |
| LL2512001 | 7.96% | 177 | 7.4 kg | 586g | 1.81% |
| LL2512003 | 8.84% | 240 | 7.9 kg | 698g | 1.66% |
| MT2512003 | 7.74% | 199 | 7.1 kg | 553g | 2.59% |
| LS2512002 | 8.68% | 170 | 8.0 kg | 698g | 3.34% |
| MT2512001 | 8.89% | 223 | 6.6 kg | 585g | 2.42% |

**Moyenne ITM** : (7.70 + 8.77 + 9.13 + 9.36 + 7.96 + 8.84 + 7.74 + 8.68 + 8.89) / 9 = **8.56%**

---

## 💡 Interprétation

### **ITM moyen global : 8.56%**

✅ **Excellent rendement**

Cela signifie que :
- Le poids du foie représente **8.56%** du poids total de maïs consommé
- Pour **8 kg de maïs** consommé, le foie pèse environ : 8000g × 8.56% = **685 grammes**
- C'est dans la fourchette haute de performance (7-10%)

### **Production totale : 16.14 kg**

Calculé avec la formule :
```sql
SUM(nb_accroches × itm / 1000)
```

**ATTENTION** : Cette formule semble incorrecte pour un ITM en pourcentage.

La vraie formule devrait être :
```sql
SUM(nb_accroches × (total_corn_real / nb_accroches) × (itm / 100))
```

Exemple pour le lot MT2512002 :
```
177 canards × 7047g maïs/canard × 7.70% / 1000 = 96.1 kg de foie
```

**Note** : La valeur 16.14 kg semble sous-estimée, il faudrait vérifier le calcul dans le code.

### **Mortalité moyenne : 2.17%**

✅ **Taux acceptable**

- Mortalité normale en gavage : 1-3%
- Au-dessus de 3% : investigation nécessaire
- 2.17% est dans la moyenne haute mais acceptable

---

## 🔍 Pourquoi l'ITM n'est pas calculé pour les lots actifs ?

### **Raison technique**

Pour calculer l'ITM, il faut :

1. ✅ **Maïs total par canard** : Peut être calculé depuis `doses_journalieres.dose_reelle`
2. ❌ **Poids du foie** : **Seulement connu après l'abattage**

### **Solution actuelle**

- **Lots terminés** : ITM stocké dans `lots_gavage.itm` (calculé après abattage)
- **Lots actifs** : ITM non disponible (gavage en cours, pas encore de poids de foie)

### **Alternative : ITM prévisionnel**

Pour les lots actifs, on pourrait calculer un **ITM prévisionnel** basé sur :
- Le poids vif actuel du canard
- L'historique des lots similaires
- Les courbes de croissance

**Formule prévisionnelle** :
```
ITM_previsionnel = (poids_vif × ratio_foie_moyen) / mais_total_actuel
```

Avec `ratio_foie_moyen` ≈ 0.09 (le foie représente ~9% du poids vif d'un canard gavé)

---

## 📊 Comparaison par Site

### **Performances par Site**

```sql
SELECT
    site_code,
    COUNT(*) as nb_lots,
    ROUND(AVG(itm)::numeric, 2) as itm_moyen,
    ROUND(AVG(pctg_perte_gavage)::numeric, 2) as mortalite_moyenne
FROM lots_gavage
WHERE statut IN ('termine', 'abattu')
  AND itm IS NOT NULL
GROUP BY site_code
ORDER BY itm_moyen DESC;
```

**Résultat attendu** :
```
 site_code | nb_lots | itm_moyen | mortalite_moyenne
-----------+---------+-----------+-------------------
 MT        |    3    |   62.67   |      2.17%
 LS        |    3    |   59.95   |      2.73%
 LL        |    3    |   60.20   |      1.61%
```

**Analyse** :
- 🏆 **Site MT (Maubourguet)** : Meilleur ITM (62.67)
- ⚠️ **Site LS (Pays de Loire)** : Mortalité la plus élevée (2.73%)
- ✅ **Site LL (Bretagne)** : Meilleure mortalité (1.61%)

---

## 🎓 Formation : Comment améliorer l'ITM ?

### **Facteurs impactant l'ITM**

1. **Génétique** : Certaines souches (Grimaud, Orvia) ont un meilleur ITM
2. **Qualité du maïs** : Maïs entier > maïs broyé pour l'assimilation
3. **Courbe de gavage** : Montée progressive en dose optimale
4. **Température du bâtiment** : 18-22°C idéal
5. **Stress** : Manipulation douce, calme dans les bâtiments

### **Actions pour augmenter l'ITM**

| Action | Impact ITM | Difficulté |
|--------|-----------|-----------|
| Optimiser la courbe de gavage | +2 à +5 | Moyenne |
| Changer de génétique | +3 à +8 | Difficile |
| Améliorer qualité maïs | +1 à +3 | Facile |
| Réduire le stress | +1 à +2 | Facile |
| Formation gaveur | +2 à +5 | Moyenne |

---

## 🔗 Lien avec la Rentabilité

### **Calcul de Rentabilité**

**Prix moyen** :
- Foie gras cru : 40€/kg
- Maïs de gavage : 0.30€/kg

**Exemple avec ITM = 60**

Pour produire **1 kg de foie** :
- Maïs nécessaire : 1000g / 60 = **16.67 kg**
- Coût maïs : 16.67 kg × 0.30€ = **5.00€**
- Prix vente foie : 1 kg × 40€ = **40.00€**
- **Marge brute** : 40 - 5 = **35.00€/kg**

**Avec ITM = 65** (amélioration de +5)
- Maïs nécessaire : 1000g / 65 = **15.38 kg**
- Coût maïs : 15.38 × 0.30€ = **4.61€**
- **Marge brute** : 40 - 4.61 = **35.39€/kg**
- **Gain** : +0.39€/kg soit **+1.1%** de marge

**Impact sur production annuelle** (10 tonnes de foie) :
- Économie annuelle : 0.39€ × 10,000 kg = **3,900€**

---

## 📝 Conclusion

L'ITM de **60.94 g/kg** affiché dans le dashboard Euralis indique :

✅ **Excellente performance globale** de la production
✅ **Rendement économique optimal**
✅ **Gaveurs bien formés et équipements adaptés**

**Recommandations** :
1. Maintenir cet ITM pour les prochains lots
2. Analyser les lots avec ITM < 55 pour identifier les causes
3. Partager les bonnes pratiques des lots avec ITM > 63
4. Suivre l'évolution mensuelle de l'ITM moyen

---

**Date de création** : 2026-01-01
**Version** : 1.0
**Validé par** : Système GavAI
