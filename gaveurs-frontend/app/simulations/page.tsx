'use client';

import { useState } from 'react';
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
import { Zap, TrendingUp, DollarSign, AlertTriangle, Save, Trash2 } from 'lucide-react';
import { simulationApi } from '@/lib/api';

interface SimulationParams {
  dose_matin_modifier: number;
  dose_soir_modifier: number;
  duree_gavage_jours: number;
  temperature_cible: number;
}

interface SimulationResults {
  poids_final_estime: number;
  indice_consommation_estime: number;
  cout_mais_estime: number;
  risque_mortalite: number;
  rentabilite_estimee: number;
}

interface Scenario {
  id: string;
  name: string;
  params: SimulationParams;
  results: SimulationResults;
}

export default function SimulationsPage() {
  const [params, setParams] = useState<SimulationParams>({
    dose_matin_modifier: 0,
    dose_soir_modifier: 0,
    duree_gavage_jours: 14,
    temperature_cible: 22,
  });

  const [results, setResults] = useState<SimulationResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);

  const runSimulation = async () => {
    setLoading(true);

    try {
      const response = await simulationApi.whatIf({
        canard_id: 1,
        parameters: params,
      }) as { predictions: SimulationResults };

      setResults(response.predictions);

      // Ajouter le scénario
      const newScenario: Scenario = {
        id: Date.now().toString(),
        name: `Scénario ${scenarios.length + 1}`,
        params: { ...params },
        results: response.predictions,
      };

      setScenarios((prev) => [...prev, newScenario]);
      setSelectedScenarios((prev) => [...prev, newScenario.id]);
    } catch (error) {
      console.error('Erreur simulation:', error);
      // Simulation de résultats pour la démo
      const mockResults: SimulationResults = {
        poids_final_estime: 4200 + params.dose_matin_modifier * 10 + params.dose_soir_modifier * 8,
        indice_consommation_estime: 5.2 - params.dose_matin_modifier * 0.01,
        cout_mais_estime: 12.5 + params.dose_matin_modifier * 0.1,
        risque_mortalite: Math.max(0.5, 2 + Math.abs(params.dose_matin_modifier) * 0.1),
        rentabilite_estimee: 45 + params.dose_matin_modifier * 0.5 - params.dose_soir_modifier * 0.3,
      };

      setResults(mockResults);

      const newScenario: Scenario = {
        id: Date.now().toString(),
        name: `Scénario ${scenarios.length + 1}`,
        params: { ...params },
        results: mockResults,
      };

      setScenarios((prev) => [...prev, newScenario]);
      setSelectedScenarios((prev) => [...prev, newScenario.id]);
    } finally {
      setLoading(false);
    }
  };

  const handleParamChange = (key: keyof SimulationParams, value: number) => {
    setParams({ ...params, [key]: value });
  };

  const toggleScenario = (id: string) => {
    setSelectedScenarios((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const deleteScenario = (id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    setSelectedScenarios((prev) => prev.filter((s) => s !== id));
  };

  const selectedData = scenarios.filter((s) => selectedScenarios.includes(s.id));

  const comparisonData = selectedData.map((s) => ({
    name: s.name,
    poids: s.results.poids_final_estime,
    rentabilite: s.results.rentabilite_estimee,
    ic: s.results.indice_consommation_estime,
    risque: s.results.risque_mortalite,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800 flex items-center gap-3">
          <Zap className="text-purple-600" size={40} />
          Simulations &quot;What-If&quot;
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Paramètres */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Paramètres</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dose Matin (modificateur %)
                </label>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={params.dose_matin_modifier}
                  onChange={(e) => handleParamChange('dose_matin_modifier', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-center text-sm text-gray-600 mt-1">
                  {params.dose_matin_modifier > 0 ? '+' : ''}
                  {params.dose_matin_modifier}%
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dose Soir (modificateur %)
                </label>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={params.dose_soir_modifier}
                  onChange={(e) => handleParamChange('dose_soir_modifier', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-center text-sm text-gray-600 mt-1">
                  {params.dose_soir_modifier > 0 ? '+' : ''}
                  {params.dose_soir_modifier}%
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durée Gavage (jours)
                </label>
                <input
                  type="number"
                  min="10"
                  max="18"
                  value={params.duree_gavage_jours}
                  onChange={(e) => handleParamChange('duree_gavage_jours', Number(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Température Cible (°C)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="18"
                  max="26"
                  value={params.temperature_cible}
                  onChange={(e) => handleParamChange('temperature_cible', Number(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                onClick={runSimulation}
                disabled={loading}
                className="w-full bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                <Zap size={20} />
                {loading ? 'Simulation...' : 'Lancer Simulation'}
              </button>
            </div>

            {/* Scénarios sauvegardés */}
            {scenarios.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-bold mb-4">Scénarios ({scenarios.length})</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {scenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                        selectedScenarios.includes(scenario.id)
                          ? 'bg-purple-100 border border-purple-300'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={selectedScenarios.includes(scenario.id)}
                          onChange={() => toggleScenario(scenario.id)}
                          className="rounded text-purple-600"
                        />
                        <span className="text-sm">{scenario.name}</span>
                      </label>
                      <button
                        onClick={() => deleteScenario(scenario.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Résultats */}
          <div className="lg:col-span-2 space-y-6">
            {results && (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
                    <TrendingUp size={24} className="mb-2 opacity-80" />
                    <p className="text-sm opacity-90">Poids Final Estimé</p>
                    <p className="text-3xl font-bold">{results.poids_final_estime.toFixed(0)}g</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-4 text-white">
                    <Zap size={24} className="mb-2 opacity-80" />
                    <p className="text-sm opacity-90">Indice Consommation</p>
                    <p className="text-3xl font-bold">{results.indice_consommation_estime.toFixed(2)}</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-4 text-white">
                    <DollarSign size={24} className="mb-2 opacity-80" />
                    <p className="text-sm opacity-90">Rentabilité</p>
                    <p className="text-3xl font-bold">{results.rentabilite_estimee.toFixed(0)}€</p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-4 text-white">
                    <DollarSign size={24} className="mb-2 opacity-80" />
                    <p className="text-sm opacity-90">Coût Maïs</p>
                    <p className="text-3xl font-bold">{results.cout_mais_estime.toFixed(1)}€</p>
                  </div>

                  <div
                    className={`rounded-lg shadow-lg p-4 text-white ${
                      results.risque_mortalite > 3
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : 'bg-gradient-to-br from-gray-500 to-gray-600'
                    }`}
                  >
                    <AlertTriangle size={24} className="mb-2 opacity-80" />
                    <p className="text-sm opacity-90">Risque Mortalité</p>
                    <p className="text-3xl font-bold">{results.risque_mortalite.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Graphique comparaison */}
                {comparisonData.length > 1 && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="font-bold text-xl mb-4">Comparaison des Scénarios</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="poids" fill="#3b82f6" name="Poids (g)" />
                        <Bar yAxisId="right" dataKey="rentabilite" fill="#10b981" name="Rentabilité (€)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Détails comparaison */}
                {selectedData.length > 1 && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="font-bold text-xl mb-4">Tableau Comparatif</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-3 text-left">Scénario</th>
                            <th className="p-3 text-right">Dose M.</th>
                            <th className="p-3 text-right">Dose S.</th>
                            <th className="p-3 text-right">Poids</th>
                            <th className="p-3 text-right">IC</th>
                            <th className="p-3 text-right">Rentab.</th>
                            <th className="p-3 text-right">Risque</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedData.map((s) => (
                            <tr key={s.id} className="border-b hover:bg-gray-50">
                              <td className="p-3 font-medium">{s.name}</td>
                              <td className="p-3 text-right">
                                {s.params.dose_matin_modifier > 0 ? '+' : ''}
                                {s.params.dose_matin_modifier}%
                              </td>
                              <td className="p-3 text-right">
                                {s.params.dose_soir_modifier > 0 ? '+' : ''}
                                {s.params.dose_soir_modifier}%
                              </td>
                              <td className="p-3 text-right font-medium">
                                {s.results.poids_final_estime.toFixed(0)}g
                              </td>
                              <td className="p-3 text-right">
                                {s.results.indice_consommation_estime.toFixed(2)}
                              </td>
                              <td className="p-3 text-right text-green-600 font-medium">
                                {s.results.rentabilite_estimee.toFixed(0)}€
                              </td>
                              <td
                                className={`p-3 text-right ${
                                  s.results.risque_mortalite > 3 ? 'text-red-600' : ''
                                }`}
                              >
                                {s.results.risque_mortalite.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* État initial */}
            {!results && scenarios.length === 0 && (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <Zap className="mx-auto text-gray-400 mb-4" size={64} />
                <h3 className="text-xl font-bold text-gray-600 mb-2">
                  Lancez votre première simulation
                </h3>
                <p className="text-gray-500">
                  Ajustez les paramètres et cliquez sur &quot;Lancer Simulation&quot; pour voir les
                  prédictions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
