# Guide Complet de Sécurité Keycloak - Système Gaveurs V3.0

## 🔐 Vue d'ensemble

Ce guide explique comment **sécuriser les routes FastAPI** avec **Keycloak OAuth2/OIDC** et **validation JWT complète**.

### Fonctionnalités de sécurité implémentées

✅ **Validation JWT complète**
- Vérification de la signature (RS256)
- Vérification de l'expiration (claim `exp`)
- Vérification du délai d'activation (claim `nbf`)
- Vérification de l'émetteur (claim `iss`)

✅ **Role-Based Access Control (RBAC)**
- Rôles Realm (admin, superviseur, gaveur, technicien_sqal)
- Rôles Client (view_all_sites, manage_gaveurs, export_reports, etc.)
- Système de permissions granulaires

✅ **Extraction d'attributs personnalisés**
- `gaveur_id` - ID du gaveur pour isolation des données
- `site_id` - Site attribué (LL, LS, MO)
- `organization` - Organisation

✅ **Audit logging**
- Tous les événements d'authentification enregistrés
- Mutations de données tracées
- Request ID unique pour le traçage

✅ **Security headers**
- HSTS, CSP, X-Frame-Options
- XSS Protection
- MIME type sniffing prevention

---

## 📋 Table des matières

1. [Configuration](#configuration)
2. [Utilisation des dépendances d'authentification](#dépendances-dauthentification)
3. [Protection des routes](#protection-des-routes)
4. [Exemples pratiques](#exemples-pratiques)
5. [Middleware de sécurité](#middleware-de-sécurité)
6. [Audit logging](#audit-logging)
7. [Dépannage](#dépannage)

---

## Configuration

### 1. Variables d'environnement

Copier `.env.example` vers `.env` et configurer :

```bash
# Keycloak Authentication
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=gaveurs-production
KEYCLOAK_CLIENT_ID=backend-api
KEYCLOAK_CLIENT_SECRET=<votre-client-secret>

# Security Configuration
VERIFY_TOKEN_EXPIRATION=true        # Vérifie expiration du token
VERIFY_TOKEN_SIGNATURE=true         # Vérifie signature JWT
VERIFY_TOKEN_ISSUER=true            # Vérifie émetteur du token
ENFORCE_AUTHENTICATION=false        # true = auth requise sur toutes les routes
```

### 2. Récupérer le Client Secret

Après avoir exécuté `scripts/configure-keycloak.sh` ou `.bat` :

**Option 1 - Via l'interface Keycloak** (Recommandé) :
1. Aller sur http://localhost:8080
2. Login : `admin` / `admin_secure_2024`
3. Sélectionner realm : `gaveurs-production`
4. **Clients** → **backend-api**
5. Onglet **Credentials**
6. **Copier le Client secret**

**Option 2 - Via le script Linux** :
Le script affiche automatiquement le client secret à la fin.

### 3. Installer les dépendances

```bash
pip install python-keycloak==3.9.0
```

Ou via requirements.txt :
```bash
pip install -r backend-api/requirements.txt
```

---

## Dépendances d'authentification

Le module `app.auth.keycloak` fournit plusieurs dépendances FastAPI.

### `get_current_user`

Récupère l'utilisateur connecté **sans forcer l'authentification**.

```python
from app.auth.keycloak import get_current_user

@router.get("/api/resource")
async def my_route(current_user = Depends(get_current_user)):
    if current_user:
        # Utilisateur connecté
        username = current_user["username"]
        roles = current_user["realm_roles"]
    else:
        # Utilisateur anonyme (route publique)
        pass
```

**Retourne** :
```python
{
    "username": "jean.martin@gaveur.fr",
    "email": "jean.martin@gaveur.fr",
    "name": "Jean Martin",
    "given_name": "Jean",
    "family_name": "Martin",
    "realm_roles": ["gaveur"],
    "client_roles": {
        "gaveurs-frontend": ["manage_own_data", "view_own_analytics"]
    },
    "sub": "uuid-of-user",
    "exp": 1735123456,  # Token expiration timestamp
    "iat": 1735120000,  # Token issued at timestamp
    "attributes": {
        "gaveur_id": 1,
        "site_id": "LL",
        "organization": "Euralis"
    }
}
```

### `get_current_user_required`

Requiert l'authentification - lève `401 Unauthorized` si pas de token.

```python
from app.auth.keycloak import get_current_user_required

@router.get("/api/protected")
async def protected_route(current_user = Depends(get_current_user_required)):
    # current_user est toujours défini ici
    return {"message": f"Hello {current_user['username']}"}
```

### `require_role(role)`

Requiert un **rôle realm spécifique**.

```python
from app.auth.keycloak import require_role

@router.get("/api/admin/users")
async def admin_only(current_user = Depends(require_role("admin"))):
    # Seuls les utilisateurs avec le rôle "admin" peuvent accéder
    return {"users": [...]}
```

**Rôles realm disponibles** :
- `admin` - Administrateur système (accès total)
- `superviseur` - Superviseur Euralis multi-sites
- `gaveur` - Gaveur individuel
- `technicien_sqal` - Technicien SQAL
- `consommateur` - Consommateur (feedback uniquement)

### `require_any_role(roles)`

Requiert **AU MOINS UN** des rôles spécifiés.

```python
from app.auth.keycloak import require_any_role

@router.get("/api/production/stats")
async def stats(current_user = Depends(require_any_role(["superviseur", "admin"]))):
    # Accessible par superviseur OU admin
    return {"stats": {...}}
```

### `require_client_role(client_id, role)`

Requiert un **rôle client spécifique**.

```python
from app.auth.keycloak import require_client_role

@router.post("/api/euralis/reports/export")
async def export_report(
    current_user = Depends(require_client_role("euralis-frontend", "export_reports"))
):
    # Seuls les users avec le client role "export_reports" peuvent accéder
    return {"pdf_url": "..."}
```

**Client roles disponibles** :

**euralis-frontend** :
- `view_all_sites` - Voir tous les sites
- `manage_gaveurs` - Gérer les gaveurs
- `view_analytics` - Voir les analytics
- `export_reports` - Exporter les rapports
- `manage_lots` - Gérer les lots

**gaveurs-frontend** :
- `manage_own_data` - Gérer ses propres données
- `view_own_analytics` - Voir ses analytics
- `use_ai_training` - Utiliser l'IA training
- `view_blockchain` - Voir blockchain
- `submit_feedback` - Soumettre feedback

**sqal-frontend** :
- `view_sensors` - Voir capteurs
- `manage_quality` - Gérer qualité
- `export_reports` - Exporter rapports
- `calibrate_devices` - Calibrer dispositifs
- `view_realtime` - Voir temps réel

---

## Protection des routes

### Exemple 1 : Route publique (pas d'auth)

```python
@router.get("/api/consumer/products")
async def list_products():
    """
    Route publique - accessible sans token
    """
    return {"products": [...]}
```

### Exemple 2 : Route avec authentification optionnelle

```python
from app.auth.keycloak import get_current_user

@router.get("/api/public/info")
async def public_info(current_user = Depends(get_current_user)):
    """
    Route publique avec personnalisation si connecté
    """
    if current_user:
        # Personnalisé pour utilisateur connecté
        return {
            "message": f"Bonjour {current_user['name']}",
            "personalized": True
        }
    else:
        # Version publique
        return {
            "message": "Bonjour visiteur",
            "personalized": False
        }
```

### Exemple 3 : Route protégée (auth requise)

```python
from app.auth.keycloak import get_current_user_required

@router.get("/api/gavage/my-data")
async def get_my_data(current_user = Depends(get_current_user_required)):
    """
    Route protégée - token requis
    """
    gaveur_id = current_user["attributes"].get("gaveur_id")
    if not gaveur_id:
        raise HTTPException(status_code=403, detail="Gaveur ID not found")

    # Charger données du gaveur
    return {"data": [...]}
```

### Exemple 4 : Route avec RBAC (rôle spécifique)

```python
from app.auth.keycloak import require_role

@router.get("/api/euralis/sites")
async def get_all_sites(current_user = Depends(require_role("superviseur"))):
    """
    Accessible uniquement aux superviseurs
    """
    # Logique métier
    return {"sites": [...]}
```

### Exemple 5 : Route avec multiple rôles

```python
from app.auth.keycloak import require_any_role

@router.get("/api/production/dashboard")
async def dashboard(
    current_user = Depends(require_any_role(["superviseur", "admin", "gaveur"]))
):
    """
    Accessible par superviseur, admin ou gaveur
    """
    roles = current_user["realm_roles"]

    if "admin" in roles or "superviseur" in roles:
        # Vue globale
        return {"view": "global", "sites": [...]}
    elif "gaveur" in roles:
        # Vue limitée au gaveur
        gaveur_id = current_user["attributes"].get("gaveur_id")
        return {"view": "personal", "gaveur_id": gaveur_id, "data": [...]}
```

### Exemple 6 : Route avec client role

```python
from app.auth.keycloak import require_client_role

@router.post("/api/reports/generate")
async def generate_report(
    current_user = Depends(require_client_role("euralis-frontend", "export_reports"))
):
    """
    Réservé aux users avec permission d'export
    """
    # Générer rapport
    return {"report_id": "...", "status": "generating"}
```

### Exemple 7 : Isolation des données par gaveur_id

```python
from app.auth.keycloak import get_current_user_required, get_user_gaveur_id

@router.get("/api/gavage/history")
async def get_gavage_history(
    current_user = Depends(get_current_user_required),
    conn = Depends(get_db_connection)
):
    """
    Chaque gaveur ne voit que ses propres données
    """
    gaveur_id = get_user_gaveur_id(current_user)

    if not gaveur_id:
        raise HTTPException(
            status_code=403,
            detail="Gaveur ID requis - compte non configuré"
        )

    # Query avec isolation
    rows = await conn.fetch("""
        SELECT * FROM gavage_data
        WHERE gaveur_id = $1
        ORDER BY date_gavage DESC
        LIMIT 100
    """, gaveur_id)

    return {"history": [dict(row) for row in rows]}
```

### Exemple 8 : Permission granulaire custom

```python
from app.auth.keycloak import get_current_user_required, has_permission

@router.delete("/api/analytics/clear-cache")
async def clear_analytics_cache(current_user = Depends(get_current_user_required)):
    """
    Vérification de permission custom
    """
    if not has_permission(current_user, "analytics", "export"):
        raise HTTPException(
            status_code=403,
            detail="Permission denied: analytics.export required"
        )

    # Clear cache
    return {"message": "Cache cleared"}
```

---

## Exemples pratiques

### Sécuriser une route Euralis existante

**AVANT** (non sécurisé) :
```python
@router.get("/api/euralis/sites", response_model=List[Site])
async def get_sites(conn = Depends(get_db_connection)):
    """
    Liste des 3 sites Euralis
    """
    rows = await conn.fetch("""
        SELECT id, code, nom, region, capacite_gavage_max, nb_gaveurs_actifs
        FROM sites_euralis
        ORDER BY code
    """)
    return [dict(row) for row in rows]
```

**APRÈS** (sécurisé avec RBAC) :
```python
from app.auth.keycloak import require_any_role

@router.get("/api/euralis/sites", response_model=List[Site])
async def get_sites(
    current_user = Depends(require_any_role(["superviseur", "admin"])),
    conn = Depends(get_db_connection)
):
    """
    Liste des 3 sites Euralis

    Permissions requises:
    - Rôle: superviseur OU admin
    """
    rows = await conn.fetch("""
        SELECT id, code, nom, region, capacite_gavage_max, nb_gaveurs_actifs
        FROM sites_euralis
        ORDER BY code
    """)
    return [dict(row) for row in rows]
```

### Sécuriser une route SQAL

**AVANT** :
```python
@router.get("/api/sqal/devices")
async def get_devices():
    # ...
```

**APRÈS** :
```python
from app.auth.keycloak import require_role

@router.get("/api/sqal/devices")
async def get_devices(current_user = Depends(require_role("technicien_sqal"))):
    """
    Liste des dispositifs SQAL

    Permissions requises:
    - Rôle: technicien_sqal
    """
    # ...
```

---

## Middleware de sécurité

### Activation du middleware (optionnel)

Le middleware `SecurityMiddleware` peut **forcer l'authentification** sur toutes les routes sauf les routes publiques.

**Fichier** : `backend-api/app/auth/security_middleware.py`

**Routes publiques par défaut** :
```python
PUBLIC_ROUTES = [
    "/",
    "/health",
    "/health/startup",
    "/health/live",
    "/health/ready",
    "/metrics",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/auth/health",
    "/api/consumer/feedback",  # Public consumer feedback
    "/api/consumer/products",  # Public product listing
]
```

**Activer le middleware dans `main.py`** :
```python
from app.auth.security_middleware import SecurityMiddleware, AuditLoggingMiddleware
import os

# Enable security middleware if ENFORCE_AUTHENTICATION=true
if os.getenv("ENFORCE_AUTHENTICATION", "false").lower() == "true":
    app.add_middleware(SecurityMiddleware, enforce_auth=True)
    logger.info("🔒 Security middleware enabled - Authentication enforced on all routes")

# Enable audit logging
app.add_middleware(AuditLoggingMiddleware)
logger.info("📝 Audit logging middleware enabled")
```

**Fonctionnalités du middleware** :
- ✅ Validation automatique du token JWT
- ✅ Génération de Request ID unique
- ✅ Headers de sécurité (HSTS, CSP, X-Frame-Options, etc.)
- ✅ Audit logging de toutes les requêtes authentifiées
- ✅ Rejection automatique des tokens invalides (401)

---

## Audit logging

Tous les événements d'authentification sont loggés pour audit.

### Configuration du logger

**Fichier** : `backend-api/app/main.py`

```python
import logging

# Configure audit logger
audit_handler = logging.FileHandler("logs/audit.log")
audit_handler.setFormatter(
    logging.Formatter('%(asctime)s | %(message)s')
)
audit_logger = logging.getLogger("audit")
audit_logger.addHandler(audit_handler)
audit_logger.setLevel(logging.INFO)
```

### Types d'événements loggés

**TOKEN_VALIDATION** - Validation de token
```
2024-12-24T10:30:15Z | AUTH_EVENT | type=TOKEN_VALIDATION | user=jean.martin@gaveur.fr | success=True | timestamp=2024-12-24T10:30:15+00:00 | details=Roles: ['gaveur']
```

**AUTH_REQUIRED** - Accès sans token
```
2024-12-24T10:35:20Z | AUTH_EVENT | type=AUTH_REQUIRED | user=unknown | success=False | timestamp=2024-12-24T10:35:20+00:00 | details=No token provided
```

**AUTHENTICATED_REQUEST** - Requête authentifiée
```
2024-12-24T10:40:10Z | AUTHENTICATED_REQUEST | path=/api/euralis/sites | user=superviseur@euralis.fr | method=GET | ip=192.168.1.100 | request_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**DATA_MUTATION** - Mutation de données (POST/PUT/PATCH/DELETE)
```
2024-12-24T10:45:30Z | DATA_MUTATION | method=POST | path=/api/gavage/data | user=jean.martin@gaveur.fr | ip=192.168.1.101 | request_id=b2c3d4e5-f6a7-8901-bcde-f12345678901
```

**UNAUTHORIZED_ACCESS** - Tentative d'accès non autorisé
```
2024-12-24T10:50:45Z | UNAUTHORIZED_ACCESS | path=/api/admin/users | ip=192.168.1.102 | request_id=c3d4e5f6-a7b8-9012-cdef-123456789012 | reason=invalid_token | error=Token has expired
```

### Analyse des logs

```bash
# Voir tous les événements d'authentification
cat logs/audit.log | grep "AUTH_EVENT"

# Voir les échecs d'authentification
cat logs/audit.log | grep "success=False"

# Voir les mutations de données
cat logs/audit.log | grep "DATA_MUTATION"

# Voir les accès non autorisés
cat logs/audit.log | grep "UNAUTHORIZED_ACCESS"

# Tracer une requête spécifique par request_id
cat logs/audit.log | grep "request_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

---

## Dépannage

### Erreur: "Could not validate credentials"

**Cause** : Token JWT invalide ou expiré

**Solutions** :
1. Vérifier que le token n'a pas expiré (durée par défaut: 5 minutes)
2. Refresh le token via `/api/auth/refresh`
3. Se reconnecter via `/api/auth/login`

### Erreur: "Token has expired"

**Cause** : Le token a dépassé sa durée de validité

**Solution** : Utiliser le refresh token pour obtenir un nouveau access token
```bash
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "your-refresh-token"}'
```

### Erreur: "Invalid token issuer"

**Cause** : Le token ne provient pas du bon realm Keycloak

**Solution** : Vérifier que :
```bash
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=gaveurs-production
```

Et que le token a bien été émis par `http://localhost:8080/realms/gaveurs-production`

### Erreur: "Role 'superviseur' required"

**Cause** : L'utilisateur n'a pas le rôle requis

**Solution** :
1. Vérifier les rôles de l'utilisateur dans Keycloak
2. Aller sur http://localhost:8080 → Admin Console
3. Users → Sélectionner utilisateur → Role mapping
4. Assigner le rôle requis

### Erreur: "Gaveur ID not found"

**Cause** : L'attribut custom `gaveur_id` n'est pas configuré dans Keycloak

**Solution** : Ajouter l'attribut custom dans Keycloak
1. Admin Console → Users → Sélectionner utilisateur
2. Attributes tab
3. Ajouter : `gaveur_id` = `1` (ou l'ID approprié)
4. Save

### Headers de sécurité bloquent le frontend

**Cause** : CSP (Content Security Policy) trop stricte

**Solution** : Ajuster les headers dans `security_middleware.py`
```python
# Exemple: Permettre les scripts inline (dev only!)
response.headers["Content-Security-Policy"] = "default-src 'self' 'unsafe-inline'; frame-ancestors 'none';"
```

**⚠️ Note** : Ne PAS utiliser `'unsafe-inline'` en production

---

## Configuration Keycloak avancée

### Ajouter des custom claims au token

Pour inclure `gaveur_id` et `site_id` dans le token JWT :

1. **Keycloak Admin Console** → `gaveurs-production` realm
2. **Client Scopes** → Create
   - Name: `user-attributes`
   - Protocol: `openid-connect`
3. **Mappers** tab → Create protocol mapper
   - Name: `gaveur-id`
   - Mapper Type: `User Attribute`
   - User Attribute: `gaveur_id`
   - Token Claim Name: `gaveur_id`
   - Claim JSON Type: `int`
   - Add to ID token: ON
   - Add to access token: ON
   - Add to userinfo: ON
4. Répéter pour `site_id` (Claim JSON Type: `String`)
5. **Clients** → `backend-api` → **Client Scopes** tab
6. Ajouter `user-attributes` aux Default Client Scopes

### Augmenter la durée de validité du token

1. **Clients** → `backend-api`
2. **Advanced** tab → **Advanced Settings**
3. **Access Token Lifespan**: `60` minutes (au lieu de 5)
4. **Client Session Idle**: `120` minutes
5. **Client Session Max**: `480` minutes

### Activer le refresh token offline

1. **Clients** → `backend-api`
2. **Settings** tab
3. **Offline Access Enabled**: ON
4. Save

Les refresh tokens pourront maintenant être utilisés indéfiniment (jusqu'à révocation).

---

## Checklist de sécurité

Avant de déployer en production :

- [ ] Client secret configuré dans `.env` (NE JAMAIS commit dans Git)
- [ ] `VERIFY_TOKEN_EXPIRATION=true`
- [ ] `VERIFY_TOKEN_SIGNATURE=true`
- [ ] `VERIFY_TOKEN_ISSUER=true`
- [ ] Toutes les routes sensibles protégées avec RBAC
- [ ] Audit logging activé
- [ ] Logs audit sauvegardés dans un système sécurisé
- [ ] HTTPS activé (TLS/SSL)
- [ ] CORS configuré avec origines spécifiques (pas `allow_origins=["*"]`)
- [ ] Rate limiting activé
- [ ] Security headers validés
- [ ] Custom claims Keycloak configurés (`gaveur_id`, `site_id`)
- [ ] Durée de validité des tokens appropriée (5-60 min)
- [ ] Refresh tokens sécurisés (httpOnly cookies recommandé)

---

## Ressources

- **Documentation Keycloak** : https://www.keycloak.org/documentation
- **FastAPI Security** : https://fastapi.tiangolo.com/tutorial/security/
- **JWT.io** : https://jwt.io (decoder de tokens)
- **OWASP Authentication Cheat Sheet** : https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

---

**✅ Sécurité Keycloak configurée et opérationnelle!**

Le backend est maintenant équipé d'une authentification et autorisation production-ready avec validation JWT complète, RBAC granulaire et audit logging complet.
