# Tests E2E Playwright - Euralis Frontend

**Framework**: Playwright
**Navigateurs**: Chromium, Firefox, WebKit
**Langage**: TypeScript

---

## 📦 Installation

### 1. Installer les dépendances

```bash
cd euralis-frontend
npm install
```

### 2. Installer les navigateurs Playwright

```bash
npx playwright install
```

Cette commande télécharge Chromium, Firefox et WebKit.

---

## 🚀 Exécution des Tests

### Tests en mode headless (CI/CD)

```bash
npm run test:e2e
```

### Tests avec interface visible (headed)

```bash
npm run test:e2e:headed
```

### Tests avec UI Playwright (recommandé pour développement)

```bash
npm run test:e2e:ui
```

L'interface Playwright permet de:
- Voir les tests s'exécuter en temps réel
- Mettre en pause et inspecter
- Voir les traces et screenshots
- Rejouer les tests

### Tests en mode debug

```bash
npm run test:e2e:debug
```

Ouvre le Playwright Inspector pour debugger pas à pas.

### Tests sur un seul navigateur

```bash
# Chromium seulement
npm run test:e2e:chromium

# Firefox seulement
npx playwright test --project=firefox

# WebKit seulement
npx playwright test --project=webkit
```

### Tests spécifiques

```bash
# Un fichier de test
npx playwright test 01-auth.spec.ts

# Un test spécifique
npx playwright test -g "should login successfully"

# Tests par tag
npx playwright test --grep @smoke
```

---

## 📊 Rapports

### Voir le rapport HTML

```bash
npm run test:e2e:report
```

Ouvre un rapport interactif avec:
- Résultats de tous les tests
- Screenshots des échecs
- Traces d'exécution
- Vidéos (si activées)

### Rapport JSON

Le rapport JSON est automatiquement généré dans `test-results/results.json`.

---

## 📁 Structure des Tests

```
tests/e2e/
├── README.md                    # Ce fichier
├── helpers/
│   └── auth.ts                  # Helpers d'authentification
├── 01-auth.spec.ts              # Tests authentification (login, logout)
├── 02-navigation.spec.ts        # Tests navigation (menu, pages)
└── 03-features.spec.ts          # Tests fonctionnalités (filtres, export)
```

### Helpers

**`helpers/auth.ts`**:
- `login(page, credentials)` - Login via UI
- `loginProgrammatically(page, credentials)` - Login via API (plus rapide)
- `logout(page)` - Logout
- `isAuthenticated(page)` - Vérifier authentification
- `TEST_CREDENTIALS` - Credentials de test

---

## 📝 Tests Disponibles

### 01-auth.spec.ts (13 tests)

**Authentication Flow**:
- ✅ Display login page
- ✅ Login successfully with valid credentials
- ✅ Show error with invalid credentials
- ✅ Logout successfully
- ✅ Redirect to login when accessing protected route
- ✅ Redirect back after login with redirect param
- ✅ Persist authentication across page reloads
- ✅ Display user info in header

**Token Management**:
- ✅ Have valid JWT tokens after login
- ✅ Store user info in localStorage

### 02-navigation.spec.ts (14 tests)

**Navigation**:
- ✅ Display main navigation menu
- ✅ Navigate to Dashboard
- ✅ Navigate to Sites
- ✅ Navigate to Gaveurs
- ✅ Navigate to Analytics
- ✅ Navigate to Alertes
- ✅ Navigate to Qualité
- ✅ Display breadcrumbs on detail pages
- ✅ Maintain header/footer across navigation
- ✅ Browser back/forward navigation

**Site Navigation**:
- ✅ Navigate to site detail page
- ✅ Navigate to site lots page
- ✅ Display site stats and charts

### 03-features.spec.ts (21 tests)

**Advanced Lot Filters**:
- ✅ Display filter controls
- ✅ Filter lots by text search
- ✅ Show/hide advanced filters
- ✅ Reset filters

**Column Sorting**:
- ✅ Sort columns when clicking headers
- ✅ Toggle sort direction

**Excel Export**:
- ✅ Have export button
- ✅ Download Excel file on export

**Real-time Notifications**:
- ✅ Display notification bell icon
- ✅ Open notification panel on click
- ✅ Display notification count badge

**Dashboard Charts**:
- ✅ Display dashboard cards
- ✅ Display charts
- ✅ Display KPIs

**Analytics Page**:
- ✅ Display tab navigation
- ✅ Switch between tabs
- ✅ Display visualizations

**Total**: **48 tests** couvrant les flux critiques

---

## ⚙️ Configuration

### Variables d'Environnement

Créer un fichier `.env.test` à la racine du projet:

```bash
# Base URL de l'application
BASE_URL=http://localhost:3000

# API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Configuration Playwright

Modifier `playwright.config.ts` pour:
- Changer le timeout
- Ajouter/retirer des navigateurs
- Configurer les reporters
- Définir les options de capture (screenshots, vidéos)

---

## 🔧 Prérequis pour les Tests

### Backend

Le backend doit être lancé sur `http://localhost:8000`:

```bash
cd backend-api
uvicorn app.main:app --reload --port 8000
```

### Frontend

Le frontend doit être lancé sur `http://localhost:3000`:

```bash
cd euralis-frontend
npm run dev
```

**Note**: Si `webServer` est configuré dans `playwright.config.ts`, Playwright lancera automatiquement le serveur de dev.

### Base de Données

La base de données doit contenir:
- Des sites (LL, LS, MT)
- Des lots de test
- Des utilisateurs superviseurs (credentials dans `helpers/auth.ts`)

---

## 🐛 Dépannage

### "Target page, context or browser has been closed"

**Cause**: Timeout trop court ou page qui se charge lentement

**Solution**:
```typescript
// Augmenter le timeout
await page.waitForURL('**/dashboard', { timeout: 15000 });

// Ou attendre le chargement réseau
await page.waitForLoadState('networkidle');
```

### "Strict mode violation"

**Cause**: Plusieurs éléments correspondent au sélecteur

**Solution**:
```typescript
// Utiliser .first() ou .nth(0)
await page.locator('button').first().click();

// Ou rendre le sélecteur plus spécifique
await page.locator('button:has-text("Login")').click();
```

### Tests qui échouent de manière intermittente

**Cause**: Race conditions, timing

**Solution**:
```typescript
// Attendre un élément spécifique
await page.waitForSelector('.data-loaded');

// Attendre une condition
await page.waitForFunction(() => document.querySelectorAll('.item').length > 0);

// Ajouter des assertions auto-wait
await expect(page.locator('.item')).toBeVisible();
```

### Backend non accessible

**Cause**: Backend pas lancé ou mauvaise URL

**Solution**:
1. Vérifier que le backend tourne: `curl http://localhost:8000/health`
2. Vérifier `NEXT_PUBLIC_API_URL` dans `.env.local`
3. Vérifier la configuration dans `playwright.config.ts`

---

## 📈 Best Practices

### 1. Utiliser les helpers d'authentification

```typescript
// ❌ Pas bien
await page.goto('/login');
await page.fill('input[type="email"]', 'test@example.com');
await page.fill('input[type="password"]', 'password');
await page.click('button[type="submit"]');

// ✅ Bien
import { loginProgrammatically } from './helpers/auth';
await loginProgrammatically(page);
```

### 2. Utiliser des sélecteurs robustes

```typescript
// ❌ Fragile (dépend du CSS)
await page.click('.btn-primary');

// ✅ Robuste (sémantique)
await page.click('button:has-text("Login")');
await page.click('[data-testid="login-button"]');
```

### 3. Attendre les éléments

```typescript
// ❌ Pas bien (race condition)
await page.click('button');
expect(page.locator('.result')).toBeVisible();

// ✅ Bien (auto-wait)
await page.click('button');
await expect(page.locator('.result')).toBeVisible();
```

### 4. Nettoyer l'état entre tests

```typescript
test.beforeEach(async ({ page }) => {
  // Nettoyer localStorage
  await page.evaluate(() => localStorage.clear());

  // Réinitialiser les cookies
  await page.context().clearCookies();
});
```

### 5. Utiliser des fixtures pour les données de test

```typescript
const TEST_DATA = {
  supervisor: { email: 'superviseur@euralis.fr', password: 'super123' },
  site: { code: 'LL', name: 'Landes' },
};
```

---

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### GitLab CI

```yaml
e2e-tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.1-focal
  script:
    - npm ci
    - npx playwright install
    - npm run test:e2e
  artifacts:
    when: always
    paths:
      - playwright-report/
    expire_in: 1 week
```

---

## 📚 Ressources

- [Documentation Playwright](https://playwright.dev/)
- [Best Practices Playwright](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Test Generator](https://playwright.dev/docs/codegen)

---

**Bon testing! 🎭**
