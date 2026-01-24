'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { euralisAPI } from '@/lib/euralis/api';
import {
  ArrowLeft,
  TrendingUp,
  Users,
  Lightbulb,
  Target,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Award,
  BarChart3,
} from 'lucide-react';

interface GaveurAnalytics {
  gaveur_id: number;
  gaveur_nom: string;
  site_code: string;
  nb_lots_total: number;
  itm_moyen: number;
  sigma_moyen: number;
  mortalite_moyenne: number;
  production_totale_kg: number;
  cluster_id: number | null;
  cluster_label: string | null;
  itm_site_moyen: number | null;
  itm_euralis_moyen: number | null;
  rang_site: number | null;
  total_gaveurs_site: number | null;
  rang_euralis: number | null;
  total_gaveurs_euralis: number | null;
  evolution_itm_7j: Array<{ jour: string; itm: number }>;
}

type TabId = 'performance' | 'cluster' | 'recommandations' | 'previsions';

export default function GaveurAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const gaveurId = parseInt(params.id as string);

  const [analytics, setAnalytics] = useState<GaveurAnalytics | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('performance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const siteNames: Record<string, string> = {
    LL: 'Bretagne',
    LS: 'Pays de Loire',
    MT: 'Maubourguet',
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await euralisAPI.getGaveurAnalytics(gaveurId);
        setAnalytics(data);
      } catch (err) {
        console.error('Erreur chargement analytics:', err);
        setError('Impossible de charger les analytics du gaveur');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gaveurId]);

  const getClusterColor = (clusterId: number | null) => {
    if (clusterId === null) return 'gray';
    const colors = ['green', 'blue', 'yellow', 'orange', 'red'];
    return colors[clusterId] || 'gray';
  };

  const getClusterBgColor = (clusterId: number | null) => {
    if (clusterId === null) return 'bg-gray-100';
    const colors = [
      'bg-green-100',
      'bg-blue-100',
      'bg-yellow-100',
      'bg-orange-100',
      'bg-red-100',
    ];
    return colors[clusterId] || 'bg-gray-100';
  };

  const getClusterTextColor = (clusterId: number | null) => {
    if (clusterId === null) return 'text-gray-800';
    const colors = [
      'text-green-800',
      'text-blue-800',
      'text-yellow-800',
      'text-orange-800',
      'text-red-800',
    ];
    return colors[clusterId] || 'text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Chargement des analytics...</div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">{error || 'Analytics non disponibles'}</div>
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

  const tabs = [
    { id: 'performance' as TabId, label: 'Performance', icon: TrendingUp },
    { id: 'cluster' as TabId, label: 'Profil & Cluster', icon: Users },
    { id: 'recommandations' as TabId, label: 'Recommandations IA', icon: Lightbulb },
    { id: 'previsions' as TabId, label: 'Prévisions', icon: Target },
  ];

  // Calculs pour les KPIs
  const diffSite = analytics.itm_site_moyen
    ? analytics.itm_moyen - analytics.itm_site_moyen
    : 0;
  const diffEuralis = analytics.itm_euralis_moyen
    ? analytics.itm_moyen - analytics.itm_euralis_moyen
    : 0;

  return (
    <div className="space-y-6">
      {/* Header + Breadcrumb */}
      <div>
        <nav className="flex items-center gap-2 text-sm mb-3">
          <button
            onClick={() => router.push('/euralis/gaveurs')}
            className="text-gray-600 hover:text-blue-600 transition-colors"
          >
            Gaveurs
          </button>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <button
            onClick={() => router.push(`/euralis/gaveurs/${gaveurId}`)}
            className="text-gray-600 hover:text-blue-600 transition-colors"
          >
            {analytics.gaveur_nom}
          </button>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium">Analytics IA</span>
        </nav>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Analytics IA - {analytics.gaveur_nom}
            </h1>
            <p className="text-gray-600 mt-1">
              {analytics.site_code} - {siteNames[analytics.site_code]} • {analytics.nb_lots_total}{' '}
              lots total
            </p>
          </div>
          <button
            onClick={() => router.push(`/euralis/gaveurs/${gaveurId}`)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au profil
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">ITM Moyen</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {analytics.itm_moyen.toFixed(2)} kg
          </div>
          <div className="flex items-center gap-1 mt-2 text-sm">
            {diffSite >= 0 ? (
              <ArrowUp className="w-4 h-4 text-green-600" />
            ) : (
              <ArrowDown className="w-4 h-4 text-red-600" />
            )}
            <span className={diffSite >= 0 ? 'text-green-600' : 'text-red-600'}>
              {diffSite >= 0 ? '+' : ''}
              {diffSite.toFixed(2)} kg vs site
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Rang Site</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {analytics.rang_site || '-'}/{analytics.total_gaveurs_site || '-'}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Position sur le site {analytics.site_code}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Rang Euralis</div>
          <div className="text-3xl font-bold text-purple-600 mt-2">
            {analytics.rang_euralis || '-'}/{analytics.total_gaveurs_euralis || '-'}
          </div>
          <div className="text-xs text-gray-500 mt-2">Position globale</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Cluster</div>
          <div className="mt-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${getClusterBgColor(
                analytics.cluster_id
              )} ${getClusterTextColor(analytics.cluster_id)}`}
            >
              {analytics.cluster_label || 'N/A'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-2">Segmentation K-Means</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* TAB 1: Performance */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Globale</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Comparaison ITM */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">ITM - Comparaison</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">Votre ITM</span>
                        <span className="font-semibold text-blue-600">
                          {analytics.itm_moyen.toFixed(2)} kg
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min((analytics.itm_moyen / 20) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">Moyenne Site {analytics.site_code}</span>
                        <span className="font-semibold text-gray-700">
                          {analytics.itm_site_moyen?.toFixed(2) || 'N/A'} kg
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gray-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min(((analytics.itm_site_moyen || 0) / 20) * 100, 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">Moyenne Euralis</span>
                        <span className="font-semibold text-gray-700">
                          {analytics.itm_euralis_moyen?.toFixed(2) || 'N/A'} kg
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gray-400 h-2 rounded-full"
                          style={{
                            width: `${Math.min(((analytics.itm_euralis_moyen || 0) / 20) * 100, 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Autres Métriques */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Autres Métriques</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Sigma Moyen</span>
                      <span className="font-semibold text-gray-900">
                        {analytics.sigma_moyen.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Mortalité Moyenne</span>
                      <span
                        className={`font-semibold ${
                          analytics.mortalite_moyenne < 3
                            ? 'text-green-600'
                            : analytics.mortalite_moyenne < 5
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {analytics.mortalite_moyenne.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Production Totale</span>
                      <span className="font-semibold text-green-600">
                        {(analytics.production_totale_kg / 1000).toFixed(2)} t
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Nombre de Lots</span>
                      <span className="font-semibold text-gray-900">{analytics.nb_lots_total}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Evolution 7 jours */}
            {analytics.evolution_itm_7j.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Évolution ITM (7 derniers jours)
                </h3>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="space-y-2">
                    {analytics.evolution_itm_7j.map((point, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          {new Date(point.jour).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="font-semibold text-blue-600">{point.itm.toFixed(2)} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Cluster */}
        {activeTab === 'cluster' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Profil & Cluster K-Means</h2>
              <div
                className={`border-2 rounded-lg p-6 ${
                  analytics.cluster_id !== null
                    ? `border-${getClusterColor(analytics.cluster_id)}-300`
                    : 'border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Award
                    className={`w-12 h-12 ${
                      analytics.cluster_id !== null
                        ? `text-${getClusterColor(analytics.cluster_id)}-600`
                        : 'text-gray-600'
                    }`}
                  />
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      Cluster: {analytics.cluster_label || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">Segmentation automatique K-Means (5 clusters)</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Caractéristiques de votre cluster
                  </h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    {analytics.cluster_id === 0 && (
                      <>
                        <p>✅ Performance exceptionnelle (ITM ≥ 16 kg)</p>
                        <p>✅ Stabilité excellente</p>
                        <p>✅ Mortalité très faible</p>
                      </>
                    )}
                    {analytics.cluster_id === 1 && (
                      <>
                        <p>✅ Très bonne performance (ITM ≥ 15 kg)</p>
                        <p>✅ Stabilité élevée</p>
                        <p>✅ Mortalité contrôlée</p>
                      </>
                    )}
                    {analytics.cluster_id === 2 && (
                      <>
                        <p>✅ Bonne performance (ITM ≥ 14 kg)</p>
                        <p>⚠️ Potentiel d'amélioration</p>
                      </>
                    )}
                    {analytics.cluster_id === 3 && (
                      <>
                        <p>⚠️ Performance à surveiller (ITM ≥ 13 kg)</p>
                        <p>⚠️ Besoin d'accompagnement</p>
                      </>
                    )}
                    {analytics.cluster_id === 4 && (
                      <>
                        <p>❌ Performance critique (ITM &lt; 13 kg)</p>
                        <p>❌ Nécessite intervention urgente</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recommandations pour passer au cluster supérieur */}
            {analytics.cluster_id !== null && analytics.cluster_id > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-900 mb-2">
                      Pour passer au cluster supérieur
                    </h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Augmenter l'ITM moyen de{' '}
                        {analytics.cluster_id === 4 ? '1' : analytics.cluster_id === 3 ? '1' : '1'} kg
                      </li>
                      <li>• Améliorer la stabilité (réduire sigma)</li>
                      <li>• Réduire le taux de mortalité</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Recommandations IA */}
        {activeTab === 'recommandations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recommandations IA</h2>
              <div className="space-y-4">
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-blue-900">Courbes de gavage optimales (PySR)</h3>
                      <p className="text-sm text-blue-800 mt-1">
                        Optimisation symbolique en cours d'analyse. Les courbes optimales seront
                        disponibles prochainement basées sur vos historiques de lots.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-green-900">
                        Doses recommandées (Feedback Optimizer)
                      </h3>
                      <p className="text-sm text-green-800 mt-1">
                        Analyse des retours consommateurs pour optimiser la qualité du produit final.
                        Corrélations production ↔ satisfaction en cours de calcul.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Target className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-purple-900">Axes d'amélioration personnalisés</h3>
                      <p className="text-sm text-purple-800 mt-1">
                        Benchmark vs top performers de votre cluster. Analyse des écarts et
                        recommandations spécifiques à venir.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <strong>Note:</strong> Les recommandations IA seront enrichies au fil du temps avec
                l'accumulation de données et l'apprentissage des modèles ML.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: Prévisions */}
        {activeTab === 'previsions' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Prévisions 7 Jours (Prophet ML)
              </h2>
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="text-center py-8">
                  <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Prévisions individuelles en développement
                  </h3>
                  <p className="text-gray-600 max-w-2xl mx-auto">
                    Les prévisions Prophet ML au niveau gaveur individuel nécessitent un historique
                    minimum de 30 jours de données. Cette fonctionnalité sera activée dès que
                    suffisamment de données seront disponibles pour votre profil.
                  </p>
                  <div className="mt-6 space-y-3 text-left max-w-xl mx-auto">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-700">Prévision ITM 7 jours</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-gray-700">Prévision production 7 jours</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-gray-700">Alertes préventives (risque mortalité)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
