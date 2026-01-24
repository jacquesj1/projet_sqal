'use client';

import { useState, useEffect } from 'react';
import { euralisAPI } from '@/lib/euralis/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface Prevision {
  date: string;
  production_prevue_kg: number;
  production_min_kg: number;
  production_max_kg: number;
  itm_prevu: number;
  itm_min: number;
  itm_max: number;
}

export default function PrevisionsPage() {
  const [horizon, setHorizon] = useState<7 | 30 | 90>(30);
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [previsions, setPrevisions] = useState<Prevision[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPrevisions = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        if (selectedSite === 'ALL') {
          // Fetch all 3 sites and aggregate
          const [llData, lsData, mtData] = await Promise.all([
            fetch(`${apiUrl}/api/euralis/ml/forecasts?days=${horizon}&site_code=LL`).then(r => r.json()),
            fetch(`${apiUrl}/api/euralis/ml/forecasts?days=${horizon}&site_code=LS`).then(r => r.json()),
            fetch(`${apiUrl}/api/euralis/ml/forecasts?days=${horizon}&site_code=MT`).then(r => r.json()),
          ]);

          // Aggregate by date
          const dateMap = new Map();
          [...llData, ...lsData, ...mtData].forEach((item: any) => {
            if (!dateMap.has(item.date)) {
              dateMap.set(item.date, {
                date: item.date,
                production_prevue_kg: 0,
                production_min_kg: 0,
                production_max_kg: 0,
                itm_prevu: 0,
                itm_min: 0,
                itm_max: 0,
                count: 0
              });
            }
            const entry = dateMap.get(item.date);
            entry.production_prevue_kg += item.production_kg;
            entry.production_min_kg += item.lower_bound;
            entry.production_max_kg += item.upper_bound;
            entry.count += 1;
          });

          const aggregated = Array.from(dateMap.values()).map((entry: any) => ({
            date: entry.date,
            production_prevue_kg: entry.production_prevue_kg,
            production_min_kg: entry.production_min_kg,
            production_max_kg: entry.production_max_kg,
            itm_prevu: 15,  // Placeholder
            itm_min: 14,
            itm_max: 16,
          }));

          setPrevisions(aggregated);
        } else {
          // Single site
          const data = await fetch(`${apiUrl}/api/euralis/ml/forecasts?days=${horizon}&site_code=${selectedSite}`).then(r => r.json());

          const formatted = data.map((item: any) => ({
            date: item.date,
            production_prevue_kg: item.production_kg,
            production_min_kg: item.lower_bound,
            production_max_kg: item.upper_bound,
            itm_prevu: 15,  // Placeholder
            itm_min: 14,
            itm_max: 16,
          }));

          setPrevisions(formatted);
        }
      } catch (error) {
        console.error('Erreur chargement prévisions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrevisions();
  }, [horizon, selectedSite]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Prévisions Production</h1>
        <p className="text-gray-600 mt-1">
          Prévisions Prophet à 7, 30 et 90 jours - Vue unifiée 3 sites disponible
        </p>
      </div>

      {/* Contrôles */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Horizon de prévision
            </label>
            <div className="flex gap-2">
              {[7, 30, 90].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h as 7 | 30 | 90)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    horizon === h
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {h} jours
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Site</label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">🌍 Tous les Sites (Vue Unifiée)</option>
              <option value="LL">LL - Bretagne</option>
              <option value="LS">LS - Pays de Loire</option>
              <option value="MT">MT - Maubourguet</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPIs Prévisions */}
      {!loading && previsions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-sm text-gray-600">Production Totale Prévue</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">
              {(
                previsions.reduce((sum, p) => sum + p.production_prevue_kg, 0) / 1000
              ).toFixed(1)}{' '}
              t
            </div>
            <div className="text-xs text-gray-500 mt-1">
              sur les {horizon} prochains jours{selectedSite === 'ALL' && ' (3 sites)'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-sm text-gray-600">ITM Moyen Prévu</div>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {(previsions.reduce((sum, p) => sum + p.itm_prevu, 0) / previsions.length).toFixed(
                2
              )}{' '}
              kg
            </div>
            <div className="text-xs text-gray-500 mt-1">moyenne sur {horizon} jours</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-sm text-gray-600">Intervalle de Confiance</div>
            <div className="text-3xl font-bold text-orange-600 mt-2">95%</div>
            <div className="text-xs text-gray-500 mt-1">Prophet time series</div>
          </div>
        </div>
      )}

      {/* Graphique Production */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Prévision Production Journalière</h2>
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="text-gray-500">Chargement des prévisions...</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={previsions}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis label={{ value: 'Production (kg)', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(0)} kg`}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString('fr-FR');
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="production_max_kg"
                stackId="1"
                stroke="#3B82F6"
                fill="#BFDBFE"
                fillOpacity={0.3}
                name="Max (95%)"
              />
              <Area
                type="monotone"
                dataKey="production_prevue_kg"
                stackId="2"
                stroke="#2563EB"
                fill="#3B82F6"
                fillOpacity={0.6}
                name="Prévision"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="production_min_kg"
                stackId="3"
                stroke="#1D4ED8"
                fill="#BFDBFE"
                fillOpacity={0.3}
                name="Min (95%)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Graphique ITM */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Prévision ITM Moyen</h2>
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="text-gray-500">Chargement des prévisions...</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={previsions}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis
                domain={[13, 17]}
                label={{ value: 'ITM (kg)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(2)} kg`}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString('fr-FR');
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="itm_max"
                stroke="#10B981"
                strokeDasharray="3 3"
                dot={false}
                name="Max (95%)"
              />
              <Line
                type="monotone"
                dataKey="itm_prevu"
                stroke="#059669"
                strokeWidth={3}
                dot={false}
                name="ITM Prévu"
              />
              <Line
                type="monotone"
                dataKey="itm_min"
                stroke="#047857"
                strokeDasharray="3 3"
                dot={false}
                name="Min (95%)"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tableau détaillé */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Détail des Prévisions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Production Prévue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Intervalle (95%)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ITM Prévu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ITM Intervalle
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {previsions.slice(0, 10).map((prev) => (
                <tr key={prev.date} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {new Date(prev.date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                    {prev.production_prevue_kg.toFixed(0)} kg
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {prev.production_min_kg.toFixed(0)} - {prev.production_max_kg.toFixed(0)} kg
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    {prev.itm_prevu.toFixed(2)} kg
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {prev.itm_min.toFixed(2)} - {prev.itm_max.toFixed(2)} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {previsions.length > 10 && (
          <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
            Affichage des 10 premiers jours (total: {previsions.length} jours)
          </div>
        )}
      </div>

      {/* Informations Prophet */}
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
            <h3 className="text-sm font-medium text-blue-800">Modèle Prophet</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Les prévisions sont générées par Prophet (Facebook), un modèle de séries
                temporelles capable de capturer la saisonnalité et les tendances. Les intervalles
                de confiance à 95% indiquent la fourchette probable de valeurs futures.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
