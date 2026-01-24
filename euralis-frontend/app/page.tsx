'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Page d'accueil Euralis - Redirige vers le dashboard
 *
 * TEMPORAIRE : L'authentification sera implémentée plus tard (Keycloak/JWT)
 * Pour l'instant, accès direct au dashboard
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirection immédiate vers le dashboard Euralis
    router.replace('/euralis/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-500 to-blue-600">
      <div className="text-center text-white">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent mx-auto"></div>
        <p className="mt-4 text-lg font-semibold">Chargement Euralis...</p>
      </div>
    </div>
  );
}
