// ============================================================================
// Height Metrics Chart - Combined height analysis visualization
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Ruler } from "lucide-react";

interface HeightMetricsProps {
  stats?: {
    min_height_mm?: number;
    average_height_mm?: number;
    max_height_mm?: number;
    height_range_mm?: number;
    height_variation_mm?: number;
  };
}

export function HeightMetricsChart({ stats }: HeightMetricsProps) {
  const avgHeight = stats?.average_height_mm || 0;

  const chartData = [
    {
      name: "Min",
      value: stats?.min_height_mm || 0,
      color: "#ef4444",
      description: "Hauteur minimale mesurée",
    },
    {
      name: "Moyenne",
      value: avgHeight,
      color: "#3b82f6",
      description: "Hauteur moyenne du produit",
    },
    {
      name: "Max",
      value: stats?.max_height_mm || 0,
      color: "#10b981",
      description: "Hauteur maximale mesurée",
    },
  ];

  const range = stats?.height_range_mm || 0;
  const variation = stats?.height_variation_mm || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Ruler className="h-4 w-4 text-blue-500" />
          Analyse des Hauteurs
        </CardTitle>
        <CardDescription className="text-xs">
          Distribution des hauteurs mesurées (mm)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
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
              formatter={(value: number, _name: string, props: any) => [
                `${value.toFixed(2)} mm`,
                props?.payload?.description || ''
              ]}
            />
            <ReferenceLine
              y={avgHeight}
              stroke="#3b82f6"
              strokeDasharray="3 3"
              label={{ value: `Moy: ${avgHeight.toFixed(2)}mm`, position: "right", fontSize: 10 }}
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
          <div className="p-2 bg-purple-50 rounded">
            <p className="text-muted-foreground">Étendue (Range)</p>
            <p className="font-bold text-purple-700">{range.toFixed(2)} mm</p>
            <p className="text-muted-foreground text-[10px] mt-1">Max - Min</p>
          </div>
          <div className="p-2 bg-orange-50 rounded">
            <p className="text-muted-foreground">Variation</p>
            <p className="font-bold text-orange-700">{variation.toFixed(2)} mm</p>
            <p className="text-muted-foreground text-[10px] mt-1">Écart-type</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default HeightMetricsChart;
