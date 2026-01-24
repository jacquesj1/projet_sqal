'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { euralisAPI } from '@/lib/euralis/api';

interface GaveurPerformance {
  gaveur_id: number;
  gaveur_nom: string;
  site_code: string;
  nb_lots_total: number;
  itm_moyen: number;
  sigma_moyen: number;
  mortalite_moyenne: number;
  cluster_id?: number;
  cluster_label?: string;
  production_totale_kg: number;
}

export default function GaveursPage() {
  const router = useRouter();
  const [gaveurs, setGaveurs] = useState<GaveurPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSite, setFilterSite] = useState<string>('all');
  const [filterCluster, setFilterCluster] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'itm' | 'production' | 'mortalite'>('itm');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Charger données réelles depuis l'API
        const data = await euralisAPI.getGaveursPerformances(
          filterSite === 'all' ? undefined : filterSite,
          filterCluster === 'all' ? undefined : filterCluster
        );
        setGaveurs(data);
      } catch (error) {
        console.error('Erreur chargement gaveurs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filterSite, filterCluster]);

  const getClusterColor = (clusterId?: number) => {
    if (clusterId === undefined) return 'gray';
    const colors = ['green', 'blue', 'yellow', 'orange', 'red'];
    return colors[clusterId] || 'gray';
  };

  const getClusterBgColor = (clusterId?: number) => {
    if (clusterId === undefined) return 'bg-gray-100';
    const colors = [
      'bg-green-100',
      'bg-blue-100',
      'bg-yellow-100',
      'bg-orange-100',
      'bg-red-100',
    ];
    return colors[clusterId] || 'bg-gray-100';
  };

  const getClusterTextColor = (clusterId?: number) => {
    if (clusterId === undefined) return 'text-gray-800';
    const colors = [
      'text-green-800',
      'text-blue-800',
      'text-yellow-800',
      'text-orange-800',
      'text-red-800',
    ];
    return colors[clusterId] || 'text-gray-800';
  };

  const filteredGaveurs = gaveurs
    .filter((g) => filterSite === 'all' || g.site_code === filterSite)
    .filter((g) => filterCluster === 'all' || g.cluster_label === filterCluster)
    .sort((a, b) => {
      if (sortBy === 'itm') return b.itm_moyen - a.itm_moyen;
      if (sortBy === 'production') return b.production_totale_kg - a.production_totale_kg;
      if (sortBy === 'mortalite') return a.mortalite_moyenne - b.mortalite_moyenne;
      return 0;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Chargement des gaveurs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gaveurs - Analytics & Clustering</h1>
        <p className="text-gray-600 mt-1">
          Analyse des performances et segmentation K-Means en 5 groupes
        </p>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Total Gaveurs</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{gaveurs.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">ITM Moyen Global</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {(gaveurs.reduce((sum, g) => sum + g.itm_moyen, 0) / gaveurs.length).toFixed(2)} kg
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Production Totale</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {(gaveurs.reduce((sum, g) => sum + g.production_totale_kg, 0) / 1000).toFixed(1)} t
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Mortalité Moyenne</div>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {(gaveurs.reduce((sum, g) => sum + g.mortalite_moyenne, 0) / gaveurs.length).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Site</label>
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les sites</option>
              <option value="LL">LL - Bretagne</option>
              <option value="LS">LS - Pays de Loire</option>
              <option value="MT">MT - Maubourguet</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cluster</label>
            <select
              value={filterCluster}
              onChange={(e) => setFilterCluster(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les clusters</option>
              <option value="Excellent">Excellent</option>
              <option value="Très bon">Très bon</option>
              <option value="Bon">Bon</option>
              <option value="À surveiller">À surveiller</option>
              <option value="Critique">Critique</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Trier par</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="itm">ITM (décroissant)</option>
              <option value="production">Production (décroissant)</option>
              <option value="mortalite">Mortalité (croissant)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Distribution des clusters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Distribution des Clusters K-Means</h2>
        <div className="grid grid-cols-5 gap-4">
          {['Excellent', 'Très bon', 'Bon', 'À surveiller', 'Critique'].map((label, idx) => {
            const count = gaveurs.filter((g) => g.cluster_label === label).length;
            const pct = ((count / gaveurs.length) * 100).toFixed(0);
            return (
              <div
                key={label}
                className={`${getClusterBgColor(idx)} rounded-lg p-4 text-center`}
              >
                <div className={`text-sm font-medium ${getClusterTextColor(idx)}`}>{label}</div>
                <div className={`text-3xl font-bold mt-2 ${getClusterTextColor(idx)}`}>
                  {count}
                </div>
                <div className={`text-xs mt-1 ${getClusterTextColor(idx)}`}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tableau des gaveurs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            Gaveurs ({filteredGaveurs.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gaveur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cluster
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lots
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ITM Moyen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sigma
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mortalité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Production
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGaveurs.map((gaveur) => (
                <tr key={gaveur.gaveur_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/euralis/gaveurs/${gaveur.gaveur_id}`)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{gaveur.gaveur_nom}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {gaveur.site_code}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getClusterBgColor(
                        gaveur.cluster_id
                      )} ${getClusterTextColor(gaveur.cluster_id)}`}
                    >
                      {gaveur.cluster_label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {gaveur.nb_lots_total}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                    {gaveur.itm_moyen.toFixed(2)} kg
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {gaveur.sigma_moyen.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`text-sm font-semibold ${
                        gaveur.mortalite_moyenne < 3
                          ? 'text-green-600'
                          : gaveur.mortalite_moyenne < 5
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {gaveur.mortalite_moyenne.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    {(gaveur.production_totale_kg / 1000).toFixed(1)} t
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/euralis/gaveurs/${gaveur.gaveur_id}`)}
                        className="text-blue-600 hover:text-blue-900 font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profil
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => router.push(`/euralis/gaveurs/${gaveur.gaveur_id}/analytics`)}
                        className="text-purple-600 hover:text-purple-900 font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Analytics
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Informations K-Means */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Clustering K-Means</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Les gaveurs sont segmentés en 5 groupes basés sur leurs performances (ITM, Sigma,
                Mortalité, Stabilité). Cette segmentation permet d'identifier les meilleures
                pratiques et les gaveurs nécessitant un accompagnement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
