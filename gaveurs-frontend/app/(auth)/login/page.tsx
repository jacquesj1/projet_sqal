'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Login via Backend API endpoint unifié (détecte auto gaveur/superviseur)
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Invalid credentials');
      }

      const { access_token, refresh_token, user_info } = await response.json();

      // Save token in cookie for middleware (CRITICAL for authentication)
      Cookies.set('auth_token', access_token, {
        expires: 7, // 7 days
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      // Save tokens in localStorage for API calls
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('gaveur_token', access_token);

      if (user_info) {
        localStorage.setItem('user', JSON.stringify(user_info));

        // Sauvegarder les infos pour la navbar
        if (user_info.id) {
          localStorage.setItem('gaveur_id', user_info.id.toString());
        }
        if (user_info.name) {
          localStorage.setItem('gaveur_nom', user_info.name);
        }
        if (user_info.email) {
          localStorage.setItem('gaveur_email', user_info.email);
        }
      }

      // Redirect to dashboard
      router.push('/');

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de connexion';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-6xl">🦆</span>
          <h1 className="text-3xl font-bold text-gray-800 mt-4">
            Système Gaveurs V3.0
          </h1>
          <p className="text-gray-600 mt-2">Connectez-vous avec Keycloak</p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="jean.martin@gaveur.fr"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-600">Se souvenir</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700 font-semibold mb-2 text-center">Comptes de test :</p>
          <div className="text-xs text-gray-600 space-y-1">
            <div><strong>Admin:</strong> admin@euralis.fr / admin123</div>
            <div><strong>Superviseur:</strong> superviseur@euralis.fr / super123</div>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            Note: Ces comptes sont pour les superviseurs. L'accès gaveur se fait directement via /lots
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>🔐 Authentification sécurisée par Keycloak</p>
          <p className="mt-1">Version 3.0</p>
        </div>
      </div>
    </div>
  );
}
