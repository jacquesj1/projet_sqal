/**
 * Client API Euralis
 */

import type {
  Site,
  SiteStats,
  Lot,
  DashboardKPIs,
  Alerte,
  ChartData,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  status: number;
  statusText: string;
  bodyText?: string;

  constructor(status: number, statusText: string, message?: string, bodyText?: string) {
    super(message || `API Error: ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.bodyText = bodyText;
  }
}

class EuralisAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  // ========================================
  // TASKS (Celery)
  // ========================================

  async getTaskStatus(taskId: string): Promise<any> {
    return this.fetch<any>(`/api/tasks/status/${taskId}`);
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        let bodyText: string | undefined;
        try {
          bodyText = await response.text();
        } catch {
          bodyText = undefined;
        }
        throw new ApiError(
          response.status,
          response.statusText,
          `API Error: ${response.statusText}`,
          bodyText
        );
      }

      return await response.json();
    } catch (error) {
      const isExpectedPreview409 =
        endpoint.startsWith('/api/euralis/ml/pysr/training-preview') &&
        error instanceof ApiError &&
        error.status === 409;

      if (!isExpectedPreview409) {
        console.error(`Error fetching ${endpoint}:`, error);
      }
      throw error;
    }
  }

  // ========================================
  // SITES
  // ========================================

  async getSites(): Promise<Site[]> {
    return this.fetch<Site[]>('/api/euralis/sites');
  }

  async getSiteDetail(code: string): Promise<Site> {
    return this.fetch<Site>(`/api/euralis/sites/${code}`);
  }

  async getSiteStats(code: string, mois?: string): Promise<SiteStats> {
    const query = mois ? `?mois=${mois}` : '';
    return this.fetch<SiteStats>(`/api/euralis/sites/${code}/stats${query}`);
  }

  async getSiteLots(code: string, statut?: string, limit: number = 100): Promise<Lot[]> {
    const query = new URLSearchParams();
    if (statut) query.append('statut', statut);
    query.append('limit', limit.toString());

    return this.fetch<Lot[]>(`/api/euralis/sites/${code}/lots?${query}`);
  }

  async compareSites(metrique: 'itm' | 'mortalite' | 'production' = 'itm'): Promise<any> {
    return this.fetch<any>(`/api/euralis/sites/compare?metrique=${metrique}`);
  }

  async getSiteGaveurs(code: string): Promise<any[]> {
    return this.fetch<any[]>(`/api/euralis/sites/${code}/gaveurs`);
  }

  // ========================================
  // DASHBOARD
  // ========================================

  async getDashboardKPIs(): Promise<DashboardKPIs> {
    return this.fetch<DashboardKPIs>('/api/euralis/dashboard/kpis');
  }

  async getProductionChart(periode: number = 30): Promise<ChartData[]> {
    return this.fetch<ChartData[]>(`/api/euralis/dashboard/charts/production?periode=${periode}`);
  }

  async getITMComparisonChart(): Promise<ChartData[]> {
    return this.fetch<ChartData[]>('/api/euralis/dashboard/charts/itm');
  }

  // ========================================
  // LOTS
  // ========================================

  async getLots(siteCode?: string, statut?: string, limit: number = 100, offset: number = 0): Promise<Lot[]> {
    const query = new URLSearchParams();
    if (siteCode) query.append('site_code', siteCode);
    if (statut) query.append('statut', statut);
    query.append('limit', limit.toString());
    query.append('offset', offset.toString());

    return this.fetch<Lot[]>(`/api/euralis/lots?${query}`);
  }

  async getLotDetail(id: number): Promise<Lot> {
    return this.fetch<Lot>(`/api/euralis/lots/${id}`);
  }

  async getLotDoses(id: number): Promise<any[]> {
    return this.fetch<any[]>(`/api/euralis/lots/${id}/doses`);
  }

  // ========================================
  // ABATTAGES (planning)
  // ========================================

  async getPlanningAbattages(params?: {
    site_code?: string;
    date_debut?: string;
    date_fin?: string;
    limit?: number;
  }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.site_code) query.append('site_code', params.site_code);
    if (params?.date_debut) query.append('date_debut', params.date_debut);
    if (params?.date_fin) query.append('date_fin', params.date_fin);
    if (params?.limit !== undefined) query.append('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.fetch<any[]>(`/api/euralis/abattages/planning${suffix}`);
  }

  // ========================================
  // ALERTES
  // ========================================

  async getAlertes(
    niveau?: string,
    siteCode?: string,
    severite?: string,
    acquittee?: boolean,
    limit: number = 50
  ): Promise<Alerte[]> {
    const query = new URLSearchParams();
    if (niveau) query.append('niveau', niveau);
    if (siteCode) query.append('site_code', siteCode);
    if (severite) query.append('severite', severite);
    if (acquittee !== undefined) query.append('acquittee', acquittee.toString());
    query.append('limit', limit.toString());

    return this.fetch<Alerte[]>(`/api/euralis/alertes?${query}`);
  }

  async acquitterAlerte(id: number): Promise<{ message: string }> {
    return this.fetch<{ message: string }>(`/api/euralis/alertes/${id}/acquitter`, {
      method: 'POST',
    });
  }

  // ========================================
  // ANALYTICS & ML
  // ========================================

  async getProductionForecasts(days: number = 30): Promise<any[]> {
    return this.fetch<any[]>(`/api/euralis/ml/forecasts?days=${days}`);
  }

  async getGaveurClusters(): Promise<any[]> {
    return this.fetch<any[]>('/api/euralis/ml/clusters');
  }

  async getGaveursWithClusters(siteCode?: string): Promise<any[]> {
    const query = siteCode ? `?site_code=${siteCode}` : '';
    return this.fetch<any[]>(`/api/euralis/ml/gaveurs-by-cluster${query}`);
  }

  async getGaveursWithClustersML(siteCode?: string, nClusters: number = 5): Promise<any> {
    const query = new URLSearchParams();
    if (siteCode) query.append('site_code', siteCode);
    query.append('n_clusters', nClusters.toString());
    return this.fetch<any>(`/api/euralis/ml/gaveurs-by-cluster-ml?${query}`);
  }

  async getAnomalies(): Promise<any[]> {
    return this.fetch<any[]>('/api/euralis/ml/anomalies');
  }

  async getOptimizationPlans(days: number = 7): Promise<any[]> {
    return this.fetch<any[]>(`/api/euralis/ml/optimization?days=${days}`);
  }

  // ========================================
  // PySR (segmenté: site_code + genetique + cluster)
  // ========================================

  async listPysrTrainingHistory(params: {
    site_code?: string;
    genetique?: string;
    cluster_id?: number;
    statut?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params.site_code) query.append('site_code', params.site_code);
    if (params.genetique) query.append('genetique', params.genetique);
    if (params.cluster_id !== undefined) query.append('cluster_id', String(params.cluster_id));
    if (params.statut) query.append('statut', params.statut);
    if (params.limit !== undefined) query.append('limit', String(params.limit));
    if (params.offset !== undefined) query.append('offset', String(params.offset));
    return this.fetch<any[]>(`/api/euralis/ml/pysr/training-history?${query.toString()}`);
  }

  async getPysrTrainingPreview(params: { task_id: string; cluster_id?: number }): Promise<any> {
    const query = new URLSearchParams();
    query.append('task_id', params.task_id);
    if (params.cluster_id !== undefined) query.append('cluster_id', String(params.cluster_id));
    return this.fetch<any>(`/api/euralis/ml/pysr/training-preview?${query.toString()}`);
  }

  async listPysrAvailableGenetiques(params?: {
    site_code?: string;
    cluster_id?: number;
  }): Promise<string[]> {
    const query = new URLSearchParams();
    if (params?.site_code) query.append('site_code', params.site_code);
    if (params?.cluster_id !== undefined) query.append('cluster_id', String(params.cluster_id));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.fetch<string[]>(`/api/euralis/ml/pysr/genetiques${suffix}`);
  }

  async pysrTrain(params: {
    genetique?: string;
    include_sqal_features?: boolean;
    premium_mode?: 'strict' | 'extended' | 'off';
    require_sqal_premium?: boolean;
    site_codes?: string[];
    seasons?: string[];
    cluster_ids?: number[];
    min_duree_gavage?: number;
    max_duree_gavage?: number;
    foie_min_g?: number;
    foie_max_g?: number;
    foie_target_g?: number;
    foie_weight_range?: number;
    foie_weight_target?: number;
  }): Promise<any> {
    const query = new URLSearchParams();
    if (params.genetique) query.append('genetique', params.genetique);
    if (params.include_sqal_features !== undefined)
      query.append('include_sqal_features', String(params.include_sqal_features));
    if (params.premium_mode) query.append('premium_mode', params.premium_mode);
    if (params.require_sqal_premium !== undefined)
      query.append('require_sqal_premium', String(params.require_sqal_premium));
    if (params.site_codes?.length) query.append('site_codes', params.site_codes.join(','));
    if (params.seasons?.length) query.append('seasons', params.seasons.join(','));
    if (params.cluster_ids?.length) query.append('cluster_ids', params.cluster_ids.join(','));
    if (params.min_duree_gavage !== undefined)
      query.append('min_duree_gavage', String(params.min_duree_gavage));
    if (params.max_duree_gavage !== undefined)
      query.append('max_duree_gavage', String(params.max_duree_gavage));
    if (params.foie_min_g !== undefined) query.append('foie_min_g', String(params.foie_min_g));
    if (params.foie_max_g !== undefined) query.append('foie_max_g', String(params.foie_max_g));
    if (params.foie_target_g !== undefined) query.append('foie_target_g', String(params.foie_target_g));
    if (params.foie_weight_range !== undefined)
      query.append('foie_weight_range', String(params.foie_weight_range));
    if (params.foie_weight_target !== undefined)
      query.append('foie_weight_target', String(params.foie_weight_target));

    return this.fetch<any>(`/api/tasks/ml/pysr/train?${query.toString()}`, {
      method: 'POST',
    });
  }

  async publishPysrReferenceCurve(payload: {
    site_code: string;
    genetique: string;
    cluster_id: number;
    task_id: string;
    created_by?: string;
    reference_curve?: any[];
  }): Promise<any> {
    return this.fetch<any>('/api/euralis/ml/pysr/reference-curves/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getLatestPysrReferenceCurve(params: {
    site_code: string;
    genetique: string;
    cluster_id: number;
  }): Promise<any> {
    const query = new URLSearchParams();
    query.append('site_code', params.site_code);
    query.append('genetique', params.genetique);
    query.append('cluster_id', String(params.cluster_id));
    return this.fetch<any>(`/api/euralis/ml/pysr/reference-curves/latest?${query.toString()}`);
  }

  async assignPysrReferenceCurve(referenceCurveId: number, payload: {
    gaveur_ids: number[];
    nb_canards?: number;
    souche?: string;
    assigned_by?: string;
  }): Promise<any> {
    return this.fetch<any>(`/api/euralis/ml/pysr/reference-curves/${referenceCurveId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ========================================
  // COURBES OPTIMALES (Sprint 3)
  // ========================================

  async getGaveurCourbeRecommandee(
    gaveurId: number,
    nbCanards: number = 800,
    souche: string = 'Mulard'
  ): Promise<any> {
    const query = new URLSearchParams();
    query.append('nb_canards', nbCanards.toString());
    query.append('souche', souche);
    return this.fetch<any>(`/api/euralis/ml/gaveur/${gaveurId}/courbe-recommandee?${query}`);
  }

  async sauvegarderCourbeRecommandee(
    gaveurId: number,
    courbeData: any
  ): Promise<{ success: boolean; courbe_id: number; message: string }> {
    return this.fetch<{ success: boolean; courbe_id: number; message: string }>(
      `/api/euralis/ml/gaveur/${gaveurId}/courbe-recommandee/sauvegarder`,
      {
        method: 'POST',
        body: JSON.stringify(courbeData),
      }
    );
  }

  async getGaveurPerformanceHistory(
    gaveurId: number,
    limit: number = 10
  ): Promise<any> {
    return this.fetch<any>(`/api/euralis/ml/gaveur/${gaveurId}/performance-history?limit=${limit}`);
  }

  // ========================================
  // GAVEURS INDIVIDUELS
  // ========================================

  async getGaveurDetail(id: number): Promise<any> {
    return this.fetch<any>(`/api/euralis/gaveurs/${id}`);
  }

  async getGaveurAnalytics(id: number): Promise<any> {
    return this.fetch<any>(`/api/euralis/gaveurs/${id}/analytics`);
  }

  async getGaveursPerformances(siteCode?: string, clusterLabel?: string, limit: number = 100): Promise<any[]> {
    const query = new URLSearchParams();
    if (siteCode) query.append('site_code', siteCode);
    if (clusterLabel) query.append('cluster_label', clusterLabel);
    query.append('limit', limit.toString());

    return this.fetch<any[]>(`/api/euralis/gaveurs/performances?${query}`);
  }

  // ========================================
  // PLANNING (Lots + capacité gaveur)
  // ========================================

  async getGaveursCapacite(params: {
    start_date: string;
    duree_jours: number;
    buffer_jours: number;
    site_code?: string;
  }): Promise<any[]> {
    const query = new URLSearchParams();
    query.append('start_date', params.start_date);
    query.append('duree_jours', String(params.duree_jours));
    query.append('buffer_jours', String(params.buffer_jours));
    if (params.site_code) query.append('site_code', params.site_code);
    return this.fetch<any[]>(`/api/euralis/planning/gaveurs-capacite?${query.toString()}`);
  }

  async planifierLot(payload: {
    code_lot: string;
    site_code: string;
    gaveur_id: number;
    debut_lot: string;
    duree_gavage_prevue: number;
    buffer_jours: number;
    nb_canards_initial?: number;
    souche?: string;
    genetique?: string;
  }): Promise<any> {
    return this.fetch<any>('/api/euralis/lots/planifier', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async assignCurveSnapshotToLot(lotId: number, payload: {
    courbe_pysr_snapshot_json: any;
    pysr_formula?: string;
    pysr_r2_score?: number;
    assigned_by?: string;
  }): Promise<any> {
    return this.fetch<any>(`/api/euralis/lots/${lotId}/assign-curve-snapshot`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ========================================
  // HEALTH
  // ========================================

  async healthCheck(): Promise<any> {
    return this.fetch<any>('/api/euralis/health');
  }
}

// Export instance singleton
export const euralisAPI = new EuralisAPI();

// Export classe pour tests
export default EuralisAPI;
