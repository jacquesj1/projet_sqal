'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft,
  TrendingUp,
  Activity,
  Shield,
  AlertTriangle,
  Camera,
  Edit,
} from 'lucide-react';
import { canardApi, gavageApi, analyticsApi, blockchainApi } from '@/lib/api';
import {
  formatDate,
  formatDateTime,
  getStatutColor,
  getStatutLabel,
  getGenetiqueEmoji,
  getScoreColor,
} from '@/lib/utils';
import type { Canard, GavageData, PerformanceMetrics } from '@/lib/types';

export default function CanardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const canardId = parseInt(params.id as string);

  const [canard, setCanard] = useState<Canard | null>(null);
  const [gavages, setGavages] = useState<GavageData[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'info' | 'gavages' | 'analytics' | 'blockchain'>(
    'info'
  );

  useEffect(() => {
    loadData();
  }, [canardId]);

  const loadData = async () => {
    try {
      const [canardData, gavagesData, metricsData] = await Promise.all([
        canardApi.getById(canardId),
        gavageApi.getByCanard(canardId),
        analyticsApi.getMetrics(canardId).catch(() => null),
      ]);

      setCanard(canardData as Canard);
      setGavages(gavagesData as GavageData[]);
      setMetrics(metricsData as PerformanceMetrics | null);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!canard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">Canard non trouvé</p>
          <Link href="/canards" className="text-blue-600 hover:underline mt-4 block">
            Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  const chartData = gavages.map((g) => ({
    date: formatDate(g.time),
    poids_matin: g.poids_matin,
    poids_soir: g.poids_soir,
    dose_totale: g.dose_matin + g.dose_soir,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{getGenetiqueEmoji(canard.genetique)}</span>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  {canard.numero_identification}
                </h1>
                <p className="text-gray-600">
                  {canard.genetique} - {canard.origine}
                </p>
              </div>
              <span
                className={`px-4 py-2 rounded-full font-bold ${getStatutColor(canard.statut)}`}
              >
                {getStatutLabel(canard.statut)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/photos/upload?canard_id=${canard.id}`}
              className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Camera size={20} />
            </Link>
            <button className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Edit size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'info', label: 'Informations', icon: Activity },
            { id: 'gavages', label: 'Gavages', icon: TrendingUp },
            { id: 'analytics', label: 'Analytics', icon: Activity },
            { id: 'blockchain', label: 'Blockchain', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as typeof selectedTab)}
                className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap ${
                  selectedTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {selectedTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Informations Générales</h2>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">N° Identification</span>
                  <span className="font-medium">{canard.numero_identification}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Génétique</span>
                  <span className="font-medium">{canard.genetique}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Origine</span>
                  <span className="font-medium">{canard.origine}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">N° Lot</span>
                  <span className="font-medium">{canard.numero_lot_canard}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Date de naissance</span>
                  <span className="font-medium">{formatDate(canard.date_naissance)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Créé le</span>
                  <span className="font-medium">{formatDate(canard.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Données de Poids</h2>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600">Poids Initial</p>
                  <p className="text-3xl font-bold text-blue-700">{canard.poids_initial}g</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600">Poids Actuel</p>
                  <p className="text-3xl font-bold text-green-700">
                    {canard.poids_actuel || canard.poids_initial}g
                  </p>
                </div>
                {canard.poids_actuel && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-purple-600">Gain Total</p>
                    <p className="text-3xl font-bold text-purple-700">
                      +{canard.poids_actuel - canard.poids_initial}g
                    </p>
                    <p className="text-sm text-purple-500">
                      {(
                        ((canard.poids_actuel - canard.poids_initial) / canard.poids_initial) *
                        100
                      ).toFixed(1)}
                      % de croissance
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Métriques Performance */}
            {metrics && (
              <div className="bg-white rounded-lg shadow-lg p-6 md:col-span-2">
                <h2 className="text-xl font-bold mb-4">Métriques de Performance</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Score Global</p>
                    <p className={`text-4xl font-bold ${getScoreColor(metrics.score_performance)}`}>
                      {metrics.score_performance.toFixed(0)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Indice Conso</p>
                    <p className="text-4xl font-bold text-blue-600">
                      {metrics.indice_consommation.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Gain/Jour</p>
                    <p className="text-4xl font-bold text-green-600">
                      {metrics.gain_moyen_journalier.toFixed(0)}g
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Poids Final Prédit</p>
                    <p className="text-4xl font-bold text-purple-600">
                      {metrics.poids_final_predit.toFixed(0)}g
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'gavages' && (
          <div className="space-y-6">
            {/* Graphique */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Évolution du Poids</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="poids_matin"
                      stroke="#3b82f6"
                      name="Poids Matin"
                    />
                    <Line
                      type="monotone"
                      dataKey="poids_soir"
                      stroke="#10b981"
                      name="Poids Soir"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Liste gavages */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Historique des Gavages</h2>
              {gavages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun gavage enregistré</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-right">Dose Matin</th>
                        <th className="p-3 text-right">Dose Soir</th>
                        <th className="p-3 text-right">Poids Matin</th>
                        <th className="p-3 text-right">Poids Soir</th>
                        <th className="p-3 text-right">Gain</th>
                        <th className="p-3 text-right">Temp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gavages.map((gavage) => (
                        <tr key={gavage.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">{formatDateTime(gavage.time)}</td>
                          <td className="p-3 text-right">{gavage.dose_matin}g</td>
                          <td className="p-3 text-right">{gavage.dose_soir}g</td>
                          <td className="p-3 text-right">{gavage.poids_matin || '-'}g</td>
                          <td className="p-3 text-right">{gavage.poids_soir || '-'}g</td>
                          <td className="p-3 text-right text-green-600 font-medium">
                            {gavage.gain_poids ? `+${gavage.gain_poids}g` : '-'}
                          </td>
                          <td className="p-3 text-right">{gavage.temperature_stabule}°C</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'analytics' && metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Scores Détaillés</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Score Global</span>
                    <span className={`font-bold ${getScoreColor(metrics.score_performance)}`}>
                      {metrics.score_performance.toFixed(0)}/100
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full"
                      style={{ width: `${metrics.score_performance}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Score IC</span>
                    <span className={`font-bold ${getScoreColor(metrics.score_ic)}`}>
                      {metrics.score_ic.toFixed(0)}/100
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full"
                      style={{ width: `${metrics.score_ic}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Score Gain</span>
                    <span className={`font-bold ${getScoreColor(metrics.score_gain)}`}>
                      {metrics.score_gain.toFixed(0)}/100
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-purple-600 h-3 rounded-full"
                      style={{ width: `${metrics.score_gain}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Score Régularité</span>
                    <span className={`font-bold ${getScoreColor(metrics.score_regularite)}`}>
                      {metrics.score_regularite.toFixed(0)}/100
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-orange-600 h-3 rounded-full"
                      style={{ width: `${metrics.score_regularite}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Statistiques</h2>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Durée gavage</span>
                  <span className="font-medium">{metrics.duree_gavage_jours} jours</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Nombre de gavages</span>
                  <span className="font-medium">{metrics.nb_gavages}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Gain total</span>
                  <span className="font-medium text-green-600">
                    +{metrics.gain_total_grammes}g
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Dose totale maïs</span>
                  <span className="font-medium">{metrics.dose_totale_kg.toFixed(2)}kg</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Taux croissance</span>
                  <span className="font-medium">
                    {metrics.taux_croissance_g_par_jour.toFixed(1)}g/jour
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'blockchain' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Traçabilité Blockchain</h2>
            <div className="text-center py-8">
              <Shield className="mx-auto text-blue-600 mb-4" size={64} />
              <p className="text-gray-600 mb-4">
                Consultez l&apos;historique complet de ce canard sur la blockchain
              </p>
              <Link
                href={`/blockchain?canard=${canard.id}`}
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
              >
                Voir sur Blockchain Explorer
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
