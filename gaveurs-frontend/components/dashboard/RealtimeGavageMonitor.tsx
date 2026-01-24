/**
 * Composant de monitoring temps réel des gavages
 * Affiche les derniers gavages reçus via WebSocket
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRealtimeGavage, GavageRealtimeData } from '@/hooks/useRealtimeGavage';
import { Activity, Wifi, WifiOff, TrendingUp, Droplet, ThermometerSun } from 'lucide-react';

const MAX_HISTORY = 20; // Nombre de gavages à afficher

export default function RealtimeGavageMonitor() {
  const [history, setHistory] = useState<GavageRealtimeData[]>([]);
  const [stats, setStats] = useState({
    total_today: 0,
    avg_poids: 0,
    avg_mortalite: 0,
  });

  // Hook WebSocket
  const { lastMessage, isConnected, error, reconnectAttempts } = useRealtimeGavage({
    enabled: true,
    onMessage: (data) => {
      console.log('Nouveau gavage reçu:', data);
    },
  });

  // Ajouter nouveau message à l'historique
  useEffect(() => {
    if (lastMessage) {
      setHistory((prev) => {
        const newHistory = [lastMessage, ...prev].slice(0, MAX_HISTORY);
        return newHistory;
      });
    }
  }, [lastMessage]);

  // Calculer statistiques
  useEffect(() => {
    if (history.length > 0) {
      const total = history.length;
      const avgPoids = history.reduce((sum, g) => sum + g.poids_moyen, 0) / total;
      const avgMortalite = history.reduce((sum, g) => sum + g.taux_mortalite, 0) / total;

      setStats({
        total_today: total,
        avg_poids: avgPoids,
        avg_mortalite: avgMortalite,
      });
    }
  }, [history]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getMomentIcon = (moment: string) => {
    return moment === 'matin' ? '☀️' : '🌙';
  };

  const getMortaliteColor = (taux: number) => {
    if (taux < 3) return 'text-green-600';
    if (taux < 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      {/* Header avec statut connexion */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-gray-800">
            Gavages en Temps Réel
          </h2>
        </div>

        {/* Indicateur connexion */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi className="text-green-500" size={20} />
              <span className="text-sm text-green-600 font-medium">Connecté</span>
            </>
          ) : (
            <>
              <WifiOff className="text-red-500" size={20} />
              <span className="text-sm text-red-600 font-medium">
                Déconnecté
                {reconnectAttempts > 0 && ` (tentative ${reconnectAttempts})`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-600" size={20} />
            <div>
              <p className="text-sm text-blue-600 font-medium">Gavages reçus</p>
              <p className="text-2xl font-bold text-blue-900">{stats.total_today}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-green-600" size={20} />
            <div>
              <p className="text-sm text-green-600 font-medium">Poids moyen</p>
              <p className="text-2xl font-bold text-green-900">
                {stats.avg_poids.toFixed(0)}g
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
          <div className="flex items-center gap-3">
            <Droplet className="text-purple-600" size={20} />
            <div>
              <p className="text-sm text-purple-600 font-medium">Mortalité moy.</p>
              <p className="text-2xl font-bold text-purple-900">
                {stats.avg_mortalite.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des gavages */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-700">
            Derniers gavages ({history.length})
          </h3>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Activity className="mx-auto mb-2" size={32} />
              <p>En attente de données temps réel...</p>
              <p className="text-sm mt-1">
                Les gavages s'afficheront automatiquement
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((gavage, idx) => (
                <div
                  key={`${gavage.code_lot}-${gavage.timestamp}-${idx}`}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    {/* Informations principales */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">
                          {getMomentIcon(gavage.moment)}
                        </span>
                        <span className="font-bold text-gray-800">
                          {gavage.code_lot}
                        </span>
                        <span className="text-sm text-gray-500">
                          J{gavage.jour} {gavage.moment}
                        </span>
                        {gavage.pret_abattage && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                            Prêt abattage
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        {gavage.gaveur_nom} • Site {gavage.site} • {gavage.genetique}
                      </div>

                      {/* Métriques */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Dose:</span>
                          <span className="ml-1 font-semibold text-gray-700">
                            {gavage.dose_reelle.toFixed(1)}g
                          </span>
                          <span className="text-gray-400 ml-1">
                            ({gavage.dose_theorique.toFixed(0)}g)
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-500">Poids:</span>
                          <span className="ml-1 font-semibold text-gray-700">
                            {gavage.poids_moyen.toFixed(0)}g
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-500">Vivants:</span>
                          <span className="ml-1 font-semibold text-gray-700">
                            {gavage.nb_canards_vivants}
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-500">Mortalité:</span>
                          <span
                            className={`ml-1 font-semibold ${getMortaliteColor(
                              gavage.taux_mortalite
                            )}`}
                          >
                            {gavage.taux_mortalite.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Conditions environnementales */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <ThermometerSun size={14} />
                          <span>{gavage.temperature_stabule.toFixed(1)}°C</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Droplet size={14} />
                          <span>{gavage.humidite_stabule.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs text-gray-400 ml-4">
                      {formatTimestamp(gavage.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
