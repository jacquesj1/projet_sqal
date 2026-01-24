'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/euralis/Breadcrumb';
import RealtimeNotifications from '@/components/notifications/RealtimeNotifications';

export default function EuralisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<any>(null);

  const navigation = [
    { name: 'Dashboard', href: '/euralis/dashboard' },
    { name: '🧠 Analytics', href: '/euralis/analytics' },
    { name: 'Sites', href: '/euralis/sites' },
    { name: 'Gaveurs', href: '/euralis/gaveurs' },
    { name: '📈 Courbes PySR', href: '/euralis/courbes' },
    { name: 'Prévisions', href: '/euralis/previsions' },
    { name: 'Alertes', href: '/euralis/alertes' },
    { name: 'Qualité', href: '/euralis/qualite' },
    { name: 'Abattages', href: '/euralis/abattages' },
    { name: 'Finance', href: '/euralis/finance' },
  ];

  useEffect(() => {
    // Charger les infos utilisateur depuis localStorage
    const storedUserInfo = localStorage.getItem('user_info');
    if (storedUserInfo) {
      try {
        setUserInfo(JSON.parse(storedUserInfo));
      } catch (e) {
        console.error('Erreur parsing user_info:', e);
      }
    }

    // Vérifier et synchroniser le cookie avec localStorage
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      // Rafraîchir le cookie pour éviter expiration
      document.cookie = `access_token=${accessToken}; path=/; max-age=3600; SameSite=Lax`;
    }
  }, []);

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');

      // Appeler l'API de logout si on a un refresh token
      if (refreshToken) {
        await fetch('http://localhost:8000/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }).catch(() => {
          // Ignorer les erreurs de logout API
        });
      }

      // Nettoyer le localStorage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_info');

      // Nettoyer les cookies
      document.cookie = 'access_token=; path=/; max-age=0';

      // Rediriger vers login
      router.push('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // Forcer la déconnexion locale même si l'API échoue
      localStorage.clear();
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">
                🏢 EURALIS
              </h1>
              <span className="ml-4 text-gray-500 text-sm">
                Pilotage Multi-Sites
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                📅 Semaine 50 - 2024
              </span>
              <span className="text-sm text-gray-400">|</span>
              <span className="text-sm text-gray-600">
                👤 {userInfo?.name || userInfo?.email || 'Admin Euralis'}
              </span>
              <span className="text-sm text-gray-400">|</span>
              <RealtimeNotifications />
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors font-medium"
                title="Se déconnecter"
              >
                🚪 Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="px-3 py-4 text-sm font-medium text-gray-700 hover:text-blue-600 hover:border-b-2 hover:border-blue-600 transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              © 2024 Euralis - Pilotage Multi-Sites v1.0.0
            </div>
            <div className="flex space-x-4">
              <span>3 Sites | 65 Gaveurs</span>
              <span className="text-gray-300">|</span>
              <span>LL · LS · MT</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
