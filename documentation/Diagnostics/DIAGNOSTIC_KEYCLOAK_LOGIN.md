# Diagnostic Keycloak - Problème de Login

## 📋 Résumé

**Problème**: Les frontends ne redirigent pas vers la page de login Keycloak malgré l'installation de Keycloak.

**Cause racine**: Configuration incomplète de Keycloak et intégration frontend partielle.

---

## ✅ Ce qui fonctionne

### 1. Keycloak Backend
- ✅ Container Keycloak démarré: `gaveurs-keycloak` (port 8080)
- ✅ Base de données Keycloak: `gaveurs-keycloak-db` (healthy)
- ✅ Health check: Keycloak répond à `/health/ready`
- ⚠️ Statut: **unhealthy** (mais fonctionnel en mode dev)

```bash
# Vérification
docker ps --filter "name=keycloak"
# NAMES                 STATUS
# gaveurs-keycloak      Up 22 minutes (unhealthy)
# gaveurs-keycloak-db   Up 22 minutes (healthy)

# Test health
curl http://localhost:8080/health/ready
# {"status": "UP", "checks": [...]}
```

### 2. Configuration Backend API
- ✅ Module d'authentification: `backend-api/app/auth/keycloak.py`
- ✅ Variables d'environnement configurées dans `.env`:
  ```env
  KEYCLOAK_URL=http://localhost:8080
  KEYCLOAK_REALM=gaveurs-production
  KEYCLOAK_CLIENT_ID=backend-api
  KEYCLOAK_CLIENT_SECRET=ISkV1SEWGCDjDvKK8muYzPEV9AWMy7WX
  ENFORCE_AUTHENTICATION=false  # ⚠️ DÉSACTIVÉ
  ```
- ⚠️ **ENFORCE_AUTHENTICATION=false** → L'authentification n'est PAS obligatoire

---

## ❌ Ce qui ne fonctionne PAS

### 1. **Frontend Euralis** - AUCUNE intégration Keycloak

**Fichier**: `euralis-frontend/app/layout.tsx`
```tsx
// ❌ Pas de provider Keycloak
export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>  {/* ← Aucune protection */}
    </html>
  );
}
```

**Configuration manquante**:
- ❌ Pas de `KeycloakProvider`
- ❌ Pas de redirection login
- ❌ Pas de route protégée
- ⚠️ `.env.local` existe mais pas utilisé:
  ```env
  NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
  NEXT_PUBLIC_KEYCLOAK_REALM=gaveurs-production
  NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=gaveurs-frontend  # ⚠️ Pas euralis-frontend
  ```

### 2. **Frontend Gaveurs** - Authentification Custom (pas Keycloak)

**Fichier**: `gaveurs-frontend/context/AuthContext.tsx`
```tsx
// ❌ Utilise une auth custom avec cookies, PAS Keycloak
const login = async (email: string, password: string) => {
  const data = await authApi.login({ email, password }); // ← API custom
  Cookies.set('auth_token', data.access_token, COOKIE_OPTIONS);
  localStorage.setItem('user', JSON.stringify(data.user));
};
```

**Problème**:
- ✅ `KeycloakProvider.tsx` existe mais **n'est pas utilisé** dans `layout.tsx`
- ✅ `.env.local` configuré correctement
- ❌ `AuthProvider` custom utilisé au lieu de `KeycloakProvider`

### 3. **Frontend SQAL** - Keycloak configuré mais DÉSACTIVÉ

**Fichier**: `sqal/FrontEnd/src/contexts/AuthContext.tsx`
```tsx
const initKeycloak = async () => {
  try {
    console.log('🔐 Initializing Keycloak...');
    const authenticated = await keycloak.init(keycloakInitOptions);
    // ✅ Code présent mais...
  } catch (error) {
    console.warn('⚠️ Keycloak unavailable, falling back to mock auth');
    setKeycloakEnabled(false);  // ← FALLBACK sur auth mock
    setIsLoading(false);
  }
};
```

**Problème**:
- ✅ Config Keycloak présente: `sqal/FrontEnd/src/config/keycloak.ts`
- ⚠️ Realm configuré: `sqal_realm` (différent de `gaveurs-production`!)
- ❌ Si Keycloak échoue → fallback sur auth mock
- ❌ `onLoad: 'check-sso'` au lieu de `'login-required'`

---

## 🔧 Solutions

### Solution 1: Activer l'authentification obligatoire

**Backend**: Modifier `backend-api/.env`
```env
ENFORCE_AUTHENTICATION=true  # ← Changer false → true
```

### Solution 2: Configurer Keycloak dans l'interface admin

1. **Accéder à Keycloak**:
   ```
   URL: http://localhost:8080
   Username: admin
   Password: admin_secure_2024
   ```

2. **Créer le realm `gaveurs-production`** (s'il n'existe pas):
   - Master realm → Create Realm
   - Name: `gaveurs-production`
   - Enabled: ON

3. **Créer les clients pour chaque frontend**:

   **Client 1: euralis-frontend**
   ```
   Client ID: euralis-frontend
   Client Protocol: openid-connect
   Access Type: public
   Valid Redirect URIs: http://localhost:3000/*
   Web Origins: http://localhost:3000
   ```

   **Client 2: gaveurs-frontend**
   ```
   Client ID: gaveurs-frontend
   Client Protocol: openid-connect
   Access Type: public
   Valid Redirect URIs: http://localhost:3001/*
   Web Origins: http://localhost:3001
   ```

   **Client 3: sqal-frontend**
   ```
   Client ID: sqal-frontend
   Client Protocol: openid-connect
   Access Type: public
   Valid Redirect URIs: http://localhost:5173/*
   Web Origins: http://localhost:5173
   ```

   **Client 4: backend-api**
   ```
   Client ID: backend-api
   Client Protocol: openid-connect
   Access Type: confidential
   Service Accounts Enabled: ON
   Authorization Enabled: ON
   Valid Redirect URIs: http://localhost:8000/*
   ```
   → Copier le **Client Secret** dans `backend-api/.env`

4. **Créer les rôles**:
   - Realm Roles → Add Role:
     - `admin`
     - `superviseur`
     - `gaveur`
     - `technicien_sqal`
     - `veterinaire`

5. **Créer un utilisateur de test**:
   - Users → Add User
   - Username: `admin`
   - Email: `admin@gaveurs.com`
   - Email Verified: ON
   - Credentials → Set Password: `admin123`
   - Role Mappings → Assign `admin` role

### Solution 3: Intégrer Keycloak dans Euralis Frontend

**Créer**: `euralis-frontend/lib/keycloak.ts`
```typescript
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL!,
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM!,
  clientId: 'euralis-frontend', // ← Corriger le client ID
});

export default keycloak;
```

**Créer**: `euralis-frontend/components/auth/KeycloakProvider.tsx`
```typescript
'use client';

import { ReactNode, useEffect, useState } from 'react';
import keycloak from '@/lib/keycloak';
import { useRouter } from 'next/navigation';

export function KeycloakProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    keycloak.init({
      onLoad: 'login-required', // ← Force login
      checkLoginIframe: false,
      pkceMethod: 'S256',
    }).then((authenticated) => {
      setIsAuthenticated(authenticated);
      setIsLoading(false);
      if (!authenticated) {
        router.push('/login');
      }
    }).catch(() => {
      setIsLoading(false);
      router.push('/login');
    });
  }, [router]);

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  return isAuthenticated ? <>{children}</> : null;
}
```

**Modifier**: `euralis-frontend/app/layout.tsx`
```tsx
import { KeycloakProvider } from '@/components/auth/KeycloakProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <KeycloakProvider>  {/* ← Ajouter provider */}
          {children}
        </KeycloakProvider>
      </body>
    </html>
  );
}
```

**Modifier**: `euralis-frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM=gaveurs-production
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=euralis-frontend  # ← Corriger
```

### Solution 4: Corriger Gaveurs Frontend

**Modifier**: `gaveurs-frontend/app/layout.tsx`
```tsx
import { KeycloakProvider } from '@/components/auth/KeycloakProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={`${inter.className}`}>
        <KeycloakProvider>  {/* ← Utiliser Keycloak au lieu de AuthProvider */}
          <WebSocketProvider>
            <ToastProvider>
              <Navbar />
              <main>{children}</main>
              <Footer />
            </ToastProvider>
          </WebSocketProvider>
        </KeycloakProvider>
      </body>
    </html>
  );
}
```

### Solution 5: Corriger SQAL Frontend

**Modifier**: `sqal/FrontEnd/src/config/keycloak.ts`
```typescript
const keycloakConfig = {
  url: 'http://localhost:8080',
  realm: 'gaveurs-production',  // ← Changer sqal_realm → gaveurs-production
  clientId: 'sqal-frontend',
};

export const keycloakInitOptions = {
  onLoad: 'login-required' as const, // ← Changer check-sso → login-required
  pkceMethod: 'S256' as const,
  checkLoginIframe: false,
};
```

**Modifier**: `sqal/FrontEnd/src/contexts/AuthContext.tsx`
```typescript
const initKeycloak = async () => {
  try {
    const authenticated = await keycloak.init(keycloakInitOptions);
    setIsAuthenticated(authenticated);
    setKeycloakEnabled(true);

    if (!authenticated) {
      keycloak.login(); // ← Forcer login si non authentifié
    }
  } catch (error) {
    console.error('❌ Keycloak initialization failed:', error);
    // ❌ NE PAS faire de fallback, forcer l'utilisateur à se connecter
    keycloak.login();
  }
};
```

### Solution 6: Créer un realm unifié

**Option recommandée**: Utiliser **UN SEUL realm** `gaveurs-production` pour tous les frontends:

```
Realm: gaveurs-production
├── Client: euralis-frontend (port 3000)
├── Client: gaveurs-frontend (port 3001)
├── Client: sqal-frontend (port 5173)
└── Client: backend-api (port 8000)

Roles:
├── admin (accès à tout)
├── superviseur (euralis + multi-sites)
├── gaveur (gaveurs app)
├── technicien_sqal (sqal app)
└── veterinaire (consultation)
```

---

## 🚀 Procédure de démarrage complète

### 1. Démarrer Keycloak
```bash
docker-compose -f docker-compose.keycloak.yml up -d
docker logs -f gaveurs-keycloak  # Attendre "started in XXXs"
```

### 2. Configurer Keycloak
```bash
# Accéder à http://localhost:8080
# Login: admin / admin_secure_2024
# Créer realm + clients + rôles + utilisateurs (voir Solution 2)
```

### 3. Configurer Backend
```bash
cd backend-api
# Modifier .env: ENFORCE_AUTHENTICATION=true
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload
```

### 4. Démarrer Frontends (après modifications)
```bash
# Terminal 1 - Euralis
cd euralis-frontend
npm run dev

# Terminal 2 - Gaveurs
cd gaveurs-frontend
npm run dev -- --port 3001

# Terminal 3 - SQAL
cd sqal/FrontEnd
npm run dev
```

### 5. Tester
```
1. Ouvrir http://localhost:3000/euralis/dashboard
   → Doit rediriger vers http://localhost:8080/realms/gaveurs-production/...
   → Page de login Keycloak
   → Après login → retour à /euralis/dashboard

2. Ouvrir http://localhost:3001
   → Même flow

3. Ouvrir http://localhost:5173
   → Même flow
```

---

## 📊 État actuel vs État cible

| Composant | État actuel | État cible |
|-----------|-------------|------------|
| Keycloak Server | ✅ Démarré (unhealthy) | ✅ Healthy + realm configuré |
| Backend Auth | ⚠️ Installé mais désactivé | ✅ ENFORCE_AUTHENTICATION=true |
| Euralis Frontend | ❌ Aucune auth | ✅ Keycloak login-required |
| Gaveurs Frontend | ⚠️ Auth custom | ✅ Keycloak login-required |
| SQAL Frontend | ⚠️ Keycloak fallback | ✅ Keycloak login-required |
| Realm unifié | ❌ Pas créé | ✅ gaveurs-production |
| Clients configurés | ❌ Pas créés | ✅ 4 clients configurés |
| Rôles RBAC | ❌ Pas définis | ✅ 5 rôles créés |

---

## 🔍 Commandes de diagnostic

```bash
# Vérifier Keycloak
docker ps --filter "name=keycloak"
docker logs gaveurs-keycloak --tail 50
curl http://localhost:8080/health/ready

# Vérifier network
docker network ls | grep gaveurs
docker network inspect gaveurs-network

# Vérifier variables d'environnement backend
cd backend-api
cat .env | grep KEYCLOAK

# Tester endpoint auth backend
curl http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## 📚 Documentation à consulter

1. [documentation/KEYCLOAK_SETUP.md](documentation/KEYCLOAK_SETUP.md)
2. [KEYCLOAK_SECURITY_GUIDE.md](KEYCLOAK_SECURITY_GUIDE.md)
3. [KEYCLOAK_CONFIGURATION_GUIDE.md](KEYCLOAK_CONFIGURATION_GUIDE.md)
4. [backend-api/app/auth/keycloak.py](backend-api/app/auth/keycloak.py)

---

## ⚡ Solution rapide (Quick Fix)

Si vous voulez juste tester l'authentification **immédiatement**:

```bash
# 1. Configurer backend
echo "ENFORCE_AUTHENTICATION=false" >> backend-api/.env

# 2. Utiliser SQAL (le seul frontend avec Keycloak partiellement configuré)
cd sqal/FrontEnd

# 3. Modifier src/config/keycloak.ts
# Ligne 11: realm: 'gaveurs-production',
# Ligne 20: onLoad: 'login-required',

# 4. Démarrer
npm run dev

# 5. Accéder à http://localhost:5173
# → Devrait rediriger vers Keycloak login (si realm existe)
```

**Note**: Cette solution nécessite quand même de créer le realm + client dans Keycloak admin!

---

## ✅ Checklist finale

- [ ] Keycloak démarré et healthy
- [ ] Realm `gaveurs-production` créé
- [ ] 4 clients créés (euralis, gaveurs, sqal, backend)
- [ ] 5 rôles créés (admin, superviseur, gaveur, technicien_sqal, veterinaire)
- [ ] Utilisateur test créé avec rôle admin
- [ ] Backend `.env` configuré: `ENFORCE_AUTHENTICATION=true`
- [ ] Euralis: `KeycloakProvider` ajouté dans `layout.tsx`
- [ ] Euralis: `.env.local` corrigé avec `euralis-frontend`
- [ ] Gaveurs: `KeycloakProvider` utilisé au lieu de `AuthProvider`
- [ ] SQAL: realm changé `sqal_realm` → `gaveurs-production`
- [ ] SQAL: `onLoad` changé `check-sso` → `login-required`
- [ ] Test: Tous les frontends redirigent vers login Keycloak
