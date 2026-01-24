'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { authApi } from '@/lib/api';

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
      // Login avec Keycloak via l'API backend
      const data = await authApi.login({ username: email, password }) as any;

      // Stocker les tokens
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user_info', JSON.stringify(data.user_info));

      // Rediriger vers le dashboard
      router.push('/');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Identifiants invalides';
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
            Gaveurs V3.0
          </h1>
          <p className="text-gray-600 mt-2">Connectez-vous à votre compte</p>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Comptes de test */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-bold text-gray-700 text-center mb-2">
            Comptes de test disponibles:
          </p>
          <div className="text-xs text-gray-600 space-y-1">
            <p className="font-mono">jean.martin@gaveur.fr / gaveur123</p>
            <p className="font-mono">sophie.dubois@gaveur.fr / gaveur123</p>
            <p className="font-mono">admin@euralis.fr / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
