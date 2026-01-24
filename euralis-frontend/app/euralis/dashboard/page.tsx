'use client';

import React, { useEffect, useState } from 'react';
import KPICard from '@/components/euralis/kpis/KPICard';
import RealtimeSitesMonitor from '@/components/realtime/RealtimeSitesMonitor';
import { euralisAPI } from '@/lib/euralis/api';
import type { DashboardKPIs, Alerte, Site } from '@/lib/euralis/types';

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Charger données en parallèle
        const [kpisData, alertesData, sitesData] = await Promise.all([
          euralisAPI.getDashboardKPIs(),
          euralisAPI.getAlertes(undefined, undefined, 'critique', false, 10),
          euralisAPI.getSites(),
        ]);

        setKpis(kpisData);
        setAlertes(alertesData);
        setSites(sitesData);
        setError(null);
      } catch (err) {
        console.error('Erreur chargement dashboard:', err);
        setError('Impossible de charger les données du dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold">Erreur</h3>
        <p className="text-red-600 mt-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Dashboard Multi-Sites
        </h1>
        <p className="text-gray-600 mt-2">
          Vue globale de la production Euralis - 3 sites (LL, LS, MT)
        </p>
      </div>

      {/* KPIs Globaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Production Totale"
          value={`${(kpis?.production_totale_kg || 0).toFixed(1)} T`}
          icon={<span className="text-4xl">📈</span>}
          color="blue"
          trend={{ value: 12, direction: 'up' }}
        />

        <KPICard
          title="Lots Actifs"
          value={kpis?.nb_lots_actifs || 0}
          icon={<span className="text-4xl">🦆</span>}
          color="green"
          subtitle={`${kpis?.nb_lots_termines || 0} terminés`}
        />

        <KPICard
          title="Gaveurs Actifs"
          value={kpis?.nb_gaveurs_actifs || 0}
          icon={<span className="text-4xl">👨‍🌾</span>}
          color="orange"
          subtitle="Sur 3 sites"
        />

        <KPICard
          title="Alertes Critiques"
          value={kpis?.nb_alertes_critiques || 0}
          icon={<span className="text-4xl">⚠️</span>}
          color={kpis && kpis.nb_alertes_critiques > 0 ? 'red' : 'green'}
          subtitle="7 derniers jours"
        />
      </div>

      {/* Performances Globales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ITM Moyen Global
          </h3>
          <div className="text-4xl font-bold text-blue-600">
            {kpis?.itm_moyen_global ? (kpis.itm_moyen_global * 1000).toFixed(0) : '0'} <span className="text-2xl">g/kg</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Grammes de foie produits par kg de maïs consommé
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Mortalité Moyenne
          </h3>
          <div className="text-4xl font-bold text-orange-600">
            {kpis?.mortalite_moyenne_globale.toFixed(2) || '0.00'}%
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Taux de mortalité tous sites confondus
          </p>
        </div>
      </div>

      {/* Liens Rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a
          href="/euralis/sites"
          className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-2 border-transparent hover:border-blue-500"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">🌍 Sites</h3>
            <span className="text-2xl">→</span>
          </div>
          <p className="text-sm text-gray-600">
            Performances détaillées par site (LL, LS, MT)
          </p>
        </a>

        <a
          href="/euralis/analytics"
          className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow hover:shadow-lg transition-shadow p-6 text-white"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">🧠 Analytics</h3>
            <span className="text-2xl">→</span>
          </div>
          <p className="text-sm text-blue-100">
            Prévisions IA, clustering gaveurs, détection anomalies
          </p>
        </a>

        <a
          href="/euralis/previsions"
          className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-2 border-transparent hover:border-blue-500"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">📊 Prévisions</h3>
            <span className="text-2xl">→</span>
          </div>
          <p className="text-sm text-gray-600">
            Planning abattages et prévisions production
          </p>
        </a>
      </div>

      {/* Alertes Critiques */}
      {alertes.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              🚨 Alertes Critiques Actives
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {alertes.map((alerte) => (
              <div key={alerte.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {alerte.severite.toUpperCase()}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        {alerte.niveau} · Site {alerte.site_code}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-900">
                      {alerte.message}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(alerte.time).toLocaleString('fr-FR')}
                    </p>
                  </div>

                  <button
                    onClick={() => euralisAPI.acquitterAlerte(alerte.id)}
                    className="ml-4 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Acquitter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Temps Réel Multi-Sites */}
      <RealtimeSitesMonitor />

      {/* Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Astuce :</strong> Utilisez la navigation ci-dessus pour accéder aux vues détaillées par site, gaveur, ou pour consulter les prévisions et plannings.
        </p>
      </div>
    </div>
  );
}
