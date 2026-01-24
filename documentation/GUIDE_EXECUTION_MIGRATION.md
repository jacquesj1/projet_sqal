# Guide d'Exécution - Migration Architecture Unifiée

## ⚠️ ATTENTION: Migration Critique

Cette migration **supprime définitivement** plusieurs tables. Un backup complet est **OBLIGATOIRE** avant exécution.

---

## 📋 Pré-requis

- [ ] Docker Desktop en cours d'exécution
- [ ] Tous les services arrêtés (sauf TimescaleDB)
- [ ] Accès terminal avec droits admin
- [ ] Minimum 5 GB espace disque libre (pour backup)

---

## 🚀 Exécution Pas à Pas

### Étape 1: Backup Complet (OBLIGATOIRE)

```bash
# Créer répertoire backups
mkdir -p backups

# Backup complet de la base
docker exec gaveurs_timescaledb pg_dump -U gaveurs_admin gaveurs_db > backups/backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# Vérifier taille du backup
ls -lh backups/
```

**✅ Vérification**: Le fichier backup doit faire plusieurs Mo (pas 0 bytes!)

---

### Étape 2: Arrêter Services

```bash
# Arrêter backend
docker stop gaveurs_backend

# Arrêter simulateurs
docker stop gaveurs_simulator_gavage_realtime
docker stop gaveurs_simulator_consumer
docker stop gaveurs_simulator_sqal
docker stop gaveurs_simulator_sqal_ligne_b

# Vérifier que seul TimescaleDB tourne
docker ps
```

**✅ Vérification**: Seuls `gaveurs_timescaledb`, `gaveurs_redis`, `gaveurs-keycloak` doivent tourner.

---

### Étape 3: Exécuter Migration

```bash
# Se positionner dans le projet
cd d:\GavAI\projet-euralis-gaveurs

# Exécuter script de migration
docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db < backend-api/scripts/migration_unification_lots.sql

# OU depuis l'intérieur du container:
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db
\i /path/to/migration_unification_lots.sql
\q
```

**Durée estimée**: 2-5 minutes

---

### Étape 4: Vérifier Migration

```bash
# Vérifier nombre de lots_gavage
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT COUNT(*) FROM lots_gavage;"

# Vérifier lots Jean Martin
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT code_lot, jour_actuel, statut FROM lots_gavage WHERE code_lot LIKE 'LL26%' OR code_lot LIKE 'LS26%';"

# Vérifier gavage_data_lots
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT COUNT(*) FROM gavage_data_lots;"

# Vérifier tables supprimées (devrait retourner erreur "relation does not exist")
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT COUNT(*) FROM lots;" 2>&1 | grep "does not exist"
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT COUNT(*) FROM canards;" 2>&1 | grep "does not exist"
```

**✅ Vérifications attendues**:
- lots_gavage: 22-23 rows (incluant lots migrés)
- gavage_data_lots: 1500+ rows
- lots et canards: erreurs "relation does not exist" ✅

---

### Étape 5: Redémarrer Services

```bash
# Redémarrer backend
docker start gaveurs_backend

# Attendre 10 secondes que le backend démarre
sleep 10

# Vérifier santé backend
curl http://localhost:8000/health

# Redémarrer simulateurs
docker start gaveurs_simulator_gavage_realtime
docker start gaveurs_simulator_consumer
docker start gaveurs_simulator_sqal
docker start gaveurs_simulator_sqal_ligne_b
```

---

### Étape 6: Tests Post-Migration

#### Test 1: Simulateur Gavage

```bash
# Vérifier logs simulateur (devrait montrer envois)
docker logs gaveurs_simulator_gavage_realtime --tail 20

# Vérifier insertions en base (dernières 5 minutes)
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT COUNT(*) FROM gavage_data_lots WHERE time > NOW() - INTERVAL '5 minutes';"
```

**✅ Attendu**: Nouvelles entrées continuent de s'insérer dans `gavage_data_lots`.

#### Test 2: Backend API

```bash
# Tester endpoint lots_gavage
curl http://localhost:8000/api/euralis/lots | jq '.[:2]'

# Tester endpoint gavage (devrait lire lots_gavage maintenant)
curl http://localhost:8000/api/lots 2>&1 | head
```

**⚠️ ATTENTION**: Si erreurs 500, voir "Étape 7: Mise à Jour Backend API"

#### Test 3: Frontend Gaveurs (Jean Martin)

1. Ouvrir navigateur: http://localhost:3001
2. Se connecter:
   - Email: `jean.martin@gaveur.fr`
   - Password: (le mot de passe configuré)
3. Vérifier que les lots apparaissent: LL2601001, LL2601002, LL2601003

**✅ Attendu**: Les 3 lots de Jean Martin sont visibles avec données de gavage.

#### Test 4: Dashboard Euralis

1. Ouvrir navigateur: http://localhost:3000/euralis/dashboard
2. Vérifier que tous les lots s'affichent
3. Vérifier graphiques et statistiques

---

### Étape 7: Mise à Jour Backend API (Si Nécessaire)

Si le backend retourne des erreurs 500 après migration:

```bash
# Identifier routes utilisant "lots" au lieu de "lots_gavage"
cd backend-api
grep -r "FROM lots " app/routers/
grep -r "JOIN lots " app/routers/

# Éditer fichiers identifiés et remplacer:
# - "FROM lots" → "FROM lots_gavage"
# - "JOIN lots" → "JOIN lots_gavage"
# - "lots.gaveur_id" → "lots_gavage.gaveur_id"
# etc.

# Redémarrer backend
docker restart gaveurs_backend
```

---

## 🔙 Rollback (En Cas de Problème)

### Option 1: Rollback Complet (Recommandé)

```bash
# Arrêter tous les services
docker stop gaveurs_backend gaveurs_simulator_gavage_realtime gaveurs_simulator_consumer

# Restaurer backup
docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db < backups/backup_before_migration_YYYYMMDD_HHMMSS.sql

# Redémarrer services
docker start gaveurs_backend gaveurs_simulator_gavage_realtime gaveurs_simulator_consumer
```

### Option 2: Rollback Partiel (Structure Seulement)

```bash
# Exécuter script rollback (recrée structures vides)
docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db < backend-api/scripts/rollback_migration_unification.sql

# Puis restaurer backup pour récupérer données
docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db < backups/backup_before_migration_YYYYMMDD_HHMMSS.sql
```

---

## ✅ Checklist Post-Migration

- [ ] Backup réussi et vérifié (taille > 0)
- [ ] Migration SQL exécutée sans erreur
- [ ] Tables lots, canards, gavage_data n'existent plus
- [ ] lots_gavage contient tous les lots
- [ ] gavage_data_lots reçoit nouvelles données
- [ ] Backend API démarre sans erreur
- [ ] Simulateur gavage envoie des données
- [ ] Jean Martin voit ses 3 lots dans gaveurs-frontend
- [ ] Dashboard Euralis affiche tous les lots
- [ ] Tests E2E passent (si existants)

---

## 📝 Logs et Débogage

### Vérifier logs backend

```bash
docker logs gaveurs_backend --tail 50
```

### Vérifier logs simulateur

```bash
docker logs gaveurs_simulator_gavage_realtime --tail 50
```

### Vérifier logs PostgreSQL

```bash
docker logs gaveurs_timescaledb --tail 100
```

### Se connecter à la base

```bash
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db
```

Requêtes utiles:
```sql
-- Lister toutes les tables
\dt

-- Vérifier lots_gavage
SELECT code_lot, gaveur_id, site_code, jour_actuel, statut FROM lots_gavage LIMIT 10;

-- Vérifier gavage_data_lots
SELECT COUNT(*) FROM gavage_data_lots;
SELECT * FROM gavage_data_lots ORDER BY time DESC LIMIT 5;

-- Quitter
\q
```

---

## 📞 Support

En cas de problème:

1. **Consulter logs** (voir section "Logs et Débogage")
2. **Vérifier backup** disponible
3. **Exécuter rollback** si nécessaire
4. **Documenter l'erreur** exacte rencontrée
5. **Ouvrir issue** GitHub avec logs

---

## 📚 Documentation Associée

- [ARCHITECTURE_BASE_DE_DONNEES.md](ARCHITECTURE_BASE_DE_DONNEES.md) - Architecture détaillée
- [PLAN_MIGRATION_ARCHITECTURE_UNIFIEE.md](PLAN_MIGRATION_ARCHITECTURE_UNIFIEE.md) - Plan complet
- `backend-api/scripts/migration_unification_lots.sql` - Script SQL migration
- `backend-api/scripts/rollback_migration_unification.sql` - Script rollback

---

**Date**: 08 Janvier 2026
**Version**: 1.0
**Auteur**: Claude Code
