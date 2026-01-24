'use client';

import { useState, useEffect } from 'react';
import { euralisAPI } from '@/lib/euralis/api';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';

interface QualityData {
  lot_id: number;
  code_lot: string;
  gaveur_nom: string;
  site_code: string;
  itm: number;
  sigma: number;
  mortalite: number;
  is_anomaly: boolean;
  score_anomalie: number;
}

export default function QualitePage() {
  const [qualityData, setQualityData] = useState<QualityData[]>([]);
  const [filterSite, setFilterSite] = useState<string>('all');
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // TODO: Créer endpoint API /api/euralis/qualite/analyse
        // Données simulées
        const mockData: QualityData[] = Array.from({ length: 50 }, (_, i) => {
          const sites = ['LL', 'LS', 'MT'];
          const site = sites[i % 3];
          const isAnomaly = Math.random() < 0.15; // 15% anomalies

          return {
            lot_id: i + 1,
            code_lot: `${site}480${1000 + i}`,
            gaveur_nom: `Gaveur ${i + 1}`,
            site_code: site,
            itm: isAnomaly
              ? 10 + Math.random() * 12 // Anomalies: ITM très variable
              : 14 + Math.random() * 4, // Normal: 14-18 kg
            sigma: isAnomaly
              ? 1 + Math.random() * 3 // Anomalies: Sigma variable
              : 1.5 + Math.random() * 1.5, // Normal: 1.5-3
            mortalite: isAnomaly
              ? Math.random() * 10 // Anomalies: mortalité élevée
              : Math.random() * 4, // Normal: 0-4%
            is_anomaly: isAnomaly,
            score_anomalie: isAnomaly ? -0.8 - Math.random() * 0.2 : 0.2 + Math.random() * 0.3,
          };
        });

        setQualityData(mockData);
      } catch (error) {
        console.error('Erreur chargement données qualité:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredData = qualityData
    .filter((d) => filterSite === 'all' || d.site_code === filterSite)
    .filter((d) => !showAnomaliesOnly || d.is_anomaly);

  const stats = {
    total: qualityData.length,
    anomalies: qualityData.filter((d) => d.is_anomaly).length,
    itm_moyen: qualityData.reduce((sum, d) => sum + d.itm, 0) / qualityData.length,
    sigma_moyen: qualityData.reduce((sum, d) => sum + d.sigma, 0) / qualityData.length,
    mortalite_moyenne:
      qualityData.reduce((sum, d) => sum + d.mortalite, 0) / qualityData.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Chargement analyse qualité...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Qualité & Anomalies</h1>
        <p className="text-gray-600 mt-1">
          Analyse ITM, Sigma et détection d'anomalies (Isolation Forest)
        </p>
      </div>

      {/* KPIs Qualité */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Total Lots</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Anomalies Détectées</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{stats.anomalies}</div>
          <div className="text-xs text-gray-500 mt-1">
            {((stats.anomalies / stats.total) * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">ITM Moyen</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {stats.itm_moyen.toFixed(2)} kg
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Sigma Moyen</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {stats.sigma_moyen.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Mortalité Moyenne</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">
            {stats.mortalite_moyenne.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="flex items-end">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showAnomaliesOnly}
                onChange={(e) => setShowAnomaliesOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Afficher uniquement les anomalies
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Graphique ITM vs Sigma (Scatter) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">
          Analyse ITM vs Sigma (Détection Anomalies)
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="itm"
              name="ITM"
              unit=" kg"
              domain={[10, 22]}
              label={{ value: 'ITM (kg)', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              type="number"
              dataKey="sigma"
              name="Sigma"
              domain={[0, 4]}
              label={{ value: 'Sigma', angle: -90, position: 'insideLeft' }}
            />
            <ZAxis type="number" dataKey="mortalite" range={[50, 200]} name="Mortalité" unit="%" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value: number, name: string) => {
                if (name === 'ITM') return `${value.toFixed(2)} kg`;
                if (name === 'Sigma') return value.toFixed(2);
                if (name === 'Mortalité') return `${value.toFixed(2)}%`;
                return value;
              }}
              labelFormatter={(label) => `Lot ${label}`}
            />
            <Legend />
            <Scatter
              name="Lots normaux"
              data={filteredData.filter((d) => !d.is_anomaly)}
              fill="#3B82F6"
            />
            <Scatter
              name="Anomalies détectées"
              data={filteredData.filter((d) => d.is_anomaly)}
              fill="#EF4444"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Distribution ITM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Distribution ITM</h2>
          <div className="space-y-4">
            {[
              { range: '< 12 kg', min: 0, max: 12, color: 'red' },
              { range: '12-14 kg', min: 12, max: 14, color: 'orange' },
              { range: '14-16 kg', min: 14, max: 16, color: 'yellow' },
              { range: '16-18 kg', min: 16, max: 18, color: 'green' },
              { range: '> 18 kg', min: 18, max: 100, color: 'blue' },
            ].map((category) => {
              const count = filteredData.filter(
                (d) => d.itm >= category.min && d.itm < category.max
              ).length;
              const pct = ((count / filteredData.length) * 100).toFixed(1);
              const colorClass = {
                red: 'bg-red-500',
                orange: 'bg-orange-500',
                yellow: 'bg-yellow-500',
                green: 'bg-green-500',
                blue: 'bg-blue-500',
              }[category.color];

              return (
                <div key={category.range}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">{category.range}</span>
                    <span className="text-sm font-semibold">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${colorClass} h-2 rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Distribution Sigma</h2>
          <div className="space-y-4">
            {[
              { range: '< 1.5', min: 0, max: 1.5, color: 'green' },
              { range: '1.5-2.0', min: 1.5, max: 2.0, color: 'blue' },
              { range: '2.0-2.5', min: 2.0, max: 2.5, color: 'yellow' },
              { range: '2.5-3.0', min: 2.5, max: 3.0, color: 'orange' },
              { range: '> 3.0', min: 3.0, max: 100, color: 'red' },
            ].map((category) => {
              const count = filteredData.filter(
                (d) => d.sigma >= category.min && d.sigma < category.max
              ).length;
              const pct = ((count / filteredData.length) * 100).toFixed(1);
              const colorClass = {
                red: 'bg-red-500',
                orange: 'bg-orange-500',
                yellow: 'bg-yellow-500',
                green: 'bg-green-500',
                blue: 'bg-blue-500',
              }[category.color];

              return (
                <div key={category.range}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">{category.range}</span>
                    <span className="text-sm font-semibold">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${colorClass} h-2 rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tableau des anomalies */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Anomalies Détectées (Isolation Forest)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gaveur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ITM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sigma
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mortalité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData
                .filter((d) => d.is_anomaly)
                .map((data) => (
                  <tr key={data.lot_id} className="hover:bg-red-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {data.code_lot}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.gaveur_nom}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {data.site_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-sm font-semibold ${
                          data.itm < 13 || data.itm > 18 ? 'text-red-600' : 'text-gray-900'
                        }`}
                      >
                        {data.itm.toFixed(2)} kg
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-sm font-semibold ${
                          data.sigma > 2.5 ? 'text-red-600' : 'text-gray-900'
                        }`}
                      >
                        {data.sigma.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-sm font-semibold ${
                          data.mortalite > 5 ? 'text-red-600' : 'text-gray-900'
                        }`}
                      >
                        {data.mortalite.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                        {data.score_anomalie.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {filteredData.filter((d) => d.is_anomaly).length === 0 && (
          <div className="px-6 py-4 text-center text-gray-500">
            Aucune anomalie détectée avec les filtres actuels
          </div>
        )}
      </div>

      {/* Informations Isolation Forest */}
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
            <h3 className="text-sm font-medium text-blue-800">Détection d'Anomalies</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                L'algorithme Isolation Forest détecte automatiquement les lots présentant des
                performances atypiques (ITM, Sigma, Mortalité). Un score négatif indique une
                anomalie potentielle nécessitant une investigation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
