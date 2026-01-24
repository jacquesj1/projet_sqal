// ============================================================================
// SQAL Frontend - Authentication Types
// Types pour l'authentification et les permissions
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  roles: string[];
  permissions: string[];
}

export type Role =
  | "super_admin"
  | "org_admin"
  | "quality_manager"
  | "production_operator"
  | "data_analyst"
  | "viewer";

export type Permission =
  | "view_dashboard"
  | "view_sensors"
  | "view_analysis"
  | "view_ai"
  | "view_reports"
  | "view_admin"
  | "manage_users"
  | "manage_devices"
  | "manage_organizations"
  | "manage_ai_models"
  | "export_data"
  | "generate_reports";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}
