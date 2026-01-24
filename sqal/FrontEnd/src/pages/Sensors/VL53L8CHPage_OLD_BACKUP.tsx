// ============================================================================
// VL53L8CH (ToF) Sensor Page - COMPLETE DASHBOARD
// Affiche TOUTES les données du capteur VL53L8CH avec visualisations adaptées
// ============================================================================

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Badge } from "@components/ui/badge";

// Core visualizations
import HeatmapViewer from "@components/sensors/HeatmapViewer";
import DefectOverlay from "@components/sensors/DefectOverlay";
import DepthHistogram from "@components/sensors/DepthHistogram";
import CrossSectionProfile from "@components/sensors/CrossSectionProfile";
import BinDistribution from "@components/sensors/BinDistribution";
import DefectSeverityMap from "@components/sensors/DefectSeverityMap";
import TextureVariationMap from "@components/sensors/TextureVariationMap";
import DensityMap from "@components/sensors/DensityMap";
import MaterialSignatureHistogram from "@components/sensors/MaterialSignatureHistogram";
import MultiViewSurface3D from "@components/sensors/MultiViewSurface3D";

// New advanced components
import { VL53L8CHKPICards } from "@components/sensors/VL53L8CHKPICards";
import { ReflectanceAnalysisCard } from "@components/sensors/ReflectanceAnalysisCard";
import { AmplitudeConsistencyCard } from "@components/sensors/AmplitudeConsistencyCard";
import { BinsMetricsCard } from "@components/sensors/BinsMetricsCard";
import { ScoreBreakdownChart } from "@components/sensors/ScoreBreakdownChart";

// Hooks and stores
import { useRealtimeStore } from "@stores/realtimeStore";
import { useWebSocket } from "@hooks/useWebSocket";
import type { Defect } from "@/types/foieGras";

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
  Gauge,
  Clock,
} from "lucide-react";

// Type for raw defect data from backend (may have various formats)
interface RawDefect {
  type?: string;
  x?: number;
  y?: number;
  position?: { x: number; y: number };
  severity?: string | number;
  description?: string;
}

export function VL53L8CHPage() {
  const { latestVL53L8CH, isConnected } = useRealtimeStore();
  const { isConnected: wsConnected } = useWebSocket();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    console.log("🔵 VL53L8CHPage - WebSocket status:", { isConnected, wsConnected });
    console.log("🔵 VL53L8CHPage - Latest VL53L8CH data:", latestVL53L8CH);

    if (latestVL53L8CH) {
      setLastUpdate(new Date());
    }
  }, [isConnected, wsConnected, latestVL53L8CH]);

  // Extract data from WebSocket (structure from backend FastAPI)
  const distance_matrix = latestVL53L8CH?.distance_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
  const reflectance_matrix = latestVL53L8CH?.reflectance_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
  const amplitude_matrix = latestVL53L8CH?.amplitude_matrix || Array(8).fill(null).map(() => Array(8).fill(0));

  // Analysis data from backend (VL53L8CHAnalysis schema)
  const rawDefectsData = latestVL53L8CH?.defects || [];

  // Filter and ensure we only process valid objects
  const rawDefects: RawDefect[] = Array.isArray(rawDefectsData)
    ? rawDefectsData.filter((d: unknown): d is RawDefect => typeof d === 'object' && d !== null)
    : [];

  // Transform defects to match expected Defect type (x, y, type required)
  const defects: Defect[] = rawDefects.map((d) => ({
    x: d.x ?? d.position?.x ?? 0,
    y: d.y ?? d.position?.y ?? 0,
    type: d.type || "unknown",
  }));

  // For DefectSeverityMap which needs severity as number
  const defectsWithSeverity = rawDefects.map((d) => ({
    x: d.x ?? d.position?.x ?? 0,
    y: d.y ?? d.position?.y ?? 0,
    severity: d.severity === "high" ? 0.9 : d.severity === "medium" ? 0.5 : 0.2,
    type: d.type || "unknown",
  }));

  const grade = latestVL53L8CH?.grade || "UNKNOWN";
  const quality_score = latestVL53L8CH?.quality_score || 0;

  // Statistics from backend - snake_case format
  const stats = {
    volume_trapezoidal_mm3: latestVL53L8CH?.volume_mm3,
    avg_height_mm: latestVL53L8CH?.average_height_mm ?? latestVL53L8CH?.avg_height_mm,
    max_height_mm: latestVL53L8CH?.max_height_mm,
    min_height_mm: latestVL53L8CH?.min_height_mm,
    surface_uniformity: latestVL53L8CH?.surface_uniformity,
  };

  // Bins analysis (histogram data)
  const bins_analysis = latestVL53L8CH?.bins_analysis || {};
  const bins = Array.isArray(bins_analysis)
    ? bins_analysis
    : bins_analysis?.histogram || Array(128).fill(0);

  // Extract advanced bins metrics - check if bins_analysis is an object
  // Helper to safely convert to number
  const toNumber = (value: unknown): number | undefined => {
    if (value == null) return undefined;
    const num = typeof value === 'number' ? value : Number(value);
    return isNaN(num) ? undefined : num;
  };

  const bins_metrics = {
    density_score: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
      ? toNumber(bins_analysis?.density_score)
      : undefined,
    multi_peak_count: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis) && bins_analysis?.multi_peak_detected)
      ? 2
      : 1,
    peak_bin: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
      ? toNumber(bins_analysis?.peak_bin)
      : undefined,
    signal_quality: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
      ? toNumber(bins_analysis?.signal_quality)
      : undefined,
    surface_roughness: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
      ? toNumber(bins_analysis?.roughness_score)
      : undefined,
    texture_score: (typeof bins_analysis === 'object' && !Array.isArray(bins_analysis))
      ? toNumber(bins_analysis?.texture_score)
      : undefined,
  };

  // Reflectance analysis - Cast optical_anomalies to string[]
  const reflectance_analysis = latestVL53L8CH?.reflectance_analysis ? {
    avg_reflectance: latestVL53L8CH.reflectance_analysis.avg_reflectance,
    reflectance_uniformity: latestVL53L8CH.reflectance_analysis.reflectance_uniformity,
    optical_anomalies: Array.isArray(latestVL53L8CH.reflectance_analysis.optical_anomalies)
      ? latestVL53L8CH.reflectance_analysis.optical_anomalies
      : [],
  } : undefined;

  // Amplitude consistency
  const amplitude_consistency = latestVL53L8CH?.amplitude_consistency && typeof latestVL53L8CH.amplitude_consistency === 'object' && !('amplitude_consistency' in latestVL53L8CH.amplitude_consistency) ? {
    avg_amplitude: (latestVL53L8CH.amplitude_consistency as any).avg_amplitude,
    amplitude_std: (latestVL53L8CH.amplitude_consistency as any).amplitude_std,
    amplitude_variance: (latestVL53L8CH.amplitude_consistency as any).amplitude_variance,
    signal_stability: (latestVL53L8CH.amplitude_consistency as any).signal_stability,
  } : undefined;

  // Score breakdown
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
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Vérifiez que le backend FastAPI est démarré (port 8000/8001)</p>
            <p>• Vérifiez que le simulateur envoie des données au backend</p>
            <p>• WebSocket endpoint: /ws/realtime/</p>
          </div>
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
          volume_mm3: latestVL53L8CH?.volume_mm3,
          surface_uniformity: latestVL53L8CH?.surface_uniformity,
          average_height_mm: latestVL53L8CH?.average_height_mm || latestVL53L8CH?.avg_height_mm,
          defects,
        }}
      />

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="vue-ensemble" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="vue-ensemble">
            <Activity className="h-4 w-4 mr-2" />
            Vue d'Ensemble
          </TabsTrigger>
          <TabsTrigger value="matrices">
            <BarChart3 className="h-4 w-4 mr-2" />
            Matrices
          </TabsTrigger>
          <TabsTrigger value="3d">
            <Box className="h-4 w-4 mr-2" />
            Vue 3D
          </TabsTrigger>
          <TabsTrigger value="analyse-avancee">
            <Gauge className="h-4 w-4 mr-2" />
            Analyse Avancée
          </TabsTrigger>
          <TabsTrigger value="signature">Signature</TabsTrigger>
          <TabsTrigger value="defauts">Défauts</TabsTrigger>
        </TabsList>

        {/* ====================================================================== */}
        {/* TAB 1: VUE D'ENSEMBLE - Toutes les métriques principales */}
        {/* ====================================================================== */}
        <TabsContent value="vue-ensemble" className="space-y-4">
          {/* Row 1: Score Breakdown + Advanced Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ScoreBreakdownChart score_breakdown={score_breakdown} />

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Métriques Détaillées</CardTitle>
                <CardDescription className="text-xs">
                  Statistiques géométriques et volumétriques
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Volume</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {((latestVL53L8CH?.volume_mm3 || 0) / 1000).toFixed(1)} cm³
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Hauteur Moyenne</p>
                      <p className="text-2xl font-bold text-indigo-600">
                        {(stats.avg_height_mm || 0).toFixed(1)} mm
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Hauteur Max</p>
                      <p className="text-lg font-semibold text-gray-600">
                        {(stats.max_height_mm || 0).toFixed(1)} mm
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Surface de Base</p>
                      <p className="text-2xl font-bold text-green-600">
                        {((latestVL53L8CH?.base_area_mm2 || 0) / 100).toFixed(1)} cm²
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Hauteur Min</p>
                      <p className="text-lg font-semibold text-gray-600">
                        {(stats.min_height_mm || 0).toFixed(1)} mm
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Plage Hauteur</p>
                      <p className="text-lg font-semibold text-purple-600">
                        {((stats.max_height_mm || 0) - (stats.min_height_mm || 0)).toFixed(1)} mm
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Reflectance + Amplitude + Bins Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ReflectanceAnalysisCard
              reflectance_analysis={reflectance_analysis}
              reflectance_matrix={reflectance_matrix}
            />
            <AmplitudeConsistencyCard
              amplitude_consistency={amplitude_consistency}
              amplitude_matrix={amplitude_matrix}
            />
            <BinsMetricsCard bins_metrics={bins_metrics} />
          </div>

          {/* Row 3: Quick Heatmaps */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Distances (Aperçu)</CardTitle>
              </CardHeader>
              <CardContent>
                <HeatmapViewer
                  data={distance_matrix}
                  label=""
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Réflectance (Aperçu)</CardTitle>
              </CardHeader>
              <CardContent>
                <HeatmapViewer
                  data={reflectance_matrix}
                  label=""
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Amplitude (Aperçu)</CardTitle>
              </CardHeader>
              <CardContent>
                <HeatmapViewer
                  data={amplitude_matrix}
                  label=""
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ====================================================================== */}
        {/* TAB 2: MATRICES - Heatmaps détaillées */}
        {/* ====================================================================== */}
        <TabsContent value="matrices" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Distances */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Distances Capteur-Surface</CardTitle>
                <CardDescription className="text-xs">
                  Plus foncé = plus proche
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HeatmapViewer
                  data={distance_matrix}
                  label=""
                />
              </CardContent>
            </Card>

            {/* Réflectances */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Propriétés Optiques</CardTitle>
                <CardDescription className="text-xs">
                  Réflectance infrarouge (%)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HeatmapViewer
                  data={reflectance_matrix}
                  label=""
                />
              </CardContent>
            </Card>

            {/* Amplitudes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Qualité du Signal</CardTitle>
                <CardDescription className="text-xs">
                  Intensité retour IR
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HeatmapViewer
                  data={amplitude_matrix}
                  label=""
                />
              </CardContent>
            </Card>

            {/* Défauts Overlay */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Carte des Défauts</CardTitle>
                <CardDescription className="text-xs">
                  {defects.length} défaut(s) détecté(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DefectOverlay
                  matrix={distance_matrix}
                  defects={defects}
                />
              </CardContent>
            </Card>
          </div>

          {/* Analyses complémentaires */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DepthHistogram matrix={distance_matrix} binCount={10} />
            <CrossSectionProfile matrix={distance_matrix} defaultAxis="x" defaultIndex={4} />
          </div>
        </TabsContent>

        {/* ====================================================================== */}
        {/* TAB 3: VUE 3D */}
        {/* ====================================================================== */}
        <TabsContent value="3d" className="space-y-4">
          <MultiViewSurface3D
            matrix={distance_matrix}
            defects={defects}
            reflectance_matrix={reflectance_matrix}
            amplitude_matrix={amplitude_matrix}
            stats={stats}
          />
        </TabsContent>

        {/* ====================================================================== */}
        {/* TAB 4: ANALYSE AVANCÉE */}
        {/* ====================================================================== */}
        <TabsContent value="analyse-avancee" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DefectSeverityMap matrix={distance_matrix} defects={defectsWithSeverity} />
            <TextureVariationMap matrix={distance_matrix} windowSize={3} />
            <DensityMap
              reflectance={reflectance_matrix}
              amplitude={amplitude_matrix}
              tofWeight={0.6}
              amplitudeWeight={0.4}
            />
          </div>

          {/* Detailed analyses */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ReflectanceAnalysisCard
              reflectance_analysis={reflectance_analysis}
              reflectance_matrix={reflectance_matrix}
            />
            <AmplitudeConsistencyCard
              amplitude_consistency={amplitude_consistency}
              amplitude_matrix={amplitude_matrix}
            />
            <BinsMetricsCard bins_metrics={bins_metrics} />
          </div>

          <BinDistribution
            bins={bins}
            binSize={37.5}
            maxBins={128}
            density_score={bins_metrics.density_score}
            multi_peak_count={bins_metrics.multi_peak_count}
            peak_bin={bins_metrics.peak_bin}
            signal_quality={bins_metrics.signal_quality}
            surface_roughness={bins_metrics.surface_roughness}
            texture_score={bins_metrics.texture_score}
          />
        </TabsContent>

        {/* ====================================================================== */}
        {/* TAB 5: SIGNATURE MATÉRIAU */}
        {/* ====================================================================== */}
        <TabsContent value="signature" className="space-y-4">
          <MaterialSignatureHistogram bins={bins} binSize={37.5} maxBins={128} />

          <Card>
            <CardHeader>
              <CardTitle>À propos de la Signature Matériau</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">Histogramme ToF:</span> Représente la distribution des mesures de distance sur 128 bins.
                </p>
                <p>
                  <span className="font-semibold">1 bin ≈ 37.5mm:</span> Selon la datasheet ST VL53L8CH, chaque bin correspond à environ 37.5mm de distance.
                </p>
                <p>
                  <span className="font-semibold">Zone foie gras:</span> Les bins correspondant à 20-50mm sont mis en évidence (zone typique d'épaisseur).
                </p>
                <p>
                  <span className="font-semibold">Pic principal:</span> Identifie automatiquement le pic dominant qui correspond à la surface principale du produit.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================================================================== */}
        {/* TAB 6: DÉFAUTS DÉTAILLÉS */}
        {/* ====================================================================== */}
        <TabsContent value="defauts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Defects List */}
            <Card>
              <CardHeader>
                <CardTitle>Liste des Défauts Détectés</CardTitle>
                <CardDescription>
                  {defects.length === 0 ? "Aucun défaut détecté" : `${defects.length} défaut(s) identifié(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {defects.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-lg font-semibold text-green-600">✓ Aucun défaut détecté</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Le produit présente une qualité optimale
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {rawDefects.map((defect, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 border rounded hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">
                            {idx + 1}. {defect.type || "Défaut inconnu"}
                          </span>
                          <Badge
                            variant={
                              defect.severity === "high"
                                ? "destructive"
                                : defect.severity === "medium"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {defect.severity || "N/A"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>
                            Position: ({defect.x ?? defect.position?.x ?? "?"}, {defect.y ?? defect.position?.y ?? "?"})
                          </p>
                          {(typeof defect === 'object' && defect !== null && 'description' in defect && defect.description) ? <p>Description: {String(defect.description)}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Defects Map */}
            <Card>
              <CardHeader>
                <CardTitle>Carte des Défauts</CardTitle>
                <CardDescription>Localisation spatiale sur la surface 8x8</CardDescription>
              </CardHeader>
              <CardContent>
                <DefectOverlay matrix={distance_matrix} defects={defects} />
              </CardContent>
            </Card>
          </div>

          {/* Defect Severity Map */}
          <DefectSeverityMap matrix={distance_matrix} defects={defectsWithSeverity} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default VL53L8CHPage;
