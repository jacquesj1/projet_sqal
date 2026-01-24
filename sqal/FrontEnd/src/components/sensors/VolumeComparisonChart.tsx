// ============================================================================
// Volume Comparison Chart - Compare different volume calculation methods
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Box } from "lucide-react";

interface VolumeComparisonProps {
  stats?: {
    volume_mm3?: number;
    volume_trapezoidal_mm3?: number;
    volume_simpson_mm3?: number;
    volume_spline_mm3?: number;
  };
}

export function VolumeComparisonChart({ stats }: VolumeComparisonProps) {
  const chartData = [
    {
      name: "Standard",
      value: stats?.volume_mm3 || 0,
      color: "#3b82f6",
    },
    {
      name: "Trapézoïdale",
      value: stats?.volume_trapezoidal_mm3 || 0,
      color: "#10b981",
    },
    {
      name: "Simpson",
      value: stats?.volume_simpson_mm3 || 0,
      color: "#8b5cf6",
    },
    {
      name: "Spline",
      value: stats?.volume_spline_mm3 || 0,
      color: "#f59e0b",
    },
  ];

  const maxValue = Math.max(...chartData.map(d => d.value));
  const avgValue = chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Box className="h-4 w-4 text-blue-500" />
          Comparaison des Méthodes de Calcul du Volume
        </CardTitle>
        <CardDescription className="text-xs">
          4 algorithmes de calcul volumétrique (mm³)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
            <YAxis stroke="#9ca3af" fontSize={11} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value.toFixed(2)} mm³`, "Volume"]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Stats Summary */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 bg-blue-50 rounded">
            <p className="text-muted-foreground">Volume Maximum</p>
            <p className="font-bold text-blue-700">{maxValue.toFixed(2)} mm³</p>
          </div>
          <div className="p-2 bg-green-50 rounded">
            <p className="text-muted-foreground">Volume Moyen</p>
            <p className="font-bold text-green-700">{avgValue.toFixed(2)} mm³</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default VolumeComparisonChart;
