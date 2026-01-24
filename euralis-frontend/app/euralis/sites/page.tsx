'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { euralisAPI } from '@/lib/euralis/api';
import { Site, SiteStats } from '@/lib/euralis/types';
import KPICard from '@/components/euralis/kpis/KPICard';

export default function SitesPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteCode, setSelectedSiteCode] = useState<string>('LL');
  const [siteStats, setSiteStats] = useState<SiteStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sitesData = await euralisAPI.getSites();
        setSites(sitesData);

        if (selectedSiteCode) {
          const statsData = await euralisAPI.getSiteStats(selectedSiteCode);
          setSiteStats(statsData);
        }
      } catch (error) {
        console.error('Erreur chargement données sites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedSiteCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Chargement des sites...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sites de Production</h1>
          <p className="text-gray-600 mt-1">
            Analyse détaillée des 3 sites Euralis
          </p>
        </div>
      </div>

      {/* Sélecteur de site */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Sélectionner un site
        </label>
        <div className="grid grid-cols-3 gap-4">
          {sites.map((site) => (
            <button
              key={site.code}
              onClick={() => setSelectedSiteCode(site.code)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedSiteCode === site.code
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-lg font-bold">{site.code}</div>
              <div className="text-sm text-gray-600">{site.nom}</div>
              <div className="text-xs text-gray-500 mt-1">{site.region}</div>
            </button>
          ))}
        </div>
      </div>

      {/* KPIs du site sélectionné */}
      {siteStats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              title="Production Totale"
              value={`${(siteStats.production_foie_kg || 0).toFixed(0)} kg`}
              color="blue"
            />
            <KPICard
              title="Lots Actifs"
              value={siteStats.nb_lots.toString()}
              color="green"
            />
            <KPICard
              title="Gaveurs Actifs"
              value={siteStats.nb_gaveurs.toString()}
              color="orange"
            />
            <KPICard
              title="ITM Moyen"
              value={`${(siteStats.itm_moyen || 0).toFixed(2)} kg`}
              color="blue"
            />
          </div>

          {/* Métriques détaillées */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4">Performance</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">ITM Moyen</span>
                  <span className="font-semibold">{(siteStats.itm_moyen || 0).toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">ITM Min - Max</span>
                  <span className="font-semibold">
                    {(siteStats.itm_min || 0).toFixed(2)} - {(siteStats.itm_max || 0).toFixed(2)} kg
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Sigma Moyen</span>
                  <span className="font-semibold">{(siteStats.sigma_moyen || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Mortalité Moyenne</span>
                  <span className="font-semibold text-red-600">
                    {(siteStats.mortalite_moyenne || 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Production */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4">Production</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Production Totale</span>
                  <span className="font-semibold">
                    {(siteStats.production_totale_kg || siteStats.production_foie_kg || 0).toFixed(0)} kg
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Consommation Maïs</span>
                  <span className="font-semibold">
                    {(siteStats.conso_moyenne_mais || 0).toFixed(0)} kg
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Durée Moyenne Gavage</span>
                  <span className="font-semibold">
                    {(siteStats.duree_moyenne || 0).toFixed(1)} jours
                  </span>
                </div>
              </div>
            </div>

            {/* Gaveurs - Clickable Card */}
            <button
              onClick={() => router.push(`/euralis/sites/${selectedSiteCode}/gaveurs`)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-orange-300 transition-all cursor-pointer text-left w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Gaveurs</h2>
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Gaveurs Actifs</span>
                  <span className="font-semibold">{siteStats.nb_gaveurs || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total MEG</span>
                  <span className="font-semibold">
                    {(siteStats.total_canards_meg || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Accrochés</span>
                  <span className="font-semibold text-green-600">
                    {(siteStats.total_canards_accroches || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Morts</span>
                  <span className="font-semibold text-red-600">
                    {(siteStats.total_canards_morts || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-orange-600 font-medium">
                  Voir tous les gaveurs →
                </div>
              </div>
            </button>

            {/* Lots - Clickable Card */}
            <button
              onClick={() => router.push(`/euralis/sites/${selectedSiteCode}/lots`)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer text-left w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Lots</h2>
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Lots</span>
                  <span className="font-semibold">{siteStats.nb_lots_total || siteStats.nb_lots || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Lots Actifs</span>
                  <span className="font-semibold text-green-600">
                    {siteStats.nb_lots_actifs || siteStats.nb_lots || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Lots Terminés</span>
                  <span className="font-semibold text-blue-600">
                    {siteStats.nb_lots_termines || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Premier Lot</span>
                  <span className="font-semibold text-sm">
                    {siteStats.premier_lot ? new Date(siteStats.premier_lot).toLocaleDateString('fr-FR') : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-blue-600 font-medium">
                  Voir tous les lots →
                </div>
              </div>
            </button>

            {/* Analytics IA - Clickable Card */}
            <button
              onClick={() => router.push(`/euralis/sites/${selectedSiteCode}/analytics`)}
              className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer text-left w-full text-white"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Analytics & IA
                </h2>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span className="text-sm">Prévisions production (Prophet ML)</span>
                </div>
                <div className="flex items-center gap-2 text-blue-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm">Clustering gaveurs (K-Means)</span>
                </div>
                <div className="flex items-center gap-2 text-blue-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm">Détection anomalies (Isolation Forest)</span>
                </div>
                <div className="flex items-center gap-2 text-blue-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-sm">Performance vs autres sites</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-blue-400/30">
                <div className="text-sm text-white font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Accéder aux analytics IA →
                </div>
              </div>
            </button>
          </div>

          {/* Informations complémentaires */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Informations Site
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    <strong>Région :</strong> {siteStats.site_nom} ({selectedSiteCode})
                  </p>
                  <p className="mt-1">
                    <strong>Dernière mise à jour :</strong>{' '}
                    {siteStats.last_refresh ? new Date(siteStats.last_refresh).toLocaleString('fr-FR') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
