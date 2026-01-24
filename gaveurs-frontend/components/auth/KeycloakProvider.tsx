'use client';

import { ReactKeycloakProvider } from '@react-keycloak/web';
import keycloak from '@/lib/keycloak';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

interface KeycloakProviderProps {
  children: ReactNode;
}

export default function KeycloakProvider({ children }: KeycloakProviderProps) {
  const router = useRouter();

  const onEvent = (event: string, error: any) => {
    console.log('Keycloak event:', event, error);

    if (event === 'onAuthSuccess') {
      // Save token to localStorage
      if (keycloak.token) {
        localStorage.setItem('access_token', keycloak.token);
        localStorage.setItem('refresh_token', keycloak.refreshToken || '');
      }
    }

    if (event === 'onAuthLogout') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      router.push('/login');
    }

    if (event === 'onAuthRefreshError') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  const onTokens = (tokens: any) => {
    if (tokens?.token) {
      localStorage.setItem('access_token', tokens.token);
    }
    if (tokens?.refreshToken) {
      localStorage.setItem('refresh_token', tokens.refreshToken);
    }
  };

  return (
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={{
        onLoad: 'check-sso',
        checkLoginIframe: false,
        pkceMethod: 'S256',
      }}
      onEvent={onEvent}
      onTokens={onTokens}
    >
      {children}
    </ReactKeycloakProvider>
  );
}
