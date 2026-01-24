# Prochaines Étapes - Fix Login 401

**Date** : 30 décembre 2025
**Statut** : Backend modifié, Gaveur à créer

---

## ✅ Travail Effectué

### 1. Backend - Fallback Auth Implémenté

**Fichier** : [backend-api/app/api/auth_routes.py](backend-api/app/api/auth_routes.py)

La route `/api/auth/login` a été modifiée pour :
- ✅ Essayer Keycloak en premier
- ✅ **Fallback** vers authentification table `gaveurs` si Keycloak échoue
- ✅ Accepte `jean.martin@gaveur.fr` / `gaveur123`
- ✅ Génère tokens temporaires (secrets.token_urlsafe)
- ✅ Retourne `user_info` compatible avec format Keycloak

### 2. Frontend - localStorage Amélioré

**Fichier** : [gaveurs-frontend/app/(auth)/login/page.tsx](gaveurs-frontend/app/(auth)/login/page.tsx)

La page de login sauvegarde maintenant :
- ✅ `access_token`
- ✅ `refresh_token`
- ✅ `gaveur_token`
- ✅ `gaveur_id` (depuis user_info.id)
- ✅ `gaveur_nom` (depuis user_info.name)
- ✅ `gaveur_email` (depuis user_info.email)

Cela permet à la navbar d'afficher l'utilisateur connecté.

### 3. Scripts de Création Gaveur

**Fichiers créés** :
- ✅ [backend-api/scripts/create_test_gaveur.sql](backend-api/scripts/create_test_gaveur.sql) - Version SQL
- ✅ [backend-api/scripts/create_test_gaveur.py](backend-api/scripts/create_test_gaveur.py) - Version Python (asyncpg)
- ✅ [create_gaveur_simple.py](create_gaveur_simple.py) - Version Python simple (psycopg2)

---

## ⏳ Tâche Restante

### Créer le Gaveur de Test dans PostgreSQL

**Problème actuel** : Le gaveur `jean.martin@gaveur.fr` n'existe pas dans la base de données.

Cela cause l'erreur 401 lors du login.

### Solution 1 : Via SQL (pgAdmin ou psql)

**Étapes** :

1. Ouvrir pgAdmin ou se connecter via psql :

```bash
psql -U gaveurs_admin -d gaveurs_db
```

2. Exécuter le script SQL :

```sql
-- Copier-coller le contenu de backend-api/scripts/create_test_gaveur.sql
-- OU charger le fichier :
\i backend-api/scripts/create_test_gaveur.sql
```

**Ce qui sera créé** :
- Gaveur : `jean.martin@gaveur.fr` (id: 1)
- Lot : `LL_TEST_042` (200 canards, jour 12/14)
- Historique gavage : J1 à J12 (progression réaliste)

### Solution 2 : Via Python (si psycopg2 fonctionne)

**Problème rencontré** : Erreurs d'encodage Unicode sur Windows

**Si résolu** :

```bash
python create_gaveur_simple.py
```

### Solution 3 : Manuellement via INSERT minimal

Si les scripts ne fonctionnent pas, créer manuellement via pgAdmin :

```sql
-- Créer uniquement le gaveur
INSERT INTO gaveurs (nom, prenom, email, telephone, site_origine, actif)
VALUES ('Martin', 'Jean', 'jean.martin@gaveur.fr', '0612345678', 'LL', true)
RETURNING id;
-- Notez l'ID retourné (exemple: 1)

-- Créer un lot (remplacer 1 par l'ID du gaveur)
INSERT INTO lots (
    code_lot, gaveur_id, site_origine, statut,
    nombre_canards, nombre_jours_gavage_ecoules,
    poids_moyen_actuel, objectif_poids_final,
    date_debut_gavage
) VALUES (
    'LL_TEST_042', 1, 'LL', 'en_gavage',
    200, 12, 4854, 5500,
    CURRENT_DATE - INTERVAL '12 days'
)
RETURNING id;
-- Notez l'ID retourné (exemple: 1)

-- Créer 3 gavages récents (remplacer 1 par l'ID du lot)
INSERT INTO gavage_data (lot_id, jour_gavage, date_gavage, poids_moyen_mesure, nb_canards_peses, dose_matin, dose_soir)
VALUES
(1, 10, CURRENT_DATE - INTERVAL '2 days', 4700, 10, 180, 180),
(1, 11, CURRENT_DATE - INTERVAL '1 day', 4777, 10, 185, 185),
(1, 12, CURRENT_DATE, 4854, 10, 190, 190);
```

---

## 🧪 Test de Connexion

### 1. Vérifier que le Backend est Démarré

```bash
curl http://localhost:8000/health
# Doit retourner: {"status":"healthy","database":"connected",...}
```

### 2. Tester le Login API

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"jean.martin@gaveur.fr","password":"gaveur123"}'
```

**Résultat attendu** :

```json
{
  "access_token": "abc123xyz456...",
  "refresh_token": "def789uvw...",
  "expires_in": 3600,
  "refresh_expires_in": 604800,
  "token_type": "bearer",
  "user_info": {
    "id": 1,
    "name": "Jean Martin",
    "email": "jean.martin@gaveur.fr",
    "preferred_username": "jean.martin@gaveur.fr",
    "given_name": "Jean",
    "family_name": "Martin",
    "phone": "0612345678",
    "site": "LL"
  }
}
```

**Si erreur 401** :
- Le gaveur n'existe pas → exécuter un des scripts ci-dessus

**Si autre erreur** :
- Vérifier les logs backend : `tail -f backend-api/logs/backend.log`

### 3. Tester le Login Frontend

```
1. Ouvrir http://localhost:3000/login (ou le port du frontend)
2. Entrer :
   - Email : jean.martin@gaveur.fr
   - Password : gaveur123
3. Cliquer "Se connecter"
```

**Résultat attendu** :
- ✅ Redirection vers `/lots`
- ✅ Navbar affiche "Jean Martin" et "jean.martin@gaveur.fr"
- ✅ Page lots affiche le lot LL_TEST_042

**Si erreur** :
- Ouvrir console navigateur (F12) et vérifier l'erreur
- Vérifier que le backend est accessible depuis le frontend (CORS)

---

## 📊 État Actuel

### Backend

**Statut** : ✅ Démarré et accessible

```bash
$ curl http://localhost:8000/health
{"status":"healthy","database":"connected","timestamp":"2025-12-30T16:07:58.540847"}
```

### Fallback Auth

**Statut** : ✅ Implémenté et prêt

La route `/api/auth/login` accepte maintenant :
- Keycloak (si disponible)
- Fallback table `gaveurs` (si Keycloak échoue)

### Base de Données

**Statut** : ⏳ **Gaveur à créer**

Le gaveur `jean.martin@gaveur.fr` **n'existe pas encore**.

### Test Login API

**Résultat actuel** :

```bash
$ curl -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"jean.martin@gaveur.fr","password":"gaveur123"}'

{"detail":"Authentication failed"}  # ← 401 car gaveur inexistant
```

---

## 🎯 Prochaine Action Immédiate

### Action Recommandée : Exécuter le Script SQL via pgAdmin

1. **Ouvrir pgAdmin**
2. **Se connecter** à `gaveurs_db`
3. **Ouvrir Query Tool**
4. **Charger** le fichier `backend-api/scripts/create_test_gaveur.sql`
5. **Exécuter** (F5 ou bouton Execute)

**Résultat attendu** :

```
NOTICE:  Gaveur créé : jean.martin@gaveur.fr (id: 1)
NOTICE:  Lot créé : LL_TEST_042 (id: 1)
NOTICE:  Données de gavage créées pour les 12 premiers jours

Query returned successfully in 245 msec.
```

6. **Retester le login** :

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"jean.martin@gaveur.fr","password":"gaveur123"}'

# Devrait maintenant retourner les tokens et user_info
```

---

## 📝 Fichiers de Documentation

- ✅ [FIX_LOGIN_401_KEYCLOAK_FALLBACK.md](FIX_LOGIN_401_KEYCLOAK_FALLBACK.md) - Documentation complète du fix
- ✅ [PROCHAINES_ETAPES_LOGIN.md](PROCHAINES_ETAPES_LOGIN.md) - Ce fichier
- ✅ [AMELIORATIONS_NAVBAR_CLEANUP.md](AMELIORATIONS_NAVBAR_CLEANUP.md) - Améliorations navbar
- ✅ [LOGIN_GAVEUR_SIMULATEUR.md](LOGIN_GAVEUR_SIMULATEUR.md) - Documentation login gaveur

---

**Dernière mise à jour** : 30 décembre 2025
**Action requise** : Créer le gaveur `jean.martin@gaveur.fr` dans PostgreSQL
