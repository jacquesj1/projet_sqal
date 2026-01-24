// ============================================================================
// SQAL Frontend - Permissions Hook
// Role-based access control using Keycloak
// ============================================================================

import { useAuth, type UserInfo } from "@/contexts/AuthContext";
import { ROLES } from "@/config/keycloak";

export function usePermissions(): {
  user: UserInfo | null;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasMinimumRole: (minimumRole: string) => boolean;
  canViewDashboard: boolean;
  canEditData: boolean;
  canValidateBatch: boolean;
  canManageUsers: boolean;
  canConfigureSystem: boolean;
  canGenerateReports: boolean;
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  isQualityManager: boolean;
  isProductionOperator: boolean;
  isDataAnalyst: boolean;
  isViewer: boolean;
} {
  const { user, hasRole, hasAnyRole, hasMinimumRole } = useAuth();

  return {
    user,
    hasRole,
    hasAnyRole,
    hasMinimumRole,
    
    // Specific permission checks
    canViewDashboard: hasMinimumRole(ROLES.VIEWER),
    canEditData: hasMinimumRole(ROLES.PRODUCTION_OPERATOR),
    canValidateBatch: hasMinimumRole(ROLES.QUALITY_MANAGER),
    canManageUsers: hasMinimumRole(ROLES.ORG_ADMIN),
    canConfigureSystem: hasRole(ROLES.SUPER_ADMIN),
    canGenerateReports: hasAnyRole([ROLES.DATA_ANALYST, ROLES.QUALITY_MANAGER, ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN]),
    
    // Role checks
    isSuperAdmin: hasRole(ROLES.SUPER_ADMIN),
    isOrgAdmin: hasRole(ROLES.ORG_ADMIN),
    isQualityManager: hasRole(ROLES.QUALITY_MANAGER),
    isProductionOperator: hasRole(ROLES.PRODUCTION_OPERATOR),
    isDataAnalyst: hasRole(ROLES.DATA_ANALYST),
    isViewer: hasRole(ROLES.VIEWER),
  };
}
