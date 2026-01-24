/**
 * Keycloak Configuration for SQAL
 * SSO Authentication with role-based access control
 */

import Keycloak from 'keycloak-js';

// Keycloak configuration
const keycloakConfig = {
  url: 'http://localhost:8080',
  realm: 'sqal_realm',
  clientId: 'sqal-frontend',
};

// Initialize Keycloak instance
const keycloak = new Keycloak(keycloakConfig);

// Keycloak initialization options
export const keycloakInitOptions = {
  onLoad: 'check-sso' as const, // check-sso | login-required
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  pkceMethod: 'S256' as const, // PKCE for security
  checkLoginIframe: false, // Disable iframe for better performance
};

// Role definitions for SQAL
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  QUALITY_MANAGER: 'quality_manager',
  PRODUCTION_OPERATOR: 'production_operator',
  DATA_ANALYST: 'data_analyst',
  VIEWER: 'viewer',
} as const;

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 6,
  [ROLES.ORG_ADMIN]: 5,
  [ROLES.QUALITY_MANAGER]: 4,
  [ROLES.PRODUCTION_OPERATOR]: 3,
  [ROLES.DATA_ANALYST]: 2,
  [ROLES.VIEWER]: 1,
};

// Helper functions
export const hasRole = (role: string): boolean => {
  return keycloak.hasRealmRole(role);
};

export const hasAnyRole = (roles: string[]): boolean => {
  return roles.some(role => keycloak.hasRealmRole(role));
};

export const hasMinimumRole = (minimumRole: string): boolean => {
  const userRoles = keycloak.realmAccess?.roles || [];
  const minimumLevel = ROLE_HIERARCHY[minimumRole as keyof typeof ROLE_HIERARCHY] || 0;
  
  return userRoles.some(userRole => {
    const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0;
    return userLevel >= minimumLevel;
  });
};

export const getUserRoles = (): string[] => {
  return keycloak.realmAccess?.roles || [];
};

export const getHighestRole = (): string | null => {
  const userRoles = getUserRoles();
  let highestRole: string | null = null;
  let highestLevel = 0;

  userRoles.forEach(role => {
    const level = ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || 0;
    if (level > highestLevel) {
      highestLevel = level;
      highestRole = role;
    }
  });

  return highestRole;
};

export const getUserInfo = () => {
  return {
    username: keycloak.tokenParsed?.preferred_username || '',
    email: keycloak.tokenParsed?.email || '',
    name: keycloak.tokenParsed?.name || '',
    firstName: keycloak.tokenParsed?.given_name || '',
    lastName: keycloak.tokenParsed?.family_name || '',
    roles: getUserRoles(),
    highestRole: getHighestRole(),
  };
};

export default keycloak;
