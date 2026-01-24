import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList, Cell } from "recharts";

interface QualityComparisonBarsProps {
  tofScore: number;             // 0-1
  spectralScore: number;        // 0-1
  fusionScore: number;          // 0-1
  gradeAThreshold?: number;     // Default 0.8
}

export default function QualityComparisonBars({
  tofScore = 0,
  spectralScore = 0,
  fusionScore = 0,
  gradeAThreshold = 0.8,
}: QualityComparisonBarsProps) {

  const data = [
    {
      method: "ToF Only",
      score: tofScore,
      color: "#3B82F6",  // blue-500
    },
    {
      method: "Spectral Only",
      score: spectralScore,
      color: "#F97316",  // orange-500
    },
    {
      method: "Fusion\n(Final)",
      score: fusionScore,
      color: "#9333EA",  // purple-600
    },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="text-sm font-semibold">{payload[0].payload.method.replace('\n', ' ')}</p>
          <p className="text-sm">Score: {(payload[0].value * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">
            ({payload[0].value.toFixed(3)})
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card data-testid="quality-comparison-bars">
      <CardHeader>
        <CardTitle className="text-sm">Quality Score Comparison</CardTitle>
        <CardDescription className="text-xs">
          Comparaison ToF / Spectral / Fusion
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="method"
              tick={{ fontSize: 11 }}
              angle={0}
              textAnchor="middle"
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => (v * 100).toFixed(0) + "%"}
              tick={{ fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Grade A threshold line */}
            <ReferenceLine
              y={gradeAThreshold}
              stroke="#16A34A"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `Grade A threshold (${(gradeAThreshold * 100).toFixed(0)}%)`,
                position: "top",
                fontSize: 10,
                fill: "#16A34A",
              }}
            />

            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <LabelList
                dataKey="score"
                position="top"
                formatter={(value: number) => (value * 100).toFixed(1) + "%"}
                style={{ fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-center">
          <div>
            <p className="font-semibold text-blue-600">ToF Only</p>
            <p className="text-muted-foreground">{(tofScore * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-semibold text-orange-600">Spectral Only</p>
            <p className="text-muted-foreground">{(spectralScore * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-semibold text-purple-600">Fusion</p>
            <p className="text-muted-foreground">{(fusionScore * 100).toFixed(1)}%</p>
          </div>
        </div>

        <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs text-center">
          <p className="font-semibold text-purple-700">
            Gain de fusion: +{((fusionScore - Math.max(tofScore, spectralScore)) * 100).toFixed(1)}% pts
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
