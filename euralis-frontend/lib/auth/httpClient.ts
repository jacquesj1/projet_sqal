/**
 * HTTP Client with JWT Auto-Refresh
 * ==================================
 *
 * Client HTTP configuré avec:
 * - Injection automatique du token JWT
 * - Refresh automatique quand le token expire
 * - Redirection vers login si refresh échoue
 * - Retry automatique de la requête après refresh
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface RefreshResponse extends TokenPair {}

/**
 * Stockage des tokens
 */
export const TokenStorage = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  },

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  },

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
  },

  getUserInfo(): any | null {
    if (typeof window === 'undefined') return null;
    const userInfo = localStorage.getItem('user_info');
    return userInfo ? JSON.parse(userInfo) : null;
  },

  setUserInfo(userInfo: any): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('user_info', JSON.stringify(userInfo));
  }
};

/**
 * Variable pour éviter les refresh simultanés
 */
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

/**
 * Rafraîchit le token JWT
 */
async function refreshAccessToken(): Promise<string> {
  // Si un refresh est déjà en cours, attendre le résultat
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      const refreshToken = TokenStorage.getRefreshToken();

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

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
        throw new Error('Refresh token expired');
      }

      const data: RefreshResponse = await response.json();

      // Sauvegarder les nouveaux tokens
      TokenStorage.setTokens(data.access_token, data.refresh_token);

      return data.access_token;
    } catch (error) {
      // Refresh échoué - rediriger vers login
      TokenStorage.clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Options pour httpClient
 */
export interface HttpOptions extends RequestInit {
  skipAuth?: boolean;  // Ne pas ajouter le token
  skipRefresh?: boolean;  // Ne pas tenter de refresh si 401
}

/**
 * Client HTTP avec gestion automatique des tokens
 */
export async function httpClient(
  endpoint: string,
  options: HttpOptions = {}
): Promise<Response> {
  const { skipAuth = false, skipRefresh = false, ...fetchOptions } = options;

  // Construire l'URL complète
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  // Ajouter le token JWT si disponible et non skip
  if (!skipAuth) {
    const accessToken = TokenStorage.getAccessToken();
    if (accessToken) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Authorization': `Bearer ${accessToken}`,
      };
    }
  }

  // Ajouter Content-Type par défaut pour JSON
  if (
    fetchOptions.body &&
    typeof fetchOptions.body === 'string' &&
    !fetchOptions.headers?.hasOwnProperty('Content-Type')
  ) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Content-Type': 'application/json',
    };
  }

  // Effectuer la requête
  let response = await fetch(url, fetchOptions);

  // Si 401 et pas skip refresh, tenter de refresh le token
  if (response.status === 401 && !skipAuth && !skipRefresh) {
    try {
      // Rafraîchir le token
      const newAccessToken = await refreshAccessToken();

      // Retry la requête avec le nouveau token
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Authorization': `Bearer ${newAccessToken}`,
      };

      response = await fetch(url, fetchOptions);
    } catch (error) {
      // Le refresh a échoué, on laisse passer le 401
      console.error('Token refresh failed:', error);
    }
  }

  return response;
}

/**
 * Helpers pour les méthodes HTTP courantes
 */

export const http = {
  /**
   * GET request
   */
  async get(endpoint: string, options: HttpOptions = {}) {
    return httpClient(endpoint, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * POST request
   */
  async post(endpoint: string, data?: any, options: HttpOptions = {}) {
    return httpClient(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  /**
   * PUT request
   */
  async put(endpoint: string, data?: any, options: HttpOptions = {}) {
    return httpClient(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  /**
   * DELETE request
   */
  async delete(endpoint: string, options: HttpOptions = {}) {
    return httpClient(endpoint, {
      ...options,
      method: 'DELETE',
    });
  },

  /**
   * PATCH request
   */
  async patch(endpoint: string, data?: any, options: HttpOptions = {}) {
    return httpClient(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
};

/**
 * Hook pour vérifier si l'utilisateur est authentifié
 */
export function useAuth() {
  const accessToken = TokenStorage.getAccessToken();
  const userInfo = TokenStorage.getUserInfo();

  return {
    isAuthenticated: !!accessToken,
    user: userInfo,
    logout: () => {
      const refreshToken = TokenStorage.getRefreshToken();

      // Appeler l'API de logout
      if (refreshToken) {
        http.post('/api/auth/logout', { refresh_token: refreshToken }, { skipRefresh: true })
          .catch(() => {
            // Ignorer les erreurs de logout API
          });
      }

      // Nettoyer le localStorage
      TokenStorage.clearTokens();

      // Rediriger vers login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
  };
}

/**
 * Fonction de login
 */
export async function login(email: string, password: string): Promise<any> {
  const response = await http.post(
    '/api/auth/login',
    { email, password },
    { skipAuth: true }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Login failed');
  }

  const data: TokenPair = await response.json();

  // Sauvegarder les tokens
  TokenStorage.setTokens(data.access_token, data.refresh_token);

  // Récupérer les infos utilisateur
  const userResponse = await http.get('/api/auth/me');
  if (userResponse.ok) {
    const userInfo = await userResponse.json();
    TokenStorage.setUserInfo(userInfo);
    return userInfo;
  }

  return null;
}
