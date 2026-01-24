'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { euralisAPI } from '@/lib/euralis/api';
import { TrendingUp, Users, Award, ArrowRight, Search } from 'lucide-react';

interface Gaveur {
  gaveur_id: number;
  nom: string;
  prenom?: string;
  nb_lots: number;
  itm_moyen: number;
  mortalite: number;
  cluster: number;
  cluster_ml: boolean;
  performance_score: number;
  recommendation: string;
}

export default function CourbesOptimalesListePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gaveurs, setGaveurs] = useState<Gaveur[]>([]);
  const [filteredGaveurs, setFilteredGaveurs] = useState<Gaveur[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);

  useEffect(() => {
    loadGaveurs();
  }, []);

  useEffect(() => {
    filterGaveurs();
  }, [searchTerm, selectedCluster, gaveurs]);

  const loadGaveurs = async () => {
    try {
      setLoading(true);
      const response = await euralisAPI.getGaveursWithClustersML();
      setGaveurs(response.gaveurs || []);
      setFilteredGaveurs(response.gaveurs || []);
    } catch (error) {
      console.error('Erreur chargement gaveurs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterGaveurs = () => {
    let filtered = gaveurs;

    // Filtre par recherche
    if (searchTerm) {
      filtered = filtered.filter((g) =>
        g.nom.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtre par cluster
    if (selectedCluster !== null) {
      filtered = filtered.filter((g) => g.cluster === selectedCluster);
    }

    setFilteredGaveurs(filtered);
  };

  const handleSelectGaveur = (gaveurId: number) => {
    router.push(`/euralis/gaveurs/${gaveurId}/courbes`);
  };

  const clusterLabels = ['Excellent', 'Très bon', 'Bon', 'À améliorer', 'Critique'];
  const clusterColors = [
    'bg-green-100 text-green-800 border-green-200',
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-red-100 text-red-800 border-red-200',
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Courbes Optimales Personnalisées</h1>
        <p className="text-gray-600">
          Sélectionnez un gaveur pour générer sa courbe de gavage personnalisée
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Gaveurs</p>
              <p className="text-3xl font-bold text-gray-900">{gaveurs.length}</p>
            </div>
            <Users className="h-10 w-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ITM Moyen</p>
              <p className="text-3xl font-bold text-gray-900">
                {(gaveurs.reduce((sum, g) => sum + g.itm_moyen, 0) / gaveurs.length).toFixed(2)}
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Clusters</p>
              <p className="text-3xl font-bold text-gray-900">
                {new Set(gaveurs.map((g) => g.cluster)).size}
              </p>
            </div>
            <Award className="h-10 w-10 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recherche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher un gaveur</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Nom du gaveur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filtre Cluster */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrer par cluster</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCluster(null)}
                className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                  selectedCluster === null
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Tous
              </button>
              {[0, 1, 2, 3, 4].map((cluster) => (
                <button
                  key={cluster}
                  onClick={() => setSelectedCluster(cluster)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                    selectedCluster === cluster
                      ? clusterColors[cluster]
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {clusterLabels[cluster]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Liste Gaveurs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gaveur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cluster
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ITM Moyen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nb Lots
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGaveurs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Aucun gaveur trouvé
                  </td>
                </tr>
              ) : (
                filteredGaveurs.map((gaveur) => (
                  <tr
                    key={gaveur.gaveur_id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleSelectGaveur(gaveur.gaveur_id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{gaveur.nom}</div>
                      {gaveur.prenom && <div className="text-sm text-gray-500">{gaveur.prenom}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${
                          clusterColors[gaveur.cluster]
                        }`}
                      >
                        {clusterLabels[gaveur.cluster]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-blue-600">{gaveur.itm_moyen.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{gaveur.nb_lots}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(100, gaveur.performance_score * 50)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">{gaveur.performance_score.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 flex items-center gap-1 ml-auto">
                        Voir courbe
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Comment ça marche ?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Cliquez sur un gaveur pour générer sa courbe personnalisée</li>
          <li>• La courbe est adaptée selon le profil : cluster, ITM historique, mortalité</li>
          <li>• Vous pouvez visualiser, comparer avec la courbe standard et sauvegarder</li>
          <li>• Les recommandations IA vous guident pour optimiser les résultats</li>
        </ul>
      </div>
    </div>
  );
}
