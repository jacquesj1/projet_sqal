'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { euralisAPI } from '@/lib/euralis/api';
import KPICard from '@/components/euralis/kpis/KPICard';
import type { Alerte, DashboardKPIs, Lot } from '@/lib/euralis/types';

type SiteCode = 'ALL' | 'LL' | 'LS' | 'MT';

type HorizonForecast = 7 | 30 | 90;

type CapacityParams = {
  start_date: string;
  duree_jours: number;
  buffer_jours: number;
  site_code?: string;
};

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

type PlanningAbattage = {
  id: number;
  code_lot: string;
  site_code: string;
  date_abattage_prevue: string;
  abattoir: string;
  creneau_horaire: string;
  nb_canards_prevu: number;
  capacite_abattoir_jour: number;
  taux_utilisation_pct: number;
  distance_km: number;
  cout_transport: number;
  priorite: number;
  statut: string;
};

function buildMockPlanningAbattage(): PlanningAbattage[] {
  return Array.from({ length: 20 }, (_, i) => {
    const sites = ['LL', 'LS', 'MT'] as const;
    const site = sites[i % 3];
    const abattoirs = ['ABATTOIR OUEST', 'ABATTOIR SUD', 'ABATTOIR NORD'];
    const statuts = ['planifie', 'confirme', 'realise'];

    const date = new Date();
    date.setDate(date.getDate() + Math.floor(i / 3));

    return {
      id: i + 1,
      code_lot: `${site}480${1000 + i}`,
      site_code: site,
      date_abattage_prevue: toIsoDate(date),
      abattoir: abattoirs[i % 3],
      creneau_horaire: i % 2 === 0 ? '08h-12h' : '14h-18h',
      nb_canards_prevu: 800 + Math.floor(Math.random() * 400),
      capacite_abattoir_jour: 2000,
      taux_utilisation_pct: 40 + Math.random() * 50,
      distance_km: 20 + Math.random() * 80,
      cout_transport: 150 + Math.random() * 300,
      priorite: Math.ceil(Math.random() * 5),
      statut: statuts[i < 5 ? 2 : i < 10 ? 1 : 0],
    };
  });
}

export default function PilotagePage() {
  const [site, setSite] = useState<SiteCode>('ALL');
  const [forecastHorizon, setForecastHorizon] = useState<HorizonForecast>(30);

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [alertesActives, setAlertesActives] = useState<Alerte[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [capaciteRows, setCapaciteRows] = useState<any[]>([]);
  const [planningAbattages, setPlanningAbattages] = useState<PlanningAbattage[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const capacityParams = useMemo(() => {
    const start = new Date();
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    const dd = String(start.getDate()).padStart(2, '0');

    return {
      start_date: `${yyyy}-${mm}-${dd}`,
      duree_jours: 14,
      buffer_jours: 1,
      site_code: site === 'ALL' ? undefined : site,
    };
  }, [site]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [kpisData, alertesData, lotsData, forecastsData, capaciteData, abattagesData] = await Promise.all([
          euralisAPI.getDashboardKPIs(),
          euralisAPI.getAlertes(undefined, site === 'ALL' ? undefined : site, 'critique', false, 10),
          euralisAPI.getLots(site === 'ALL' ? undefined : site, undefined, 200, 0),
          euralisAPI.getProductionForecasts(forecastHorizon),
          euralisAPI.getGaveursCapacite(capacityParams),
          euralisAPI.getPlanningAbattages({
            site_code: site === 'ALL' ? undefined : site,
            limit: 200,
          }),
        ]);

        setKpis(kpisData);
        setAlertesActives(Array.isArray(alertesData) ? alertesData : []);
        setLots(Array.isArray(lotsData) ? lotsData : []);
        setForecasts(Array.isArray(forecastsData) ? forecastsData : []);
        setCapaciteRows(Array.isArray(capaciteData) ? capaciteData : []);

        setPlanningAbattages(Array.isArray(abattagesData) ? (abattagesData as PlanningAbattage[]) : []);
      } catch (err) {
        console.error('Erreur chargement pilotage:', err);
        setError('Impossible de charger les données de pilotage');

        // Fallback pour éviter un cockpit vide si l'API abattages n'est pas dispo
        setPlanningAbattages(buildMockPlanningAbattage());
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [site, forecastHorizon, capacityParams]);

  const lotsPlanifies = useMemo(() => lots.filter((l) => String(l.statut || '').toLowerCase() === 'planifie'), [lots]);
  const lotsActifs = useMemo(
    () => lots.filter((l) => ['en_gavage', 'en_cours'].includes(String(l.statut || '').toLowerCase())),
    [lots]
  );

  const forecastsTop = useMemo(() => forecasts.slice(0, 7), [forecasts]);

  const filteredPlanningAbattages = useMemo(() => {
    const rows = planningAbattages
      .filter((p) => (site === 'ALL' ? true : p.site_code === site))
      .sort((a, b) => new Date(a.date_abattage_prevue).getTime() - new Date(b.date_abattage_prevue).getTime());
    return rows;
  }, [planningAbattages, site]);

  const abattagesStats = useMemo(() => {
    const planning = filteredPlanningAbattages;
    if (planning.length === 0) {
      return {
        total: 0,
        planifies: 0,
        confirmes: 0,
        realises: 0,
        taux_utilisation_moyen: 0,
        cout_transport_total: 0,
      };
    }
    const total = planning.length;
    const planifies = planning.filter((p) => p.statut === 'planifie').length;
    const confirmes = planning.filter((p) => p.statut === 'confirme').length;
    const realises = planning.filter((p) => p.statut === 'realise').length;
    const taux_utilisation_moyen = planning.reduce((sum, p) => sum + p.taux_utilisation_pct, 0) / total;
    const cout_transport_total = planning.reduce((sum, p) => sum + p.cout_transport, 0);
    return { total, planifies, confirmes, realises, taux_utilisation_moyen, cout_transport_total };
  }, [filteredPlanningAbattages]);

  const abattagesPreview = useMemo(() => filteredPlanningAbattages.slice(0, 8), [filteredPlanningAbattages]);

  const capaciteTop = useMemo(() => {
    const rows = [...capaciteRows];
    rows.sort((a, b) => {
      const aScore = typeof a.nb_lots_on_window === 'number' ? a.nb_lots_on_window : 0;
      const bScore = typeof b.nb_lots_on_window === 'number' ? b.nb_lots_on_window : 0;
      return bScore - aScore;
    });
    return rows.slice(0, 10);
  }, [capaciteRows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Chargement du cockpit...</p>
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cockpit Pilotage</h1>
          <p className="text-gray-600 mt-2">
            Planification, capacité, alertes, prévisions et suivi multi-sites
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Site</label>
            <select
              value={site}
              onChange={(e) => setSite(e.target.value as SiteCode)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tous</option>
              <option value="LL">LL</option>
              <option value="LS">LS</option>
              <option value="MT">MT</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Horizon prévisions</label>
            <select
              value={forecastHorizon}
              onChange={(e) => setForecastHorizon(Number(e.target.value) as HorizonForecast)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Lots actifs"
          value={kpis?.nb_lots_actifs || lotsActifs.length}
          icon={<span className="text-4xl">🦆</span>}
          color="green"
          subtitle={`${lotsPlanifies.length} planifiés`}
        />

        <KPICard
          title="Alertes critiques"
          value={kpis?.nb_alertes_critiques ?? alertesActives.length}
          icon={<span className="text-4xl">⚠️</span>}
          color={((kpis?.nb_alertes_critiques ?? alertesActives.length) || 0) > 0 ? 'red' : 'green'}
          subtitle="Actives"
        />

        <KPICard
          title="Production totale"
          value={`${(kpis?.production_totale_kg || 0).toFixed(1)} T`}
          icon={<span className="text-4xl">📈</span>}
          color="blue"
          subtitle={site === 'ALL' ? 'Tous sites' : `Site ${site}`}
        />

        <KPICard
          title="ITM moyen (global)"
          value={kpis?.itm_moyen_global ? `${(kpis.itm_moyen_global * 1000).toFixed(0)} g/kg` : 'N/A'}
          icon={<span className="text-4xl">🎯</span>}
          color="orange"
          subtitle="Performance" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Planification lots</h2>
              <p className="text-sm text-gray-600 mt-1">Lots planifiés (à venir) + actions</p>
            </div>
            <Link
              href="/euralis/courbes-optimales/pysr"
              className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Planifier / Assigner courbe
            </Link>
          </div>

          {lotsPlanifies.length === 0 ? (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              Aucun lot planifié (filtre site: {site}).
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Début</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gaveur</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lotsPlanifies.slice(0, 8).map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{l.code_lot}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{l.site_code}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {l.debut_lot ? new Date(l.debut_lot).toLocaleDateString('fr-FR') : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{l.gaveur_id ?? 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lotsPlanifies.length > 8 && (
                <div className="mt-3 text-xs text-gray-500">
                  Affichage limité à 8 lots (total: {lotsPlanifies.length}).
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Capacité gaveurs</h2>
              <p className="text-sm text-gray-600 mt-1">
                Fenêtre: {capacityParams.start_date} · durée {capacityParams.duree_jours}j · buffer {capacityParams.buffer_jours}j
              </p>
            </div>
          </div>

          {capaciteTop.length === 0 ? (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              Aucune donnée capacité.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gaveur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lots fenêtre</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Planifiable</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {capaciteTop.map((r: any, idx: number) => (
                    <tr key={r.gaveur_id ?? idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {r.gaveur_nom || r.nom || r.gaveur_id || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.site_code || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                        {typeof r.nb_lots_on_window === 'number' ? formatNumber(r.nb_lots_on_window) : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                            r.can_plan_new_lot ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {r.can_plan_new_lot ? 'OK' : 'NON'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Prévisions production</h2>
              <p className="text-sm text-gray-600 mt-1">Prochaines dates (extrait)</p>
            </div>
            <Link
              href="/euralis/previsions"
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Ouvrir
            </Link>
          </div>

          {forecastsTop.length === 0 ? (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              Aucune prévision.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prod (kg)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {forecastsTop.map((f: any, idx: number) => (
                    <tr key={f.date ?? idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {f.date ? new Date(f.date).toLocaleDateString('fr-FR') : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                        {typeof f.production_kg === 'number' ? formatNumber(Number(f.production_kg.toFixed(0))) : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                        {typeof f.lower_bound === 'number' ? formatNumber(Number(f.lower_bound.toFixed(0))) : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                        {typeof f.upper_bound === 'number' ? formatNumber(Number(f.upper_bound.toFixed(0))) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Alertes critiques</h2>
              <p className="text-sm text-gray-600 mt-1">Top 10 actives</p>
            </div>
            <Link
              href="/euralis/alertes"
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Ouvrir
            </Link>
          </div>

          {alertesActives.length === 0 ? (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              Aucune alerte critique active.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {alertesActives.slice(0, 10).map((a) => (
                <div key={a.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500">
                        {a.site_code ? `Site ${a.site_code} · ` : ''}{new Date(a.time).toLocaleString('fr-FR')}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{a.type_alerte}</div>
                      <div className="text-sm text-gray-700 mt-1">{a.message}</div>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-semibold border bg-red-50 text-red-700 border-red-200">
                      {String(a.severite || 'critique').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Abattages</h2>
            <p className="text-sm text-gray-600 mt-1">Planning + arbitrages (V1)</p>
          </div>
          <Link
            href="/euralis/abattages"
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Ouvrir
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-600">Total lots</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{abattagesStats.total}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-xs text-yellow-800">Planifiés</div>
            <div className="text-2xl font-bold text-yellow-700 mt-1">{abattagesStats.planifies}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs text-blue-800">Confirmés</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{abattagesStats.confirmes}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-xs text-green-800">Réalisés</div>
            <div className="text-2xl font-bold text-green-700 mt-1">{abattagesStats.realises}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-xs text-orange-800">Taux utilisation</div>
            <div className="text-2xl font-bold text-orange-700 mt-1">
              {abattagesStats.taux_utilisation_moyen.toFixed(0)}%
            </div>
          </div>
        </div>

        {abattagesPreview.length === 0 ? (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            Aucun élément dans le planning abattages.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Canards</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {abattagesPreview.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(p.date_abattage_prevue).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{p.code_lot}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.site_code}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatNumber(p.nb_canards_prevu)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold border bg-gray-50 border-gray-200">
                        {p.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900">
          Le planning abattages est actuellement alimenté par des données simulées côté frontend. Il faudra brancher un endpoint backend dédié.
        </div>
      </div>
    </div>
  );
}
