'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-red-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Une erreur est survenue
        </h1>
        <p className="text-gray-600 mb-6">
          Nous nous excusons pour ce désagrément. Veuillez réessayer ou retourner à l&apos;accueil.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
            <p className="font-mono text-sm text-red-800 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-red-600">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Réessayer
          </button>
          <Link
            href="/"
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 flex items-center gap-2"
          >
            <Home size={18} />
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
