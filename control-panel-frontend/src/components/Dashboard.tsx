// ==============================================================================
// Dashboard Component - Main Control Panel Interface
// ==============================================================================

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { SimulatorStatusInfo, ControlPanelStats, ScenarioName } from '../types';
import { Play, Square, Trash2, Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export function Dashboard() {
  const [stats, setStats] = useState<ControlPanelStats | null>(null);
  const [simulators, setSimulators] = useState<SimulatorStatusInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);

  // Fetch data
  const fetchData = async () => {
    try {
      const [statsData, simulatorsData] = await Promise.all([
        api.getStats(),
        api.listSimulators(),
      ]);
      setStats(statsData);
      setSimulators(simulatorsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Start simulator
  const handleStart = async (deviceId: string) => {
    try {
      await api.startSimulator({
        device_id: deviceId,
        location: `Manual Start - ${deviceId}`,
        interval: 30,
        config_profile: 'foiegras_standard_barquette',
        duration: 0,
      });
      await fetchData();
    } catch (err: any) {
      alert(`Failed to start ${deviceId}: ${err.message}`);
    }
  };

  // Stop simulator
  const handleStop = async (deviceId: string, force: boolean = false) => {
    try {
      await api.stopSimulator({ device_id: deviceId, force });
      await fetchData();
    } catch (err: any) {
      alert(`Failed to stop ${deviceId}: ${err.message}`);
    }
  };

  // Stop all simulators
  const handleStopAll = async () => {
    if (!confirm('Stop all running simulators?')) return;
    try {
      await api.stopAllSimulators(false);
      await fetchData();
    } catch (err: any) {
      alert(`Failed to stop all: ${err.message}`);
    }
  };

  // Start scenario
  const handleScenario = async (scenario: ScenarioName) => {
    try {
      await api.startScenario({ scenario_name: scenario, duration: 0 });
      await fetchData();
    } catch (err: any) {
      alert(`Failed to start scenario: ${err.message}`);
    }
  };

  // Status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      running: 'bg-green-100 text-green-800 border-green-300',
      stopped: 'bg-gray-100 text-gray-800 border-gray-300',
      error: 'bg-red-100 text-red-800 border-red-300',
      not_found: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    };

    const icons = {
      running: <CheckCircle className="w-4 h-4" />,
      stopped: <XCircle className="w-4 h-4" />,
      error: <AlertCircle className="w-4 h-4" />,
      not_found: <AlertCircle className="w-4 h-4" />,
    };

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.error}`}>
        {icons[status as keyof typeof icons]}
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">SQAL Simulators Control Panel</h1>
            <div className="flex items-center gap-4">
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                <option value={2000}>Refresh: 2s</option>
                <option value={5000}>Refresh: 5s</option>
                <option value={10000}>Refresh: 10s</option>
                <option value={30000}>Refresh: 30s</option>
              </select>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                Refresh Now
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Error: {error}</span>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Simulators"
              value={stats.total_simulators}
              icon={<Activity className="w-6 h-6" />}
              color="blue"
            />
            <StatCard
              title="Running"
              value={stats.running_simulators}
              icon={<CheckCircle className="w-6 h-6" />}
              color="green"
            />
            <StatCard
              title="Stopped"
              value={stats.stopped_simulators}
              icon={<XCircle className="w-6 h-6" />}
              color="gray"
            />
            <StatCard
              title="Errors"
              value={stats.error_simulators}
              icon={<AlertCircle className="w-6 h-6" />}
              color="red"
            />
          </div>
        )}

        {/* Scenarios */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pre-configured Scenarios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleScenario('multi_site')}
              className="p-4 border-2 border-primary-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-all text-left"
            >
              <h3 className="font-semibold text-gray-900 mb-1">Multi-Site Demo</h3>
              <p className="text-sm text-gray-600">4 simulators across 3 Euralis sites</p>
            </button>
            <button
              onClick={() => handleScenario('stress_test')}
              className="p-4 border-2 border-orange-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-all text-left"
            >
              <h3 className="font-semibold text-gray-900 mb-1">Stress Test</h3>
              <p className="text-sm text-gray-600">10 simulators at 10s intervals</p>
            </button>
            <button
              onClick={() => handleScenario('production_demo')}
              className="p-4 border-2 border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all text-left"
            >
              <h3 className="font-semibold text-gray-900 mb-1">Production Demo</h3>
              <p className="text-sm text-gray-600">2 production lines simulation</p>
            </button>
          </div>
        </div>

        {/* Simulators Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Active Simulators</h2>
            {simulators.some(s => s.status === 'running') && (
              <button
                onClick={handleStopAll}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                Stop All
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uptime</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {simulators.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No simulators found. Start a scenario or create a new simulator.
                    </td>
                  </tr>
                ) : (
                  simulators.map((sim) => (
                    <tr key={sim.device_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {sim.device_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={sim.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {sim.location || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {sim.uptime_seconds ? formatUptime(sim.uptime_seconds) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          {sim.status === 'running' ? (
                            <>
                              <button
                                onClick={() => handleStop(sim.device_id, false)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title="Stop"
                              >
                                <Square className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleStop(sim.device_id, true)}
                                className="p-1.5 text-red-700 hover:bg-red-100 rounded"
                                title="Force Kill"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStart(sim.device_id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="Start"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components
function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg border ${colors[color as keyof typeof colors]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Helper function
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}
