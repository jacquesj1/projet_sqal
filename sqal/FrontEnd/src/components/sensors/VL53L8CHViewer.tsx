// ============================================================================
// VL53L8CH ToF Sensor Viewer Component
// Visualisation des données Time-of-Flight
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { ToF3DVisualization } from "./ToF3DVisualization";

interface VL53L8CHData {
  average_height_mm?: number;
  height_range_mm?: number;
  volume_mm3?: number;
  surface_uniformity?: number;
  distance_matrix?: number[][];
  defects?: Array<{ pos: [number, number]; type: string; severity: number; deviation_mm?: number }>;
  stats?: {
    volume_mm3?: number;
    average_height_mm?: number;
    max_height_mm?: number;
    min_height_mm?: number;
  };
  // Legacy fields for backward compatibility
  histogram?: number[];
  avg_height_mm?: number;
  height_variation_mm?: number;
}

interface VL53L8CHViewerProps {
  data: VL53L8CHData | null;
  isLoading?: boolean;
}

export function VL53L8CHViewer({ data, isLoading = false }: VL53L8CHViewerProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capteur ToF VL53L8CH</CardTitle>
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capteur ToF VL53L8CH</CardTitle>
          <CardDescription>Aucune donnée disponible</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Extract values with fallbacks
  const avgHeight = data.average_height_mm ?? data.avg_height_mm ?? data.stats?.average_height_mm ?? 0;
  const heightVariation = data.height_range_mm ?? data.height_variation_mm ?? 0;
  const volume = data.volume_mm3 ?? data.stats?.volume_mm3 ?? 0;
  const uniformity = data.surface_uniformity ?? 0;
  
  // Flatten distance_matrix for histogram or use legacy histogram
  const histogramData = data.distance_matrix 
    ? data.distance_matrix.flat() 
    : (data.histogram || []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Capteur ToF VL53L8CH</span>
          <Badge variant={uniformity > 0.8 ? "default" : "destructive"}>
            Uniformité: {(uniformity * 100).toFixed(1)}%
          </Badge>
        </CardTitle>
        <CardDescription>Analyse morphologique 3D</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métriques principales */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Hauteur moyenne</p>
            <p className="text-2xl font-bold">{avgHeight.toFixed(2)} mm</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Variation</p>
            <p className="text-2xl font-bold">{heightVariation.toFixed(2)} mm</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Volume estimé</p>
            <p className="text-2xl font-bold">{(volume / 1000).toFixed(1)} cm³</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Uniformité surface</p>
            <p className="text-2xl font-bold">{(uniformity * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* Histogramme simplifié */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Histogramme de profondeur</p>
          <div className="h-32 flex items-end gap-0.5">
            {histogramData.slice(0, 64).map((value, index) => {
              const normalizedValue = value > 0 ? Math.min(value / 100, 1) : 0;
              return (
                <div
                  key={index}
                  className="flex-1 bg-primary rounded-t"
                  style={{ height: `${normalizedValue * 100}%` }}
                  title={`${value.toFixed(1)} mm`}
                />
              );
            })}
          </div>
        </div>

        {/* Visualisation 3D avec Three.js */}
        {data.distance_matrix && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Visualisation 3D de la matrice ToF</p>
            <ToF3DVisualization
              distanceMatrix={data.distance_matrix}
              defects={data.defects || []}
              avgHeight={avgHeight}
              maxHeight={data.stats?.max_height_mm || 100}
              minHeight={data.stats?.min_height_mm || 0}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
