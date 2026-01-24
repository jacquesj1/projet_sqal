# Keycloak Authentication Setup - Phase 5

## Vue d'ensemble

Configuration de l'authentification centralisée avec Keycloak pour les 3 applications frontend (SQAL, Euralis, Gaveurs).

## Architecture

```
┌─────────────────┐
│   Keycloak      │  Port 8080
│   Auth Server   │  Realm: sqal_realm
└────────┬────────┘
         │
    ┌────┴────┬────────┬─────────┐
    │         │        │         │
┌───▼───┐ ┌──▼───┐ ┌──▼────┐ ┌──▼────────┐
│ SQAL  │ │Euralis│ │Gaveurs│ │ Backend   │
│:5173  │ │:3000  │ │:3001  │ │ API :8000 │
└───────┘ └───────┘ └───────┘ └───────────┘
```

## 1. Démarrage Keycloak avec Docker

### docker-compose.keycloak.yml

```yaml
version: '3.8'

services:
  keycloak-postgres:
    image: postgres:15
    container_name: keycloak-postgres
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: keycloak_secure_password_2024
    volumes:
      - keycloak-postgres-data:/var/lib/postgresql/data
    networks:
      - keycloak-network
    restart: unless-stopped

  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    container_name: keycloak
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://keycloak-postgres:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: keycloak_secure_password_2024
      KC_HOSTNAME: localhost
      KC_HOSTNAME_PORT: 8080
      KC_HTTP_ENABLED: "true"
      KC_HOSTNAME_STRICT_HTTPS: "false"
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin_secure_2024
    command:
      - start-dev
    ports:
      - "8080:8080"
    depends_on:
      - keycloak-postgres
    networks:
      - keycloak-network
    restart: unless-stopped

volumes:
  keycloak-postgres-data:

networks:
  keycloak-network:
    driver: bridge
```

### Démarrage

```bash
# Démarrer Keycloak
docker-compose -f docker-compose.keycloak.yml up -d

# Vérifier les logs
docker logs -f keycloak

# Accéder à l'interface admin
# http://localhost:8080
# Username: admin
# Password: admin_secure_2024
```

## 2. Configuration du Realm SQAL

### Créer le realm "sqal_realm"

1. Se connecter à http://localhost:8080
2. Cliquer sur "Create Realm"
3. Nom: `sqal_realm`
4. Enabled: ON
5. Cliquer sur "Create"

### Créer les clients (3 applications)

#### Client 1: sqal-frontend

```json
{
  "clientId": "sqal-frontend",
  "name": "SQAL Quality Control Frontend",
  "description": "Frontend application for SQAL quality control",
  "enabled": true,
  "clientAuthenticatorType": "client-secret",
  "redirectUris": [
    "http://localhost:5173/*",
    "http://localhost:5173"
  ],
  "webOrigins": [
    "http://localhost:5173"
  ],
  "publicClient": true,
  "protocol": "openid-connect",
  "standardFlowEnabled": true,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": true,
  "attributes": {
    "pkce.code.challenge.method": "S256"
  }
}
```

#### Client 2: euralis-frontend

```json
{
  "clientId": "euralis-frontend",
  "name": "Euralis Supervisor Dashboard",
  "enabled": true,
  "publicClient": true,
  "redirectUris": [
    "http://localhost:3000/*"
  ],
  "webOrigins": [
    "http://localhost:3000"
  ],
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": true,
  "attributes": {
    "pkce.code.challenge.method": "S256"
  }
}
```

#### Client 3: gaveurs-frontend

```json
{
  "clientId": "gaveurs-frontend",
  "name": "Gaveurs Individual App",
  "enabled": true,
  "publicClient": true,
  "redirectUris": [
    "http://localhost:3001/*"
  ],
  "webOrigins": [
    "http://localhost:3001"
  ],
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": true,
  "attributes": {
    "pkce.code.challenge.method": "S256"
  }
}
```

#### Client 4: backend-api (confidential)

```json
{
  "clientId": "backend-api",
  "name": "Backend API",
  "enabled": true,
  "publicClient": false,
  "serviceAccountsEnabled": true,
  "authorizationServicesEnabled": true,
  "clientAuthenticatorType": "client-secret",
  "secret": "backend_api_secret_2024"
}
```

## 3. Création des Rôles

### Rôles du Realm

Créer les rôles suivants dans le realm `sqal_realm`:

1. **super_admin** - Administrateur système complet
2. **org_admin** - Administrateur d'organisation
3. **quality_manager** - Responsable qualité
4. **production_operator** - Opérateur production
5. **data_analyst** - Analyste de données
6. **viewer** - Lecteur seul

### Hiérarchie des rôles

```
super_admin (tous les droits)
  └── org_admin (gestion organisation)
      └── quality_manager (validation qualité)
          └── production_operator (saisie données)
              └── data_analyst (analyse)
                  └── viewer (lecture seule)
```

### Composite Roles

Configurer les rôles composites:
- `super_admin` inclut tous les autres rôles
- `org_admin` inclut: quality_manager, production_operator, data_analyst, viewer
- `quality_manager` inclut: production_operator, data_analyst, viewer
- `production_operator` inclut: data_analyst, viewer
- `data_analyst` inclut: viewer

## 4. Création des Utilisateurs de Test

### Script de création utilisateurs

```bash
# Utiliser Keycloak Admin CLI
docker exec -it keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user admin \
  --password admin_secure_2024

# Créer utilisateur super_admin
docker exec -it keycloak /opt/keycloak/bin/kcadm.sh create users \
  -r sqal_realm \
  -s username=admin@sqal.com \
  -s email=admin@sqal.com \
  -s firstName=Admin \
  -s lastName=System \
  -s enabled=true

# Définir mot de passe
docker exec -it keycloak /opt/keycloak/bin/kcadm.sh set-password \
  -r sqal_realm \
  --username admin@sqal.com \
  --new-password Admin123!

# Assigner rôle
docker exec -it keycloak /opt/keycloak/bin/kcadm.sh add-roles \
  -r sqal_realm \
  --uusername admin@sqal.com \
  --rolename super_admin
```

### Utilisateurs de test recommandés

| Email | Mot de passe | Rôle | Description |
|-------|-------------|------|-------------|
| admin@sqal.com | Admin123! | super_admin | Administrateur système |
| org.admin@euralis.com | OrgAdmin123! | org_admin | Admin organisation Euralis |
| quality@sqal.com | Quality123! | quality_manager | Responsable qualité |
| operator@gaveurs.com | Operator123! | production_operator | Opérateur gaveur |
| analyst@euralis.com | Analyst123! | data_analyst | Analyste données |
| viewer@sqal.com | Viewer123! | viewer | Utilisateur lecture seule |

## 5. Backend JWT Validation

### Installation des dépendances Python

```bash
cd backend-api
pip install python-jose[cryptography] python-keycloak
```

### app/auth/keycloak.py

```python
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from typing import Optional, List
import httpx

KEYCLOAK_SERVER_URL = "http://localhost:8080"
KEYCLOAK_REALM = "sqal_realm"
KEYCLOAK_PUBLIC_KEY_URL = f"{KEYCLOAK_SERVER_URL}/realms/{KEYCLOAK_REALM}"

security = HTTPBearer()

async def get_keycloak_public_key():
    """Récupère la clé publique depuis Keycloak"""
    async with httpx.AsyncClient() as client:
        response = await client.get(KEYCLOAK_PUBLIC_KEY_URL)
        realm_info = response.json()
        return f"-----BEGIN PUBLIC KEY-----\n{realm_info['public_key']}\n-----END PUBLIC KEY-----"

async def verify_token(credentials: HTTPAuthCredentials = Depends(security)) -> dict:
    """Vérifie et décode le JWT token"""
    try:
        public_key = await get_keycloak_public_key()
        payload = jwt.decode(
            credentials.credentials,
            public_key,
            algorithms=["RS256"],
            audience="account",
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

def require_role(required_role: str):
    """Decorator pour vérifier le rôle"""
    async def role_checker(token_payload: dict = Depends(verify_token)):
        roles = token_payload.get("realm_access", {}).get("roles", [])
        if required_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required"
            )
        return token_payload
    return role_checker

def require_any_role(required_roles: List[str]):
    """Vérifie si l'utilisateur a au moins un des rôles"""
    async def role_checker(token_payload: dict = Depends(verify_token)):
        user_roles = token_payload.get("realm_access", {}).get("roles", [])
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of roles {required_roles} required"
            )
        return token_payload
    return role_checker
```

### Utilisation dans les routes

```python
from fastapi import APIRouter, Depends
from app.auth.keycloak import verify_token, require_role, require_any_role

router = APIRouter()

# Route publique (pas d'auth)
@router.get("/api/public/health")
async def health_check():
    return {"status": "ok"}

# Route authentifiée (tout utilisateur connecté)
@router.get("/api/dashboard")
async def dashboard(token: dict = Depends(verify_token)):
    user_id = token.get("sub")
    username = token.get("preferred_username")
    return {"user_id": user_id, "username": username}

# Route avec rôle requis
@router.post("/api/admin/users")
async def create_user(token: dict = Depends(require_role("super_admin"))):
    return {"message": "User created"}

# Route avec plusieurs rôles acceptés
@router.get("/api/quality/reports")
async def quality_reports(
    token: dict = Depends(require_any_role(["quality_manager", "org_admin", "super_admin"]))
):
    return {"reports": []}
```

## 6. Configuration Frontend (SQAL déjà fait)

Les frontends SQAL, Euralis et Gaveurs ont déjà la configuration Keycloak:

- SQAL: `src/config/keycloak.ts`, `src/contexts/AuthContext.tsx`
- Euralis: À faire
- Gaveurs: À faire

## 7. Tests

### Tester l'authentification

```bash
# 1. Obtenir un token
curl -X POST "http://localhost:8080/realms/sqal_realm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=backend-api" \
  -d "client_secret=backend_api_secret_2024" \
  -d "grant_type=password" \
  -d "username=admin@sqal.com" \
  -d "password=Admin123!"

# 2. Utiliser le token dans une requête
curl -X GET "http://localhost:8000/api/dashboard" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 8. Production

### Configuration HTTPS

Pour la production, configurer:
- Certificats SSL/TLS
- Reverse proxy (Nginx)
- HTTPS uniquement
- CORS restrictif

### Variables d'environnement

```env
KEYCLOAK_SERVER_URL=https://auth.euralis-sqal.com
KEYCLOAK_REALM=sqal_realm
KEYCLOAK_CLIENT_ID=backend-api
KEYCLOAK_CLIENT_SECRET=<secret-from-vault>
```

## Prochaines étapes

1. ✅ Keycloak Docker setup
2. ✅ Realm et clients configurés
3. ✅ Rôles créés
4. ✅ Backend JWT validation
5. ⏳ Frontend Euralis login flow
6. ⏳ Frontend Gaveurs login flow
7. ⏳ Tests d'intégration auth
8. ⏳ Documentation utilisateur

## Ressources

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [python-jose](https://python-jose.readthedocs.io/)
