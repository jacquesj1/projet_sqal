// ============================================================================
// SQAL Frontend - useAuth Hook
// Hook personnalisé pour l'authentification (wrapper authStore)
// ============================================================================

import { useAuthStore } from "@/stores/authStore";

export function useAuth() {
  const {
    isAuthenticated,
    user,
    token,
    roles,
    permissions,
    login,
    logout,
    hasRole,
    hasPermission,
  } = useAuthStore();

  return {
    // État
    isAuthenticated,
    user,
    token,
    roles,
    permissions,

    // Actions
    login,
    logout,

    // Helpers
    hasRole,
    hasPermission,
    isAdmin: hasRole("super_admin") || hasRole("org_admin"),
    isQualityManager: hasRole("quality_manager"),
    isOperator: hasRole("production_operator"),
    isAnalyst: hasRole("data_analyst"),
    isViewer: hasRole("viewer"),
  };
}
