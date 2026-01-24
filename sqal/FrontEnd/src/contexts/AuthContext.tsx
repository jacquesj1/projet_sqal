/**
 * Authentication Context using Keycloak
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import keycloak, { keycloakInitOptions, getUserInfo, hasRole, hasAnyRole, hasMinimumRole } from '@/config/keycloak';
import { toast } from 'sonner';

export interface UserInfo {
  username: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  roles: string[];
  highestRole: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  token: string | null;
  login: () => void;
  logout: () => void;
  register: () => void;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasMinimumRole: (minimumRole: string) => boolean;
  updateToken: () => Promise<boolean>;
  keycloakEnabled: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [keycloakEnabled, setKeycloakEnabled] = useState(true);

  useEffect(() => {
    initKeycloak();
  }, []);

  const initKeycloak = async () => {
    try {
      // Check if Keycloak is disabled via environment variable
      if (import.meta.env.VITE_DISABLE_KEYCLOAK === 'true') {
        console.log('⚠️ Keycloak disabled via VITE_DISABLE_KEYCLOAK environment variable');
        setKeycloakEnabled(false);
        setIsAuthenticated(false);
        setIsLoading(false);
        toast.info('Mode développement', {
          description: 'Fonctionnement sans authentification (Keycloak désactivé)',
          duration: 3000,
        });
        return;
      }

      console.log('🔐 Initializing Keycloak...');
      console.log('🔐 Keycloak URL:', 'http://localhost:8080');
      console.log('🔐 Realm:', 'sqal_realm');
      console.log('🔐 Client ID:', 'sqal-frontend');

      // Try to initialize Keycloak with a timeout
      const initPromise = keycloak.init(keycloakInitOptions);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Keycloak initialization timeout')), 10000)
      );

      const authenticated = await Promise.race([initPromise, timeoutPromise]) as boolean;

      console.log('✅ Keycloak initialized, authenticated:', authenticated);
      setIsAuthenticated(authenticated);
      setKeycloakEnabled(true);

      if (authenticated) {
        setToken(keycloak.token || null);
        setUser(getUserInfo());

        // Setup token refresh
        setupTokenRefresh();

        toast.success('Connexion réussie', {
          description: `Bienvenue ${getUserInfo().firstName || getUserInfo().username}`,
        });
      } else {
        console.log('ℹ️ Not authenticated - check-sso mode (normal behavior)');
      }
    } catch (error) {
      console.error('❌ Keycloak initialization failed:', error);

      // Disable Keycloak and continue without authentication
      setKeycloakEnabled(false);
      setIsAuthenticated(false);

      // Show toast for development mode
      toast.info('Mode développement', {
        description: 'Fonctionnement sans authentification (Keycloak désactivé)',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupTokenRefresh = () => {
    // Refresh token every 5 minutes
    setInterval(() => {
      keycloak.updateToken(70).then((refreshed) => {
        if (refreshed) {
          setToken(keycloak.token || null);
          console.log('Token refreshed');
        }
      }).catch(() => {
        console.error('Failed to refresh token');
        logout();
      });
    }, 300000); // 5 minutes
  };

  const login = () => {
    if (!keycloakEnabled) {
      toast.error('Authentification non disponible', {
        description: 'Keycloak n\'est pas configuré ou accessible',
      });
      return;
    }
    
    keycloak.login({
      redirectUri: window.location.origin,
    });
  };

  const logout = () => {
    if (!keycloakEnabled) {
      return;
    }
    
    keycloak.logout({
      redirectUri: window.location.origin,
    });
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
    toast.info('Déconnexion réussie');
  };

  const register = () => {
    if (!keycloakEnabled) {
      toast.error('Authentification non disponible', {
        description: 'Keycloak n\'est pas configuré ou accessible',
      });
      return;
    }
    
    keycloak.register({
      redirectUri: window.location.origin,
    });
  };

  const updateToken = async (): Promise<boolean> => {
    if (!keycloakEnabled) {
      return false;
    }
    
    try {
      const refreshed = await keycloak.updateToken(30);
      if (refreshed) {
        setToken(keycloak.token || null);
      }
      return true;
    } catch {
      return false;
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    token,
    login,
    logout,
    register,
    hasRole,
    hasAnyRole,
    hasMinimumRole,
    updateToken,
    keycloakEnabled,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
