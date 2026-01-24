import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright pour Tests E2E Frontend
 * Sprint 6C - Dashboard 3-Courbes
 *
 * Voir https://playwright.dev/docs/test-configuration
 */

export default defineConfig({
  testDir: './tests/e2e',

  // Timeout par test
  timeout: 30 * 1000,

  // Expect timeout
  expect: {
    timeout: 5000
  },

  // Exécution des tests
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  // Configuration globale
  use: {
    // Base URL
    baseURL: process.env.BASE_URL || 'http://localhost:3001',

    // Trace en cas d'échec
    trace: 'on-first-retry',

    // Screenshot en cas d'échec
    screenshot: 'only-on-failure',

    // Video en cas d'échec
    video: 'retain-on-failure',
  },

  // Projets (différents navigateurs)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Tests mobile
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Serveur de développement (optionnel)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
