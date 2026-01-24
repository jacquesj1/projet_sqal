/**
 * Composant de monitoring temps réel multi-sites Euralis
 * Affiche l'agrégation des gavages par site (LL, LS, MT)
 */

'use client';

import { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff, TrendingUp, MapPin, Users } from 'lucide-react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

interface GavageRealtimeData {
  code_lot: string;
  gaveur_id: number;
  gaveur_nom: string;
  site: string;
  genetique: string;
  jour: number;
  moment: 'matin' | 'soir';
  dose_reelle: number;
  poids_moyen: number;
  nb_canards_vivants: number;
  taux_mortalite: number;
  timestamp: string;
}

interface SiteStats {
  site: string;
  nb_lots_actifs: number;
  total_canards: number;
  poids_moyen: number;
  taux_mortalite_moyen: number;
  derniere_mise_a_jour: string;
  gavages_count: number;
}

const SITES = [
  { code: 'LL', nom: 'Site Bretagne', region: 'Bretagne' },
  { code: 'LS', nom: 'Site Pays de Loire', region: 'Pays de Loire' },
  { code: 'MT', nom: 'Site Maubourguet', region: 'Occitanie' },
];

export default function RealtimeSitesMonitor() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const [siteStats, setSiteStats] = useState<Map<string, SiteStats>>(
    new Map(
      SITES.map((s) => [
        s.code,
        {
          site: s.code,
          nb_lots_actifs: 0,
          total_canards: 0,
          poids_moyen: 0,
          taux_mortalite_moyen: 0,
          derniere_mise_a_jour: new Date().toISOString(),
          gavages_count: 0,
        },
      ])
    )
  );

  const [recentActivity, setRecentActivity] = useState<GavageRealtimeData[]>([]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let currentReconnectAttempts = 0;

    // Charger les statistiques historiques et gavages récents au démarrage
    const loadInitialStats = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        // Charger les sites
        const sitesResponse = await fetch(`${API_URL}/api/euralis/sites`);
        const sites = await sitesResponse.json();

        // Charger les gavages récents (dernières 24h)
        const gavagesResponse = await fetch(`${API_URL}/api/euralis/gavages/recent?limit=20`);
        const gavages = await gavagesResponse.json();

        console.log(`✅ ${gavages.length} gavages récents chargés depuis l'API`);

        // Initialiser les stats avec les sites
        const initialStats = new Map(
          sites.map((site: any) => [
            site.code,
            {
              site: site.code,
              nb_lots_actifs: 0,
              total_canards: 0,
              poids_moyen: 0,
              taux_mortalite_moyen: 0,
              derniere_mise_a_jour: new Date().toISOString(),
              gavages_count: 0,
            },
          ])
        );

        // Agréger les gavages par site
        gavages.forEach((gavage: any) => {
          const siteCode = gavage.site;
          const currentStats = initialStats.get(siteCode);

          if (currentStats) {
            const newStats = {
              ...currentStats,
              total_canards: gavage.nb_canards_vivants || currentStats.total_canards,
              poids_moyen:
                currentStats.gavages_count === 0
                  ? gavage.poids_moyen
                  : (currentStats.poids_moyen * currentStats.gavages_count + gavage.poids_moyen) /
                    (currentStats.gavages_count + 1),
              taux_mortalite_moyen:
                currentStats.gavages_count === 0
                  ? gavage.taux_mortalite
                  : (currentStats.taux_mortalite_moyen * currentStats.gavages_count +
                      gavage.taux_mortalite) /
                    (currentStats.gavages_count + 1),
              derniere_mise_a_jour: gavage.timestamp,
              gavages_count: currentStats.gavages_count + 1,
            };

            initialStats.set(siteCode, newStats);
          }
        });

        setSiteStats(initialStats);
        setRecentActivity(gavages.slice(0, 10)); // Afficher les 10 derniers

        console.log('✅ Statistiques initiales chargées depuis l\'API');
      } catch (error) {
        console.error('Erreur chargement statistiques initiales:', error);
      }
    };

    // Charger les stats avant de se connecter au WebSocket
    loadInitialStats();

    const connect = () => {
      try {
        ws = new WebSocket(`${WS_URL}/ws/realtime/`);

        ws.onopen = () => {
          console.log('✅ WebSocket Euralis connecté');
          setIsConnected(true);
          setError(null);
          currentReconnectAttempts = 0;
          setReconnectAttempts(0);

          // Heartbeat
          heartbeatInterval = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'heartbeat' }));
            }
          }, 30000);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.type === 'gavage_realtime') {
              const gavageData = message.data as GavageRealtimeData;

              // Mise à jour statistiques site
              setSiteStats((prev) => {
                const newStats = new Map(prev);
                const siteCode = gavageData.site;
                const currentStats = newStats.get(siteCode);

                if (currentStats) {
                  // Agrégation simplifiée (moyenne mobile)
                  const newStats_updated: SiteStats = {
                    ...currentStats,
                    total_canards: gavageData.nb_canards_vivants,
                    poids_moyen:
                      (currentStats.poids_moyen * currentStats.gavages_count +
                        gavageData.poids_moyen) /
                      (currentStats.gavages_count + 1),
                    taux_mortalite_moyen:
                      (currentStats.taux_mortalite_moyen * currentStats.gavages_count +
                        gavageData.taux_mortalite) /
                      (currentStats.gavages_count + 1),
                    derniere_mise_a_jour: gavageData.timestamp,
                    gavages_count: currentStats.gavages_count + 1,
                  };

                  newStats.set(siteCode, newStats_updated);
                }

                return newStats;
              });

              // Ajouter à l'activité récente
              setRecentActivity((prev) => [gavageData, ...prev].slice(0, 10));

              console.log(
                `📊 Gavage ${gavageData.site}: ${gavageData.code_lot} J${gavageData.jour}`
              );
            }
          } catch (err) {
            console.error('Erreur parsing message:', err);
          }
        };

        ws.onerror = (event) => {
          console.error('❌ Erreur WebSocket Euralis:', event);
          setError('Erreur de connexion');
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('🔌 WebSocket Euralis fermé');
          setIsConnected(false);

          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
          }

          // Reconnexion automatique (max 10 tentatives)
          if (currentReconnectAttempts < 10) {
            currentReconnectAttempts++;
            console.log(`🔄 Reconnexion dans 5s (tentative ${currentReconnectAttempts}/10)`);
            setReconnectAttempts(currentReconnectAttempts);
            reconnectTimeout = setTimeout(() => {
              connect();
            }, 5000);
          }
        };
      } catch (err) {
        console.error('Erreur création WebSocket:', err);
        setError('Impossible de se connecter');
      }
    };

    connect();

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSiteInfo = (code: string) => {
    return SITES.find((s) => s.code === code);
  };

  const totalCanards = Array.from(siteStats.values()).reduce(
    (sum, s) => sum + s.total_canards,
    0
  );
  const avgPoidsMoyen =
    Array.from(siteStats.values()).reduce((sum, s) => sum + s.poids_moyen, 0) /
    siteStats.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="text-blue-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800">
            Supervision Temps Réel Multi-Sites
          </h2>
        </div>

        {/* Statut connexion */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50">
          {isConnected ? (
            <>
              <Wifi className="text-green-500" size={20} />
              <span className="text-sm font-medium text-green-600">Connecté</span>
            </>
          ) : (
            <>
              <WifiOff className="text-red-500" size={20} />
              <span className="text-sm font-medium text-red-600">
                Déconnecté
                {reconnectAttempts > 0 && ` (${reconnectAttempts}/10)`}
              </span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
          <div className="flex items-center gap-3">
            <MapPin className="text-blue-600" size={24} />
            <div>
              <p className="text-sm text-blue-600 font-semibold">Sites actifs</p>
              <p className="text-3xl font-bold text-blue-900">{SITES.length}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
          <div className="flex items-center gap-3">
            <Users className="text-green-600" size={24} />
            <div>
              <p className="text-sm text-green-600 font-semibold">Total canards</p>
              <p className="text-3xl font-bold text-green-900">{totalCanards}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-purple-600" size={24} />
            <div>
              <p className="text-sm text-purple-600 font-semibold">Poids moyen global</p>
              <p className="text-3xl font-bold text-purple-900">
                {avgPoidsMoyen.toFixed(0)}g
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques par site */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SITES.map((site) => {
          const stats = siteStats.get(site.code);
          if (!stats) return null;

          return (
            <div
              key={site.code}
              className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* Header site */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{site.nom}</h3>
                    <p className="text-sm opacity-90">{site.region}</p>
                  </div>
                  <span className="text-4xl">
                    {site.code === 'LL' ? '🏭' : site.code === 'LS' ? '🏭' : '🏭'}
                  </span>
                </div>
              </div>

              {/* Statistiques */}
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Canards:</span>
                  <span className="font-bold text-gray-900">{stats.total_canards}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Poids moyen:</span>
                  <span className="font-bold text-green-600">
                    {stats.poids_moyen.toFixed(0)}g
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Mortalité moy.:</span>
                  <span
                    className={`font-bold ${
                      stats.taux_mortalite_moyen < 3
                        ? 'text-green-600'
                        : stats.taux_mortalite_moyen < 5
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {stats.taux_mortalite_moyen.toFixed(1)}%
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-400">
                    Dernière MàJ: {formatTimestamp(stats.derniere_mise_a_jour)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {stats.gavages_count} gavages reçus
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activité récente */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-bold text-gray-800 text-lg">
            Activité Récente ({recentActivity.length})
          </h3>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {recentActivity.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Activity className="mx-auto mb-2" size={32} />
              <p>En attente de données temps réel...</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentActivity.map((activity, idx) => {
                const siteInfo = getSiteInfo(activity.site);

                return (
                  <div
                    key={`${activity.code_lot}-${activity.timestamp}-${idx}`}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="px-2 py-1 rounded font-bold text-white text-sm"
                          style={{
                            backgroundColor:
                              activity.site === 'LL'
                                ? '#3b82f6'
                                : activity.site === 'LS'
                                ? '#10b981'
                                : '#f59e0b',
                          }}
                        >
                          {activity.site}
                        </span>

                        <div>
                          <div className="font-bold text-gray-800">
                            {activity.code_lot}
                          </div>
                          <div className="text-sm text-gray-600">
                            {activity.gaveur_nom} • {siteInfo?.region}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            J{activity.jour} {activity.moment === 'matin' ? '☀️' : '🌙'}
                          </span>
                          <span className="font-bold text-green-600">
                            {activity.poids_moyen.toFixed(0)}g
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {formatTimestamp(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
