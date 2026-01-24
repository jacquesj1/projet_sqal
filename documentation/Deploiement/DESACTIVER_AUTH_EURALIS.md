# 🔓 Désactivation Authentification Frontends (Euralis + Gaveurs)

## ⚠️ Frontend Consolidation (28 décembre 2025)

**IMPORTANT** : Il existe maintenant **UN SEUL** frontend gaveur officiel : `gaveurs-frontend/`

- ✅ **UTILISER** : `gaveurs-frontend/` (production, 20 pages, Docker)
- ❌ **NE PAS UTILISER** : `gaveurs-v3/gaveurs-ai-blockchain/frontend/` (deprecated)

---

## Problème Rencontré

### Frontend Euralis
Lors de l'accès à `http://localhost:3000/euralis/dashboard`, redirection vers `/login` avec :

```
POST http://localhost:8000/api/auth/login 401 (Unauthorized)
```

**Cause** : Le middleware Next.js protège `/euralis/*` et nécessite un cookie `access_token`.

### Frontend Gaveurs
Même problème : toutes les routes (`/`, `/gavage`, `/canards`, etc.) sont protégées.

---

## ✅ Solution Appliquée

J'ai désactivé temporairement l'authentification dans **les 3 frontends** :

### 1. Frontend Euralis
[euralis-frontend/middleware.ts](euralis-frontend/middleware.ts:22) :

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // DÉMO MODE: Désactiver l'authentification pour la démonstration
  return NextResponse.next();

  /* AUTHENTIFICATION DÉSACTIVÉE POUR DÉMO
  ... code authentification commenté ...
  */
}
```

---

### 2. Frontend Gaveurs (PRODUCTION)
[gaveurs-frontend/middleware.ts](gaveurs-frontend/middleware.ts:23) :

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // DÉMO MODE: Désactiver l'authentification pour la démonstration
  return NextResponse.next();

  /* AUTHENTIFICATION DÉSACTIVÉE POUR DÉMO
  ... code authentification commenté ...
  */
}
```

---

### 3. Frontend Gaveurs v3 (DEPRECATED - Ne pas utiliser)
[gaveurs-v3/gaveurs-ai-blockchain/frontend/middleware.ts](gaveurs-v3/gaveurs-ai-blockchain/frontend/middleware.ts:28) :

⚠️ **Ce frontend est deprecated** - Voir `gaveurs-v3/gaveurs-ai-blockchain/frontend/DEPRECATED.md`

Utilisez `gaveurs-frontend/` à la place.

---

## 🚀 Action Requise

**Redémarrez les 2 frontends** pour appliquer le changement :

### Frontend Euralis
```bash
# Terminal Euralis (Ctrl+C pour arrêter, puis relancer)
cd euralis-frontend
npm run dev
```

**Résultat attendu** :
- ✅ Accès direct à `http://localhost:3000/euralis/dashboard`
- ✅ Pas de redirection vers `/login`
- ✅ Dashboard s'affiche immédiatement

### Frontend Gaveurs (PRODUCTION)
```bash
# Terminal Gaveurs (Ctrl+C pour arrêter, puis relancer)
cd gaveurs-frontend
npm run dev
```

**Résultat attendu** :
- ✅ Accès direct à `http://localhost:3000` (ou autre port si configuré)
- ✅ Pas de redirection vers `/login`
- ✅ Dashboard gaveur s'affiche immédiatement
- ✅ 20 pages disponibles (saisie-rapide, blockchain-explorer, ai-training, etc.)

---

## 🔄 Pour Réactiver l'Authentification (Après la Démo)

Éditez [euralis-frontend/middleware.ts](euralis-frontend/middleware.ts) :

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Commenter cette ligne :
  // return NextResponse.next();

  // Décommenter le code ci-dessous :
  const authToken = request.cookies.get('access_token')?.value;
  const isAuthenticated = !!authToken;

  // ... reste du code ...
}
```

**Puis démarrer Keycloak** :
```bash
docker-compose up -d keycloak
```

---

## 📝 Notes

- **Pour la démo** : L'authentification est désactivée sur les 2 frontends
- **En production** : L'authentification DOIT être réactivée avec Keycloak
- **Frontend SQAL** : N'a pas de middleware d'authentification, fonctionne directement

---

## ✅ Résumé Authentification par Frontend

| Frontend | Répertoire | Port | Authentification | Action |
|----------|-----------|------|------------------|--------|
| **SQAL** | `sqal/` | 5173 | ❌ Aucune | ✅ Fonctionne directement |
| **Euralis** | `euralis-frontend/` | 3000 (manuel) / 3001 (Docker) | ✅ Middleware désactivé | 🔄 Redémarrer |
| **Gaveurs** | `gaveurs-frontend/` | 3000 (Docker) / 3000 (manuel) | ✅ Middleware désactivé | 🔄 Redémarrer |
| ~~Gaveurs v3~~ | ~~`gaveurs-v3/.../frontend/`~~ | ~~3001~~ | ⚠️ **DEPRECATED** | ❌ Ne pas utiliser |

---

**Date de création** : 27 décembre 2025
**Dernière mise à jour** : 28 décembre 2025 (consolidation frontends)

**Fichiers modifiés** :
- `euralis-frontend/middleware.ts`
- `gaveurs-frontend/middleware.ts` ✅ **PRODUCTION**
- ~~`gaveurs-v3/gaveurs-ai-blockchain/frontend/middleware.ts`~~ ⚠️ **DEPRECATED**

**Type** : Configuration démo (temporaire)

---

## 📋 WebSocket Compatibility

Les deux frontends gaveurs utilisent la **même configuration WebSocket** :
- Endpoint : `ws://localhost:8000/ws/gaveur/${gaveurId}`
- Aucune migration nécessaire si vous changez de frontend

## 🔄 Migration vers gaveurs-frontend/

Si vous utilisiez encore `gaveurs-v3/.../frontend/`, migrez simplement vers :

```bash
cd gaveurs-frontend
npm install
npm run dev
```

Toutes les fonctionnalités sont présentes, et vous avez en plus :
- `/saisie-rapide` - Saisie rapide gavage
- `/blockchain-explorer` - Explorer blockchain
- `/ai-training` - Entraînement IA
- `/dashboard-analytics` - Analytics avancés
