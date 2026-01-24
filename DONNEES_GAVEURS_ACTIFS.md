# 📊 Données Gaveurs Actifs - Multi-Sites

## 📅 Date : 2026-01-01

Ce document liste tous les gaveurs actifs avec leurs lots et gavages récents.

---

## 🎯 Résumé Global

| Métrique | Valeur |
|----------|--------|
| **Sites actifs** | 3 (LL, LS, MT) |
| **Gaveurs actifs** | 4 |
| **Lots en cours** | 4 |
| **Gavages (24h)** | 8 |
| **Total canards** | 790 |
| **Poids moyen global** | 530g |

---

## 🏭 Site LL - Bretagne

### **Gaveurs actifs** : 2

#### **1. Jean Martin** (ID: 1)
- **Lot** : `LL_JM_2024_01` (ID: 3468)
- **Statut** : en_cours
- **Canards** : 148
- **Gavages récents** :
  - J6 matin (09:19) : 175.5g dose, 520.5g poids, 1.33% mortalité
  - J5 soir (21:19) : 172.0g dose, 515.2g poids, 1.33% mortalité

#### **2. Marie Petit** (ID: 4)
- **Lot** : `LL_MP_2024_01` (ID: 3469)
- **Statut** : en_cours
- **Canards** : 197
- **Gavages récents** :
  - J8 matin (08:47) : 185.0g dose, 535.0g poids, 1.50% mortalité
  - J7 soir (20:47) : 182.0g dose, 530.0g poids, 1.50% mortalité

**Stats Site LL** :
- 🦆 Total canards : 345
- ⚖️ Poids moyen : 525.2g
- 📉 Mortalité moyenne : 1.42%
- 📊 4 gavages (24h)

---

## 🏭 Site LS - Pays de Loire

### **Gaveurs actifs** : 1

#### **1. Sophie Dubois** (ID: 2)
- **Lot** : `LS_SD_2024_01` (ID: 3470)
- **Statut** : en_cours
- **Canards** : 178
- **Gavages récents** :
  - J7 matin (10:47) : 177.0g dose, 525.0g poids, 1.11% mortalité
  - J6 soir (22:47) : 173.0g dose, 520.0g poids, 1.11% mortalité

**Stats Site LS** :
- 🦆 Total canards : 178
- ⚖️ Poids moyen : 522.5g
- 📉 Mortalité moyenne : 1.11%
- 📊 2 gavages (24h)

---

## 🏭 Site MT - Maubourguet

### **Gaveurs actifs** : 1

#### **1. Pierre Leroy** (ID: 3)
- **Lot** : `MT_PL_2024_01` (ID: 3471)
- **Statut** : en_cours
- **Canards** : 217
- **Gavages récents** :
  - J9 matin (11:17) : 192.0g dose, 545.0g poids, 1.36% mortalité
  - J8 soir (23:47) : 188.0g dose, 540.0g poids, 1.36% mortalité

**Stats Site MT** :
- 🦆 Total canards : 217
- ⚖️ Poids moyen : 542.5g
- 📉 Mortalité moyenne : 1.36%
- 📊 2 gavages (24h)

---

## 📋 Tableau Récapitulatif

| Site | Code | Gaveurs | Lots | Canards | Poids Moyen | Mortalité | Gavages 24h |
|------|------|---------|------|---------|-------------|-----------|-------------|
| Bretagne | LL | 2 | 2 | 345 | 525.2g | 1.42% | 4 |
| Pays de Loire | LS | 1 | 1 | 178 | 522.5g | 1.11% | 2 |
| Maubourguet | MT | 1 | 1 | 217 | 542.5g | 1.36% | 2 |
| **TOTAL** | - | **4** | **4** | **740** | **530.1g** | **1.30%** | **8** |

---

## 🔍 Vérification Dashboard

### **Ce qui devrait s'afficher maintenant** :

#### **Statistiques Globales** (en haut)
```
Sites actifs: 3    Total canards: 740    Poids moyen global: 530g
```

#### **Cartes par Site**

**🏭 Site Bretagne (LL)**
```
Canards: 345
Poids moyen: 525g
Mortalité moy.: 1.42%
4 gavages reçus
```

**🏭 Site Pays de Loire (LS)**
```
Canards: 178
Poids moyen: 522g
Mortalité moy.: 1.11%
2 gavages reçus
```

**🏭 Site Maubourguet (MT)**
```
Canards: 217
Poids moyen: 543g
Mortalité moy.: 1.36%
2 gavages reçus
```

#### **Activité Récente** (10 derniers gavages)
```
1. MT | MT_PL_2024_01 - Pierre Leroy | J9 ☀️ 545g  | 11:17
2. LS | LS_SD_2024_01 - Sophie Dubois | J7 ☀️ 525g  | 10:47
3. LL | LL_JM_2024_01 - Jean Martin | J6 ☀️ 521g  | 09:19
4. LL | LL_MP_2024_01 - Marie Petit | J8 ☀️ 535g  | 08:47
5. MT | MT_PL_2024_01 - Pierre Leroy | J8 🌙 540g  | 23:47
6. LS | LS_SD_2024_01 - Sophie Dubois | J6 🌙 520g  | 22:47
7. LL | LL_JM_2024_01 - Jean Martin | J5 🌙 515g  | 21:19
8. LL | LL_MP_2024_01 - Marie Petit | J7 🌙 530g  | 20:47
```

---

## 🧪 Tests de Validation

### **1. Test API Backend**
```bash
curl http://localhost:8000/api/euralis/gavages/recent?limit=20 | jq
```

**Résultat** : ✅ 8 gavages retournés

### **2. Test Base de Données**
```sql
SELECT
    l.site_code,
    COUNT(DISTINCT l.gaveur_id) as nb_gaveurs_actifs,
    COUNT(dj.time) as nb_gavages_24h
FROM lots_gavage l
LEFT JOIN doses_journalieres dj ON l.id = dj.lot_id
    AND dj.time > NOW() - INTERVAL '24 hours'
WHERE l.statut = 'en_cours'
GROUP BY l.site_code;
```

**Résultat** :
```
 site_code | nb_gaveurs_actifs | nb_gavages_24h
-----------+-------------------+----------------
 LL        |                 2 |              4
 LS        |                 1 |              2
 MT        |                 1 |              2
```

✅ **Cohérent avec nb_gaveurs_actifs du dashboard global (4 gaveurs)**

### **3. Test Frontend**
1. Ouvrir `http://localhost:3000/euralis/dashboard`
2. Login avec `superviseur@euralis.fr` / `super123`
3. Scroller vers "Supervision Temps Réel Multi-Sites"
4. Vérifier :
   - ✅ 3 cartes de sites s'affichent (LL, LS, MT)
   - ✅ Chaque site affiche ses statistiques
   - ✅ L'activité récente affiche 8 gavages

---

## 📊 Répartition des Lots

### **Lots Actifs** (statut: en_cours)
```
LL_JM_2024_01 (Jean Martin, LL)
LL_MP_2024_01 (Marie Petit, LL)
LS_SD_2024_01 (Sophie Dubois, LS)
MT_PL_2024_01 (Pierre Leroy, MT)
```

### **Lots Terminés** (statut: termine)
```
LL2512001, LL2512002, LL2512003 (Site LL)
LS2512001, LS2512002, LS2512003 (Site LS)
MT2512001, MT2512002, MT2512003 (Site MT)
```

---

## 🔄 Synchronisation avec Dashboard Global

### **Card "Gaveurs Actifs"**
```sql
SELECT COUNT(DISTINCT gaveur_id) FROM lots_gavage WHERE statut = 'en_cours';
-- Résultat: 4 ✅
```

### **Tableau "Performances par Site"**
```sql
SELECT code, nom, nb_gaveurs_actifs FROM sites_euralis ORDER BY code;
```

**Résultat** :
```
 code | nom            | nb_gaveurs_actifs
------+----------------+-------------------
 LL   | Bretagne       |                 2  ✅
 LS   | Pays de Loire  |                 1  ✅
 MT   | Maubourguet    |                 1  ✅
```

**Total** : 2 + 1 + 1 = **4 gaveurs actifs** ✅

---

## 📝 Commandes Utiles

### **Ajouter un nouveau gavage manuellement**
```sql
INSERT INTO doses_journalieres (
    time, lot_id, code_lot, jour_gavage, jour, moment,
    dose_reelle, poids_moyen, nb_vivants, taux_mortalite
)
VALUES (
    NOW(), 3471, 'MT_PL_2024_01', 9, 9, 'soir',
    195.0, 548.0, 217, 1.36
);
```

### **Rafraîchir les stats sites**
```sql
UPDATE sites_euralis s
SET nb_gaveurs_actifs = COALESCE((
    SELECT COUNT(DISTINCT gaveur_id)
    FROM lots_gavage
    WHERE site_code = s.code AND statut = 'en_cours'
), 0);
```

### **Voir tous les gavages récents**
```bash
curl http://localhost:8000/api/euralis/gavages/recent?limit=50 | jq '.[] | {site, gaveur: .gaveur_nom, lot: .code_lot, moment}'
```

---

## ✅ Conclusion

Le dashboard "Supervision Temps Réel Multi-Sites" affiche maintenant les données **complètes** pour les **3 sites** :

- ✅ **Site LL (Bretagne)** : 2 gaveurs, 4 gavages
- ✅ **Site LS (Pays de Loire)** : 1 gaveur, 2 gavages
- ✅ **Site MT (Maubourguet)** : 1 gaveur, 2 gavages

**Total** : 4 gaveurs actifs, 8 gavages dans les dernières 24h

---

**Date de création** : 2026-01-01
**Version** : 1.0
**Statut** : ✅ Données complètes pour tous les sites
