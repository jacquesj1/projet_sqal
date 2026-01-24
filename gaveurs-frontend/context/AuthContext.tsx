'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import type { User, AuthToken } from '@/lib/types';
import { authApi } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  gaveurId: number | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    nom: string;
    prenom: string;
    role: 'gaveur' | 'veterinaire';
    telephone?: string;
  }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const COOKIE_OPTIONS = {
  expires: 7, // 7 jours
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    try {
      const token = Cookies.get('auth_token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Erreur vérification auth:', error);
      Cookies.remove('auth_token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const data = await authApi.login({ email, password }) as AuthToken;

    // Stocker le token dans un cookie pour le middleware
    Cookies.set('auth_token', data.access_token, COOKIE_OPTIONS);
    localStorage.setItem('access_token', data.access_token);

    // Enrichir user avec gaveur_id depuis user_info
    const enrichedUser = {
      ...data.user,
      gaveur_id: data.user_info?.gaveur_id || data.user_info?.id || data.user_info?.gaveur?.id || null
    };

    localStorage.setItem('user', JSON.stringify(enrichedUser));
    setUser(enrichedUser);

    router.push('/');
  };

  const register = async (registerData: {
    email: string;
    password: string;
    nom: string;
    prenom: string;
    role: 'gaveur' | 'veterinaire';
    telephone?: string;
  }) => {
    await authApi.register(registerData);
    router.push('/login');
  };

  const logout = () => {
    Cookies.remove('auth_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  const gaveurId = (user as any)?.gaveur_id || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        gaveurId,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
