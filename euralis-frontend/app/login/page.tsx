'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Récupérer l'URL de redirection si présente
  const redirectUrl = searchParams.get('redirect') || '/euralis/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Timeout pour éviter attentes trop longues
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Identifiants invalides');
      }

      const data = await response.json();

      // Optimisation: Stocker tout en parallèle
      const maxAge = 3600; // 1 heure
      document.cookie = `access_token=${data.access_token}; path=/; max-age=${maxAge}; SameSite=Lax`;

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user_info', JSON.stringify(data.user_info));

      // Redirection immédiate
      router.push(redirectUrl);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Le serveur met trop de temps à répondre. Veuillez réessayer.');
        } else {
          setError(err.message || 'Identifiants invalides');
        }
      } else {
        setError('Erreur de connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-6xl">🏢</span>
          <h1 className="text-3xl font-bold text-gray-800 mt-4 mb-2">
            Euralis - Supervision
          </h1>
          <p className="text-gray-600">Connexion sécurisée Keycloak</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="superviseur@euralis.fr"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span>Connexion...</span>
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-bold text-gray-700 text-center mb-2">
            Comptes de test disponibles:
          </p>
          <div className="text-xs text-gray-600 space-y-1">
            <div><strong>Superviseur:</strong> <span className="font-mono">superviseur@euralis.fr / super123</span></div>
            <div><strong>Admin:</strong> <span className="font-mono">admin@euralis.fr / admin123</span></div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>🔐 Authentification sécurisée par Keycloak</p>
          <p className="mt-1">Euralis Système Gaveurs V3.0</p>
        </div>
      </div>
    </div>
  );
}
