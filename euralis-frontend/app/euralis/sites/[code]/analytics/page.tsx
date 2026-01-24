'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  TrendingUp,
  Users,
  AlertTriangle,
  Target,
  Brain,
  Sparkles,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { euralisAPI } from '@/lib/euralis/api';

interface Forecast {
  date: string;
  production_kg: number;
  lower_bound: number;
  upper_bound: number;
}

interface GaveurCluster {
  gaveur_id: number;
  nom: string;
  cluster: number;
  performance_score: number;
  itm_moyen: number;
  mortalite: number;
  recommendation: string;
}

interface Anomaly {
  lot_id: number;
  code_lot: string;
  anomaly_score: number;
  is_anomaly: boolean;
  reason: string;
}

interface SiteComparison {
  site_code: string;
  site_nom: string;
  itm_moyen: number;
  mortalite: number;
  production_kg: number;
  rank: number;
}

export default function SiteAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const siteCode = params.code as string;

  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [clusters, setClusters] = useState<GaveurCluster[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [siteComparison, setSiteComparison] = useState<SiteComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'forecasts' | 'gaveurs' | 'anomalies' | 'performance'>('forecasts');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const siteNames: Record<string, string> = {
    'LL': 'Bretagne',
    'LS': 'Pays de Loire',
    'MT': 'Maubourguet'
  };

  useEffect(() => {
    loadAnalytics();
  }, [siteCode]);

  const loadAnalytics = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Charger prévisions filtrées par site
      // TODO: Ajouter paramètre site_code côté backend
      const forecastsData = await euralisAPI.getProductionForecasts(30);
      setForecasts(forecastsData);

      // Charger gaveurs avec performances et clustering du site
      const gaveursPerformances = await euralisAPI.getGaveursPerformances(siteCode);
      setClusters(gaveursPerformances);

      // Charger anomalies du site
      const anomaliesData = await euralisAPI.getAnomalies();
      // Filtrage temporaire côté frontend
      const siteAnomalies = anomaliesData.filter((a: any) =>
        a.is_anomaly && (a.site_code === siteCode || !a.site_code)
      );
      setAnomalies(siteAnomalies);

      // Charger comparaison sites
      const comparisonData = await euralisAPI.compareSites('itm');
      setSiteComparison(comparisonData);

      setLastRefresh(new Date());

    } catch (error) {
      console.error('Erreur chargement analytics site:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadAnalytics(true);
  };

  const currentSiteData = siteComparison.find(s => s.site_code === siteCode);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Brain className="h-12 w-12 animate-pulse text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Analyse des données du site {siteCode}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-3">
            <button
              onClick={() => router.push('/euralis/sites')}
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              Sites
            </button>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <button
              onClick={() => router.push(`/euralis/sites/${siteCode}`)}
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              {siteCode} - {siteNames[siteCode]}
            </button>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900 font-medium">Analytics</span>
          </nav>

          {/* Titre */}
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Brain className="h-8 w-8 text-blue-600" />
            Analytics Site {siteCode} - {siteNames[siteCode]}
          </h1>
          <p className="text-gray-600 mt-2">
            Intelligence artificielle et prévisions pour le site
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/euralis/sites/${siteCode}`)}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
            <span className="font-medium text-gray-700 group-hover:text-blue-600">Retour</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* Dernière actualisation */}
      {lastRefresh && (
        <div className="text-sm text-gray-500">
          Dernière actualisation: {lastRefresh.toLocaleString('fr-FR')}
        </div>
      )}

      {/* KPIs Analytics Site */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Prévision 7j</p>
              <p className="text-3xl font-bold mt-1">
                {forecasts.slice(0, 7).reduce((sum, f) => sum + f.production_kg, 0).toFixed(0)} kg
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-blue-200" />
          </div>
          <p className="text-xs text-blue-100 mt-3">Prophet ML (Site {siteCode})</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Gaveurs Actifs</p>
              <p className="text-3xl font-bold mt-1">
                {new Set(clusters.map(c => c.gaveur_id)).size}
              </p>
            </div>
            <Users className="h-10 w-10 text-green-200" />
          </div>
          <p className="text-xs text-green-100 mt-3">K-Means Clustering</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Anomalies</p>
              <p className="text-3xl font-bold mt-1">{anomalies.length}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-orange-200" />
          </div>
          <p className="text-xs text-orange-100 mt-3">Isolation Forest</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Classement</p>
              <p className="text-3xl font-bold mt-1">
                #{currentSiteData?.rank || '-'}/{siteComparison.length}
              </p>
            </div>
            <Target className="h-10 w-10 text-purple-200" />
          </div>
          <p className="text-xs text-purple-100 mt-3">Performance ITM</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'forecasts', label: 'Prévisions', icon: TrendingUp },
            { id: 'gaveurs', label: 'Gaveurs du Site', icon: Users },
            { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
            { id: 'performance', label: 'Performance vs Sites', icon: Target }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu Tabs */}
      <div className="mt-6">
        {activeTab === 'forecasts' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Prévisions Production Site {siteCode} (30 jours)
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Production Prévue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Intervalle Confiance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {forecasts.slice(0, 10).map((forecast, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(forecast.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-bold text-blue-600">
                          {forecast.production_kg.toFixed(1)} kg
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {forecast.lower_bound && forecast.upper_bound
                          ? `${forecast.lower_bound.toFixed(1)} - ${forecast.upper_bound.toFixed(1)} kg`
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {idx > 0 && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            forecast.production_kg > forecasts[idx - 1].production_kg
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {forecast.production_kg > forecasts[idx - 1].production_kg ? '↗' : '↘'}
                            {Math.abs(forecast.production_kg - forecasts[idx - 1].production_kg).toFixed(1)} kg
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Note:</strong> Ces prévisions sont actuellement globales. Le filtrage par site sera ajouté prochainement via l'API backend.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'gaveurs' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Clustering Gaveurs du Site {siteCode}
            </h3>

            {clusters.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Aucune donnée de clustering disponible pour ce site
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clusters.map(gaveur => (
                  <div
                    key={gaveur.gaveur_id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/euralis/gaveurs/${gaveur.gaveur_id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-gray-900">{gaveur.nom}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        gaveur.cluster === 0 ? 'bg-green-100 text-green-800' :
                        gaveur.cluster === 1 ? 'bg-blue-100 text-blue-800' :
                        gaveur.cluster === 2 ? 'bg-yellow-100 text-yellow-800' :
                        gaveur.cluster === 3 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Cluster {gaveur.cluster + 1}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Performance:</span>
                        <span className="font-medium">{(gaveur.performance_score * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">ITM:</span>
                        <span className="font-medium">{(gaveur.itm_moyen * 1000).toFixed(0)} g/kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mortalité:</span>
                        <span className="font-medium">{gaveur.mortalite != null ? gaveur.mortalite.toFixed(2) : 'N/A'}%</span>
                      </div>
                    </div>

                    {gaveur.recommendation && (
                      <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-800">
                        💡 {gaveur.recommendation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                💡 <strong>Note:</strong> Le filtrage des gaveurs par site sera optimisé côté backend prochainement.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'anomalies' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Lots Anormaux - Site {siteCode}
            </h3>

            {anomalies.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600">Aucune anomalie détectée sur ce site!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {anomalies.map(anomaly => (
                  <div
                    key={anomaly.lot_id}
                    className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/euralis/lots/${anomaly.lot_id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            Lot {anomaly.code_lot}
                          </span>
                          <span className="px-2 py-1 bg-orange-200 text-orange-800 text-xs rounded-full font-medium">
                            Score: {anomaly.anomaly_score.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{anomaly.reason}</p>
                      </div>
                      <button className="ml-4 px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700">
                        Voir Détails
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-800">
                💡 <strong>Modèle:</strong> Isolation Forest détecte automatiquement les lots avec performances atypiques
              </p>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              Performance {siteCode} vs Autres Sites
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classement</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ITM Moyen</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mortalité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Production Totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {siteComparison.map((site, idx) => (
                    <tr
                      key={site.site_code}
                      className={`hover:bg-gray-50 ${site.site_code === siteCode ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                          site.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                          site.rank === 2 ? 'bg-gray-200 text-gray-700' :
                          site.rank === 3 ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {site.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="font-semibold text-gray-900">
                            {site.site_code}
                          </span>
                          <span className="ml-2 text-sm text-gray-600">
                            {site.site_nom}
                          </span>
                          {site.site_code === siteCode && (
                            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              Vous êtes ici
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {site.itm_moyen != null ? site.itm_moyen.toFixed(2) : 'N/A'} kg
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {site.mortalite != null ? site.mortalite.toFixed(2) : 'N/A'}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {site.production_kg != null ? site.production_kg.toLocaleString('fr-FR') : 'N/A'} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {currentSiteData && (
              <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-800">
                  📊 <strong>Votre position:</strong> Le site {siteCode} se classe #{currentSiteData.rank} sur {siteComparison.length} sites Euralis
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Insights Automatiques Site */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Brain className="h-6 w-6" />
          Insights IA - Site {siteCode}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm font-medium mb-2">📈 Tendance Production 7j</p>
            <p className="text-2xl font-bold">
              {forecasts.length > 7
                ? `+${((forecasts[6]?.production_kg - forecasts[0]?.production_kg) / forecasts[0]?.production_kg * 100).toFixed(1)}%`
                : 'N/A'
              }
            </p>
            <p className="text-xs mt-1 text-blue-100">Prévision vs aujourd'hui</p>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm font-medium mb-2">⭐ Meilleur Gaveur</p>
            <p className="text-lg font-bold">
              {clusters.length > 0
                ? clusters.reduce((best, c) => c.performance_score > best.performance_score ? c : best, clusters[0]).nom
                : 'N/A'
              }
            </p>
            <p className="text-xs mt-1 text-blue-100">Plus haute performance du site</p>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm font-medium mb-2">🎯 Objectif Classement</p>
            <p className="text-2xl font-bold">
              {currentSiteData && currentSiteData.rank > 1 ? `→ #${currentSiteData.rank - 1}` : '🏆 #1'}
            </p>
            <p className="text-xs mt-1 text-blue-100">Prochain palier</p>
          </div>
        </div>
      </div>
    </div>
  );
}
