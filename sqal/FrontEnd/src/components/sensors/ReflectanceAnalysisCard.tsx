// ============================================================================
// Reflectance Analysis Card
// Displays optical properties analysis from VL53L8CH sensor
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Eye, AlertCircle, CheckCircle, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/ui/tooltip";
import { useEffect } from "react";
import HeatmapViewer from "./HeatmapViewer";

interface ReflectanceAnalysisProps {
  reflectance_analysis?: {
    avg_reflectance?: number;
    reflectance_uniformity?: number;
    optical_anomalies?: string[];
  };
  reflectance_matrix?: number[][];
}

export function ReflectanceAnalysisCard({ reflectance_analysis, reflectance_matrix }: ReflectanceAnalysisProps) {
  // Debug log
  useEffect(() => {
    console.log("🔍 ReflectanceAnalysisCard - Data:", reflectance_analysis);
  }, [reflectance_analysis]);

  if (!reflectance_analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-blue-500" />
            Analyse Réflectance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Données non disponibles</p>
          <p className="text-xs text-red-500 mt-2">Debug: reflectance_analysis est {typeof reflectance_analysis}</p>
        </CardContent>
      </Card>
    );
  }

  const { avg_reflectance, reflectance_uniformity, optical_anomalies = [] } = reflectance_analysis;

  // Calculate percentage from 0-255 scale
  const reflectancePercent = avg_reflectance != null ? ((avg_reflectance / 255) * 100).toFixed(1) : '0';
  const uniformityPercent = reflectance_uniformity != null ? (reflectance_uniformity * 100).toFixed(1) : '0';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm">Analyse Réflectance IR</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs font-semibold mb-1">Réflectance Infrarouge</p>
                <p className="text-xs">
                  Mesure la capacité de la surface à réfléchir le signal IR (0-255).
                  Une réflectance élevée et uniforme indique une surface homogène de qualité.
                  Les anomalies optiques signalent des variations de densité ou de composition.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="text-xs">
          Propriétés optiques de la surface
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Debug info */}
        <div className="text-xs text-muted-foreground">
          Debug: avg={avg_reflectance?.toFixed(1) ?? 'N/A'}, uniformity={reflectance_uniformity?.toFixed(3) ?? 'N/A'}
        </div>
        {/* Average Reflectance */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium">Réflectance Moyenne</span>
            <span className="text-sm font-bold text-blue-600">{reflectancePercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${reflectancePercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {avg_reflectance != null ? avg_reflectance.toFixed(0) : '--'} / 255
          </p>
        </div>

        {/* Uniformity */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium">Uniformité</span>
            <span className="text-sm font-bold text-green-600">{uniformityPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${uniformityPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Score: {reflectance_uniformity != null ? reflectance_uniformity.toFixed(3) : '--'}
          </p>
        </div>

        {/* Optical Anomalies */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 mb-2">
            {optical_anomalies.length === 0 ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs font-semibold text-green-600">Aucune anomalie optique</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-semibold text-orange-600">
                  {optical_anomalies.length} anomalie(s) détectée(s)
                </span>
              </>
            )}
          </div>
          {optical_anomalies.length > 0 && (
            <ul className="space-y-1">
              {optical_anomalies.map((anomaly, idx) => (
                <li key={idx} className="text-xs text-muted-foreground pl-4">
                  • {anomaly}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Interpretation */}
        <div className="text-xs bg-blue-50 p-2 rounded">
          <p className="font-semibold text-blue-900 mb-1">Interprétation:</p>
          <p className="text-blue-700">
            {(reflectance_uniformity ?? 0) > 0.8
              ? "Surface homogène avec réflectance uniforme - Excellente qualité optique"
              : (reflectance_uniformity ?? 0) > 0.6
              ? "Réflectance acceptable - Quelques variations de surface"
              : "Réflectance hétérogène - Vérifier la qualité de surface"}
          </p>
        </div>

        {/* Heatmap Visualization */}
        {reflectance_matrix && reflectance_matrix.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-blue-900 mb-2">Carte de Réflectance IR (8x8)</p>
            <div className="h-64">
              <HeatmapViewer data={reflectance_matrix} label="" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReflectanceAnalysisCard;
