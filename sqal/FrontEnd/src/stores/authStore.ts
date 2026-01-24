// ============================================================================
// SQAL Frontend - Authentication Store (Zustand)
// Manages Keycloak authentication state
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { KeycloakUser, Organization } from "@/types";
import Keycloak from "keycloak-js";
import { STORAGE_KEYS } from "@constants/index";

interface AuthState {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: KeycloakUser | null;
  selectedOrganization: Organization | null;
  keycloak: Keycloak | null;
  token: string | null;
  refreshToken: string | null;
  roles: string[];
  permissions: string[];

  // Actions
  initialize: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  setUser: (user: KeycloakUser) => void;
  setSelectedOrganization: (org: Organization) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  reset: () => void;
}

// Helper function to parse Keycloak token
function parseKeycloakUser(tokenParsed: any): KeycloakUser {
  const permissions = tokenParsed.permissions || [];
  return {
    id: tokenParsed.sub,
    username: tokenParsed.preferred_username,
    email: tokenParsed.email,
    firstName: tokenParsed.given_name || "",
    lastName: tokenParsed.family_name || "",
    roles: tokenParsed.realm_access?.roles || [],
    organizationIds: tokenParsed.organization_ids || [],
    // Convert permissions to string array if needed
    permissions: Array.isArray(permissions) 
      ? permissions.map((p: any) => typeof p === 'string' ? p : p.name || p.id || String(p))
      : [],
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state - TEMPORARY: Skip Keycloak for development
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: "dev-user",
        username: "dev@sqal.local",
        email: "dev@sqal.local",
        firstName: "Dev",
        lastName: "User",
        roles: ["super_admin"],
        organizationIds: [],
        permissions: []
      },
      selectedOrganization: null,
      keycloak: null,
      token: "dev-token-bypass-auth", // Development token for WebSocket connection
      refreshToken: null,
      roles: ["super_admin"],
      permissions: [],

      // Initialize Keycloak - TEMPORARY: Skip initialization
      initialize: async () => {
        console.log("⚠️ Keycloak authentication disabled (development mode)");
        set({ isLoading: false, isAuthenticated: true });
        return;
        
        /* Original Keycloak initialization code commented out */
        /* 
        const state = get();
        
        // Prevent multiple initializations
        if (state.keycloak !== null) {
          console.log("Keycloak already initialized");
          return;
        }

        console.log("Initializing Keycloak...");
        set({ isLoading: true });

        try {
          const keycloak = new Keycloak({
            url: KEYCLOAK_CONFIG.url,
            realm: KEYCLOAK_CONFIG.realm,
            clientId: KEYCLOAK_CONFIG.clientId,
          });

          console.log("Keycloak config:", {
            url: KEYCLOAK_CONFIG.url,
            realm: KEYCLOAK_CONFIG.realm,
            clientId: KEYCLOAK_CONFIG.clientId,
          });

          const authenticated = await keycloak.init({
            onLoad: "check-sso",
            checkLoginIframe: false,
            pkceMethod: "S256",
          });

          console.log("Keycloak initialized, authenticated:", authenticated);

          if (authenticated && keycloak.tokenParsed) {
            // Extract user info from token
            const user = parseKeycloakUser(keycloak.tokenParsed);
            console.log("User authenticated:", user.username);

            set({
              isAuthenticated: true,
              isLoading: false,
              user,
              keycloak,
              token: keycloak.token || null,
              refreshToken: keycloak.refreshToken || null,
              roles: user.roles,
              permissions: user.permissions,
            });

            // Store token in localStorage
            if (keycloak.token) {
              localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, keycloak.token as string);
            }

            // Setup token refresh
            setupTokenRefresh(keycloak);
          } else {
            console.log("User not authenticated, showing login page");
            set({
              isAuthenticated: false,
              isLoading: false,
              keycloak,
            });
          }
        } catch (error) {
          console.error("Failed to initialize Keycloak:", error);
          set({
            isAuthenticated: false,
            isLoading: false,
            keycloak: null,
          });
        }
        */
      },
      // Login
      login: async () => {
        const { keycloak } = get();
        if (keycloak) {
          try {
            await keycloak.login({
              redirectUri: window.location.origin + "/dashboard",
            });
          } catch (error) {
            console.error("Failed to login:", error);
          }
        }
      },

      // Logout
      logout: async () => {
        const { keycloak } = get();
        if (keycloak) {
          localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          await keycloak.logout({
            redirectUri: window.location.origin,
          });
        }
        get().reset();
      },

      // Refresh tokens
      refreshTokens: async () => {
        const { keycloak } = get();
        if (keycloak) {
          try {
            const refreshed = await keycloak.updateToken(70);
            if (refreshed && keycloak.tokenParsed) {
              set({
                isAuthenticated: true,
                user: parseKeycloakUser(keycloak.tokenParsed),
                token: keycloak.token || null,
                isLoading: false,
              });
              if (keycloak.token) {
                localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, keycloak.token);
              }
              return true;
            }
          } catch (error) {
            console.error("Failed to refresh token:", error);
            get().logout();
            return false;
          }
        }
        return false;
      },

      // Set user
      setUser: (user) => set({ user }),

      // Set selected organization
      setSelectedOrganization: (org) => {
        set({ selectedOrganization: org });
        localStorage.setItem(STORAGE_KEYS.SELECTED_ORG, org.id);
      },

      // Check permission
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;

        // Super admin has all permissions
        if (user.roles.includes("super_admin")) return true;

        // Check if user has specific permission
        return user.permissions.some((p) => {
          const [resource, action] = permission.split(":");
          return p.resource === resource && p.actions.includes(action);
        });
      },

      // Check role
      hasRole: (role) => {
        const { user } = get();
        return user?.roles.includes(role) || false;
      },

      // Reset state
      reset: () =>
        set({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          selectedOrganization: null,
          token: null,
          refreshToken: null,
        }),
    }),
    {
      name: "sqal-auth-storage",
      partialize: (state) => ({
        selectedOrganization: state.selectedOrganization,
      }),
    }
  )
);
