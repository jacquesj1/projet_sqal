// ============================================================================
// SQAL Frontend - Types & Interfaces
// Système de Qualification Alimentaire Temps Réel
// ============================================================================

// ============================================================================
// Authentication & Authorization (Keycloak)
// ============================================================================

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  organizationIds: string[];
  permissions: Permission[];
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface Organization {
  id: string;
  name: string;
  type: "production" | "lab" | "admin";
  location: string;
  timezone: string;
  settings: OrganizationSettings;
}

export interface OrganizationSettings {
  enableAI: boolean;
  enableReports: boolean;
  enableFirmwareOTA: boolean;
  enableAuditLogs: boolean;
  dataRetentionDays: number;
}

// ============================================================================
// Sensor Data (TimescaleDB)
// ============================================================================

/**
 * VL53L8CH Raw Data from FastAPI Backend
 * Matches backend_new/app/schemas/sensor_data.py:VL53L8CHRawData
 * ⚠️ Matrices are 2D arrays (8x8), not 1D
 */
export interface VL53L8CHRawData {
  time?: string;
  device_id?: string;
  sample_id?: string;
  // Raw matrices (8x8 for VL53L8CH)
  distance_matrix: number[][]; // 8x8 matrix (not 1D array!)
  reflectance_matrix: number[][]; // 8x8 matrix
  amplitude_matrix: number[][]; // 8x8 matrix

  // Quality assessment
  grade: string; // "A+", "A", "B", "C", "REJECT", "UNKNOWN"
  quality_score: number; // 0.0-1.0

  // Statistics (from VL53L8CHAnalysis schema)
  volume_mm3?: number;
  volume_trapezoidal_mm3?: number;
  volume_simpson_mm3?: number;
  volume_spline_mm3?: number;
  occupied_pixels?: number;
  base_area_mm2?: number;
  average_height_mm?: number;
  avg_height_mm?: number; // Alias
  max_height_mm?: number;
  min_height_mm?: number;
  height_range_mm?: number;
  height_variation_mm?: number; // Alias
  surface_uniformity?: number; // 0.0-1.0

  // Defects
  defects?: Array<{
    type: string;
    x?: number;
    y?: number;
    position?: { x: number; y: number };
    severity?: string;
  }>;

  // Advanced analysis
  bins_analysis?: {
    histogram?: number[]; // 128 bins
    bin_count?: number;
    multi_peak_detected?: boolean;
    multi_peak_count?: number;
    peak_bin_map?: number[][];
    roughness_score?: number;
    signal_quality?: number;
    texture_score?: number;
    density_score?: number;
    peak_bin?: number;
  } | number[]; // Can be array directly or object

  reflectance_analysis?: {
    avg_reflectance?: number;
    reflectance_uniformity?: number;
    optical_anomalies?: string[] | number;
  };

  amplitude_consistency?: {
    avg_amplitude?: number;
    amplitude_std?: number;
    amplitude_variance?: number;
    signal_stability?: number;
  } | number; // Can be number directly

  // Score breakdown
  score_breakdown?: {
    volume_score?: number;
    uniformity_score?: number;
    reflectance_score?: number;
    amplitude_score?: number;
    defect_penalty?: number;
  };

  temperature?: number;
  integration_time_ms?: number;
  metadata?: Record<string, any>;
}

export interface VL53L8CHAnalysis {
  time: string;
  device_id: string;
  sample_id?: string;
  grade: Grade;
  quality_score: number;
  volume_mm3?: number;
  avg_height_mm?: number;
  height_variation_mm?: number;
  surface_uniformity?: number;
  defects: string[];
  num_defects: number;
  analysis_version?: string;
}

export interface AS7341RawData {
  time: string;
  device_id: string;
  sample_id?: string;
  wavelengths: number[]; // 9 values
  intensities: number[]; // 9 values
  raw_counts: Record<string, number>;
  channels?: {
    F1_415nm: number;
    F2_445nm: number;
    F3_480nm: number;
    F4_515nm: number;
    F5_555nm: number;
    F6_590nm: number;
    F7_630nm: number;
    F8_680nm: number;
    NIR: number;
  };
  quality_metrics?: {
    freshness_index?: number;
    oxidation_index?: number;
    fat_quality_index?: number;
    color_uniformity?: number;
  };
  spectral_ratios?: Record<string, number>;
  defects?: string[];
  grade?: string;
  quality_score?: number;
  temperature?: number;
  integration_time_ms?: number;
  gain?: number;
  metadata?: Record<string, any>;
}

export interface AS7341Analysis {
  time: string;
  device_id: string;
  sample_id?: string;
  grade: Grade;
  quality_score: number;
  color_metrics?: ColorMetrics;
  spectral_signature?: number[];
  anomalies: string[];
  num_anomalies: number;
  analysis_version?: string;
}

export interface ColorMetrics {
  dominant_wavelength: number;
  color_purity: number;
  brightness: number;
  rgb_estimate: [number, number, number];
}

export interface FusionResult {
  id?: number;
  sample_id?: string;
  device_id?: string;
  time?: string;
  timestamp?: string; // ISO 8601 timestamp for display
  final_grade?: string;
  final_score?: number;
  quality_score?: number; // Alias for final_score
  fusion_mode?: string;
  num_defects?: number;
  defects?: string[];
  combined_defects?: Array<{
    type: string;
    position?: { x: number; y: number };
    severity?: string;
    x?: number;
    y?: number;
  }>;
  vl53l8ch_id?: number;
  vl53l8ch_grade?: string;
  vl53l8ch_score?: number;
  as7341_id?: number;
  as7341_grade?: string;
  as7341_score?: number;
  blockchain_hash?: string;
  qr_code_base64?: string;
  lot_abattage?: string;
  eleveur?: string;
  provenance?: string;
  metadata?: Record<string, any>;

  // Blockchain certification data
  blockchain?: {
    blockchain_hash?: string;
    blockchain_timestamp?: string;
    qr_code_base64?: string;
    lot_abattage?: string;
    eleveur?: string;
    provenance?: string;
  };

  // General metrics (for backward compatibility)
  metrics?: {
    volume_mm3?: number;
    color_uniformity?: number;
    freshness_index?: number;
    [key: string]: any;
  };
  
  // VL53L8CH sensor data (ToF)
  vl53l8ch?: {
    distance_matrix?: number[][];
    reflectance_matrix?: number[][];
    amplitude_matrix?: number[][];
    status_matrix?: number[][];
    quality_score?: number;
    grade?: string;
    avg_distance_mm?: number;
    min_distance_mm?: number;
    max_distance_mm?: number;
    uniformity?: number;
    defects?: Array<{
      type: string;
      position: { x: number; y: number };
      severity: string;
    }>;
    [key: string]: any;
  };
  
  // AS7341 sensor data
  as7341?: {
    freshness_index?: number;
    oxidation_index?: number;
    fat_quality_index?: number;
    color_uniformity?: number;
    quality_score?: number;
    grade?: string;
    channels?: Record<string, number>;
    spectral_ratios?: Record<string, number>;
    quality_metrics?: {
      freshness_index?: number;
      fat_quality_index?: number;
      color_uniformity?: number;
      oxidation_index?: number;
    };
    [key: string]: any;
  };
  
  // Additional metrics for charts
  lobe_thickness_mm?: number;
  delta_e?: number;
  l_star?: number;
  volume_mm3?: number;
  a_star?: number;
  b_star?: number;
  
  // Fusion scores and contributions
  tof_score?: number;
  spectral_score?: number;
  tof_contribution?: number;
  spectral_contribution?: number;
  
  // Foie gras specific metrics
  foie_gras_metrics?: {
    lobe_thickness_mm?: number;
    delta_e?: number;
    l_star?: number;
    a_star?: number;
    b_star?: number;
    volume_mm3?: number;
    estimated_volume_cm3?: number;
    fill_level_percent?: number;
    fill_deviation_mm?: number;
    defect_rate_percent?: number;
    dimensional_conformity_score?: number;
    dimensional_conformity_percent?: number;
    color_score_premium?: number;
    color_conformity_percent?: number;
    global_quality_score_100?: number;
    has_critical_color_deviation?: boolean;
    has_underfill?: boolean;
    has_oxidation_trend?: boolean;
    is_compliant?: boolean;
    is_downgraded?: boolean;
    is_rejected?: boolean;
    oxidation_severity?: number;
    process_cp?: number;
    process_cpk?: number;
    process_mean?: number;
    process_std?: number;
    is_centered?: boolean;
    process_capability?: string;
    [key: string]: any;
  };
}

export type Grade = "A" | "B" | "C" | "D" | "E";

// ============================================================================
// AI / ML Models
// ============================================================================

export interface AIModel {
  id: string;
  name: string;
  version: string;
  architecture: string;
  status: "active" | "inactive" | "training" | "testing";
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  latency_ms: number;
  created_at: string;
  updated_at: string;
  training_dataset_id?: string;
  deployment_date?: string;
  metrics: ModelMetrics;
}

export interface ModelMetrics {
  total_predictions: number;
  correct_predictions: number;
  confusion_matrix: number[][];
  class_accuracies: Record<string, number>;
  avg_confidence: number;
}

export interface TrainingJob {
  id: string;
  model_name: string;
  architecture: string;
  dataset_train_id: string;
  dataset_val_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  current_epoch: number;
  total_epochs: number;
  current_loss: number;
  current_accuracy: number;
  best_accuracy: number;
  estimated_time_remaining?: number;
  started_at?: string;
  completed_at?: string;
  hyperparameters: Hyperparameters;
  logs: TrainingLog[];
}

export interface Hyperparameters {
  learning_rate: number;
  batch_size: number;
  epochs: number;
  optimizer: string;
  loss_function: string;
  early_stopping: boolean;
  patience?: number;
  [key: string]: any;
}

export interface TrainingLog {
  epoch: number;
  loss: number;
  accuracy: number;
  val_loss: number;
  val_accuracy: number;
  timestamp: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  type: "train" | "validation" | "test";
  num_samples: number;
  num_classes: number;
  classes: string[];
  date_range: [string, string];
  created_at: string;
  size_bytes: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// Reports
// ============================================================================

export interface Report {
  id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  status: "generating" | "completed" | "failed";
  progress: number;
  config: ReportConfig;
  file_url?: string;
  file_size?: number;
  generated_at?: string;
  generated_by: string;
  organization_ids: string[];
}

export type ReportType =
  | "quality_daily"
  | "quality_weekly"
  | "quality_monthly"
  | "production_summary"
  | "ai_performance"
  | "audit"
  | "custom";

export type ReportFormat = "pdf" | "excel" | "csv" | "json";

export interface ReportConfig {
  name: string;
  type: ReportType;
  format: ReportFormat;
  date_range: [string, string];
  organization_ids: string[];
  filters: ReportFilters;
  sections: ReportSection[];
  template_id?: string;
}

export interface ReportFilters {
  grades?: Grade[];
  devices?: string[];
  sample_ids?: string[];
  min_quality_score?: number;
  max_quality_score?: number;
  has_defects?: boolean;
}

export interface ReportSection {
  id: string;
  type: string;
  title: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface ScheduledReport {
  id: string;
  report_config: ReportConfig;
  frequency: ReportFrequency;
  enabled: boolean;
  last_run?: string;
  next_run: string;
  recipients: string[];
  created_by: string;
  created_at: string;
}

export interface ReportFrequency {
  type: "daily" | "weekly" | "monthly" | "quarterly";
  time?: string; // HH:MM
  day_of_week?: number; // 0-6
  day_of_month?: number; // 1-31
}

// ============================================================================
// Devices & Firmware
// ============================================================================

export interface Device {
  id: string;
  name: string;
  type: "VL53L8CH" | "AS7341" | "ESP32";
  status: "online" | "offline" | "maintenance" | "error";
  firmware_version: string;
  hardware_version: string;
  organization_id: string;
  location: string;
  last_seen: string;
  uptime_seconds: number;
  metrics: DeviceMetrics;
  config: DeviceConfig;
}

export interface DeviceMetrics {
  cpu_usage: number;
  memory_usage: number;
  temperature: number;
  measurements_count: number;
  errors_count: number;
  last_measurement?: string;
}

export interface DeviceConfig {
  sampling_rate_hz: number;
  integration_time_ms: number;
  gain?: number;
  auto_calibration: boolean;
  [key: string]: any;
}

export interface FirmwareVersion {
  version: string;
  release_date: string;
  changelog: string[];
  file_url: string;
  file_size: number;
  checksum: string;
  compatible_hardware: string[];
  status: "stable" | "beta" | "deprecated";
}

export interface OTAUpdate {
  id: string;
  device_ids: string[];
  firmware_version: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;
  started_at?: string;
  completed_at?: string;
  results: OTAResult[];
}

export interface OTAResult {
  device_id: string;
  status: "success" | "failed";
  error?: string;
  completed_at: string;
}

// ============================================================================
// Users & Administration
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
  organization_ids: string[];
  status: "active" | "inactive" | "suspended";
  created_at: string;
  last_login?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: "fr" | "en";
  timezone: string;
  theme: "light" | "dark" | "auto";
  notifications: NotificationPreferences;
  dashboard_layout?: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  quality_alerts: boolean;
  system_alerts: boolean;
  report_completion: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  organization_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  ip_address: string;
  user_agent: string;
  status: "success" | "failure";
}

// ============================================================================
// Dashboard & Analytics
// ============================================================================

export interface DashboardMetrics {
  totalSamples: number;
  samplesProcessedToday: number;
  samplesProcessedWeek: number;
  samplesProcessedMonth: number;
  averageQuality: number;
  successRate: number;
  activeDevices: number;
  totalDevices?: number;
  offlineDevices: number;
  recentAlerts: number;
  qualityTrend: "up" | "down" | "stable";
  processingRate: number;
  recentAnalyses?: any[];
  gradeDistribution?: Record<string, number>;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

export interface GradeDistribution {
  grade: Grade;
  count: number;
  percentage: number;
}

export interface DefectAnalysis {
  defect_type: string;
  count: number;
  percentage: number;
  severity: "low" | "medium" | "high";
}

// ============================================================================
// WebSocket Messages
// ============================================================================

export interface WSMessage {
  type: WSMessageType;
  payload: any;
  timestamp: string;
}

export type WSMessageType =
  | "sensor_data"
  | "analysis_result"
  | "device_status"
  | "alert"
  | "notification"
  | "system_status";

export interface SensorDataMessage {
  device_id: string;
  sensor_type: "VL53L8CH" | "AS7341";
  data: VL53L8CHRawData | AS7341RawData;
}

export interface AnalysisResultMessage {
  sample_id: string;
  result: FusionResult;
  confidence: number;
}

export interface DeviceStatusMessage {
  device_id: string;
  status: Device["status"];
  metrics: DeviceMetrics;
}

export interface AlertMessage {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ApiMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ApiMetadata {
  page?: number;
  page_size?: number;
  total_count?: number;
  total_pages?: number;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next?: string;
  previous?: string;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface FilterState {
  dateRange: [Date, Date];
  organizations: string[];
  devices: string[];
  grades: Grade[];
  searchQuery: string;
}

export interface SortState {
  field: string;
  direction: "asc" | "desc";
}

export interface TableState {
  page: number;
  pageSize: number;
  sort: SortState;
  filters: Record<string, any>;
}
