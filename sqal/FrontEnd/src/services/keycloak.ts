// ============================================================================
// SQAL Frontend - Keycloak Service
// Service d'authentification Keycloak
// ============================================================================

import Keycloak from "keycloak-js";

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080",
  realm: import.meta.env.VITE_KEYCLOAK_REALM || "sqal_realm",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "sqal-frontend",
};

// Instance Keycloak singleton
let keycloakInstance: Keycloak | null = null;

/**
 * Initialise Keycloak
 */
export async function initKeycloak(): Promise<Keycloak> {
  if (keycloakInstance) {
    return keycloakInstance;
  }

  keycloakInstance = new Keycloak(keycloakConfig);

  try {
    const authenticated = await keycloakInstance.init({
      onLoad: "check-sso",
      silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
      pkceMethod: "S256",
    });

    console.log(`Keycloak initialized. Authenticated: ${authenticated}`);

    // Auto-refresh token
    if (authenticated) {
      setInterval(() => {
        keycloakInstance
          ?.updateToken(70)
          .then((refreshed) => {
            if (refreshed) {
              console.log("Token refreshed");
            }
          })
          .catch(() => {
            console.error("Failed to refresh token");
          });
      }, 60000); // Check every minute
    }

    return keycloakInstance;
  } catch (error) {
    console.error("Failed to initialize Keycloak:", error);
    throw error;
  }
}

/**
 * Récupère l'instance Keycloak
 */
export function getKeycloak(): Keycloak | null {
  return keycloakInstance;
}

/**
 * Login via Keycloak
 */
export function login(): void {
  keycloakInstance?.login();
}

/**
 * Logout via Keycloak
 */
export function logout(): void {
  keycloakInstance?.logout();
}

/**
 * Récupère le token d'accès
 */
export function getToken(): string | undefined {
  return keycloakInstance?.token;
}

/**
 * Récupère les informations utilisateur
 */
export function getUserInfo() {
  return keycloakInstance?.tokenParsed;
}

/**
 * Vérifie si l'utilisateur a un rôle
 */
export function hasRole(role: string): boolean {
  return keycloakInstance?.hasRealmRole(role) || false;
}

/**
 * Récupère tous les rôles de l'utilisateur
 */
export function getUserRoles(): string[] {
  return keycloakInstance?.realmAccess?.roles || [];
}
