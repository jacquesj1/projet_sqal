/**
 * Types TypeScript pour le modèle LOT-CENTRIC
 *
 * Date: 28 décembre 2025
 * Description: Définitions de types pour la gestion de lots de canards
 * Remplace le modèle canard-individuel par un modèle LOT
 */

// ============================================================================
// TYPES DE BASE
// ============================================================================

export type Genetique = "mulard" | "barbarie" | "pekin" | "mixte";

export type StatutLot = "en_preparation" | "en_gavage" | "termine" | "abattu";

export type SiteOrigine = "Bretagne" | "Pays de Loire" | "Maubourguet";

export type NiveauAlerte = "info" | "warning" | "critique";

export type TypeRecommandation =
  | "augmenter_dose"
  | "reduire_dose"
  | "maintenir"
  | "alerter_veterinaire";

// ============================================================================
// LOT
// ============================================================================

export interface Lot {
  id: number;
  code_lot: string; // LL_XXX, LS_XXX, MG_XXX

  // Support des deux schémas: ancien (site_origine) et nouveau (site_code)
  site_origine?: SiteOrigine;
  site_code?: string;

  // Caractéristiques - support des deux schémas
  nombre_canards?: number;
  nb_canards_initial?: number;
  genetique?: Genetique | string;

  // Dates - support des deux schémas
  date_debut_gavage?: string; // Ancien schéma
  debut_lot?: string; // Nouveau schéma (lots_gavage)
  date_fin_gavage_prevue?: string;
  date_fin_gavage_reelle?: string;

  // Poids (moyennes du lot)
  poids_moyen_initial?: number; // Grammes
  poids_moyen_actuel?: number | null; // Grammes (peut être null)
  poids_moyen_final?: number; // Grammes (rempli à l'abattage)

  // Objectifs
  objectif_quantite_mais?: number; // Grammes totaux par canard
  objectif_poids_final?: number; // Grammes

  // Nouveaux champs du schéma lots_gavage
  itm?: number | null;
  sigma?: number | null;
  pctg_perte_gavage?: number | null;
  duree_gavage_reelle?: number | null;
  nb_accroches?: number | null;
  nb_morts?: number | null;

  // Courbe théorique (PySR)
  courbe_theorique?: CurvePoint[] | any;
  formule_pysr?: string;
  r2_score_theorique?: number;

  // État
  statut: StatutLot | string;

  // Références
  gaveur_id: number;
  lot_mais_id?: number;

  // Statistiques
  nombre_jours_gavage_ecoules?: number;
  jour_actuel?: number; // Nouveau schéma
  taux_mortalite?: number; // Pourcentage
  nombre_mortalite?: number;
  taux_conformite?: number; // Pourcentage
  pret_abattage?: boolean; // Nouveau schéma

  // Données qualité SQAL (optionnelles - depuis capteurs IoT)
  qualite_sqal?: QualiteSQAL;

  // Métadonnées
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// QUALITÉ SQAL (Contrôle Qualité Capteurs)
// ============================================================================

/**
 * Données de contrôle qualité SQAL pour un lot
 * Provient des capteurs ToF (VL53L8CH) et Spectral (AS7341)
 * Endpoint: GET /api/lots/{id}/qualite
 */
export interface QualiteSQAL {
  lot_id: number;
  has_sqal_data: boolean;
  nb_echantillons: number;

  // Poids de foie (calculé depuis volume 3D)
  poids_foie?: {
    moyen_g: number;
    min_g: number;
    max_g: number;
    ecart_type_g: number;
  } | null;

  // Volume 3D (capteur VL53L8CH ToF)
  volume?: {
    moyen_mm3: number;
    hauteur_moyenne_mm: number;
    uniformite_surface: number; // 0.0-1.0
  } | null;

  // Scores qualité globaux (fusion VL53L8CH + AS7341)
  scores?: {
    moyen: number; // 0.0-1.0
    min: number;
    max: number;
  } | null;

  // Répartition par grade
  grades?: {
    majoritaire: GradeQualite;
    repartition: {
      "A+": number;
      "A": number;
      "B": number;
      "C": number;
      "REJECT": number;
    };
    pourcent_a_plus_a: number; // Pourcentage grades A+ et A
  } | null;

  // Indices spectraux (capteur AS7341)
  indices_spectraux?: {
    fraicheur: number; // 0.0-1.0
    qualite_gras: number; // 0.0-1.0
    oxydation: number; // 0.0-1.0 (0 = aucune oxydation)
  } | null;

  // Conformité aux normes
  conformite?: {
    nb_conformes: number;
    pourcent_conformes: number;
  } | null;

  // Dates des mesures
  dates?: {
    premiere_mesure: string; // ISO 8601
    derniere_mesure: string;
  } | null;

  // Message si aucune donnée
  message?: string;
}

export type GradeQualite = "A+" | "A" | "B" | "C" | "REJECT";

// ============================================================================
// COURBE (Point sur une courbe de gavage)
// ============================================================================

export interface CurvePoint {
  jour: number;
  poids: number; // Grammes
  dose_matin?: number; // Grammes
  dose_soir?: number; // Grammes

  // Pour intervalles de confiance (prédictions)
  lower?: number; // Borne basse
  upper?: number; // Borne haute
}

// ============================================================================
// COURBES COMPLÈTES
// ============================================================================

export interface CourbeTheorique {
  formule_pysr: string;
  points: CurvePoint[];
  metadata: {
    r2_score: number;
    nombre_echantillons: number;
    date_generation: string;
  };
}

export interface CourbePrediction {
  points_predits: CurvePoint[];
  intervalle_confiance: {
    lower: number[];
    upper: number[];
  };

  // Métriques
  ecart_actuel: number; // % d'écart
  probabilite_atteinte_objectif: number; // 0-1
  jours_restants_optimises: number;

  // Recommandations associées
  recommandations: Recommandation[];
}

// ============================================================================
// GAVAGE QUOTIDIEN
// ============================================================================

export interface DonneeGavageQuotidien {
  id: number;
  lot_id: number;

  // Temporel
  date_gavage: string; // ISO 8601
  jour_gavage: number; // J1, J2, J3...

  // Doses (communes au lot)
  dose_matin: number; // Grammes
  dose_soir: number; // Grammes
  dose_totale_jour: number; // Grammes

  // Heures
  heure_gavage_matin: string; // "08:30:00"
  heure_gavage_soir: string; // "18:30:00"

  // Pesée (échantillon)
  nb_canards_peses: number;
  poids_echantillon: number[]; // Array de poids individuels
  poids_moyen_mesure: number; // Grammes (moyenne)

  // Gain
  gain_poids_jour?: number;
  gain_poids_cumule?: number;

  // Conditions
  temperature_stabule?: number; // °C
  humidite_stabule?: number; // %

  // Théorique vs Réel
  dose_theorique_matin?: number;
  dose_theorique_soir?: number;
  poids_theorique?: number;
  ecart_dose_pourcent?: number;
  ecart_poids_pourcent?: number;

  // Annotations
  suit_courbe_theorique: boolean;
  raison_ecart?: string;
  remarques?: string;

  // Événements spéciaux
  mortalite_jour?: number;
  cause_mortalite?: string;
  problemes_sante?: string;

  // Alertes
  alerte_generee: boolean;
  niveau_alerte?: NiveauAlerte;

  // Recommandations IA
  recommandations_ia?: Recommandation[];
  prediction_activee: boolean;

  // Métadonnées
  created_at: string;
}

// ============================================================================
// FORMULAIRE DE GAVAGE
// ============================================================================

export interface FormulaireGavageLot {
  // Section 1: Identification
  lot_id: number;
  date_gavage: string; // ISO 8601 date
  jour_gavage: number; // Auto-calculé

  // Section 2: Doses
  dose_matin: number;
  heure_gavage_matin: string; // "HH:MM"
  dose_soir: number;
  heure_gavage_soir: string; // "HH:MM"

  // Section 3: Poids (échantillon)
  nb_canards_peses: number;
  poids_echantillon: number[];
  poids_moyen_calcule: number; // Auto-calculé

  // Section 4: Conditions
  temperature_stabule: number;
  humidite_stabule: number;

  // Section 5: Annotations
  suit_courbe_theorique: boolean;
  raison_ecart?: string;
  remarques?: string;

  // Section 6: Événements
  mortalite?: {
    nombre: number;
    cause?: string;
  };
  problemes_sante?: string;
}

// ============================================================================
// RECOMMANDATION IA
// ============================================================================

export interface Recommandation {
  type: TypeRecommandation;
  message: string;
  ajustement_dose: number; // +/- grammes

  impact_prevu?: {
    poids_final_estime?: number;
    jours_gavage_estimes?: number;
  };

  urgence: NiveauAlerte;
}

// ============================================================================
// SUGGESTION IA (Auto-remplissage)
// ============================================================================

export interface SuggestionIA {
  dose_matin_suggeree: number;
  dose_soir_suggeree: number;
  confiance: number; // 0-1

  base_sur: {
    jours_historique: number;
    lots_similaires: number;
  };
}

// ============================================================================
// STATISTIQUES LOT
// ============================================================================

export interface StatistiquesLot {
  lot_id: number;
  code_lot: string;
  statut: StatutLot;

  // Progression
  nombre_jours_ecoules: number;
  nombre_jours_prevus: number;
  nombre_jours_restants: number;
  pourcent_avancement: number;

  // Poids
  poids: {
    initial: number;
    actuel: number;
    objectif: number;
    gain_total: number;
    gain_moyen_jour: number;
  };

  // Doses
  doses: {
    total_donne: number;
    objectif_total: number;
    pourcent_objectif: number;
    moyenne_jour: number;
  };

  // Conformité
  conformite: {
    ecart_moyen_courbe: number;
    jours_hors_tolerance: number;
    taux_conformite: number;
  };

  // Santé
  sante: {
    mortalite_totale: number;
    taux_mortalite: number;
    nombre_alertes: number;
  };

  derniere_mise_a_jour: string;
}

// ============================================================================
// PERFORMANCE GAVEUR
// ============================================================================

export interface PerformanceGaveur {
  gaveur_id: number;
  lots_actifs: number;
  lots_termines: number;
  lots_total: number;

  taux_reussite: number; // %
  gain_poids_moyen: number; // Grammes
  conformite_moyenne: number; // %
  taux_mortalite_moyen: number; // %

  lots_details: Lot[];
}

// ============================================================================
// ALERTE
// ============================================================================

export interface Alerte {
  id: number;
  lot_id: number;
  type: string;
  niveau: NiveauAlerte;
  titre: string;
  message: string;

  date_generation: string;
  vue: boolean;
  acquittee: boolean;

  metadata?: Record<string, any>;
}

// ============================================================================
// ÉVÉNEMENT BLOCKCHAIN (Adapté au LOT)
// ============================================================================

export interface EvenementBlockchain {
  id: number;
  lot_id: number;
  type_evenement: string;

  donnees: Record<string, any>;
  hash_precedent: string;
  hash_actuel: string;
  signature: string;

  timestamp: string;
  numero_bloc: number;
}

// ============================================================================
// CERTIFICAT CONSOMMATEUR
// ============================================================================

export interface CertificatConsommateur {
  qr_code: string; // Base64 PNG

  blockchain_data: {
    lot: Lot;
    numero_canard_dans_lot: number;
    historique_gavage: DonneeGavageQuotidien[];
    origine: string;
    abattoir: string;
    date_abattage: string;
    hashes: string[];
  };
}

// ============================================================================
// RÉPONSES API
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page?: number;
  per_page?: number;
  error?: string;
  message?: string;
}

// Réponse après création de gavage
export interface GavageCreationResponse {
  gavage_id: number;
  ecart_courbe_theorique: number;
  alerte_generee: boolean;
  recommandations: Recommandation[];
}

// ============================================================================
// FILTRES ET RECHERCHE
// ============================================================================

export interface FiltresLots {
  statut?: StatutLot[];
  site_origine?: SiteOrigine[];
  genetique?: Genetique[];
  date_debut_min?: string;
  date_debut_max?: string;
  ecart_min?: number; // % minimum d'écart
  ecart_max?: number; // % maximum d'écart
  search?: string; // Recherche textuelle sur code_lot
}

export interface OptionsListeLots {
  filtres?: FiltresLots;
  tri?: {
    champ: keyof Lot;
    ordre: "asc" | "desc";
  };
  pagination?: {
    page: number;
    per_page: number;
  };
}

// ============================================================================
// WEBSOCKET MESSAGES
// ============================================================================

export type WebSocketMessageType =
  | "ALERTE"
  | "PREDICTION_UPDATE"
  | "NOTIFICATION"
  | "LOT_UPDATE"
  | "GAVAGE_RECORDED";

export interface WebSocketMessage {
  type: WebSocketMessageType;
  timestamp: string;
  data: any;
}

export interface WebSocketAlerte extends WebSocketMessage {
  type: "ALERTE";
  data: {
    lot_id: number;
    niveau: NiveauAlerte;
    message: string;
  };
}

export interface WebSocketPredictionUpdate extends WebSocketMessage {
  type: "PREDICTION_UPDATE";
  data: {
    lot_id: number;
    prediction: CourbePrediction;
  };
}

export interface WebSocketLotUpdate extends WebSocketMessage {
  type: "LOT_UPDATE";
  data: {
    lot: Lot;
    champs_modifies: string[];
  };
}

// ============================================================================
// SEUILS ET CONFIGURATION
// ============================================================================

export const SEUILS_ALERTE = {
  ECART_INFO: 5, // 5%
  ECART_WARNING: 10, // 10%
  ECART_CRITIQUE: 25, // 25%
} as const;

export const CODES_SITES = {
  LL: "Bretagne",
  LS: "Pays de Loire",
  MG: "Maubourguet",
} as const;

export const DUREE_GAVAGE_STANDARD = 14; // jours

// ============================================================================
// UTILITAIRES TYPE GUARDS
// ============================================================================

export function isLotEnGavage(lot: Lot): boolean {
  return lot.statut === "en_gavage";
}

export function isLotTermine(lot: Lot): boolean {
  return lot.statut === "termine" || lot.statut === "abattu";
}

export function hasEcartSignificatif(ecart: number): boolean {
  return Math.abs(ecart) >= SEUILS_ALERTE.ECART_WARNING;
}

export function getSiteFromCodeLot(code_lot: string): SiteOrigine | null {
  const prefix = code_lot.substring(0, 2).toUpperCase();
  switch (prefix) {
    case "LL":
      return "Bretagne";
    case "LS":
      return "Pays de Loire";
    case "MG":
      return "Maubourguet";
    default:
      return null;
  }
}

export function calculateJourGavage(
  date_debut: string,
  date_actuelle: string
): number {
  const debut = new Date(date_debut);
  const actuelle = new Date(date_actuelle);
  const diffTime = actuelle.getTime() - debut.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // J1, J2, J3...
}

export function calculatePoidsEchantillonMoyen(poids: number[]): number {
  if (poids.length === 0) return 0;
  const sum = poids.reduce((acc, p) => acc + p, 0);
  return Math.round(sum / poids.length);
}

export function getNiveauAlerteFromEcart(ecart: number): NiveauAlerte {
  const absEcart = Math.abs(ecart);
  if (absEcart >= SEUILS_ALERTE.ECART_CRITIQUE) return "critique";
  if (absEcart >= SEUILS_ALERTE.ECART_WARNING) return "warning";
  if (absEcart >= SEUILS_ALERTE.ECART_INFO) return "info";
  return "info";
}

// ============================================================================
// TYPES POUR RÉTROCOMPATIBILITÉ (À SUPPRIMER PROGRESSIVEMENT)
// ============================================================================

/**
 * @deprecated Utiliser Lot à la place
 * Conservé temporairement pour compatibilité avec ancien code
 */
export interface Canard {
  id: number;
  numero_identification: string;
  lot_id?: number; // Nouveau: référence au lot
  // ... autres champs canard
}
