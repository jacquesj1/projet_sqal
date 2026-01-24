'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Square, RefreshCw, Activity, Database, Users, Settings, X, Trash2, Plus, AlertCircle } from 'lucide-react';
import * as api from '@/lib/api';
import type { OrchestrationStatus, ControlPanelStats, SimulatorStatus } from '@/types/api';

interface ScenarioConfig {
  gavage: {
    nb_lots: number;
    acceleration: number;
  };
  sqal: {
    nb_devices: number;
    samples_per_lot: number;
    interval: number;
  };
  consumer: {
    num_feedbacks: number;
    interval: number;
    profile: 'realistic' | 'positive' | 'negative';
  };
}

// Configuration for individual Gavage tab
interface GavageConfig {
  nb_lots: number;
  acceleration: number;
  backend_url: string;
  duration: number;
}

// Configuration for individual SQAL tab
interface SqalConfig {
  device_id: string;
  location: string;
  interval: number;
  config_profile: string;
  duration: number;
}

// Configuration for individual Consumer tab
interface ConsumerConfig {
  feedbacks_per_hour: number;
  min_rating: number;
  max_rating: number;
  duration: number;
  use_active_lots: boolean;
}

export default function ControlPanelPage() {
  const [status, setStatus] = useState<OrchestrationStatus | null>(null);
  const [stats, setStats] = useState<ControlPanelStats | null>(null);
  const [sqalSimulators, setSqalSimulators] = useState<SimulatorStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orchestration' | 'sqal' | 'gavage' | 'consumer' | 'vl53l8ch'>('orchestration');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [logs, setLogs] = useState<{ [key: string]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Orchestration config
  const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig>({
    gavage: {
      nb_lots: 3,
      acceleration: 1440,
    },
    sqal: {
      nb_devices: 2,
      samples_per_lot: 10,
      interval: 30,
    },
    consumer: {
      num_feedbacks: 20,
      interval: 60,
      profile: 'realistic',
    },
  });

  // Individual Gavage config
  const [gavageConfig, setGavageConfig] = useState<GavageConfig>({
    nb_lots: 3,
    acceleration: 1440,
    backend_url: 'http://localhost:8000',
    duration: 0,
  });

  // Individual SQAL config
  const [sqalConfig, setSqalConfig] = useState<SqalConfig>({
    device_id: 'ESP32_LL_01',
    location: 'Lencouacq',
    interval: 30,
    config_profile: 'default',
    duration: 0,
  });

  // Individual Consumer config
  const [consumerConfig, setConsumerConfig] = useState<ConsumerConfig>({
    feedbacks_per_hour: 60,
    min_rating: 1,
    max_rating: 5,
    duration: 0,
    use_active_lots: true,
  });

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const loadData = async () => {
    try {
      const [statusData, statsData] = await Promise.all([
        api.getOrchestrationStatus(),
        api.getStats(),
      ]);
      setStatus(statusData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const loadSqalSimulators = async () => {
    try {
      const simulators = await api.listSqalSimulators();
      setSqalSimulators(simulators);
    } catch (error) {
      console.error('Failed to load SQAL simulators:', error);
    }
  };

  useEffect(() => {
    loadData();
    loadSqalSimulators();
    const interval = setInterval(() => {
      loadData();
      if (activeTab === 'sqal') {
        loadSqalSimulators();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const startCompleteDemo = async () => {
    setLoading(true);
    clearMessages();
    try {
      await api.startOrchestration({
        scenario_name: 'complete_demo',
        nb_lots: 3,
        acceleration: 1440,
        nb_sqal_devices: 2,
        feedbacks_per_hour: 10,
      });
      showSuccess('Scénario complet démarré avec succès');
      await loadData();
    } catch (error) {
      console.error('Failed to start scenario:', error);
      showError('Échec du démarrage du scénario');
    } finally {
      setLoading(false);
    }
  };

  const startCustomScenario = async () => {
    setLoading(true);
    clearMessages();
    try {
      const calculatedFeedbacksPerHour = Math.floor(3600 / scenarioConfig.consumer.interval);
      const feedbacksPerHour = Math.min(calculatedFeedbacksPerHour, 100);

      await api.startOrchestration({
        scenario_name: 'complete_demo',
        nb_lots: scenarioConfig.gavage.nb_lots,
        acceleration: scenarioConfig.gavage.acceleration,
        nb_sqal_devices: scenarioConfig.sqal.nb_devices,
        feedbacks_per_hour: feedbacksPerHour,
      });
      setShowConfigModal(false);
      showSuccess('Scénario personnalisé démarré avec succès');
      await loadData();
    } catch (error) {
      console.error('Failed to start custom scenario:', error);
      showError('Échec du démarrage du scénario personnalisé');
    } finally {
      setLoading(false);
    }
  };

  const stopAll = async () => {
    setLoading(true);
    clearMessages();
    try {
      await api.stopAllOrchestration();
      showSuccess('Tous les simulateurs arrêtés');
      await loadData();
    } catch (error) {
      console.error('Failed to stop simulators:', error);
      showError('Échec de l\'arrêt des simulateurs');
    } finally {
      setLoading(false);
    }
  };

  // Individual stop functions
  const stopGavage = async () => {
    setActionLoading('gavage');
    clearMessages();
    try {
      await api.stopGavageSimulator(true);
      showSuccess('Simulateur Gavage arrêté');
      await loadData();
    } catch (error) {
      console.error('Failed to stop Gavage:', error);
      showError('Échec de l\'arrêt du simulateur Gavage');
    } finally {
      setActionLoading(null);
    }
  };

  const stopConsumer = async () => {
    setActionLoading('consumer');
    clearMessages();
    try {
      await api.stopConsumerSimulator(true);
      showSuccess('Simulateur Consumer arrêté');
      await loadData();
    } catch (error) {
      console.error('Failed to stop Consumer:', error);
      showError('Échec de l\'arrêt du simulateur Consumer');
    } finally {
      setActionLoading(null);
    }
  };

  const stopSqalDevice = async (deviceId: string) => {
    setActionLoading(`sqal-${deviceId}`);
    clearMessages();
    try {
      await api.stopSqalSimulator(deviceId, true);
      showSuccess(`Simulateur SQAL ${deviceId} arrêté`);
      await loadData();
      await loadSqalSimulators();
    } catch (error) {
      console.error(`Failed to stop SQAL ${deviceId}:`, error);
      showError(`Échec de l'arrêt du simulateur SQAL ${deviceId}`);
    } finally {
      setActionLoading(null);
    }
  };

  const stopAllSqal = async () => {
    setActionLoading('sqal-all');
    clearMessages();
    try {
      await api.stopAllSqalSimulators(true);
      showSuccess('Tous les simulateurs SQAL arrêtés');
      await loadData();
      await loadSqalSimulators();
    } catch (error) {
      console.error('Failed to stop all SQAL:', error);
      showError('Échec de l\'arrêt des simulateurs SQAL');
    } finally {
      setActionLoading(null);
    }
  };

  // Individual start functions for tabs
  const startGavageIndividual = async () => {
    setActionLoading('start-gavage');
    clearMessages();
    try {
      await api.startGavageSimulator({
        nb_lots: gavageConfig.nb_lots,
        acceleration: gavageConfig.acceleration,
        backend_url: gavageConfig.backend_url,
        duration: gavageConfig.duration > 0 ? gavageConfig.duration : undefined,
      });
      showSuccess('Simulateur Gavage démarré');
      await loadData();
    } catch (error: any) {
      console.error('Failed to start Gavage:', error);
      showError(error.response?.data?.detail || 'Échec du démarrage du simulateur Gavage');
    } finally {
      setActionLoading(null);
    }
  };

  const startSqalIndividual = async () => {
    setActionLoading('start-sqal');
    clearMessages();
    try {
      await api.startSqalSimulator({
        device_id: sqalConfig.device_id,
        location: sqalConfig.location,
        interval: sqalConfig.interval,
        config_profile: sqalConfig.config_profile,
        duration: sqalConfig.duration > 0 ? sqalConfig.duration : undefined,
      });
      showSuccess(`Simulateur SQAL ${sqalConfig.device_id} démarré`);
      await loadData();
      await loadSqalSimulators();
    } catch (error: any) {
      console.error('Failed to start SQAL:', error);
      showError(error.response?.data?.detail || 'Échec du démarrage du simulateur SQAL');
    } finally {
      setActionLoading(null);
    }
  };

  const startConsumerIndividual = async () => {
    setActionLoading('start-consumer');
    clearMessages();
    try {
      // Ensure feedbacks_per_hour doesn't exceed 100
      const feedbacksPerHour = Math.min(consumerConfig.feedbacks_per_hour, 100);
      await api.startConsumerSimulator({
        feedbacks_per_hour: feedbacksPerHour,
        min_rating: consumerConfig.min_rating,
        max_rating: consumerConfig.max_rating,
        duration: consumerConfig.duration > 0 ? consumerConfig.duration : undefined,
        use_active_lots: consumerConfig.use_active_lots,
      });
      showSuccess('Simulateur Consumer démarré');
      await loadData();
    } catch (error: any) {
      console.error('Failed to start Consumer:', error);
      showError(error.response?.data?.detail || 'Échec du démarrage du simulateur Consumer');
    } finally {
      setActionLoading(null);
    }
  };

  const fetchSqalLogs = async (deviceId: string) => {
    try {
      const logsData = await api.getSqalSimulatorLogs(deviceId, 50);
      setLogs(prev => ({ ...prev, [deviceId]: logsData.logs || 'Pas de logs disponibles' }));
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLogs(prev => ({ ...prev, [deviceId]: 'Erreur lors de la récupération des logs' }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-500';
      case 'stopped': case 'not_found': return 'text-gray-500';
      case 'error': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 border-green-300';
      case 'stopped': case 'not_found': return 'bg-gray-100 border-gray-300';
      case 'error': return 'bg-red-100 border-red-300';
      default: return 'bg-yellow-100 border-yellow-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Control Panel V2</h1>
              <p className="text-gray-600 mt-1">Unified Simulator Management - Système Gaveurs</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/e2e-demo"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
                title="Ouvrir la page E2E Demo"
              >
                E2E Demo
              </Link>
              <button
                onClick={() => { loadData(); loadSqalSimulators(); }}
                className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 transition-colors"
                title="Rafraîchir"
              >
                <RefreshCw className="w-6 h-6 text-blue-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg flex items-center gap-3">
            <Activity className="w-5 h-5 text-green-600" />
            <span className="text-green-800">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Simulateurs</p>
                <p className="text-2xl font-bold text-gray-800">
                  {status?.overall_status?.total_simulators || 0}
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En cours</p>
                <p className="text-2xl font-bold text-green-600">
                  {status?.overall_status?.running_simulators || 0}
                </p>
              </div>
              <Play className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Lots actifs</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {status?.lots?.active_lots || 0}
                </p>
              </div>
              <Database className="w-8 h-8 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Docker</p>
                <p className={`text-xl font-bold ${stats?.docker_available ? 'text-green-600' : 'text-red-600'}`}>
                  {stats?.docker_available ? 'Disponible' : 'Indisponible'}
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Actions rapides</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={startCompleteDemo}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5" />
              Démarre Scénario Complet
            </button>
            <button
              onClick={() => setShowConfigModal(true)}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Settings className="w-5 h-5" />
              Scénario Personnalisé
            </button>
            <button
              onClick={stopAll}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Square className="w-5 h-5" />
              Arrêter tout
            </button>
          </div>
        </div>

        {/* Configuration Modal */}
        {showConfigModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold">Configuration Scénario Personnalisé</h2>
                  <p className="text-blue-100 mt-1">Paramétrez tous les simulateurs en une fois</p>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Gavage Section */}
                <div className="bg-green-50 p-5 rounded-xl border-l-4 border-green-500">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    🦆 GAVAGE (Étape 1)
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre de lots
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={scenarioConfig.gavage.nb_lots}
                        onChange={(e) => setScenarioConfig({
                          ...scenarioConfig,
                          gavage: { ...scenarioConfig.gavage, nb_lots: parseInt(e.target.value) || 1 }
                        })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Entre 1 et 10 lots</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accélération temps
                      </label>
                      <select
                        value={scenarioConfig.gavage.acceleration}
                        onChange={(e) => setScenarioConfig({
                          ...scenarioConfig,
                          gavage: { ...scenarioConfig.gavage, acceleration: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors"
                      >
                        <option value="1">×1 - Temps réel (24h/jour)</option>
                        <option value="144">×144 - Test modéré (10 min/jour)</option>
                        <option value="1440">×1440 - Test rapide (60s/jour)</option>
                        <option value="86400">×86400 - Démo ultra (1s/jour)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SQAL Section */}
                <div className="bg-purple-50 p-5 rounded-xl border-l-4 border-purple-500">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    🔬 SQAL (Auto après Gavage)
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre de devices SQAL
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={scenarioConfig.sqal.nb_devices}
                        onChange={(e) => setScenarioConfig({
                          ...scenarioConfig,
                          sqal: { ...scenarioConfig.sqal, nb_devices: parseInt(e.target.value) || 1 }
                        })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Échantillons par lot
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={scenarioConfig.sqal.samples_per_lot}
                        onChange={(e) => setScenarioConfig({
                          ...scenarioConfig,
                          sqal: { ...scenarioConfig.sqal, samples_per_lot: parseInt(e.target.value) || 1 }
                        })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Intervalle mesures (secondes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={scenarioConfig.sqal.interval}
                        onChange={(e) => setScenarioConfig({
                          ...scenarioConfig,
                          sqal: { ...scenarioConfig.sqal, interval: parseInt(e.target.value) || 1 }
                        })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Consumer Section */}
                <div className="bg-orange-50 p-5 rounded-xl border-l-4 border-orange-500">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    👤 CONSOMMATEURS (Auto après SQAL)
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre de feedbacks
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={scenarioConfig.consumer.num_feedbacks}
                        onChange={(e) => setScenarioConfig({
                          ...scenarioConfig,
                          consumer: { ...scenarioConfig.consumer, num_feedbacks: parseInt(e.target.value) || 1 }
                        })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Intervalle feedbacks (secondes)
                      </label>
                      <input
                        type="number"
                        min="36"
                        max="3600"
                        value={scenarioConfig.consumer.interval}
                        onChange={(e) => setScenarioConfig({
                          ...scenarioConfig,
                          consumer: { ...scenarioConfig.consumer, interval: parseInt(e.target.value) || 36 }
                        })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Min 36s (max 100 feedbacks/heure)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Profil distribution
                      </label>
                      <select
                        value={scenarioConfig.consumer.profile}
                        onChange={(e) => setScenarioConfig({
                          ...scenarioConfig,
                          consumer: { ...scenarioConfig.consumer, profile: e.target.value as any }
                        })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-colors"
                      >
                        <option value="realistic">Réaliste (45% satisfaits)</option>
                        <option value="positive">Optimiste (70% satisfaits)</option>
                        <option value="negative">Pessimiste (30% satisfaits)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Estimated Duration */}
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-300">
                  <h4 className="font-semibold text-gray-800 mb-2">⏱️ Durée estimée</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Gavage (14 jours)</p>
                      <p className="font-bold text-blue-600">
                        {Math.ceil(14 * 24 * 3600 / scenarioConfig.gavage.acceleration)}s
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">SQAL</p>
                      <p className="font-bold text-purple-600">
                        {scenarioConfig.sqal.samples_per_lot * scenarioConfig.sqal.interval}s/lot
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Feedbacks</p>
                      <p className="font-bold text-orange-600">
                        {scenarioConfig.consumer.num_feedbacks * scenarioConfig.consumer.interval}s
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 p-6 rounded-b-2xl flex gap-4 sticky bottom-0">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={startCustomScenario}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Lancer Scénario Complet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {(['orchestration', 'gavage', 'sqal', 'consumer', 'vl53l8ch'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab === 'orchestration' && '🎛️ '}
                  {tab === 'gavage' && '🦆 '}
                  {tab === 'sqal' && '🔬 '}
                  {tab === 'consumer' && '👤 '}
                  {tab === 'vl53l8ch' && '📊 '}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Orchestration Tab */}
            {activeTab === 'orchestration' && status && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800">Status Global</h3>

                {/* Gavage Status */}
                <div className={`p-4 rounded-lg border-2 ${getStatusBg(status.gavage.status)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-800">🦆 Simulateur Gavage</h4>
                      <p className="text-sm text-gray-600">{status.gavage.container_name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.gavage.status)}`}>
                          {status.gavage.status}
                        </span>
                        {status.gavage.uptime_seconds && (
                          <p className="text-xs text-gray-600 mt-1">
                            Uptime: {Math.floor(status.gavage.uptime_seconds / 60)}m
                          </p>
                        )}
                      </div>
                      {status.gavage.status === 'running' && (
                        <button
                          onClick={stopGavage}
                          disabled={actionLoading === 'gavage'}
                          className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <Square className="w-4 h-4" />
                          Arrêter
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* SQAL Status */}
                <div className="p-4 rounded-lg border-2 bg-white border-gray-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-800">🔬 Simulateurs SQAL</h4>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        {status.sqal.running_devices} / {status.sqal.total_devices} actifs
                      </span>
                      {status.sqal.running_devices > 0 && (
                        <button
                          onClick={stopAllSqal}
                          disabled={actionLoading === 'sqal-all'}
                          className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                        >
                          <Square className="w-4 h-4" />
                          Tout arrêter
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {status.sqal.devices.map((device) => (
                      <div key={device.device_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700">{device.device_id}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${getStatusColor(device.status)}`}>
                            {device.status}
                          </span>
                          {device.status === 'running' && (
                            <button
                              onClick={() => stopSqalDevice(device.device_id)}
                              disabled={actionLoading === `sqal-${device.device_id}`}
                              className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
                              title="Arrêter ce simulateur"
                            >
                              <Square className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Consumer Status */}
                <div className={`p-4 rounded-lg border-2 ${getStatusBg(status.consumer.status)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-800">👤 Simulateur Consumer</h4>
                      <p className="text-sm text-gray-600">{status.consumer.container_name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.consumer.status)}`}>
                        {status.consumer.status}
                      </span>
                      {status.consumer.status === 'running' && (
                        <button
                          onClick={stopConsumer}
                          disabled={actionLoading === 'consumer'}
                          className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <Square className="w-4 h-4" />
                          Arrêter
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lot Stats */}
                <div className="p-4 rounded-lg border-2 bg-indigo-50 border-indigo-300">
                  <h4 className="font-semibold text-gray-800 mb-3">📊 Statistiques Lots</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-indigo-600">{status.lots.total_lots}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Actifs</p>
                      <p className="text-2xl font-bold text-green-600">{status.lots.active_lots}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Complétés</p>
                      <p className="text-2xl font-bold text-blue-600">{status.lots.completed_lots}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">ITM moyen</p>
                      <p className="text-2xl font-bold text-purple-600">{status.lots.avg_itm.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Gavage Tab */}
            {activeTab === 'gavage' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">🦆 Simulateur Gavage</h3>
                  {status?.gavage.status === 'running' ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      En cours
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                      Arrêté
                    </span>
                  )}
                </div>

                <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                  <h4 className="font-semibold text-gray-800 mb-4">Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre de lots
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={gavageConfig.nb_lots}
                        onChange={(e) => setGavageConfig({ ...gavageConfig, nb_lots: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accélération
                      </label>
                      <select
                        value={gavageConfig.acceleration}
                        onChange={(e) => setGavageConfig({ ...gavageConfig, acceleration: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                      >
                        <option value="1">×1 - Temps réel</option>
                        <option value="60">×60 - 1 min/heure</option>
                        <option value="144">×144 - 10 min/jour</option>
                        <option value="1440">×1440 - 60s/jour</option>
                        <option value="86400">×86400 - 1s/jour</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Backend URL
                      </label>
                      <input
                        type="text"
                        value={gavageConfig.backend_url}
                        onChange={(e) => setGavageConfig({ ...gavageConfig, backend_url: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Durée (secondes, 0 = illimité)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={gavageConfig.duration}
                        onChange={(e) => setGavageConfig({ ...gavageConfig, duration: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex gap-4">
                    <button
                      onClick={startGavageIndividual}
                      disabled={actionLoading === 'start-gavage' || status?.gavage.status === 'running'}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-5 h-5" />
                      Démarrer Gavage
                    </button>
                    {status?.gavage.status === 'running' && (
                      <button
                        onClick={stopGavage}
                        disabled={actionLoading === 'gavage'}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Square className="w-5 h-5" />
                        Arrêter Gavage
                      </button>
                    )}
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>ℹ️ Info:</strong> Le simulateur de gavage génère des données de production pour les lots spécifiés.
                    L'accélération permet de compresser le temps (ex: ×1440 = 1 minute réelle = 1 jour simulé).
                  </p>
                </div>
              </div>
            )}

            {/* SQAL Tab */}
            {activeTab === 'sqal' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">🔬 Simulateurs SQAL (IoT Sensors)</h3>
                  <button
                    onClick={loadSqalSimulators}
                    className="p-2 rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors"
                  >
                    <RefreshCw className="w-5 h-5 text-purple-600" />
                  </button>
                </div>

                {/* Add New Device Form */}
                <div className="bg-purple-50 p-6 rounded-xl border border-purple-200">
                  <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5" /> Ajouter un simulateur SQAL
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Device ID
                      </label>
                      <input
                        type="text"
                        value={sqalConfig.device_id}
                        onChange={(e) => setSqalConfig({ ...sqalConfig, device_id: e.target.value })}
                        placeholder="ESP32_LL_01"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location
                      </label>
                      <select
                        value={sqalConfig.location}
                        onChange={(e) => setSqalConfig({ ...sqalConfig, location: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      >
                        <option value="Lencouacq">Lencouacq (LL)</option>
                        <option value="LeSen">Le Sen (LS)</option>
                        <option value="Mant">Mant (MT)</option>
                        <option value="Laboratory">Laboratoire</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Intervalle (secondes)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={sqalConfig.interval}
                        onChange={(e) => setSqalConfig({ ...sqalConfig, interval: parseInt(e.target.value) || 30 })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Profil config
                      </label>
                      <select
                        value={sqalConfig.config_profile}
                        onChange={(e) => setSqalConfig({ ...sqalConfig, config_profile: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      >
                        <option value="default">Default</option>
                        <option value="high_quality">Haute Qualité</option>
                        <option value="fast">Rapide</option>
                        <option value="debug">Debug</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Durée (secondes, 0 = illimité)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={sqalConfig.duration}
                        onChange={(e) => setSqalConfig({ ...sqalConfig, duration: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={startSqalIndividual}
                        disabled={actionLoading === 'start-sqal'}
                        className="w-full flex items-center justify-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="w-5 h-5" />
                        Démarrer
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active Simulators List */}
                <div className="bg-white border border-gray-200 rounded-xl">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800">Simulateurs actifs</h4>
                    {status && status.sqal.running_devices > 0 && (
                      <button
                        onClick={stopAllSqal}
                        disabled={actionLoading === 'sqal-all'}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Tout arrêter
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {sqalSimulators.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        Aucun simulateur SQAL en cours d'exécution
                      </div>
                    ) : (
                      sqalSimulators.map((sim) => (
                        <div key={sim.device_id || sim.container_name} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-800">{sim.device_id || sim.container_name}</p>
                              <p className="text-sm text-gray-600">
                                {sim.location && `📍 ${sim.location}`}
                                {sim.interval && ` • ⏱️ ${sim.interval}s`}
                                {sim.uptime_seconds && ` • 🕐 ${Math.floor(sim.uptime_seconds / 60)}m uptime`}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                sim.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {sim.status}
                              </span>
                              <button
                                onClick={() => fetchSqalLogs(sim.device_id || '')}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Voir les logs"
                              >
                                📋
                              </button>
                              {sim.status === 'running' && (
                                <button
                                  onClick={() => stopSqalDevice(sim.device_id || '')}
                                  disabled={actionLoading === `sqal-${sim.device_id}`}
                                  className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                  title="Arrêter"
                                >
                                  <Square className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          {logs[sim.device_id || ''] && (
                            <div className="mt-3 p-3 bg-gray-900 rounded-lg overflow-x-auto">
                              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                                {logs[sim.device_id || '']}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>ℹ️ Info:</strong> Les simulateurs SQAL génèrent des données de capteurs IoT (VL53L8CH ToF 8×8 + AS7341 spectral 10 canaux).
                    Chaque device simule un appareil ESP32 sur un site de production.
                  </p>
                </div>
              </div>
            )}

            {/* Consumer Tab */}
            {activeTab === 'consumer' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">👤 Simulateur Consumer Feedback</h3>
                  {status?.consumer.status === 'running' ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      En cours
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                      Arrêté
                    </span>
                  )}
                </div>

                <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                  <h4 className="font-semibold text-gray-800 mb-4">Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Feedbacks par heure
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={consumerConfig.feedbacks_per_hour}
                        onChange={(e) => setConsumerConfig({ ...consumerConfig, feedbacks_per_hour: Math.min(parseInt(e.target.value) || 1, 100) })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                      />
                      <p className="text-xs text-gray-500 mt-1">Maximum: 100 feedbacks/heure</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Durée (secondes, 0 = illimité)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={consumerConfig.duration}
                        onChange={(e) => setConsumerConfig({ ...consumerConfig, duration: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Note minimum
                      </label>
                      <select
                        value={consumerConfig.min_rating}
                        onChange={(e) => setConsumerConfig({ ...consumerConfig, min_rating: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n} ⭐</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Note maximum
                      </label>
                      <select
                        value={consumerConfig.max_rating}
                        onChange={(e) => setConsumerConfig({ ...consumerConfig, max_rating: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n} ⭐</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consumerConfig.use_active_lots}
                          onChange={(e) => setConsumerConfig({ ...consumerConfig, use_active_lots: e.target.checked })}
                          className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Utiliser uniquement les lots actifs (recommandé)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-4">
                    <button
                      onClick={startConsumerIndividual}
                      disabled={actionLoading === 'start-consumer' || status?.consumer.status === 'running'}
                      className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-5 h-5" />
                      Démarrer Consumer
                    </button>
                    {status?.consumer.status === 'running' && (
                      <button
                        onClick={stopConsumer}
                        disabled={actionLoading === 'consumer'}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Square className="w-5 h-5" />
                        Arrêter Consumer
                      </button>
                    )}
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>ℹ️ Info:</strong> Le simulateur Consumer génère des feedbacks fictifs pour les produits existants.
                    Ces données alimentent la boucle de rétroaction IA qui optimise les courbes de gavage.
                  </p>
                </div>

                {/* Feedback Loop Diagram */}
                <div className="bg-gradient-to-r from-green-50 to-orange-50 p-6 rounded-xl border border-green-200">
                  <h4 className="font-semibold text-gray-800 mb-4">🔄 Boucle de rétroaction fermée</h4>
                  <div className="flex items-center justify-between text-center text-sm">
                    <div className="flex-1">
                      <div className="w-12 h-12 mx-auto bg-green-500 rounded-full flex items-center justify-center text-white text-xl">🦆</div>
                      <p className="mt-2 font-medium">Gavage</p>
                    </div>
                    <div className="text-2xl">→</div>
                    <div className="flex-1">
                      <div className="w-12 h-12 mx-auto bg-purple-500 rounded-full flex items-center justify-center text-white text-xl">🔬</div>
                      <p className="mt-2 font-medium">SQAL</p>
                    </div>
                    <div className="text-2xl">→</div>
                    <div className="flex-1">
                      <div className="w-12 h-12 mx-auto bg-blue-500 rounded-full flex items-center justify-center text-white text-xl">📦</div>
                      <p className="mt-2 font-medium">Produit</p>
                    </div>
                    <div className="text-2xl">→</div>
                    <div className="flex-1">
                      <div className="w-12 h-12 mx-auto bg-orange-500 rounded-full flex items-center justify-center text-white text-xl">👤</div>
                      <p className="mt-2 font-medium">Consumer</p>
                    </div>
                    <div className="text-2xl">→</div>
                    <div className="flex-1">
                      <div className="w-12 h-12 mx-auto bg-red-500 rounded-full flex items-center justify-center text-white text-xl">🧠</div>
                      <p className="mt-2 font-medium">IA</p>
                    </div>
                    <div className="text-2xl">↩️</div>
                  </div>
                </div>
              </div>
            )}

            {/* VL53L8CH Viewer Tab */}
            {activeTab === 'vl53l8ch' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">📊 VL53L8CH 3D Surface Viewer</h3>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    Visualisation 3D
                  </span>
                </div>

                <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                  <h4 className="font-semibold text-gray-800 mb-4">Visualisation Interactive du Capteur VL53L8CH</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Ce viewer 3D permet d'analyser les données du capteur Time-of-Flight VL53L8CH avec une résolution de 8×8 zones.
                    La visualisation est particulièrement adaptée pour l'analyse morphologique des foies gras.
                  </p>
                  
                  <div className="bg-white rounded-lg p-4 border border-blue-300">
                    <iframe 
                      src="/vl53l8ch-viewer.html" 
                      className="w-full h-96 border-0 rounded"
                      title="VL53L8CH 3D Viewer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-gray-800 mb-2">✅ Avantages du Viewer 3D</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Visualisation intuitive de la topographie</li>
                      <li>• Détection facile des défauts de surface</li>
                      <li>• Analyse des variations de hauteur</li>
                      <li>• Comparaison avec les standards qualité</li>
                    </ul>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <h4 className="font-semibold text-gray-800 mb-2">📈 Données Visualisées</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Matrice de distance (8×8 zones)</li>
                      <li>• Carte de réflectance IR</li>
                      <li>• Amplitude du signal</li>
                      <li>• Localisation des défauts détectés</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-gray-800 mb-2">🎯 Contrôles Disponibles</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div>
                      <strong>Vues:</strong> Perspective, Dessus, Face, Côté
                    </div>
                    <div>
                      <strong>Données:</strong> Hauteur, Réflectance, Amplitude, Défauts
                    </div>
                    <div>
                      <strong>Options:</strong> Wireframe, Auto-rotation
                    </div>
                    <div>
                      <strong>Échelle:</strong> Ajustable de 0.1x à 2x
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
