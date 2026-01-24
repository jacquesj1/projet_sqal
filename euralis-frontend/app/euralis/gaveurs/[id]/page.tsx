'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { euralisAPI } from '@/lib/euralis/api';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Package, CheckCircle, XCircle, BarChart3 } from 'lucide-react';

interface GaveurDetail {
  id: number;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  site_code: string;
  actif: boolean;
  created_at: string | null;
  nb_lots_total: number;
  nb_lots_actifs: number;
  nb_lots_termines: number;
}

interface Lot {
  id: number;
  code_lot: string;
  site_code: string;
  debut_lot: string;
  itm: number | null;
  sigma: number | null;
  statut: string;
  duree_gavage_reelle: number | null;
}

export default function GaveurDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gaveurId = parseInt(params.id as string);

  const [gaveur, setGaveur] = useState<GaveurDetail | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const siteNames: Record<string, string> = {
    'LL': 'Bretagne',
    'LS': 'Pays de Loire',
    'MT': 'Maubourguet'
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Charger détails du gaveur
        const gaveurData = await euralisAPI.getGaveurDetail(gaveurId);
        setGaveur(gaveurData);

        // Charger lots du gaveur
        // Si le gaveur a un site_code, utiliser getSiteLots, sinon utiliser getLots avec filtre
        let lotsData;
        if (gaveurData.site_code) {
          lotsData = await euralisAPI.getSiteLots(gaveurData.site_code, undefined, 50);
          // Filtrer par gaveur_id côté client
          setLots(lotsData.filter((lot: any) => lot.gaveur_id === gaveurId).slice(0, 10));
        } else {
          // Utiliser getLots général (pas d'endpoint spécifique gaveur encore)
          lotsData = await euralisAPI.getLots(undefined, undefined, 100);
          // Filtrer par gaveur_id côté client
          setLots(lotsData.filter((lot: any) => lot.gaveur_id === gaveurId).slice(0, 10));
        }

      } catch (err) {
        console.error('Erreur chargement gaveur:', err);
        setError('Impossible de charger les données du gaveur');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gaveurId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Chargement du profil gaveur...</div>
      </div>
    );
  }

  if (error || !gaveur) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">{error || 'Gaveur non trouvé'}</div>
          <button
            onClick={() => router.push('/euralis/gaveurs')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retour aux gaveurs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Breadcrumb */}
      <div>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-3">
          <button
            onClick={() => router.push('/euralis/gaveurs')}
            className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Gaveurs
          </button>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium">
            {gaveur.nom}
          </span>
        </nav>

        {/* Titre avec statut */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-3xl">
              {gaveur.prenom?.charAt(0) || gaveur.nom?.charAt(0) || '?'}{gaveur.nom?.charAt(1) || ''}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{gaveur.nom}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  gaveur.actif
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {gaveur.actif ? 'Actif' : 'Inactif'}
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {gaveur.site_code} - {siteNames[gaveur.site_code]}
                </span>
              </div>
            </div>
          </div>

          {/* Bouton Analytics */}
          <button
            onClick={() => router.push(`/euralis/gaveurs/${gaveurId}/analytics`)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
          >
            <BarChart3 className="w-5 h-5" />
            Voir Analytics IA
          </button>
        </div>
      </div>

      {/* Informations de contact */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations de Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Email</div>
              <div className="font-medium text-gray-900">{gaveur.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Téléphone</div>
              <div className="font-medium text-gray-900">{gaveur.telephone || 'N/A'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Site</div>
              <div className="font-medium text-gray-900">{gaveur.site_code} - {siteNames[gaveur.site_code]}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Membre depuis</div>
              <div className="font-medium text-gray-900">
                {gaveur.created_at
                  ? new Date(gaveur.created_at).toLocaleDateString('fr-FR')
                  : 'N/A'
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques Lots */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Lots Total</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{gaveur.nb_lots_total}</p>
            </div>
            <Package className="h-10 w-10 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 mt-3">Tous lots confondus</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Lots Actifs</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{gaveur.nb_lots_actifs}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <p className="text-xs text-gray-500 mt-3">En cours de gavage</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Lots Terminés</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">{gaveur.nb_lots_termines}</p>
            </div>
            <XCircle className="h-10 w-10 text-purple-500" />
          </div>
          <p className="text-xs text-gray-500 mt-3">Gavage terminé</p>
        </div>
      </div>

      {/* Lots Récents */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Lots Récents</h2>
        </div>

        {lots.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucun lot trouvé pour ce gaveur
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code Lot</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Début</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ITM</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sigma</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lots.map((lot) => (
                  <tr key={lot.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {lot.code_lot}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {lot.site_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lot.debut_lot ? new Date(lot.debut_lot).toLocaleDateString('fr-FR') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                      {lot.itm ? `${lot.itm.toFixed(2)} kg` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lot.sigma ? lot.sigma.toFixed(2) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        lot.statut === 'EN_COURS' || lot.statut === 'en_gavage'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {lot.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => router.push(`/euralis/lots/${lot.id}`)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Détails →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
