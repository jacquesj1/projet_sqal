'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, AlertTriangle, Bell, Activity, Target, Award } from 'lucide-react';

interface Alerte {
  time: string;
  niveau: string;
  type_alerte: string;
  message: string;
  canard_id: number;
  acquittee: boolean;
}

interface PerformanceMetrics {
  score_performance: number;
  score_ic: number;
  score_gain: number;
  score_regularite: number;
  gain_moyen_journalier: number;
  indice_consommation: number;
  poids_final_predit: number;
}

interface CourbesPrediction {
  previsions: Array<{
    date: string;
    poids_predit: number;
    poids_min: number;
    poids_max: number;
  }>;
}

export default function DashboardAnalytics({ gaveurId }: { gaveurId: number }) {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [dashboardAlertes, setDashboardAlertes] = useState<any>(null);
  const [canardSelected, setCanardSelected] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [predictions, setPredictions] = useState<CourbesPrediction | null>(null);
  const [comparaisonGenetiques, setComparaisonGenetiques] = useState<any>(null);
  const [rapportHebdo, setRapportHebdo] = useState<any>(null);
  
  const [selectedTab, setSelectedTab] = useState<'alertes' | 'analytics' | 'predictions' | 'comparaison'>('alertes');

  useEffect(() => {
    loadDashboardAlertes();
    loadAlertes();
    loadComparaisonGenetiques();
    loadRapportHebdo();
  }, [gaveurId]);

  useEffect(() => {
    if (canardSelected) {
      loadMetrics();
      loadPredictions();
    }
  }, [canardSelected]);

  const loadDashboardAlertes = async () => {
    try {
      const response = await fetch(`/api/alertes/dashboard/${gaveurId}`);
      const data = await response.json();
      setDashboardAlertes(data);
    } catch (error) {
      console.error('Erreur chargement dashboard alertes:', error);
    }
  };

  const loadAlertes = async () => {
    try {
      const response = await fetch(`/api/alertes/gaveur/${gaveurId}?acquittee=false`);
      const data = await response.json();
      setAlertes(data);
    } catch (error) {
      console.error('Erreur chargement alertes:', error);
    }
  };

  const loadMetrics = async () => {
    if (!canardSelected) return;
    
    try {
      const response = await fetch(`/api/analytics/metrics/${canardSelected}`);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Erreur chargement métriques:', error);
    }
  };

  const loadPredictions = async () => {
    if (!canardSelected) return;
    
    try {
      const response = await fetch(`/api/analytics/predict-prophet/${canardSelected}?jours=7`);
      const data = await response.json();
      setPredictions(data);
    } catch (error) {
      console.error('Erreur chargement prédictions:', error);
    }
  };

  const loadComparaisonGenetiques = async () => {
    try {
      const response = await fetch(`/api/analytics/compare-genetiques?gaveur_id=${gaveurId}`);
      const data = await response.json();
      setComparaisonGenetiques(data);
    } catch (error) {
      console.error('Erreur comparaison génétiques:', error);
    }
  };

  const loadRapportHebdo = async () => {
    try {
      const response = await fetch(`/api/analytics/weekly-report/${gaveurId}`);
      const data = await response.json();
      setRapportHebdo(data);
    } catch (error) {
      console.error('Erreur rapport hebdo:', error);
    }
  };

  const acquitterAlerte = async (alerteId: number) => {
    try {
      await fetch(`/api/alertes/${alerteId}/acquitter`, {
        method: 'POST'
      });
      loadAlertes();
      loadDashboardAlertes();
    } catch (error) {
      console.error('Erreur acquittement:', error);
    }
  };

  const getNiveauColor = (niveau: string) => {
    switch (niveau) {
      case 'critique':
        return 'bg-red-100 border-red-500 text-red-800';
      case 'important':
        return 'bg-orange-100 border-orange-500 text-orange-800';
      case 'info':
        return 'bg-blue-100 border-blue-500 text-blue-800';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  const getNiveauIcon = (niveau: string) => {
    switch (niveau) {
      case 'critique':
        return '🚨';
      case 'important':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📌';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8 text-gray-800 flex items-center gap-3">
        <Activity className="text-purple-600" size={40} />
        Dashboard Analytics & IA
      </h1>

      {/* KPIs Dashboard Alertes */}
      {dashboardAlertes && (
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Alertes Critiques</p>
                <p className="text-4xl font-bold">{dashboardAlertes.critiques_actives}</p>
              </div>
              <AlertTriangle size={40} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Importantes</p>
                <p className="text-4xl font-bold">{dashboardAlertes.importantes_actives}</p>
              </div>
              <Bell size={40} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Dernières 24h</p>
                <p className="text-4xl font-bold">{dashboardAlertes.alertes_24h}</p>
              </div>
              <Activity size={40} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">SMS Envoyés</p>
                <p className="text-4xl font-bold">{dashboardAlertes.sms_envoyes}</p>
              </div>
              <Bell size={40} className="opacity-80" />
            </div>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setSelectedTab('alertes')}
          className={`px-6 py-3 rounded-lg font-bold transition-colors ${
            selectedTab === 'alertes'
              ? 'bg-red-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🚨 Alertes Actives
        </button>
        <button
          onClick={() => setSelectedTab('analytics')}
          className={`px-6 py-3 rounded-lg font-bold transition-colors ${
            selectedTab === 'analytics'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📊 Analytics Canard
        </button>
        <button
          onClick={() => setSelectedTab('predictions')}
          className={`px-6 py-3 rounded-lg font-bold transition-colors ${
            selectedTab === 'predictions'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🔮 Prédictions Prophet
        </button>
        <button
          onClick={() => setSelectedTab('comparaison')}
          className={`px-6 py-3 rounded-lg font-bold transition-colors ${
            selectedTab === 'comparaison'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🏆 Comparaison Génétiques
        </button>
      </div>

      {/* Contenu Alertes */}
      {selectedTab === 'alertes' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <AlertTriangle className="text-red-600" />
            Alertes Actives Non Acquittées
          </h2>

          {alertes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-2xl">✅</p>
              <p className="text-gray-600 mt-2">Aucune alerte active</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alertes.map((alerte, idx) => (
                <div
                  key={idx}
                  className={`border-l-4 p-4 rounded-lg ${getNiveauColor(alerte.niveau)}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getNiveauIcon(alerte.niveau)}</span>
                        <h3 className="font-bold text-lg">
                          Canard #{alerte.canard_id} - {alerte.type_alerte}
                        </h3>
                        <span className="px-2 py-1 bg-white rounded text-xs font-bold uppercase">
                          {alerte.niveau}
                        </span>
                      </div>
                      <p className="text-sm mb-2">{alerte.message}</p>
                      <p className="text-xs opacity-75">
                        {new Date(alerte.time).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <button
                      onClick={() => acquitterAlerte(idx)}
                      className="ml-4 px-4 py-2 bg-white hover:bg-gray-100 rounded-lg font-bold text-sm transition-colors"
                    >
                      Acquitter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contenu Analytics */}
      {selectedTab === 'analytics' && (
        <div className="space-y-6">
          {/* Sélection canard */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner un canard pour analyse
            </label>
            <input
              type="number"
              placeholder="ID du canard"
              onChange={(e) => setCanardSelected(Number(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Métriques */}
          {metrics && (
            <>
              {/* Scores de performance */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Award className="text-yellow-500" />
                  Scores de Performance
                </h2>

                <div className="grid grid-cols-4 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Score Global</p>
                    <p className={`text-5xl font-bold ${getScoreColor(metrics.score_performance)}`}>
                      {metrics.score_performance.toFixed(0)}
                    </p>
                    <p className="text-xs text-gray-500">/100</p>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">IC (Indice Conso)</p>
                    <p className={`text-5xl font-bold ${getScoreColor(metrics.score_ic)}`}>
                      {metrics.score_ic.toFixed(0)}
                    </p>
                    <p className="text-xs text-gray-500">IC: {metrics.indice_consommation.toFixed(2)}</p>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Gain de Poids</p>
                    <p className={`text-5xl font-bold ${getScoreColor(metrics.score_gain)}`}>
                      {metrics.score_gain.toFixed(0)}
                    </p>
                    <p className="text-xs text-gray-500">{metrics.gain_moyen_journalier.toFixed(0)}g/jour</p>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Régularité</p>
                    <p className={`text-5xl font-bold ${getScoreColor(metrics.score_regularite)}`}>
                      {metrics.score_regularite.toFixed(0)}
                    </p>
                    <p className="text-xs text-gray-500">Variance faible</p>
                  </div>
                </div>
              </div>

              {/* Prédiction poids final */}
              <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg shadow-lg p-6 border-2 border-purple-300">
                <h3 className="font-bold text-xl mb-4 text-purple-900 flex items-center gap-2">
                  <Target />
                  Prédiction Poids Final (Jour 14)
                </h3>
                <p className="text-5xl font-bold text-purple-700">
                  {metrics.poids_final_predit.toFixed(0)}g
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Basé sur régression linéaire de la courbe de croissance
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Contenu Prédictions Prophet */}
      {selectedTab === 'predictions' && predictions && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="text-blue-600" />
            Prévisions Prophet (Facebook AI)
          </h2>

          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={predictions.previsions}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
              />
              <YAxis />
              <Tooltip
                formatter={(value: any) => [`${value.toFixed(0)}g`, 'Poids']}
                labelFormatter={(label) => `Date: ${formatDate(label)}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="poids_max"
                stroke="#3b82f6"
                fill="#93c5fd"
                fillOpacity={0.3}
                name="Max (95%)"
              />
              <Area
                type="monotone"
                dataKey="poids_predit"
                stroke="#1d4ed8"
                fill="#3b82f6"
                fillOpacity={0.6}
                name="Prédiction"
              />
              <Area
                type="monotone"
                dataKey="poids_min"
                stroke="#3b82f6"
                fill="#93c5fd"
                fillOpacity={0.3}
                name="Min (95%)"
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Intervalle de confiance 95%</strong> : Les zones ombrées représentent
              la plage probable du poids futur avec une confiance de 95%.
            </p>
          </div>
        </div>
      )}

      {/* Contenu Comparaison Génétiques */}
      {selectedTab === 'comparaison' && comparaisonGenetiques && (
        <div className="space-y-6">
          {/* Graphique comparaison */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">
              📊 Comparaison des Performances par Génétique
            </h2>

            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={comparaisonGenetiques.comparaisons}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="genetique" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="gain_moyen_grammes" fill="#10b981" name="Gain Moyen (g)" />
                <Bar dataKey="indice_consommation" fill="#3b82f6" name="Indice Conso" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tableau détaillé */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="font-bold text-xl mb-4">Détails par Génétique</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Génétique</th>
                    <th className="p-3 text-right">Nb Canards</th>
                    <th className="p-3 text-right">Gain Moyen</th>
                    <th className="p-3 text-right">Dose Moy. (kg)</th>
                    <th className="p-3 text-right">IC</th>
                    <th className="p-3 text-right">Mortalité</th>
                  </tr>
                </thead>
                <tbody>
                  {comparaisonGenetiques.comparaisons.map((comp: any, idx: number) => (
                    <tr key={idx} className={idx === 0 ? 'bg-green-50 font-bold' : ''}>
                      <td className="p-3">
                        {comp.genetique}
                        {idx === 0 && <span className="ml-2">🏆</span>}
                      </td>
                      <td className="p-3 text-right">{comp.nb_canards}</td>
                      <td className="p-3 text-right">{comp.gain_moyen_grammes}g</td>
                      <td className="p-3 text-right">{comp.dose_moyenne_kg}</td>
                      <td className="p-3 text-right">{comp.indice_consommation}</td>
                      <td className="p-3 text-right">
                        <span className={comp.taux_mortalite_pct > 5 ? 'text-red-600' : 'text-green-600'}>
                          {comp.taux_mortalite_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rapport hebdomadaire */}
      {rapportHebdo && (
        <div className="mt-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-lg p-6 border-2 border-indigo-300">
          <h2 className="text-2xl font-bold mb-6 text-indigo-900">
            📈 Rapport Hebdomadaire
          </h2>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Canards Actifs</p>
              <p className="text-3xl font-bold text-indigo-700">
                {rapportHebdo.statistiques?.canards_actifs}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Gavages Total</p>
              <p className="text-3xl font-bold text-indigo-700">
                {rapportHebdo.statistiques?.gavages_total}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Gain Moyen</p>
              <p className="text-3xl font-bold text-indigo-700">
                {rapportHebdo.statistiques?.gain_moyen_g.toFixed(0)}g
              </p>
            </div>
          </div>

          {/* Top performers */}
          {rapportHebdo.top_performers && rapportHebdo.top_performers.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold mb-3 text-indigo-900">🏆 Top 3 Performers</h3>
              <div className="space-y-2">
                {rapportHebdo.top_performers.map((perf: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <span className="font-medium">
                      {idx + 1}. {perf.numero}
                    </span>
                    <span className="font-bold text-green-600">
                      {perf.gain_moyen.toFixed(0)}g/jour
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
