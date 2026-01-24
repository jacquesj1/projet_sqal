# Guide Test Authentification

## État actuel du système

### Configuration

- ✅ **Keycloak**: Démarré sur port 8080 (unhealthy mais fonctionnel)
- ✅ **Backend**: Configuré avec `DISABLE_AUTH=true` pour tests
- ⚠️ **Frontends**: Pas de pages login actuellement
- ⚠️ **Utilisateurs**: Aucun utilisateur créé dans Keycloak

## 🚀 Étapes pour tester l'authentification

### 1. Redémarrer les services avec la nouvelle configuration

```cmd
docker-compose down
docker-compose up -d
```

Cela appliquera:
- `KEYCLOAK_URL=http://keycloak:8080`
- `DISABLE_AUTH=true` (auth optionnelle pour tests)

### 2. Vérifier que Keycloak est accessible

**Depuis votre navigateur**:
```
http://localhost:8080
```

Vous devriez voir la page d'accueil Keycloak.

**Admin Console**:
```
http://localhost:8080/admin
```
- Username: `admin`
- Password: `admin` (voir docker-compose.yml)

### 3. Créer un utilisateur de test dans Keycloak

**Via l'admin console** (http://localhost:8080/admin):

1. Sélectionner le realm `gaveurs-production`
2. Aller dans "Users" → "Create new user"
3. Créer l'utilisateur:
   - Username: `jean.martin@gaveur.fr`
   - Email: `jean.martin@gaveur.fr`
   - First name: `Jean`
   - Last name: `Martin`
   - Email verified: `ON`
   - Enabled: `ON`

4. Aller dans l'onglet "Credentials"
5. Set password:
   - Password: `gaveur123`
   - Temporary: `OFF`
   - Save

6. Aller dans l'onglet "Role mapping"
7. Assign role: `gaveur`

### 4. Tester le login via l'API

```cmd
curl -X POST http://localhost:8000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"jean.martin@gaveur.fr\",\"password\":\"gaveur123\"}"
```

**Réponse attendue**:
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "token_type": "bearer",
  "user_info": {
    "sub": "...",
    "email": "jean.martin@gaveur.fr",
    "name": "Jean Martin"
  }
}
```

### 5. Créer les pages de login manquantes

#### Frontend Gaveurs

Créer `gaveurs-v3/gaveurs-ai-blockchain/frontend/app/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: email,
          password: password
        }),
      })

      if (!response.ok) {
        throw new Error('Identifiants invalides')
      }

      const data = await response.json()

      // Stocker le token
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user_info', JSON.stringify(data.user_info))

      // Rediriger vers le dashboard
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🦆 Gaveurs V3.0
          </h1>
          <p className="text-gray-600">Connectez-vous à votre compte</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="jean.martin@gaveur.fr"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Compte de test:</p>
          <p className="font-mono">jean.martin@gaveur.fr / gaveur123</p>
        </div>
      </div>
    </div>
  )
}
```

#### Frontend Euralis

Créer `euralis-frontend/app/login/page.tsx` avec le même contenu (adapter les styles si besoin).

### 6. Configurer la redirection vers login

#### Dans le frontend Gaveurs

Modifier `gaveurs-v3/gaveurs-ai-blockchain/frontend/app/page.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté
    const token = localStorage.getItem('access_token')

    if (!token) {
      // Rediriger vers login si pas de token
      router.push('/login')
    } else {
      // Rediriger vers dashboard si connecté
      router.push('/dashboard')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Chargement...</p>
      </div>
    </div>
  )
}
```

## 🔧 Mode sans authentification (DISABLE_AUTH=true)

Quand `DISABLE_AUTH=true` dans docker-compose.yml:
- ✅ Les endpoints API sont accessibles sans token
- ✅ Vous pouvez tester l'application sans login
- ✅ Pratique pour le développement
- ❌ À désactiver en production

**Tester un endpoint sans auth**:
```cmd
curl http://localhost:8000/api/canards/gaveur/1
```

Devrait retourner la liste des canards même sans token.

## 🔐 Mode avec authentification (DISABLE_AUTH=false)

Quand `DISABLE_AUTH=false`:
- ❌ Tous les endpoints nécessitent un token JWT valide
- ✅ Sécurisé pour la production
- ✅ Les rôles Keycloak sont vérifiés

**Tester avec un token**:
```cmd
# 1. Obtenir un token
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"jean.martin@gaveur.fr\",\"password\":\"gaveur123\"}" > token.json

# 2. Utiliser le token
curl http://localhost:8000/api/canards/gaveur/1 -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 📋 Checklist test authentification

- [ ] Keycloak accessible sur http://localhost:8080
- [ ] Realm `gaveurs-production` existe
- [ ] Utilisateur `jean.martin@gaveur.fr` créé
- [ ] Login API fonctionne: `POST /api/auth/login`
- [ ] Token JWT reçu
- [ ] Page login créée dans frontend Gaveurs
- [ ] Page login créée dans frontend Euralis
- [ ] Redirection automatique vers /login si pas connecté
- [ ] Dashboard accessible après login

## 🐛 Troubleshooting

### Erreur: "Can't connect to Keycloak"

```
HTTPConnectionPool(host='localhost', port=8080): Max retries exceeded
```

**Solution**: Le backend essaie de se connecter à `localhost` au lieu de `keycloak`.

1. Vérifier docker-compose.yml:
   ```yaml
   KEYCLOAK_URL: http://keycloak:8080  # Pas localhost!
   ```

2. Redémarrer:
   ```cmd
   docker-compose restart backend
   ```

3. Vérifier la variable:
   ```cmd
   docker-compose exec backend env | grep KEYCLOAK_URL
   ```

### Erreur: "Invalid credentials"

**Solutions**:
1. Vérifier que l'utilisateur existe dans Keycloak
2. Vérifier le mot de passe (case-sensitive)
3. Vérifier que le realm est correct (`gaveurs-production`)

### Erreur SQL dans le backend

Les erreurs SQL (comme "the server expects 1 argument") sont indépendantes de l'authentification. Elles seront corrigées séparément.

---

**Dernière mise à jour**: 2025-12-26
**Version**: 3.0.0
