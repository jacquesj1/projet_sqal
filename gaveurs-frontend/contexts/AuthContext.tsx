'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface GaveurInfo {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  site: string;
}

interface UserInfo {
  username?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  gaveur_id?: number;
  gaveur?: GaveurInfo;
}

interface AuthContextType {
  user: UserInfo | null;
  gaveurId: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUserInfo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Récupérer le token depuis localStorage au démarrage
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      setAccessToken(token);
      fetchUserInfo(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUserInfo = async (token?: string) => {
    const authToken = token || accessToken;
    if (!authToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token invalide - déconnexion
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setAccessToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: email, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await response.json();

      // Sauvegarder les tokens
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }

      setAccessToken(data.access_token);

      // Récupérer les infos utilisateur (qui incluent gaveur_id)
      await fetchUserInfo(data.access_token);

    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setAccessToken(null);
    setUser(null);
  };

  const gaveurId = user?.gaveur_id || user?.gaveur?.id || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        gaveurId,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        fetchUserInfo: () => fetchUserInfo(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
