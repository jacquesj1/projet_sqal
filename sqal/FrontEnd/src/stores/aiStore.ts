// ============================================================================
// AI Store - Zustand
// Gestion de l'état des modèles IA et entraînements
// ============================================================================

import { create } from 'zustand';
import type { AIModel, TrainingJob } from '@/types/api';

interface AIState {
  models: AIModel[];
  activeModel: AIModel | null;
  trainingJobs: TrainingJob[];
  activeTraining: TrainingJob | null;
  isLoading: boolean;
  error: string | null;

  // Statistics
  totalModels: number;
  activeModels: number;
  averageAccuracy: number;

  // Actions
  setModels: (models: AIModel[]) => void;
  addModel: (model: AIModel) => void;
  updateModel: (id: string, data: Partial<AIModel>) => void;
  removeModel: (id: string) => void;
  setActiveModel: (model: AIModel | null) => void;
  
  setTrainingJobs: (jobs: TrainingJob[]) => void;
  addTrainingJob: (job: TrainingJob) => void;
  updateTrainingJob: (id: string, data: Partial<TrainingJob>) => void;
  setActiveTraining: (job: TrainingJob | null) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  models: [],
  activeModel: null,
  trainingJobs: [],
  activeTraining: null,
  isLoading: false,
  error: null,
  totalModels: 0,
  activeModels: 0,
  averageAccuracy: 0,
};

export const useAIStore = create<AIState>((set) => ({
  ...initialState,

  setModels: (models) => {
    const activeModels = models.filter((m) => m.status === 'active');
    const avgAccuracy =
      activeModels.length > 0
        ? activeModels.reduce((sum, m) => sum + (m.accuracy || 0), 0) / activeModels.length
        : 0;

    set({
      models,
      totalModels: models.length,
      activeModels: activeModels.length,
      averageAccuracy: avgAccuracy,
    });
  },

  addModel: (model) =>
    set((state) => {
      const newModels = [...state.models, model];
      const activeModels = newModels.filter((m) => m.status === 'active');
      const avgAccuracy =
        activeModels.length > 0
          ? activeModels.reduce((sum, m) => sum + (m.accuracy || 0), 0) / activeModels.length
          : 0;

      return {
        models: newModels,
        totalModels: newModels.length,
        activeModels: activeModels.length,
        averageAccuracy: avgAccuracy,
      };
    }),

  updateModel: (id, data) =>
    set((state) => {
      const newModels = state.models.map((model) =>
        model.id === id ? { ...model, ...data } : model
      );
      const activeModels = newModels.filter((m) => m.status === 'active');
      const avgAccuracy =
        activeModels.length > 0
          ? activeModels.reduce((sum, m) => sum + (m.accuracy || 0), 0) / activeModels.length
          : 0;

      return {
        models: newModels,
        activeModel:
          state.activeModel?.id === id
            ? { ...state.activeModel, ...data }
            : state.activeModel,
        activeModels: activeModels.length,
        averageAccuracy: avgAccuracy,
      };
    }),

  removeModel: (id) =>
    set((state) => {
      const newModels = state.models.filter((model) => model.id !== id);
      const activeModels = newModels.filter((m) => m.status === 'active');
      const avgAccuracy =
        activeModels.length > 0
          ? activeModels.reduce((sum, m) => sum + (m.accuracy || 0), 0) / activeModels.length
          : 0;

      return {
        models: newModels,
        activeModel: state.activeModel?.id === id ? null : state.activeModel,
        totalModels: newModels.length,
        activeModels: activeModels.length,
        averageAccuracy: avgAccuracy,
      };
    }),

  setActiveModel: (model) =>
    set({ activeModel: model }),

  setTrainingJobs: (jobs) =>
    set({ trainingJobs: jobs }),

  addTrainingJob: (job) =>
    set((state) => ({
      trainingJobs: [...state.trainingJobs, job],
    })),

  updateTrainingJob: (id, data) =>
    set((state) => ({
      trainingJobs: state.trainingJobs.map((job) =>
        job.id === id ? { ...job, ...data } : job
      ),
      activeTraining:
        state.activeTraining?.id === id
          ? { ...state.activeTraining, ...data }
          : state.activeTraining,
    })),

  setActiveTraining: (job) =>
    set({ activeTraining: job }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setError: (error) =>
    set({ error }),

  reset: () =>
    set(initialState),
}));
