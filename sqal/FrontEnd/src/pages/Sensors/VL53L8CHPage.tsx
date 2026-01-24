// ============================================================================
// VL53L8CH (ToF) Sensor Page - REORGANIZED WITH 3D PRIORITY
// Vue 3D de la distance matrix en priorité + visualisations combinées
// ============================================================================

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Badge } from "@components/ui/badge";
import { InfoTooltip } from "@components/ui/info-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Core visualizations
import HeatmapViewer from "@components/sensors/HeatmapViewer";
import AdvancedSurface3DViewer from "@components/sensors/AdvancedSurface3DViewer";
import DepthHistogram from "@components/sensors/DepthHistogram";
import CrossSectionProfile from "@components/sensors/CrossSectionProfile";
import BinDistribution from "@components/sensors/BinDistribution";
import DefectSeverityMap from "@components/sensors/DefectSeverityMap";
import TextureVariationMap from "@components/sensors/TextureVariationMap";
import DensityMap from "@components/sensors/DensityMap";

// Advanced components
import { VL53L8CHKPICards } from "@components/sensors/VL53L8CHKPICards";
import { ReflectanceAnalysisCard } from "@components/sensors/ReflectanceAnalysisCard";
import { AmplitudeConsistencyCard } from "@components/sensors/AmplitudeConsistencyCard";
import { BinsMetricsCard } from "@components/sensors/BinsMetricsCard";
import { ScoreBreakdownChart } from "@components/sensors/ScoreBreakdownChart";
import { VolumeComparisonChart } from "@components/sensors/VolumeComparisonChart";
import { HeightMetricsChart } from "@components/sensors/HeightMetricsChart";
import { CombinedMatrixAnalysis } from "@components/sensors/CombinedMatrixAnalysis";

// Hooks and stores
import { useRealtimeStore } from "@stores/realtimeStore";
import { useWebSocket } from "@hooks/useWebSocket";

// Local Defect type with required x, y
interface Defect {
  x: number;
  y: number;
  type: string;
  severity?: number;
}

// Icons
import {
  Radio,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
  BarChart3,
  Box,
  Clock,
  TrendingUp,
  Layers,
} from "lucide-react";

// Type for raw defect data from backend
interface RawDefect {
  type?: string;
  x?: number;
  y?: number;
  position?: { x: number; y: number };
  pos?: [number, number];
  severity?: string | number;
  description?: string;
}

export function VL53L8CHPage() {
  const { latestVL53L8CH, isConnected } = useRealtimeStore();
  const { isConnected: wsConnected } = useWebSocket();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const userGuide = (latestVL53L8CH as any)?.meta?.user_guide as Record<string, string> | undefined;

  const dataOrigin = (latestVL53L8CH as any)?.__data_origin as string | undefined;
  const fallbackReasons = (latestVL53L8CH as any)?.__fallback_reasons as string[] | undefined;

  useEffect(() => {
    console.log("🔵 VL53L8CHPage - WebSocket status:", { isConnected, wsConnected });
    console.log("🔵 VL53L8CHPage - Latest VL53L8CH data:", latestVL53L8CH);

    if (latestVL53L8CH) {
      setLastUpdate(new Date());
    }
  }, [isConnected, wsConnected, latestVL53L8CH]);

  // Extract data from WebSocket
  const distance_matrix = latestVL53L8CH?.distance_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
  const reflectance_matrix = latestVL53L8CH?.reflectance_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
  const amplitude_matrix = latestVL53L8CH?.amplitude_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
  const ambient_matrix = (latestVL53L8CH as any)?.ambient_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
  const status_matrix = (latestVL53L8CH as any)?.status_matrix || Array(8).fill(null).map(() => Array(8).fill(0));

  // Analysis data
  const rawDefectsData = latestVL53L8CH?.defects || [];
  const rawDefects: RawDefect[] = Array.isArray(rawDefectsData)
    ? rawDefectsData.filter((d: unknown): d is RawDefect => typeof d === 'object' && d !== null)
    : [];

  const toDefectSeverity = (severity: RawDefect["severity"]): number | undefined => {
    if (severity == null) return undefined;
    if (typeof severity === 'number') return severity;
    if (severity === 'high') return 0.9;
    if (severity === 'medium') return 0.5;
    if (severity === 'low') return 0.2;
    const n = Number(severity);
    return isNaN(n) ? undefined : n;
  };

  const defects: Defect[] = rawDefects.map((d) => {
    // Backend simulator can send pos as [i,j] where i=row(y) and j=col(x)
    const x = d.x ?? d.position?.x ?? (Array.isArray(d.pos) ? d.pos[1] : undefined) ?? 0;
    const y = d.y ?? d.position?.y ?? (Array.isArray(d.pos) ? d.pos[0] : undefined) ?? 0;
    return {
      x,
      y,
      type: d.type || "unknown",
      severity: toDefectSeverity(d.severity),
    };
  });

  const defectsWithSeverity = defects.map((d) => ({
    x: d.x,
    y: d.y,
    severity: d.severity ?? 0.2,
    type: d.type || "unknown",
  }));

  const grade = latestVL53L8CH?.grade || "UNKNOWN";
  const quality_score = latestVL53L8CH?.quality_score || 0;

  // Statistics
  const stats = {
    volume_mm3: latestVL53L8CH?.volume_mm3,
    volume_trapezoidal_mm3: latestVL53L8CH?.volume_trapezoidal_mm3,
    volume_simpson_mm3: latestVL53L8CH?.volume_simpson_mm3,
    volume_spline_mm3: latestVL53L8CH?.volume_spline_mm3,
    base_area_mm2: latestVL53L8CH?.base_area_mm2,
    average_height_mm: latestVL53L8CH?.average_height_mm ?? latestVL53L8CH?.avg_height_mm,
    min_height_mm: latestVL53L8CH?.min_height_mm,
    max_height_mm: latestVL53L8CH?.max_height_mm,
    height_range_mm: latestVL53L8CH?.height_range_mm,
    height_variation_mm: latestVL53L8CH?.height_variation_mm,
    surface_uniformity: latestVL53L8CH?.surface_uniformity,
    occupied_pixels: latestVL53L8CH?.occupied_pixels,
  };

  // Helper to convert to number
  const toNumber = (value: unknown): number | undefined => {
    if (value == null) return undefined;
    const num = typeof value === 'number' ? value : Number(value);
    return isNaN(num) ? undefined : num;
  };

  // Bins analysis
  const bins_analysis = latestVL53L8CH?.bins_analysis || {};
  const bins = Array.isArray(bins_analysis)
    ? bins_analysis
    : bins_analysis?.histogram || Array(128).fill(0);

  const bins_metrics = {
    density_score: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
      ? (Array.isArray((bins_analysis as any)?.density_score)
          ? toNumber((bins_analysis as any)?.density_score?.flat?.().reduce((a: number, b: number) => a + b, 0) / Math.max(1, (bins_analysis as any)?.density_score?.flat?.().length || 1))
          : toNumber((bins_analysis as any)?.density_score))
      : undefined,
    multi_peak_count: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis) && bins_analysis?.multi_peak_detected)
      ? toNumber(bins_analysis?.multi_peak_count) || 2
      : 1,
    peak_bin: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
      ? toNumber(bins_analysis?.peak_bin)
      : undefined,
    signal_quality: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
      ? (Array.isArray((bins_analysis as any)?.signal_quality)
          ? toNumber((bins_analysis as any)?.signal_quality?.flat?.().reduce((a: number, b: number) => a + b, 0) / Math.max(1, (bins_analysis as any)?.signal_quality?.flat?.().length || 1))
          : toNumber((bins_analysis as any)?.signal_quality))
      : undefined,
    surface_roughness: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
      ? (Array.isArray((bins_analysis as any)?.surface_roughness)
          ? toNumber((bins_analysis as any)?.surface_roughness?.flat?.().reduce((a: number, b: number) => a + b, 0) / Math.max(1, (bins_analysis as any)?.surface_roughness?.flat?.().length || 1))
          : toNumber((bins_analysis as any)?.roughness_score) ?? toNumber((bins_analysis as any)?.surface_roughness))
      : undefined,
    texture_score: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
      ? (Array.isArray((bins_analysis as any)?.texture_score)
          ? toNumber((bins_analysis as any)?.texture_score?.flat?.().reduce((a: number, b: number) => a + b, 0) / Math.max(1, (bins_analysis as any)?.texture_score?.flat?.().length || 1))
          : toNumber((bins_analysis as any)?.texture_score))
      : undefined,
  };

  // Peak bin map (8x8 matrix)
  const peak_bin_map = (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
    ? bins_analysis?.peak_bin_map
    : undefined;

  const signal_quality_map = (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis) && Array.isArray((bins_analysis as any)?.signal_quality))
    ? (bins_analysis as any).signal_quality
    : undefined;
  const texture_score_map = (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis) && Array.isArray((bins_analysis as any)?.texture_score))
    ? (bins_analysis as any).texture_score
    : undefined;
  const density_score_map = (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis) && Array.isArray((bins_analysis as any)?.density_score))
    ? (bins_analysis as any).density_score
    : undefined;
  const surface_roughness_map = (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis) && Array.isArray((bins_analysis as any)?.surface_roughness))
    ? (bins_analysis as any).surface_roughness
    : undefined;

  // For CombinedMatrixAnalysis - optical_anomalies as number
  const reflectance_analysis_combined = latestVL53L8CH?.reflectance_analysis ? {
    avg_reflectance: latestVL53L8CH.reflectance_analysis.avg_reflectance,
    reflectance_uniformity: latestVL53L8CH.reflectance_analysis.reflectance_uniformity,
    optical_anomalies: typeof latestVL53L8CH.reflectance_analysis.optical_anomalies === 'number'
      ? latestVL53L8CH.reflectance_analysis.optical_anomalies
      : Array.isArray(latestVL53L8CH.reflectance_analysis.optical_anomalies)
      ? latestVL53L8CH.reflectance_analysis.optical_anomalies.length
      : undefined,
  } : undefined;

  // For ReflectanceAnalysisCard - optical_anomalies as string[]
  const reflectance_analysis = latestVL53L8CH?.reflectance_analysis ? {
    avg_reflectance: latestVL53L8CH.reflectance_analysis.avg_reflectance,
    reflectance_uniformity: latestVL53L8CH.reflectance_analysis.reflectance_uniformity,
    optical_anomalies: Array.isArray(latestVL53L8CH.reflectance_analysis.optical_anomalies)
      ? latestVL53L8CH.reflectance_analysis.optical_anomalies
      : [],
  } : undefined;

  const amplitude_consistency = latestVL53L8CH?.amplitude_consistency && typeof latestVL53L8CH.amplitude_consistency === 'object' && !('amplitude_consistency' in latestVL53L8CH.amplitude_consistency) ? {
    avg_amplitude: (latestVL53L8CH.amplitude_consistency as any).avg_amplitude,
    amplitude_std: (latestVL53L8CH.amplitude_consistency as any).amplitude_std,
    amplitude_variance: (latestVL53L8CH.amplitude_consistency as any).amplitude_variance,
    signal_stability: (latestVL53L8CH.amplitude_consistency as any).signal_stability,
  } : undefined;
  const score_breakdown = latestVL53L8CH?.score_breakdown;

  const refetch = () => {
    console.log("🔄 Manual refetch requested");
  };

  if (!latestVL53L8CH) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          {isConnected ? (
            <Wifi className="h-16 w-16 text-green-500 mx-auto animate-pulse" />
          ) : (
            <WifiOff className="h-16 w-16 text-red-500 mx-auto" />
          )}
          <h2 className="text-2xl font-semibold">En attente des données VL53L8CH...</h2>
          <p className="text-muted-foreground">
            {isConnected
              ? "WebSocket connecté - En attente des premières mesures du capteur ToF"
              : "Connexion au WebSocket en cours..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Radio className="h-8 w-8 text-purple-500" />
            VL53L8CH Dashboard - Capteur Time-of-Flight
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-muted-foreground flex items-center gap-2">
              Analyse morphologique 3D - Résolution 8x8 zones
            </p>
            {dataOrigin === "fallback" ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      Fallback
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-md">
                    <p className="text-sm">{`Valeurs en mode fallback (certaines données manquantes dans le flux).\n\nRaisons: ${(fallbackReasons && fallbackReasons.length > 0 ? fallbackReasons.join(", ") : "inconnues")}`}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                Analyse
              </Badge>
            )}
            {isConnected ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Wifi className="h-3 w-3 mr-1" />
                Connecté
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-600">
                <WifiOff className="h-3 w-3 mr-1" />
                Déconnecté
              </Badge>
            )}
            {lastUpdate && (
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                <Clock className="h-3 w-3 mr-1" />
                {lastUpdate.toLocaleTimeString()}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <VL53L8CHKPICards
        data={{
          grade,
          quality_score,
          volume_mm3: stats.volume_mm3,
          surface_uniformity: stats.surface_uniformity,
          average_height_mm: stats.average_height_mm,
          defects,
        }}
      />

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="vue-ensemble" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="vue-ensemble">
            <Activity className="h-4 w-4 mr-2" />
            Vue d'Ensemble
          </TabsTrigger>
          <TabsTrigger value="matrices">
            <Layers className="h-4 w-4 mr-2" />
            Matrices & Analyses
          </TabsTrigger>
          <TabsTrigger value="qualite">
            <BarChart3 className="h-4 w-4 mr-2" />
            Qualité & Scores
          </TabsTrigger>
          <TabsTrigger value="3d-interactive">
            <Box className="h-4 w-4 mr-2" />
            Vue 3D Interactive
          </TabsTrigger>
          <TabsTrigger value="statistiques">
            <TrendingUp className="h-4 w-4 mr-2" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        {/* ====================================================================== */}
        {/* TAB 1: VUE D'ENSEMBLE - 3D Distance Matrix + KPIs + Défauts */}
        {/* ====================================================================== */}
        <TabsContent value="vue-ensemble" className="space-y-4">
          {/* BIG 3D Surface - Distance Matrix (PRIORITY) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5 text-blue-500" />
                Surface 3D - Matrice de Distance
                <InfoTooltip
                  side="top"
                  maxWidth="md"
                  content={
                    "Profondeur mesurée en millimètres.\n  - Plus la valeur est basse → produit épais ou proche du capteur.\n  - Plus la valeur est haute → produit fin ou éloigné."
                  }
                />
              </CardTitle>
              <CardDescription className="text-xs">
                {defects.length} défaut{defects.length > 1 ? 's' : ''} identifié{defects.length > 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {defects.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-green-600 font-semibold">✓ Aucun défaut détecté</p>
                  <p className="text-xs text-muted-foreground mt-2">Le produit présente une surface uniforme</p>
                </div>
              )}

              <div className="h-[500px]">
                <AdvancedSurface3DViewer
                  matrix={distance_matrix}
                  defects={defects}
                  reflectance_matrix={reflectance_matrix}
                  amplitude_matrix={amplitude_matrix}
                  bins_metrics={bins_metrics}
                  peak_bin_map={peak_bin_map}
                  signal_quality_map={signal_quality_map}
                  surface_roughness_map={surface_roughness_map}
                  texture_score_map={texture_score_map}
                  density_score_map={density_score_map}
                  heightScale={1.0}
                  width={800}
                  height={500}
                />
              </div>
            </CardContent>
          </Card>

          {/* Score Breakdown + Défauts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ScoreBreakdownChart score_breakdown={score_breakdown} />

            {/* Defects List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Défauts Détectés</CardTitle>
                  <InfoTooltip
                    side="left"
                    maxWidth="md"
                    content={"Liste des défauts détectés (type + sévérité). Les positions sont converties pour être affichables en 3D (x,y)."}
                  />
                </div>
                <CardDescription className="text-xs">
                  {defects.length} défaut{defects.length > 1 ? 's' : ''} identifié{defects.length > 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {defects.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-green-600 font-semibold">✓ Aucun défaut détecté</p>
                    <p className="text-xs text-muted-foreground mt-2">Le produit présente une surface uniforme</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {defects.map((defect, idx) => (
                      <div key={idx} className="p-3 bg-orange-50 border border-orange-200 rounded">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-orange-900">{defect.type}</span>
                          <Badge variant="destructive" className="text-xs">
                            Position: [{defect.x}, {defect.y}]
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {((stats.volume_mm3 || 0) / 1000).toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">cm³</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Hauteur Moyenne</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {(stats.average_height_mm || 0).toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">mm</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Uniformité</p>
                  <p className="text-2xl font-bold text-green-600">
                    {((stats.surface_uniformity || 0) * 100).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">%</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Surface Base</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {((stats.base_area_mm2 || 0) / 100).toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">cm²</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ====================================================================== */}
        {/* TAB 2: MATRICES & ANALYSES - Heatmaps + Analyses Combinées */}
        {/* ====================================================================== */}
        <TabsContent value="matrices" className="space-y-4">
          {/* Heatmaps Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Distance Matrix</CardTitle>
                  <InfoTooltip
                    side="left"
                    maxWidth="md"
                    content={
                      userGuide?.["Distance_matrix (mm)"] ??
                      "Profondeur mesurée en millimètres.\n  - Plus la valeur est basse → produit épais ou proche du capteur.\n  - Plus la valeur est haute → produit fin ou éloigné."
                    }
                  />
                </div>
                <CardDescription className="text-xs">Profondeur (mm)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <HeatmapViewer data={distance_matrix} label="Distance (mm)" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Reflectance Matrix</CardTitle>
                  <InfoTooltip
                    side="left"
                    maxWidth="md"
                    content={
                      userGuide?.["Reflectance (%)"] ??
                      "Proportion de lumière renvoyée par la surface.\n  - Faible → surface absorbante (mauvaise texture, brûlure, sang séché).\n  - Élevée → surface brillante (gras, zones humides)."
                    }
                  />
                </div>
                <CardDescription className="text-xs">Réflexion IR (%)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <HeatmapViewer data={reflectance_matrix} label="Réflectance (%)" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Amplitude Matrix</CardTitle>
                  <InfoTooltip
                    side="left"
                    maxWidth="md"
                    content={
                      userGuide?.["Amplitude (u.a.)"] ??
                      "Intensité brute du signal ToF (unités arbitraires).\n  - Corrélée à la consistance et à la réflectance.\n  - Trop faible → perte de fiabilité.\n  - Trop forte → saturation possible."
                    }
                  />
                </div>
                <CardDescription className="text-xs">Force du signal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <HeatmapViewer data={amplitude_matrix} label="Amplitude" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Industrial Quality Row (Ambient + Status) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Ambient Matrix</CardTitle>
                  <InfoTooltip
                    side="left"
                    maxWidth="md"
                    content={
                      "Lumière ambiante IR (unités arbitraires).\n  - Élevée → interférences lumineuses, baisse de fiabilité possible.\n  - Faible → conditions optiques stables."
                    }
                  />
                </div>
                <CardDescription className="text-xs">Lumière ambiante IR (interférences)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <HeatmapViewer data={ambient_matrix} label="Ambient (a.u.)" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Status Matrix</CardTitle>
                  <InfoTooltip
                    side="left"
                    maxWidth="md"
                    content={
                      "Code d’état / validité par zone.\n  - Valeurs anormales → mesures potentiellement invalides (multi-échos, saturation, faible signal, etc.).\n  - Utile pour diagnostiquer des pixels instables."
                    }
                  />
                </div>
                <CardDescription className="text-xs">Validité / flags capteur</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <HeatmapViewer data={status_matrix} label="Status" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Combined Analysis + Individual Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CombinedMatrixAnalysis
              reflectance_analysis={reflectance_analysis_combined}
              amplitude_consistency={amplitude_consistency}
            />
            <BinsMetricsCard bins_metrics={bins_metrics} />
          </div>

          {/* Detailed Analysis Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReflectanceAnalysisCard
              reflectance_analysis={reflectance_analysis}
              reflectance_matrix={reflectance_matrix}
            />
            <AmplitudeConsistencyCard
              amplitude_consistency={amplitude_consistency}
              amplitude_matrix={amplitude_matrix}
            />
          </div>

          {/* Histograms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DepthHistogram matrix={distance_matrix} binCount={10} />
            <CrossSectionProfile matrix={distance_matrix} defaultAxis="x" defaultIndex={4} />
          </div>
        </TabsContent>

        {/* ====================================================================== */}
        {/* TAB 3: QUALITÉ & SCORES - Score breakdown + Bins + Defect Maps */}
        {/* ====================================================================== */}
        <TabsContent value="qualite" className="space-y-4">
          {/* Score Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ScoreBreakdownChart score_breakdown={score_breakdown} />
            <BinsMetricsCard bins_metrics={bins_metrics} />
          </div>

          {/* Bins Distribution */}
          <BinDistribution bins={bins} />

          {/* Defect Maps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DefectSeverityMap matrix={distance_matrix} defects={defectsWithSeverity} />
            <TextureVariationMap matrix={distance_matrix} />
            <DensityMap reflectance={reflectance_matrix} amplitude={amplitude_matrix} />
          </div>
        </TabsContent>

        {/* ====================================================================== */}
        {/* TAB 4: VUE 3D INTERACTIVE - AdvancedSurface3DViewer avec bins analysis */}
        {/* ====================================================================== */}
        <TabsContent value="3d-interactive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5 text-blue-500" />
                Vue 3D Interactive - Contrôles Avancés
              </CardTitle>
              <CardDescription>
                Explorez la surface avec différents overlays et angles de vue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[600px]">
                <AdvancedSurface3DViewer
                  matrix={distance_matrix}
                  defects={defects}
                  reflectance_matrix={reflectance_matrix}
                  amplitude_matrix={amplitude_matrix}
                  bins_metrics={bins_metrics}
                  peak_bin_map={peak_bin_map}
                  signal_quality_map={signal_quality_map}
                  surface_roughness_map={surface_roughness_map}
                  texture_score_map={texture_score_map}
                  density_score_map={density_score_map}
                  heightScale={1.0}
                  width={1000}
                  height={600}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================================================================== */}
        {/* TAB 5: STATISTIQUES - Graphiques comparatifs Volume + Hauteurs */}
        {/* ====================================================================== */}
        <TabsContent value="statistiques" className="space-y-4">
          {/* Volume & Height Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VolumeComparisonChart stats={stats} />
            <HeightMetricsChart stats={stats} />
          </div>

          {/* Detailed Stats Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Statistiques Détaillées</CardTitle>
              <CardDescription className="text-xs">
                Toutes les métriques calculées par le capteur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-muted-foreground">Volume Standard</p>
                  <p className="font-bold text-lg">{((stats.volume_mm3 || 0) / 1000).toFixed(2)} cm³</p>
                </div>
                <div className="p-3 bg-green-50 rounded border border-green-200">
                  <p className="text-muted-foreground">Vol. Trapézoïdal</p>
                  <p className="font-bold text-lg">{((stats.volume_trapezoidal_mm3 || 0) / 1000).toFixed(2)} cm³</p>
                </div>
                <div className="p-3 bg-purple-50 rounded border border-purple-200">
                  <p className="text-muted-foreground">Vol. Simpson</p>
                  <p className="font-bold text-lg">{((stats.volume_simpson_mm3 || 0) / 1000).toFixed(2)} cm³</p>
                </div>
                <div className="p-3 bg-orange-50 rounded border border-orange-200">
                  <p className="text-muted-foreground">Vol. Spline</p>
                  <p className="font-bold text-lg">{((stats.volume_spline_mm3 || 0) / 1000).toFixed(2)} cm³</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded border border-indigo-200">
                  <p className="text-muted-foreground">Surface Base</p>
                  <p className="font-bold text-lg">{((stats.base_area_mm2 || 0) / 100).toFixed(2)} cm²</p>
                </div>
                <div className="p-3 bg-red-50 rounded border border-red-200">
                  <p className="text-muted-foreground">Hauteur Min</p>
                  <p className="font-bold text-lg">{(stats.min_height_mm || 0).toFixed(2)} mm</p>
                </div>
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-muted-foreground">Hauteur Moyenne</p>
                  <p className="font-bold text-lg">{(stats.average_height_mm || 0).toFixed(2)} mm</p>
                </div>
                <div className="p-3 bg-green-50 rounded border border-green-200">
                  <p className="text-muted-foreground">Hauteur Max</p>
                  <p className="font-bold text-lg">{(stats.max_height_mm || 0).toFixed(2)} mm</p>
                </div>
                <div className="p-3 bg-purple-50 rounded border border-purple-200">
                  <p className="text-muted-foreground">Étendue Hauteur</p>
                  <p className="font-bold text-lg">{(stats.height_range_mm || 0).toFixed(2)} mm</p>
                </div>
                <div className="p-3 bg-orange-50 rounded border border-orange-200">
                  <p className="text-muted-foreground">Variation Hauteur</p>
                  <p className="font-bold text-lg">{(stats.height_variation_mm || 0).toFixed(2)} mm</p>
                </div>
                <div className="p-3 bg-green-50 rounded border border-green-200">
                  <p className="text-muted-foreground">Uniformité Surface</p>
                  <p className="font-bold text-lg">{((stats.surface_uniformity || 0) * 100).toFixed(1)}%</p>
                </div>
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-muted-foreground">Pixels Occupés</p>
                  <p className="font-bold text-lg">{stats.occupied_pixels || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default VL53L8CHPage;
