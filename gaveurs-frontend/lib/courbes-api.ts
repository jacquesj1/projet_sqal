/**
 * API Client pour Workflow 3-Courbes (Sprint 3)
 *
 * Endpoints:
 * - Courbe Théorique PySR
 * - Courbe Réelle quotidienne
 * - Corrections IA
 * - Dashboard 3-courbes
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface DoseJour {
  jour: number;
  dose_g: number;
}

export interface CourbeTheorique {
  id: number;
  lot_id: number;
  gaveur_id: number;
  site_code: string;
  pysr_equation?: string;
  pysr_r2_score?: number;
  courbe_theorique: DoseJour[];
  courbe_modifiee?: DoseJour[];
  duree_gavage_jours: number;
  statut: 'EN_ATTENTE' | 'VALIDEE' | 'MODIFIEE' | 'REJETEE';
  superviseur_nom?: string;
  date_validation?: string;
  commentaire_superviseur?: string;
  created_at: string;
  courbe_active?: DoseJour[]; // Courbe à suivre (modifiée ou théorique)
}

export interface DoseReelle {
  id?: number;
  lot_id: number;
  gaveur_id: number;
  site_code: string;
  date_gavage: string; // Format: YYYY-MM-DD
  jour_gavage: number;
  dose_reelle_g: number;
  dose_theorique_g?: number;
  ecart_g?: number;
  ecart_pct?: number;
  alerte_ecart?: boolean;
  commentaire_gaveur?: string;
  created_at?: string;
}

export interface CorrectionIA {
  id: number;
  lot_id: number;
  gaveur_id: number;
  code_lot?: string;
  date_correction: string;
  jour_gavage: number;
  ecart_detecte_g: number;
  ecart_detecte_pct: number;
  dose_suggeree_g: number;
  raison_suggestion: string;
  confiance_score: number;
  acceptee?: boolean | null;
  dose_finale_appliquee_g?: number;
  created_at: string;
}

export interface Dashboard3Courbes {
  lot_id: number;
  courbe_theorique: {
    id: number;
    equation?: string;
    courbe: DoseJour[];
    courbe_detaillee?: Array<{
      jour: number;
      matin: number;
      soir: number;
      total: number;
    }> | null;
    statut: string;
    superviseur?: string;
  };
  courbe_reelle: Array<{
    jour_gavage: number;
    date_gavage: string;
    dose_reelle_g: number;
    dose_theorique_g: number;
    ecart_g: number;
    ecart_pct: number;
    alerte_ecart: boolean;
    commentaire_gaveur?: string;
  }>;
  corrections_ia: Array<{
    jour_gavage: number;
    date_correction: string;
    dose_suggeree_g: number;
    raison_suggestion: string;
    confiance_score: number;
    acceptee?: boolean | null;
  }>;
  statistiques: {
    nb_jours_saisis: number;
    ecart_moyen_pct: number | null;
    ecart_max_pct: number | null;
    nb_alertes: number;
  };
}

/**
 * API Client Courbes
 */
export const courbesAPI = {
  /**
   * Récupérer la courbe théorique d'un lot
   */
  async getCourbeTheorique(lotId: number): Promise<CourbeTheorique> {
    const res = await fetch(`${API_URL}/api/courbes/theorique/lot/${lotId}`);
    if (!res.ok) {
      throw new Error(`Erreur ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();

    // Parser courbe JSON si string
    if (typeof data.courbe_theorique === 'string') {
      data.courbe_theorique = JSON.parse(data.courbe_theorique);
    }
    if (data.courbe_modifiee && typeof data.courbe_modifiee === 'string') {
      data.courbe_modifiee = JSON.parse(data.courbe_modifiee);
    }
    if (data.courbe_active && typeof data.courbe_active === 'string') {
      data.courbe_active = JSON.parse(data.courbe_active);
    }

    return data;
  },

  /**
   * Saisir une dose réelle quotidienne
   */
  async saisirDoseReelle(dose: DoseReelle): Promise<{
    id: number;
    dose_reelle_g: number;
    dose_theorique_g: number;
    ecart_g: number;
    ecart_pct: number;
    alerte_ecart: boolean;
    correction_ia?: {
      dose_suggeree_g: number;
      raison: string;
      confiance: number;
    };
    created_at: string;
  }> {
    const res = await fetch(`${API_URL}/api/courbes/reelle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dose),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Erreur inconnue' }));
      throw new Error(error.detail || `Erreur ${res.status}`);
    }

    return res.json();
  },

  /**
   * Récupérer toutes les doses réelles d'un lot
   */
  async getDosesReelles(lotId: number): Promise<Array<{
    jour_gavage: number;
    date_gavage: string;
    dose_reelle_g: number;
    dose_theorique_g: number;
    ecart_g: number;
    ecart_pct: number;
    alerte_ecart: boolean;
    commentaire_gaveur?: string;
    created_at: string;
  }>> {
    const res = await fetch(`${API_URL}/api/courbes/reelle/lot/${lotId}`);
    if (!res.ok) {
      throw new Error(`Erreur ${res.status}`);
    }
    return res.json();
  },

  /**
   * Récupérer corrections IA pour un gaveur
   */
  async getCorrectionsGaveur(gaveurId: number, pendingOnly: boolean = true): Promise<CorrectionIA[]> {
    const params = new URLSearchParams();
    if (pendingOnly) params.append('pending_only', 'true');

    const res = await fetch(
      `${API_URL}/api/courbes/corrections/gaveur/${gaveurId}?${params}`
    );

    if (!res.ok) {
      throw new Error(`Erreur ${res.status}`);
    }
    return res.json();
  },

  /**
   * Répondre à une correction IA (accepter/refuser)
   */
  async repondreCorrectionIA(
    correctionId: number,
    acceptee: boolean,
    doseFinalG?: number
  ): Promise<{
    correction_id: number;
    acceptee: boolean;
    dose_finale_g?: number;
    message: string;
  }> {
    const res = await fetch(
      `${API_URL}/api/courbes/corrections/${correctionId}/repondre`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptee,
          dose_finale_g: doseFinalG,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Erreur ${res.status}`);
    }
    return res.json();
  },

  /**
   * Récupérer le dashboard complet 3-courbes
   */
  async getDashboard3Courbes(lotId: number): Promise<Dashboard3Courbes> {
    const res = await fetch(`${API_URL}/api/courbes/dashboard/lot/${lotId}`);
    if (!res.ok) {
      throw new Error(`Erreur ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();

    // Parser courbe JSON si string
    if (typeof data.courbe_theorique?.courbe === 'string') {
      data.courbe_theorique.courbe = JSON.parse(data.courbe_theorique.courbe);
    }

    if (typeof data.courbe_theorique?.courbe_detaillee === 'string') {
      data.courbe_theorique.courbe_detaillee = JSON.parse(data.courbe_theorique.courbe_detaillee);
    }

    return data;
  },

  /**
   * Récupérer la courbe prédictive IA
   */
  async getCourbePredictive(lotId: number): Promise<{
    lot_id: number;
    courbe_predictive: DoseJour[];
    dernier_jour_reel: number;
    a_des_ecarts: boolean;
    algorithme: string;
  }> {
    const res = await fetch(`${API_URL}/api/courbes/predictive/lot/${lotId}`);
    if (!res.ok) {
      throw new Error(`Erreur ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();

    // Parser courbe si nécessaire
    if (data.courbe_predictive && typeof data.courbe_predictive === 'string') {
      data.courbe_predictive = JSON.parse(data.courbe_predictive);
    }

    return data;
  },
};
