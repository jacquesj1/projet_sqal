import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { InfoTooltip } from "@components/ui/info-tooltip";

interface QualityMetricsBarsProps {
  freshness: number;           // 0-1
  fatQuality: number;          // 0-1
  colorUniformity: number;     // 0-1
  oxidation: number;           // 0-1
}

export default function QualityMetricsBars({
  freshness = 0,
  fatQuality = 0,
  colorUniformity = 0,
  oxidation = 0,
}: QualityMetricsBarsProps) {

  // Determine color based on quality score
  const getQualityColor = (value: number): string => {
    if (value >= 0.8) return "#16A34A";  // green-600
    if (value >= 0.6) return "#EAB308";  // yellow-500
    if (value >= 0.4) return "#F97316";  // orange-500
    return "#DC2626";                     // red-600
  };

  // Prepare data for horizontal bar chart
  const data = [
    { metric: "Freshness", value: freshness, color: getQualityColor(freshness) },
    { metric: "Fat Quality", value: fatQuality, color: getQualityColor(fatQuality) },
    { metric: "Color Uniformity", value: colorUniformity, color: getQualityColor(colorUniformity) },
    { metric: "Oxidation", value: oxidation, color: getQualityColor(oxidation) },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="text-sm font-semibold">{payload[0].payload.metric}</p>
          <p className="text-sm">{(payload[0].value * 100).toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card data-testid="quality-metrics-bars">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Quality Metrics</CardTitle>
          <InfoTooltip
            side="left"
            maxWidth="md"
            content={
              "Indices 0-1 dérivés des ratios spectraux: \n  - Freshness: basé sur Violet/Orange + Freshness meat index (fraîcheur).\n  - Fat Quality: basé sur Lipid oxidation index + Oil oxidation index (qualité lipidique).\n  - Color Uniformity: basé sur Discoloration index (jaunissement).\n  - Oxidation: inversé par rapport à Fat Quality (plus d’oxydation → score plus défavorable)."
            }
          />
        </div>
        <CardDescription className="text-xs">
          Index de qualité (0-1)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => (v * 100).toFixed(0) + "%"} />
            <YAxis dataKey="metric" type="category" tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value: number) => (value * 100).toFixed(1) + "%"}
                style={{ fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
