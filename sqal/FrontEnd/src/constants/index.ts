// ============================================================================
// SQAL Frontend - Constants & Configuration
// ============================================================================

// API Configuration
//export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
//export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";

// Keycloak Configuration
export const KEYCLOAK_CONFIG = {
  url: import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080",
  realm: import.meta.env.VITE_KEYCLOAK_REALM || "sqal_realm",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "sqal-frontend",
};

// Feature Flags
export const FEATURES = {
  ENABLE_3D_VISUALIZATION: import.meta.env.VITE_ENABLE_3D_VISUALIZATION === "true",
  ENABLE_AI_TRAINING: import.meta.env.VITE_ENABLE_AI_TRAINING === "true",
  ENABLE_REPORTS: import.meta.env.VITE_ENABLE_REPORTS === "true",
  ENABLE_FIRMWARE_OTA: import.meta.env.VITE_ENABLE_FIRMWARE_OTA === "true",
  ENABLE_AUDIT_LOGS: import.meta.env.VITE_ENABLE_AUDIT_LOGS === "true",
  ENABLE_WHITE_LABEL: import.meta.env.VITE_ENABLE_WHITE_LABEL === "true",
};

// Roles & Permissions
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ORG_ADMIN: "org_admin",
  QUALITY_MANAGER: "quality_manager",
  PRODUCTION_OPERATOR: "production_operator",
  DATA_ANALYST: "data_analyst",
  VIEWER: "viewer",
} as const;

export const PERMISSIONS_MATRIX: Record<string, string[]> = {
  [ROLES.SUPER_ADMIN]: ["*"],
  [ROLES.ORG_ADMIN]: [
    "dashboard:view",
    "analysis:view",
    "analysis:export",
    "ai:view",
    "ai:manage",
    "reports:view",
    "reports:create",
    "reports:schedule",
    "devices:view",
    "devices:manage",
    "firmware:manage",
    "users:view",
    "users:manage",
    "audit:view",
    "settings:manage",
  ],
  [ROLES.QUALITY_MANAGER]: [
    "dashboard:view",
    "analysis:view",
    "analysis:export",
    "ai:view",
    "reports:view",
    "reports:create",
    "devices:view",
    "audit:view",
  ],
  [ROLES.PRODUCTION_OPERATOR]: [
    "dashboard:view",
    "analysis:view",
    "devices:view",
  ],
  [ROLES.DATA_ANALYST]: [
    "dashboard:view",
    "analysis:view",
    "analysis:export",
    "ai:view",
    "reports:view",
    "reports:create",
  ],
  [ROLES.VIEWER]: [
    "dashboard:view",
    "analysis:view",
  ],
};

// Grades
export const GRADES = ["A", "B", "C", "D", "E"] as const;

export const GRADE_LABELS: Record<string, string> = {
  A: "Excellent",
  B: "Bon",
  C: "Acceptable",
  D: "Médiocre",
  E: "Non conforme",
};

export const GRADE_COLORS: Record<string, string> = {
  A: "#10b981", // green-500
  B: "#3b82f6", // blue-500
  C: "#f59e0b", // yellow-500
  D: "#f97316", // orange-500
  E: "#ef4444", // red-500
};

// Sensor Types
export const SENSOR_TYPES = {
  VL53L8CH: "VL53L8CH",
  AS7341: "AS7341",
  ESP32: "ESP32",
} as const;

// Wavelengths for AS7341 (nm)
export const AS7341_WAVELENGTHS = [415, 445, 480, 515, 555, 590, 630, 680, 910];

export const AS7341_CHANNEL_NAMES = [
  "F1 (Violet)",
  "F2 (Indigo)",
  "F3 (Blue)",
  "F4 (Cyan)",
  "F5 (Green)",
  "F6 (Yellow)",
  "F7 (Orange)",
  "F8 (Red)",
  "NIR",
];

// Report Types
export const REPORT_TYPES = [
  { value: "quality_daily", label: "Qualité Quotidien" },
  { value: "quality_weekly", label: "Qualité Hebdomadaire" },
  { value: "quality_monthly", label: "Qualité Mensuel" },
  { value: "production_summary", label: "Résumé Production" },
  { value: "ai_performance", label: "Performance IA" },
  { value: "audit", label: "Audit" },
  { value: "custom", label: "Personnalisé" },
] as const;

export const REPORT_FORMATS = [
  { value: "pdf", label: "PDF" },
  { value: "excel", label: "Excel" },
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
] as const;

// Time Ranges
export const TIME_RANGES = [
  { value: "1h", label: "Dernière heure" },
  { value: "6h", label: "6 dernières heures" },
  { value: "24h", label: "24 dernières heures" },
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "90d", label: "90 derniers jours" },
  { value: "custom", label: "Personnalisé" },
] as const;

// Chart Colors
export const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // yellow
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

// WebSocket Events
export const WS_EVENTS = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  ERROR: "error",
  SENSOR_DATA: "sensor_data",
  ANALYSIS_RESULT: "analysis_result",
  DEVICE_STATUS: "device_status",
  ALERT: "alert",
  NOTIFICATION: "notification",
  SYSTEM_STATUS: "system_status",
} as const;

// Refresh Intervals (ms)
export const REFRESH_INTERVALS = {
  REALTIME: 1000, // 1 second
  FAST: 5000, // 5 seconds
  NORMAL: 30000, // 30 seconds
  SLOW: 60000, // 1 minute
} as const;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: "dd/MM/yyyy HH:mm:ss",
  DISPLAY_SHORT: "dd/MM/yyyy",
  API: "yyyy-MM-dd'T'HH:mm:ss",
  FILE: "yyyy-MM-dd_HH-mm-ss",
} as const;

// File Size Limits
export const FILE_SIZE_LIMITS = {
  FIRMWARE: 10 * 1024 * 1024, // 10 MB
  DATASET: 1024 * 1024 * 1024, // 1 GB
  REPORT: 100 * 1024 * 1024, // 100 MB
} as const;

// Validation Rules
export const VALIDATION = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  PASSWORD_MIN_LENGTH: 8,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  DEVICE_ID_REGEX: /^[A-Z0-9_-]+$/,
} as const;

// Toast Durations (ms)
export const TOAST_DURATION = {
  SHORT: 2000,
  NORMAL: 4000,
  LONG: 6000,
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: "sqal_auth_token",
  REFRESH_TOKEN: "sqal_refresh_token",
  USER_PREFERENCES: "sqal_user_preferences",
  SELECTED_ORG: "sqal_selected_org",
  THEME: "sqal_theme",
  DASHBOARD_LAYOUT: "sqal_dashboard_layout",
} as const;

// Navigation Routes
export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  ANALYSIS: "/analysis",
  ANALYSIS_HISTORY: "/analysis/history",
  SENSORS_VL53L8CH: "/sensors/vl53l8ch",
  SENSORS_AS7341: "/sensors/as7341",
  SENSORS_FUSION: "/sensors/fusion",
  ANALYSIS_DETAIL: "/analysis/:id",
  AI: "/ai",
  AI_MONITORING: "/ai/monitoring",
  AI_TRAINING: "/ai/training",
  AI_MODELS: "/ai/models",
  ANALYTICS: "/analytics",
  REPORTS: "/reports",
  REPORTS_NEW: "/reports/new",
  REPORTS_SCHEDULED: "/reports/scheduled",
  REPORTS_TEMPLATES: "/reports/templates",
  ADMIN: "/admin",
  ADMIN_DEVICES: "/admin/devices",
  ADMIN_FIRMWARE: "/admin/firmware",
  ADMIN_CALIBRATION: "/admin/calibration",
  ADMIN_USERS: "/admin/users",
  ADMIN_AUDIT: "/admin/audit",
  ADMIN_SETTINGS: "/admin/settings",
  PROFILE: "/profile",
  LOGIN: "/login",
  LOGOUT: "/logout",
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Erreur de connexion au serveur",
  UNAUTHORIZED: "Vous n'êtes pas autorisé à effectuer cette action",
  FORBIDDEN: "Accès refusé",
  NOT_FOUND: "Ressource non trouvée",
  VALIDATION_ERROR: "Erreur de validation des données",
  INTERNAL_ERROR: "Erreur interne du serveur",
  TIMEOUT: "Délai d'attente dépassé",
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  SAVED: "Enregistré avec succès",
  DELETED: "Supprimé avec succès",
  UPDATED: "Mis à jour avec succès",
  CREATED: "Créé avec succès",
  EXPORTED: "Exporté avec succès",
  UPLOADED: "Téléchargé avec succès",
} as const;
