// ============================================================================
// Combined Matrix Analysis - Reflectance + Amplitude combined chart
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";

interface CombinedMatrixAnalysisProps {
  reflectance_analysis?: {
    avg_reflectance?: number;
    reflectance_uniformity?: number;
    optical_anomalies?: number;
  };
  amplitude_consistency?: {
    avg_amplitude?: number;
    amplitude_std?: number;
    amplitude_variance?: number;
    signal_stability?: number;
  };
}

export function CombinedMatrixAnalysis({ reflectance_analysis, amplitude_consistency }: CombinedMatrixAnalysisProps) {
  const data = [
    {
      metric: "Moyenne",
      reflectance: (reflectance_analysis?.avg_reflectance || 0) * 100,
      amplitude: (amplitude_consistency?.avg_amplitude || 0) / 10, // Scale down for comparison
    },
    {
      metric: "Uniformité",
      reflectance: (reflectance_analysis?.reflectance_uniformity || 0) * 100,
      amplitude: (amplitude_consistency?.signal_stability || 0) * 100,
    },
    {
      metric: "Qualité",
      reflectance: 100 - ((reflectance_analysis?.optical_anomalies || 0) * 100),
      amplitude: 100 - ((amplitude_consistency?.amplitude_variance || 0) * 1000), // Scale variance
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" />
          Analyse Combinée Réflectance & Amplitude
        </CardTitle>
        <CardDescription className="text-xs">
          Comparaison des métriques de qualité optique et signal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="metric" stroke="#9ca3af" fontSize={11} />
            <YAxis stroke="#9ca3af" fontSize={11} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number) => `${value.toFixed(1)}%`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="reflectance"
              name="Réflectance IR"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: "#8b5cf6", r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="amplitude"
              name="Amplitude Signal"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: "#f59e0b", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Stats Summary */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 bg-purple-50 rounded border border-purple-200">
            <p className="text-xs font-semibold text-purple-900 mb-1">Réflectance IR</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Moyenne:</span>
                <span className="font-bold">{((reflectance_analysis?.avg_reflectance || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uniformité:</span>
                <span className="font-bold">{((reflectance_analysis?.reflectance_uniformity || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Anomalies:</span>
                <span className="font-bold">{(reflectance_analysis?.optical_anomalies || 0)}</span>
              </div>
            </div>
          </div>

          <div className="p-2 bg-orange-50 rounded border border-orange-200">
            <p className="text-xs font-semibold text-orange-900 mb-1">Amplitude Signal</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Moyenne:</span>
                <span className="font-bold">{(amplitude_consistency?.avg_amplitude || 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stabilité:</span>
                <span className="font-bold">{((amplitude_consistency?.signal_stability || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Écart-type:</span>
                <span className="font-bold">{(amplitude_consistency?.amplitude_std || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CombinedMatrixAnalysis;
