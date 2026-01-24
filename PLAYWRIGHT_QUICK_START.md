# Playwright E2E Tests - Guide de Démarrage Rapide

**Date**: 2026-01-14
**Framework**: Playwright 1.40+

---

## ⚡ Installation en 3 minutes

### 1. Installer Playwright

```bash
cd euralis-frontend
npm install --save-dev @playwright/test
npx playwright install
```

**Résultat**: Playwright + navigateurs Chromium, Firefox, WebKit installés

### 2. Lancer les tests

```bash
# Tests headless (CI)
npm run test:e2e

# Tests avec UI (développement)
npm run test:e2e:ui

# Tests headed (voir les navigateurs)
npm run test:e2e:headed
```

### 3. Voir les résultats

```bash
npm run test:e2e:report
```

Ouvre un rapport HTML interactif avec screenshots et traces.

---

## 🎯 Tests Disponibles

### 48 tests E2E répartis en 3 fichiers

| Fichier | Tests | Description |
|---------|-------|-------------|
| `01-auth.spec.ts` | 13 | Authentification (login, logout, JWT) |
| `02-navigation.spec.ts` | 14 | Navigation (menu, pages, breadcrumbs) |
| `03-features.spec.ts` | 21 | Fonctionnalités (filtres, export, charts) |

**Couverture totale**: 48 scénarios de test

---

## 🔑 Credentials de Test

Les tests utilisent les credentials suivants (configurés dans `helpers/auth.ts`):

```typescript
const TEST_CREDENTIALS = {
  supervisor: {
    email: 'superviseur@euralis.fr',
    password: 'super123',
  },
  admin: {
    email: 'admin@euralis.fr',
    password: 'admin123',
  },
};
```

---

## 📝 Commandes Essentielles

### Lancer tous les tests

```bash
npm run test:e2e
```

### Lancer un fichier spécifique

```bash
npx playwright test 01-auth.spec.ts
```

### Lancer un test spécifique

```bash
npx playwright test -g "should login successfully"
```

### Lancer sur un seul navigateur

```bash
# Chromium seulement
npm run test:e2e:chromium

# Firefox seulement
npx playwright test --project=firefox

# WebKit seulement
npx playwright test --project=webkit
```

### Mode debug

```bash
npm run test:e2e:debug
```

Ouvre Playwright Inspector pour debugger pas à pas.

### UI Mode (recommandé)

```bash
npm run test:e2e:ui
```

Interface graphique interactive pour:
- Voir les tests s'exécuter
- Inspecter les éléments
- Voir les traces
- Rejouer les tests

---

## 🛠️ Prérequis

### Backend

Le backend doit tourner sur `http://localhost:8000`:

```bash
cd backend-api
uvicorn app.main:app --reload --port 8000
```

### Frontend

Le frontend doit tourner sur `http://localhost:3000`:

```bash
cd euralis-frontend
npm run dev
```

**Note**: Si configuré dans `playwright.config.ts`, Playwright peut lancer le serveur automatiquement.

### Base de Données

Vérifier que la DB contient:
- ✅ Sites: LL, LS, MT
- ✅ Lots de test
- ✅ Utilisateurs superviseurs

---

## 📊 Scénarios de Test Principaux

### 1. Authentification (01-auth.spec.ts)

✅ **Login superviseur avec credentials valides**
- Remplir formulaire
- Vérifier redirection dashboard
- Vérifier tokens JWT en localStorage

✅ **Erreur avec credentials invalides**
- Tenter login avec mauvais credentials
- Vérifier message d'erreur
- Vérifier qu'on reste sur /login

✅ **Logout**
- Cliquer bouton déconnexion
- Vérifier redirection /login
- Vérifier suppression tokens

✅ **Protection des routes**
- Accéder route protégée sans auth
- Vérifier redirection /login avec redirect param

### 2. Navigation (02-navigation.spec.ts)

✅ **Menu de navigation**
- Vérifier présence de tous les liens
- Cliquer sur Dashboard, Sites, Gaveurs, Analytics
- Vérifier URLs et contenu des pages

✅ **Navigation site**
- Aller sur /euralis/sites
- Cliquer sur un site (LL, LS, MT)
- Vérifier page détail site
- Naviguer vers page lots du site

✅ **Navigation browser**
- Naviguer Dashboard → Sites → Gaveurs
- Tester boutons back/forward
- Vérifier URLs correctes

### 3. Fonctionnalités (03-features.spec.ts)

✅ **Filtres avancés lots**
- Vérifier présence contrôles filtrage
- Filtrer par texte de recherche
- Afficher/masquer filtres avancés
- Réinitialiser filtres

✅ **Tri colonnes**
- Cliquer en-têtes de colonnes
- Vérifier indicateurs de tri (flèches)
- Toggle ASC/DESC

✅ **Export Excel**
- Vérifier bouton export
- Cliquer export
- Vérifier téléchargement fichier .xlsx

✅ **Notifications temps réel**
- Vérifier icône cloche
- Cliquer pour ouvrir panel
- Vérifier badge de compteur

✅ **Graphiques dashboard**
- Vérifier présence cartes stats
- Vérifier graphiques Recharts (SVG)
- Vérifier KPIs

---

## 🎨 Structure des Tests

```typescript
// helpers/auth.ts
export async function login(page: Page, credentials) {
  await page.goto('/login');
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/euralis/dashboard');
}

// 01-auth.spec.ts
test('should login successfully', async ({ page }) => {
  await login(page, TEST_CREDENTIALS.supervisor);
  await expect(page).toHaveURL(/\/euralis\/dashboard/);

  const accessToken = await page.evaluate(() =>
    localStorage.getItem('access_token')
  );
  expect(accessToken).toBeTruthy();
});
```

---

## 🐛 Dépannage Rapide

### Tests échouent avec "Timeout"

```typescript
// Augmenter timeout
await page.waitForURL('**/dashboard', { timeout: 15000 });
```

### "Element not found"

```typescript
// Attendre l'élément
await expect(page.locator('.element')).toBeVisible();

// Ou attendre chargement réseau
await page.waitForLoadState('networkidle');
```

### Backend non accessible

```bash
# Vérifier que le backend tourne
curl http://localhost:8000/health

# Vérifier les variables d'env
cat .env.local
```

### Tests passent localement mais échouent en CI

```yaml
# Vérifier que les navigateurs sont installés
- run: npx playwright install --with-deps

# Vérifier que le serveur démarre
- run: npm run dev &
- run: sleep 10  # Attendre que le serveur démarre
- run: npm run test:e2e
```

---

## 📈 Métriques de Couverture

### Flux couverts

- ✅ **Authentification**: Login, logout, protection routes
- ✅ **Navigation**: Menu, pages, breadcrumbs, back/forward
- ✅ **Fonctionnalités**: Filtres, tri, export, notifications
- ✅ **Visualisations**: Charts, KPIs, dashboards

### Pages testées

- `/login` - Page de connexion
- `/euralis/dashboard` - Dashboard principal
- `/euralis/sites` - Liste des sites
- `/euralis/sites/{code}` - Détail d'un site
- `/euralis/sites/{code}/lots` - Lots d'un site
- `/euralis/gaveurs` - Liste des gaveurs
- `/euralis/analytics` - Page analytics
- `/euralis/alertes` - Gestion des alertes
- `/euralis/qualite` - Contrôle qualité

**Total**: 9+ pages testées

---

## 🚀 Prochaines Étapes

### Ajouter plus de tests

1. **Tests de régression**
   - Screenshots de référence
   - Visual regression testing

2. **Tests de performance**
   - Lighthouse integration
   - Temps de chargement

3. **Tests d'accessibilité**
   - axe-core integration
   - Keyboard navigation

4. **Tests de compatibilité mobile**
   - Tests sur Mobile Chrome
   - Tests sur Mobile Safari

### CI/CD Integration

Ajouter dans `.github/workflows/e2e.yml`:

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

      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 📚 Ressources

- [Documentation Playwright](https://playwright.dev/)
- [Tests E2E README](euralis-frontend/tests/e2e/README.md)
- [Configuration Playwright](euralis-frontend/playwright.config.ts)

---

**Bon testing! 🎭✅**
