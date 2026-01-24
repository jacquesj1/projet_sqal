# Plan de Migration - Architecture Unifiée sur `lots_gavage`

## 📋 Objectif

**Unifier l'architecture sur une seule table `lots_gavage`** et supprimer les tables redondantes du système "gaveurs individuels" qui n'ont pas de sens dans le contexte métier (pas de suivi individuel des canards).

---

## 🔍 État Actuel (Problèmes Identifiés)

### Tables Redondantes à Supprimer/Modifier:

1. **`lots`** (1 row) - Doublon de `lots_gavage` (22 rows)
   - ❌ Conflit: 2 tables pour le même concept
   - ❌ Les simulateurs insèrent dans `lots_gavage`
   - ❌ Le frontend gaveurs lit `lots` (vide)
   - ✅ **Action**: SUPPRIMER et migrer vers `lots_gavage`

2. **`canards`** (50 rows) - Suivi individuel des canards
   - ❌ **Pas de sens métier**: On travaille au niveau LOT (~200 canards/lot)
   - ❌ Impossible de suivre 200 canards individuellement
   - ✅ **Action**: SUPPRIMER (pas de migration nécessaire)

3. **`gavage_data`** (175 rows) - Données de gavage par canard individuel
   - ❌ Liée à `canards(id)` - table à supprimer
   - ❌ Ancienne architecture inadaptée
   - ✅ Remplacée par: `gavage_data_lots` (1536 rows) ← Table correcte!
   - ✅ **Action**: SUPPRIMER `gavage_data`

4. **`gavage_lot_quotidien`** - Synthèse quotidienne liée à `lots`
   - ❌ Liée à l'ancienne table `lots`
   - ✅ Remplacée par: `doses_journalieres` (liée à `lots_gavage`)
   - ✅ **Action**: SUPPRIMER `gavage_lot_quotidien`

### Tables à Conserver (Architecture Correcte):

✅ **`lots_gavage`** (22 rows) - **TABLE PRINCIPALE UNIQUE**
- Lots au niveau site Euralis
- Données complètes (174 colonnes du CSV)
- Utilisée par simulateurs + euralis-frontend

✅ **`gavage_data_lots`** (1536 rows) - **HYPERTABLE TIME-SERIES CORRECTE**
- Données de gavage au niveau LOT (pas canard individuel)
- Foreign Key: `lot_gavage_id → lots_gavage(id)`
- Données par jour + repas (matin/soir)
- Poids moyen, dose moyenne, nb vivants, taux mortalité

✅ **`doses_journalieres`** - Hypertable pour dashboard Euralis
- Foreign Key: `lot_id → lots_gavage(id)`
- Données journalières agrégées

---

## 📊 Analyse des Dépendances

### Tables Pointant vers `lots` (à migrer):

```sql
canards.lot_id → lots(id)                    ❌ À SUPPRIMER (table canards supprimée)
gavage_lot_quotidien.lot_id → lots(id)       ❌ À SUPPRIMER (table supprimée)
```

### Tables Pointant vers `lots_gavage` (OK):

```sql
✅ doses_journalieres.lot_id → lots_gavage(id)
✅ alertes_euralis.lot_id → lots_gavage(id)
✅ planning_abattages.lot_id → lots_gavage(id)
✅ anomalies_detectees.lot_id → lots_gavage(id)
✅ consumer_products.lot_id → lots_gavage(id)
✅ consumer_feedback_ml_data.lot_id → lots_gavage(id)
✅ sqal_sensor_samples.lot_id → lots_gavage(id)
✅ sqal_alerts.lot_id → lots_gavage(id)
✅ gavage_data_lots.lot_gavage_id → lots_gavage(id)
✅ sqal_pending_lots.code_lot → lots_gavage(code_lot)
```

### Tables Pointant vers `canards` (à migrer):

```sql
gavage_data.canard_id → canards(id)          ❌ À SUPPRIMER (les 2 tables)
alertes.canard_id → canards(id)              ⚠️ À MIGRER vers lots_gavage
corrections_doses.canard_id → canards(id)    ⚠️ À MIGRER ou SUPPRIMER
mortalite.canard_id → canards(id)            ⚠️ Déjà dans gavage_data_lots (taux_mortalite)
predictions_courbes.canard_id → canards(id)  ⚠️ À MIGRER vers lots_gavage
```

### Tables Pointant vers `gaveurs` (OK - à conserver):

```sql
✅ lots_gavage.gaveur_id → gaveurs_euralis(id)  ← Architecture correcte
⚠️ lots.gaveur_id → gaveurs(id)                 ← À migrer avant suppression
⚠️ canards.gaveur_id → gaveurs(id)              ← À supprimer avec canards
```

---

## 🚀 Plan de Migration (8 Étapes)

### PHASE 1: PRÉPARATION (Backup + Analyse)

#### Étape 1.1: Backup Complet
```bash
docker exec gaveurs_timescaledb pg_dump -U gaveurs_admin gaveurs_db > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql
```

#### Étape 1.2: Analyser les Données à Migrer
```sql
-- Compter les données dans tables à supprimer
SELECT 'lots' as table_name, COUNT(*) FROM lots
UNION ALL
SELECT 'canards', COUNT(*) FROM canards
UNION ALL
SELECT 'gavage_data', COUNT(*) FROM gavage_data
UNION ALL
SELECT 'gavage_lot_quotidien', COUNT(*) FROM gavage_lot_quotidien
UNION ALL
SELECT 'alertes (with canard_id)', COUNT(*) FROM alertes WHERE canard_id IS NOT NULL;
```

#### Étape 1.3: Vérifier Intégrité `lots_gavage`
```sql
-- S'assurer que tous les lots simulateurs sont dans lots_gavage
SELECT code_lot, jour_actuel, statut, poids_moyen_actuel
FROM lots_gavage
WHERE code_lot IN ('LL2601001', 'LL2601002', 'LL2601003', 'LS2601001', 'LS2601003');
```

---

### PHASE 2: UNIFICATION GAVEURS (Fusionner gaveurs → gaveurs_euralis)

#### Étape 2.1: Vérifier Doublons Gaveurs
```sql
-- Vérifier si Jean Martin existe dans les 2 tables
SELECT 'gaveurs' as source, id, nom, prenom, email FROM gaveurs WHERE email = 'jean.martin@gaveur.fr'
UNION ALL
SELECT 'gaveurs_euralis', id, nom, prenom, email FROM gaveurs_euralis WHERE email = 'jean.martin@gaveur.fr';
```

#### Étape 2.2: Migrer Gaveurs Manquants
```sql
-- Insérer gaveurs de la table "gaveurs" vers "gaveurs_euralis" si pas déjà présents
INSERT INTO gaveurs_euralis (nom, prenom, email, telephone, site_code, actif)
SELECT
  g.nom,
  g.prenom,
  g.email,
  g.telephone,
  'LL' as site_code, -- Par défaut, ou extraire du code_lot
  g.actif
FROM gaveurs g
WHERE NOT EXISTS (
  SELECT 1 FROM gaveurs_euralis ge WHERE ge.email = g.email
)
ON CONFLICT (email) DO NOTHING;
```

#### Étape 2.3: Mapper Anciens IDs → Nouveaux IDs
```sql
-- Créer table temporaire de mapping
CREATE TEMP TABLE gaveurs_mapping AS
SELECT
  g_old.id as old_gaveur_id,
  g_new.id as new_gaveur_id,
  g_old.email
FROM gaveurs g_old
JOIN gaveurs_euralis g_new ON g_old.email = g_new.email;
```

---

### PHASE 3: MIGRATION LOTS (lots → lots_gavage)

#### Étape 3.1: Migrer Lot Unique de `lots`
```sql
-- Vérifier le lot à migrer
SELECT * FROM lots;

-- Insérer dans lots_gavage (adapter selon structure)
INSERT INTO lots_gavage (
  code_lot, gaveur_id, debut_lot, duree_gavage_reelle,
  genetique, nb_canards_initial, poids_moyen_actuel,
  taux_mortalite, statut, site_code, jour_actuel
)
SELECT
  l.code_lot,
  gm.new_gaveur_id, -- Utiliser mapping
  l.date_debut_gavage,
  l.nombre_jours_gavage_ecoules,
  l.genetique,
  l.nombre_canards,
  l.poids_moyen_actuel,
  l.taux_mortalite,
  CASE
    WHEN l.statut = 'en_preparation' THEN 'en_cours'
    WHEN l.statut = 'en_gavage' THEN 'en_cours'
    ELSE l.statut
  END,
  SUBSTRING(l.code_lot FROM 1 FOR 2) as site_code, -- Extraire LL, LS, MT
  l.nombre_jours_gavage_ecoules
FROM lots l
JOIN gaveurs_mapping gm ON l.gaveur_id = gm.old_gaveur_id
WHERE NOT EXISTS (
  SELECT 1 FROM lots_gavage lg WHERE lg.code_lot = l.code_lot
);
```

---

### PHASE 4: MIGRATION ALERTES (Transformer canard_id → lot_id)

#### Étape 4.1: Migrer Alertes Individuelles vers Alertes Lot
```sql
-- Transformer alertes canards → alertes lots
INSERT INTO alertes_euralis (
  time, lot_id, gaveur_id, site_code,
  type_alerte, criticite, titre, description,
  valeur_observee, acquittee
)
SELECT
  a.time,
  lg.id as lot_id,
  lg.gaveur_id,
  lg.site_code,
  a.type_alerte,
  a.criticite,
  'Alerte Lot: ' || a.titre as titre,
  'Migrée depuis alerte canard ' || c.numero_identification || ': ' || a.description,
  a.valeur_observee,
  a.acquittee
FROM alertes a
JOIN canards c ON a.canard_id = c.id
JOIN lots l ON c.lot_id = l.id
JOIN lots_gavage lg ON l.code_lot = lg.code_lot
WHERE a.canard_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

---

### PHASE 5: SUPPRESSION TABLES OBSOLÈTES

#### Étape 5.1: Désactiver Contraintes Foreign Keys
```sql
-- Lister toutes les FK pointant vers tables à supprimer
SELECT
  conname as constraint_name,
  conrelid::regclass as table_name,
  confrelid::regclass as referenced_table
FROM pg_constraint
WHERE confrelid::regclass::text IN ('lots', 'canards', 'gavage_data');
```

#### Étape 5.2: Supprimer Tables Dépendantes
```sql
-- Supprimer dans l'ordre des dépendances
DROP TABLE IF EXISTS corrections_doses CASCADE;
DROP TABLE IF EXISTS predictions_courbes CASCADE;
DROP TABLE IF EXISTS mortalite CASCADE;
DROP TABLE IF EXISTS gavage_data CASCADE;        -- Hypertable obsolète
DROP TABLE IF EXISTS gavage_lot_quotidien CASCADE; -- Remplacée par doses_journalieres
DROP TABLE IF EXISTS canards CASCADE;             -- Table sans sens métier
DROP TABLE IF EXISTS lots CASCADE;                -- Dupliquée dans lots_gavage
```

#### Étape 5.3: Nettoyer Vues Obsolètes
```sql
-- Supprimer vue canards_lots (devenue inutile)
DROP VIEW IF EXISTS canards_lots CASCADE;
```

---

### PHASE 6: MISE À JOUR BACKEND API

#### Étape 6.1: Identifier Routes Utilisant `lots`
```bash
# Rechercher dans le code backend
cd backend-api
grep -r "FROM lots " app/
grep -r "JOIN lots " app/
grep -r "INSERT INTO lots" app/
grep -r "canards" app/ --include="*.py"
```

#### Étape 6.2: Modifier Modèles Pydantic
```python
# Dans app/models/schemas.py
# SUPPRIMER:
class Canard(BaseModel):  # ❌ À supprimer
    ...

class Lot(BaseModel):      # ❌ À supprimer
    ...

# GARDER/RENOMMER:
class LotGavage(BaseModel):  # ✅ Renommer en Lot (ou garder tel quel)
    id: int
    code_lot: str
    gaveur_id: int
    site_code: str
    ...
```

#### Étape 6.3: Mettre à Jour Routes API
```python
# Exemple: Modifier routes qui lisaient 'lots'
# AVANT:
@router.get("/lots")
async def get_lots():
    query = "SELECT * FROM lots WHERE gaveur_id = $1"
    ...

# APRÈS:
@router.get("/lots")
async def get_lots():
    query = "SELECT * FROM lots_gavage WHERE gaveur_id = $1"
    ...
```

---

### PHASE 7: MISE À JOUR FRONTEND GAVEURS

#### Étape 7.1: Identifier API Calls
```bash
cd gaveurs-frontend
grep -r "'/api/lots'" src/
grep -r "'/api/canards'" src/
```

#### Étape 7.2: Mettre à Jour Appels API
```typescript
// AVANT:
const lots = await fetch('/api/lots');

// APRÈS: (même endpoint mais lit lots_gavage côté backend)
const lots = await fetch('/api/lots'); // Pas de changement frontend!
```

#### Étape 7.3: Supprimer Composants Canards Individuels
```bash
# Supprimer pages/composants liés aux canards individuels
rm -rf src/components/canards/
rm -rf src/pages/canards/
```

---

### PHASE 8: TESTS ET VALIDATION

#### Étape 8.1: Vérifier Intégrité Données
```sql
-- Vérifier que tous les lots ont un gaveur valide
SELECT lg.code_lot, lg.gaveur_id, ge.nom, ge.prenom
FROM lots_gavage lg
LEFT JOIN gaveurs_euralis ge ON lg.gaveur_id = ge.id
WHERE ge.id IS NULL;

-- Vérifier que gavage_data_lots a des données
SELECT
  lg.code_lot,
  COUNT(gdl.*) as nb_entries,
  MIN(gdl.time) as first_entry,
  MAX(gdl.time) as last_entry
FROM lots_gavage lg
LEFT JOIN gavage_data_lots gdl ON lg.id = gdl.lot_gavage_id
GROUP BY lg.code_lot
ORDER BY lg.code_lot;
```

#### Étape 8.2: Tester Frontend Jean Martin
```bash
# Se connecter comme Jean Martin sur gaveurs-frontend
# Email: jean.martin@gaveur.fr
# Vérifier que les lots LL2601001, LL2601002, LL2601003 apparaissent
```

#### Étape 8.3: Tester Simulateurs
```bash
# Vérifier que les simulateurs insèrent toujours dans gavage_data_lots
docker logs gaveurs_simulator_gavage_realtime --tail 50

# Vérifier insertion en base
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db \
  -c "SELECT COUNT(*) FROM gavage_data_lots WHERE time > NOW() - INTERVAL '1 hour';"
```

---

## 🎯 Architecture Finale (Simplifiée)

### Tables Principales:

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE UNIFIÉE                      │
└─────────────────────────────────────────────────────────────┘

📦 LOTS (1 seule table)
  └─ lots_gavage (22 rows)
       ├─ code_lot (PK, UNIQUE)
       ├─ gaveur_id → gaveurs_euralis(id)
       ├─ site_code → sites_euralis(code)
       └─ jour_actuel, statut, poids_moyen_actuel...

⏱️ DONNÉES TIME-SERIES (Hypertables)
  ├─ gavage_data_lots ← LOT-LEVEL (1536 rows) ✅ PRINCIPALE
  │    ├─ lot_gavage_id → lots_gavage(id)
  │    ├─ jour_gavage, repas (matin/soir)
  │    ├─ dose_moyenne, poids_moyen_lot
  │    └─ nb_canards_vivants, taux_mortalite
  │
  └─ doses_journalieres ← EURALIS DASHBOARD
       ├─ lot_id → lots_gavage(id)
       ├─ jour, moment
       └─ dose_theorique, dose_reelle

👥 GAVEURS (1 seule table)
  └─ gaveurs_euralis
       ├─ id, nom, prenom, email
       ├─ site_code → sites_euralis(code)
       └─ actif

🏢 SITES
  └─ sites_euralis (3 sites: LL, LS, MT)

❌ SUPPRIMÉES:
  ├─ lots (doublon de lots_gavage)
  ├─ canards (pas de sens métier)
  ├─ gavage_data (remplacée par gavage_data_lots)
  └─ gavage_lot_quotidien (remplacée par doses_journalieres)
```

---

## 📝 Script SQL Complet de Migration

Voir fichier: `migration_unification_lots.sql`

---

## ⚠️ Risques et Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Perte données alertes canards | Moyen | Migration vers alertes_euralis avec contexte |
| Frontend gaveurs ne fonctionne plus | Élevé | Backup + tests intensifs avant production |
| Simulateurs cassés | Élevé | Déjà OK - utilisent gavage_data_lots |
| Rollback complexe | Élevé | Backup PostgreSQL complet avant migration |

---

## ✅ Checklist de Validation Post-Migration

- [ ] Backup réussi et testé
- [ ] Migration gaveurs OK (gaveurs → gaveurs_euralis)
- [ ] Migration lots OK (lots → lots_gavage)
- [ ] Migration alertes OK
- [ ] Tables obsolètes supprimées
- [ ] Backend API mis à jour et testé
- [ ] Frontend gaveurs mis à jour et testé
- [ ] Jean Martin voit ses 3 lots (LL2601001, LL2601002, LL2601003)
- [ ] Simulateurs continuent d'insérer dans gavage_data_lots
- [ ] Dashboard Euralis fonctionne
- [ ] Tests E2E passent
- [ ] Documentation mise à jour

---

## 📚 Fichiers à Créer

1. `migration_unification_lots.sql` - Script SQL complet
2. `rollback_migration.sql` - Script de rollback en cas de problème
3. `test_post_migration.sql` - Tests de validation
4. `CHANGELOG_MIGRATION.md` - Log des changements

---

**Date**: 08 Janvier 2026
**Version**: 1.0
**Auteur**: Claude Code
**Statut**: ✅ PLAN VALIDÉ - PRÊT POUR EXÉCUTION
