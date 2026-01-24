// ============================================================================
// SQAL Frontend - API Service
// Axios-based HTTP client for Django REST API
// ============================================================================

import axios, { AxiosError } from "axios";
import type {
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import {
  API_BASE_URL,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@constants/index";
import type { ApiError } from "@/types";
import type {
  UsersResponse,
  DevicesResponse,
  AuditLogsResponse,
  AIModelsResponse,
  AIMetrics,
  TrainingHistoryResponse,
  ReportsResponse,
  AnalysisHistoryResponse,
  DashboardMetrics,
} from "@/types/api";

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("sqal_auth_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;

      switch (status) {
        case HTTP_STATUS.UNAUTHORIZED:
          // Token expired or invalid - redirect to login
          // BYPASS TEMPORAIRE - Désactivé pour mode développement
          console.warn("⚠️ 401 Unauthorized - Redirection désactivée (mode dev)");
          // localStorage.removeItem("sqal_auth_token");
          // window.location.href = "/login";
          break;

        case HTTP_STATUS.FORBIDDEN:
          console.error("Access forbidden:", error.response.data);
          break;

        case HTTP_STATUS.NOT_FOUND:
          console.error("Resource not found:", error.config?.url);
          break;

        case HTTP_STATUS.INTERNAL_SERVER_ERROR:
          console.error("Server error:", error.response.data);
          break;
      }
    } else if (error.request) {
      console.error("Network error:", error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// API Methods
// ============================================================================

export const api = {
  // Generic methods
  get: <T>(url: string, params?: any): Promise<T> =>
    apiClient.get(url, { params }).then((res) => res.data),

  post: <T>(url: string, data?: any): Promise<T> =>
    apiClient.post(url, data).then((res) => res.data),

  put: <T>(url: string, data?: any): Promise<T> =>
    apiClient.put(url, data).then((res) => res.data),

  patch: <T>(url: string, data?: any): Promise<T> =>
    apiClient.patch(url, data).then((res) => res.data),

  delete: <T>(url: string): Promise<T> =>
    apiClient.delete(url).then((res) => res.data),

  // ============================================================================
  // Sensors API
  // ============================================================================

  sensors: {
    // VL53L8CH (ToF)
    getVL53L8CHRaw: (params?: any) =>
      api.get("/api/sensors/vl53l8ch/raw/", params),

    getVL53L8CHAnalysis: (params?: any) =>
      api.get("/api/sensors/vl53l8ch/analysis/", params),

    getVL53L8CHById: (id: string) =>
      api.get(`/api/sensors/vl53l8ch/raw/${id}/`),

    // AS7341 (Spectral)
    getAS7341Raw: (params?: any) =>
      api.get("/api/sensors/as7341/raw/", params),

    getAS7341Analysis: (params?: any) =>
      api.get("/api/sensors/as7341/analysis/", params),

    getAS7341ById: (id: string) =>
      api.get(`/api/sensors/as7341/raw/${id}/`),

    // Fusion Results
    getFusionResults: (params?: any) =>
      api.get("/api/sensors/fusion/", params),

    getFusionById: (id: string) =>
      api.get(`/api/sensors/fusion/${id}/`),

    // Device Management
    getDevices: (params?: any) =>
      api.get("/api/sensors/devices/", params),

    getDeviceById: (id: string) =>
      api.get(`/api/sensors/devices/${id}/`),

    updateDevice: (id: string, data: any) =>
      api.patch(`/api/sensors/devices/${id}/`, data),

    calibrateDevice: (id: string) =>
      api.post(`/api/sensors/devices/${id}/calibrate/`),
  },

  // ============================================================================
  // Analysis API
  // ============================================================================

  analysis: {
    // Historical Analysis
    getHistory: (params?: any): Promise<AnalysisHistoryResponse> =>
      api.get<AnalysisHistoryResponse>("/api/analysis/history/", params),

    getById: (id: string) =>
      api.get(`/api/analysis/history/${id}/`),

    exportData: async (params: any): Promise<Blob> => {
      const response = await apiClient.post("/api/analysis/export/", params, { responseType: "blob" });
      return response.data;
    },

    // Statistics
    getStats: (params?: any) =>
      api.get("/api/analysis/stats/", params),

    getGradeDistribution: (params?: any) =>
      api.get("/api/analysis/grade-distribution/", params),

    getDefectAnalysis: (params?: any) =>
      api.get("/api/analysis/defect-analysis/", params),

    // Time Series
    getTimeSeries: (params?: any) =>
      api.get("/api/analysis/timeseries/", params),
  },

  // ============================================================================
  // AI / ML API
  // ============================================================================

  ai: {
    // Metrics
    getMetrics: (): Promise<AIMetrics> =>
      api.get<AIMetrics>("/api/ai/metrics/"),

    // Models
    getModels: (params?: any): Promise<AIModelsResponse> =>
      api.get<AIModelsResponse>("/api/ai/models/", params),

    getModelById: (id: string) =>
      api.get(`/api/ai/models/${id}/`),

    createModel: (data: any) =>
      api.post("/api/ai/models/", data),

    updateModel: (id: string, data: any) =>
      api.patch(`/api/ai/models/${id}/`, data),

    deleteModel: (id: string) =>
      api.delete(`/api/ai/models/${id}/`),

    activateModel: (id: string) =>
      api.post(`/api/ai/models/${id}/activate/`),

    deactivateModel: (id: string) =>
      api.post(`/api/ai/models/${id}/deactivate/`),

    getModelMetrics: (id: string) =>
      api.get(`/api/ai/models/${id}/metrics/`),

    // Training
    getTrainingJobs: (params?: any): Promise<TrainingHistoryResponse> =>
      api.get<TrainingHistoryResponse>("/api/ai/training/", params),

    getTrainingJobById: (id: string) =>
      api.get(`/api/ai/training/${id}/`),

    createTrainingJob: (data: any) =>
      api.post("/api/ai/training/", data),

    cancelTrainingJob: (id: string) =>
      api.post(`/api/ai/training/${id}/cancel/`),

    getTrainingLogs: (id: string) =>
      api.get(`/api/ai/training/${id}/logs/`),

    // Datasets
    getDatasets: (params?: any) =>
      api.get("/api/ai/datasets/", params),

    getDatasetById: (id: string) =>
      api.get(`/api/ai/datasets/${id}/`),

    createDataset: (data: any) =>
      api.post("/api/ai/datasets/", data),

    deleteDataset: (id: string) =>
      api.delete(`/api/ai/datasets/${id}/`),

    // Predictions
    getPredictions: (params?: any) =>
      api.get("/api/ai/predictions/", params),

    predict: (data: any) =>
      api.post("/api/ai/predict/", data),
  },

  // ============================================================================
  // Reports API
  // ============================================================================

  reports: {
    // Reports
    getReports: (params?: any): Promise<ReportsResponse> =>
      api.get<ReportsResponse>("/api/reports/", params),

    getReportById: (id: string) =>
      api.get(`/api/reports/${id}/`),

    createReport: (data: any) =>
      api.post("/api/reports/", data),

    deleteReport: (id: string) =>
      api.delete(`/api/reports/${id}/`),

    downloadReport: (id: string) =>
      apiClient.get(`/api/reports/${id}/download/`, { responseType: "blob" })
        .then((res) => res.data),

    shareReport: (id: string, data: any) =>
      api.post(`/api/reports/${id}/share/`, data),

    // Scheduled Reports
    getScheduledReports: (params?: any) =>
      api.get("/api/reports/scheduled/", params),

    getScheduledReportById: (id: string) =>
      api.get(`/api/reports/scheduled/${id}/`),

    createScheduledReport: (data: any) =>
      api.post("/api/reports/scheduled/", data),

    updateScheduledReport: (id: string, data: any) =>
      api.patch(`/api/reports/scheduled/${id}/`, data),

    deleteScheduledReport: (id: string) =>
      api.delete(`/api/reports/scheduled/${id}/`),

    toggleScheduledReport: (id: string, enabled: boolean) =>
      api.patch(`/api/reports/scheduled/${id}/`, { enabled }),

    // Templates
    getTemplates: (params?: any) =>
      api.get("/api/reports/templates/", params),

    getTemplateById: (id: string) =>
      api.get(`/api/reports/templates/${id}/`),

    createTemplate: (data: any) =>
      api.post("/api/reports/templates/", data),

    updateTemplate: (id: string, data: any) =>
      api.patch(`/api/reports/templates/${id}/`, data),

    deleteTemplate: (id: string) =>
      api.delete(`/api/reports/templates/${id}/`),
  },

  // ============================================================================
  // Firmware / OTA API
  // ============================================================================

  firmware: {
    // Firmware Versions
    getVersions: (params?: any) =>
      api.get("/api/firmware/versions/", params),

    getVersionById: (id: string) =>
      api.get(`/api/firmware/versions/${id}/`),

    uploadVersion: (data: FormData) =>
      apiClient.post("/api/firmware/versions/", data, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((res) => res.data),

    deleteVersion: (id: string) =>
      api.delete(`/api/firmware/versions/${id}/`),

    // OTA Updates
    getOTAUpdates: (params?: any) =>
      api.get("/api/firmware/ota/", params),

    getOTAUpdateById: (id: string) =>
      api.get(`/api/firmware/ota/${id}/`),

    createOTAUpdate: (data: any) =>
      api.post("/api/firmware/ota/", data),

    cancelOTAUpdate: (id: string) =>
      api.post(`/api/firmware/ota/${id}/cancel/`),
  },

  // ============================================================================
  // Users & Admin API
  // ============================================================================

  users: {
    // Users
    getUsers: (params?: any) =>
      api.get("/api/users/", params),

    getUserById: (id: string) =>
      api.get(`/api/users/${id}/`),

    createUser: (data: any) =>
      api.post("/api/users/", data),

    updateUser: (id: string, data: any) =>
      api.patch(`/api/users/${id}/`, data),

    deleteUser: (id: string) =>
      api.delete(`/api/users/${id}/`),

    activateUser: (id: string) =>
      api.post(`/api/users/${id}/activate/`),

    deactivateUser: (id: string) =>
      api.post(`/api/users/${id}/deactivate/`),

    resetPassword: (id: string) =>
      api.post(`/api/users/${id}/reset-password/`),

    // Current User
    getCurrentUser: () =>
      api.get("/api/users/me/"),

    updateCurrentUser: (data: any) =>
      api.patch("/api/users/me/", data),

    updatePreferences: (data: any) =>
      api.patch("/api/users/me/preferences/", data),
  },

  // ============================================================================
  // Organizations API
  // ============================================================================

  organizations: {
    getOrganizations: (params?: any) =>
      api.get("/api/organizations/", params),

    getOrganizationById: (id: string) =>
      api.get(`/api/organizations/${id}/`),

    createOrganization: (data: any) =>
      api.post("/api/organizations/", data),

    updateOrganization: (id: string, data: any) =>
      api.patch(`/api/organizations/${id}/`, data),

    deleteOrganization: (id: string) =>
      api.delete(`/api/organizations/${id}/`),
  },

  // ============================================================================
  // Audit Logs API
  // ============================================================================

  audit: {
    getLogs: (params?: any) =>
      api.get("/api/audit/logs/", params),

    getLogById: (id: string) =>
      api.get(`/api/audit/logs/${id}/`),

    exportLogs: (params: any) =>
      apiClient.get("/api/audit/logs/export/", { params, responseType: "blob" })
        .then((res) => res.data),
  },

  // ============================================================================
  // Admin API
  // ============================================================================

  admin: {
    // Devices
    getDevices: (params?: any): Promise<DevicesResponse> =>
      api.get<DevicesResponse>("/api/admin/devices/", params),

    getDeviceById: (id: string) =>
      api.get(`/api/admin/devices/${id}/`),

    updateDevice: (id: string, data: any) =>
      api.patch(`/api/admin/devices/${id}/`, data),

    deleteDevice: (id: string) =>
      api.delete(`/api/admin/devices/${id}/`),

    // Users
    getUsers: (params?: any): Promise<UsersResponse> =>
      api.get<UsersResponse>("/api/admin/users/", params),

    getUserById: (id: string) =>
      api.get(`/api/admin/users/${id}/`),

    createUser: (data: any) =>
      api.post("/api/admin/users/", data),

    updateUser: (id: string, data: any) =>
      api.patch(`/api/admin/users/${id}/`, data),

    deleteUser: (id: string) =>
      api.delete(`/api/admin/users/${id}/`),

    // Audit Logs
    getAuditLogs: (params?: any): Promise<AuditLogsResponse> =>
      api.get<AuditLogsResponse>("/api/admin/audit/", params),

    getAuditLogById: (id: string) =>
      api.get(`/api/admin/audit/${id}/`),

    exportAuditLogs: (params: any) =>
      apiClient.get("/api/admin/audit/export/", { params, responseType: "blob" })
        .then((res) => res.data),

    // Calibration endpoints
    startCalibration: (data: { device_id: string; sensor_type: "tof" | "as7341" }) => 
      api.post("/api/admin/calibration/start/", data),

    getCalibrations: (params?: any) =>
      api.get("/api/admin/calibration/", params),

    // Settings
    getSettings: () =>
      api.get("/api/admin/settings/"),

    updateSettings: (data: any) =>
      api.patch("/api/admin/settings/", data),
  },

  // ============================================================================
  // Dashboard API
  // ============================================================================

  dashboard: {
    getMetrics: (params?: any): Promise<DashboardMetrics> =>
      api.get<DashboardMetrics>("/api/sqal/dashboard/overview", params),

    getRealtimeStats: () =>
      api.get("/api/sqal/dashboard/overview"),

    getSystemStatus: () =>
      api.get("/api/sqal/dashboard/overview"),

    getDevices: (params?: any) =>
      api.get("/api/sqal/devices", params),

    getFoieGrasMetrics: (params?: any) =>
      api.get("/api/sqal/dashboard/overview", params),

    getFoieGrasAlerts: (params?: any) =>
      api.get("/api/sqal/alerts", params),
  },
};

// ============================================================================
// Error Handling Utilities
// ============================================================================

export function handleApiError(error: any): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    if (axiosError.response) {
      return {
        code: `HTTP_${axiosError.response.status}`,
        message: (axiosError.response.data as any)?.message || ERROR_MESSAGES.INTERNAL_ERROR,
        details: axiosError.response.data as any,
      };
    } else if (axiosError.request) {
      return {
        code: "NETWORK_ERROR",
        message: ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  return {
    code: "UNKNOWN_ERROR",
    message: error.message || "Une erreur inconnue s'est produite",
  };
}

export default api;
