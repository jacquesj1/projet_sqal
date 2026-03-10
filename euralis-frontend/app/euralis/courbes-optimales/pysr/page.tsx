'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { euralisAPI } from '@/lib/euralis/api';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

type TaskStatus = {
  task_id: string;
  task_name: string;
  status: string;
  result?: any;
  error?: string;
  progress?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
};

type PysrTrainingHistoryRow = {
  id: number;
  task_id?: string | null;
  site_code?: string | null;
  genetique?: string | null;
  cluster_id?: number | null;
  statut: string;
  best_equation?: string | null;
  r2_score?: number | null;
  mae?: number | null;
  complexity?: number | null;
  candidate_curve_json?: any;
  candidate_metrics_json?: any;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
};

type PysrTrainingPreview = {
  task_id: string;
  segment?: { site_code?: string | null; genetique?: string | null; cluster_id?: number | null };
  pysr?: { formula?: string | null; r2_score?: number | null; complexity?: number | null; variables?: any };
  courbe?: { jours?: any[] };
};

export default function PySRSementAdminPage() {
  const [siteCode, setSiteCode] = useState<string>('LL');
  const [genetique, setGenetique] = useState<string>('mulard');
  const [clusterId, setClusterId] = useState<number>(2);
  const [availableGenetiques, setAvailableGenetiques] = useState<string[]>([]);
  const [premiumMode, setPremiumMode] = useState<'strict' | 'extended' | 'off'>('extended');
  const [includeSqal, setIncludeSqal] = useState<boolean>(false);

  const isAllSites = siteCode === '';
  const isAllGenetiques = genetique === '';

  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [taskPolling, setTaskPolling] = useState<boolean>(false);

  const [history, setHistory] = useState<PysrTrainingHistoryRow[]>([]);
  const [selectedHistoryTaskId, setSelectedHistoryTaskId] = useState<string | null>(null);
  const [selectedGate, setSelectedGate] = useState<'A' | 'B' | 'C_D'>('A');
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showAllRuns, setShowAllRuns] = useState<boolean>(false);

  const loadHistory = async () => {
    try {
      setHistoryError(null);
      const rows = await euralisAPI.listPysrTrainingHistory(
        showAllRuns
          ? {
              limit: 200,
              offset: 0,
            }
          : {
              site_code: isAllSites ? undefined : siteCode,
              genetique: isAllGenetiques ? undefined : genetique,
              cluster_id: clusterId,
              limit: 50,
              offset: 0,
            }
      );
      setHistory(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      setHistory([]);
      setHistoryError(e instanceof Error ? e.message : 'Erreur chargement historique');
    }
  };

  const [candidatePreview, setCandidatePreview] = useState<PysrTrainingPreview | null>(null);
  const [candidatePreviewLoading, setCandidatePreviewLoading] = useState<boolean>(false);

  const [previewViewMode, setPreviewViewMode] = useState<'total' | 'matin_soir'>('total');

  const [referenceCurveId, setReferenceCurveId] = useState<number | null>(null);
  const [referenceCurve, setReferenceCurve] = useState<any | null>(null);

  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  const noPreviewKeysRef = useRef<Set<string>>(new Set());

  const [gaveurSearch, setGaveurSearch] = useState<string>('');
  const [gaveurs, setGaveurs] = useState<any[]>([]);
  const [selectedGaveurIds, setSelectedGaveurIds] = useState<number[]>([]);
  const [assignResult, setAssignResult] = useState<any | null>(null);
  const [assignLoading, setAssignLoading] = useState<boolean>(false);
  const [gaveursLoadError, setGaveursLoadError] = useState<string | null>(null);
  const [gaveursLoadDebug, setGaveursLoadDebug] = useState<string>('');

  const [planStartDate, setPlanStartDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [planDuree, setPlanDuree] = useState<number>(14);
  const [planBuffer, setPlanBuffer] = useState<number>(1);
  const [planCodeLot, setPlanCodeLot] = useState<string>('');

  const [nbCanards, setNbCanards] = useState<number>(800);
  const [souche, setSouche] = useState<string>('Mulard');

  const filteredGaveurs = useMemo(() => {
    const q = gaveurSearch.trim().toLowerCase();
    return gaveurs
      .filter((g) => (!q ? true : String(g.nom || '').toLowerCase().includes(q)));
  }, [gaveurs, clusterId, gaveurSearch]);

  const getGaveurId = (g: any): number => {
    const raw = g?.gaveur_id ?? g?.id;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };

  const getGaveurKey = (g: any, idx: number): string => {
    const id = getGaveurId(g);
    if (Number.isFinite(id)) return String(id);
    const raw = g?.email ?? g?.nom ?? g?.prenom ?? null;
    return raw ? `fallback:${String(raw)}:${idx}` : `fallback:${idx}`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setGaveursLoadError(null);
        setGaveursLoadDebug('');
        if (isAllSites) {
          setGaveurs([]);
          return;
        }
        const res = await euralisAPI.getSiteGaveurs(siteCode);
        setGaveurs(Array.isArray(res) ? res : []);
        setGaveursLoadDebug('source=site_gaveurs');
      } catch (e) {
        console.error(e);
        setGaveurs([]);
        setGaveursLoadError(e instanceof Error ? e.message : 'Erreur chargement gaveurs');
      }
    };

    load();
  }, [siteCode, isAllSites]);

  useEffect(() => {
    const loadGenetiques = async () => {
      try {
        const gens = await euralisAPI.listPysrAvailableGenetiques({
          site_code: isAllSites ? undefined : siteCode,
          cluster_id: clusterId,
        });
        setAvailableGenetiques(Array.isArray(gens) ? gens : []);
      } catch (e) {
        console.warn(e);
        setAvailableGenetiques([]);
      }
    };

    loadGenetiques();
  }, [siteCode, clusterId]);

  useEffect(() => {
    loadHistory();
  }, [siteCode, genetique, clusterId, showAllRuns]);

  useEffect(() => {
    const loadPreview = async () => {
      const row = selectedHistoryTaskId
        ? history.find((h) => String(h.task_id || '') === String(selectedHistoryTaskId))
        : null;

      if (!selectedHistoryTaskId || row?.statut !== 'SUCCESS') {
        setCandidatePreview(null);
        return;
      }

      const cacheKey = `${selectedHistoryTaskId}:${clusterId}`;
      if (noPreviewKeysRef.current.has(cacheKey)) {
        setCandidatePreview(null);
        return;
      }

      try {
        setCandidatePreviewLoading(true);
        const prev = await euralisAPI.getPysrTrainingPreview({
          task_id: selectedHistoryTaskId,
          cluster_id: clusterId,
        });
        setCandidatePreview(prev);
      } catch (e) {
        // Le backend peut renvoyer 409 quand aucun preview n'est disponible pour ce run.
        // Dans ce cas, c'est un état normal: on reste en mode fallback.
        const status = (e as any)?.status;
        if (status !== 409) {
          console.warn(e);
        } else {
          noPreviewKeysRef.current.add(cacheKey);
        }
        setCandidatePreview(null);
      } finally {
        setCandidatePreviewLoading(false);
      }
    };

    loadPreview();
  }, [selectedHistoryTaskId, clusterId, history]);

  useEffect(() => {
    const maybeLoadLatestRef = async () => {
      if (isAllSites || isAllGenetiques) return;
      try {
        const latest = await euralisAPI.getLatestPysrReferenceCurve({
          site_code: siteCode,
          genetique,
          cluster_id: clusterId,
        });
        setReferenceCurve(latest);
        setReferenceCurveId(latest?.id ?? null);
      } catch (e) {
        console.error(e);
      }
    };

    if (!siteCode || !genetique) return;
    if (!selectedHistoryTaskId) return;
    if (referenceCurve) return;

    maybeLoadLatestRef();
  }, [selectedHistoryTaskId, siteCode, genetique, clusterId, isAllSites, isAllGenetiques, referenceCurve]);

  useEffect(() => {
    if (planCodeLot.trim()) return;
    if (!siteCode || isAllSites) return;
    if (!planStartDate) return;
    if (selectedGaveurIds.length !== 1) return;

    const gaveurId = selectedGaveurIds[0];
    if (!Number.isFinite(gaveurId)) return;

    const compactDate = String(planStartDate).replaceAll('-', '');
    setPlanCodeLot(`${siteCode}-${compactDate}-G${gaveurId}`);
  }, [planCodeLot, siteCode, isAllSites, planStartDate, selectedGaveurIds]);

  useEffect(() => {
    let timer: any;

    const poll = async () => {
      if (!taskId || !taskPolling) return;
      try {
        const st = await euralisAPI.getTaskStatus(taskId);
        setTaskStatus(st);
        if (st?.status === 'SUCCESS' || st?.status === 'FAILURE') {
          setTaskPolling(false);
          await loadHistory();
          if (taskId && st?.status === 'SUCCESS') {
            setSelectedHistoryTaskId(taskId);
          }
        }
      } catch (e) {
        console.error(e);
        setTaskPolling(false);
      }
    };

    if (taskPolling && taskId) {
      poll();
      timer = setInterval(poll, 1500);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [taskId, taskPolling]);

  const handleTrain = async () => {
    setTaskStatus(null);
    setReferenceCurveId(null);
    setReferenceCurve(null);
    setAssignResult(null);
    setPublishFeedback(null);

    const res = await euralisAPI.pysrTrain({
      genetique: isAllGenetiques ? undefined : genetique,
      site_codes: isAllSites ? undefined : [siteCode],
      cluster_ids: [clusterId],
      premium_mode: premiumMode,
      include_sqal_features: includeSqal,
    });

    setTaskId(res?.task_id || null);
    setSelectedHistoryTaskId(null);
    setCandidatePreview(null);
    setTaskPolling(true);
  };

  const handlePublish = async () => {
    const effectiveTaskId = selectedHistoryTaskId || taskId;
    if (!effectiveTaskId) return;
    if (isAllSites || isAllGenetiques) return;

    const publishCurve =
      selectedGateCandidateJours.length > 0
        ? selectedGateCandidateJours
        : parseJours(candidatePreview?.courbe);

    if (!publishCurve || publishCurve.length === 0) {
      console.warn('No candidate curve available to publish');
      return;
    }

    const res = await euralisAPI.publishPysrReferenceCurve({
      site_code: siteCode,
      genetique,
      cluster_id: clusterId,
      task_id: effectiveTaskId,
      created_by: 'euralis_frontend',
      reference_curve: publishCurve,
    });

    setReferenceCurveId(res?.reference_curve_id ?? null);

    const latest = await euralisAPI.getLatestPysrReferenceCurve({
      site_code: siteCode,
      genetique,
      cluster_id: clusterId,
    });
    setReferenceCurve(latest);

    const refId = res?.reference_curve_id ?? latest?.id ?? null;
    const refVersion = latest?.version ?? null;
    setPublishFeedback(
      `Publié gate ${selectedGate} | reference_id=${refId ?? '—'}${refVersion ? ` | v=${refVersion}` : ''}`
    );
  };

  const handleLoadLatest = async () => {
    setReferenceCurveId(null);
    setReferenceCurve(null);

    if (isAllSites || isAllGenetiques) return;

    const latest = await euralisAPI.getLatestPysrReferenceCurve({
      site_code: siteCode,
      genetique,
      cluster_id: clusterId,
    });
    setReferenceCurve(latest);
    setReferenceCurveId(latest?.id ?? null);
  };

  const parseJours = (input: any): any[] => {
    if (!input) return [];
    if (Array.isArray(input)) return input;

    // backend renvoie souvent { jours: [...] }
    if (typeof input === 'object' && Array.isArray(input.jours)) return input.jours;

    // parfois jsonb stringifié
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.jours)) return parsed.jours;
      } catch {
        return [];
      }
    }

    return [];
  };

  const parseJsonObject = (input: any): any => {
    if (!input) return null;
    if (typeof input === 'object') return input;
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch {
        return null;
      }
    }
    return null;
  };

  const selectedHistoryRow = useMemo(() => {
    if (!selectedHistoryTaskId) return null;
    return history.find((h) => String(h.task_id || '') === String(selectedHistoryTaskId)) || null;
  }, [history, selectedHistoryTaskId]);

  const selectedGateCandidateJours = useMemo(() => {
    const json = parseJsonObject(selectedHistoryRow?.candidate_curve_json);
    if (!json) return [];
    const byGate = (json && typeof json === 'object' ? json.by_gate : null) as any;
    const gateCurve = byGate ? byGate[selectedGate] : null;
    const jours = gateCurve?.jours;
    return parseJours(jours);
  }, [selectedHistoryRow, selectedGate]);

  const hasCandidateCurveByGate = useMemo(() => {
    const json = parseJsonObject(selectedHistoryRow?.candidate_curve_json);
    const byGate = (json && typeof json === 'object' ? (json as any).by_gate : null) as any;
    if (!byGate) return false;
    const gates = ['A', 'B', 'C_D'] as const;
    return gates.some((g) => {
      const jours = byGate?.[g]?.jours;
      return Array.isArray(jours) && jours.length > 0;
    });
  }, [selectedHistoryRow]);

  const selectedGateCandidateMetrics = useMemo(() => {
    const json = parseJsonObject(selectedHistoryRow?.candidate_metrics_json);
    const byGate = (json && typeof json === 'object' ? json.by_gate : null) as any;
    return byGate ? byGate[selectedGate] : null;
  }, [selectedHistoryRow, selectedGate]);

  const computeMetricsFromJours = (jours: any[]): { dose_peak_total: number; day_peak: number; total_mais: number } | null => {
    if (!Array.isArray(jours) || jours.length === 0) return null;
    const totals: number[] = [];
    const days: number[] = [];
    for (const p of jours) {
      const jour = Number((p as any)?.jour);
      if (!Number.isFinite(jour)) continue;
      const totalRaw = (p as any)?.total;
      const matinRaw = (p as any)?.matin;
      const soirRaw = (p as any)?.soir;
      let total = Number(totalRaw);
      if (!Number.isFinite(total)) {
        const matin = Number(matinRaw);
        const soir = Number(soirRaw);
        total = (Number.isFinite(matin) ? matin : 0) + (Number.isFinite(soir) ? soir : 0);
      }
      totals.push(Number.isFinite(total) ? total : 0);
      days.push(jour);
    }
    if (totals.length === 0) return null;
    let peak = -Infinity;
    let peakIdx = 0;
    for (let i = 0; i < totals.length; i++) {
      if (totals[i] > peak) {
        peak = totals[i];
        peakIdx = i;
      }
    }
    return {
      dose_peak_total: peak,
      day_peak: days[peakIdx] ?? peakIdx + 1,
      total_mais: totals.reduce((a, b) => a + b, 0),
    };
  };

  const selectedGateCandidateMetricsEffective = useMemo(() => {
    if (selectedGateCandidateMetrics?.metrics) return selectedGateCandidateMetrics;
    const m = computeMetricsFromJours(selectedGateCandidateJours);
    if (!m) return selectedGateCandidateMetrics;
    return {
      ...(selectedGateCandidateMetrics || {}),
      metrics: m,
    };
  }, [selectedGateCandidateMetrics, selectedGateCandidateJours]);

  const effectiveCandidateJoursForMetrics = useMemo(() => {
    return selectedGateCandidateJours.length > 0
      ? selectedGateCandidateJours
      : parseJours(candidatePreview?.courbe);
  }, [selectedGateCandidateJours, candidatePreview]);

  const fallbackPreviewMetrics = useMemo(() => {
    return computeMetricsFromJours(effectiveCandidateJoursForMetrics);
  }, [effectiveCandidateJoursForMetrics]);

  const referenceJoursForMetrics = useMemo(() => {
    return parseJours(referenceCurve?.reference_curve_json);
  }, [referenceCurve]);

  const referenceFallbackMetrics = useMemo(() => {
    return computeMetricsFromJours(referenceJoursForMetrics);
  }, [referenceJoursForMetrics]);

  const publishEffectiveTaskId = useMemo(
    () => selectedHistoryTaskId || taskId,
    [selectedHistoryTaskId, taskId]
  );
  const publishSourceLabel = useMemo(() => {
    return selectedGateCandidateJours.length > 0
      ? `Historique (gate ${selectedGate})`
      : selectedHistoryTaskId
        ? 'Preview (fallback)'
        : taskStatus?.status === 'SUCCESS'
          ? 'Task result (preview)'
          : '—';
  }, [selectedGateCandidateJours, selectedGate, selectedHistoryTaskId, taskStatus?.status]);

  const chartData = useMemo(() => {
    const candidateJours =
      selectedGateCandidateJours.length > 0 ? selectedGateCandidateJours : parseJours(candidatePreview?.courbe);
    const refJours = parseJours(referenceCurve?.reference_curve_json);

    const maxLen = Math.max(candidateJours.length, refJours.length);
    const rows: any[] = [];
    for (let i = 0; i < maxLen; i++) {
      const c = candidateJours[i];
      const r = refJours[i];
      const jour = Number(c?.jour ?? r?.jour ?? i + 1);

      const candidateMatin = c ? Number(c.matin ?? null) : null;
      const candidateSoir = c ? Number(c.soir ?? null) : null;
      const candidateTotal = c ? Number(c.total ?? (Number(c.matin ?? 0) + Number(c.soir ?? 0))) : null;

      const referenceMatin = r ? Number(r.matin ?? null) : null;
      const referenceSoir = r ? Number(r.soir ?? null) : null;
      const referenceTotal = r ? Number(r.total ?? (Number(r.matin ?? 0) + Number(r.soir ?? 0))) : null;

      rows.push({
        jour,
        candidate_matin: Number.isFinite(candidateMatin as any) ? candidateMatin : null,
        candidate_soir: Number.isFinite(candidateSoir as any) ? candidateSoir : null,
        candidate_total: Number.isFinite(candidateTotal as any) ? candidateTotal : null,
        reference_matin: Number.isFinite(referenceMatin as any) ? referenceMatin : null,
        reference_soir: Number.isFinite(referenceSoir as any) ? referenceSoir : null,
        reference_total: Number.isFinite(referenceTotal as any) ? referenceTotal : null,
      });
    }
    return rows;
  }, [candidatePreview, referenceCurve, selectedGateCandidateJours]);

  const hasAnyCandidateCurveData = useMemo(() => {
    return chartData.some(
      (r: any) =>
        r.candidate_total !== null ||
        r.candidate_matin !== null ||
        r.candidate_soir !== null
    );
  }, [chartData]);

  const hasAnyReferenceCurveData = useMemo(() => {
    return chartData.some(
      (r: any) =>
        r.reference_total !== null ||
        r.reference_matin !== null ||
        r.reference_soir !== null
    );
  }, [chartData]);

  const PreviewTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload?.[0]?.payload || {};
    const fmt = (v: any) => (v === null || v === undefined ? '—' : String(v));
    return (
      <div className="bg-white border border-gray-200 rounded-md shadow-sm p-2 text-sm">
        <div className="font-medium">Jour {label}</div>
        {previewViewMode === 'total' ? (
          <div className="mt-1 space-y-0.5">
            <div>
              <span className="font-medium">Candidat total:</span> {fmt(row.candidate_total)}
            </div>
            <div>
              <span className="font-medium">Référence total:</span> {fmt(row.reference_total)}
            </div>
          </div>
        ) : (
          <div className="mt-1 space-y-0.5">
            <div>
              <span className="font-medium">Candidat matin:</span> {fmt(row.candidate_matin)}
            </div>
            <div>
              <span className="font-medium">Candidat soir:</span> {fmt(row.candidate_soir)}
            </div>
            <div>
              <span className="font-medium">Candidat total:</span> {fmt(row.candidate_total)}
            </div>
            <div className="pt-1">
              <span className="font-medium">Référence matin:</span> {fmt(row.reference_matin)}
            </div>
            <div>
              <span className="font-medium">Référence soir:</span> {fmt(row.reference_soir)}
            </div>
            <div>
              <span className="font-medium">Référence total:</span> {fmt(row.reference_total)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const toggleGaveur = (id: number) => {
    setSelectedGaveurIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredGaveurs.map((g) => getGaveurId(g)).filter((x) => Number.isFinite(x));
    setSelectedGaveurIds(ids as number[]);
  };

  const handleClearSelection = () => setSelectedGaveurIds([]);

  const handleAssign = async () => {
    if (assignLoading) return;
    setAssignResult({ success: null, message: 'Planification en cours…' });
    setAssignLoading(true);

    const candidateCurve =
      selectedGateCandidateJours.length > 0 ? selectedGateCandidateJours : parseJours(candidatePreview?.courbe);

    let effectiveReferenceCurve = referenceCurve;
    if ((!effectiveReferenceCurve || !effectiveReferenceCurve?.reference_curve_json) && !isAllSites && !isAllGenetiques) {
      try {
        const latest = await euralisAPI.getLatestPysrReferenceCurve({
          site_code: siteCode,
          genetique,
          cluster_id: clusterId,
        });
        effectiveReferenceCurve = latest;
        setReferenceCurve(latest);
        setReferenceCurveId(latest?.id ?? null);
      } catch {
        effectiveReferenceCurve = referenceCurve;
      }
    }

    const referenceCurveJours = parseJours(effectiveReferenceCurve?.reference_curve_json);
    const snapshotCurve = candidateCurve.length > 0 ? candidateCurve : referenceCurveJours;

    if (!snapshotCurve || snapshotCurve.length === 0) {
      setAssignResult({
        success: false,
        error:
          "Aucune courbe candidate (run sans preview) et aucune référence latest chargée. Clique d'abord sur 'Charger référence (latest)', ou sélectionne un run SUCCESS avec candidate_curve_json.",
      });
      setAssignLoading(false);
      return;
    }

    if (selectedGaveurIds.length !== 1) {
      setAssignResult({
        success: false,
        error: 'Sélectionne exactement 1 gaveur pour planifier un lot + assigner une courbe.',
      });
      setAssignLoading(false);
      return;
    }

    if (isAllSites || !siteCode) {
      setAssignResult({
        success: false,
        error: "Sélectionne un site (LL/LS/MT) pour charger les gaveurs et planifier un lot.",
      });
      setAssignLoading(false);
      return;
    }

    if (!planStartDate) {
      setAssignResult({ success: false, error: 'Date de démarrage requise' });
      setAssignLoading(false);
      return;
    }

    if (planDuree < 11 || planDuree > 14) {
      setAssignResult({ success: false, error: 'Durée doit être entre 11 et 14 jours' });
      setAssignLoading(false);
      return;
    }
    if (planBuffer < 0 || planBuffer > 1) {
      setAssignResult({ success: false, error: 'Buffer doit être 0 ou 1' });
      setAssignLoading(false);
      return;
    }

    if (!planCodeLot.trim()) {
      setAssignResult({ success: false, error: 'Code lot requis' });
      setAssignLoading(false);
      return;
    }

    try {
      const gaveurId = selectedGaveurIds[0];
      const capRows = await euralisAPI.getGaveursCapacite({
        start_date: planStartDate,
        duree_jours: planDuree,
        buffer_jours: planBuffer,
        site_code: siteCode,
      });
      const cap = Array.isArray(capRows) ? capRows.find((r) => Number(r.gaveur_id) === gaveurId) : null;
      if (!cap) {
        setAssignResult({ success: false, error: `Capacité gaveur introuvable (gaveur_id=${gaveurId})` });
        setAssignLoading(false);
        return;
      }
      if (!cap.can_plan_new_lot) {
        setAssignResult({
          success: false,
          error: `Gaveur ${gaveurId} a déjà ${cap.active_lots_count}/3 lots sur la période`,
          capacity: cap,
        });
        setAssignLoading(false);
        return;
      }

      const lot = await euralisAPI.planifierLot({
        code_lot: planCodeLot.trim(),
        site_code: siteCode,
        gaveur_id: gaveurId,
        debut_lot: planStartDate,
        duree_gavage_prevue: planDuree,
        buffer_jours: planBuffer,
        nb_canards_initial: nbCanards,
        souche,
        genetique,
      });

      const assigned = await euralisAPI.assignCurveSnapshotToLot(Number(lot.id), {
        courbe_pysr_snapshot_json: snapshotCurve,
        pysr_formula: candidatePreview?.pysr?.formula ?? effectiveReferenceCurve?.pysr_formula ?? undefined,
        pysr_r2_score: candidatePreview?.pysr?.r2_score ?? effectiveReferenceCurve?.pysr_r2_score ?? undefined,
        assigned_by: 'euralis_frontend',
      });

      setAssignResult({
        success: true,
        capacity: cap,
        lot,
        assigned,
      });
    } catch (e) {
      console.error(e);

      const status = (e as any)?.status;
      const bodyText = (e as any)?.bodyText;
      const detail =
        typeof status === 'number'
          ? `HTTP ${status}${bodyText ? `: ${String(bodyText).slice(0, 500)}` : ''}`
          : undefined;

      setAssignResult({
        success: false,
        error: e instanceof Error ? e.message : 'Erreur planning/assignation',
        detail,
      });
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PySR - Admin segment (cluster)</h1>
          <p className="text-sm text-gray-600 mt-1">
            Workflow: train PySR → publier une courbe de référence segmentée → assigner (matérialiser) une courbe
            personnalisée par gaveur.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-700">
            <div className="font-medium text-gray-900">Workflow</div>
            <div className="mt-1">
              1) Lancer un training PySR sur un segment (site + génétique + cluster)
            </div>
            <div>2) Sélectionner un run SUCCESS dans la liste</div>
            <div>3) Choisir un gate SQAL (A / B / C-D) et vérifier la preview</div>
            <div>4) Publier une référence (publie la courbe du gate sélectionné)</div>
            <div>5) Charger la référence latest puis assigner en bulk aux gaveurs</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm text-gray-700">Site</label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                value={siteCode}
                onChange={(e) => setSiteCode(e.target.value)}
              >
                <option value="">Tous</option>
                <option value="LL">LL</option>
                <option value="LS">LS</option>
                <option value="MT">MT</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Génétique</label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
                value={genetique}
                onChange={(e) => setGenetique(e.target.value)}
              >
                <option value="">Toutes</option>
                {(() => {
                  const uniq = Array.from(
                    new Set([
                      ...availableGenetiques,
                      genetique,
                    ].filter((x) => String(x || '').trim() !== ''))
                  );
                  return uniq.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ));
                })()}
              </select>
              <div className="mt-1 text-xs text-gray-500">
                {availableGenetiques.length > 0
                  ? `${availableGenetiques.length} génétique(s) dispo en base pour ce site/cluster.`
                  : 'Aucune génétique détectée (ou endpoint indisponible).'}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-700">
                Cluster{' '}
                <span
                  className="text-gray-400 cursor-help"
                  title="Segment issu du clustering ML des gaveurs (groupe de profils similaires). Ce filtre sert à entraîner PySR et publier des courbes de référence adaptées au profil."
                >
                  (i)
                </span>
              </label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                value={String(clusterId)}
                onChange={(e) => setClusterId(Number(e.target.value))}
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-700">Premium mode</label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                value={premiumMode}
                onChange={(e) => setPremiumMode(e.target.value as any)}
              >
                <option value="strict">strict</option>
                <option value="extended">extended</option>
                <option value="off">off</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="include-sqal"
              type="checkbox"
              checked={includeSqal}
              onChange={(e) => setIncludeSqal(e.target.checked)}
            />
            <label htmlFor="include-sqal" className="text-sm text-gray-700">
              include_sqal_features
            </label>
          </div>

          {(isAllSites || isAllGenetiques) && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              Publication / chargement de référence et assignation requièrent un site et une génétique spécifiques.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              className="px-3 py-2 bg-blue-600 text-white rounded-md"
              onClick={handleTrain}
              disabled={taskPolling}
            >
              Lancer training PySR
            </button>
            <button
              className="px-3 py-2 bg-gray-900 text-white rounded-md"
              onClick={handlePublish}
              disabled={
                !publishEffectiveTaskId ||
                (!selectedHistoryTaskId && !(taskStatus?.status === 'SUCCESS'))
              }
            >
              Publier référence
            </button>
            <button className="px-3 py-2 bg-white border border-gray-300 rounded-md" onClick={handleLoadLatest}>
              Charger référence (latest)
            </button>
          </div>

          {selectedHistoryTaskId && selectedHistoryRow?.statut === 'SUCCESS' && (
            <div className="text-sm text-gray-700">
              <span className="font-medium">Publish:</span> task_id={publishEffectiveTaskId || '—'} | gate={selectedGate}{' '}
              | source={publishSourceLabel}
            </div>
          )}

          <div className="text-sm text-gray-700 space-y-1">
            <div>
              <span className="font-medium">Task ID:</span> {taskId || '—'}
            </div>
            <div>
              <span className="font-medium">Task status:</span> {taskStatus?.status || '—'}
            </div>
            {taskStatus?.error && (
              <div className="text-red-700">
                <span className="font-medium">Error:</span> {taskStatus.error}
              </div>
            )}
            {referenceCurveId && (
              <div>
                <span className="font-medium">Reference curve id:</span> {referenceCurveId}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Candidats (runs)</h2>
            <div className="text-sm text-gray-600">{history.length} run(s)</div>
          </div>

          <div className="text-sm text-gray-700">
            Sélectionne un run SUCCESS pour publier une référence. La publication utilise son <code>task_id</code>.
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <input
              id="show-all-runs"
              type="checkbox"
              checked={showAllRuns}
              onChange={(e) => setShowAllRuns(e.target.checked)}
            />
            <label htmlFor="show-all-runs">
              Afficher tous les runs (tous segments)
            </label>
          </div>

          {historyError ? (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm">
              <div className="font-medium">Erreur chargement historique</div>
              <div className="mt-1">{historyError}</div>
              <div className="mt-2 text-xs text-red-700">
                Vérifie que le backend est démarré et que l’endpoint <code>/api/euralis/ml/pysr/training-history</code>{' '}
                répond.
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 text-gray-700 rounded-md p-3 text-sm">
              <div className="font-medium">Aucun run pour ce segment</div>
              <div className="mt-1">
                Lance un training PySR, ou change le filtre (site / génétique / cluster).
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-md max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Sel.</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Statut</th>
                    <th className="p-2 text-left">Site</th>
                    <th className="p-2 text-left">Génétique</th>
                    <th className="p-2 text-left">Cluster</th>
                    <th className="p-2 text-left">Candidates</th>
                    <th className="p-2 text-left">Gates dispo</th>
                    <th className="p-2 text-left">Lots A/B/C-D</th>
                    <th className="p-2 text-left">R²</th>
                    <th className="p-2 text-left">Complexité</th>
                    <th className="p-2 text-left">Formule</th>
                    <th className="p-2 text-left">Erreur</th>
                    <th className="p-2 text-left">Task</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => {
                    const tid = String(r.task_id || '');
                    const checked = !!tid && selectedHistoryTaskId === tid;
                    const canSelect = !!tid && r.statut === 'SUCCESS';

                    const curveJson = parseJsonObject(r.candidate_curve_json);
                    const curveByGate = curveJson?.by_gate;
                    const hasCurveByGate = !!(
                      curveByGate &&
                      ((Array.isArray(curveByGate?.A?.jours) && curveByGate.A.jours.length > 0) ||
                        (Array.isArray(curveByGate?.B?.jours) && curveByGate.B.jours.length > 0) ||
                        (Array.isArray(curveByGate?.C_D?.jours) && curveByGate.C_D.jours.length > 0))
                    );

                    const metricsJson = parseJsonObject(r.candidate_metrics_json);
                    const byGate = metricsJson?.by_gate;
                    const hasCandidates = hasCurveByGate;

                    const gatesAvailable = (() => {
                      if (!curveByGate) return '—';
                      const parts: string[] = [];
                      if (Array.isArray(curveByGate?.A?.jours) && curveByGate.A.jours.length > 0) parts.push('A');
                      if (Array.isArray(curveByGate?.B?.jours) && curveByGate.B.jours.length > 0) parts.push('B');
                      if (Array.isArray(curveByGate?.C_D?.jours) && curveByGate.C_D.jours.length > 0) parts.push('C/D');
                      return parts.length ? parts.join('/') : '—';
                    })();
                    const lotsA = byGate?.A?.n_lots ?? '—';
                    const lotsB = byGate?.B?.n_lots ?? '—';
                    const lotsCD = byGate?.C_D?.n_lots ?? '—';
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">
                          <input
                            type="radio"
                            checked={checked}
                            onChange={() => setSelectedHistoryTaskId(canSelect ? tid : null)}
                            disabled={!canSelect}
                          />
                        </td>
                        <td className="p-2">{r.started_at || r.created_at || '—'}</td>
                        <td className="p-2">{r.statut}</td>
                        <td className="p-2">{r.site_code || '—'}</td>
                        <td className="p-2">{r.genetique || '—'}</td>
                        <td className="p-2">{r.cluster_id ?? '—'}</td>
                        <td className="p-2">{hasCandidates ? '✅' : '—'}</td>
                        <td className="p-2">{gatesAvailable}</td>
                        <td className="p-2">
                          {String(lotsA)}/{String(lotsB)}/{String(lotsCD)}
                        </td>
                        <td className="p-2">{r.r2_score ?? '—'}</td>
                        <td className="p-2">{r.complexity ?? '—'}</td>
                        <td className="p-2 max-w-[420px] truncate" title={r.best_equation || ''}>
                          {r.best_equation || '—'}
                        </td>
                        <td className="p-2 max-w-[360px] truncate" title={r.error_message || ''}>
                          {r.error_message || '—'}
                        </td>
                        <td className="p-2 max-w-[240px] truncate" title={tid}>
                          {tid || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selectedHistoryTaskId && (
            <div className="text-sm text-gray-700">
              <span className="font-medium">Run sélectionné:</span> {selectedHistoryTaskId}
            </div>
          )}

          {selectedHistoryRow?.statut === 'FAILED' && selectedHistoryRow?.error_message && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 text-sm">
              <div className="font-medium">Détails échec (DB)</div>
              <div className="mt-1 whitespace-pre-wrap">{selectedHistoryRow.error_message}</div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Preview (candidat vs référence)</h2>
            <div className="text-sm text-gray-600">
              {candidatePreviewLoading ? 'chargement…' : selectedHistoryTaskId ? 'ok' : '—'}
            </div>
          </div>

          <div className="text-sm text-gray-700">
            Le preview affiche la courbe par jour.
          </div>

          {!hasAnyCandidateCurveData && !hasAnyReferenceCurveData && (
            <div className="text-sm text-amber-700">
              Aucune donnée à afficher: pas de courbe candidate pour ce run, et aucune référence latest chargée.
              Clique sur <span className="font-medium">Charger référence (latest)</span> pour afficher la courbe verte.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-gray-700">
              <span className="font-medium">Gate SQAL:</span>{' '}
              <span
                className="text-gray-400 cursor-help"
                title="Segment SQAL basé sur la note finale (sensor_samples.fusion_final_grade). A = A+/A, B = B, C-D = C/REJECT. Le preview et la publication utilisent la courbe du gate sélectionné."
              >
                (i)
              </span>
            </div>
            <select
              className="border border-gray-300 rounded-md p-2 text-sm"
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value as any)}
              disabled={!selectedHistoryTaskId || !hasCandidateCurveByGate}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C_D">C/D</option>
            </select>
            {(selectedGateCandidateMetricsEffective || fallbackPreviewMetrics || referenceFallbackMetrics) && (
              <div className="text-sm text-gray-700">
                <span className="font-medium">Lots:</span> {selectedGateCandidateMetricsEffective?.n_lots ?? '—'}
                <span className="ml-3 font-medium">Peak:</span>{' '}
                {selectedGateCandidateMetricsEffective?.metrics?.dose_peak_total ?? fallbackPreviewMetrics?.dose_peak_total ?? referenceFallbackMetrics?.dose_peak_total ?? '—'}
                <span className="ml-3 font-medium">Day peak:</span>{' '}
                {selectedGateCandidateMetricsEffective?.metrics?.day_peak ?? fallbackPreviewMetrics?.day_peak ?? referenceFallbackMetrics?.day_peak ?? '—'}
                <span className="ml-3 font-medium">Total maïs:</span>{' '}
                {selectedGateCandidateMetricsEffective?.metrics?.total_mais ?? fallbackPreviewMetrics?.total_mais ?? referenceFallbackMetrics?.total_mais ?? '—'}
              </div>
            )}
            {selectedHistoryTaskId && !hasCandidateCurveByGate && (
              <div className="text-sm text-amber-700">
                Pas de courbe candidate par gate pour ce run (fallback preview: le gate n’a pas d’effet)
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              className={`px-3 py-2 rounded-md border ${
                previewViewMode === 'total' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'
              }`}
              onClick={() => setPreviewViewMode('total')}
              type="button"
            >
              Total
            </button>
            <button
              className={`px-3 py-2 rounded-md border ${
                previewViewMode === 'matin_soir' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'
              }`}
              onClick={() => setPreviewViewMode('matin_soir')}
              type="button"
            >
              Matin / Soir
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="jour" />
                <YAxis />
                <Tooltip content={<PreviewTooltip />} />
                <Legend />
                {previewViewMode === 'total' ? (
                  <>
                    {hasAnyCandidateCurveData && (
                      <Line
                        type="monotone"
                        dataKey="candidate_total"
                        name="Candidat (total)"
                        stroke="#2563eb"
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                    {hasAnyReferenceCurveData && (
                      <Line
                        type="monotone"
                        dataKey="reference_total"
                        name="Référence latest (total)"
                        stroke="#16a34a"
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                  </>
                ) : (
                  <>
                    {hasAnyCandidateCurveData && (
                      <Line
                        type="monotone"
                        dataKey="candidate_matin"
                        name="Candidat (matin)"
                        stroke="#2563eb"
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                    {hasAnyCandidateCurveData && (
                      <Line
                        type="monotone"
                        dataKey="candidate_soir"
                        name="Candidat (soir)"
                        stroke="#60a5fa"
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                    {hasAnyReferenceCurveData && (
                      <Line
                        type="monotone"
                        dataKey="reference_matin"
                        name="Référence (matin)"
                        stroke="#16a34a"
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                    {hasAnyReferenceCurveData && (
                      <Line
                        type="monotone"
                        dataKey="reference_soir"
                        name="Référence (soir)"
                        stroke="#4ade80"
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Assignation (bulk)</h2>
            <div className="text-sm text-gray-600">
              {selectedGaveurIds.length} sélectionné(s) / {filteredGaveurs.length} sur le site
            </div>
          </div>

          <div className="text-sm text-gray-700">
            <span className="font-medium">Site utilisé pour la planification:</span> {siteCode || '—'}
          </div>

          <div className="text-xs text-gray-500">
            Debug gaveurs: {gaveurs.length} chargé(s) | {filteredGaveurs.length} après filtre
            {gaveurSearch.trim() ? ` | search='${gaveurSearch.trim()}'` : ''}
            {gaveursLoadDebug ? ` | ${gaveursLoadDebug}` : ''}
          </div>

          {gaveursLoadError && (
            <div className="text-sm text-red-700">
              Erreur chargement gaveurs: {gaveursLoadError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-gray-700">Recherche gaveur</label>
              <input
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                value={gaveurSearch}
                onChange={(e) => setGaveurSearch(e.target.value)}
                placeholder="Nom"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Nb canards</label>
              <input
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                value={String(nbCanards)}
                onChange={(e) => setNbCanards(Number(e.target.value))}
                type="number"
                min={100}
                max={2000}
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Souche</label>
              <input
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                value={souche}
                onChange={(e) => setSouche(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-sm text-gray-700">Date début</label>
              <input
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                value={planStartDate}
                onChange={(e) => setPlanStartDate(e.target.value)}
                type="date"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Durée (j)</label>
              <input
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                value={String(planDuree)}
                onChange={(e) => setPlanDuree(Number(e.target.value))}
                type="number"
                min={11}
                max={14}
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Buffer (j)</label>
              <input
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                value={String(planBuffer)}
                onChange={(e) => setPlanBuffer(Number(e.target.value))}
                type="number"
                min={0}
                max={1}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700">Code lot</label>
              <input
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                value={planCodeLot}
                onChange={(e) => setPlanCodeLot(e.target.value)}
                placeholder="LL-20260212-G1"
              />
            </div>
          </div>

          <div className="text-xs text-gray-600">
            <span className="font-medium">Génétique:</span> {genetique || '—'} |{' '}
            <span className="font-medium">Lot:</span> {planCodeLot || '—'} |{' '}
            <span className="font-medium">Début:</span> {planStartDate || '—'} |{' '}
            <span className="font-medium">Durée:</span> {planDuree}j |{' '}
            <span className="font-medium">Buffer:</span> {planBuffer}j
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="px-3 py-2 bg-white border border-gray-300 rounded-md" onClick={handleSelectAllFiltered}>
              Tout sélectionner (cluster)
            </button>
            <button className="px-3 py-2 bg-white border border-gray-300 rounded-md" onClick={handleClearSelection}>
              Effacer sélection
            </button>
            <button
              className="px-3 py-2 bg-green-600 text-white rounded-md"
              onClick={handleAssign}
              disabled={assignLoading || selectedGaveurIds.length !== 1}
            >
              {assignLoading ? 'Planification…' : 'Planifier lot + assigner snapshot'}
            </button>
          </div>

          <div className="border border-gray-200 rounded-md max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Sel.</th>
                  <th className="p-2 text-left">Gaveur</th>
                  <th className="p-2 text-left">ITM</th>
                  <th className="p-2 text-left">Mortalité</th>
                </tr>
              </thead>
              <tbody>
                {filteredGaveurs.map((g) => {
                  const id = getGaveurId(g);
                  const checked = selectedGaveurIds.includes(id);
                  const disabled = !Number.isFinite(id);
                  return (
                    <tr key={getGaveurKey(g, Number.isFinite(id) ? id : 0)} className="border-t">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGaveur(id)}
                          disabled={disabled}
                        />
                      </td>
                      <td className="p-2">
                        {g.nom} {g.prenom ? `(${g.prenom})` : ''}
                      </td>
                      <td className="p-2">{g.itm_moyen}</td>
                      <td className="p-2">{g.mortalite}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {assignResult && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm">
              <div className="font-medium text-gray-900">Résultat assignation</div>
              <pre className="text-xs overflow-auto mt-2">{JSON.stringify(assignResult, null, 2)}</pre>
            </div>
          )}
        </div>

        {referenceCurve && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Référence (latest)</h2>
              <div className="text-sm text-gray-600">
                id={referenceCurve?.id} v={referenceCurve?.version}
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">formula:</span> {referenceCurve?.pysr_formula || '—'}
              </div>
              <div>
                <span className="font-medium">r2:</span> {referenceCurve?.pysr_r2_score ?? '—'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
