// ============================================================================
// SQAL Frontend - Sensor Types
// Types complets pour les capteurs VL53L8CH et AS7341
// Alignés avec le générateur simulator/data_generator.py
// ============================================================================

// ============================================================================
// VL53L8CH (Time-of-Flight) Types
// ============================================================================

export interface VL53L8CHRawData {
  distance_matrix: number[][];  // 8x8 matrix (mm)
  reflectance_matrix: number[][];  // 8x8 matrix (0-255)
  amplitude_matrix: number[][];  // 8x8 matrix (signal strength)
}

export interface VL53L8CHBinsAnalysis {
  histogram: number[];
  bin_count: number;
  multi_peak_detected: boolean;
  roughness_score: number;
  signal_quality: number;
  texture_score: number;
  density_score: number;
}

export interface VL53L8CHReflectanceAnalysis {
  avg_reflectance: number;
  reflectance_uniformity: number;
  optical_anomalies: string[];
}

export interface VL53L8CHAmplitudeConsistency {
  avg_amplitude: number;
  amplitude_std: number;
  amplitude_variance: number;
  signal_stability: number;
  z_scores: number[];
}

export interface VL53L8CHScoreBreakdown {
  volume_score: number;
  uniformity_score: number;
  reflectance_score: number;
  amplitude_score: number;
  defect_penalty: number;
}

export interface VL53L8CHAnalysis extends VL53L8CHRawData {
  // Basic statistics
  volume_mm3: number;
  base_area_mm2: number;
  average_height_mm: number;
  max_height_mm: number;
  min_height_mm: number;
  height_range_mm: number;
  surface_uniformity: number;

  // Detailed analysis
  bins_analysis: VL53L8CHBinsAnalysis;
  reflectance_analysis: VL53L8CHReflectanceAnalysis;
  amplitude_consistency: VL53L8CHAmplitudeConsistency;

  // Quality assessment
  defects: string[];
  quality_score: number;
  score_breakdown: VL53L8CHScoreBreakdown;
  grade: string;
}

// ============================================================================
// AS7341 (Spectral) Types
// ============================================================================

export interface AS7341Channels {
  F1_415nm: number;  // Violet
  F2_445nm: number;  // Indigo
  F3_480nm: number;  // Blue
  F4_515nm: number;  // Cyan
  F5_555nm: number;  // Green
  F6_590nm: number;  // Yellow
  F7_630nm: number;  // Orange
  F8_680nm: number;  // Red
  Clear: number;
  NIR: number;
}

export interface AS7341SpectralRatios {
  violet_orange_ratio: number;  // F1/F7 - Oxidation
  blue_red_ratio: number;  // F3/F8 - Freshness
  green_red_ratio: number;  // F5/F8 - Color
  nir_clear_ratio: number;  // NIR/Clear - Density
  yellow_red_ratio: number;  // F6/F8
  cyan_orange_ratio: number;  // F4/F7
}

export interface AS7341SpectralAnalysis {
  total_intensity: number;
  spectral_ratios: AS7341SpectralRatios;
  dominant_wavelength: number;
  spectral_uniformity: number;
}

export interface AS7341ColorAnalysis {
  rgb: {
    r: number;
    g: number;
    b: number;
  };
  dominant_color: string;
  color_temperature_k: number;
  color_purity: number;
}

export interface AS7341QualityMetrics {
  freshness_index: number;  // 0.0-1.0
  fat_quality_index: number;  // 0.0-1.0
  oxidation_index: number;  // 0.0-1.0
  color_uniformity: number;  // 0.0-1.0
  overall_grade: string;
  quality_score: number;
}

export interface AS7341ScoreBreakdown {
  freshness_score: number;
  fat_quality_score: number;
  oxidation_score: number;
  color_score: number;
  spectral_consistency_score: number;
}

export interface AS7341Analysis {
  // Raw data
  channels: AS7341Channels;
  integration_time: number;
  gain: number;

  // Detailed analysis
  spectral_analysis: AS7341SpectralAnalysis;
  color_analysis: AS7341ColorAnalysis;

  // Quality metrics
  freshness_index: number;
  fat_quality_index: number;
  oxidation_index: number;
  color_uniformity: number;

  // Quality assessment
  defects: string[];
  quality_score: number;
  score_breakdown: AS7341ScoreBreakdown;
  grade: string;
}

// ============================================================================
// Fusion Results Types
// ============================================================================

export interface FusionResult {
  final_score: number;  // Combined score (0.0-1.0)
  final_grade: string;  // A+, A, B, C, REJECT
  vl53l8ch_score: number;  // VL53L8CH contribution
  as7341_score: number;  // AS7341 contribution
  defects: string[];  // Combined defects from both sensors
}

// ============================================================================
// Complete Sensor Sample Type
// ============================================================================

export interface SensorSampleMetadata {
  device_id: string;
  firmware_version: string;
  temperature_c: number;
  humidity_percent: number;
  config_profile: string;
}

export interface SensorSample {
  // Identifiers
  id: string;
  timestamp: string;
  device_id: string;
  sample_id: string;

  // VL53L8CH Analysis
  vl53l8ch: VL53L8CHAnalysis;

  // AS7341 Analysis
  as7341: AS7341Analysis;

  // Fusion Results
  fusion: FusionResult;

  // Metadata
  meta: SensorSampleMetadata;
  processing_time_ms?: number;
  created_at: string;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export interface SensorWebSocketMessage {
  type: 'sensor_data';
  timestamp: string;
  device_id: string;
  sample_id: string;
  vl53l8ch: VL53L8CHAnalysis;
  as7341: AS7341Analysis;
  fusion: FusionResult;
  meta: SensorSampleMetadata;
}

// ============================================================================
// Device Management Types
// ============================================================================

export interface Device {
  id: string;
  name: string;
  type: "VL53L8CH" | "AS7341" | "FUSION";
  status: DeviceStatus;
  lastSeen: string;
  firmwareVersion: string;
  location?: string;
  organizationId?: string;
}

export type DeviceStatus = "online" | "offline" | "error" | "maintenance";

export interface DeviceHealth {
  deviceId: string;
  status: DeviceStatus;
  uptime: number;
  lastError?: string;
  metrics: {
    samplesProcessed: number;
    errorRate: number;
    avgProcessingTime: number;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface SensorDataResponse {
  success: boolean;
  data: SensorSample[];
  total: number;
  page: number;
  page_size: number;
}

export interface SensorStatsResponse {
  device_id: string;
  time_range: {
    start: string;
    end: string;
  };
  total_samples: number;
  grade_distribution: Record<string, number>;
  avg_quality_score: number;
  defect_rates: Record<string, number>;
}
