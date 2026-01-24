// ============================================================================
// SQAL Frontend - useOrg Hook
// Hook personnalisé pour la gestion des organisations (wrapper organizationStore)
// ============================================================================

import { useOrganizationStore, type Organization } from "@/stores/organizationStore";

export function useOrg(): {
  organizations: Organization[];
  currentOrganization: Organization | null;
  isLoading: boolean;
  error: string | null;
  fetchOrganizations: () => Promise<void>;
  setCurrentOrganization: (org: Organization) => void;
  switchOrganization: (org: Organization) => void;
  hasMultipleOrgs: boolean;
  currentOrgId: string | undefined;
  currentOrgName: string | undefined;
} {
  const {
    organizations,
    currentOrganization,
    isLoading,
    error,
    fetchOrganizations,
    setCurrentOrganization,
  } = useOrganizationStore();

  return {
    // État
    organizations,
    currentOrganization,
    isLoading,
    error,

    // Actions
    fetchOrganizations,
    setCurrentOrganization,
    switchOrganization: setCurrentOrganization,

    // Helpers
    hasMultipleOrgs: organizations.length > 1,
    currentOrgId: currentOrganization?.id,
    currentOrgName: currentOrganization?.name,
  };
}
