// ============================================================================
// SQAL Frontend - API Response Types (Comprehensive)
// Types complets pour toutes les réponses API
// ============================================================================

import type {
  AIModel,
  TrainingJob,
  Report,
  Device,
  User,
  AuditLog,
  FusionResult,
  PaginationInfo,
} from "./api";

// ============================================================================
// Admin API Responses
// ============================================================================

export interface UsersResponse {
  users: User[];
  total: number;
  active: number;
}

export interface DevicesResponse {
  devices: Device[];
  total: number;
  online: number;
  offline: number;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
}

// ============================================================================
// AI API Responses
// ============================================================================

export interface AIModelsResponse {
  models: AIModel[];
  total: number;
}

export interface AIMetrics {
  averageAccuracy: number;
  averageValAccuracy: number;
  totalModels: number;
  activeModels: number;
  trainingModels: number;
}

export interface TrainingHistoryResponse {
  trainings: TrainingJob[];
  total: number;
}

// ============================================================================
// Reports API Responses
// ============================================================================

export interface ReportsResponse {
  reports: Report[];
  total: number;
}

// ============================================================================
// Analysis API Responses
// ============================================================================

export interface AnalysisHistoryResponse {
  analyses: FusionResult[];
  pagination?: PaginationInfo;
  total?: number;
}
