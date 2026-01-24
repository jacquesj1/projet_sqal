# 🔧 Fix - Erreur 401 Login Euralis

**Date** : 28 décembre 2025
**Statut** : **RÉSOLU** ✅

---

## 🐛 Problème

**Symptôme** :
```
POST http://localhost:8000/api/auth/login 401 (Unauthorized)
Failed to load resource: the server responded with a status of 401
```

**Contexte** :
- Frontend Euralis affiche une page de login (`/login`)
- Tentative de connexion appelle `/api/auth/login`
- Cette route **n'existe pas** dans le backend
- L'authentification (Keycloak/JWT) n'est **pas encore implémentée**

---

## ✅ Solution Temporaire

### Bypass du login - Accès direct au dashboard

**Fichier créé** : `euralis-frontend/app/page.tsx` (28 lignes)

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirection immédiate vers le dashboard Euralis
    router.replace('/euralis/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-500 to-blue-600">
      <div className="text-center text-white">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent mx-auto"></div>
        <p className="mt-4 text-lg font-semibold">Chargement Euralis...</p>
      </div>
    </div>
  );
}
```

**Résultat** :
- ✅ Accès direct au dashboard sans authentification
- ✅ Pas d'erreur 401
- ✅ Workflow simplifié pour développement/test

---

## 🚀 Utilisation

### Accès direct
```
http://localhost:3000
→ Redirection automatique /euralis/dashboard
```

### Pages disponibles
- `/euralis/dashboard` - Vue d'ensemble multi-sites
- `/euralis/sites` - Liste des sites
- `/euralis/lots` - Tous les lots (vision globale)
- `/euralis/gaveurs` - Liste des gaveurs
- `/euralis/previsions` - Prédictions Prophet
- `/euralis/qualite` - Qualité globale
- `/euralis/abattages` - Optimisation abattages
- `/euralis/finance` - Vue financière

---

## 🔜 Implémentation Authentification (Future)

### Architecture prévue

**Backend** (`backend-api/app/routers/auth.py` - à créer) :
```python
from fastapi import APIRouter, HTTPException
from app.services.keycloak import KeycloakService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login")
async def login(credentials: LoginCredentials):
    """
    Authentification via Keycloak
    Retourne access_token + refresh_token
    """
    keycloak = KeycloakService()
    try:
        tokens = await keycloak.authenticate(
            username=credentials.username,
            password=credentials.password
        )
        return {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "user_info": tokens.user_info
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """Rafraîchir le token avec refresh_token"""
    ...

@router.post("/logout")
async def logout(token: str):
    """Déconnexion et invalidation du token"""
    ...
```

**Frontend** - Middleware Next.js :
```typescript
// euralis-frontend/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;

  // Routes publiques
  if (request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  // Protéger toutes les routes /euralis/*
  if (request.nextUrl.pathname.startsWith('/euralis')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}
```

### Configuration Keycloak

**Variables d'environnement** :
```env
# backend-api/.env
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=euralis
KEYCLOAK_CLIENT_ID=euralis-frontend
KEYCLOAK_CLIENT_SECRET=xxxxx

# euralis-frontend/.env.local
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM=euralis
```

**Realm Keycloak** :
- Realm : `euralis`
- Client : `euralis-frontend`
- Rôles : `superviseur`, `admin`, `viewer`
- Users :
  - `superviseur@euralis.fr` (role: superviseur)
  - `admin@euralis.fr` (role: admin)

---

## 📋 État actuel

### ✅ Fonctionne
- Accès dashboard Euralis sans login
- Routes backend `/api/euralis/*` actives
- Frontend responsive

### ⏳ À implémenter
- Route `/api/auth/login` (backend)
- Route `/api/auth/refresh` (backend)
- Route `/api/auth/logout` (backend)
- Service Keycloak (backend)
- Middleware authentification (frontend)
- Protection routes (frontend)
- Gestion tokens localStorage (frontend)

---

## 🔍 Vérification

### Backend Euralis routes
```bash
curl http://localhost:8000/api/euralis/stats/global
curl http://localhost:8000/api/euralis/sites
curl http://localhost:8000/api/euralis/lots
```

**Si routes retournent des données vides** :
- C'est normal, il faut d'abord générer des données de test
- Utiliser : `python scripts/generate_test_data.py --lots 20`

### Frontend
```
http://localhost:3000
→ Devrait rediriger vers /euralis/dashboard sans erreur
```

---

## ✅ Checklist

- ✅ Page racine créée avec redirection
- ✅ Accès dashboard sans login
- ✅ Pas d'erreur 401
- ✅ Routes backend Euralis actives
- ⏳ Authentification à implémenter (Phase 4)

---

**Le frontend Euralis est maintenant accessible directement !**

**Accès** : http://localhost:3000 → /euralis/dashboard

**Date de résolution** : 28 décembre 2025
