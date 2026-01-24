// ============================================================================
// Fusion Page - Multi-Sensor Data Fusion Dashboard
// Dashboard complet identique à fusion_visualizations.py
// Combine VL53L8CH (ToF) + AS7341 (Spectral)
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { useRealtimeStore } from "@stores/realtimeStore";
import {
  Merge,
  Download,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

// VL53L8CH Components
import HeatmapViewer from "@components/sensors/HeatmapViewer";
import StatsPanel from "@components/sensors/StatsPanel";
import Surface3DViewer from "@components/sensors/Surface3DViewer";

// AS7341 Components
import SpectralBarsChart from "@components/sensors/SpectralBarsChart";
import FreshnessGauge from "@components/sensors/FreshnessGauge";
import OxidationGauge from "@components/sensors/OxidationGauge";
import FatQualityGauge from "@components/sensors/FatQualityGauge";

// Fusion Components
import FusionScorePanel from "@components/sensors/FusionScorePanel";
import CombinedDefectsTable from "@components/sensors/CombinedDefectsTable";
import SensorWeightsPie from "@components/sensors/SensorWeightsPie";
import IndividualScoresBars from "@components/sensors/IndividualScoresBars";
import QualityComparisonBars from "@components/sensors/QualityComparisonBars";

export function FusionPage() {
  const { latestFusion, isConnected } = useRealtimeStore();

  // ⚠️ IMPORTANT: Backend envoie des clés LOWERCASE (vl53l8ch, as7341, fusion)
  // Voir backend_new/app/main.py:1001-1010 (broadcast_to_dashboards)
  // latestFusion contient maintenant: { ...fusion, vl53l8ch: {...}, as7341: {...} }
  const vl53l8chData = latestFusion?.vl53l8ch;
  const as7341Data = latestFusion?.as7341;
  // fusionData est directement dans latestFusion (pas de sous-clé .fusion)
  const fusionData = latestFusion;

  // Extract VL53L8CH data
  const distance_matrix = vl53l8chData?.distance_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
  const reflectance_matrix = vl53l8chData?.reflectance_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
  const vl53l8ch_grade = vl53l8chData?.grade || "N/A";
  const vl53l8ch_quality_score = vl53l8chData?.quality_score || 0;
  const vl53l8ch_defects = vl53l8chData?.defects || [];
  const vl53l8ch_stats = {
    volume_trapezoidal_mm3: vl53l8chData?.volume_mm3,
    avg_height_mm: vl53l8chData?.avg_height_mm,
    max_height_mm: vl53l8chData?.max_height_mm,
    min_height_mm: vl53l8chData?.min_height_mm,
    surface_uniformity: vl53l8chData?.surface_uniformity,
  };

  // Extract AS7341 data
  const rawCounts = as7341Data?.raw_counts || {};
  const qualityMetrics = as7341Data?.quality_metrics || {};
  const as7341_grade = as7341Data?.grade || "N/A";
  const as7341_quality_score = as7341Data?.quality_score || 0;
  const as7341_defects = as7341Data?.defects || [];

  const freshness_index = qualityMetrics.freshness_index || 0;
  const oxidation_index = qualityMetrics.oxidation_index || 0;
  const fat_quality_index = qualityMetrics.fat_quality_index || 0;

  // Extract Fusion data
  const final_score = fusionData?.final_score || 0;
  const fusion_defects_raw = fusionData?.defects || [];

  // Transform fusion_defects from string[] to Defect[]
  const fusion_defects = Array.isArray(fusion_defects_raw)
    ? fusion_defects_raw.map((defect: unknown) => {
        if (typeof defect === 'string') {
          return { type: defect, source: 'fusion', severity: 0 };
        }
        return defect as { type: string; source: string; severity: number };
      })
    : [];

  // Support both old and new field names for scores
  type FusionDataWithScores = typeof fusionData & {
    tof_score?: number;
    spectral_score?: number;
    vl53l8ch_score?: number;
    as7341_score?: number;
    fusion_mode?: string;
  };
  const fusionWithScores = fusionData as FusionDataWithScores;
  const vl53l8ch_score = fusionWithScores?.vl53l8ch_score ?? fusionWithScores?.tof_score ?? 0;
  const as7341_score = fusionWithScores?.as7341_score ?? fusionWithScores?.spectral_score ?? 0;

  const refetch = () => {
    console.log("🔄 Manual refetch requested");
  };

  if (!latestFusion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto" />
          <h2 className="text-2xl font-semibold">En attente des données Fusion...</h2>
          <p className="text-muted-foreground">
            {isConnected
              ? "WebSocket connecté - En attente des premières mesures fusionnées"
              : "Connexion au WebSocket..."}
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
            <Merge className="h-8 w-8 text-purple-600" />
            Fusion Dashboard - Multi-Capteurs
          </h1>
          <p className="text-muted-foreground mt-2">
            Fusion VL53L8CH (ToF) + AS7341 (Spectral) - Vue 360° Qualité Foie Gras
          </p>
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

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="fusion" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fusion">Vue Fusion Complète</TabsTrigger>
          <TabsTrigger value="details">Détails Capteurs</TabsTrigger>
          <TabsTrigger value="defects">Analyse Défauts</TabsTrigger>
        </TabsList>

        {/* Fusion Tab - Complete 4x4 Grid Layout */}
        <TabsContent value="fusion" className="space-y-4">
          {/* ROW 1: Comparison Overview (Individual Scores + Fusion + Weights) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Individual Scores */}
            <IndividualScoresBars
              spectralScore={as7341_quality_score}
              tofScore={vl53l8ch_quality_score}
            />

            {/* Fusion Score Panel */}
            <FusionScorePanel fusion={{
              final_grade: fusionData?.final_grade,
              final_score: fusionData?.final_score,
              vl53l8ch_score: vl53l8ch_score,
              as7341_score: as7341_score,
              tof_contribution: fusionData?.tof_contribution,
              spectral_contribution: fusionData?.spectral_contribution,
              fusion_mode: fusionWithScores?.fusion_mode,
            }} />

            {/* Sensor Weights */}
            <SensorWeightsPie
              tofWeight={fusionData?.tof_contribution || 0.6}
              spectralWeight={fusionData?.spectral_contribution || 0.4}
            />
          </div>

          {/* ROW 1.5: Quality Comparison Bars (Full width) */}
          <QualityComparisonBars
            tofScore={vl53l8ch_quality_score}
            spectralScore={as7341_quality_score}
            fusionScore={final_score}
            gradeAThreshold={0.8}
          />

          {/* ROW 2: VL53L8CH Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                VL53L8CH (Time-of-Flight) - Vue d'ensemble
              </CardTitle>
              <CardDescription className="text-xs">
                Grade: <span className="font-bold">{vl53l8ch_grade}</span> | Score: <span className="font-bold">{(vl53l8ch_quality_score * 100).toFixed(1)}%</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Distance Heatmap */}
                <HeatmapViewer
                  data={distance_matrix}
                  label="Distance (mm)"
                />

                {/* Reflectance Heatmap */}
                <HeatmapViewer
                  data={reflectance_matrix}
                  label="Reflectance (%)"
                />

                {/* 3D Surface */}
                <div className="col-span-1">
                  <Card className="h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs">Surface 3D</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                      <div className="h-48">
                        <Surface3DViewer
                          matrix={distance_matrix}
                          heightScale={1.0}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Stats */}
                <StatsPanel
                  stats={vl53l8ch_stats}
                  grade={vl53l8ch_grade}
                  quality_score={vl53l8ch_quality_score}
                />
              </div>
            </CardContent>
          </Card>

          {/* ROW 3: AS7341 Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                AS7341 (Spectral) - Vue d'ensemble
              </CardTitle>
              <CardDescription className="text-xs">
                Grade: <span className="font-bold">{as7341_grade}</span> | Score: <span className="font-bold">{(as7341_quality_score * 100).toFixed(1)}%</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Spectral Bars */}
                <SpectralBarsChart rawCounts={rawCounts} showValues={false} />

                {/* Quality Gauges */}
                <FreshnessGauge value={freshness_index} />
                <OxidationGauge value={oxidation_index} />
                <FatQualityGauge value={fat_quality_index} />
              </div>
            </CardContent>
          </Card>

          {/* ROW 4: Combined Defects */}
          <CombinedDefectsTable
            fusionDefects={fusion_defects}
            vl53l8chDefects={vl53l8ch_defects}
            as7341Defects={as7341_defects}
          />
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VL53L8CH Details */}
            <Card>
              <CardHeader>
                <CardTitle>VL53L8CH - Métriques Détaillées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Volume:</span>
                    <span className="font-semibold">{vl53l8ch_stats.volume_trapezoidal_mm3?.toFixed(1) || "N/A"} mm³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hauteur moyenne:</span>
                    <span className="font-semibold">{vl53l8ch_stats.avg_height_mm?.toFixed(2) || "N/A"} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hauteur max:</span>
                    <span className="font-semibold">{vl53l8ch_stats.max_height_mm?.toFixed(2) || "N/A"} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hauteur min:</span>
                    <span className="font-semibold">{vl53l8ch_stats.min_height_mm?.toFixed(2) || "N/A"} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uniformité surface:</span>
                    <span className="font-semibold">{((vl53l8ch_stats.surface_uniformity || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nombre de défauts:</span>
                    <span className={`font-semibold ${vl53l8ch_defects.length === 0 ? "text-green-600" : "text-red-600"}`}>
                      {vl53l8ch_defects.length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AS7341 Details */}
            <Card>
              <CardHeader>
                <CardTitle>AS7341 - Métriques Détaillées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Indice fraîcheur:</span>
                    <span className="font-semibold">{(freshness_index * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Qualité lipidique:</span>
                    <span className="font-semibold">{(fat_quality_index * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Indice oxydation:</span>
                    <span className="font-semibold">{(oxidation_index * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uniformité couleur:</span>
                    <span className="font-semibold">{((qualityMetrics.color_uniformity || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Canaux actifs:</span>
                    <span className="font-semibold">{Object.keys(rawCounts).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nombre de défauts:</span>
                    <span className={`font-semibold ${as7341_defects.length === 0 ? "text-green-600" : "text-red-600"}`}>
                      {as7341_defects.length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fusion Details */}
          <Card>
            <CardHeader>
              <CardTitle>Fusion - Détails Algorithme</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Mode de fusion:</p>
                  <p className="font-semibold">{fusionData?.fusion_mode || "weighted_average"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Score VL53L8CH:</p>
                  <p className="font-semibold text-blue-600">{((fusionData?.vl53l8ch_score || 0) * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Score AS7341:</p>
                  <p className="font-semibold text-orange-600">{((fusionData?.as7341_score || 0) * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Contribution ToF:</p>
                  <p className="font-semibold">{((fusionData?.tof_contribution || 0.6) * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Contribution Spectrale:</p>
                  <p className="font-semibold">{((fusionData?.spectral_contribution || 0.4) * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Score Final:</p>
                  <p className="font-semibold text-purple-600">{(final_score * 100).toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Defects Tab */}
        <TabsContent value="defects" className="space-y-4">
          <CombinedDefectsTable
            fusionDefects={fusion_defects}
            vl53l8chDefects={vl53l8ch_defects}
            as7341Defects={as7341_defects}
          />

          {/* Defects Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Défauts ToF</CardTitle>
              </CardHeader>
              <CardContent>
                {vl53l8ch_defects.length === 0 ? (
                  <p className="text-sm text-green-600 text-center py-4">
                    ✓ Aucun défaut ToF
                  </p>
                ) : (
                  <div className="space-y-2">
                    {vl53l8ch_defects.map((defect, idx) => (
                      <div key={idx} className="text-xs p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="font-semibold">{defect.type}</p>
                        <p className="text-muted-foreground">
                          {defect.position ? (
                            <>Position: ({defect.position.x}, {defect.position.y}) | </>
                          ) : null}
                          Sévérité: {defect.severity}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Défauts Spectraux</CardTitle>
              </CardHeader>
              <CardContent>
                {as7341_defects.length === 0 ? (
                  <p className="text-sm text-green-600 text-center py-4">
                    ✓ Aucun défaut spectral
                  </p>
                ) : (
                  <div className="space-y-2">
                    {as7341_defects.map((defect: string, idx: number) => (
                      <div key={idx} className="text-xs p-2 bg-orange-50 rounded border border-orange-200">
                        <p className="font-semibold">{defect}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Défauts Fusion</CardTitle>
              </CardHeader>
              <CardContent>
                {fusion_defects.length === 0 ? (
                  <p className="text-sm text-green-600 text-center py-4">
                    ✓ Aucun défaut fusion
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fusion_defects.map((defect: { type: string; source: string; severity: number }, idx: number) => (
                      <div key={idx} className="text-xs p-2 bg-purple-50 rounded border border-purple-200">
                        <p className="font-semibold">{defect.type}</p>
                        <p className="text-muted-foreground">
                          Source: {defect.source} | Sévérité: {typeof defect.severity === 'number' ? (defect.severity * 100).toFixed(0) : '0'}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FusionPage;
