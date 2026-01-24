'use client';

/**
 * Auth Provider Component
 * =======================
 *
 * Fournit le contexte d'authentification à toute l'application:
 * - État de connexion (isAuthenticated)
 * - Informations utilisateur
 * - Fonction de logout
 * - Auto-refresh du token en arrière-plan
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TokenStorage } from '@/lib/auth/httpClient';

interface User {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  user_type: string;
  sites?: string[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Hook pour accéder au contexte d'authentification
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provider d'authentification
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger les infos utilisateur au montage
  useEffect(() => {
    const accessToken = TokenStorage.getAccessToken();
    const userInfo = TokenStorage.getUserInfo();

    if (accessToken && userInfo) {
      setUser(userInfo);
    }

    setLoading(false);
  }, []);

  // Auto-refresh du token toutes les 50 minutes (avant expiration à 60 min)
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      const refreshToken = TokenStorage.getRefreshToken();

      if (!refreshToken) {
        return;
      }

      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        const response = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
        });

        if (!response.ok) {
          throw new Error('Refresh failed');
        }

        const data = await response.json();

        // Sauvegarder les nouveaux tokens
        TokenStorage.setTokens(data.access_token, data.refresh_token);

        console.log('[Auth] Token refreshed successfully');
      } catch (error) {
        console.error('[Auth] Failed to refresh token:', error);
        // Si le refresh échoue, déconnecter l'utilisateur
        handleLogout();
      }
    }, 50 * 60 * 1000); // 50 minutes

    return () => clearInterval(refreshInterval);
  }, []);

  const handleLogout = async () => {
    const refreshToken = TokenStorage.getRefreshToken();

    // Appeler l'API de logout
    if (refreshToken) {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
        });
      } catch (error) {
        console.error('[Auth] Logout API error:', error);
        // Continuer quand même avec le logout local
      }
    }

    // Nettoyer le localStorage
    TokenStorage.clearTokens();
    setUser(null);

    // Rediriger vers login
    router.push('/login');
  };

  const updateUser = (newUser: User) => {
    setUser(newUser);
    TokenStorage.setUserInfo(newUser);
  };

  const value: AuthContextType = {
    isAuthenticated: !!user,
    user,
    loading,
    logout: handleLogout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * HOC pour protéger une page (usage côté page)
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: { requiredRole?: string } = {}
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
      if (!loading && !isAuthenticated) {
        router.push(`/login?redirect=${pathname}`);
      }

      if (!loading && isAuthenticated && options.requiredRole) {
        if (user?.role !== options.requiredRole) {
          router.push('/euralis/dashboard');
        }
      }
    }, [isAuthenticated, user, loading, router, pathname]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    if (options.requiredRole && user?.role !== options.requiredRole) {
      return null;
    }

    return <Component {...props} />;
  };
}
