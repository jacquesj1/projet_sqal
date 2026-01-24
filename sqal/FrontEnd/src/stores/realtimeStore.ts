// ============================================================================
// SQAL Frontend - Realtime Data Store (Zustand)
// Manages real-time sensor data and analysis results from WebSocket
// ============================================================================

import { create } from "zustand";
import type {
  VL53L8CHRawData,
  AS7341RawData,
  FusionResult,
  Device,
  AlertMessage,
} from "@/types";

interface RealtimeState {
  // WebSocket connection
  isConnected: boolean;
  connectionError: string | null;

  // Latest sensor data
  latestVL53L8CH: VL53L8CHRawData | null;
  latestAS7341: AS7341RawData | null;
  latestFusion: FusionResult | null;

  // Historical data (last N samples)
  vl53l8chHistory: VL53L8CHRawData[];
  as7341History: AS7341RawData[];
  fusionHistory: FusionResult[];
  maxHistorySize: number;

  // Device status
  devices: Map<string, Device>;

  // Alerts
  alerts: AlertMessage[];
  unreadAlertsCount: number;

  // Statistics
  samplesProcessedToday: number;
  conformityRate: number;
  averageProcessingTime: number;

  // Actions
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  updateVL53L8CH: (data: VL53L8CHRawData) => void;
  updateAS7341: (data: AS7341RawData) => void;
  updateFusion: (data: FusionResult) => void;
  updateDevice: (device: Device) => void;
  addAlert: (alert: AlertMessage) => void;
  acknowledgeAlert: (alertId: string) => void;
  clearAlerts: () => void;
  updateStatistics: (stats: Partial<RealtimeState>) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  // Initial state
  isConnected: false,
  connectionError: null,

  latestVL53L8CH: null,
  latestAS7341: null,
  latestFusion: null,

  vl53l8chHistory: [],
  as7341History: [],
  fusionHistory: [],
  maxHistorySize: 50,

  devices: new Map(),

  alerts: [],
  unreadAlertsCount: 0,

  samplesProcessedToday: 0,
  conformityRate: 0,
  averageProcessingTime: 0,

  // Actions
  setConnected: (connected) =>
    set({ isConnected: connected, connectionError: connected ? null : get().connectionError }),

  setConnectionError: (error) =>
    set({ connectionError: error }),

  updateVL53L8CH: (data) => {
    const { vl53l8chHistory, maxHistorySize } = get();
    const newHistory = [data, ...vl53l8chHistory].slice(0, maxHistorySize);
    set({
      latestVL53L8CH: data,
      vl53l8chHistory: newHistory,
    });
  },

  updateAS7341: (data) => {
    const { as7341History, maxHistorySize } = get();
    const newHistory = [data, ...as7341History].slice(0, maxHistorySize);
    set({
      latestAS7341: data,
      as7341History: newHistory,
    });
  },

  updateFusion: (data) => {
    const { fusionHistory, maxHistorySize, samplesProcessedToday } = get();
    const newHistory = [data, ...fusionHistory].slice(0, maxHistorySize);

    // Calculate conformity rate
    const conformSamples = newHistory.filter(
      (r) => r.final_grade === "A" || r.final_grade === "B"
    ).length;
    const conformityRate = newHistory.length > 0
      ? (conformSamples / newHistory.length) * 100
      : 0;

    set({
      latestFusion: data,
      fusionHistory: newHistory,
      samplesProcessedToday: samplesProcessedToday + 1,
      conformityRate,
    });
  },

  updateDevice: (device) => {
    const devices = new Map(get().devices);
    devices.set(device.id, device);
    set({ devices });
  },

  addAlert: (alert) => {
    const alerts = [alert, ...get().alerts];
    const unreadAlertsCount = alerts.filter((a) => !a.acknowledged).length;
    set({ alerts, unreadAlertsCount });
  },

  acknowledgeAlert: (alertId) => {
    const alerts = get().alerts.map((alert) =>
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    );
    const unreadAlertsCount = alerts.filter((a) => !a.acknowledged).length;
    set({ alerts, unreadAlertsCount });
  },

  clearAlerts: () =>
    set({ alerts: [], unreadAlertsCount: 0 }),

  updateStatistics: (stats) =>
    set(stats),

  reset: () =>
    set({
      isConnected: false,
      connectionError: null,
      latestVL53L8CH: null,
      latestAS7341: null,
      latestFusion: null,
      vl53l8chHistory: [],
      as7341History: [],
      fusionHistory: [],
      devices: new Map(),
      alerts: [],
      unreadAlertsCount: 0,
      samplesProcessedToday: 0,
      conformityRate: 0,
      averageProcessingTime: 0,
    }),
}));
