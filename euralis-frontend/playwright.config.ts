import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration - Euralis Frontend
 * ============================================
 *
 * Tests E2E pour l'application Euralis Gaveurs
 */

export default defineConfig({
  testDir: './tests/e2e',

  /* Timeout par test */
  timeout: 60000, // 60 secondes

  /* Expect timeout */
  expect: {
    timeout: 10000, // 10 secondes
  },

  /* Configuration de base */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  /* Reporter */
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  /* Configuration partagée pour tous les projets */
  use: {
    /* URL de base */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* API URL pour les tests */
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },

    /* Trace on first retry */
    trace: 'on-first-retry',

    /* Screenshots on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Navigation timeout */
    navigationTimeout: 30000,
  },

  /* Configuration des projets (navigateurs) */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    /* Tests mobiles */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Serveur de développement (optionnel) */
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
