import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface QualityRadarChartProps {
  metrics: {
    colorUniformity: number;    // 0-1
    freshness: number;          // 0-1
    fatQuality: number;         // 0-1
    antiOxidation: number;      // 0-1 (= 1 - oxidation)
  };
  threshold?: number;           // Default 0.8 (Grade A threshold)
}

export default function QualityRadarChart({
  metrics = {
    colorUniformity: 0,
    freshness: 0,
    fatQuality: 0,
    antiOxidation: 0,
  },
  threshold = 0.8,
}: QualityRadarChartProps) {

  // Prepare radar chart data
  const data = [
    {
      axis: "Color\nUniformity",
      value: metrics.colorUniformity,
      fullMark: 1,
    },
    {
      axis: "Freshness",
      value: metrics.freshness,
      fullMark: 1,
    },
    {
      axis: "Fat Quality",
      value: metrics.fatQuality,
      fullMark: 1,
    },
    {
      axis: "Anti-Oxidation",
      value: metrics.antiOxidation,
      fullMark: 1,
    },
  ];

  // Reference data for Grade A threshold
  const referenceData = data.map((item) => ({
    ...item,
    reference: threshold,
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="text-sm font-semibold">{payload[0].payload.axis}</p>
          <p className="text-sm text-blue-600">
            Actuel: {(payload[0].value * 100).toFixed(1)}%
          </p>
          {payload[1] && (
            <p className="text-sm text-red-600">
              Seuil A+: {(payload[1].value * 100).toFixed(0)}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card data-testid="quality-radar-chart">
      <CardHeader>
        <CardTitle className="text-sm">Quality Radar</CardTitle>
        <CardDescription className="text-xs">
          Vue d'ensemble des métriques de qualité
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={referenceData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 10, fill: "#6b7280" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 1]}
              tickFormatter={(v) => (v * 100).toFixed(0)}
              tick={{ fontSize: 9 }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Reference threshold (Grade A) */}
            <Radar
              name="Seuil A+"
              dataKey="reference"
              stroke="#DC2626"
              fill="#DC2626"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
            />

            {/* Actual values */}
            <Radar
              name="Qualité actuelle"
              dataKey="value"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
              strokeWidth={2}
            />

            <Legend
              wrapperStyle={{ fontSize: "10px" }}
              iconType="circle"
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
