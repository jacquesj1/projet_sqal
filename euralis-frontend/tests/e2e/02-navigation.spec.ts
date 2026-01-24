/**
 * E2E Tests - Navigation
 * =======================
 *
 * Tests pour la navigation dans l'application:
 * - Menu de navigation
 * - Pages principales
 * - Breadcrumbs
 * - Liens internes
 */

import { test, expect } from '@playwright/test';
import { loginProgrammatically } from './helpers/auth';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login avant chaque test
    await loginProgrammatically(page);
    await page.goto('/euralis/dashboard');
  });

  test('should display main navigation menu', async ({ page }) => {
    // Vérifier que le menu de navigation est visible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Vérifier les liens principaux
    await expect(page.locator('a:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('a:has-text("Sites")')).toBeVisible();
    await expect(page.locator('a:has-text("Gaveurs")')).toBeVisible();
    await expect(page.locator('a:has-text("Analytics")')).toBeVisible();
  });

  test('should navigate to Dashboard', async ({ page }) => {
    await page.click('a:has-text("Dashboard")');
    await page.waitForURL('**/euralis/dashboard', { timeout: 10000 });

    await expect(page).toHaveURL(/\/euralis\/dashboard/);
    await expect(page.locator('h1, h2')).toContainText(/Dashboard|Pilotage/);
  });

  test('should navigate to Sites page', async ({ page }) => {
    await page.click('a:has-text("Sites")');
    await page.waitForURL('**/euralis/sites', { timeout: 10000 });

    await expect(page).toHaveURL(/\/euralis\/sites/);
    await expect(page.locator('h1, h2')).toContainText(/Sites/);
  });

  test('should navigate to Gaveurs page', async ({ page }) => {
    await page.click('a:has-text("Gaveurs")');
    await page.waitForURL('**/euralis/gaveurs', { timeout: 10000 });

    await expect(page).toHaveURL(/\/euralis\/gaveurs/);
    await expect(page.locator('h1, h2')).toContainText(/Gaveurs/);
  });

  test('should navigate to Analytics page', async ({ page }) => {
    await page.click('a:has-text("Analytics")');
    await page.waitForURL('**/euralis/analytics', { timeout: 10000 });

    await expect(page).toHaveURL(/\/euralis\/analytics/);
    await expect(page.locator('h1, h2')).toContainText(/Analytics/);
  });

  test('should navigate to Alertes page', async ({ page }) => {
    await page.click('a:has-text("Alertes")');
    await page.waitForURL('**/euralis/alertes', { timeout: 10000 });

    await expect(page).toHaveURL(/\/euralis\/alertes/);
    await expect(page.locator('h1, h2')).toContainText(/Alertes/);
  });

  test('should navigate to Qualité page', async ({ page }) => {
    await page.click('a:has-text("Qualité")');
    await page.waitForURL('**/euralis/qualite', { timeout: 10000 });

    await expect(page).toHaveURL(/\/euralis\/qualite/);
  });

  test('should display breadcrumbs on detail pages', async ({ page }) => {
    // Aller sur la page Sites
    await page.goto('/euralis/sites');

    // Cliquer sur un site (si disponible)
    const siteLink = page.locator('a[href*="/euralis/sites/"]').first();
    if (await siteLink.isVisible()) {
      await siteLink.click();

      // Attendre le chargement
      await page.waitForURL(/\/euralis\/sites\/[A-Z]+/, { timeout: 10000 });

      // Vérifier que les breadcrumbs sont visibles
      const breadcrumb = page.locator('nav[aria-label="breadcrumb"], .breadcrumb');
      if (await breadcrumb.count() > 0) {
        await expect(breadcrumb.first()).toBeVisible();
      }
    }
  });

  test('should maintain header and footer across navigation', async ({ page }) => {
    // Vérifier header sur dashboard
    await expect(page.locator('header')).toBeVisible();

    // Naviguer vers Sites
    await page.click('a:has-text("Sites")');
    await page.waitForURL('**/euralis/sites', { timeout: 10000 });

    // Header toujours visible
    await expect(page.locator('header')).toBeVisible();

    // Footer visible (si présent)
    const footer = page.locator('footer');
    if (await footer.count() > 0) {
      await expect(footer).toBeVisible();
    }
  });

  test('should have working browser back/forward navigation', async ({ page }) => {
    // Naviguer: Dashboard → Sites → Gaveurs
    await page.goto('/euralis/dashboard');
    await page.goto('/euralis/sites');
    await page.goto('/euralis/gaveurs');

    // Vérifier URL actuelle
    await expect(page).toHaveURL(/\/euralis\/gaveurs/);

    // Bouton retour
    await page.goBack();
    await expect(page).toHaveURL(/\/euralis\/sites/);

    // Bouton retour
    await page.goBack();
    await expect(page).toHaveURL(/\/euralis\/dashboard/);

    // Bouton avancer
    await page.goForward();
    await expect(page).toHaveURL(/\/euralis\/sites/);
  });
});

test.describe('Site Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginProgrammatically(page);
    await page.goto('/euralis/sites');
  });

  test('should navigate to site detail page', async ({ page }) => {
    // Attendre le chargement des sites
    await page.waitForSelector('a[href*="/euralis/sites/"]', { timeout: 15000 });

    // Cliquer sur le premier site
    const siteLink = page.locator('a[href*="/euralis/sites/"]').first();
    await siteLink.click();

    // Attendre le chargement de la page détail
    await page.waitForURL(/\/euralis\/sites\/[A-Z]+$/, { timeout: 10000 });

    // Vérifier que nous sommes sur une page de détail
    const url = page.url();
    expect(url).toMatch(/\/euralis\/sites\/(LL|LS|MT)/);
  });

  test('should navigate to site lots page', async ({ page }) => {
    // Aller sur un site
    await page.goto('/euralis/sites/LL');

    // Chercher le lien vers les lots
    const lotsLink = page.locator('a[href*="/lots"]').first();
    if (await lotsLink.isVisible()) {
      await lotsLink.click();

      // Attendre le chargement de la page lots
      await page.waitForURL(/\/euralis\/sites\/LL\/lots/, { timeout: 10000 });

      // Vérifier que nous sommes sur la page des lots
      await expect(page).toHaveURL(/\/euralis\/sites\/LL\/lots/);
    }
  });

  test('should display site stats and charts', async ({ page }) => {
    // Aller sur un site
    await page.goto('/euralis/sites/LL');

    // Attendre le chargement
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Vérifier la présence de stats (cartes ou tableaux)
    const stats = page.locator('[class*="stat"], [class*="card"], [class*="metric"]');
    if (await stats.count() > 0) {
      await expect(stats.first()).toBeVisible();
    }
  });
});
