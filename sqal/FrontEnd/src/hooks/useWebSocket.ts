// ============================================================================
// SQAL Frontend - useWebSocket Hook
// Custom hook for WebSocket connection management
// ============================================================================

import { useEffect, useCallback } from "react";
import { useAuthStore } from "@stores/authStore";
import { useRealtimeStore } from "@stores/realtimeStore";
import wsService from "@services/websocket";
import { WS_EVENTS } from "@constants/index";
import type {
  WSMessageType,
  SensorDataMessage,
  AnalysisResultMessage,
  DeviceStatusMessage,
  AlertMessage,
} from "@/types";

export function useWebSocket() {
  const { token, isAuthenticated } = useAuthStore();
  const {
    setConnected,
    setConnectionError,
    updateVL53L8CH,
    updateAS7341,
    updateFusion,
    updateDevice,
    addAlert,
  } = useRealtimeStore();

  console.log('🟢 useWebSocket: Hook called', { isAuthenticated, hasToken: !!token });

  // Connect to WebSocket
  useEffect(() => {
    console.log('🟢 useWebSocket: useEffect triggered', { isAuthenticated, hasToken: !!token });

    // Backend /ws/realtime/ currently accepts connections without auth.
    // Keep WS connected even if the token is temporarily missing during refresh.
    console.log("✅ Connecting to WebSocket...");
    wsService.connect(token || undefined);

    // Setup event handlers
    const handleConnect = () => {
      console.log("WebSocket connected");
      setConnected(true);
      setConnectionError(null);
    };

    const handleDisconnect = () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    };

    const handleError = (data: any) => {
      console.error("WebSocket error:", data);
      setConnectionError(data.error || "Connection error");
    };

    const handleSensorData = (data: SensorDataMessage) => {
      console.log("📡 handleSensorData received:", data.sensor_type, data);
      if (data.sensor_type === "VL53L8CH") {
        // Extract raw data and analysis from nested structure
        const vl53Data = data.data as any;
        const rawMatrices = vl53Data?.raw || vl53Data;
        const analysis = vl53Data?.analysis || {};
        const stats = analysis?.stats || {};

        // Some backends may send score_breakdown outside analysis; normalize it here.
        const score_breakdown =
          analysis?.score_breakdown ??
          vl53Data?.score_breakdown ??
          vl53Data?.analysis?.score_breakdown;

        // Build VL53L8CHRawData format expected by store
        const fallback_reasons: string[] = [];

        const distance_matrix = rawMatrices?.distance_matrix || [];
        const reflectance_matrix = rawMatrices?.reflectance_matrix || [];
        const amplitude_matrix = rawMatrices?.amplitude_matrix || [];

        const is8x8 = (m: any) =>
          Array.isArray(m) && m.length === 8 && m.every((row: any) => Array.isArray(row) && row.length === 8);

        if (!is8x8(distance_matrix) || !is8x8(reflectance_matrix) || !is8x8(amplitude_matrix)) {
          fallback_reasons.push("matrices_missing_or_invalid");
        }

        if (analysis?.quality_score == null || typeof analysis?.quality_score !== "number") {
          fallback_reasons.push("analysis_missing_quality_score");
        }

        if (!analysis?.grade) {
          fallback_reasons.push("analysis_missing_grade");
        }

        const __data_origin = fallback_reasons.length > 0 ? "fallback" : "analysis";

        const formattedData = {
          distance_matrix,
          reflectance_matrix,
          amplitude_matrix,
          grade: analysis?.grade || "UNKNOWN",
          quality_score: analysis?.quality_score || 0,
          score_breakdown,
          volume_mm3: analysis?.volume_mm3,
          surface_uniformity: analysis?.surface_uniformity,
          avg_distance_mm: analysis?.avg_distance_mm,

          // Height-related metrics are typically nested in analysis.stats in the backend broadcaster
          // Flatten them for UI components that expect top-level fields
          average_height_mm: stats?.average_height_mm ?? stats?.avg_height_mm ?? analysis?.average_height_mm ?? analysis?.avg_height_mm,
          avg_height_mm: stats?.avg_height_mm ?? analysis?.avg_height_mm,
          min_height_mm: stats?.min_height_mm ?? analysis?.min_height_mm,
          max_height_mm: stats?.max_height_mm ?? analysis?.max_height_mm,
          height_range_mm: stats?.height_range_mm ?? analysis?.height_range_mm,
          height_variation_mm: stats?.height_variation_mm ?? analysis?.height_variation_mm,
          occupied_pixels: stats?.occupied_pixels ?? analysis?.occupied_pixels,
          base_area_mm2: stats?.base_area_mm2 ?? analysis?.base_area_mm2,
          __data_origin,
          __fallback_reasons: fallback_reasons,
          ...rawMatrices,
          ...analysis
        };
        console.log("📡 VL53L8CH formatted data:", formattedData);
        updateVL53L8CH(formattedData as any);
      } else if (data.sensor_type === "AS7341") {
        // Extract raw channels and analysis from nested structure
        const as7341Data = data.data as any;
        const raw = as7341Data?.raw || as7341Data;
        const analysis = as7341Data?.analysis || {};
        // Some backends send analysis fields at top-level; collect from all likely places
        const quality_metrics =
          analysis?.quality_metrics ??
          raw?.quality_metrics ??
          as7341Data?.quality_metrics ??
          {};
        const analyzer_ratios =
          analysis?.spectral_ratios ??
          analysis?.ratios ??
          raw?.spectral_ratios ??
          raw?.ratios ??
          as7341Data?.spectral_ratios ??
          as7341Data?.ratios ??
          {};

        const score_breakdown =
          analysis?.score_breakdown ??
          as7341Data?.score_breakdown ??
          as7341Data?.analysis?.score_breakdown;

        // Normalize raw channel keys so charts (SpectralBarsChart/NormalizedSpectrum) always work.
        // Expected keys: F1_violet..F8_red, NIR
        const rawInput = raw?.raw_counts || raw?.channels || raw || {};
        const normalizedRawCounts: Record<string, number> = {
          F1_violet: rawInput?.F1_violet ?? rawInput?.F1_415nm ?? rawInput?.F1 ?? rawInput?.violet ?? 0,
          F2_indigo: rawInput?.F2_indigo ?? rawInput?.F2_445nm ?? rawInput?.F2 ?? rawInput?.indigo ?? 0,
          F3_blue: rawInput?.F3_blue ?? rawInput?.F3_480nm ?? rawInput?.F3 ?? rawInput?.blue ?? 0,
          F4_cyan: rawInput?.F4_cyan ?? rawInput?.F4_515nm ?? rawInput?.F4 ?? rawInput?.cyan ?? 0,
          F5_green: rawInput?.F5_green ?? rawInput?.F5_555nm ?? rawInput?.F5 ?? rawInput?.green ?? 0,
          F6_yellow: rawInput?.F6_yellow ?? rawInput?.F6_590nm ?? rawInput?.F6 ?? rawInput?.yellow ?? 0,
          F7_orange: rawInput?.F7_orange ?? rawInput?.F7_630nm ?? rawInput?.F7 ?? rawInput?.orange ?? 0,
          F8_red: rawInput?.F8_red ?? rawInput?.F8_680nm ?? rawInput?.F8 ?? rawInput?.red ?? 0,
          NIR: rawInput?.NIR ?? rawInput?.nir ?? rawInput?.F9_nir ?? rawInput?.F9_910nm ?? 0,
          Clear: rawInput?.Clear ?? rawInput?.clear ?? 0,
        };

        const fallback_reasons: string[] = [];
        const hasSomeRaw = Object.values(normalizedRawCounts).some((v) => typeof v === "number" && v > 0);
        if (!hasSomeRaw) {
          fallback_reasons.push("raw_counts_missing_or_zero");
        }

        const hasIndices =
          typeof (analysis?.freshness_index ?? quality_metrics?.freshness_index) === "number" ||
          typeof (analysis?.fat_quality_index ?? quality_metrics?.fat_quality_index) === "number" ||
          typeof (analysis?.oxidation_index ?? quality_metrics?.oxidation_index) === "number" ||
          typeof (analysis?.color_uniformity ?? quality_metrics?.color_uniformity) === "number";
        if (!hasIndices) {
          fallback_reasons.push("analysis_missing_quality_indices");
        }

        const __data_origin = fallback_reasons.length > 0 ? "fallback" : "analysis";

        // Provide the specific ratio keys expected by current UI components
        // - SpectralRatiosChart expects: red_nir, red_orange, green_red, blue_green
        const safeDiv = (a: number, b: number) => (b ? a / b : undefined);

        const aliases = {
          // Aliases for simulator keys (ratios.md / AS7341_DataAnalyzer)
          violet_orange: analyzer_ratios?.violet_orange_ratio,
          nir_violet: analyzer_ratios?.nir_violet_ratio,
          lipid_discoloration: analyzer_ratios?.discoloration_index,
          lipid_oxidation: analyzer_ratios?.lipid_oxidation_index,
          oil_oxidation: analyzer_ratios?.oil_oxidation_index,
          freshness_meat: analyzer_ratios?.freshness_meat_index,
          red_violet: analyzer_ratios?.red_violet_ratio,

          // Compatibility with other naming schemes
          violet_orange_ratio: analyzer_ratios?.violet_orange_ratio,
          nir_violet_ratio: analyzer_ratios?.nir_violet_ratio,
          discoloration_index: analyzer_ratios?.discoloration_index,
        };

        const ui_ratios = {
          // Compute from raw counts when possible
          red_nir:
            analyzer_ratios?.red_nir ??
            safeDiv(normalizedRawCounts.F8_red ?? 0, normalizedRawCounts.NIR ?? 0),
          red_orange:
            analyzer_ratios?.red_orange ??
            safeDiv(normalizedRawCounts.F8_red ?? 0, normalizedRawCounts.F7_orange ?? 0),
          green_red:
            analyzer_ratios?.green_red ??
            safeDiv(normalizedRawCounts.F5_green ?? 0, normalizedRawCounts.F8_red ?? 0),
          blue_green:
            analyzer_ratios?.blue_green ??
            safeDiv(normalizedRawCounts.F3_blue ?? 0, normalizedRawCounts.F5_green ?? 0),
          ratio_clear_nir:
            analyzer_ratios?.ratio_clear_nir ??
            safeDiv(normalizedRawCounts.Clear ?? 0, normalizedRawCounts.NIR ?? 0),
          nir_clear_ratio:
            analyzer_ratios?.nir_clear_ratio ??
            analyzer_ratios?.normalized_clear ??
            safeDiv(normalizedRawCounts.NIR ?? 0, normalizedRawCounts.Clear ?? 0),
        };

        // Merge: keep all analyzer ratios, plus aliases for UI
        const spectral_ratios = {
          ...analyzer_ratios,
          ...aliases,
          ...ui_ratios,
        };

        // Build AS7341 data format expected by store/pages (keep both nested + top-level fields)
        // Spread first, then override with normalized objects (avoid overwriting them)
        const formattedData = {
          ...raw,
          ...analysis,

          time: raw?.time || new Date().toISOString(),
          device_id: raw?.device_id || "",
          wavelengths: raw?.wavelengths || [],
          intensities: raw?.intensities || [],

          // Raw channels are used by AS7341Page as `raw_counts`
          raw_counts: normalizedRawCounts,
          channels: raw?.channels || raw,

          // Keep analysis objects for existing UI
          quality_metrics,
          spectral_ratios,
          score_breakdown,
          defects: analysis?.defects || as7341Data?.defects || [],

          __data_origin,
          __fallback_reasons: fallback_reasons,

          // Expose top-level indices too (for easier UI wiring)
          freshness_index: analysis?.freshness_index ?? quality_metrics?.freshness_index,
          fat_quality_index: analysis?.fat_quality_index ?? quality_metrics?.fat_quality_index,
          oxidation_index: analysis?.oxidation_index ?? quality_metrics?.oxidation_index,
          color_uniformity: analysis?.color_uniformity ?? quality_metrics?.color_uniformity,
          quality_score: analysis?.quality_score ?? quality_metrics?.quality_score,
          grade: analysis?.grade ?? quality_metrics?.overall_grade ?? "N/A",
        };

        console.log("📡 AS7341 formatted data:", formattedData);
        updateAS7341(formattedData as any);
      }
    };

    const handleAnalysisResult = (data: AnalysisResultMessage) => {
      console.log("📊 Analysis result received:", {
        sample_id: data.result?.sample_id,
        final_grade: data.result?.final_grade,
        has_blockchain: !!data.result?.blockchain,
        blockchain_hash: data.result?.blockchain?.blockchain_hash?.substring(0, 16) + "..."
      });
      updateFusion(data.result);
    };

    const handleDeviceStatus = (data: DeviceStatusMessage) => {
      updateDevice(data as any);
    };

    const handleAlert = (data: AlertMessage) => {
      addAlert(data);
    };

    // Register event handlers
    wsService.on(WS_EVENTS.CONNECT, handleConnect);
    wsService.on(WS_EVENTS.DISCONNECT, handleDisconnect);
    wsService.on(WS_EVENTS.ERROR, handleError);
    wsService.on(WS_EVENTS.SENSOR_DATA, handleSensorData);
    wsService.on(WS_EVENTS.ANALYSIS_RESULT, handleAnalysisResult);
    wsService.on(WS_EVENTS.DEVICE_STATUS, handleDeviceStatus);
    wsService.on(WS_EVENTS.ALERT, handleAlert);

    // Cleanup
    return () => {
      wsService.off(WS_EVENTS.CONNECT, handleConnect);
      wsService.off(WS_EVENTS.DISCONNECT, handleDisconnect);
      wsService.off(WS_EVENTS.ERROR, handleError);
      wsService.off(WS_EVENTS.SENSOR_DATA, handleSensorData);
      wsService.off(WS_EVENTS.ANALYSIS_RESULT, handleAnalysisResult);
      wsService.off(WS_EVENTS.DEVICE_STATUS, handleDeviceStatus);
      wsService.off(WS_EVENTS.ALERT, handleAlert);
      wsService.disconnect();
    };
  }, [isAuthenticated, token]);

  const sendMessage = useCallback((type: WSMessageType, payload: any) => {
    wsService.send(type, payload);
  }, []);

  const isConnected = wsService.isConnected();

  return {
    isConnected,
    sendMessage,
  };
}