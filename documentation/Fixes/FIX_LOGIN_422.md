# 🔧 Fix Erreur 422 - Login Frontend Gaveurs

## Problème
Erreur `422 Unprocessable Entity` lors du login sur le frontend gaveurs.

---

## Diagnostic Rapide

### Étape 1: Vérifier que le backend est démarré

```bash
curl http://localhost:8000/health

# Devrait retourner:
# {"status":"healthy","timestamp":"..."}
```

Si le backend ne répond pas:
```bash
cd backend-api
uvicorn app.main:app --reload --port 8000
```

### Étape 2: Vérifier Keycloak

```bash
curl http://localhost:8080

# Devrait retourner du HTML de Keycloak
```

Si Keycloak ne répond pas, vérifier Docker:
```bash
docker ps | grep keycloak

# Si vide, Keycloak n'est pas démarré
docker-compose up -d keycloak
```

### Étape 3: Tester l'endpoint de login directement

**Linux/Mac**:
```bash
chmod +x test_login.sh
./test_login.sh
```

**Windows**:
```bash
test_login.bat
```

**Ou manuellement**:
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin@euralis.fr", "password": "admin123"}'
```

**Résultats attendus**:

✅ **Success (200)** - Si Keycloak fonctionne:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCIg...",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "token_type": "bearer",
  "user_info": {
    "sub": "...",
    "email": "admin@euralis.fr",
    "name": "Admin User"
  }
}
```

✅ **Success (200)** - Si fallback activé (Keycloak down):
```json
{
  "access_token": "random_token_string",
  "refresh_token": "random_refresh_token",
  "expires_in": 3600,
  "refresh_expires_in": 604800,
  "token_type": "bearer",
  "user_info": {
    "id": 1,
    "email": "admin@euralis.fr",
    "name": "Admin User"
  }
}
```

❌ **Error (422)** - Format de requête incorrect:
```json
{
  "detail": [
    {
      "loc": ["body", "username"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

❌ **Error (401)** - Credentials invalides:
```json
{
  "detail": "Invalid credentials"
}
```

---

## Solutions Possibles

### Solution 1: Vérifier le format de la requête frontend

**Fichier**: `gaveurs-frontend/app/(auth)/login/page.tsx`

**Ligne 28 devrait être**:
```typescript
body: JSON.stringify({ username: email, password })
```

**PAS**:
```typescript
body: JSON.stringify({ email: email, password })  // ❌ INCORRECT
```

Le backend attend `username`, pas `email`.

### Solution 2: Vérifier la configuration Keycloak

**Fichier**: `backend-api/.env`

```env
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=gaveurs-production
KEYCLOAK_CLIENT_ID=backend-api
KEYCLOAK_CLIENT_SECRET=ISkV1SEWGCDjDvKK8muYzPEV9AWMy7WX
```

Vérifier que:
1. Keycloak tourne sur port 8080
2. Le realm `gaveurs-production` existe
3. Le client `backend-api` existe avec le bon secret

### Solution 3: Utiliser le fallback si Keycloak pose problème

Si Keycloak est mal configuré mais que vous voulez quand même tester, le backend a un **fallback automatique**.

Le fallback s'active automatiquement si Keycloak échoue et vérifie:
- Table `gaveurs` dans la base de données
- Email correspond à `credentials.username`
- Password = `"gaveur123"` (hardcodé temporairement)

**Créer un gaveur de test**:
```sql
INSERT INTO gaveurs (nom, prenom, email, telephone, site_origine, created_at)
VALUES (
  'Martin',
  'Jean',
  'jean.martin@gaveur.fr',
  '+33612345678',
  'LL',
  NOW()
);
```

Puis tester:
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "jean.martin@gaveur.fr", "password": "gaveur123"}'
```

### Solution 4: Vérifier les logs backend

```bash
# Démarrer le backend en mode verbose
cd backend-api
uvicorn app.main:app --reload --log-level debug

# Observer les logs lors du login
```

Chercher dans les logs:
- `"Keycloak login failed: ..."` → Keycloak inaccessible, fallback utilisé
- `"Fallback auth successful for ..."` → Fallback fonctionne
- `"Fallback auth also failed: ..."` → Les deux ont échoué

---

## Checklist de Vérification

- [ ] Backend démarré et répond sur `http://localhost:8000/health`
- [ ] Keycloak accessible sur `http://localhost:8080` (ou fallback activé)
- [ ] Frontend envoie `{"username": "...", "password": "..."}` pas `{"email": "...", ...}`
- [ ] Credentials corrects:
  - Keycloak: comptes créés dans Keycloak admin
  - Fallback: email existe dans table `gaveurs` + password = `"gaveur123"`
- [ ] Pas d'erreur CORS dans la console navigateur
- [ ] `.env.local` du frontend contient: `NEXT_PUBLIC_API_URL=http://localhost:8000`

---

## Test Complet End-to-End

1. **Démarrer tout**:
```bash
# Terminal 1: Backend
cd backend-api
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd gaveurs-frontend
npm run dev
```

2. **Ouvrir navigateur**: `http://localhost:3000/login`

3. **Ouvrir DevTools** (F12) → Onglet Network

4. **Essayer de se connecter** avec:
   - Email: `admin@euralis.fr`
   - Password: `admin123`

5. **Observer la requête** dans Network:
   - URL: `http://localhost:8000/api/auth/login`
   - Method: `POST`
   - Payload: `{"username":"admin@euralis.fr","password":"admin123"}`
   - Response Status: `200` (success) ou `401/422` (error)

6. **Si 422**:
   - Regarder le `Response` tab
   - Vérifier quel champ est manquant/invalide
   - Corriger le frontend en conséquence

7. **Si 401**:
   - Credentials incorrects
   - Vérifier que le compte existe dans Keycloak (ou dans table gaveurs si fallback)

8. **Si 200**:
   - Login réussi! ✅
   - Vérifier que `localStorage` contient le token
   - Vérifier redirection vers `/`

---

## Commandes de Debug Utiles

**Vérifier table gaveurs**:
```bash
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db
\d gaveurs
SELECT id, nom, prenom, email FROM gaveurs LIMIT 5;
```

**Vérifier Keycloak**:
```bash
# Via API admin
curl -X POST http://localhost:8080/realms/master/protocol/openid-connect/token \
  -d 'client_id=admin-cli' \
  -d 'username=admin' \
  -d 'password=admin' \
  -d 'grant_type=password'
```

**Logs backend en direct**:
```bash
cd backend-api
tail -f logs/backend.log  # Si logs configurés
# Ou simplement observer la console uvicorn
```

---

## Contact

Si le problème persiste après avoir essayé toutes ces solutions, fournir:
1. Logs backend (dernières 20 lignes lors du login)
2. Screenshot de l'erreur dans DevTools Network tab
3. Résultat de `curl http://localhost:8000/health`
4. Résultat de `curl http://localhost:8080`
5. Résultat de `docker ps | grep keycloak`

---

**Dernière mise à jour**: 10 Janvier 2026
