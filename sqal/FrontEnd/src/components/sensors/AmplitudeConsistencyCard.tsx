// ============================================================================
// Amplitude Consistency Card
// Displays signal quality and stability analysis from VL53L8CH
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Activity, TrendingUp, Waves, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/ui/tooltip";
import { useEffect } from "react";
import HeatmapViewer from "./HeatmapViewer";

interface AmplitudeConsistencyProps {
  amplitude_consistency?: {
    avg_amplitude?: number;
    amplitude_std?: number;
    amplitude_variance?: number;
    signal_stability?: number;
    z_scores?: number[];
  } | number;
  amplitude_matrix?: number[][];
}

export function AmplitudeConsistencyCard({ amplitude_consistency, amplitude_matrix }: AmplitudeConsistencyProps) {
  // Debug log
  useEffect(() => {
    console.log("🔍 AmplitudeConsistencyCard - Data:", amplitude_consistency, "Type:", typeof amplitude_consistency);
  }, [amplitude_consistency]);

  // Handle both object and number formats
  const isObject = typeof amplitude_consistency === 'object' && amplitude_consistency !== null;

  if (!amplitude_consistency) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-500" />
            Cohérence du Signal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Données non disponibles</p>
          <p className="text-xs text-red-500 mt-2">Debug: amplitude_consistency est {String(amplitude_consistency)}</p>
        </CardContent>
      </Card>
    );
  }

  if (!isObject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-500" />
            Cohérence du Signal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{amplitude_consistency.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Score de cohérence</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    avg_amplitude,
    amplitude_std,
    amplitude_variance,
    signal_stability,
  } = amplitude_consistency;

  const stabilityPercent = signal_stability != null ? (signal_stability * 100).toFixed(1) : '0';
  const coefficientOfVariation = (avg_amplitude != null && avg_amplitude > 0 && amplitude_std != null)
    ? (amplitude_std / avg_amplitude) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-sm">Cohérence du Signal IR</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs font-semibold mb-1">Amplitude du Signal</p>
                <p className="text-xs">
                  L'amplitude mesure l'intensité du signal IR retourné par chaque zone (8x8).
                  Une amplitude stable et cohérente indique une bonne qualité de mesure.
                  Le CV (coefficient de variation) évalue l'homogénéité : plus il est faible, mieux c'est.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="text-xs">
          Qualité et stabilité du retour infrarouge
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Debug info */}
        <div className="text-xs text-muted-foreground">
          Debug: avg={avg_amplitude?.toFixed(1) ?? 'N/A'}, std={amplitude_std?.toFixed(2) ?? 'N/A'}, stability={signal_stability?.toFixed(3) ?? 'N/A'}
        </div>
        {/* Average Amplitude */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Amplitude Moyenne</p>
            <p className="text-lg font-bold text-purple-600">
              {avg_amplitude != null ? avg_amplitude.toFixed(1) : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Écart-type</p>
            <p className="text-lg font-bold text-gray-600">
              {amplitude_std != null ? amplitude_std.toFixed(2) : '--'}
            </p>
          </div>
        </div>

        {/* Signal Stability */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium flex items-center gap-1">
              <Waves className="h-3 w-3" />
              Stabilité du Signal
            </span>
            <span className="text-sm font-bold text-green-600">{stabilityPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                (signal_stability ?? 0) > 0.8
                  ? 'bg-green-500'
                  : (signal_stability ?? 0) > 0.6
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${stabilityPercent}%` }}
            />
          </div>
        </div>

        {/* Variance */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Variance</p>
            <p className="text-sm font-semibold">
              {amplitude_variance != null ? amplitude_variance.toFixed(2) : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CV (%)</p>
            <p className="text-sm font-semibold">{coefficientOfVariation.toFixed(1)}%</p>
          </div>
        </div>

        {/* Signal Quality Indicator */}
        <div className="flex items-center gap-2 p-2 rounded bg-purple-50">
          <TrendingUp className={`h-4 w-4 ${
            (signal_stability ?? 0) > 0.8 ? 'text-green-600' : 'text-orange-600'
          }`} />
          <div>
            <p className="text-xs font-semibold text-purple-900">
              Qualité du signal: {(signal_stability ?? 0) > 0.8 ? 'Excellent' : (signal_stability ?? 0) > 0.6 ? 'Bon' : 'Faible'}
            </p>
            <p className="text-xs text-purple-700">
              {(signal_stability ?? 0) > 0.8
                ? "Signal stable et cohérent sur toute la surface"
                : (signal_stability ?? 0) > 0.6
                ? "Signal acceptable avec quelques variations"
                : "Signal instable - Vérifier les conditions de mesure"}
            </p>
          </div>
        </div>

        {/* Technical Details */}
        <div className="text-xs bg-gray-50 p-2 rounded space-y-1">
          <p className="font-semibold">Détails techniques:</p>
          <p>• Amplitude = Intensité du signal IR retourné</p>
          <p>• Stabilité = Cohérence du signal (σ/μ)</p>
          <p>• CV = Coefficient de variation</p>
        </div>

        {/* Heatmap Visualization */}
        {amplitude_matrix && amplitude_matrix.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-purple-900 mb-2">Carte d'Amplitude Signal IR (8x8)</p>
            <div className="h-64">
              <HeatmapViewer data={amplitude_matrix} label="" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AmplitudeConsistencyCard;
