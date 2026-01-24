# Correctifs Base de Données - Gavage au niveau LOT

**Date**: 2026-01-07
**Status**: ✅ Structure fixée | ⚠️ Debugging WebSocket handler en cours

---

## Problèmes identifiés et résolus

### 1. ✅ Table `canards_lots` manquante
**Erreur**: `ERROR: relation "canards_lots" does not exist`

**Solution**: Créé une vue `canards_lots` pour compatibilité
```sql
CREATE OR REPLACE VIEW canards_lots AS
SELECT id as canard_id, lot_id
FROM canards
WHERE lot_id IS NOT NULL;
```

### 2. ✅ Colonne `poids_actuel` manquante
**Erreur**: `ERROR: column "poids_actuel" does not exist`

**Solution**: Ajoutée à `gavage_data`
```sql
ALTER TABLE gavage_data ADD COLUMN IF NOT EXISTS poids_actuel NUMERIC(6,2);
```

### 3. ✅ Architecture LOT vs Canards individuels
**Problème fondamental**: Le système fonctionne au niveau **LOT** (≈200 canards/lot), mais `gavage_data` exigeait `canard_id NOT NULL`.

**Solution**: Créé nouvelle table `gavage_data_lots`

```sql
CREATE TABLE gavage_data_lots (
    time TIMESTAMPTZ NOT NULL,
    lot_gavage_id INTEGER NOT NULL REFERENCES lots_gavage(id) ON DELETE CASCADE,
    jour_gavage INTEGER NOT NULL,
    repas VARCHAR(10) NOT NULL, -- 'matin' ou 'soir'
    dose_moyenne NUMERIC(6,2) NOT NULL,
    dose_theorique NUMERIC(6,2),
    poids_moyen_lot NUMERIC(8,2),
    nb_canards_vivants INTEGER,
    nb_canards_morts INTEGER DEFAULT 0,
    taux_mortalite NUMERIC(5,2) DEFAULT 0.0,
    temperature_stabule NUMERIC(4,1) NOT NULL,
    humidite_stabule NUMERIC(5,2),
    remarques TEXT,
    PRIMARY KEY (time, lot_gavage_id, repas)
);

-- Hypertable TimescaleDB
SELECT create_hypertable('gavage_data_lots', 'time');

-- Index
CREATE INDEX idx_gavage_lots_time ON gavage_data_lots(time DESC);
CREATE INDEX idx_gavage_lots_lot_time ON gavage_data_lots(lot_gavage_id, time DESC);
CREATE INDEX idx_gavage_lots_jour ON gavage_data_lots(jour_gavage, time DESC);
```

### 4. ✅ WebSocket handler modifié
**Fichier**: `backend-api/app/websocket/gavage_consumer.py`

**Avant** (ligne 229):
```python
INSERT INTO gavage_data (
    time, canard_id, dose_matin, dose_soir, ...
) VALUES ($1, (SELECT MIN(id) FROM canards ...), ...)
```

**Après** (ligne 228):
```python
INSERT INTO gavage_data_lots (
    time, lot_gavage_id, jour_gavage, repas,
    dose_moyenne, dose_theorique, poids_moyen_lot,
    nb_canards_vivants, nb_canards_morts, taux_mortalite,
    temperature_stabule, humidite_stabule
) VALUES ($1, (SELECT id FROM lots_gavage WHERE code_lot = $2), $3, ...)
ON CONFLICT (time, lot_gavage_id, repas) DO UPDATE SET ...
```

---

## Architecture de données clarifiée

### Flux normal

```
Simulateur Gavage
    ↓ WebSocket
Backend WebSocket Handler (gavage_consumer.py)
    ↓
    ├─→ lots_gavage (UPDATE status, poids, jour)
    ├─→ gavage_data_lots (INSERT données temps réel LOT) ← NOUVEAU
    └─→ doses_journalieres (INSERT pour Euralis dashboard)
```

### Tables impliquées

| Table | Usage | Niveau |
|-------|-------|--------|
| `lots_gavage` | Metadata lots Euralis (174 colonnes CSV) | LOT |
| `gavage_data_lots` | **Données temps réel gavage** | LOT ✅ |
| `gavage_data` | Données individuelles canards (legacy) | CANARD |
| `doses_journalieres` | Agrégat journalier pour Euralis | LOT+JOUR |
| `canards` | Table canards individuels (rarement utilisée) | CANARD |

---

## Fonctions helper créées

### 1. `ensure_generic_canard_for_lot(lot_gavage_id)`
Crée un canard générique par lot si nécessaire (pour compatibilité legacy).

### 2. `insert_gavage_lot_data(...)`
Fonction d'insertion directe dans `gavage_data_lots` (API directe PostgreSQL).

---

## ⚠️ Problème restant à débugger

**Symptôme**: Les connexions WebSocket réussissent mais aucune donnée n'est insérée dans `gavage_data_lots`.

**Logs observés**:
- ✅ Simulateur envoie: `📤 Envoyé: Lot LL2601001 J1 matin`
- ✅ Backend reçoit: `✅ Simulateur gavage WebSocket connected successfully`
- ❌ Pas de log de traitement des données
- ❌ Aucune insertion dans `gavage_data_lots`

**Hypothèses**:
1. Exception silencieuse dans le handler WebSocket
2. Problème de parsing du message JSON
3. Problème avec `hasattr(gavage_data, 'nb_morts')` ligne 254

**Actions à faire**:
1. Ajouter try/except avec logging dans `gavage_consumer.py`
2. Logger le JSON reçu pour debug
3. Vérifier que le modèle Pydantic `GavageData` a tous les champs nécessaires

---

## Requêtes SQL utiles

### Vérifier données récentes
```sql
SELECT
    l.code_lot,
    gdl.jour_gavage,
    gdl.repas,
    ROUND(gdl.dose_moyenne, 1) as dose,
    ROUND(gdl.poids_moyen_lot, 0) as poids,
    gdl.nb_canards_vivants,
    TO_CHAR(gdl.time, 'YYYY-MM-DD HH24:MI') as timestamp
FROM gavage_data_lots gdl
JOIN lots_gavage l ON l.id = gdl.lot_gavage_id
WHERE gdl.time > NOW() - INTERVAL '1 hour'
ORDER BY gdl.time DESC;
```

### Statistiques par lot
```sql
SELECT
    l.code_lot,
    l.jour_actuel,
    COUNT(*) as nb_enregistrements,
    AVG(gdl.dose_moyenne) as dose_moyenne,
    MAX(gdl.poids_moyen_lot) as poids_max,
    l.nb_canards_initial - COALESCE(l.nb_morts, 0) as vivants
FROM gavage_data_lots gdl
JOIN lots_gavage l ON l.id = gdl.lot_gavage_id
WHERE l.code_lot LIKE 'LL26%'
GROUP BY l.code_lot, l.jour_actuel, l.nb_canards_initial, l.nb_morts
ORDER BY l.code_lot;
```

### Vérifier cohérence données
```sql
-- Comparer gavage_data_lots vs doses_journalieres
SELECT
    'gavage_data_lots' as source,
    COUNT(*) as count,
    MIN(time) as first_entry,
    MAX(time) as last_entry
FROM gavage_data_lots
UNION ALL
SELECT
    'doses_journalieres',
    COUNT(*),
    MIN(time),
    MAX(time)
FROM doses_journalieres;
```

---

## Migration données existantes (optionnel)

Si vous avez des données dans `gavage_data` à migrer :

```sql
INSERT INTO gavage_data_lots (
    time, lot_gavage_id, jour_gavage, repas,
    dose_moyenne, poids_moyen_lot,
    temperature_stabule, humidite_stabule
)
SELECT
    gd.time,
    gd.lot_mais_id as lot_gavage_id,
    1 as jour_gavage, -- À ajuster selon contexte
    CASE
        WHEN gd.dose_matin > 0 AND gd.dose_soir = 0 THEN 'matin'
        WHEN gd.dose_soir > 0 AND gd.dose_matin = 0 THEN 'soir'
        ELSE 'matin'
    END as repas,
    CASE WHEN gd.dose_matin > 0 THEN gd.dose_matin ELSE gd.dose_soir END as dose_moyenne,
    gd.poids_actuel,
    gd.temperature_stabule,
    gd.humidite_stabule
FROM gavage_data gd
WHERE gd.canard_id IS NOT NULL
  AND gd.lot_mais_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

---

## Documentation associée

- **CONTROL_PANEL_V2_BACKEND_COMPLETE.md** - Backend V2 complet
- **CONTROL_PANEL_V2_SPEC.md** - Spécifications Control Panel V2
- **timescaledb_schema.sql** - Schéma principal
- **lot_registry_schema.sql** - Schéma LotRegistry (traçabilité)

---

**Auteur**: Claude Code
**Dernière modification**: 2026-01-07 19:25 UTC
