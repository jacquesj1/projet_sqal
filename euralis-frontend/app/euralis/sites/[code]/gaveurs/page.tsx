'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { euralisAPI } from '@/lib/euralis/api';

interface Gaveur {
  id: number;
  nom: string;
  prenom: string | null;
  email: string;
  telephone: string | null;
  site_origine: string;
  nb_lots?: number;
}

export default function SiteGaveursPage() {
  const params = useParams();
  const router = useRouter();
  const siteCode = params.code as string;

  const [gaveurs, setGaveurs] = useState<Gaveur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const siteNames: Record<string, string> = {
    'LL': 'Bretagne',
    'LS': 'Pays de Loire',
    'MT': 'Maubourguet'
  };

  useEffect(() => {
    const fetchGaveurs = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await euralisAPI.getSiteGaveurs(siteCode);
        setGaveurs(data);
      } catch (err) {
        console.error('Erreur chargement gaveurs:', err);
        setError('Impossible de charger les gaveurs du site');
      } finally {
        setLoading(false);
      }
    };

    fetchGaveurs();
  }, [siteCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Chargement des gaveurs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">{error}</div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb interactif avec bouton retour */}
      <div className="flex items-center justify-between">
        <div>
          {/* Breadcrumb cliquable */}
          <nav className="flex items-center gap-2 text-sm mb-3">
            <button
              onClick={() => router.push('/euralis/sites')}
              className="flex items-center gap-1 text-gray-600 hover:text-orange-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Sites
            </button>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <button
              onClick={() => router.push('/euralis/sites')}
              className="text-gray-600 hover:text-orange-600 transition-colors"
            >
              {siteCode} - {siteNames[siteCode]}
            </button>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900 font-medium">Gaveurs</span>
          </nav>

          {/* Titre */}
          <h1 className="text-3xl font-bold text-gray-900">
            Gaveurs du site {siteCode} - {siteNames[siteCode]}
          </h1>
          <p className="text-gray-600 mt-1">
            {gaveurs.length} gaveur{gaveurs.length > 1 ? 's' : ''} actif{gaveurs.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Bouton Retour stylé */}
        <button
          onClick={() => router.push('/euralis/sites')}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all group"
        >
          <svg className="w-5 h-5 text-gray-600 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="font-medium text-gray-700 group-hover:text-orange-600">Retour aux sites</span>
        </button>
      </div>

      {/* Grille des gaveurs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gaveurs.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            Aucun gaveur trouvé pour ce site
          </div>
        ) : (
          gaveurs.map((gaveur) => (
            <div
              key={gaveur.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              {/* Initiales */}
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {gaveur.prenom?.charAt(0) || gaveur.nom?.charAt(0) || '?'}{gaveur.nom?.charAt(1) || ''}
                </div>
                <div className="ml-3">
                  <div className="font-semibold text-gray-900">
                    {gaveur.nom}
                  </div>
                  <div className="text-sm text-gray-500">
                    Gaveur #{gaveur.id}
                  </div>
                </div>
              </div>

              {/* Informations de contact */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {gaveur.email}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {gaveur.telephone || 'N/A'}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Site {gaveur.site_origine}
                </div>
              </div>

              {/* Stats */}
              {gaveur.nb_lots !== undefined && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Lots gérés</span>
                    <span className="font-semibold text-gray-900">{gaveur.nb_lots}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => router.push(`/euralis/gaveurs/${gaveur.id}`)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Voir le profil →
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats globales */}
      {gaveurs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Informations Gaveurs
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Total: {gaveurs.length} gaveur{gaveurs.length > 1 ? 's' : ''} sur le site {siteCode} ({siteNames[siteCode]})
                </p>
                {gaveurs.some(g => g.nb_lots !== undefined) && (
                  <p className="mt-1">
                    Lots totaux gérés: {gaveurs.reduce((acc, g) => acc + (g.nb_lots || 0), 0)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
