'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { euralisAPI } from '@/lib/euralis/api';
import { Brain, Users, Package, Home, BarChart3, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface SiteStats {
  site_code: string;
  site_nom: string;
  nb_lots: number;
  nb_lots_actifs: number;
  nb_gaveurs: number;
  itm_moyen: number;
  mortalite_moyenne: number;
  production_totale_kg: number;
  derniere_maj: string;
}

interface Lot {
  id: number;
  code_lot: string;
  gaveur_id: number;
  debut_lot: string;
  statut: string;
  itm: number | null;
  duree_gavage_reelle: number | null;
}

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const siteCode = params.code as string;

  const [stats, setStats] = useState<SiteStats | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [statutData, setStatutData] = useState<any[]>([]);

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

        // Charger stats du site
        const statsData = await euralisAPI.getSiteStats(siteCode);
        setStats(statsData);

        // Charger lots récents pour affichage
        const lotsRecents = await euralisAPI.getSiteLots(siteCode, undefined, 10);
        setLots(lotsRecents);

        // Charger plus de lots pour graphiques
        const lotsAll = await euralisAPI.getSiteLots(siteCode, undefined, 100);

        // Préparer données pour graphiques
        prepareChartData(lotsAll);

      } catch (err) {
        console.error('Erreur chargement site:', err);
        setError('Impossible de charger les données du site');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [siteCode]);

  const prepareChartData = (lotsData: Lot[]) => {
    // Grouper par mois pour évolution temporelle
    const monthlyData = new Map<string, { itm: number[], mortalite: number[], count: number }>();

    lotsData.forEach((lot) => {
      if (lot.debut_lot) {
        const date = new Date(lot.debut_lot);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, { itm: [], mortalite: [], count: 0 });
        }

        const entry = monthlyData.get(monthKey)!;
        if (lot.itm) entry.itm.push(lot.itm);
        entry.count++;
      }
    });

    // Convertir en tableau pour graphiques
    const chartArray = Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        mois: month,
        itmMoyen: data.itm.length > 0 ? data.itm.reduce((a, b) => a + b, 0) / data.itm.length : 0,
        nbLots: data.count,
      }))
      .sort((a, b) => a.mois.localeCompare(b.mois))
      .slice(-6); // Derniers 6 mois

    setChartData(chartArray);

    // Préparer répartition par statut
    const statutCounts = new Map<string, number>();
    lotsData.forEach((lot) => {
      const statut = lot.statut || 'inconnu';
      statutCounts.set(statut, (statutCounts.get(statut) || 0) + 1);
    });

    const statutArray = Array.from(statutCounts.entries()).map(([statut, count]) => ({
      name: statut,
      value: count,
    }));

    setStatutData(statutArray);
  };

  const isActive = (path: string) => pathname === path;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Chargement des données du site...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">{error || 'Site non trouvé'}</div>
          <button
            onClick={() => router.push('/euralis/sites')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retour aux sites
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
            onClick={() => router.push('/euralis/sites')}
            className="text-gray-600 hover:text-blue-600 transition-colors"
          >
            Sites
          </button>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium">
            {siteCode} - {siteNames[siteCode]}
          </span>
        </nav>

        {/* Titre */}
        <h1 className="text-3xl font-bold text-gray-900">
          Site {siteCode} - {siteNames[siteCode]}
        </h1>
        <p className="text-gray-600 mt-1">
          {stats.nb_gaveurs} gaveurs actifs - {stats.nb_lots} lots total
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => router.push(`/euralis/sites/${siteCode}`)}
            className={`
              flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${isActive(`/euralis/sites/${siteCode}`)
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <Home className="h-5 w-5" />
            Vue d'ensemble
          </button>
          <button
            onClick={() => router.push(`/euralis/sites/${siteCode}/gaveurs`)}
            className={`
              flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${isActive(`/euralis/sites/${siteCode}/gaveurs`)
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <Users className="h-5 w-5" />
            Gaveurs
          </button>
          <button
            onClick={() => router.push(`/euralis/sites/${siteCode}/lots`)}
            className={`
              flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${isActive(`/euralis/sites/${siteCode}/lots`)
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <Package className="h-5 w-5" />
            Lots
          </button>
          <button
            onClick={() => router.push(`/euralis/sites/${siteCode}/analytics`)}
            className={`
              flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${isActive(`/euralis/sites/${siteCode}/analytics`)
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <Brain className="h-5 w-5" />
            Analytics
          </button>
        </nav>
      </div>

      {/* KPIs Site */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Lots Actifs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.nb_lots_actifs}</p>
            </div>
            <Package className="h-10 w-10 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {stats.nb_lots} lots total
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ITM Moyen</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.itm_moyen.toFixed(2)}
              </p>
            </div>
            <BarChart3 className="h-10 w-10 text-green-500" />
          </div>
          <p className="text-xs text-gray-500 mt-3">kg</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Mortalité</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.mortalite_moyenne.toFixed(1)}%
              </p>
            </div>
            <svg className="h-10 w-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-3">Taux moyen</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Production</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {(stats.production_totale_kg / 1000).toFixed(1)}
              </p>
            </div>
            <svg className="h-10 w-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-3">Tonnes</p>
        </div>
      </div>

      {/* Graphiques d'évolution */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique ITM Moyen */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Évolution ITM Moyen</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="mois"
                  tickFormatter={(value) => {
                    const [year, month] = value.split('-');
                    return `${month}/${year.slice(2)}`;
                  }}
                />
                <YAxis
                  label={{ value: 'ITM (kg)', angle: -90, position: 'insideLeft' }}
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)} kg`}
                  labelFormatter={(label) => `Mois: ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="itmMoyen"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="ITM Moyen"
                  dot={{ fill: '#10b981', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Évolution sur les 6 derniers mois
            </p>
          </div>

          {/* Graphique Nombre de Lots */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Activité Mensuelle</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="mois"
                  tickFormatter={(value) => {
                    const [year, month] = value.split('-');
                    return `${month}/${year.slice(2)}`;
                  }}
                />
                <YAxis label={{ value: 'Nombre de lots', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value: number) => `${value} lots`}
                  labelFormatter={(label) => `Mois: ${label}`}
                />
                <Legend />
                <Bar dataKey="nbLots" fill="#3b82f6" name="Nombre de lots" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Nombre de lots démarrés par mois
            </p>
          </div>
        </div>
      )}

      {/* Répartition par Statut */}
      {statutData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Répartition des Lots par Statut</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statutData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statutData.map((entry, index) => {
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center">
              <h3 className="font-semibold text-gray-700 mb-3">Détails:</h3>
              <div className="space-y-2">
                {statutData.map((item, index) => {
                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                  return (
                    <div key={item.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: colors[index % colors.length] }}
                        />
                        <span className="text-sm font-medium text-gray-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{item.value} lots</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded">
                <p className="text-xs text-blue-800">
                  <strong>Total:</strong> {statutData.reduce((sum, item) => sum + item.value, 0)} lots
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lots Récents */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Lots Récents</h2>
          <button
            onClick={() => router.push(`/euralis/sites/${siteCode}/lots`)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Voir tous les lots →
          </button>
        </div>

        {lots.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucun lot trouvé pour ce site
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code Lot</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gaveur ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Début</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ITM</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Gaveur #{lot.gaveur_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lot.debut_lot ? new Date(lot.debut_lot).toLocaleDateString('fr-FR') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lot.itm ? `${lot.itm.toFixed(2)} kg` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        lot.statut === 'en_cours' || lot.statut === 'en_gavage'
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

      {/* Actions Rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push(`/euralis/sites/${siteCode}/gaveurs`)}
          className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border-2 border-gray-200 hover:border-orange-500 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-orange-600" />
            <div className="text-left">
              <p className="font-semibold text-gray-900">Gaveurs</p>
              <p className="text-sm text-gray-600">{stats.nb_gaveurs} actifs</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={() => router.push(`/euralis/sites/${siteCode}/lots`)}
          className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border-2 border-gray-200 hover:border-blue-500 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="text-left">
              <p className="font-semibold text-gray-900">Lots</p>
              <p className="text-sm text-gray-600">{stats.nb_lots} total</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={() => router.push(`/euralis/sites/${siteCode}/analytics`)}
          className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-md hover:shadow-lg transition-all group text-white"
        >
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8" />
            <div className="text-left">
              <p className="font-semibold">Analytics IA</p>
              <p className="text-sm text-blue-100">Prévisions & insights</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
