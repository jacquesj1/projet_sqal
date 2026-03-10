'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { courbesAPI } from '@/lib/courbes-api';

type Periode = 7 | 14 | 30 | 0;

type LotLite = {
  id: number;
  code_lot?: string;
  nom?: string;
  race?: string;
  statut?: string;
  nombre_canards?: number;
  nb_canards_initial?: number;
  date_debut_gavage?: string;
};

type DoseRow = {
  jour_gavage: number;
  date_gavage: string;
  dose_reelle_g: number;
  dose_theorique_g: number;
  ecart_g: number;
  ecart_pct: number;
  alerte_ecart: boolean;
  commentaire_gaveur?: string;
  created_at: string;
};

type LotAnalytics = {
  lot: LotLite;
  rows: DoseRow[];
  kpi: {
    days: number;
    total_reel_g: number;
    total_theo_g: number;
    ecart_total_g: number;
    ecart_total_pct: number | null;
    score_conformite: number | null;
    pct_within_10: number | null;
    pct_within_15: number | null;
    nb_alertes: number;
    regularite_pct: number | null;
    avg_delay_hours: number | null;
    diagnostic: string;
  };
};

export default function TerrainKpiDashboard({
  gaveurId,
  filteredLotId,
  periode,
  seuilAlerte,
  className = '',
}: {
  gaveurId: number;
  filteredLotId?: number | null;
  periode: Periode;
  seuilAlerte: number;
  className?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lotsAnalytics, setLotsAnalytics] = useState<LotAnalytics[]>([]);
  const [expandedLotId, setExpandedLotId] = useState<number | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaveurId, filteredLotId, periode, seuilAlerte]);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/lots/gaveur/${gaveurId}`);
      const lotsRaw = await res.json();
      const lots: LotLite[] = Array.isArray(lotsRaw) ? lotsRaw : [];

      const lotsToProcess = filteredLotId ? lots.filter((l) => l.id === filteredLotId) : lots;

      const analytics = await Promise.all(
        lotsToProcess.map(async (lot) => {
          let rows: DoseRow[] = [];
          try {
            rows = (await courbesAPI.getDosesReelles(lot.id)) as DoseRow[];
          } catch {
            rows = [];
          }

          const filteredRows = filterRowsByPeriode(rows, periode);
          const kpi = computeLotKpi(filteredRows, lot, seuilAlerte);
          return { lot, rows: filteredRows, kpi };
        })
      );

      setLotsAnalytics(analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const globalKpi = useMemo(() => {
    const allRows = lotsAnalytics.flatMap((l) => l.rows);
    if (allRows.length === 0) {
      return {
        total_reel_g: 0,
        total_theo_g: 0,
        ecart_total_g: 0,
        ecart_total_pct: null as number | null,
        score_conformite: null as number | null,
        nb_alertes: 0,
        avg_delay_hours: null as number | null,
      };
    }

    const total_reel_g = sum(allRows.map((r) => r.dose_reelle_g));
    const total_theo_g = sum(allRows.map((r) => r.dose_theorique_g));
    const ecart_total_g = total_reel_g - total_theo_g;
    const ecart_total_pct = total_theo_g > 0 ? (ecart_total_g / total_theo_g) * 100 : null;

    const absPct = allRows
      .map((r) => Math.abs(r.ecart_pct))
      .filter((v) => typeof v === 'number' && Number.isFinite(v));

    const pctWithin10 = absPct.length ? (absPct.filter((v) => v <= 10).length / absPct.length) * 100 : null;
    const pctWithin15 = absPct.length ? (absPct.filter((v) => v <= 15).length / absPct.length) * 100 : null;

    const score_conformite = pctWithin10 === null || pctWithin15 === null
      ? null
      : clamp(0, 100, Math.round(pctWithin10 * 0.7 + pctWithin15 * 0.3));

    const nb_alertes = allRows.filter((r) => Math.abs(r.ecart_pct) >= seuilAlerte).length;

    const delays = allRows
      .map((r) => delayHours(r.date_gavage, r.created_at))
      .filter(isFiniteNumber);

    const avg_delay_hours = delays.length ? round1(sum(delays) / delays.length) : null;

    return {
      total_reel_g,
      total_theo_g,
      ecart_total_g,
      ecart_total_pct,
      score_conformite,
      nb_alertes,
      avg_delay_hours,
    };
  }, [lotsAnalytics, seuilAlerte]);

  const sortedLots = useMemo(() => {
    const copy = [...lotsAnalytics];
    copy.sort((a, b) => {
      const sa = a.kpi.score_conformite;
      const sb = b.kpi.score_conformite;
      if (typeof sa === 'number' && typeof sb === 'number' && sa !== sb) return sb - sa;
      const ea = a.kpi.ecart_total_pct;
      const eb = b.kpi.ecart_total_pct;
      if (typeof ea === 'number' && typeof eb === 'number' && ea !== eb) return Math.abs(ea) - Math.abs(eb);
      return (b.kpi.days || 0) - (a.kpi.days || 0);
    });
    return copy;
  }, [lotsAnalytics]);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <p className="text-red-800">Erreur: {error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Maïs réel" value={formatG(globalKpi.total_reel_g)} sub={periodeLabel(periode)} />
        <KpiCard label="Maïs théorique" value={formatG(globalKpi.total_theo_g)} sub={periodeLabel(periode)} />
        <KpiCard
          label="Écart total"
          value={formatSignedG(globalKpi.ecart_total_g)}
          sub={globalKpi.ecart_total_pct === null ? '—' : `${formatSignedPct(globalKpi.ecart_total_pct)} vs théo`}
          tone={globalKpi.ecart_total_pct !== null && Math.abs(globalKpi.ecart_total_pct) >= seuilAlerte ? 'bad' : 'neutral'}
        />
        <KpiCard
          label="Conformité"
          value={globalKpi.score_conformite === null ? '—' : `${globalKpi.score_conformite}/100`}
          sub={`${globalKpi.nb_alertes} alerte(s) (≥ ${seuilAlerte}%)`}
          tone={globalKpi.score_conformite !== null && globalKpi.score_conformite >= 80 ? 'good' : 'neutral'}
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Comparer mes lots</h3>
            <p className="text-sm text-gray-600">
              Objectif: comprendre rapidement pourquoi un lot performe mieux (conformité, régularité, saisie).
            </p>
          </div>
          <div className="text-sm text-gray-600">
            {globalKpi.avg_delay_hours === null ? (
              <span>Délai saisie moyen: —</span>
            ) : (
              <span>Délai saisie moyen: {globalKpi.avg_delay_hours}h</span>
            )}
          </div>
        </div>

        {sortedLots.length === 0 ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
            Aucune donnée de doses disponible pour calculer les KPI.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-4">Lot</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2 pr-4">Écart</th>
                  <th className="py-2 pr-4">Alertes</th>
                  <th className="py-2 pr-4">Régularité</th>
                  <th className="py-2 pr-4">Retard saisie</th>
                  <th className="py-2 pr-4">Pourquoi ?</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedLots.map((la) => {
                  const lotLabel = la.lot.code_lot || la.lot.nom || `Lot ${la.lot.id}`;
                  const isExpanded = expandedLotId === la.lot.id;
                  return (
                    <FragmentRow
                      key={la.lot.id}
                      la={la}
                      lotLabel={lotLabel}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedLotId(isExpanded ? null : la.lot.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FragmentRow({
  la,
  lotLabel,
  isExpanded,
  onToggle,
}: {
  la: LotAnalytics;
  lotLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const worstDays = useMemo(() => {
    const copy = [...la.rows];
    copy.sort((a, b) => Math.abs(b.ecart_pct) - Math.abs(a.ecart_pct));
    return copy.slice(0, 5);
  }, [la.rows]);

  const scoreTone = la.kpi.score_conformite !== null && la.kpi.score_conformite >= 80 ? 'text-green-700' : 'text-gray-900';
  const ecartTone = la.kpi.ecart_total_pct !== null && Math.abs(la.kpi.ecart_total_pct) >= 15 ? 'text-red-700' : 'text-gray-900';

  return (
    <>
      <tr className="border-b hover:bg-gray-50">
        <td className="py-2 pr-4 font-semibold text-gray-900">
          <button type="button" className="hover:underline" onClick={onToggle}>
            {lotLabel}
          </button>
        </td>
        <td className={`py-2 pr-4 font-bold ${scoreTone}`}>{la.kpi.score_conformite === null ? '—' : `${la.kpi.score_conformite}/100`}</td>
        <td className={`py-2 pr-4 font-semibold ${ecartTone}`}>{la.kpi.ecart_total_pct === null ? '—' : formatSignedPct(la.kpi.ecart_total_pct)}</td>
        <td className="py-2 pr-4">{la.kpi.nb_alertes}</td>
        <td className="py-2 pr-4">{la.kpi.regularite_pct === null ? '—' : `${la.kpi.regularite_pct}%`}</td>
        <td className="py-2 pr-4">{la.kpi.avg_delay_hours === null ? '—' : `${la.kpi.avg_delay_hours}h`}</td>
        <td className="py-2 pr-4 text-gray-700">{la.kpi.diagnostic}</td>
        <td className="py-2">
          <div className="flex gap-2">
            <Link href={`/lots/${la.lot.id}/courbes`} className="text-blue-700 hover:underline">Courbes</Link>
            <Link href={`/lots/${la.lot.id}/gavage`} className="text-green-700 hover:underline">Gavage</Link>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b bg-gray-50">
          <td colSpan={8} className="py-3 px-2">
            {la.rows.length === 0 ? (
              <div className="text-sm text-gray-600">Aucune dose disponible sur la période.</div>
            ) : (
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-2">Jours les plus à risque (top 5 écarts)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {worstDays.map((d) => (
                    <div key={`${d.jour_gavage}-${d.date_gavage}`} className="bg-white rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between">
                        <div className="font-semibold text-gray-900">J{d.jour_gavage}</div>
                        <div className={`font-bold ${Math.abs(d.ecart_pct) >= 15 ? 'text-red-700' : 'text-gray-900'}`}>{formatSignedPct(d.ecart_pct)}</div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Réel {formatG(d.dose_reelle_g)} • Théo {formatG(d.dose_theorique_g)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Saisi {formatDelayLabel(d.date_gavage, d.created_at)}
                      </div>
                      {d.commentaire_gaveur && (
                        <div className="text-xs text-gray-700 mt-2">“{d.commentaire_gaveur}”</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  const border = tone === 'good' ? 'border-green-500' : tone === 'bad' ? 'border-red-500' : 'border-blue-500';
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${border}`}>
      <div className="text-sm text-gray-600 font-medium">{label}</div>
      <div className="text-3xl font-bold text-gray-900 mt-1">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

function filterRowsByPeriode(rows: DoseRow[], periode: Periode): DoseRow[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (periode === 0) return [...rows];

  const now = new Date();
  const threshold = new Date(now.getTime() - periode * 24 * 60 * 60 * 1000);

  return rows.filter((r) => {
    const d = safeDate(r.date_gavage);
    return d ? d >= threshold : true;
  });
}

function computeLotKpi(rows: DoseRow[], lot: LotLite, seuilAlerte: number) {
  const days = rows.length;
  const total_reel_g = sum(rows.map((r) => r.dose_reelle_g));
  const total_theo_g = sum(rows.map((r) => r.dose_theorique_g));
  const ecart_total_g = total_reel_g - total_theo_g;
  const ecart_total_pct = total_theo_g > 0 ? (ecart_total_g / total_theo_g) * 100 : null;

  const absPct = rows
    .map((r) => Math.abs(r.ecart_pct))
    .filter((v) => typeof v === 'number' && Number.isFinite(v));

  const pct_within_10 = absPct.length ? (absPct.filter((v) => v <= 10).length / absPct.length) * 100 : null;
  const pct_within_15 = absPct.length ? (absPct.filter((v) => v <= 15).length / absPct.length) * 100 : null;

  const score_conformite = pct_within_10 === null || pct_within_15 === null
    ? null
    : clamp(0, 100, Math.round(pct_within_10 * 0.7 + pct_within_15 * 0.3));

  const nb_alertes = rows.filter((r) => Math.abs(r.ecart_pct) >= seuilAlerte).length;

  const regularite_pct = computeRegularite(rows);

  const delays = rows
    .map((r) => delayHours(r.date_gavage, r.created_at))
    .filter(isFiniteNumber);

  const avg_delay_hours = delays.length ? round1(sum(delays) / delays.length) : null;

  const diagnostic = buildDiagnostic({
    lot,
    days,
    score_conformite,
    ecart_total_pct,
    nb_alertes,
    regularite_pct,
    avg_delay_hours,
  });

  return {
    days,
    total_reel_g,
    total_theo_g,
    ecart_total_g,
    ecart_total_pct,
    score_conformite,
    pct_within_10: pct_within_10 !== null ? round0(pct_within_10) : null,
    pct_within_15: pct_within_15 !== null ? round0(pct_within_15) : null,
    nb_alertes,
    regularite_pct,
    avg_delay_hours,
    diagnostic,
  };
}

function buildDiagnostic({
  lot,
  days,
  score_conformite,
  ecart_total_pct,
  nb_alertes,
  regularite_pct,
  avg_delay_hours,
}: {
  lot: LotLite;
  days: number;
  score_conformite: number | null;
  ecart_total_pct: number | null;
  nb_alertes: number;
  regularite_pct: number | null;
  avg_delay_hours: number | null;
}) {
  if (days === 0) return 'Pas de données';

  const parts: string[] = [];

  if (score_conformite !== null && score_conformite >= 85) {
    parts.push('Très conforme');
  } else if (score_conformite !== null && score_conformite <= 60) {
    parts.push('Conformité faible');
  }

  if (ecart_total_pct !== null) {
    if (ecart_total_pct <= -10) parts.push('Sous-dosage global');
    if (ecart_total_pct >= 10) parts.push('Sur-dosage global');
  }

  if (regularite_pct !== null && regularite_pct >= 12) {
    parts.push('Instable (variations)');
  }

  if (nb_alertes >= 3) {
    parts.push('Beaucoup d’alertes');
  }

  if (avg_delay_hours !== null && avg_delay_hours >= 24) {
    parts.push('Saisie tardive');
  }

  if (parts.length === 0) {
    if (lot.statut === 'en_gavage') return 'RAS (à continuer)';
    return 'RAS';
  }

  return parts.join(' • ');
}

function computeRegularite(rows: DoseRow[]): number | null {
  if (rows.length < 3) return null;

  const byJour = [...rows].sort((a, b) => a.jour_gavage - b.jour_gavage);
  const deltas: number[] = [];
  for (let i = 1; i < byJour.length; i++) {
    const prev = byJour[i - 1].dose_reelle_g;
    const cur = byJour[i].dose_reelle_g;
    if (typeof prev === 'number' && typeof cur === 'number' && prev > 0) {
      deltas.push(Math.abs((cur - prev) / prev) * 100);
    }
  }
  if (deltas.length === 0) return null;
  return round0(sum(deltas) / deltas.length);
}

function periodeLabel(p: Periode) {
  if (p === 0) return 'Toutes dates';
  return `${p} derniers jours`;
}

function formatG(v: number) {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1000) return `${round1(v / 1000)}kg`;
  return `${Math.round(v)}g`;
}

function formatSignedG(v: number) {
  const s = formatG(Math.abs(v));
  if (s === '—') return s;
  return `${v >= 0 ? '+' : '-'}${s}`;
}

function formatSignedPct(v: number) {
  if (!Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${round1(v)}%`;
}

function safeDate(s: string | undefined) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function delayHours(date_gavage: string, created_at: string) {
  const d1 = safeDate(date_gavage);
  const d2 = safeDate(created_at);
  if (!d1 || !d2) return null;
  return (d2.getTime() - d1.getTime()) / (1000 * 60 * 60);
}

function formatDelayLabel(date_gavage: string, created_at: string) {
  const h = delayHours(date_gavage, created_at);
  if (h === null) return '—';
  if (h < 1) return 'le jour-même';
  if (h < 24) return `+${round0(h)}h`;
  return `+${round0(h / 24)}j`;
}

function isFiniteNumber(v: number | null): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

function clamp(min: number, max: number, v: number) {
  return Math.max(min, Math.min(max, v));
}

function round0(v: number) {
  return Math.round(v);
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
