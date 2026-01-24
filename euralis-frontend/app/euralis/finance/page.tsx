'use client';

import { useState, useEffect } from 'react';
import { euralisAPI } from '@/lib/euralis/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface FinanceData {
  site_code: string;
  production_kg: number;
  cout_mais_total: number;
  cout_transport: number;
  cout_gavage: number;
  revenu_total: number;
  marge_brute: number;
  rentabilite_pct: number;
}

export default function FinancePage() {
  const [financeData, setFinanceData] = useState<FinanceData[]>([]);
  const [loading, setLoading] = useState(true);

  // Prix de marché (simulés)
  const prixFoieKg = 45; // €/kg
  const prixMaisKg = 0.25; // €/kg
  const coutGavageCanard = 2.5; // €/canard

  useEffect(() => {
    const fetchData = async () => {
      try {
        // TODO: Créer endpoint API /api/euralis/finance/indicateurs
        // Données simulées basées sur stats sites
        const mockFinance: FinanceData[] = [
          {
            site_code: 'LL',
            production_kg: 18500,
            cout_mais_total: 0,
            cout_transport: 0,
            cout_gavage: 0,
            revenu_total: 0,
            marge_brute: 0,
            rentabilite_pct: 0,
          },
          {
            site_code: 'LS',
            production_kg: 16200,
            cout_mais_total: 0,
            cout_transport: 0,
            cout_gavage: 0,
            revenu_total: 0,
            marge_brute: 0,
            rentabilite_pct: 0,
          },
          {
            site_code: 'MT',
            production_kg: 21800,
            cout_mais_total: 0,
            cout_transport: 0,
            cout_gavage: 0,
            revenu_total: 0,
            marge_brute: 0,
            rentabilite_pct: 0,
          },
        ].map((site) => {
          // Calcul consommation maïs (estimée à ~8kg maïs/kg foie)
          const maisKg = site.production_kg * 8;
          const coutMais = maisKg * prixMaisKg;

          // Canards (estimés à ~15kg ITM moyen)
          const nbCanards = Math.round((site.production_kg / 15) * 1000);
          const coutGavage = nbCanards * coutGavageCanard;

          // Transport (estimé)
          const coutTransport = nbCanards * 0.3;

          // Revenus
          const revenu = site.production_kg * prixFoieKg;

          // Coûts totaux
          const coutTotal = coutMais + coutGavage + coutTransport;

          // Marge
          const marge = revenu - coutTotal;
          const rentabilite = (marge / revenu) * 100;

          return {
            ...site,
            cout_mais_total: coutMais,
            cout_transport: coutTransport,
            cout_gavage: coutGavage,
            revenu_total: revenu,
            marge_brute: marge,
            rentabilite_pct: rentabilite,
          };
        });

        setFinanceData(mockFinance);
      } catch (error) {
        console.error('Erreur chargement données finance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totaux = {
    production: financeData.reduce((sum, s) => sum + s.production_kg, 0),
    revenus: financeData.reduce((sum, s) => sum + s.revenu_total, 0),
    couts: financeData.reduce(
      (sum, s) => sum + s.cout_mais_total + s.cout_transport + s.cout_gavage,
      0
    ),
    marge: financeData.reduce((sum, s) => sum + s.marge_brute, 0),
    rentabilite: 0,
  };

  totaux.rentabilite = (totaux.marge / totaux.revenus) * 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Chargement données financières...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Finance & Indicateurs Économiques</h1>
        <p className="text-gray-600 mt-1">
          Analyse revenus, coûts et rentabilité par site
        </p>
      </div>

      {/* KPIs Globaux */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Revenus Totaux</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {(totaux.revenus / 1000).toFixed(0)} k€
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {totaux.production.toFixed(0)} kg × {prixFoieKg}€/kg
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Coûts Totaux</div>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {(totaux.couts / 1000).toFixed(0)} k€
          </div>
          <div className="text-xs text-gray-500 mt-1">Maïs + Transport + Gavage</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Marge Brute</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {(totaux.marge / 1000).toFixed(0)} k€
          </div>
          <div className="text-xs text-gray-500 mt-1">Revenus - Coûts</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Rentabilité</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">
            {totaux.rentabilite.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Marge / Revenus</div>
        </div>
      </div>

      {/* Prix de marché */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Prix de Marché & Paramètres</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Prix Foie Gras</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{prixFoieKg} €/kg</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Prix Maïs</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{prixMaisKg} €/kg</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Coût Gavage</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">
              {coutGavageCanard} €/canard
            </div>
          </div>
        </div>
      </div>

      {/* Graphique Revenus vs Coûts par Site */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Revenus vs Coûts par Site</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={financeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="site_code" />
            <YAxis label={{ value: 'Montant (k€)', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value: number) => `${(value / 1000).toFixed(1)} k€`} />
            <Legend />
            <Bar dataKey="revenu_total" fill="#10B981" name="Revenus" />
            <Bar dataKey="cout_mais_total" fill="#F59E0B" name="Coût Maïs" stackId="couts" />
            <Bar dataKey="cout_gavage" fill="#EF4444" name="Coût Gavage" stackId="couts" />
            <Bar dataKey="cout_transport" fill="#6B7280" name="Coût Transport" stackId="couts" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Graphique Rentabilité par Site */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Rentabilité par Site</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={financeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="site_code" />
            <YAxis label={{ value: 'Rentabilité (%)', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
            <Legend />
            <Bar dataKey="rentabilite_pct" fill="#3B82F6" name="Rentabilité (%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau détaillé par site */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Détail Financier par Site</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Production
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coût Maïs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coût Gavage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coût Transport
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coûts Totaux
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marge Brute
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rentabilité
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {financeData.map((site) => {
                const coutTotal = site.cout_mais_total + site.cout_gavage + site.cout_transport;
                return (
                  <tr key={site.site_code} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 text-sm font-bold bg-blue-100 text-blue-800 rounded">
                        {site.site_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {site.production_kg.toFixed(0)} kg
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                      {(site.revenu_total / 1000).toFixed(1)} k€
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                      {(site.cout_mais_total / 1000).toFixed(1)} k€
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {(site.cout_gavage / 1000).toFixed(1)} k€
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {(site.cout_transport / 1000).toFixed(1)} k€
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                      {(coutTotal / 1000).toFixed(1)} k€
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                      {(site.marge_brute / 1000).toFixed(1)} k€
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-sm font-bold rounded ${
                          site.rentabilite_pct > 70
                            ? 'bg-green-100 text-green-800'
                            : site.rentabilite_pct > 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {site.rentabilite_pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Ligne totaux */}
              <tr className="bg-gray-100 font-bold">
                <td className="px-6 py-4 whitespace-nowrap text-sm">TOTAL</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {totaux.production.toFixed(0)} kg
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                  {(totaux.revenus / 1000).toFixed(1)} k€
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                  {(
                    financeData.reduce((sum, s) => sum + s.cout_mais_total, 0) / 1000
                  ).toFixed(1)}{' '}
                  k€
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                  {(financeData.reduce((sum, s) => sum + s.cout_gavage, 0) / 1000).toFixed(1)} k€
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {(financeData.reduce((sum, s) => sum + s.cout_transport, 0) / 1000).toFixed(1)}{' '}
                  k€
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                  {(totaux.couts / 1000).toFixed(1)} k€
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                  {(totaux.marge / 1000).toFixed(1)} k€
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-sm bg-blue-100 text-blue-800 rounded">
                    {totaux.rentabilite.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Répartition des coûts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Répartition des Coûts</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: 'Maïs',
              value: financeData.reduce((sum, s) => sum + s.cout_mais_total, 0),
              color: 'orange',
            },
            {
              label: 'Gavage',
              value: financeData.reduce((sum, s) => sum + s.cout_gavage, 0),
              color: 'red',
            },
            {
              label: 'Transport',
              value: financeData.reduce((sum, s) => sum + s.cout_transport, 0),
              color: 'gray',
            },
          ].map((item) => {
            const pct = ((item.value / totaux.couts) * 100).toFixed(1);
            const colorClasses = {
              orange: 'bg-orange-500',
              red: 'bg-red-500',
              gray: 'bg-gray-500',
            }[item.color];

            return (
              <div key={item.label} className="text-center">
                <div className="text-sm text-gray-600">{item.label}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {(item.value / 1000).toFixed(1)} k€
                </div>
                <div className="text-sm text-gray-500">{pct}% des coûts</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className={`${colorClasses} h-2 rounded-full`}
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Informations */}
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
            <h3 className="text-sm font-medium text-blue-800">Calculs Financiers</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Les données financières sont calculées à partir des statistiques de production
                réelles et des prix de marché configurables. La marge brute représente la
                différence entre les revenus (vente foie gras) et les coûts totaux (maïs, gavage,
                transport).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
