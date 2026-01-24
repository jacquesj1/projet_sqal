// ============================================================================
// Bins Metrics Card
// Advanced ToF histogram analysis metrics
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { BarChart3, Layers, Activity, Gauge, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/ui/tooltip";
import { useEffect } from "react";

interface BinsMetricsProps {
  bins_metrics: {
    density_score?: number;
    multi_peak_count?: number;
    peak_bin?: number;
    signal_quality?: number;
    surface_roughness?: number;
    texture_score?: number;
  };
}

export function BinsMetricsCard({ bins_metrics }: BinsMetricsProps) {
  // Debug log
  useEffect(() => {
    console.log("🔍 BinsMetricsCard - Data:", bins_metrics);
  }, [bins_metrics]);

  if (!bins_metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            Métriques Bins ToF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Données non disponibles</p>
          <p className="text-xs text-red-500 mt-2">Debug: bins_metrics est {typeof bins_metrics}</p>
        </CardContent>
      </Card>
    );
  }

  const {
    density_score,
    multi_peak_count = 0,
    peak_bin,
    signal_quality,
    surface_roughness,
    texture_score,
  } = bins_metrics;

  // Convert peak_bin to distance (1 bin ≈ 37.5mm according to ST datasheet)
  const peakDistance = peak_bin != null ? (peak_bin * 37.5).toFixed(1) : 'N/A';

  const MetricBar = ({ label, value, color }: { label: string; value: number | undefined; color: string }) => {
    const colorMap: Record<string, { bg: string; text: string }> = {
      indigo: { bg: '#6366f1', text: '#4f46e5' },
      purple: { bg: '#a855f7', text: '#9333ea' },
      green: { bg: '#22c55e', text: '#16a34a' },
      orange: { bg: '#f97316', text: '#ea580c' },
    };

    const displayValue = value != null ? (value * 100).toFixed(0) : '--';
    const widthPercent = value != null ? value * 100 : 0;

    return (
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium">{label}</span>
          <span className="text-sm font-bold" style={{ color: colorMap[color]?.text || '#000' }}>
            {displayValue}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${widthPercent}%`,
              backgroundColor: colorMap[color]?.bg || '#000',
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            <CardTitle className="text-sm">Métriques Avancées ToF</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs font-semibold mb-1">Histogramme ToF (128 bins)</p>
                <p className="text-xs">
                  Le capteur VL53L8CH génère un histogramme de 128 bins représentant
                  la distribution des temps de vol (1 bin ≈ 37.5mm).
                  Ces métriques analysent la densité, la rugosité de surface, et la qualité du signal.
                  Les multi-pics indiquent des défauts internes ou une surface irrégulière.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="text-xs">
          Analyse fine de l'histogramme temps de vol
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Debug info */}
        <div className="text-xs text-muted-foreground">
          Debug: density={density_score != null ? density_score.toFixed(3) : 'N/A'},
          quality={signal_quality != null ? signal_quality.toFixed(3) : 'N/A'},
          roughness={surface_roughness != null ? surface_roughness.toFixed(3) : 'N/A'},
          texture={texture_score != null ? texture_score.toFixed(3) : 'N/A'}
        </div>
        {/* Grid of key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-indigo-50 p-2 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-3 w-3 text-indigo-600" />
              <p className="text-xs font-medium text-indigo-900">Densité</p>
            </div>
            <p className="text-xl font-bold text-indigo-600">
              {density_score != null ? (density_score * 100).toFixed(0) : '--'}%
            </p>
          </div>

          <div className="bg-purple-50 p-2 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-3 w-3 text-purple-600" />
              <p className="text-xs font-medium text-purple-900">Qualité Signal</p>
            </div>
            <p className="text-xl font-bold text-purple-600">
              {signal_quality != null ? (signal_quality * 100).toFixed(0) : '--'}%
            </p>
          </div>

          <div className="bg-orange-50 p-2 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="h-3 w-3 text-orange-600" />
              <p className="text-xs font-medium text-orange-900">Rugosité</p>
            </div>
            <p className="text-xl font-bold text-orange-600">
              {surface_roughness != null ? (surface_roughness * 100).toFixed(0) : '--'}%
            </p>
          </div>

          <div className="bg-green-50 p-2 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-3 w-3 text-green-600" />
              <p className="text-xs font-medium text-green-900">Texture</p>
            </div>
            <p className="text-xl font-bold text-green-600">
              {texture_score != null ? (texture_score * 100).toFixed(0) : '--'}%
            </p>
          </div>
        </div>

        {/* Detailed metrics */}
        <div className="space-y-3 pt-2 border-t">
          <MetricBar label="Score Densité" value={density_score} color="indigo" />
          <MetricBar label="Qualité Signal" value={signal_quality} color="purple" />
          <MetricBar label="Score Texture" value={texture_score} color="green" />
          <MetricBar label="Rugosité Surface" value={surface_roughness} color="orange" />
        </div>

        {/* Peak information */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">Pic Principal (bin)</span>
            <span className="text-sm font-bold">{peak_bin ?? '--'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">Distance estimée</span>
            <span className="text-sm font-bold text-blue-600">~{peakDistance} mm</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">Pics détectés</span>
            <span className="text-sm font-bold">{multi_peak_count ?? 0}</span>
          </div>
        </div>

        {/* Multi-peak warning */}
        {multi_peak_count > 1 && (
          <div className="bg-yellow-50 border border-yellow-200 p-2 rounded">
            <p className="text-xs font-semibold text-yellow-900">
              ⚠️ Multi-pics détectés ({multi_peak_count})
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Possible présence de défauts internes ou surface irrégulière
            </p>
          </div>
        )}

        {/* Interpretation */}
        <div className="text-xs bg-indigo-50 p-2 rounded">
          <p className="font-semibold text-indigo-900 mb-1">Interprétation:</p>
          <p className="text-indigo-700">
            {(density_score ?? 0) > 0.8 && (signal_quality ?? 0) > 0.8
              ? "Excellent - Densité homogène et signal stable"
              : (density_score ?? 0) > 0.6
              ? "Bon - Quelques variations de densité détectées"
              : "Attention - Densité hétérogène ou signal faible"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default BinsMetricsCard;
