import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";

interface StatsPanelProps {
  stats: {
    volume_trapezoidal_mm3?: number;
    avg_height_mm?: number;
    max_height_mm?: number;
    min_height_mm?: number;
    height_variation_mm?: number;
    surface_uniformity?: number;
  };
  grade?: string;
  quality_score?: number;
}

export default function StatsPanel({ stats, grade, quality_score }: StatsPanelProps) {
  const getGradeBadgeVariant = (grade: string) => {
    if (grade === "A+" || grade === "A") return "default";
    if (grade === "B") return "secondary";
    if (grade === "C") return "outline";
    return "destructive";
  };

  const getGradeColor = (grade: string) => {
    const gradeColors: Record<string, string> = {
      "A+": "text-green-700",
      "A": "text-green-600",
      "B": "text-orange-500",
      "C": "text-orange-600",
      "REJECT": "text-red-600",
    };
    return gradeColors[grade] || "text-gray-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">ToF Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Grade et Score */}
          {grade && (
            <div className="flex items-center justify-between pb-3 border-b">
              <span className="text-sm font-semibold">Grade:</span>
              <Badge variant={getGradeBadgeVariant(grade)} className="text-lg">
                {grade}
              </Badge>
            </div>
          )}

          {quality_score !== undefined && (
            <div className="flex items-center justify-between pb-3 border-b">
              <span className="text-sm font-semibold">Score:</span>
              <span className={`text-lg font-bold ${getGradeColor(grade || "")}`}>
                {(quality_score * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {/* Statistiques */}
          {stats.volume_trapezoidal_mm3 !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Volume:</span>
              <span className="text-sm font-medium">
                {stats.volume_trapezoidal_mm3.toFixed(0)} mm³
              </span>
            </div>
          )}

          {stats.avg_height_mm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Hauteur moy:</span>
              <span className="text-sm font-medium">
                {stats.avg_height_mm.toFixed(1)} mm
              </span>
            </div>
          )}

          {stats.max_height_mm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Hauteur max:</span>
              <span className="text-sm font-medium">
                {stats.max_height_mm.toFixed(1)} mm
              </span>
            </div>
          )}

          {stats.min_height_mm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Hauteur min:</span>
              <span className="text-sm font-medium">
                {stats.min_height_mm.toFixed(1)} mm
              </span>
            </div>
          )}

          {stats.height_variation_mm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Variation:</span>
              <span className="text-sm font-medium">
                {stats.height_variation_mm.toFixed(1)} mm
              </span>
            </div>
          )}

          {stats.surface_uniformity !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Uniformité:</span>
              <span className="text-sm font-medium">
                {stats.surface_uniformity.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
