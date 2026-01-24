// ============================================================================
// WebSocket Types - Structure EXACTE du backend
// Basé sur backend_new/app/main.py:474 (/ws/sensors/)
// ============================================================================

/**
 * Message WebSocket complet envoyé par le backend
 * Contient les données des deux capteurs + fusion
 * ⚠️ IMPORTANT: Backend envoie LOWERCASE keys (vl53l8ch, as7341)
 * Voir backend_new/app/main.py:1001-1010 (broadcast_to_dashboards)
 */
export interface WebSocketSensorMessage {
  type: "sensor_update" | "connection_established" | "latest_data";
  device_id: string;
  sample_id: string;
  timestamp: string; // ISO 8601

  // ⚠️ LOWERCASE keys (vl53l8ch, as7341) - pas UPPERCASE!
  vl53l8ch?: VL53L8CHData;
  as7341?: AS7341Data;
  fusion?: FusionData;

  meta?: MetaData;
  blockchain?: BlockchainData;
}

/**
 * Données VL53L8CH (Time-of-Flight sensor)
 * ⚠️ Toutes les matrices sont number[][] (8x8 ou 32x32)
 */
export interface VL53L8CHData {
  distance_matrix: number[][]; // ⚠️ 2D array, pas 1D
  reflectance_matrix: number[][];
  amplitude_matrix: number[][];
  status_matrix: number[][];

  grade: string; // A+, A, B, C, REJECT
  quality_score: number; // 0-1

  // Métriques volumétriques
  volume_mm3: number;
  avg_height_mm: number;
  surface_uniformity: number;

  // Statistiques
  max_height_mm?: number;
  min_height_mm?: number;
  height_variation_mm?: number;

  // Défauts
  defects: Array<{
    type: string;
    position: { x: number; y: number };
    severity: string;
  }>;

  // Analyses avancées
  bins_analysis?: number[]; // 128 bins
  reflectance_analysis?: Record<string, any>;
  amplitude_consistency?: number;
}

/**
 * Données AS7341 (Spectral sensor)
 * ⚠️ Clés raw_counts: F1_violet, F2_indigo, etc. (pas F1_415nm)
 */
export interface AS7341Data {
  raw_counts: {
    F1_violet: number;
    F2_indigo: number;
    F3_blue: number;
    F4_cyan: number;
    F5_green: number;
    F6_yellow: number;
    F7_orange: number;
    F8_red: number;
    NIR: number;
  };

  quality_metrics: {
    freshness_index: number; // 0-1
    fat_quality_index: number; // 0-1
    oxidation_index: number; // 0-1
    color_uniformity: number; // 0-1
  };

  spectral_ratios: {
    red_nir: number;
    red_orange: number;
    green_red: number;
    blue_green: number;
  };

  grade: string; // A+, A, B, C, REJECT
  quality_score: number; // 0-1
  defects: string[]; // Liste de défauts textuels
}

/**
 * Données de fusion
 * ⚠️ Utilise vl53l8ch_score et as7341_score (PAS tof_score/spectral_score)
 */
export interface FusionData {
  final_grade: string; // A+, A, B, C, REJECT
  final_score: number; // 0-1

  // ⚠️ IMPORTANT: Noms des champs exacts du backend
  vl53l8ch_score: number; // Score ToF (0-1)
  as7341_score: number; // Score spectral (0-1)

  // Contributions pondérées
  tof_contribution: number; // 0-1 (poids du ToF dans fusion)
  spectral_contribution: number; // 0-1 (poids du spectral dans fusion)

  // Défauts combinés
  defects: Array<{
    type: string;
    source: string; // "VL53L8CH" | "AS7341" | "fusion"
    severity: number; // 0-1
  }>;

  fusion_mode: string; // "weighted_average", "ml", etc.
}

/**
 * Métadonnées système
 */
export interface MetaData {
  firmware_version: string;
  temperature_c: number;
  humidity_percent: number;
  config_profile: string;
}

/**
 * Données blockchain (ajoutées après save)
 */
export interface BlockchainData {
  hash: string;
  qr_code_base64: string;
}

/**
 * Type helper pour extraire les données VL53L8CH du message complet
 */
export type VL53L8CHMessage = Pick<WebSocketSensorMessage, 'device_id' | 'sample_id' | 'timestamp' | 'vl53l8ch'>;

/**
 * Type helper pour extraire les données AS7341 du message complet
 */
export type AS7341Message = Pick<WebSocketSensorMessage, 'device_id' | 'sample_id' | 'timestamp' | 'as7341'>;

/**
 * Type helper pour le message de fusion complet
 */
export type FusionMessage = WebSocketSensorMessage;
