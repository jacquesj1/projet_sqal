# 🔐 Authentification & Sécurité (Keycloak)

Documentation du système d'authentification Keycloak + sécurité.

---

## 📚 Documents disponibles

### [KEYCLOAK_INTEGRATION.md](../../KEYCLOAK_INTEGRATION.md)
**Guide complet d'intégration Keycloak**

- Configuration serveur Keycloak
- Création realm Euralis
- Clients OAuth2 (3 frontends)
- Rôles et permissions
- Intégration backend FastAPI
- Intégration frontends Next.js/React
- Flow authentification
- Gestion tokens JWT

**Pages**: 600+ (si document existe)
**Niveau**: Avancé

---

## 🎯 Statut Actuel

### ⚠️ Phase 4 - Non Implémentée

L'authentification Keycloak est planifiée pour la **Phase 4** du projet.

**Statut actuel**:
- ❌ Pas d'authentification
- ❌ CORS ouvert (`allow_origins=["*"]`)
- ❌ Routes API publiques
- ⚠️ **Ne PAS utiliser en production**

---

## 📋 Planification Phase 4

### Objectifs

1. **Serveur Keycloak**
   - Déploiement Docker
   - Configuration realm `euralis`
   - Base de données PostgreSQL dédiée

2. **3 Clients OAuth2**
   - `euralis-frontend` (supervisor)
   - `gaveurs-frontend` (gaveurs)
   - `sqal-frontend` (qualité)

3. **Rôles & Permissions**
   - `admin_euralis` - Accès complet supervision
   - `gaveur` - Saisie gavages uniquement
   - `sqal_operator` - Contrôle qualité
   - `viewer` - Lecture seule

4. **Backend FastAPI**
   - Middleware JWT validation
   - Dépendances `get_current_user`
   - Protection routes sensibles
   - RBAC (Role-Based Access Control)

5. **Frontends**
   - Login/logout flows
   - Token storage (localStorage/cookies)
   - Auto-refresh tokens
   - Protected routes

---

## 🏗️ Architecture Prévue

### Flux d'Authentification

```
┌─────────────┐
│   FRONTEND  │
│ (Next.js)   │
└──────┬──────┘
       │ 1. Login
       ↓
┌─────────────────┐
│   KEYCLOAK      │
│  (Auth Server)  │
│  Port 8080      │
└──────┬──────────┘
       │ 2. JWT Token
       ↓
┌─────────────┐
│  FRONTEND   │
│ (Store JWT) │
└──────┬──────┘
       │ 3. API Request + Bearer Token
       ↓
┌─────────────────┐
│   BACKEND       │
│  (FastAPI)      │
│  Validate JWT   │
└──────┬──────────┘
       │ 4. Response
       ↓
┌─────────────┐
│  FRONTEND   │
└─────────────┘
```

---

## 🔧 Configuration Prévue

### Docker Compose (à ajouter)

```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin_password_secure
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://keycloak-db:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: keycloak_password
    ports:
      - "8080:8080"
    command: start-dev
    depends_on:
      - keycloak-db

  keycloak-db:
    image: postgres:15
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: keycloak_password
    volumes:
      - keycloak_db_data:/var/lib/postgresql/data

volumes:
  keycloak_db_data:
```

---

## 👥 Rôles et Permissions

### Matrice d'Accès Prévue

| Route API | admin_euralis | gaveur | sqal_operator | viewer |
|-----------|---------------|--------|---------------|--------|
| `GET /api/euralis/*` | ✅ | ❌ | ❌ | ✅ |
| `POST /api/gavage` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/gavage/my` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/sqal/samples` | ✅ | ❌ | ✅ | ❌ |
| `GET /api/sqal/*` | ✅ | ❌ | ✅ | ✅ |
| `POST /api/consumer/feedback` | ✅ (public) | ✅ (public) | ✅ (public) | ✅ (public) |

---

## 💻 Exemples de Code (Prévus)

### Backend - Protection Route

```python
from fastapi import Depends, HTTPException
from app.auth.keycloak import verify_token, get_current_user

@router.get("/api/euralis/stats/global")
async def get_global_stats(
    current_user: dict = Depends(get_current_user)
):
    # Vérifier rôle
    if "admin_euralis" not in current_user["roles"] and \
       "viewer" not in current_user["roles"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Logique métier
    stats = await euralis_service.get_global_stats()
    return stats
```

### Frontend - Login Flow

```typescript
// lib/auth.ts
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL,
  realm: 'euralis',
  clientId: 'euralis-frontend',
});

export async function login() {
  await keycloak.init({ onLoad: 'login-required' });
  return keycloak.token;
}

export async function logout() {
  await keycloak.logout();
}

export function getToken() {
  return keycloak.token;
}
```

### Frontend - Protected API Call

```typescript
// lib/api.ts
async function apiCall(endpoint: string, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token expiré, refresh
    await keycloak.updateToken(30);
    return apiCall(endpoint, options); // Retry
  }

  return response.json();
}
```

---

## 🧪 Tests Prévus

### Test Authentification

```bash
# 1. Démarrer Keycloak
docker-compose up keycloak

# 2. Accéder console admin
# http://localhost:8080/admin
# admin / admin_password_secure

# 3. Créer realm "euralis"
# 4. Créer client "euralis-frontend"
# 5. Créer utilisateurs test:
#    - admin@euralis.com (role: admin_euralis)
#    - gaveur1@euralis.com (role: gaveur)
#    - sqal_op1@euralis.com (role: sqal_operator)

# 6. Tester login frontend
npm run dev

# 7. Tester protection routes
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/euralis/stats/global
```

---

## 📈 Timeline Phase 4

| Tâche | Durée | Statut |
|-------|-------|--------|
| Setup Keycloak Docker | 1 jour | ⏳ À faire |
| Configuration realm/clients | 1 jour | ⏳ À faire |
| Backend JWT validation | 2 jours | ⏳ À faire |
| Frontend login flows (3) | 3 jours | ⏳ À faire |
| Tests d'intégration | 2 jours | ⏳ À faire |
| **Total** | **~2 semaines** | ⏳ Planifié |

---

## 🔗 Ressources

### Documentation Keycloak
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [Keycloak Docker Images](https://www.keycloak.org/server/containers)
- [FastAPI + Keycloak](https://github.com/mrtj/fastapi-keycloak)

### Librairies
- **Backend**: `python-keycloak`, `python-jose[cryptography]`
- **Frontend Next.js**: `@react-keycloak/nextjs`
- **Frontend React**: `@react-keycloak/web`

---

## ⚠️ Avertissement Sécurité

**État actuel du système** (Phase 1-3):

```python
# backend-api/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ DANGEREUX EN PRODUCTION
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Tous les endpoints sont publics** :
- ❌ Pas d'authentification
- ❌ Pas de validation tokens
- ❌ N'importe qui peut accéder/modifier

**Actions avant production** :
1. Implémenter Keycloak (Phase 4)
2. Restreindre CORS aux domaines autorisés
3. Activer HTTPS/TLS
4. Configurer rate limiting
5. Audit sécurité complet

---

## 🔗 Liens Documentation

- [Architecture](../02-ARCHITECTURE/README.md)
- [Fonctionnalités](../03-FONCTIONNALITES/README.md)
- [Guide démarrage](../01-GUIDES_DEMARRAGE/README.md)
- [NEXT_STEPS.md](../../NEXT_STEPS.md) - Phase 4 détaillée

---

**Retour**: [Index principal](../README.md)
