/**
 * E2E Tests - Authentication
 * ===========================
 *
 * Tests pour le flow d'authentification complet:
 * - Login superviseur
 * - Navigation authentifiée
 * - Logout
 * - Protection des routes
 */

import { test, expect } from '@playwright/test';
import { login, logout, loginProgrammatically, TEST_CREDENTIALS } from './helpers/auth';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Nettoyer le localStorage avant chaque test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    });
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    // Vérifier le titre
    await expect(page.locator('h1')).toContainText('Euralis');

    // Vérifier la présence du formulaire
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Vérifier les credentials de test affichés
    await expect(page.locator('text=superviseur@euralis.fr')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Remplir le formulaire
    await page.fill('input[type="email"]', TEST_CREDENTIALS.supervisor.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.supervisor.password);

    // Soumettre
    await page.click('button[type="submit"]');

    // Attendre la redirection vers le dashboard
    await page.waitForURL('**/euralis/dashboard', { timeout: 15000 });

    // Vérifier que nous sommes sur le dashboard
    await expect(page).toHaveURL(/\/euralis\/dashboard/);

    // Vérifier la présence d'éléments du dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Vérifier que les tokens sont dans le localStorage
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Remplir avec des credentials invalides
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Soumettre
    await page.click('button[type="submit"]');

    // Attendre le message d'erreur
    await expect(page.locator('text=Identifiants invalides')).toBeVisible({
      timeout: 10000,
    });

    // Vérifier que nous sommes toujours sur la page login
    await expect(page).toHaveURL(/\/login/);

    // Vérifier qu'il n'y a pas de tokens
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(accessToken).toBeNull();
  });

  test('should logout successfully', async ({ page }) => {
    // Login d'abord
    await login(page);

    // Vérifier que nous sommes sur le dashboard
    await expect(page).toHaveURL(/\/euralis\/dashboard/);

    // Cliquer sur le bouton de déconnexion
    await page.click('button:has-text("Déconnexion")');

    // Attendre la redirection vers login
    await page.waitForURL('**/login', { timeout: 10000 });

    // Vérifier que nous sommes sur la page login
    await expect(page).toHaveURL(/\/login/);

    // Vérifier que les tokens sont supprimés
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));

    expect(accessToken).toBeNull();
    expect(refreshToken).toBeNull();
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Essayer d'accéder au dashboard sans être connecté
    await page.goto('/euralis/dashboard');

    // Devrait rediriger vers login avec redirect param
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // Vérifier le paramètre redirect
    const url = new URL(page.url());
    expect(url.searchParams.get('redirect')).toContain('/euralis/dashboard');
  });

  test('should redirect back after login with redirect param', async ({ page }) => {
    // Essayer d'accéder à une page protégée
    const targetUrl = '/euralis/sites';
    await page.goto(targetUrl);

    // Devrait rediriger vers login
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // Login
    await page.fill('input[type="email"]', TEST_CREDENTIALS.supervisor.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.supervisor.password);
    await page.click('button[type="submit"]');

    // Devrait rediriger vers la page initiale (ou dashboard par défaut)
    await page.waitForURL(/\/euralis\//, { timeout: 15000 });

    // Vérifier que nous sommes authentifiés
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(accessToken).toBeTruthy();
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    // Login
    await login(page);

    // Recharger la page
    await page.reload();

    // Vérifier que nous sommes toujours authentifiés
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(accessToken).toBeTruthy();

    // Vérifier que nous pouvons naviguer
    await page.goto('/euralis/sites');
    await expect(page).toHaveURL(/\/euralis\/sites/);
  });

  test('should display user info in header after login', async ({ page }) => {
    // Login
    await login(page);

    // Vérifier que le header affiche les infos utilisateur
    await expect(page.locator('header')).toBeVisible();

    // Le nom ou email devrait être visible dans le header
    const headerText = await page.locator('header').textContent();
    expect(headerText).toBeTruthy();

    // Le bouton déconnexion devrait être visible
    await expect(page.locator('button:has-text("Déconnexion")')).toBeVisible();
  });
});

test.describe('Token Management', () => {
  test('should have valid JWT tokens after login', async ({ page }) => {
    await loginProgrammatically(page);

    // Récupérer les tokens
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));

    // Vérifier le format JWT (3 parties séparées par .)
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const accessParts = accessToken!.split('.');
    const refreshParts = refreshToken!.split('.');

    expect(accessParts).toHaveLength(3);
    expect(refreshParts).toHaveLength(3);
  });

  test('should store user info in localStorage', async ({ page }) => {
    await loginProgrammatically(page);

    // Récupérer les infos utilisateur
    const userInfoStr = await page.evaluate(() => localStorage.getItem('user_info'));
    expect(userInfoStr).toBeTruthy();

    const userInfo = JSON.parse(userInfoStr!);
    expect(userInfo).toHaveProperty('email');
    expect(userInfo.email).toBe(TEST_CREDENTIALS.supervisor.email);
  });
});
