import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

interface IndividualScoresBarsProps {
  spectralScore: number;        // 0-1
  tofScore: number;             // 0-1
}

export default function IndividualScoresBars({
  spectralScore = 0,
  tofScore = 0,
}: IndividualScoresBarsProps) {

  const data = [
    {
      sensor: "Spectral\n(AS7341)",
      score: spectralScore,
      color: "#F97316",  // orange-500
    },
    {
      sensor: "ToF\n(VL53L8CH)",
      score: tofScore,
      color: "#3B82F6",  // blue-500
    },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="text-sm font-semibold">{payload[0].payload.sensor.replace('\n', ' ')}</p>
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
    <Card data-testid="individual-scores-bars">
      <CardHeader>
        <CardTitle className="text-sm">Individual Scores</CardTitle>
        <CardDescription className="text-xs">
          Scores individuels des capteurs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 60, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => (v * 100).toFixed(0) + "%"}
            />
            <YAxis
              dataKey="sensor"
              type="category"
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <rect key={`bar-${index}`} fill={entry.color} />
              ))}
              <LabelList
                dataKey="score"
                position="right"
                formatter={(value: number) => value.toFixed(3)}
                style={{ fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-2 text-xs text-center text-muted-foreground">
          <p>Comparaison des performances individuelles</p>
        </div>
      </CardContent>
    </Card>
  );
}
