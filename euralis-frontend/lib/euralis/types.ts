/**
 * Types TypeScript pour l'application Euralis
 */

export interface Site {
  id: number;
  code: string;
  nom: string;
  region?: string;
  capacite_gavage_max?: number;
  nb_gaveurs_actifs?: number;
}

export interface SiteStats {
  site_code: string;
  site_nom: string;
  nb_lots: number;
  nb_gaveurs: number;
  itm_moyen?: number;
  mortalite_moyenne?: number;
  production_foie_kg?: number;
  // Additional stats for detailed view
  nb_lots_total?: number;
  nb_lots_actifs?: number;
  nb_lots_termines?: number;
  production_totale_kg?: number;
  conso_moyenne_mais?: number;
  duree_moyenne?: number;
  total_canards_meg?: number;
  total_canards_accroches?: number;
  total_canards_morts?: number;
  premier_lot?: string;
  itm_min?: number;
  itm_max?: number;
  sigma_moyen?: number;
  last_refresh?: string;
}

export interface Lot {
  id: number;
  code_lot: string;
  site_code: string;
  gaveur_id?: number;
  souche?: string;
  debut_lot: string;
  itm?: number;
  sigma?: number;
  duree_gavage_reelle?: number;
  pctg_perte_gavage?: number;
  statut: string;
}

export interface DashboardKPIs {
  production_totale_kg: number;
  nb_lots_actifs: number;
  nb_lots_termines: number;
  nb_gaveurs_actifs: number;
  itm_moyen_global: number;
  mortalite_moyenne_globale: number;
  nb_alertes_critiques: number;
}

export interface Alerte {
  id: number;
  time: string;
  niveau: string;
  site_code?: string;
  type_alerte: string;
  severite: 'critique' | 'important' | 'warning' | 'info';
  message: string;
  acquittee: boolean;
}

export interface ChartData {
  date: string;
  [key: string]: any;
}
