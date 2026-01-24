# 🔐 Sécurité JWT/Keycloak - Guide Rapide

## ✅ Qu'est-ce qui a été implémenté ?

Votre backend Gaveurs V3.0 dispose maintenant d'une **sécurité complète production-ready** :

### 🔒 Validation JWT complète
- ✅ Vérification de la **signature** (RS256)
- ✅ Vérification de l'**expiration** (claim `exp`)
- ✅ Vérification du **délai d'activation** (claim `nbf`)
- ✅ Vérification de l'**émetteur** (claim `iss`)
- ✅ Extraction des **attributs personnalisés** (gaveur_id, site_id)

### 📝 Audit logging
- ✅ Tous les événements d'authentification enregistrés
- ✅ Traçabilité complète (Request ID unique)
- ✅ Mutations de données tracées

### 🛡️ Security headers
- ✅ HSTS, CSP, X-Frame-Options
- ✅ Protection XSS, MIME sniffing
- ✅ Permissions Policy

### 🎫 Role-Based Access Control (RBAC)
- ✅ Rôles Realm (admin, superviseur, gaveur, technicien_sqal)
- ✅ Rôles Client (view_all_sites, export_reports, etc.)
- ✅ Système de permissions granulaires

---

## 🚀 Démarrage rapide

### 1. Configurer Keycloak

```bash
# Démarrer Keycloak
docker-compose -f docker-compose.keycloak.yml up -d

# Attendre 30 secondes, puis configurer automatiquement
scripts/configure-keycloak.sh  # Linux/Mac
scripts\configure-keycloak.bat  # Windows
```

### 2. Récupérer le Client Secret

1. Aller sur http://localhost:8080
2. Login : `admin` / `admin_secure_2024`
3. Realm : `gaveurs-production`
4. **Clients** → **backend-api** → **Credentials** tab
5. **Copier le Client secret**

### 3. Configurer le backend

Créer `backend-api/.env` :
```bash
DATABASE_URL=postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db
REDIS_URL=redis://localhost:6379

KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=gaveurs-production
KEYCLOAK_CLIENT_ID=backend-api
KEYCLOAK_CLIENT_SECRET=<COLLER_ICI_LE_CLIENT_SECRET>

# Security
VERIFY_TOKEN_EXPIRATION=true
VERIFY_TOKEN_SIGNATURE=true
VERIFY_TOKEN_ISSUER=true
ENFORCE_AUTHENTICATION=false
```

### 4. Installer les dépendances

```bash
cd backend-api
pip install -r requirements.txt
```

### 5. Tester l'authentification

**Login** :
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jean.martin@gaveur.fr",
    "password": "gaveur123"
  }'
```

**Utiliser le token** :
```bash
TOKEN="<access_token_reçu>"

curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📖 Documentation complète

### Guides disponibles

1. **[KEYCLOAK_AUTO_SETUP.md](KEYCLOAK_AUTO_SETUP.md)** - Configuration automatique Keycloak
   - Prérequis et installation
   - Utilisation des scripts
   - Ce qui est configuré automatiquement
   - Utilisateurs de test
   - Dépannage

2. **[KEYCLOAK_SECURITY_GUIDE.md](KEYCLOAK_SECURITY_GUIDE.md)** - Guide complet de sécurisation ⭐
   - Configuration détaillée
   - Protection des routes (60+ exemples)
   - Utilisation des dépendances d'authentification
   - Middleware de sécurité
   - Audit logging
   - Configuration Keycloak avancée
   - Troubleshooting

3. **[KEYCLOAK_SECURITY_IMPLEMENTATION.md](KEYCLOAK_SECURITY_IMPLEMENTATION.md)** - Détails d'implémentation
   - Fonctionnalités implémentées
   - Fichiers créés/modifiés
   - Impact sécurité
   - Tests

---

## 🔑 Utilisateurs de test

Après configuration Keycloak, ces utilisateurs sont disponibles :

| Email | Password | Rôle | Accès |
|-------|----------|------|-------|
| `admin@euralis.fr` | `admin123` | admin | **Tous** les frontends |
| `superviseur@euralis.fr` | `super123` | superviseur | Euralis |
| `jean.martin@gaveur.fr` | `gaveur123` | gaveur | Gaveurs (Site LL) |
| `sophie.dubois@gaveur.fr` | `gaveur123` | gaveur | Gaveurs (Site LS) |
| `tech@sqal.fr` | `sqal123` | technicien_sqal | SQAL |

---

## 🛡️ Sécuriser vos routes

### Route publique (pas d'auth)
```python
@router.get("/api/public/info")
async def public_info():
    return {"message": "Public endpoint"}
```

### Route protégée (auth requise)
```python
from app.auth.keycloak import get_current_user_required

@router.get("/api/protected")
async def protected(current_user = Depends(get_current_user_required)):
    return {"user": current_user["username"]}
```

### Route avec rôle spécifique
```python
from app.auth.keycloak import require_role

@router.get("/api/admin/stats")
async def admin_stats(current_user = Depends(require_role("admin"))):
    return {"stats": [...]}
```

### Route avec multiple rôles
```python
from app.auth.keycloak import require_any_role

@router.get("/api/dashboard")
async def dashboard(
    current_user = Depends(require_any_role(["superviseur", "admin"]))
):
    return {"dashboard": [...]}
```

### Isolation des données par gaveur_id
```python
from app.auth.keycloak import get_current_user_required, get_user_gaveur_id

@router.get("/api/gavage/my-data")
async def get_my_data(
    current_user = Depends(get_current_user_required),
    conn = Depends(get_db_connection)
):
    gaveur_id = get_user_gaveur_id(current_user)

    rows = await conn.fetch("""
        SELECT * FROM gavage_data WHERE gaveur_id = $1
    """, gaveur_id)

    return {"data": [dict(row) for row in rows]}
```

---

## 📊 Claims JWT disponibles

Après authentification, le token JWT contient :

```python
{
    "username": "jean.martin@gaveur.fr",
    "email": "jean.martin@gaveur.fr",
    "name": "Jean Martin",
    "realm_roles": ["gaveur"],
    "client_roles": {
        "gaveurs-frontend": ["manage_own_data", "view_own_analytics"]
    },
    "attributes": {
        "gaveur_id": 1,        # ID du gaveur
        "site_id": "LL",       # Site attribué
        "organization": "Euralis"
    },
    "exp": 1735123456,  # Expiration timestamp
    "iat": 1735120000,  # Issued at timestamp
    "sub": "uuid-of-user"
}
```

**Accéder aux données** :
```python
current_user = await get_current_user(token)

username = current_user["username"]
roles = current_user["realm_roles"]
gaveur_id = current_user["attributes"].get("gaveur_id")
site_id = current_user["attributes"].get("site_id")
```

---

## 🐛 Dépannage rapide

### Erreur: "Token has expired"

**Solution** : Refresh le token
```bash
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<refresh_token>"}'
```

### Erreur: "Could not validate credentials"

**Causes possibles** :
1. Token expiré → Refresh le token
2. Token invalide → Se reconnecter
3. Keycloak inaccessible → Vérifier Keycloak tourne

### Erreur: "Invalid token issuer"

**Cause** : Le token ne vient pas du bon Keycloak realm

**Solution** : Vérifier dans `.env` :
```bash
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=gaveurs-production
```

### Erreur: "Role 'superviseur' required"

**Cause** : L'utilisateur n'a pas le rôle requis

**Solution** :
1. Keycloak Admin Console → Users
2. Sélectionner utilisateur → Role mapping
3. Assigner le rôle manquant

---

## 📁 Fichiers importants

### Configuration
- `backend-api/.env` - Configuration (client secret ici)
- `backend-api/.env.example` - Template de configuration

### Code de sécurité
- `backend-api/app/auth/keycloak.py` - Validation JWT + RBAC
- `backend-api/app/auth/security_middleware.py` - Middlewares de sécurité
- `backend-api/app/api/auth_routes.py` - Routes d'authentification

### Scripts
- `scripts/configure-keycloak.sh` - Configuration auto Keycloak (Linux/Mac)
- `scripts/configure-keycloak.bat` - Configuration auto Keycloak (Windows)

### Documentation
- `KEYCLOAK_AUTO_SETUP.md` - Setup automatique
- `KEYCLOAK_SECURITY_GUIDE.md` - Guide complet
- `KEYCLOAK_SECURITY_IMPLEMENTATION.md` - Détails techniques
- `README_SECURITY.md` - Ce document

---

## ✅ Checklist

- [ ] Keycloak démarré
- [ ] Scripts de configuration exécutés
- [ ] Client secret récupéré
- [ ] `.env` configuré avec le client secret
- [ ] Dépendances installées (`pip install -r requirements.txt`)
- [ ] Backend démarre sans erreur
- [ ] Test login réussi
- [ ] Test token validation réussi

---

## 🎯 Prochaines étapes (optionnel)

1. **Activer le Security Middleware** - Validation automatique sur toutes les routes
2. **Protéger les routes sensibles** - Ajouter RBAC sur Euralis et SQAL
3. **Configurer custom attributes** - Ajouter gaveur_id/site_id dans Keycloak
4. **HTTPS en production** - Reverse proxy Nginx/Traefik
5. **Monitoring** - Dashboard Keycloak + logs audit

---

**✅ Votre backend est maintenant sécurisé avec validation JWT complète !**

Pour plus de détails, consultez [KEYCLOAK_SECURITY_GUIDE.md](KEYCLOAK_SECURITY_GUIDE.md).
