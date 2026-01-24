// ============================================================================
// Foie Gras Quality Control Page
// Page dédiée au contrôle qualité du foie gras
// Inspirée de FoieGrasDashboard.tsx (Poubelle)
// ============================================================================

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import TopViewHeatmap from "@components/sensors/TopViewHeatmap";
import HeatmapViewer from "@components/sensors/HeatmapViewer";
import PixelHistogram from "@components/sensors/PixelHistogram";
import { StatsCard } from "@components/sensors/StatsCard";
import { LiveChart } from "@components/sensors/LiveChart";
import DefectOverlay from "@components/sensors/DefectOverlay";
import Surface3DViewer from "@components/sensors/Surface3DViewer";
import { BlockchainQRCode } from "@components/common/BlockchainQRCode";
import { useRealtimeStore } from "@stores/realtimeStore";
import {
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Gauge
} from "lucide-react";

interface FoieGrasData {
  sample_id: string;
  timestamp: string;
  device_id: string;
  grade: string;
  quality_score: number;

  // VL53L8CH (ToF) data
  distance_matrix: number[][];
  reflectance_matrix: number[][];
  amplitude_matrix: number[][];
  volume_mm3: number;
  average_height_mm: number;
  max_height_mm: number;
  min_height_mm: number;
  surface_uniformity: number;
  defects: Array<{
    type: string;
    position: { x: number; y: number };
    severity: string;
  }>;

  // AS7341 (Spectral) data
  color_score: number;
  freshness_index: number;
  oxidation_level: number;

  // Blockchain certification data
  blockchain_hash?: string;
  blockchain_timestamp?: string;
  qr_code_base64?: string;
  lot_abattage?: string;
  eleveur?: string;
  provenance?: string;
}

export function FoieGrasPage() {
  const [latestSample, setLatestSample] = useState<FoieGrasData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get latest data from store (3 separate sources like Dashboard does)
  const { latestFusion, latestVL53L8CH, latestAS7341, isConnected } = useRealtimeStore();
  
  // Debug: Log connection status and data
  useEffect(() => {
    console.log(" FoieGrasPage - WebSocket connected:", isConnected);
    console.log(" FoieGrasPage - latestFusion:", latestFusion);
    console.log(" FoieGrasPage - latestVL53L8CH:", latestVL53L8CH);
    console.log(" FoieGrasPage - latestAS7341:", latestAS7341);
  }, [isConnected, latestFusion, latestVL53L8CH, latestAS7341]);
  
  // Transform fusion data to FoieGrasData format
  useEffect(() => {
    if (latestFusion) {
      console.log(" FoieGrasPage - Transforming fusion data:", latestFusion);
      
      // Extract available data from all 3 sources
      const metrics = latestFusion.foie_gras_metrics || {};
      const generalMetrics = latestFusion.metrics || {};
      
      // Get ToF matrices from latestVL53L8CH (like Dashboard does)
      const distance_matrix = latestVL53L8CH?.distance_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
      const reflectance_matrix = latestVL53L8CH?.reflectance_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
      const amplitude_matrix = latestVL53L8CH?.amplitude_matrix || Array(8).fill(null).map(() => Array(8).fill(0));
      
      const transformed: FoieGrasData = {
        sample_id: latestFusion.sample_id || "N/A",
        timestamp: latestFusion.timestamp || new Date().toISOString(),
        device_id: latestFusion.device_id || "N/A",
        grade: latestFusion.final_grade || metrics.grade || "N/A",
        quality_score: latestFusion.final_score || latestFusion.quality_score || 0,
        
        // VL53L8CH (ToF) data - from latestVL53L8CH
        distance_matrix,
        reflectance_matrix,
        amplitude_matrix,
        volume_mm3: metrics.volume_mm3 || generalMetrics.volume_mm3 || 0,
        average_height_mm: metrics.average_thickness_mm || metrics.lobe_thickness_mm || 0,
        max_height_mm: metrics.max_thickness_mm || 0,
        min_height_mm: metrics.min_thickness_mm || 0,
        surface_uniformity: metrics.thickness_uniformity || metrics.dimensional_conformity_score || 0,
        defects: (latestFusion.combined_defects || latestFusion.defects || []).map((d: string | { type?: string; position?: { x: number; y: number }; x?: number; y?: number; severity?: string }) => {
          if (typeof d === 'string') {
            return {
              type: d,
              x: 0,
              y: 0,
              position: { x: 0, y: 0 },
              severity: 'medium'
            };
          }
          const xPos = d.x ?? d.position?.x ?? 0;
          const yPos = d.y ?? d.position?.y ?? 0;
          return {
            type: d.type || 'unknown',
            x: xPos,
            y: yPos,
            position: { x: xPos, y: yPos },
            severity: d.severity || 'medium'
          };
        }),
        
        // AS7341 (Spectral) data - from latestFusion metrics
        color_score: metrics.color_score || metrics.color_score_premium || generalMetrics.color_uniformity || 0,
        freshness_index: metrics.freshness_score || generalMetrics.freshness_index || 0,
        oxidation_level: metrics.oxidation_level || metrics.oxidation_severity || 0,

        // Blockchain certification data - from latestFusion.blockchain
        blockchain_hash: latestFusion.blockchain?.blockchain_hash,
        blockchain_timestamp: latestFusion.blockchain?.blockchain_timestamp,
        qr_code_base64: latestFusion.blockchain?.qr_code_base64,
        lot_abattage: latestFusion.blockchain?.lot_abattage,
        eleveur: latestFusion.blockchain?.eleveur,
        provenance: latestFusion.blockchain?.provenance,
      };
      
      console.log(" FoieGrasPage - Transformed data:", transformed);
      setLatestSample(transformed);
      setIsLoading(false);
    } else {
      console.log(" FoieGrasPage - No fusion data available");
    }
  }, [latestFusion, latestVL53L8CH, latestAS7341]);
  
  const refetch = () => {
    // WebSocket data is automatically updated, just reset loading state
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  };

  // Calculate percentage score (0-100)
  const scorePercentage = latestSample ? Math.round(latestSample.quality_score * 100) : 0;
  
  // Determine color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getGradeBadgeVariant = (grade: string) => {
    if (grade === "A+" || grade === "A") return "default";
    if (grade === "B") return "secondary";
    if (grade === "C") return "outline";
    return "destructive";
  };

  const scoreColor = getScoreColor(scorePercentage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (!latestSample) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Aucune donnée disponible</h2>
          <p className="text-muted-foreground mb-4">
            En attente des premières analyses...
          </p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Contrôle Qualité Foie Gras
          </h1>
          <p className="text-muted-foreground">
            Analyse multi-capteurs en temps réel
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Quality Score */}
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualité Globale</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${scoreColor}`}>
              {scorePercentage}%
            </div>
            <div className="mt-2">
              <Badge variant={getGradeBadgeVariant(latestSample.grade)}>
                Grade {latestSample.grade}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Volume */}
        <StatsCard
          title="Volume"
          value={`${Math.round(latestSample.volume_mm3)} mm³`}
        />

        {/* Uniformity */}
        <StatsCard
          title="Uniformité"
          value={latestSample.surface_uniformity.toFixed(2)}
        />

        {/* Defects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Défauts</CardTitle>
            {latestSample.defects.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestSample.defects.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {latestSample.defects.length === 0 ? "Aucun défaut détecté" : "Défauts détectés"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="tof">ToF (3D)</TabsTrigger>
          <TabsTrigger value="spectral">Spectral</TabsTrigger>
          <TabsTrigger value="defects">Défauts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Statistiques Clés</CardTitle>
                <CardDescription>Métriques dimensionnelles et qualité</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Volume</span>
                    <span className="font-medium">{Math.round(latestSample.volume_mm3)} mm³</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Hauteur moyenne</span>
                    <span className="font-medium">{latestSample.average_height_mm.toFixed(1)} mm</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Hauteur max</span>
                    <span className="font-medium">{latestSample.max_height_mm.toFixed(1)} mm</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Hauteur min</span>
                    <span className="font-medium">{latestSample.min_height_mm.toFixed(1)} mm</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Uniformité surface</span>
                    <span className="font-medium">{latestSample.surface_uniformity.toFixed(3)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Score couleur</span>
                    <span className="font-medium">{(latestSample.color_score * 100).toFixed(0)}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Indice fraîcheur</span>
                    <span className="font-medium">{(latestSample.freshness_index * 100).toFixed(0)}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Niveau oxydation</span>
                    <span className="font-medium">{(latestSample.oxidation_level * 100).toFixed(0)}%</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* 3D Surface Viewer */}
            <Card>
              <CardHeader>
                <CardTitle>Vue 3D</CardTitle>
                <CardDescription>Visualisation de la surface</CardDescription>
              </CardHeader>
              <CardContent>
                <Surface3DViewer
                  matrix={latestSample.distance_matrix}
                  width={400}
                  height={400}
                />
              </CardContent>
            </Card>
          </div>

          {/* Blockchain Certification */}
          {latestSample.blockchain_hash && (
            <BlockchainQRCode
              blockchainHash={latestSample.blockchain_hash}
              data={{
                lot_abattage: latestSample.lot_abattage,
                eleveur: latestSample.eleveur,
                provenance: latestSample.provenance,
                timestamp: latestSample.blockchain_timestamp,
                grade: latestSample.grade,
              }}
              size={256}
              showDetails={true}
            />
          )}

          {/* Heatmaps Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HeatmapViewer
              data={latestSample.distance_matrix}
              label="Distances (mm)"
            />
            <HeatmapViewer
              data={latestSample.reflectance_matrix}
              label="Réflectance (%)"
            />
            <HeatmapViewer
              data={latestSample.amplitude_matrix}
              label="Amplitude"
            />
          </div>
        </TabsContent>

        {/* ToF Tab */}
        <TabsContent value="tof" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top View Heatmap */}
            <Card>
              <CardHeader>
                <CardTitle>Carte de Distance 8x8</CardTitle>
                <CardDescription>Vue de dessus avec valeurs</CardDescription>
              </CardHeader>
              <CardContent>
                <TopViewHeatmap
                  matrix={latestSample.distance_matrix}
                  width={400}
                  height={400}
                />
              </CardContent>
            </Card>

            {/* Pixel Histogram */}
            <Card>
              <CardHeader>
                <CardTitle>Distribution des Distances</CardTitle>
                <CardDescription>Histogramme des valeurs</CardDescription>
              </CardHeader>
              <CardContent>
                <PixelHistogram
                  bins={latestSample.distance_matrix.flat()}
                  binSize={1}
                  label="Distribution des Distances"
                />
              </CardContent>
            </Card>
          </div>

          {/* 3D Viewer Full Width */}
          <Card>
            <CardHeader>
              <CardTitle>Visualisation 3D Interactive</CardTitle>
              <CardDescription>Surface 3D avec défauts surlignés</CardDescription>
            </CardHeader>
            <CardContent>
              <Surface3DViewer
                matrix={latestSample.distance_matrix}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spectral Tab */}
        <TabsContent value="spectral" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatsCard
              title="Score Couleur"
              value={`${(latestSample.color_score * 100).toFixed(0)}%`}
            />
            <StatsCard
              title="Indice Fraîcheur"
              value={`${(latestSample.freshness_index * 100).toFixed(0)}%`}
            />
            <StatsCard
              title="Niveau Oxydation"
              value={`${(latestSample.oxidation_level * 100).toFixed(0)}%`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Analyse Spectrale</CardTitle>
              <CardDescription>Évolution des métriques spectrales</CardDescription>
            </CardHeader>
            <CardContent>
              <LiveChart />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Defects Tab */}
        <TabsContent value="defects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Carte des Défauts</CardTitle>
              <CardDescription>
                {latestSample.defects.length} défaut(s) détecté(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DefectOverlay
                matrix={latestSample.distance_matrix}
                defects={latestSample.defects}
              />
            </CardContent>
          </Card>

          {/* Defects List */}
          {latestSample.defects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Liste des Défauts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {latestSample.defects.map((defect, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{defect.type}</p>
                        <p className="text-sm text-muted-foreground">
                          Position: ({defect.position.x}, {defect.position.y})
                        </p>
                      </div>
                      <Badge
                        variant={
                          defect.severity === "critical"
                            ? "destructive"
                            : defect.severity === "major"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {defect.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Sample Info Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Échantillon:</span> {latestSample.sample_id}
            </div>
            <div>
              <span className="font-medium">Device:</span> {latestSample.device_id}
            </div>
            <div>
              <span className="font-medium">Timestamp:</span>{" "}
              {new Date(latestSample.timestamp).toLocaleString("fr-FR")}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FoieGrasPage;
