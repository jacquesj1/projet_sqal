// ============================================================================
// FusionScorePanel - Panel showing fusion scores and contributions
// Matching Python fusion_visualizations.py layout
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { TrendingUp, Activity } from "lucide-react";

interface FusionScorePanelProps {
  fusion: {
    final_grade?: string;
    final_score?: number;
    vl53l8ch_score?: number;
    as7341_score?: number;
    tof_contribution?: number;
    spectral_contribution?: number;
    fusion_mode?: string;
  };
}

export default function FusionScorePanel({ fusion }: FusionScorePanelProps) {
  const final_grade = fusion.final_grade || "N/A";
  const final_score = (fusion.final_score || 0) * 100;
  const vl53l8ch_score = (fusion.vl53l8ch_score || 0) * 100;
  const as7341_score = (fusion.as7341_score || 0) * 100;
  const tof_contribution = (fusion.tof_contribution || 0.6) * 100;
  const spectral_contribution = (fusion.spectral_contribution || 0.4) * 100;

  const getGradeColor = (grade: string) => {
    const gradeColors: Record<string, string> = {
      "A+": "text-green-700 bg-green-50 border-green-300",
      "A": "text-green-600 bg-green-50 border-green-300",
      "B": "text-orange-500 bg-orange-50 border-orange-300",
      "C": "text-orange-600 bg-orange-50 border-orange-300",
      "REJECT": "text-red-600 bg-red-50 border-red-300",
    };
    return gradeColors[grade] || "text-gray-600 bg-gray-50 border-gray-300";
  };

  const getScoreColor = (score: number) => {
    if (score > 85) return "text-green-700";
    if (score > 70) return "text-green-600";
    if (score > 55) return "text-orange-500";
    if (score > 40) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          Fusion Multi-Capteurs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Final Grade - Large Display */}
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div
              className={`text-7xl font-bold border-4 rounded-lg px-6 py-3 ${getGradeColor(
                final_grade
              )}`}
            >
              {final_grade}
            </div>
            <Badge variant="outline" className="text-lg px-4 py-1">
              Score Final: {final_score.toFixed(1)}%
            </Badge>
            <div className="text-xs text-muted-foreground italic">
              Mode: {fusion.fusion_mode || "weighted_average"}
            </div>
          </div>

          {/* Individual Scores */}
          <div className="border-t pt-3 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Scores Individuels
            </div>

            {/* VL53L8CH Score */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="font-medium">VL53L8CH (ToF)</span>
                </span>
                <span className={`font-bold ${getScoreColor(vl53l8ch_score)}`}>
                  {vl53l8ch_score.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${vl53l8ch_score}%` }}
                />
              </div>
            </div>

            {/* AS7341 Score */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="font-medium">AS7341 (Spectral)</span>
                </span>
                <span className={`font-bold ${getScoreColor(as7341_score)}`}>
                  {as7341_score.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${as7341_score}%` }}
                />
              </div>
            </div>
          </div>

          {/* Contributions */}
          <div className="border-t pt-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Contributions Pondérées
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-blue-600" />
                <span className="text-xs">ToF:</span>
              </div>
              <span className="text-sm font-bold text-blue-600">
                {tof_contribution.toFixed(0)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-orange-600" />
                <span className="text-xs">Spectral:</span>
              </div>
              <span className="text-sm font-bold text-orange-600">
                {spectral_contribution.toFixed(0)}%
              </span>
            </div>

            {/* Visual bar for contributions */}
            <div className="flex w-full h-4 rounded-full overflow-hidden border mt-2">
              <div
                className="bg-blue-500 flex items-center justify-center text-xs text-white font-semibold"
                style={{ width: `${tof_contribution}%` }}
              >
                {tof_contribution > 30 && `${tof_contribution.toFixed(0)}%`}
              </div>
              <div
                className="bg-orange-500 flex items-center justify-center text-xs text-white font-semibold"
                style={{ width: `${spectral_contribution}%` }}
              >
                {spectral_contribution > 30 && `${spectral_contribution.toFixed(0)}%`}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
