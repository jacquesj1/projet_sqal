/**
 * Authentication Helpers for E2E Tests
 * =====================================
 *
 * Helpers pour gérer l'authentification dans les tests Playwright
 */

import { Page, BrowserContext } from '@playwright/test';

/**
 * Credentials de test
 */
export const TEST_CREDENTIALS = {
  supervisor: {
    email: 'superviseur@euralis.fr',
    password: 'super123',
  },
  admin: {
    email: 'admin@euralis.fr',
    password: 'admin123',
  },
};

/**
 * Login via l'interface utilisateur
 */
export async function login(
  page: Page,
  credentials: { email: string; password: string } = TEST_CREDENTIALS.supervisor
) {
  // Aller sur la page de login
  await page.goto('/login');

  // Remplir le formulaire
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);

  // Soumettre
  await page.click('button[type="submit"]');

  // Attendre la redirection vers le dashboard
  await page.waitForURL('**/euralis/dashboard', { timeout: 10000 });

  // Vérifier que les tokens sont présents
  const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
  const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));

  if (!accessToken || !refreshToken) {
    throw new Error('Login failed: tokens not found in localStorage');
  }

  return { accessToken, refreshToken };
}

/**
 * Login programmatique (plus rapide, pour setup)
 */
export async function loginProgrammatically(
  page: Page,
  credentials: { email: string; password: string } = TEST_CREDENTIALS.supervisor
) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Appeler l'API de login directement
  const response = await page.request.post(`${API_URL}/api/auth/login`, {
    data: credentials,
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${response.statusText()}`);
  }

  const data = await response.json();

  // Injecter les tokens dans le localStorage
  await page.evaluate(
    ({ accessToken, refreshToken, userInfo }) => {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      if (userInfo) {
        localStorage.setItem('user_info', JSON.stringify(userInfo));
      }
    },
    {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userInfo: {
        id: 1,
        email: credentials.email,
        name: 'Test User',
      },
    }
  );

  // Définir le cookie
  const context = page.context();
  await context.addCookies([
    {
      name: 'access_token',
      value: data.access_token,
      domain: 'localhost',
      path: '/',
      maxAge: 3600,
    },
  ]);

  return data;
}

/**
 * Logout
 */
export async function logout(page: Page) {
  // Cliquer sur le bouton de déconnexion
  await page.click('button:has-text("Déconnexion")');

  // Attendre la redirection vers login
  await page.waitForURL('**/login', { timeout: 10000 });

  // Vérifier que les tokens sont supprimés
  const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));

  if (accessToken) {
    throw new Error('Logout failed: access_token still in localStorage');
  }
}

/**
 * Vérifier l'authentification
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
  return !!accessToken;
}

/**
 * Récupérer les infos utilisateur
 */
export async function getUserInfo(page: Page) {
  const userInfo = await page.evaluate(() => {
    const info = localStorage.getItem('user_info');
    return info ? JSON.parse(info) : null;
  });

  return userInfo;
}

/**
 * Attendre que la page soit chargée (avec authentification)
 */
export async function waitForAuthenticatedPage(page: Page, url: string) {
  await page.goto(url);

  // Vérifier que nous ne sommes pas redirigés vers login
  await page.waitForURL((urlObj) => !urlObj.pathname.includes('/login'), {
    timeout: 10000,
  });

  // Vérifier l'authentification
  const authenticated = await isAuthenticated(page);
  if (!authenticated) {
    throw new Error(`Not authenticated after navigating to ${url}`);
  }
}
