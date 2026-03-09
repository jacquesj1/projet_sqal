// ============================================
// TYPES DE BASE
// ============================================

export interface Gaveur {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresse: string;
  numero_elevage: string;
  certifications: string[];
  created_at: string;
}

export interface Canard {
  id: number;
  gaveur_id: number;
  numero_identification: string;
  genetique: 'Mulard' | 'Barbarie' | 'Pekin';
  date_naissance: string;
  origine: string;
  numero_lot_canard: string;
  poids_initial: number;
  statut: 'en_gavage' | 'termine' | 'decede';
  created_at: string;
  poids_actuel?: number;
}

export interface GavageData {
  id: number;
  time: string;
  canard_id: number;
  dose_matin: number;
  dose_soir: number;
  dose_theorique_matin?: number;
  dose_theorique_soir?: number;
  heure_gavage_matin: string;
  heure_gavage_soir: string;
  poids_matin?: number;
  poids_soir?: number;
  temperature_stabule: number;
  humidite_stabule: number;
  co2_stabule?: number;
  lot_mais_id: number;
  remarques?: string;
  ecart_dose_matin?: number;
  ecart_dose_soir?: number;
  gain_poids?: number;
}

// ============================================
// ALERTES
// ============================================

export type AlerteNiveau = 'critique' | 'important' | 'info';

export interface Alerte {
  id: number;
  time: string;
  canard_id: number;
  niveau: AlerteNiveau;
  type_alerte: string;
  message: string;
  valeur_mesuree?: number;
  valeur_seuil?: number | string;
  acquittee: boolean;
  acquittee_par?: number;
  acquittee_le?: string;
  sms_envoye: boolean;
}

export interface AlerteDashboard {
  critiques_actives: number;
  importantes_actives: number;
  info_actives: number;
  alertes_24h: number;
  sms_envoyes: number;
}

// ============================================
// INTELLIGENCE ARTIFICIELLE
// ============================================

export interface DosesPredites {
  canard_id: number;
  dose_matin_optimale: number;
  dose_soir_optimale: number;
  gain_poids_predit: number;
  confiance: number;
  formule_utilisee?: string;
}

export interface FormulaDiscovery {
  genetique: string;
  formule: string;
  r2_score: number;
  mae: number;
  coefficients: Record<string, number>;
  features_importance: Record<string, number>;
}

// ============================================
// ANALYTICS
// ============================================

export interface PerformanceMetrics {
  canard_id: number;
  genetique: string;
  duree_gavage_jours: number;
  nb_gavages: number;
  poids_initial: number;
  poids_actuel: number;
  gain_total_grammes: number;
  gain_total_kg: number;
  gain_moyen_journalier: number;
  variance_gain: number;
  dose_totale_kg: number;
  indice_consommation: number;
  indice_consommation_optimal: number;
  taux_croissance_g_par_jour: number;
  score_performance: number;
  score_ic: number;
  score_gain: number;
  score_regularite: number;
  poids_final_predit: number;
  date_analyse: string;
}

export interface PrevisionProphet {
  date: string;
  poids_predit: number;
  poids_min: number;
  poids_max: number;
}

export interface CourbesPrediction {
  canard_id: number;
  previsions: PrevisionProphet[];
  confiance: number;
  methode: string;
  date_generation: string;
}

export interface ComparaisonGenetique {
  genetique: string;
  nb_canards: number;
  gain_moyen_grammes: number;
  gain_moyen_kg: number;
  dose_moyenne_kg: number;
  indice_consommation: number;
  taux_mortalite_pct: number;
}

export interface RapportHebdomadaire {
  periode: string;
  gaveur_id: number;
  statistiques: {
    canards_actifs: number;
    canards_gaves: number;
    gavages_total: number;
    gain_moyen_g: number;
    dose_moyenne_g: number;
    alertes_critiques: number;
    alertes_importantes: number;
  };
  top_performers: Array<{
    numero: string;
    gain_moyen: number;
  }>;
  date_generation: string;
}

// ============================================
// BLOCKCHAIN
// ============================================

export interface BlockchainEvent {
  index: number;
  timestamp: string;
  type_evenement: string;
  donnees: Record<string, unknown>;
  hash: string;
  hash_precedent: string;
  gaveur_id: number;
  abattoir_id?: number;
}

export interface BlockchainCertificat {
  canard_id: number;
  numero_identification: string;
  genetique: string;
  origine: string;
  date_naissance: string;
  poids_initial: number;
  duree_gavage_jours: number;
  nombre_gavages: number;
  dose_totale_mais_kg: number;
  abattoir?: {
    nom: string;
    adresse: string;
    agrement: string;
  };
  date_abattage: string;
  blockchain_hashes: string[];
  verification_blockchain: string;
}

// ============================================
// CORRECTIONS
// ============================================

export interface CorrectionDose {
  id: number;
  time: string;
  canard_id: number;
  dose_theorique: number;
  dose_reelle: number;
  ecart_grammes: number;
  ecart_pourcentage: number;
  correction_proposee: number;
  session: 'matin' | 'soir';
  sms_envoye: boolean;
}

// ============================================
// FORMULAIRES
// ============================================

export interface GavageFormData {
  canard_id: number;
  dose_matin: number;
  dose_soir: number;
  dose_theorique_matin?: number;
  dose_theorique_soir?: number;
  heure_gavage_matin: string;
  heure_gavage_soir: string;
  poids_matin?: number;
  poids_soir?: number;
  temperature_stabule: number;
  humidite_stabule: number;
  co2_stabule?: number;
  lot_mais_id: number;
  remarques?: string;
}

export interface CanardFormData {
  gaveur_id: number;
  numero_identification: string;
  genetique: 'Mulard' | 'Barbarie' | 'Pekin';
  date_naissance: string;
  origine: string;
  numero_lot_canard: string;
  poids_initial: number;
}

// ============================================
// DONNÉES COMPLÉMENTAIRES
// ============================================

export interface Veterinaire {
  id: number;
  nom: string;
  prenom: string;
  numero_ordre: string;
  telephone: string;
  email: string;
  specialite: string;
}

export interface Certification {
  id: number;
  type: 'Label Rouge' | 'IGP' | 'Bio' | 'AOP' | 'Autre';
  numero_certification: string;
  organisme_certificateur: string;
  date_obtention: string;
  date_expiration: string;
  canard_id?: number;
  elevage_id?: number;
}

export interface ConditionsEnvironnementales {
  id: number;
  time: string;
  stabule_id: number;
  temperature: number;
  humidite: number;
  co2_ppm: number;
  nh3_ppm: number;
  luminosite_lux: number;
  qualite_air_score: number;
}

export interface LotMais {
  id: number;
  numero_lot: string;
  origine: string;
  date_reception: string;
  quantite_kg: number;
  taux_humidite: number;
  temperature_stockage: number;
  qualite_score: number;
  fournisseur: string;
}

export interface ComportementCanard {
  id: number;
  time: string;
  canard_id: number;
  etat_sanitaire: 'excellent' | 'bon' | 'moyen' | 'faible' | 'critique';
  comportement: string;
  consommation_eau_ml: number;
  niveau_activite: 'tres_actif' | 'actif' | 'normal' | 'apathique';
  observations_veterinaire?: string;
  veterinaire_id?: number;
}

export interface MetriquesPerformance {
  canard_id: number;
  indice_consommation: number;
  taux_gavabilite: number;
  score_conformation: number;
  efficacite_alimentaire: number;
  gain_moyen_quotidien: number;
}

// ============================================
// AUTHENTIFICATION & UTILISATEURS
// ============================================

export interface User {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: 'admin' | 'gaveur' | 'veterinaire' | 'observateur';
  telephone?: string;
  created_at: string;
  last_login?: string;
  avatar_url?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  role: 'gaveur' | 'veterinaire';
  telephone?: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// ============================================
// WEBSOCKET TEMPS RÉEL
// ============================================

export interface WebSocketMessage {
  type: 'alerte' | 'gavage' | 'poids' | 'anomalie' | 'notification';
  timestamp: string;
  data: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface LiveAlerte extends WebSocketMessage {
  type: 'alerte';
  data: {
    alerte_id: number;
    canard_id: number;
    niveau: AlerteNiveau;
    message: string;
    action_requise?: string;
  };
}

// ============================================
// PHOTOS & MÉDIAS
// ============================================

export interface Photo {
  id: number;
  canard_id?: number;
  gavage_id?: number;
  url: string;
  thumbnail_url?: string;
  type: 'canard' | 'gavage' | 'sanitaire' | 'documentation';
  description?: string;
  uploaded_at: string;
  uploaded_by: number;
}

// ============================================
// SIMULATIONS & PRÉVISIONS
// ============================================

export interface SimulationWhatIf {
  scenario_id: string;
  scenario_name: string;
  parameters: {
    dose_matin_modifier: number;
    dose_soir_modifier: number;
    duree_gavage_jours: number;
    temperature_cible: number;
  };
  predictions: {
    poids_final_estime: number;
    indice_consommation_estime: number;
    cout_mais_estime: number;
    risque_mortalite: number;
    rentabilite_estimee: number;
  };
}

// ============================================
// API EXTERNE & INTÉGRATIONS
// ============================================

export interface AbattoirIntegration {
  abattoir_id: number;
  nom: string;
  adresse: string;
  agrement_sanitaire: string;
  api_endpoint?: string;
  api_key?: string;
  canards_envoyes: number;
  derniere_livraison?: string;
}

export interface ExportComptabilite {
  periode_debut: string;
  periode_fin: string;
  format: 'csv' | 'excel' | 'pdf' | 'json';
  categories: string[];
  total_depenses: number;
  total_revenus: number;
  benefice_net: number;
}
