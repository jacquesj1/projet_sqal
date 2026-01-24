'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Thermometer, Droplets, Wind, Sun, AlertTriangle, RefreshCw } from 'lucide-react';
import { environnementApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { ConditionsEnvironnementales } from '@/lib/types';

export default function EnvironnementPage() {
  const [conditions, setConditions] = useState<ConditionsEnvironnementales[]>([]);
  const [currentConditions, setCurrentConditions] = useState<ConditionsEnvironnementales | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStabule, setSelectedStabule] = useState(1);
  const [alertes, setAlertes] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh toutes les 30s
    return () => clearInterval(interval);
  }, [selectedStabule]);

  const loadData = async () => {
    try {
      const data = await environnementApi.getByStabule(selectedStabule) as ConditionsEnvironnementales[];
      setConditions(data);

      if (data.length > 0) {
        const latest = data[data.length - 1];
        setCurrentConditions(latest);
        checkAlertes(latest);
      }
    } catch (error) {
      console.error('Erreur chargement environnement:', error);
      // Données de démo
      const mockData = generateMockData();
      setConditions(mockData);
      setCurrentConditions(mockData[mockData.length - 1]);
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = (): ConditionsEnvironnementales[] => {
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      time: new Date(now.getTime() - (23 - i) * 3600000).toISOString(),
      stabule_id: selectedStabule,
      temperature: 20 + Math.random() * 4,
      humidite: 55 + Math.random() * 15,
      co2_ppm: 800 + Math.random() * 400,
      nh3_ppm: 10 + Math.random() * 10,
      luminosite_lux: i >= 6 && i <= 20 ? 300 + Math.random() * 200 : 10,
      qualite_air_score: 70 + Math.random() * 25,
    }));
  };

  const checkAlertes = (data: ConditionsEnvironnementales) => {
    const newAlertes: string[] = [];

    if (data.temperature < 18) newAlertes.push('Température trop basse');
    if (data.temperature > 26) newAlertes.push('Température trop haute');
    if (data.humidite < 50) newAlertes.push('Humidité trop basse');
    if (data.humidite > 80) newAlertes.push('Humidité trop haute');
    if (data.co2_ppm > 3000) newAlertes.push('CO2 élevé - Ventiler');
    if (data.nh3_ppm > 25) newAlertes.push('NH3 élevé - Danger');

    setAlertes(newAlertes);
  };

  const getQualiteColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualiteLabel = (score: number) => {
    if (score >= 80) return 'Excellente';
    if (score >= 60) return 'Bonne';
    if (score >= 40) return 'Moyenne';
    return 'Mauvaise';
  };

  const chartData = conditions.map((c) => ({
    time: new Date(c.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    temperature: c.temperature,
    humidite: c.humidite,
    co2: c.co2_ppm,
    nh3: c.nh3_ppm,
    qualite: c.qualite_air_score,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
            <Thermometer className="text-orange-600" size={40} />
            Conditions Environnementales
          </h1>

          <div className="flex items-center gap-4">
            <select
              value={selectedStabule}
              onChange={(e) => setSelectedStabule(Number(e.target.value))}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>Stabule 1</option>
              <option value={2}>Stabule 2</option>
              <option value={3}>Stabule 3</option>
            </select>

            <button
              onClick={loadData}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        {/* Alertes */}
        {alertes.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-red-600" size={24} />
              <h3 className="font-bold text-red-800">Alertes Environnementales</h3>
            </div>
            <ul className="list-disc list-inside text-red-700">
              {alertes.map((alerte, idx) => (
                <li key={idx}>{alerte}</li>
              ))}
            </ul>
          </div>
        )}

        {/* KPIs actuels */}
        {currentConditions && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <Thermometer className="text-orange-500" size={20} />
                <span className="text-sm text-gray-600">Température</span>
              </div>
              <p className="text-3xl font-bold text-orange-600">
                {currentConditions.temperature.toFixed(1)}°C
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="text-blue-500" size={20} />
                <span className="text-sm text-gray-600">Humidité</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">
                {currentConditions.humidite.toFixed(0)}%
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wind className="text-gray-500" size={20} />
                <span className="text-sm text-gray-600">CO2</span>
              </div>
              <p
                className={`text-3xl font-bold ${
                  currentConditions.co2_ppm > 3000 ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                {currentConditions.co2_ppm.toFixed(0)} ppm
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wind className="text-purple-500" size={20} />
                <span className="text-sm text-gray-600">NH3</span>
              </div>
              <p
                className={`text-3xl font-bold ${
                  currentConditions.nh3_ppm > 25 ? 'text-red-600' : 'text-purple-600'
                }`}
              >
                {currentConditions.nh3_ppm.toFixed(1)} ppm
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sun className="text-yellow-500" size={20} />
                <span className="text-sm text-gray-600">Luminosité</span>
              </div>
              <p className="text-3xl font-bold text-yellow-600">
                {currentConditions.luminosite_lux.toFixed(0)} lux
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-600">Qualité Air</span>
              </div>
              <p className={`text-3xl font-bold ${getQualiteColor(currentConditions.qualite_air_score)}`}>
                {currentConditions.qualite_air_score.toFixed(0)}%
              </p>
              <p className={`text-sm ${getQualiteColor(currentConditions.qualite_air_score)}`}>
                {getQualiteLabel(currentConditions.qualite_air_score)}
              </p>
            </div>
          </div>
        )}

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Température & Humidité */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="font-bold text-lg mb-4">Température & Humidité (24h)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" domain={[15, 30]} />
                <YAxis yAxisId="right" orientation="right" domain={[40, 90]} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#f97316"
                  name="Température (°C)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="humidite"
                  stroke="#3b82f6"
                  name="Humidité (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* CO2 & NH3 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="font-bold text-lg mb-4">Qualité de l&apos;Air (24h)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="co2"
                  stroke="#6b7280"
                  fill="#9ca3af"
                  fillOpacity={0.3}
                  name="CO2 (ppm)"
                />
                <Area
                  type="monotone"
                  dataKey="nh3"
                  stroke="#a855f7"
                  fill="#c084fc"
                  fillOpacity={0.3}
                  name="NH3 (ppm)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Score Qualité */}
          <div className="bg-white rounded-lg shadow-lg p-6 lg:col-span-2">
            <h3 className="font-bold text-lg mb-4">Score Qualité Air (24h)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="qualite"
                  stroke="#10b981"
                  fill="#34d399"
                  fillOpacity={0.5}
                  name="Score Qualité (%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recommandations */}
        <div className="mt-6 bg-blue-50 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-4 text-blue-900">Recommandations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium mb-2">Température idéale</h4>
              <p className="text-sm text-gray-600">Maintenir entre 18°C et 24°C</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium mb-2">Humidité idéale</h4>
              <p className="text-sm text-gray-600">Maintenir entre 55% et 75%</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium mb-2">CO2 maximum</h4>
              <p className="text-sm text-gray-600">Ne pas dépasser 3000 ppm</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium mb-2">NH3 maximum</h4>
              <p className="text-sm text-gray-600">Ne pas dépasser 25 ppm</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
