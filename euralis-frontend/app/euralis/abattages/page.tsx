'use client';

import { useState, useEffect } from 'react';
import { euralisAPI } from '@/lib/euralis/api';

interface PlanningAbattage {
  id: number;
  code_lot: string;
  site_code: string;
  date_abattage_prevue: string;
  abattoir: string;
  creneau_horaire: string;
  nb_canards_prevu: number;
  capacite_abattoir_jour: number;
  taux_utilisation_pct: number;
  distance_km: number;
  cout_transport: number;
  priorite: number;
  statut: string;
}

export default function AbattagesPage() {
  const [planning, setPlanning] = useState<PlanningAbattage[]>([]);
  const [filterSite, setFilterSite] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'calendrier' | 'tableau'>('calendrier');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // TODO: Créer endpoint API /api/euralis/abattages/planning
        // Données simulées
        const mockPlanning: PlanningAbattage[] = Array.from({ length: 20 }, (_, i) => {
          const sites = ['LL', 'LS', 'MT'];
          const site = sites[i % 3];
          const abattoirs = ['ABATTOIR OUEST', 'ABATTOIR SUD', 'ABATTOIR NORD'];
          const statuts = ['planifie', 'confirme', 'realise'];

          const date = new Date();
          date.setDate(date.getDate() + Math.floor(i / 3));

          return {
            id: i + 1,
            code_lot: `${site}480${1000 + i}`,
            site_code: site,
            date_abattage_prevue: date.toISOString().split('T')[0],
            abattoir: abattoirs[i % 3],
            creneau_horaire: i % 2 === 0 ? '08h-12h' : '14h-18h',
            nb_canards_prevu: 800 + Math.floor(Math.random() * 400),
            capacite_abattoir_jour: 2000,
            taux_utilisation_pct: 40 + Math.random() * 50,
            distance_km: 20 + Math.random() * 80,
            cout_transport: 150 + Math.random() * 300,
            priorite: Math.ceil(Math.random() * 5),
            statut: statuts[i < 5 ? 2 : i < 10 ? 1 : 0],
          };
        });

        setPlanning(mockPlanning);
      } catch (error) {
        console.error('Erreur chargement planning abattages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredPlanning = planning
    .filter((p) => filterSite === 'all' || p.site_code === filterSite)
    .filter((p) => filterStatut === 'all' || p.statut === filterStatut)
    .sort((a, b) => new Date(a.date_abattage_prevue).getTime() - new Date(b.date_abattage_prevue).getTime());

  const stats = {
    total: planning.length,
    planifies: planning.filter((p) => p.statut === 'planifie').length,
    confirmes: planning.filter((p) => p.statut === 'confirme').length,
    realises: planning.filter((p) => p.statut === 'realise').length,
    taux_utilisation_moyen:
      planning.reduce((sum, p) => sum + p.taux_utilisation_pct, 0) / planning.length,
    cout_transport_total: planning.reduce((sum, p) => sum + p.cout_transport, 0),
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'planifie':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirme':
        return 'bg-blue-100 text-blue-800';
      case 'realise':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPrioriteColor = (priorite: number) => {
    if (priorite <= 2) return 'bg-green-100 text-green-800';
    if (priorite <= 3) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Chargement planning abattages...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Planning Abattages</h1>
        <p className="text-gray-600 mt-1">
          Optimisation avec algorithme hongrois (minimisation coûts transport + urgence)
        </p>
      </div>

      {/* KPIs Planning */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Total Lots</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Planifiés</div>
          <div className="text-3xl font-bold text-yellow-600 mt-2">{stats.planifies}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Confirmés</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{stats.confirmes}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Réalisés</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{stats.realises}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Taux Utilisation</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">
            {stats.taux_utilisation_moyen.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Filtres et toggle vue */}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="planifie">Planifié</option>
              <option value="confirme">Confirmé</option>
              <option value="realise">Réalisé</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vue</label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('calendrier')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'calendrier'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📅 Calendrier
              </button>
              <button
                onClick={() => setViewMode('tableau')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'tableau'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📊 Tableau
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Coûts et optimisation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Coûts Transport</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total</span>
              <span className="text-3xl font-bold text-blue-600">
                {stats.cout_transport_total.toFixed(0)} €
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Moyenne par lot</span>
              <span className="text-xl font-semibold text-gray-900">
                {(stats.cout_transport_total / stats.total).toFixed(0)} €
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Distance moyenne</span>
              <span className="text-xl font-semibold text-gray-900">
                {(
                  planning.reduce((sum, p) => sum + p.distance_km, 0) / planning.length
                ).toFixed(0)}{' '}
                km
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Utilisation Abattoirs</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Taux moyen</span>
              <span className="text-3xl font-bold text-green-600">
                {stats.taux_utilisation_moyen.toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Canards planifiés</span>
              <span className="text-xl font-semibold text-gray-900">
                {planning.reduce((sum, p) => sum + p.nb_canards_prevu, 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Capacité totale/jour</span>
              <span className="text-xl font-semibold text-gray-900">2 000</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vue Calendrier */}
      {viewMode === 'calendrier' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Planning Calendrier ({filteredPlanning.length} lots)</h2>
          </div>
          <div className="p-6">
            {(() => {
              // Grouper les lots par date
              const lotsByDate: { [key: string]: PlanningAbattage[] } = {};
              filteredPlanning.forEach((plan) => {
                const date = plan.date_abattage_prevue;
                if (!lotsByDate[date]) {
                  lotsByDate[date] = [];
                }
                lotsByDate[date].push(plan);
              });

              // Obtenir les dates triées
              const sortedDates = Object.keys(lotsByDate).sort();

              return (
                <div className="space-y-4">
                  {sortedDates.map((date) => {
                    const lots = lotsByDate[date];
                    const totalCanards = lots.reduce((sum, l) => sum + l.nb_canards_prevu, 0);
                    const tauxMoyen = lots.reduce((sum, l) => sum + l.taux_utilisation_pct, 0) / lots.length;

                    return (
                      <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* En-tête date */}
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-lg font-semibold text-blue-900">
                                📅 {new Date(date).toLocaleDateString('fr-FR', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </h3>
                            </div>
                            <div className="flex gap-6 text-sm">
                              <div className="text-center">
                                <div className="text-blue-600 font-semibold">{lots.length}</div>
                                <div className="text-blue-800 text-xs">Lots</div>
                              </div>
                              <div className="text-center">
                                <div className="text-green-600 font-semibold">
                                  {totalCanards.toLocaleString()}
                                </div>
                                <div className="text-blue-800 text-xs">Canards</div>
                              </div>
                              <div className="text-center">
                                <div
                                  className={`font-semibold ${
                                    tauxMoyen > 80
                                      ? 'text-red-600'
                                      : tauxMoyen > 60
                                      ? 'text-yellow-600'
                                      : 'text-green-600'
                                  }`}
                                >
                                  {tauxMoyen.toFixed(0)}%
                                </div>
                                <div className="text-blue-800 text-xs">Taux util.</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Lots du jour */}
                        <div className="p-6 bg-white">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {lots.map((plan) => (
                              <div
                                key={plan.id}
                                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <div className="font-semibold text-gray-900">{plan.code_lot}</div>
                                    <div className="text-xs text-gray-500">{plan.site_code}</div>
                                  </div>
                                  <span
                                    className={`px-2 py-1 text-xs font-medium rounded ${getStatutColor(
                                      plan.statut
                                    )}`}
                                  >
                                    {plan.statut}
                                  </span>
                                </div>

                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">🏭 Abattoir:</span>
                                    <span className="font-medium text-gray-900 text-xs">
                                      {plan.abattoir.replace('ABATTOIR ', '')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">🕐 Créneau:</span>
                                    <span className="font-medium text-gray-900">{plan.creneau_horaire}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">🦆 Canards:</span>
                                    <span className="font-semibold text-blue-600">
                                      {plan.nb_canards_prevu.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">📊 Utilisation:</span>
                                    <span
                                      className={`font-semibold ${
                                        plan.taux_utilisation_pct > 80
                                          ? 'text-red-600'
                                          : plan.taux_utilisation_pct > 60
                                          ? 'text-yellow-600'
                                          : 'text-green-600'
                                      }`}
                                    >
                                      {plan.taux_utilisation_pct.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">🚛 Distance:</span>
                                    <span className="font-medium text-gray-900">
                                      {plan.distance_km.toFixed(0)} km
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">💰 Coût:</span>
                                    <span className="font-semibold text-green-600">
                                      {plan.cout_transport.toFixed(0)} €
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                    <span className="text-gray-600">⚡ Priorité:</span>
                                    <span
                                      className={`px-2 py-1 text-xs font-medium rounded ${getPrioriteColor(
                                        plan.priorite
                                      )}`}
                                    >
                                      P{plan.priorite}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tableau planning */}
      {viewMode === 'tableau' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Planning Détaillé ({filteredPlanning.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Abattoir
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créneau
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Canards
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Distance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coût
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priorité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPlanning.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {new Date(plan.date_abattage_prevue).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{plan.code_lot}</div>
                    <div className="text-xs text-gray-500">{plan.site_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.abattoir}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.creneau_horaire}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                    {plan.nb_canards_prevu.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span
                        className={`text-sm font-semibold ${
                          plan.taux_utilisation_pct > 80
                            ? 'text-red-600'
                            : plan.taux_utilisation_pct > 60
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                      >
                        {plan.taux_utilisation_pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.distance_km.toFixed(0)} km
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    {plan.cout_transport.toFixed(0)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getPrioriteColor(
                        plan.priorite
                      )}`}
                    >
                      P{plan.priorite}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatutColor(plan.statut)}`}>
                      {plan.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Informations algorithme hongrois */}
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
            <h3 className="text-sm font-medium text-blue-800">Optimisation Hongroise</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Le planning est optimisé avec l'algorithme hongrois (SciPy linear_sum_assignment)
                pour minimiser les coûts totaux : coût transport + pénalité urgence + surcharge
                capacité. L'optimisation tient compte des contraintes de capacité des abattoirs et
                des priorités des lots.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
