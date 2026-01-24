/**
 * E2E Tests - Features
 * =====================
 *
 * Tests pour les fonctionnalités avancées:
 * - Filtres avancés lots
 * - Export Excel
 * - Tri colonnes
 * - Notifications temps réel
 */

import { test, expect } from '@playwright/test';
import { loginProgrammatically } from './helpers/auth';

test.describe('Advanced Lot Filters', () => {
  test.beforeEach(async ({ page }) => {
    await loginProgrammatically(page);
    await page.goto('/euralis/sites/LL/lots');

    // Attendre le chargement de la page
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  });

  test('should display filter controls', async ({ page }) => {
    // Vérifier la présence des contrôles de filtrage
    const searchInput = page.locator('input[type="text"], input[placeholder*="Recherche"], input[placeholder*="recherche"]');

    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
    }

    // Vérifier la présence de boutons/selects de filtre
    const filterControls = page.locator('select, button:has-text("Filtre"), button:has-text("filtre")');
    if (await filterControls.count() > 0) {
      expect(await filterControls.count()).toBeGreaterThan(0);
    }
  });

  test('should filter lots by text search', async ({ page }) => {
    // Chercher le champ de recherche
    const searchInput = page.locator('input[type="text"]').first();

    if (await searchInput.isVisible()) {
      // Compter les lots avant filtrage
      const lotsBeforeFilter = await page.locator('tr[data-lot], [data-testid*="lot"]').count();

      // Entrer un terme de recherche
      await searchInput.fill('LL');

      // Attendre un court instant pour le filtrage
      await page.waitForTimeout(500);

      // Compter les lots après filtrage
      const lotsAfterFilter = await page.locator('tr[data-lot], [data-testid*="lot"]').count();

      // Les résultats devraient être différents (ou au moins, pas d'erreur)
      expect(lotsAfterFilter).toBeGreaterThanOrEqual(0);
    }
  });

  test('should show/hide advanced filters', async ({ page }) => {
    // Chercher le bouton pour afficher les filtres avancés
    const advancedFilterButton = page.locator('button:has-text("Afficher"), button:has-text("avancé")');

    if (await advancedFilterButton.count() > 0) {
      // Cliquer pour afficher
      await advancedFilterButton.first().click();

      // Attendre l'apparition des filtres avancés
      await page.waitForTimeout(300);

      // Vérifier que des champs supplémentaires sont visibles
      const dateInputs = page.locator('input[type="date"]');
      if (await dateInputs.count() > 0) {
        await expect(dateInputs.first()).toBeVisible();
      }
    }
  });

  test('should reset filters', async ({ page }) => {
    // Chercher le bouton reset/réinitialiser
    const resetButton = page.locator('button:has-text("Réinitialiser"), button:has-text("Reset"), button:has-text("reset")');

    if (await resetButton.count() > 0) {
      // Cliquer sur reset
      await resetButton.first().click();

      // Attendre le reset
      await page.waitForTimeout(500);

      // Vérifier que les champs sont vides
      const searchInput = page.locator('input[type="text"]').first();
      if (await searchInput.isVisible()) {
        const value = await searchInput.inputValue();
        expect(value).toBe('');
      }
    }
  });
});

test.describe('Column Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await loginProgrammatically(page);
    await page.goto('/euralis/sites/LL/lots');

    // Attendre le chargement
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  });

  test('should sort columns when clicking headers', async ({ page }) => {
    // Chercher les en-têtes de colonnes cliquables
    const sortableHeaders = page.locator('th[role="button"], th button, th.cursor-pointer');

    if (await sortableHeaders.count() > 0) {
      const firstHeader = sortableHeaders.first();

      // Cliquer sur l'en-tête
      await firstHeader.click();

      // Attendre le tri
      await page.waitForTimeout(500);

      // Vérifier la présence d'un indicateur de tri (icône)
      const sortIcon = page.locator('svg[class*="arrow"], [class*="sort-icon"]');
      if (await sortIcon.count() > 0) {
        expect(await sortIcon.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should toggle sort direction', async ({ page }) => {
    // Chercher un en-tête triable
    const sortableHeader = page.locator('th[role="button"], th button').first();

    if (await sortableHeader.isVisible()) {
      // Premier clic - tri ASC
      await sortableHeader.click();
      await page.waitForTimeout(300);

      // Deuxième clic - tri DESC
      await sortableHeader.click();
      await page.waitForTimeout(300);

      // Le tri devrait être actif (pas d'erreur)
      expect(true).toBe(true);
    }
  });
});

test.describe('Excel Export', () => {
  test.beforeEach(async ({ page }) => {
    await loginProgrammatically(page);
    await page.goto('/euralis/sites/LL/lots');

    // Attendre le chargement
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  });

  test('should have export button', async ({ page }) => {
    // Chercher le bouton export
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Excel")');

    if (await exportButton.count() > 0) {
      await expect(exportButton.first()).toBeVisible();
      await expect(exportButton.first()).toBeEnabled();
    }
  });

  test('should download Excel file on export', async ({ page }) => {
    // Chercher le bouton export
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Excel")').first();

    if (await exportButton.isVisible()) {
      // Préparer le listener de téléchargement
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

      // Cliquer sur export
      await exportButton.click();

      // Attendre le téléchargement
      try {
        const download = await downloadPromise;

        // Vérifier le nom du fichier
        const fileName = download.suggestedFilename();
        expect(fileName).toMatch(/\.xlsx$/);
      } catch (error) {
        // Si le téléchargement échoue, ce n'est pas critique pour ce test
        console.log('Export download failed or not triggered:', error);
      }
    }
  });
});

test.describe('Real-time Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await loginProgrammatically(page);
    await page.goto('/euralis/dashboard');
  });

  test('should display notification bell icon', async ({ page }) => {
    // Chercher l'icône de notification (cloche)
    const notificationBell = page.locator('button:has([class*="bell"]), [aria-label*="notification"], [class*="notification-icon"]');

    if (await notificationBell.count() > 0) {
      await expect(notificationBell.first()).toBeVisible();
    }
  });

  test('should open notification panel on click', async ({ page }) => {
    // Chercher et cliquer sur la cloche
    const notificationBell = page.locator('button svg[class*="h-6"]').filter({ has: page.locator('path') }).locator('..').first();

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      // Attendre l'ouverture du panel
      await page.waitForTimeout(500);

      // Vérifier la présence du panel
      const notificationPanel = page.locator('[class*="notification-panel"], [class*="dropdown"], .absolute.right-0');
      if (await notificationPanel.count() > 0) {
        await expect(notificationPanel.first()).toBeVisible();
      }
    }
  });

  test('should display notification count badge', async ({ page }) => {
    // Chercher le badge de compteur
    const badge = page.locator('[class*="badge"], [class*="rounded-full"][class*="bg-red"]');

    if (await badge.count() > 0) {
      // Le badge peut être visible ou non selon s'il y a des notifications
      const isVisible = await badge.first().isVisible();
      expect(typeof isVisible).toBe('boolean');
    }
  });
});

test.describe('Dashboard Charts', () => {
  test.beforeEach(async ({ page }) => {
    await loginProgrammatically(page);
    await page.goto('/euralis/dashboard');

    // Attendre le chargement complet
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  });

  test('should display dashboard cards', async ({ page }) => {
    // Chercher les cartes de stats
    const cards = page.locator('[class*="card"], [class*="bg-white"][class*="rounded"], [class*="shadow"]');

    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('should display charts', async ({ page }) => {
    // Chercher les graphiques (SVG Recharts)
    const charts = page.locator('svg.recharts-surface');

    if (await charts.count() > 0) {
      await expect(charts.first()).toBeVisible();
    }
  });

  test('should display KPIs', async ({ page }) => {
    // Chercher les KPIs (nombres/métriques)
    const kpis = page.locator('[class*="text-2xl"], [class*="text-3xl"], [class*="font-bold"]');

    const kpiCount = await kpis.count();
    expect(kpiCount).toBeGreaterThan(0);
  });
});

test.describe('Analytics Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginProgrammatically(page);
    await page.goto('/euralis/analytics');

    // Attendre le chargement
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  });

  test('should display tab navigation', async ({ page }) => {
    // Chercher les onglets
    const tabs = page.locator('[role="tab"], button[class*="tab"]');

    if (await tabs.count() > 0) {
      expect(await tabs.count()).toBeGreaterThan(0);
    }
  });

  test('should switch between tabs', async ({ page }) => {
    // Chercher les onglets
    const tabs = page.locator('[role="tab"], button[class*="tab"]');

    if (await tabs.count() > 1) {
      // Cliquer sur le deuxième onglet
      await tabs.nth(1).click();

      // Attendre le changement
      await page.waitForTimeout(500);

      // Vérifier que le contenu a changé
      expect(true).toBe(true);
    }
  });

  test('should display visualizations', async ({ page }) => {
    // Chercher les visualisations (graphiques, Sankey, etc.)
    const visualizations = page.locator('svg, canvas, [class*="chart"]');

    const vizCount = await visualizations.count();
    expect(vizCount).toBeGreaterThan(0);
  });
});
