// ============================================================================
// Organization Store - Zustand
// Gestion multi-organisation
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Organization {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface OrganizationState {
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchOrganizations: () => Promise<void>;
  setCurrentOrganization: (org: Organization) => void;
  setOrganizations: (orgs: Organization[]) => void;
  addOrganization: (org: Organization) => void;
  updateOrganization: (id: string, data: Partial<Organization>) => void;
  removeOrganization: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  currentOrganization: null,
  organizations: [],
  isLoading: false,
  error: null,
};

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      ...initialState,

      fetchOrganizations: async () => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Implement API call when backend is ready
          // const orgs = await api.organizations.getAll();
          // set({ organizations: orgs, isLoading: false });
          set({ isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },

      setCurrentOrganization: (org) =>
        set({ currentOrganization: org }),

      setOrganizations: (orgs) =>
        set({ organizations: orgs }),

      addOrganization: (org) =>
        set((state) => ({
          organizations: [...state.organizations, org],
        })),

      updateOrganization: (id, data) =>
        set((state) => ({
          organizations: state.organizations.map((org) =>
            org.id === id ? { ...org, ...data } : org
          ),
          currentOrganization:
            state.currentOrganization?.id === id
              ? { ...state.currentOrganization, ...data }
              : state.currentOrganization,
        })),

      removeOrganization: (id) =>
        set((state) => ({
          organizations: state.organizations.filter((org) => org.id !== id),
          currentOrganization:
            state.currentOrganization?.id === id
              ? null
              : state.currentOrganization,
        })),

      setLoading: (loading) =>
        set({ isLoading: loading }),

      setError: (error) =>
        set({ error }),

      reset: () =>
        set(initialState),
    }),
    {
      name: 'organization-storage',
      partialize: (state) => ({
        currentOrganization: state.currentOrganization,
        organizations: state.organizations,
      }),
    }
  )
);
