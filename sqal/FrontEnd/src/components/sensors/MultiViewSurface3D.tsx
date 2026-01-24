import { Card, CardContent } from "@components/ui/card";
import EnhancedSurface3DViewer from "./EnhancedSurface3DViewer";
import HeatmapViewer from "./HeatmapViewer";
import CrossSectionProfile from "./CrossSectionProfile";
import StatsPanel from "./StatsPanel";

interface MultiViewSurface3DProps {
  matrix: number[][];
  defects: Array<any>;
  reflectance_matrix?: number[][];
  amplitude_matrix?: number[][];
  stats: {
    volume_trapezoidal_mm3?: number;
    avg_height_mm?: number;
    max_height_mm?: number;
    min_height_mm?: number;
    surface_uniformity?: number;
    grade?: string;
    quality_score?: number;
  };
}

export default function MultiViewSurface3D({
  matrix = [],
  defects = [],
  reflectance_matrix,
  amplitude_matrix,
  stats = {},
}: MultiViewSurface3DProps) {

  if (matrix.length === 0) {
    return (
      <Card data-testid="multi-view-surface-3d">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground text-center py-8">
            No data available for multi-view display
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="multi-view-surface-3d">
      {/* PANEL 1: 3D Surface Interactive (Full width) */}
      <EnhancedSurface3DViewer
        matrix={matrix}
        defects={defects}
        reflectance_matrix={reflectance_matrix}
        amplitude_matrix={amplitude_matrix}
        heightScale={1.0}
        width={800}
        height={600}
      />

      {/* PANELS 2-4: Grid 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PANEL 2: Top-view Heatmap */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Vue dessus - Hauteurs</h3>
            <HeatmapViewer
              data={matrix}
              label=""
            />
          </CardContent>
        </Card>

        {/* PANEL 3: Cross-section Profiles */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Profils en coupe</h3>
            <CrossSectionProfile
              matrix={matrix}
              defaultAxis="x"
              defaultIndex={Math.floor(matrix.length / 2)}
            />
          </CardContent>
        </Card>

        {/* PANEL 4: Stats Panel (Floating style) */}
        <StatsPanel
          stats={stats}
          grade={stats.grade || "N/A"}
          quality_score={stats.quality_score || 0}
        />
      </div>

      {/* Optional: Additional info row */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="text-center">
              <p className="text-muted-foreground">Grille capteur</p>
              <p className="font-semibold">{matrix.length}x{matrix[0]?.length || 0} zones</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Défauts détectés</p>
              <p className={`font-semibold ${defects.length === 0 ? "text-green-600" : "text-red-600"}`}>
                {defects.length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Volume estimé</p>
              <p className="font-semibold">
                {stats.volume_trapezoidal_mm3?.toFixed(0) || "N/A"} mm³
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
