# 🚀 Guide d'Installation - Solution Production SQAL

## 📅 Date : 2026-01-01

---

## 🎯 Vue d'Ensemble

Ce guide vous permet d'installer la nouvelle solution de calcul de production basée sur les mesures SQAL réelles plutôt que sur l'estimation ITM.

### **Changements Principaux**

1. ✅ Simulateur SQAL calcule maintenant la masse du foie (g)
2. ✅ Nouvelle colonne `poids_foie_estime_g` en base
3. ✅ Trigger automatique pour calcul ITM
4. ✅ Formule de production utilise SQAL en priorité

---

## 📋 Prérequis

- ✅ Backend FastAPI opérationnel
- ✅ TimescaleDB accessible
- ✅ Accès PostgreSQL avec droits d'écriture
- ✅ Python 3.9+ pour le simulateur

---

## 🔧 Installation

### **Étape 1: Migrations Base de Données**

#### **1.1 Ajouter la colonne poids_foie_estime_g**

```bash
cd backend-api/scripts

# Linux/Mac
psql -U gaveurs_admin -d gaveurs_db -f migration_add_poids_foie.sql

# Windows (PowerShell)
docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db < migration_add_poids_foie.sql
```

**Vérification**:
```sql
\d sqal_sensor_samples
-- Doit afficher la colonne: poids_foie_estime_g | numeric(6,2)
```

#### **1.2 Créer le trigger ITM automatique**

```bash
# Linux/Mac
psql -U gaveurs_admin -d gaveurs_db -f migration_create_itm_trigger.sql

# Windows (PowerShell)
docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db < migration_create_itm_trigger.sql
```

**Vérification**:
```sql
\df calculate_itm_from_sqal
-- Doit afficher la fonction

SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_calculate_itm_from_sqal';
-- Doit retourner: trigger_calculate_itm_from_sqal
```

---

### **Étape 2: Redémarrer le Backend**

Le fichier `euralis.py` a été modifié avec la nouvelle formule de production.

```bash
# Si backend lancé manuellement
cd backend-api
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# Si backend en Docker
docker-compose restart backend
```

---

### **Étape 3: Pas de Modification du Simulateur Nécessaire**

Le code du simulateur a déjà été modifié. La prochaine fois que vous lancerez le simulateur, il calculera automatiquement le poids.

**Test du simulateur** (optionnel):

```bash
cd simulator-sqal
python -m pytest tests/ -v  # Si tests existent

# Ou lancer manuellement
python esp32_simulator.py
```

---

## 🧪 Tests de Validation

### **Test 1: Vérifier Installation**

```bash
cd backend-api/scripts
psql -U gaveurs_admin -d gaveurs_db -f test_production_sqal.sql
```

**Résultats attendus**:
- ✅ Test 1: Densité moyenne ≈ 0.947 g/cm³
- ✅ Test 2: Écart ITM < 0.01
- ✅ Test 3: Écart production < 1%
- ✅ Test 4: Tous les lots ont ITM
- ✅ Test 5: Poids moyen entre 400-800g
- ✅ Test 6: Production cohérente par lot

### **Test 2: API Dashboard**

```bash
curl http://localhost:8000/api/euralis/dashboard/kpis | jq
```

**Vérifier**:
```json
{
  "production_totale_kg": 1070.5,  // Doit être proche de la valeur actuelle
  "itm_moyen_global": 0.08,        // Doit rester cohérent
  "nb_lots_termines": 9
}
```

### **Test 3: Frontend Dashboard**

1. Ouvrir http://localhost:3000/euralis/dashboard
2. Vérifier carte **Production Totale**: doit afficher ~1070 kg
3. Vérifier carte **ITM Moyen Global**: doit afficher 80 g/kg

---

## 🔄 Workflow Complet

### **Avant (Ancien Système)**

```
1. Gavage enregistré → maïs_total
2. ITM fourni manuellement
3. Production estimée = maïs_total × ITM / 1000
```

### **Après (Nouveau Système)**

```
1. Gavage enregistré → maïs_total
2. Abattage → statut = 'abattu'
3. SQAL mesure volume ToF → convertit en masse
4. Stockage: poids_foie_estime_g
5. Trigger: recalcule ITM automatiquement
6. Production = Σ(poids_réels) / 1000 ✅
```

---

## 📊 Exemple Concret

### **Lot LS2512001 - Avant**

```sql
SELECT
    code_lot,
    nb_accroches,
    total_corn_real,
    itm,
    (total_corn_real * itm / 1000) as production_kg
FROM lots_gavage
WHERE code_lot = 'LS2512001';
```

**Résultat**:
```
code_lot    | nb_accroches | total_corn_real | itm    | production_kg
LS2512001   | 239          | 1623288         | 0.0945 | 153.4
```

### **Lot LS2512001 - Après**

```sql
SELECT
    l.code_lot,
    l.nb_accroches,
    COUNT(s.poids_foie_estime_g) as nb_mesures,
    AVG(s.poids_foie_estime_g) as poids_moyen_g,
    (AVG(s.poids_foie_estime_g) * l.nb_accroches / 1000) as production_kg,
    l.itm as itm_recalcule
FROM lots_gavage l
JOIN sqal_sensor_samples s ON l.id = s.lot_id
WHERE l.code_lot = 'LS2512001'
  AND s.poids_foie_estime_g IS NOT NULL
GROUP BY l.id;
```

**Résultat**:
```
code_lot  | nb_accroches | nb_mesures | poids_moyen_g | production_kg | itm_recalcule
LS2512001 | 239          | 239        | 642.0         | 153.4         | 0.0945
```

**Constatation**: Production identique mais maintenant basée sur **mesures réelles** ✅

---

## ⚠️ Rollback (Si Nécessaire)

### **En cas de problème, rollback possible**:

```sql
BEGIN;

-- Supprimer trigger
DROP TRIGGER IF EXISTS trigger_calculate_itm_from_sqal ON sqal_sensor_samples;
DROP FUNCTION IF EXISTS calculate_itm_from_sqal();

-- Supprimer colonne (ATTENTION: perte de données!)
ALTER TABLE sqal_sensor_samples DROP COLUMN IF EXISTS poids_foie_estime_g;

COMMIT;
```

### **Restaurer ancienne formule production**:

Modifier `backend-api/app/routers/euralis.py` ligne 319:

```python
# Ancienne formule (rollback)
stats = await conn.fetchrow("""
    SELECT
        SUM(
            CASE
                WHEN statut IN ('termine', 'abattu')
                     AND total_corn_real IS NOT NULL
                     AND itm IS NOT NULL
                THEN total_corn_real * itm / 1000
                ELSE 0
            END
        ) as production_totale_kg,
        ...
""")
```

---

## 📚 Documentation Associée

| Document | Description |
|----------|-------------|
| [FORMULE_MASSE_FOIE_SQAL.md](FORMULE_MASSE_FOIE_SQAL.md) | Formule physique complète |
| [SQAL_SIMULATOR_DATA_COMPLETE.md](SQAL_SIMULATOR_DATA_COMPLETE.md) | Données SQAL exhaustives |
| [SOLUTION_COMPLETE_PRODUCTION_SQAL.md](SOLUTION_COMPLETE_PRODUCTION_SQAL.md) | Solution technique |
| [README_SOLUTION_PRODUCTION.md](README_SOLUTION_PRODUCTION.md) | Résumé exécutif |

---

## ✅ Checklist Post-Installation

- [ ] Migration `migration_add_poids_foie.sql` exécutée
- [ ] Migration `migration_create_itm_trigger.sql` exécutée
- [ ] Backend redémarré
- [ ] Tests SQL passés (6/6)
- [ ] API Dashboard testé
- [ ] Frontend Dashboard testé
- [ ] Production affichée correctement (~1070 kg)
- [ ] ITM recalculé automatiquement

---

## 🆘 Dépannage

### **Problème: Colonne poids_foie_estime_g existe déjà**

```sql
-- Vérifier si colonne existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sqal_sensor_samples'
  AND column_name = 'poids_foie_estime_g';

-- Si existe, sauter migration ou supprimer/recréer
```

### **Problème: Production toujours NULL**

```sql
-- Vérifier données SQAL
SELECT COUNT(*) FROM sqal_sensor_samples WHERE poids_foie_estime_g IS NOT NULL;

-- Si 0, recalculer depuis volume
UPDATE sqal_sensor_samples
SET poids_foie_estime_g = ROUND((vl53l8ch_volume_mm3 / 1000.0) * 0.947, 1)
WHERE vl53l8ch_volume_mm3 IS NOT NULL;
```

### **Problème: Trigger ne s'exécute pas**

```sql
-- Vérifier trigger existe
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_calculate_itm_from_sqal';

-- Tester manuellement
SELECT calculate_itm_from_sqal();
```

---

## 📞 Support

En cas de problème:
1. Vérifier les logs backend: `tail -f logs/backend.log`
2. Vérifier logs PostgreSQL: `docker logs gaveurs_timescaledb`
3. Exécuter tests SQL: `psql -f test_production_sqal.sql`
4. Consulter documentation technique

---

**Date**: 2026-01-01
**Version**: 1.0.0
**Statut**: ✅ Prêt pour installation
