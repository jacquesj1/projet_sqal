'use client';

import Link from 'next/link';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-amber-600 mb-4">404</h1>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Page non trouvée</h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 flex items-center justify-center gap-2"
          >
            <Home size={18} />
            Retour à l&apos;accueil
          </Link>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} />
            Page précédente
          </button>
        </div>

        <div className="mt-12 text-gray-500">
          <p className="text-sm">Pages disponibles :</p>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {[
              { href: '/', label: 'Dashboard' },
              { href: '/gavage', label: 'Gavage' },
              { href: '/canards', label: 'Canards' },
              { href: '/analytics', label: 'Analytics' },
              { href: '/blockchain', label: 'Blockchain' },
              { href: '/alertes', label: 'Alertes' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-amber-600 hover:text-amber-800 underline text-sm"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
