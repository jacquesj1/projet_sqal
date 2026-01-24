// ============================================================================
// VL53L8CH KPI Cards
// Key Performance Indicators for ToF sensor quality assessment
// ============================================================================

import { Card, CardContent } from "@components/ui/card";
import { TrendingUp, Award, Box, Layers, AlertTriangle, Target } from "lucide-react";

interface VL53L8CHKPICardsProps {
  data: {
    grade?: string;
    quality_score?: number;
    volume_mm3?: number;
    surface_uniformity?: number;
    average_height_mm?: number;
    defects?: any[];
  };
}

export function VL53L8CHKPICards({ data }: VL53L8CHKPICardsProps) {
  const {
    grade = "UNKNOWN",
    quality_score = 0,
    volume_mm3 = 0,
    surface_uniformity = 0,
    average_height_mm = 0,
    defects = [],
  } = data;

  const gradeColors: Record<string, string> = {
    "A+": "text-green-600 bg-green-50 border-green-200",
    "A": "text-green-600 bg-green-50 border-green-200",
    "B": "text-blue-600 bg-blue-50 border-blue-200",
    "C": "text-yellow-600 bg-yellow-50 border-yellow-200",
    "REJECT": "text-red-600 bg-red-50 border-red-200",
    "UNKNOWN": "text-gray-600 bg-gray-50 border-gray-200",
  };

  const gradeColor = gradeColors[grade] || gradeColors["UNKNOWN"];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Grade */}
      <Card className={`border-2 ${gradeColor}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <Award className="h-5 w-5 opacity-60" />
            <span className="text-xs font-medium opacity-75">Grade</span>
          </div>
          <div className="text-3xl font-bold">{grade}</div>
          <p className="text-xs opacity-75 mt-1">
            {grade === "A+" || grade === "A" ? "Premium" : grade === "B" ? "Standard" : grade === "C" ? "Acceptable" : grade === "REJECT" ? "Non conforme" : "Inconnu"}
          </p>
        </CardContent>
      </Card>

      {/* Quality Score */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <Target className="h-5 w-5 text-purple-500" />
            <span className="text-xs font-medium text-muted-foreground">Score</span>
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {(quality_score * 100).toFixed(0)}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
            <div
              className="bg-purple-500 h-1 rounded-full transition-all duration-500"
              style={{ width: `${quality_score * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Volume */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <Box className="h-5 w-5 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">Volume</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {(volume_mm3 / 1000).toFixed(1)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">cm³</p>
        </CardContent>
      </Card>

      {/* Uniformity */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <Layers className="h-5 w-5 text-green-500" />
            <span className="text-xs font-medium text-muted-foreground">Uniformité</span>
          </div>
          <div className="text-3xl font-bold text-green-600">
            {(surface_uniformity * 100).toFixed(0)}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
            <div
              className="bg-green-500 h-1 rounded-full transition-all duration-500"
              style={{ width: `${surface_uniformity * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Height */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            <span className="text-xs font-medium text-muted-foreground">Hauteur Moy.</span>
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {average_height_mm.toFixed(1)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">mm</p>
        </CardContent>
      </Card>

      {/* Defects */}
      <Card className={defects.length > 0 ? "border-2 border-orange-200 bg-orange-50" : ""}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className={`h-5 w-5 ${defects.length > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
            <span className="text-xs font-medium text-muted-foreground">Défauts</span>
          </div>
          <div className={`text-3xl font-bold ${defects.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {defects.length}
          </div>
          <p className={`text-xs mt-1 ${defects.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {defects.length === 0 ? "✓ Aucun" : "détecté(s)"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default VL53L8CHKPICards;
