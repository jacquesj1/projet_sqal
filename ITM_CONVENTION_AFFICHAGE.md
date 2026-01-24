# 📊 Convention d'Affichage de l'ITM

## 📅 Date : 2026-01-01

---

## 🎯 Formule de Base

```
ITM = poids_foie (g) / mais_total (g)
```

**Résultat**: Un ratio décimal (ex: 0.08)

---

## 📐 Convention d'Affichage

### **En pratique, on multiplie par 100**

Pour faciliter la manipulation et la représentation, l'ITM est multiplié par 100.

### **Exemple**

Données:
- Poids foie: 600g
- Maïs total: 8000g

**Calcul**:
```
ITM = 600 / 8000 = 0.075

ITM affiché = 0.075 × 100 = 7.5
```

---

## 📊 Valeurs Actuelles

### **En Base de Données**

```sql
SELECT itm FROM lots_gavage WHERE code_lot = 'LS2512001';
-- Résultat: 0.0945
```

### **Dans l'API**

```json
{
    "itm_moyen_global": 0.08
}
```

### **Affichage Recommandé**

```
ITM moyen: 8.0
```

Ou avec unité explicite:
```
ITM moyen: 8.0 (g foie / 100g maïs)
```

Ou en g/kg:
```
ITM moyen: 80 g/kg
```

---

## 🔢 Options d'Affichage

### **Option 1: Pourcentage** (déconseillé car techniquement inexact)

```
ITM moyen: 8.0%
```

❌ Techniquement incorrect (ce n'est pas un pourcentage)
✅ Facile à comprendre pour l'utilisateur

### **Option 2: Ratio ×100** (recommandé)

```
ITM moyen: 8.0
```

✅ Mathématiquement correct
✅ Facile à manipuler
❓ Nécessite d'expliquer l'unité

### **Option 3: g/100g** (explicite)

```
ITM moyen: 8.0 g/100g
```

✅ Très clair
✅ Explicite
❌ Un peu verbose

### **Option 4: g/kg** (le plus intuitif)

```
ITM moyen: 80 g/kg
```

✅ Très intuitif ("80g de foie par kg de maïs")
✅ Correspond aux usages terrain
✅ Facile à comprendre

---

## 💡 Recommandation

**Afficher en g/kg** (Option 4)

### **Raison**

C'est l'unité la plus parlante pour les gaveurs:
- "Pour chaque kilo de maïs, je produis 80 grammes de foie"
- Correspond aux quantités manipulées sur le terrain
- Évite toute confusion avec les pourcentages

### **Conversion**

```javascript
// Backend retourne: 0.08
const itmAffiché = kpis.itm_moyen_global * 1000; // 80

// Affichage
{itmAffiché.toFixed(0)} g/kg
```

---

## 📊 Tableau de Correspondance

| Base de données | API | Affichage (×100) | Affichage (g/kg) |
|-----------------|-----|------------------|------------------|
| 0.0632 | 0.06 | 6.3 | 63 g/kg |
| 0.0702 | 0.07 | 7.0 | 70 g/kg |
| 0.0747 | 0.07 | 7.5 | 75 g/kg |
| 0.0771 | 0.08 | 7.7 | 77 g/kg |
| 0.0945 | 0.09 | 9.5 | 95 g/kg |

---

## 🔧 Modification Frontend Recommandée

### **Fichier**: `euralis-frontend/app/euralis/dashboard/page.tsx`

**Ligne 124 actuelle**:
```typescript
{kpis?.itm_moyen_global.toFixed(2) || '0.00'} kg
```

**Correction recommandée**:
```typescript
{(kpis?.itm_moyen_global * 1000).toFixed(0) || '0'} g/kg
```

**Ou** (si on préfère ×100):
```typescript
{(kpis?.itm_moyen_global * 100).toFixed(1) || '0.0'}
```

---

## ✅ Résumé

| Élément | Valeur |
|---------|--------|
| **Formule** | ITM = poids_foie / mais_total |
| **Stockage BDD** | 0.08 (ratio décimal) |
| **API** | 0.08 (ratio décimal) |
| **Affichage recommandé** | **80 g/kg** (×1000) |
| **Affichage alternatif** | 8.0 (×100) |

---

**Convention finale**: **Multiplier par 1000 et afficher en g/kg**

---

**Date**: 2026-01-01
**Statut**: Recommandation d'affichage
