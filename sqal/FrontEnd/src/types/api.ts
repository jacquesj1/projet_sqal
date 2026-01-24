// ============================================================================
// SQAL Frontend - API Response Types
// TypeScript interfaces pour les réponses API
// ============================================================================

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationInfo {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResponse<T> {
  results: T[];
  pagination: PaginationInfo;
  total: number;
}

// ============================================================================
// Sensors
// ============================================================================

export interface VL53L8CHData {
  histogram: number[];
  avg_height_mm: number;
  height_variation_mm: number;
  volume_mm3: number;
  surface_uniformity: number;
}

export interface AS7341Data {
  channels: {
    F1_415nm: number;
    F2_445nm: number;
    F3_480nm: number;
    F4_515nm: number;
    F5_555nm: number;
    F6_590nm: number;
    F7_630nm: number;
    F8_680nm: number;
    Clear: number;
    NIR: number;
  };
  freshness_index: number;
  fat_quality_index: number;
  oxidation_index: number;
  spectral_ratios: {
    blue_red: number;
    green_nir: number;
    yellow_blue: number;
  };
  color_uniformity: number;
}

export interface FusionResult {
  id: string;
  time: string;
  deviceId: string;
  sampleId: string;
  grade: 'A+' | 'A' | 'B' | 'C' | 'REJECT';
  qualityScore: number;
  vl53l8chScore?: number;
  as7341Score?: number;
  vl53l8chGrade?: string;
  as7341Grade?: string;
  defects: string[];
  numDefects: number;
  vl53l8ch?: VL53L8CHData;
  as7341?: AS7341Data;
  lotAbattage?: string;
  eleveur?: string;
  provenance?: string;
  lobe_thickness_mm?: number;
  delta_e?: number;
  l_star?: number;
}

// ============================================================================
// Analysis
// ============================================================================

export interface Analysis {
  id: string;
  time: string;
  grade: 'A+' | 'A' | 'B' | 'C' | 'REJECT';
  qualityScore: number;
  numDefects: number;
  lotAbattage?: string;
  deviceId?: string;
  sampleId?: string;
}

export interface AnalysisHistoryResponse {
  analyses: FusionResult[];
  pagination?: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
}

export interface AnalysisResult {
  analyses: Analysis[];
  pagination: PaginationInfo;
  total: number;
}

export interface AnalysisStats {
  totalAnalyses: number;
  averageQuality: number;
  gradeDistribution: Record<string, number>;
  defectRate: number;
}

// ============================================================================
// AI / ML
// ============================================================================

export interface AIModel {
  id: string;
  name: string;
  type: string;
  version?: string;
  status: 'active' | 'inactive' | 'training' | 'error';
  accuracy?: number;
  valAccuracy?: number;
  size?: number;
  architecture?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AIModelsResponse {
  models: AIModel[];
  total: number;
}

export interface AIMetrics {
  averageAccuracy: number;
  averageValAccuracy: number;
  averageLatency?: string;
  bestModel?: AIModel;
  performanceHistory?: Array<{
    date: string;
    accuracy: number;
    valAccuracy: number;
  }>;
}

export interface TrainingJob {
  id: string;
  modelType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  currentEpoch?: number;
  totalEpochs: number;
  accuracy?: number;
  valAccuracy?: number;
  loss?: number;
  valLoss?: number;
}

export interface TrainingHistoryResponse {
  trainings: TrainingJob[];
  total: number;
}

// ============================================================================
// Reports
// ============================================================================

export interface Report {
  id: string;
  title: string;
  reportType: string;
  format: 'pdf' | 'excel' | 'csv' | 'json';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  fileUrl?: string;
  fileSize?: number;
}

export interface ReportsResponse {
  reports: Report[];
  total: number;
}

export interface ScheduledReport {
  id: string;
  reportConfig: any;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  enabled: boolean;
  nextRun?: string;
  lastRun?: string;
}

// ============================================================================
// Admin
// ============================================================================

export interface Device {
  id: string;
  name?: string;
  type: string;
  status: 'online' | 'offline' | 'error';
  firmware?: string;
  location?: string;
  lastSeen?: string;
  totalMeasurements?: number;
  ipAddress?: string;
}

export interface DevicesResponse {
  devices: Device[];
  total: number;
  online: number;
  offline: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  isStaff: boolean;
  roles: string[];
  lastLogin?: string;
  dateJoined: string;
}

export interface UsersResponse {
  users: User[];
  total: number;
  active: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout';
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  details?: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
}

// ============================================================================
// Dashboard
// ============================================================================

export interface DashboardMetrics {
  totalSamples: number;
  samplesToday: number;
  averageQuality: number;
  activeAlerts: number;
  successRate: number;
  activeDevices: number;
  totalDevices?: number;
  trend?: number;
  period?: string;
  recentAnalyses?: Analysis[];
  gradeDistribution?: Record<string, number>;
}

// ============================================================================
// Common
// ============================================================================

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  success: boolean;
}

// Re-export comprehensive response types
export * from './api-responses';
