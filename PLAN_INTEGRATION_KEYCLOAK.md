# Plan d'Intégration Keycloak - Système Gaveurs V3.0

**Date**: 22 Décembre 2025
**Objectif**: Authentification centralisée avec Keycloak pour les 3 frontends

---

## 🎯 Objectifs

### Besoins
1. ✅ **SSO (Single Sign-On)** - Une seule connexion pour tous les frontends
2. ✅ **Organisations** - Structurer les utilisateurs (Euralis, Gaveurs individuels, SQAL)
3. ✅ **Clients Keycloak** - 1 client par frontend (3 clients)
4. ✅ **Rôles hiérarchiques** - Admin, Superviseur, Gaveur, Technicien SQAL, Consommateur
5. ✅ **Conservation pages login** - Garder design actuel des pages login
6. ✅ **Autorisation granulaire** - Accès différencié selon rôles

---

## 📊 Architecture Keycloak

### Structure Organisationnelle

```
REALM: gaveurs-production
│
├── ORGANIZATIONS (Keycloak 23+)
│   ├── Euralis (Organisation mère)
│   ├── Gaveurs (Organisation gaveurs individuels)
│   └── SQAL (Organisation contrôle qualité)
│
├── CLIENTS (3 frontends)
│   ├── euralis-frontend (Next.js port 3000)
│   ├── gaveurs-frontend (Next.js port 3001)
│   └── sqal-frontend (React port 5173)
│
├── ROLES
│   ├── Realm Roles (globaux)
│   │   ├── admin (accès total)
│   │   ├── superviseur (multi-sites Euralis)
│   │   ├── gaveur (individuel)
│   │   ├── technicien_sqal (contrôle qualité)
│   │   └── consommateur (lecture seule feedback)
│   │
│   └── Client Roles (spécifiques)
│       ├── euralis-frontend:
│       │   ├── view_all_sites
│       │   ├── manage_gaveurs
│       │   └── view_analytics
│       │
│       ├── gaveurs-frontend:
│       │   ├── manage_own_data
│       │   ├── view_own_analytics
│       │   └── use_ai_training
│       │
│       └── sqal-frontend:
│           ├── view_sensors
│           ├── manage_quality
│           └── export_reports
│
└── USERS (exemples)
    ├── admin@euralis.fr (admin)
    ├── superviseur@euralis.fr (superviseur + view_all_sites)
    ├── jean.martin@gaveur.fr (gaveur + manage_own_data)
    ├── sophie.dubois@gaveur.fr (gaveur + manage_own_data)
    └── tech@sqal.fr (technicien_sqal + view_sensors)
```

---

## 🐳 Configuration Docker Keycloak

### Fichier: `docker-compose.keycloak.yml`

```yaml
version: '3.8'

services:
  keycloak-db:
    image: postgres:15
    container_name: gaveurs-keycloak-db
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: keycloak_secure_2024
    volumes:
      - keycloak-db-data:/var/lib/postgresql/data
    networks:
      - gaveurs-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U keycloak"]
      interval: 10s
      timeout: 5s
      retries: 5

  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    container_name: gaveurs-keycloak
    environment:
      # Database
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://keycloak-db:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: keycloak_secure_2024

      # Keycloak Admin
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin_secure_2024

      # Hostname
      KC_HOSTNAME: localhost
      KC_HOSTNAME_PORT: 8080
      KC_HOSTNAME_STRICT: false
      KC_HOSTNAME_STRICT_HTTPS: false

      # HTTP
      KC_HTTP_ENABLED: true
      KC_HTTP_PORT: 8080

      # Health
      KC_HEALTH_ENABLED: true
      KC_METRICS_ENABLED: true

      # Logging
      KC_LOG_LEVEL: INFO
    command:
      - start-dev
    ports:
      - "8080:8080"
    depends_on:
      keycloak-db:
        condition: service_healthy
    networks:
      - gaveurs-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

volumes:
  keycloak-db-data:
    driver: local

networks:
  gaveurs-network:
    external: true
```

### Démarrage

```bash
# Créer réseau (si pas déjà fait)
docker network create gaveurs-network

# Démarrer Keycloak
docker-compose -f docker-compose.keycloak.yml up -d

# Vérifier logs
docker logs -f gaveurs-keycloak

# Accès admin: http://localhost:8080
# User: admin
# Pass: admin_secure_2024
```

---

## 🔧 Configuration Keycloak (Console Admin)

### Étape 1: Créer Realm

1. Aller sur http://localhost:8080
2. Login admin / admin_secure_2024
3. Master dropdown → "Create Realm"
4. Name: `gaveurs-production`
5. Enabled: ON
6. Save

### Étape 2: Créer Clients (3 frontends)

#### Client 1: euralis-frontend

```
Client ID: euralis-frontend
Name: Euralis Dashboard
Client Protocol: openid-connect
Access Type: public
Standard Flow: ON
Direct Access Grants: ON
Valid Redirect URIs:
  - http://localhost:3000/*
  - http://localhost:3000/auth/callback
Web Origins:
  - http://localhost:3000
```

#### Client 2: gaveurs-frontend

```
Client ID: gaveurs-frontend
Name: Gaveurs Individual App
Client Protocol: openid-connect
Access Type: public
Standard Flow: ON
Direct Access Grants: ON
Valid Redirect URIs:
  - http://localhost:3001/*
  - http://localhost:3001/auth/callback
Web Origins:
  - http://localhost:3001
```

#### Client 3: sqal-frontend

```
Client ID: sqal-frontend
Name: SQAL Quality Control
Client Protocol: openid-connect
Access Type: public
Standard Flow: ON
Direct Access Grants: ON
Valid Redirect URIs:
  - http://localhost:5173/*
  - http://localhost:5173/auth/callback
Web Origins:
  - http://localhost:5173
```

### Étape 3: Créer Realm Roles

```
Roles → Realm Roles → Create Role

1. admin
   Description: Administrateur système (accès total)

2. superviseur
   Description: Superviseur Euralis (multi-sites)

3. gaveur
   Description: Gaveur individuel

4. technicien_sqal
   Description: Technicien SQAL (contrôle qualité)

5. consommateur
   Description: Consommateur (feedback uniquement)
```

### Étape 4: Créer Client Roles

#### euralis-frontend

```
Clients → euralis-frontend → Roles → Add Role

1. view_all_sites
2. manage_gaveurs
3. view_analytics
4. export_reports
5. manage_lots
```

#### gaveurs-frontend

```
Clients → gaveurs-frontend → Roles → Add Role

1. manage_own_data
2. view_own_analytics
3. use_ai_training
4. view_blockchain
5. submit_feedback
```

#### sqal-frontend

```
Clients → sqal-frontend → Roles → Add Role

1. view_sensors
2. manage_quality
3. export_reports
4. calibrate_devices
5. view_realtime
```

### Étape 5: Créer Users

#### User 1: Admin

```
Users → Add user

Username: admin@euralis.fr
Email: admin@euralis.fr
First Name: Admin
Last Name: Euralis
Enabled: ON

→ Credentials
Password: admin123
Temporary: OFF

→ Role Mappings
Realm Roles: admin
Client Roles (euralis-frontend): ALL
Client Roles (gaveurs-frontend): ALL
Client Roles (sqal-frontend): ALL
```

#### User 2: Superviseur

```
Username: superviseur@euralis.fr
Email: superviseur@euralis.fr
First Name: Marie
Last Name: Dupont
Enabled: ON

Password: super123
Temporary: OFF

Realm Roles: superviseur
Client Roles (euralis-frontend):
  - view_all_sites
  - manage_gaveurs
  - view_analytics
  - export_reports
```

#### User 3: Gaveur

```
Username: jean.martin@gaveur.fr
Email: jean.martin@gaveur.fr
First Name: Jean
Last Name: Martin
Enabled: ON

Password: gaveur123
Temporary: OFF

Realm Roles: gaveur
Client Roles (gaveurs-frontend):
  - manage_own_data
  - view_own_analytics
  - use_ai_training
  - view_blockchain

→ Attributes (custom)
gaveur_id: 1
site: LL
```

#### User 4: Technicien SQAL

```
Username: tech@sqal.fr
Email: tech@sqal.fr
First Name: Sophie
Last Name: Dubois
Enabled: ON

Password: sqal123
Temporary: OFF

Realm Roles: technicien_sqal
Client Roles (sqal-frontend):
  - view_sensors
  - manage_quality
  - export_reports
  - view_realtime
```

---

## 🔐 Intégration Backend (FastAPI)

### Installation

```bash
cd backend-api
pip install python-keycloak python-jose[cryptography] passlib[bcrypt]
```

### Fichier: `backend-api/app/auth/keycloak.py`

```python
"""
Keycloak Authentication & Authorization
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from keycloak import KeycloakOpenID
from jose import jwt, JWTError
from typing import Optional, List
import os

# Keycloak Configuration
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "gaveurs-production")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "backend-api")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Keycloak OpenID Connect Client
keycloak_openid = KeycloakOpenID(
    server_url=KEYCLOAK_URL,
    client_id=KEYCLOAK_CLIENT_ID,
    realm_name=KEYCLOAK_REALM,
    client_secret_key=KEYCLOAK_CLIENT_SECRET
)


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Valide le token JWT et retourne l'utilisateur
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode and validate token
        KEYCLOAK_PUBLIC_KEY = f"-----BEGIN PUBLIC KEY-----\n{keycloak_openid.public_key()}\n-----END PUBLIC KEY-----"

        payload = jwt.decode(
            token,
            KEYCLOAK_PUBLIC_KEY,
            algorithms=["RS256"],
            audience=KEYCLOAK_CLIENT_ID
        )

        username: str = payload.get("preferred_username")
        if username is None:
            raise credentials_exception

        return {
            "username": username,
            "email": payload.get("email"),
            "roles": payload.get("realm_access", {}).get("roles", []),
            "client_roles": payload.get("resource_access", {}).get(KEYCLOAK_CLIENT_ID, {}).get("roles", []),
            "sub": payload.get("sub")
        }

    except JWTError:
        raise credentials_exception


def require_role(required_role: str):
    """
    Decorator pour vérifier qu'un utilisateur a un rôle spécifique
    """
    async def role_checker(current_user = Depends(get_current_user)):
        if required_role not in current_user["roles"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required"
            )
        return current_user
    return role_checker


def require_any_role(required_roles: List[str]):
    """
    Decorator pour vérifier qu'un utilisateur a AU MOINS UN des rôles
    """
    async def role_checker(current_user = Depends(get_current_user)):
        user_roles = current_user["roles"]
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these roles required: {', '.join(required_roles)}"
            )
        return current_user
    return role_checker
```

### Fichier: `backend-api/app/api/auth_routes.py`

```python
"""
Authentication Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.auth.keycloak import keycloak_openid, get_current_user

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"


@router.post("/api/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    """
    Login avec Keycloak
    """
    try:
        token = keycloak_openid.token(credentials.username, credentials.password)
        return TokenResponse(
            access_token=token["access_token"],
            refresh_token=token["refresh_token"],
            expires_in=token["expires_in"]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )


@router.post("/api/auth/refresh")
async def refresh_token(refresh_token: str):
    """
    Refresh access token
    """
    try:
        token = keycloak_openid.refresh_token(refresh_token)
        return TokenResponse(
            access_token=token["access_token"],
            refresh_token=token["refresh_token"],
            expires_in=token["expires_in"]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.post("/api/auth/logout")
async def logout(refresh_token: str):
    """
    Logout (invalidate refresh token)
    """
    try:
        keycloak_openid.logout(refresh_token)
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logout failed"
        )


@router.get("/api/auth/me")
async def get_current_user_info(current_user = Depends(get_current_user)):
    """
    Get current user info
    """
    return current_user
```

### Mise à jour `main.py`

```python
# backend-api/app/main.py

from app.api import auth_routes

# Include router
app.include_router(auth_routes.router)
```

---

## 🎨 Intégration Frontend Gaveurs

### Installation

```bash
cd gaveurs-frontend
npm install @react-keycloak/web keycloak-js
```

### Fichier: `gaveurs-frontend/lib/keycloak.ts`

```typescript
import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080',
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'gaveurs-production',
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'gaveurs-frontend',
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
```

### Fichier: `gaveurs-frontend/components/auth/KeycloakProvider.tsx`

```typescript
'use client';

import { ReactKeycloakProvider } from '@react-keycloak/web';
import keycloak from '@/lib/keycloak';
import { useRouter } from 'next/navigation';

export default function KeycloakProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const onEvent = (event: string, error: any) => {
    console.log('Keycloak event:', event, error);

    if (event === 'onAuthSuccess') {
      // Save token to localStorage
      if (keycloak.token) {
        localStorage.setItem('access_token', keycloak.token);
        localStorage.setItem('refresh_token', keycloak.refreshToken || '');
      }
    }

    if (event === 'onAuthLogout') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      router.push('/login');
    }
  };

  return (
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={{
        onLoad: 'check-sso',
        checkLoginIframe: false,
        pkceMethod: 'S256',
      }}
      onEvent={onEvent}
    >
      {children}
    </ReactKeycloakProvider>
  );
}
```

### Fichier: `gaveurs-frontend/app/layout.tsx` (mise à jour)

```typescript
import KeycloakProvider from '@/components/auth/KeycloakProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <KeycloakProvider>
          {children}
        </KeycloakProvider>
      </body>
    </html>
  );
}
```

### Fichier: `gaveurs-frontend/app/login/page.tsx` (avec design actuel)

```typescript
'use client';

import { useState } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { keycloak } = useKeycloak();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Login via Backend API (qui utilise Keycloak)
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const { access_token, refresh_token } = await response.json();

      // Save tokens
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);

      // Redirect to dashboard
      router.push('/');

    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-6xl">🦆</span>
          <h1 className="text-3xl font-bold mt-4">Système Gaveurs</h1>
          <p className="text-gray-600">Connexion</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="jean.martin@gaveur.fr"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Version 3.0 - Authentification Keycloak</p>
        </div>
      </div>
    </div>
  );
}
```

---

## 📋 Fichiers de Configuration

### `.env` Backend

```env
# Keycloak
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=gaveurs-production
KEYCLOAK_CLIENT_ID=backend-api
KEYCLOAK_CLIENT_SECRET=  # Récupérer depuis Keycloak admin
```

### `.env.local` Gaveurs Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM=gaveurs-production
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=gaveurs-frontend
```

---

## ✅ Plan d'Exécution

### Phase 1: Setup Keycloak (30 min)
1. Créer `docker-compose.keycloak.yml`
2. Démarrer Keycloak + DB
3. Créer Realm `gaveurs-production`
4. Créer 3 clients (euralis, gaveurs, sqal)
5. Créer Realm roles (5)
6. Créer Client roles (15)
7. Créer 4 users de test

### Phase 2: Backend Integration (1h)
1. Installer dépendances Python
2. Créer `app/auth/keycloak.py`
3. Créer `app/api/auth_routes.py`
4. Mettre à jour `main.py`
5. Tester endpoints auth
6. Protéger routes existantes avec `@require_role`

### Phase 3: Frontend Gaveurs (1h)
1. Installer dépendances NPM
2. Créer `lib/keycloak.ts`
3. Créer `KeycloakProvider.tsx`
4. Mettre à jour `layout.tsx`
5. Créer nouvelle page `/login`
6. Tester login/logout

### Phase 4: Frontend Euralis (1h)
- Répéter Phase 3 pour euralis-frontend

### Phase 5: Frontend SQAL (1h)
- Répéter Phase 3 pour sqal-frontend

---

## 🎯 Qu'en pensez-vous?

**Avantages**:
- ✅ SSO centralisé
- ✅ Gestion rôles granulaire
- ✅ Conservation design login actuel
- ✅ Scalable (ajout facile users/roles)
- ✅ Sécurisé (JWT RS256)

**Je commence par quoi?**
1. Setup Keycloak Docker
2. Backend integration
3. Frontend gaveurs integration

Êtes-vous d'accord avec ce plan?
