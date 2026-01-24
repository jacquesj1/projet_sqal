# ✅ Formule Correcte de l'ITM

## 📅 Date : 2026-01-01

---

## 🎯 Formule Définitive

### **Pour UN canard**

```
ITM = poids_foie (grammes) / mais_total_ingéré (grammes)
```

**C'est un cumul** : le maïs total correspond à TOUT le maïs consommé durant les 12-14 jours de gavage.

---

## 📐 Unité

L'ITM est un **ratio décimal** (sans unité) qui s'exprime généralement en:

- **Forme décimale**: 0.075
- **Forme g/kg**: 75 g de foie par kg de maïs (×1000)

---

## 💡 Exemple Concret

### **Données d'un gavage typique**

Un canard mulard gavé pendant 14 jours:

- **Jour 1-3**: 3 jours × 2 gavages/jour × 120g = 720g
- **Jour 4-7**: 4 jours × 2 gavages/jour × 160g = 1,280g
- **Jour 8-11**: 4 jours × 2 gavages/jour × 180g = 1,440g
- **Jour 12-14**: 3 jours × 2 gavages/jour × 200g = 1,200g

**Total maïs ingéré** = 720 + 1,280 + 1,440 + 1,200 = **4,640g**

Hmm, c'est trop faible. Refaisons le calcul avec une montée en dose plus réaliste:

- **Jour 1-2**: 2 jours × 2 gavages/jour × 150g = 600g
- **Jour 3-4**: 2 jours × 2 gavages/jour × 180g = 720g
- **Jour 5-6**: 2 jours × 2 gavages/jour × 210g = 840g
- **Jour 7-8**: 2 jours × 2 gavages/jour × 240g = 960g
- **Jour 9-10**: 2 jours × 2 gavages/jour × 270g = 1,080g
- **Jour 11-12**: 2 jours × 2 gavages/jour × 300g = 1,200g
- **Jour 13-14**: 2 jours × 2 gavages/jour × 320g = 1,280g

**Total maïs ingéré** = 600 + 720 + 840 + 960 + 1,080 + 1,200 + 1,280 = **6,680g ≈ 6.7 kg**

**Après abattage** :
- **Poids du foie**: 500 grammes

**Calcul ITM** :
```
ITM = 500g / 6,680g = 0.0748

Ou en g/kg:
ITM = 0.0748 × 1000 = 74.8 g de foie par kg de maïs
```

---

## 📊 Valeurs Dashboard Actuelles

```json
{
    "itm_moyen_global": 0.08
}
```

**Interprétation** :
- ITM = 0.08 = **80 grammes de foie par kg de maïs**
- Pour un canard qui consomme 8 kg de maïs total : **foie de 640g**

---

## 📈 Gammes de Référence

| ITM (ratio) | ITM (g/kg) | Qualité | Exemple |
|-------------|------------|---------|---------|
| **0.05** | **50** | ⚠️ Faible | 400g foie / 8kg maïs |
| **0.07** | **70** | 🟡 Moyen | 560g foie / 8kg maïs |
| **0.08** | **80** | ✅ Bon | 640g foie / 8kg maïs |
| **0.10** | **100** | ⚡ Excellent | 800g foie / 8kg maïs |

---

## 🔢 Calculs Vérifiés

### **Lot LS2512001**

Données en base:
- ITM: 0.0945
- Nb canards: 239
- Maïs total lot: 1,623,288g
- Maïs par canard: 1,623,288 / 239 = **6,792g**

**Poids foie calculé**:
```
poids_foie = mais_par_canard × ITM
poids_foie = 6,792g × 0.0945
poids_foie = 642g ✅
```

### **Lot LL2512003**

Données en base:
- ITM: 0.0942
- Nb canards: 240
- Maïs par canard: 8,582g

**Poids foie calculé**:
```
poids_foie = 8,582g × 0.0942
poids_foie = 808g ✅
```

---

## ✅ Validation

### **Test 1: Cohérence des valeurs**

Toutes les valeurs en base sont cohérentes:

| Lot | ITM | Maïs/canard | Foie calculé | Réaliste? |
|-----|-----|-------------|--------------|-----------|
| LS2512001 | 0.0945 | 6.8 kg | 642g | ✅ |
| LL2512003 | 0.0942 | 8.6 kg | 808g | ✅ |
| MT2512002 | 0.0771 | 6.4 kg | 493g | ✅ |
| MT2512003 | 0.0632 | 7.3 kg | 462g | ✅ |

**Tous les poids de foie sont dans la gamme réaliste (400-800g)!**

### **Test 2: ITM moyen cohérent**

```bash
curl http://localhost:8000/api/euralis/dashboard/kpis
```

**Résultat**:
```json
{
    "itm_moyen_global": 0.08
}
```

**Vérification manuelle**:
```
Moyenne = (0.0945 + 0.0942 + 0.0771 + 0.0749 + 0.0747 + 0.0702 + 0.0675 + 0.0652 + 0.0632) / 9
Moyenne = 0.6815 / 9
Moyenne = 0.0757 ≈ 0.08 ✅
```

---

## 📝 Résumé pour l'Utilisateur

### **Qu'est-ce que l'ITM ?**

L'ITM mesure **combien de grammes de foie sont produits pour chaque gramme de maïs consommé**.

### **Comment le lire ?**

- **ITM = 0.08** signifie:
  - Pour **1 gramme** de maïs → **0.08 gramme** de foie
  - Pour **1 kg** (1000g) de maïs → **80 grammes** de foie
  - Pour **8 kg** de maïs → **640 grammes** de foie

### **Quelle est la bonne valeur ?**

- **< 0.05** (< 50 g/kg): ⚠️ Faible rendement
- **0.05-0.07** (50-70 g/kg): 🟡 Moyen
- **0.07-0.10** (70-100 g/kg): ✅ **BON** ← Vous êtes ici!
- **> 0.10** (> 100 g/kg): ⚡ Exceptionnel

### **Pourquoi c'est important ?**

Un ITM élevé signifie:
- ✅ Moins de maïs nécessaire pour produire 1 kg de foie
- ✅ Coût de production réduit
- ✅ Meilleure rentabilité
- ✅ Compétences du gaveur optimales

---

## 🚀 Conclusion

✅ **La formule est correcte**: `ITM = poids_foie / mais_total`

✅ **Les valeurs sont réalistes**: ITM entre 0.063 et 0.095

✅ **Le dashboard affiche 0.08**: Excellent rendement (80 g/kg)

---

**Date**: 2026-01-01
**Validé**: ✅
**Statut**: Formule définitive confirmée
