'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, TrendingUp, Users, Bird, Clock, ArrowRight } from 'lucide-react';
import { KPICard } from '@/components/ui/Card';
import { canardApi, gavageApi, alerteApi, analyticsApi } from '@/lib/api';
import { DEFAULT_GAVEUR_ID } from '@/lib/constants';
import { formatDateTime, getNiveauColor, getNiveauIcon } from '@/lib/utils';
import type { Canard, GavageData, Alerte, RapportHebdomadaire } from '@/lib/types';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [canards, setCanards] = useState<Canard[]>([]);
  const [recentGavages, setRecentGavages] = useState<GavageData[]>([]);
  const [alertesCritiques, setAlertesCritiques] = useState<Alerte[]>([]);
  const [rapport, setRapport] = useState<RapportHebdomadaire | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [canardsData, gavagesData, alertesData, rapportData] = await Promise.all([
        canardApi.getByGaveur(DEFAULT_GAVEUR_ID),
        gavageApi.getByGaveur(DEFAULT_GAVEUR_ID, 10),
        alerteApi.getByGaveur(DEFAULT_GAVEUR_ID, false),
        analyticsApi.getWeeklyReport(DEFAULT_GAVEUR_ID),
      ]);

      setCanards(Array.isArray(canardsData) ? canardsData as Canard[] : []);
      setRecentGavages(Array.isArray(gavagesData) ? gavagesData as GavageData[] : []);

      // Vérifier que alertesData est un tableau avant de filtrer
      if (Array.isArray(alertesData)) {
        setAlertesCritiques(
          (alertesData as Alerte[]).filter((a: Alerte) => a.niveau === 'critique').slice(0, 5)
        );
      } else {
        console.warn('alertesData is not an array:', alertesData);
        setAlertesCritiques([]);
      }

      setRapport(rapportData as RapportHebdomadaire);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      // Initialiser avec des valeurs par défaut en cas d'erreur
      setCanards([]);
      setRecentGavages([]);
      setAlertesCritiques([]);
      setRapport(null);
    } finally {
      setLoading(false);
    }
  };

  const canardsActifs = canards.filter((c) => c.statut === 'en_gavage').length;
  const gavagesAujourdhui = recentGavages.filter((g) => {
    const today = new Date().toDateString();
    return new Date(g.time).toDateString() === today;
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">
          Dashboard Gaveur
        </h1>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            icon={<Bird size={32} />}
            label="Canards Actifs"
            value={canardsActifs}
            color="blue"
            subtitle={`sur ${canards.length} total`}
          />
          <KPICard
            icon={<Activity size={32} />}
            label="Gavages Aujourd'hui"
            value={gavagesAujourdhui}
            color="green"
          />
          <KPICard
            icon={<AlertTriangle size={32} />}
            label="Alertes Critiques"
            value={alertesCritiques.length}
            color="red"
          />
          <KPICard
            icon={<TrendingUp size={32} />}
            label="Performance Moyenne"
            value={rapport?.statistiques?.gain_moyen_g ? `${rapport.statistiques.gain_moyen_g.toFixed(0)}g/j` : '-'}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alertes Urgentes */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="text-red-600" />
                Alertes Urgentes
              </h2>
              <Link
                href="/alertes"
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Voir tout <ArrowRight size={18} />
              </Link>
            </div>

            {alertesCritiques.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl">✅</span>
                <p className="text-gray-600 mt-2">Aucune alerte critique</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alertesCritiques.map((alerte) => (
                  <div
                    key={alerte.id}
                    className={`border-l-4 p-4 rounded-lg ${getNiveauColor(alerte.niveau)}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl">{getNiveauIcon(alerte.niveau)}</span>
                      <div className="flex-1">
                        <p className="font-bold">{alerte.type_alerte}</p>
                        <p className="text-sm">{alerte.message}</p>
                        <p className="text-xs opacity-75 mt-1">
                          Canard #{alerte.canard_id} - {formatDateTime(alerte.time)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activité Récente */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Clock className="text-blue-600" />
                Activité Récente
              </h2>
              <Link
                href="/gavage"
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Nouveau gavage <ArrowRight size={18} />
              </Link>
            </div>

            {recentGavages.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl">📝</span>
                <p className="text-gray-600 mt-2">Aucun gavage récent</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentGavages.slice(0, 5).map((gavage) => (
                  <div
                    key={gavage.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🌽</span>
                      <div>
                        <p className="font-medium">Canard #{gavage.canard_id}</p>
                        <p className="text-sm text-gray-600">
                          {gavage.dose_matin}g matin / {gavage.dose_soir}g soir
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">
                        {gavage.gain_poids ? `+${gavage.gain_poids}g` : '-'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(gavage.time)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Performers */}
        {rapport?.top_performers && rapport.top_performers.length > 0 && (
          <div className="mt-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-lg p-6 border-2 border-indigo-200">
            <h2 className="text-2xl font-bold mb-6 text-indigo-900 flex items-center gap-2">
              🏆 Top Performers de la Semaine
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {rapport.top_performers.map((perf, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-white p-4 rounded-lg shadow"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </span>
                    <span className="font-medium">{perf.numero}</span>
                  </div>
                  <span className="font-bold text-green-600">
                    {perf.gain_moyen.toFixed(0)}g/jour
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/gavage"
            className="bg-blue-600 text-white p-6 rounded-lg shadow-lg hover:bg-blue-700 transition-colors text-center"
          >
            <span className="text-3xl block mb-2">🌽</span>
            <span className="font-bold">Saisir Gavage</span>
          </Link>
          <Link
            href="/canards"
            className="bg-green-600 text-white p-6 rounded-lg shadow-lg hover:bg-green-700 transition-colors text-center"
          >
            <span className="text-3xl block mb-2">🦆</span>
            <span className="font-bold">Mes Canards</span>
          </Link>
          <Link
            href="/analytics"
            className="bg-purple-600 text-white p-6 rounded-lg shadow-lg hover:bg-purple-700 transition-colors text-center"
          >
            <span className="text-3xl block mb-2">📊</span>
            <span className="font-bold">Analytics</span>
          </Link>
          <Link
            href="/blockchain"
            className="bg-orange-600 text-white p-6 rounded-lg shadow-lg hover:bg-orange-700 transition-colors text-center"
          >
            <span className="text-3xl block mb-2">🔗</span>
            <span className="font-bold">Blockchain</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
