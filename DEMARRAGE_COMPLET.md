# Démarrage Complet - Projet Euralis Gaveurs

**Date**: 2026-01-14
**Version**: 3.0 (avec JWT + Tests E2E)

---

## ⚡ Démarrage Rapide (5 minutes)

### 1. Installation

```bash
# Backend
cd backend-api
pip install -r requirements.txt

# Frontend Euralis
cd euralis-frontend
npm install

# Playwright (pour tests E2E)
npx playwright install
```

### 2. Migration Base de Données (JWT)

```bash
cd backend-api
psql -U gaveurs_admin -d gaveurs_db -f scripts/migrations/add_password_hash.sql
```

### 3. Lancer l'Application

```bash
# Terminal 1 - Backend
cd backend-api
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend Euralis
cd euralis-frontend
npm run dev  # Port 3000
```

### 4. Accéder à l'Application

- **Frontend Euralis**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 5. Login

**Credentials**:
- Email: `superviseur@euralis.fr`
- Password: `super123`

---

## 🧪 Lancer les Tests

### Tests E2E Playwright

```bash
cd euralis-frontend

# Mode UI (recommandé)
npm run test:e2e:ui

# Headless (CI)
npm run test:e2e

# Voir le rapport
npm run test:e2e:report
```

**Résultat attendu**: 48 tests passent ✅

---

## 📋 Checklist de Vérification

### Backend ✅

```bash
# Vérifier santé
curl http://localhost:8000/health

# Tester login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superviseur@euralis.fr","password":"super123"}'

# Devrait retourner: access_token + refresh_token
```

### Frontend ✅

```bash
# Vérifier que le dev server tourne
curl http://localhost:3000

# Login via navigateur
# 1. Aller sur http://localhost:3000/login
# 2. Email: superviseur@euralis.fr
# 3. Password: super123
# 4. Vérifier redirection dashboard
```

### Base de Données ✅

```bash
# Vérifier connexion
psql -U gaveurs_admin -d gaveurs_db -c "SELECT 1"

# Vérifier colonne password_hash
psql -U gaveurs_admin -d gaveurs_db -c "SELECT column_name FROM information_schema.columns WHERE table_name='gaveurs' AND column_name='password_hash'"
```

### Tests E2E ✅

```bash
cd euralis-frontend

# Lancer tests
npm run test:e2e:chromium

# Vérifier que 48 tests passent
```

---

## 🔐 Variables d'Environnement

### Backend

Créer `backend-api/.env`:

```bash
# Database
DATABASE_URL=postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db

# JWT (IMPORTANT: Changer en production!)
SECRET_KEY=euralis-gaveurs-super-secret-key-change-in-production-2024
REFRESH_SECRET_KEY=euralis-gaveurs-refresh-secret-key-change-in-production-2024
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### Frontend

Créer `euralis-frontend/.env.local`:

```bash
# API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## 📊 Nouvelles Fonctionnalités Disponibles

### 1. Authentification JWT ✅

**Endpoints**:
- `POST /api/auth/login` - Login superviseur
- `POST /api/auth/gaveur/login` - Login gaveur
- `POST /api/auth/refresh` - Rafraîchir token
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/me` - Infos utilisateur

**Features**:
- Access tokens (1h)
- Refresh tokens (7 jours)
- Auto-refresh transparent (50 min)
- Protection des routes
- Role-based access

**Test**:
```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superviseur@euralis.fr","password":"super123"}'

# Copier le access_token

# Route protégée
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### 2. Filtres Avancés Lots ✅

**Page**: `/euralis/sites/{code}/lots`

**Features**:
- Recherche textuelle (code lot, gaveur, race, souche)
- Filtres de base (statut, site)
- Filtres avancés (dates, ITM min/max)
- Tri multi-colonnes (clic sur en-têtes)
- Persistance localStorage
- Stats recalculées sur lots filtrés
- Export Excel des lots filtrés

**Test**:
1. Aller sur http://localhost:3000/euralis/sites/LL/lots
2. Entrer "LL" dans la recherche
3. Cliquer sur "Afficher filtres avancés"
4. Tester les filtres date et ITM
5. Cliquer sur en-têtes de colonnes pour trier

### 3. Export Excel ✅

**Disponible sur**: Pages avec tableaux de lots

**Features**:
- Export dynamique des données filtrées
- Formatage automatique
- Nom de fichier avec timestamp

**Test**:
1. Aller sur une page de lots
2. Appliquer des filtres
3. Cliquer "Export Excel"
4. Vérifier téléchargement fichier .xlsx

### 4. Notifications Temps Réel ✅

**Composant**: Cloche dans le header

**Features**:
- Connexion WebSocket automatique
- Reconnexion auto avec backoff exponentiel
- Badge compteur de non-lues
- Panel déroulant avec historique
- Persistance localStorage (50 max)
- Timestamp relatif ("Il y a 5 min")

**Note**: Backend WebSocket endpoint `/ws/notifications/` à implémenter

**Test visuel**:
1. Voir la cloche dans le header
2. Cliquer pour ouvrir le panel
3. Vérifier "Aucune notification" si backend pas connecté

### 5. Page Alertes ✅

**URL**: http://localhost:3000/euralis/alertes

**Features**:
- Liste complète des alertes
- Tri par criticité, type, date
- Filtrage
- Stats par criticité
- Icônes par type d'alerte

**Test**:
1. Aller sur http://localhost:3000/euralis/alertes
2. Voir le tableau des alertes
3. Tester tri en cliquant sur en-têtes

### 6. Graphiques Détails Site ✅

**Page**: `/euralis/sites/{code}`

**Graphiques ajoutés**:
- Évolution ITM moyen (LineChart)
- Activité mensuelle (BarChart)
- Répartition par statut (PieChart)

**Test**:
1. Aller sur http://localhost:3000/euralis/sites/LL
2. Scroller pour voir les 3 graphiques
3. Survoler pour voir les tooltips

---

## 🧪 Tests E2E - Détails

### 48 Tests Disponibles

#### Authentification (13 tests)
```bash
npx playwright test 01-auth.spec.ts
```
- Login/Logout
- Protection des routes
- Tokens JWT
- Redirection

#### Navigation (14 tests)
```bash
npx playwright test 02-navigation.spec.ts
```
- Menu principal
- Pages: Dashboard, Sites, Gaveurs, Analytics, Alertes
- Navigation browser (back/forward)
- Breadcrumbs

#### Fonctionnalités (21 tests)
```bash
npx playwright test 03-features.spec.ts
```
- Filtres avancés (4 tests)
- Tri colonnes (2 tests)
- Export Excel (2 tests)
- Notifications (3 tests)
- Charts dashboard (3 tests)
- Analytics (3 tests)

### Modes d'Exécution

```bash
# Tous les tests - Headless
npm run test:e2e

# Interface Playwright (recommandé)
npm run test:e2e:ui

# Avec navigateurs visibles
npm run test:e2e:headed

# Mode debug
npm run test:e2e:debug

# Un seul navigateur
npm run test:e2e:chromium

# Rapport HTML
npm run test:e2e:report
```

---

## 🚨 Dépannage

### Backend ne démarre pas

```bash
# Vérifier DATABASE_URL
echo $DATABASE_URL

# Vérifier TimescaleDB
docker ps | grep timescaledb

# Vérifier dépendances
pip list | grep fastapi
```

### Frontend - Erreur CORS

```bash
# Vérifier backend tourne
curl http://localhost:8000/health

# Vérifier NEXT_PUBLIC_API_URL
cat euralis-frontend/.env.local
```

### Tests échouent

```bash
# Vérifier backend tourne
curl http://localhost:8000/health

# Vérifier frontend tourne
curl http://localhost:3000

# Réinstaller navigateurs Playwright
npx playwright install --with-deps
```

### Login échoue

```bash
# Vérifier migration password_hash
psql -U gaveurs_admin -d gaveurs_db -c "SELECT column_name FROM information_schema.columns WHERE table_name='gaveurs' AND column_name='password_hash'"

# Tester endpoint login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superviseur@euralis.fr","password":"super123"}'
```

---

## 📚 Documentation Disponible

### Guides de Démarrage Rapide
- `DEMARRAGE_COMPLET.md` - Ce fichier
- `JWT_QUICK_START.md` - Authentification JWT en 5 minutes
- `PLAYWRIGHT_QUICK_START.md` - Tests E2E en 3 minutes

### Documentation Technique Complète
- `JWT_AUTHENTICATION.md` - 834 lignes sur JWT
- `tests/e2e/README.md` - 528 lignes sur Playwright
- `NOUVELLES_FONCTIONNALITES.md` - Filtres + Notifications

### Récapitulatifs
- `SESSION_COMPLETE_FINAL.md` - Vue d'ensemble finale
- `SESSION_RECAP.md` - Récapitulatif session
- `JWT_IMPLEMENTATION_RECAP.md` - Récap JWT
- `PLAYWRIGHT_IMPLEMENTATION_RECAP.md` - Récap tests

---

## 🎯 Commandes Essentielles

### Développement

```bash
# Backend
cd backend-api
uvicorn app.main:app --reload --port 8000

# Frontend
cd euralis-frontend
npm run dev

# Tests E2E
npm run test:e2e:ui
```

### Migration DB

```bash
cd backend-api
psql -U gaveurs_admin -d gaveurs_db -f scripts/migrations/add_password_hash.sql
```

### Tests

```bash
# Tous les tests E2E
npm run test:e2e

# Un fichier
npx playwright test 01-auth.spec.ts

# Un test
npx playwright test -g "should login successfully"
```

### Vérifications

```bash
# Backend santé
curl http://localhost:8000/health

# Login test
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superviseur@euralis.fr","password":"super123"}'

# Frontend
curl http://localhost:3000
```

---

## ✅ Checklist Avant Production

- [ ] Migration DB password_hash appliquée
- [ ] SECRET_KEY configuré en variable d'environnement
- [ ] REFRESH_SECRET_KEY configuré
- [ ] HTTPS activé
- [ ] Rate limiting sur `/api/auth/login`
- [ ] Tests E2E passent (48/48)
- [ ] Backend endpoint WebSocket `/ws/notifications/` implémenté
- [ ] Monitoring configuré
- [ ] Logs configurés
- [ ] Backup DB configuré

---

## 🎉 Résultat

Après ces étapes, vous avez:

✅ Backend API fonctionnel (port 8000)
✅ Frontend Euralis fonctionnel (port 3000)
✅ Authentification JWT sécurisée
✅ 48 tests E2E qui passent
✅ Toutes les nouvelles fonctionnalités actives:
   - Filtres avancés lots
   - Export Excel
   - Notifications temps réel (UI ready)
   - Page alertes
   - Graphiques détails site

**Bon développement! 🚀**
