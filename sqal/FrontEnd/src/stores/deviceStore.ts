// ============================================================================
// Device Store - Zustand
// Gestion de l'état des appareils/capteurs
// ============================================================================

import { create } from 'zustand';
import type { Device } from '@/types/api';

interface DeviceState {
  devices: Device[];
  selectedDevice: Device | null;
  isLoading: boolean;
  error: string | null;

  // Statistics
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;

  // Actions
  setDevices: (devices: Device[]) => void;
  addDevice: (device: Device) => void;
  updateDevice: (id: string, data: Partial<Device>) => void;
  removeDevice: (id: string) => void;
  setSelectedDevice: (device: Device | null) => void;
  updateDeviceStatus: (id: string, status: 'online' | 'offline' | 'error') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  devices: [],
  selectedDevice: null,
  isLoading: false,
  error: null,
  totalDevices: 0,
  onlineDevices: 0,
  offlineDevices: 0,
};

export const useDeviceStore = create<DeviceState>((set) => ({
  ...initialState,

  setDevices: (devices) =>
    set({
      devices,
      totalDevices: devices.length,
      onlineDevices: devices.filter((d) => d.status === 'online').length,
      offlineDevices: devices.filter((d) => d.status === 'offline').length,
    }),

  addDevice: (device) =>
    set((state) => {
      const newDevices = [...state.devices, device];
      return {
        devices: newDevices,
        totalDevices: newDevices.length,
        onlineDevices: newDevices.filter((d) => d.status === 'online').length,
        offlineDevices: newDevices.filter((d) => d.status === 'offline').length,
      };
    }),

  updateDevice: (id, data) =>
    set((state) => {
      const newDevices = state.devices.map((device) =>
        device.id === id ? { ...device, ...data } : device
      );
      return {
        devices: newDevices,
        selectedDevice:
          state.selectedDevice?.id === id
            ? { ...state.selectedDevice, ...data }
            : state.selectedDevice,
        onlineDevices: newDevices.filter((d) => d.status === 'online').length,
        offlineDevices: newDevices.filter((d) => d.status === 'offline').length,
      };
    }),

  removeDevice: (id) =>
    set((state) => {
      const newDevices = state.devices.filter((device) => device.id !== id);
      return {
        devices: newDevices,
        selectedDevice: state.selectedDevice?.id === id ? null : state.selectedDevice,
        totalDevices: newDevices.length,
        onlineDevices: newDevices.filter((d) => d.status === 'online').length,
        offlineDevices: newDevices.filter((d) => d.status === 'offline').length,
      };
    }),

  setSelectedDevice: (device) =>
    set({ selectedDevice: device }),

  updateDeviceStatus: (id, status) =>
    set((state) => {
      const newDevices = state.devices.map((device) =>
        device.id === id ? { ...device, status } : device
      );
      return {
        devices: newDevices,
        onlineDevices: newDevices.filter((d) => d.status === 'online').length,
        offlineDevices: newDevices.filter((d) => d.status === 'offline').length,
      };
    }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setError: (error) =>
    set({ error }),

  reset: () =>
    set(initialState),
}));
