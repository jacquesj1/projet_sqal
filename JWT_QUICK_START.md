# JWT Authentication - Guide de Démarrage Rapide

**Date**: 2026-01-14
**Pour**: Développeurs Euralis Gaveurs

---

## ⚡ Démarrage en 5 minutes

### 1. Migrer la base de données

```bash
cd backend-api
psql -U gaveurs_admin -d gaveurs_db -f scripts/migrations/add_password_hash.sql
```

**Résultat attendu**: Colonne `password_hash` ajoutée à la table `gaveurs`

### 2. Tester l'authentification

#### Test backend (API)

```bash
# Login superviseur
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superviseur@euralis.fr","password":"super123"}'
```

**Réponse attendue**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

#### Test frontend (navigateur)

1. Aller sur: http://localhost:3000/login
2. Login: `superviseur@euralis.fr` / `super123`
3. Vérifier redirection vers dashboard
4. Ouvrir console DevTools → Application → Local Storage
5. Vérifier présence de `access_token` et `refresh_token`

### 3. Vérifier l'auto-refresh

```javascript
// Dans la console du navigateur
console.log('Access token:', localStorage.getItem('access_token'));

// Attendre 1 minute, le token devrait se rafraîchir automatiquement
// (interval de 50 minutes en production, mais peut être testé manuellement)
```

---

## 🔐 Credentials de Test

### Superviseurs Euralis

| Email | Password | Rôle |
|-------|----------|------|
| superviseur@euralis.fr | super123 | superviseur |
| admin@euralis.fr | admin123 | admin |

### Gaveurs

**Important**: Les gaveurs doivent exister en base de données.

| Email | Password | Note |
|-------|----------|------|
| jean.martin@gaveur.fr | gaveur123 | Compte de test par défaut |

---

## 📝 Usage Backend

### Protéger une route

```python
from fastapi import APIRouter, Depends
from app.auth import get_current_supervisor, TokenData

router = APIRouter()

@router.get("/euralis/stats")
async def get_stats(
    supervisor: TokenData = Depends(get_current_supervisor)
):
    # supervisor.user_id
    # supervisor.email
    # supervisor.role
    # supervisor.user_type

    return {
        "message": f"Stats pour superviseur {supervisor.email}",
        "data": [...]
    }
```

### Dépendances disponibles

```python
from app.auth import (
    get_current_user,       # Tout utilisateur authentifié
    get_current_gaveur,     # Uniquement gaveurs
    get_current_supervisor, # Uniquement superviseurs
    get_current_admin,      # Uniquement admins
    get_optional_user,      # Auth optionnelle
)
```

### Créer un endpoint de login personnalisé

```python
from app.auth import create_token_pair, verify_password

@router.post("/custom/login")
async def custom_login(email: str, password: str, request: Request):
    pool = request.app.state.db_pool

    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT id, email, password_hash FROM users WHERE email = $1",
            email
        )

        if not user or not verify_password(password, user['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Créer les tokens
        token_pair = create_token_pair({
            "user_id": user['id'],
            "email": user['email'],
            "role": "user",
            "user_type": "custom",
        })

        return token_pair
```

---

## 🎨 Usage Frontend

### Appeler une API protégée

```typescript
import { http } from '@/lib/auth/httpClient';

// Le client HTTP ajoute automatiquement le token JWT
// et rafraîchit si expiré
const fetchDashboard = async () => {
  const response = await http.get('/api/euralis/dashboard');
  const data = await response.json();
  return data;
};
```

### Utiliser le contexte d'authentification

```typescript
'use client';

import { useAuth } from '@/components/auth/AuthProvider';

export default function MyComponent() {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Non connecté</div>;
  }

  return (
    <div>
      <p>Bonjour, {user?.prenom} {user?.nom}</p>
      <p>Email: {user?.email}</p>
      <p>Rôle: {user?.role}</p>
      <button onClick={logout}>Déconnexion</button>
    </div>
  );
}
```

### Protéger une page avec HOC

```typescript
import { withAuth } from '@/components/auth/AuthProvider';

function AdminPage() {
  return <div>Page admin</div>;
}

// Protège la page - redirige vers /login si non authentifié
export default withAuth(AdminPage, { requiredRole: 'admin' });
```

### Login programmatique

```typescript
import { login } from '@/lib/auth/httpClient';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();

  const handleLogin = async (email: string, password: string) => {
    try {
      const user = await login(email, password);
      console.log('Logged in:', user);
      router.push('/euralis/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      alert('Identifiants invalides');
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleLogin(email, password);
    }}>
      {/* Form fields */}
    </form>
  );
}
```

---

## 🧪 Tests

### Tests unitaires

```bash
cd backend-api
pytest tests/test_jwt_auth.py -v
```

**Tests disponibles**:
- Password hashing (bcrypt)
- Token generation (access + refresh)
- Token validation
- Expiration checks

### Tests avec serveur

```bash
# Lancer le backend
cd backend-api
uvicorn app.main:app --reload --port 8000

# Dans un autre terminal, lancer les tests
pytest tests/test_jwt_auth.py -v -k "not skip"
```

### Tests manuels avec curl

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superviseur@euralis.fr","password":"super123"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"

# 2. Appeler route protégée
curl http://localhost:8000/api/auth/protected/supervisor \
  -H "Authorization: Bearer $TOKEN"

# 3. Récupérer infos utilisateur
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🐛 Dépannage

### Erreur "Token invalide ou expiré"

**Cause**: Access token expiré (> 1 heure)

**Solution**: Le frontend auto-refresh normalement. Vérifier console:
```javascript
console.log('Access:', localStorage.getItem('access_token'));
console.log('Refresh:', localStorage.getItem('refresh_token'));
```

Si refresh token aussi expiré, se reconnecter.

### Erreur "Invalid signature"

**Cause**: SECRET_KEY différent entre génération et validation

**Solution**: Vérifier que `SECRET_KEY` est le même dans tous les modules

### Erreur 401 sur routes protégées

**Cause**: Token non envoyé ou invalide

**Solution**:
```javascript
// Vérifier que le token est bien envoyé
const token = localStorage.getItem('access_token');
console.log('Sending token:', token);

// Vérifier le header Authorization
console.log('Headers:', headers);
```

### Loop de redirection /login

**Cause**: Cookie `access_token` non défini

**Solution**: Vérifier que le cookie est bien défini après login:
```javascript
// Après login
document.cookie = `access_token=${accessToken}; path=/; max-age=3600`;
```

---

## 📚 Documentation Complète

Pour plus de détails, voir:
- [JWT_AUTHENTICATION.md](documentation/JWT_AUTHENTICATION.md) - Documentation complète (834 lignes)
- [JWT_IMPLEMENTATION_RECAP.md](JWT_IMPLEMENTATION_RECAP.md) - Récapitulatif implémentation

---

## ✅ Checklist de Mise en Production

Avant de déployer en production:

- [ ] Migrer la base de données (`add_password_hash.sql`)
- [ ] Configurer SECRET_KEY dans variables d'environnement
- [ ] Configurer REFRESH_SECRET_KEY dans variables d'environnement
- [ ] Activer HTTPS (obligatoire pour JWT)
- [ ] Configurer cookies `Secure` flag
- [ ] Implémenter rate limiting sur `/api/auth/login`
- [ ] Tester le flow complet login → refresh → logout
- [ ] Tester sur tous les navigateurs cibles
- [ ] Configurer monitoring (logs des tentatives de login)
- [ ] Documenter les credentials de production

---

**Bon développement! 🚀**
