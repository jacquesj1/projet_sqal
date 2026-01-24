import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface SensorWeightsPieProps {
  tofWeight?: number;            // Default 0.6 (60%)
  spectralWeight?: number;       // Default 0.4 (40%)
}

export default function SensorWeightsPie({
  tofWeight = 0.6,
  spectralWeight = 0.4,
}: SensorWeightsPieProps) {

  const data = [
    {
      name: "ToF (VL53L8CH)",
      value: tofWeight * 100,
      percentage: (tofWeight * 100).toFixed(0) + "%",
      color: "#3B82F6",  // blue-500
    },
    {
      name: "Spectral (AS7341)",
      value: spectralWeight * 100,
      percentage: (spectralWeight * 100).toFixed(0) + "%",
      color: "#F97316",  // orange-500
    },
  ];

  // Custom label renderer
  const renderCustomLabel = (entry: any) => {
    return `${entry.percentage}`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="text-sm font-semibold">{data.name}</p>
          <p className="text-sm">Contribution: {data.percentage}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card data-testid="sensor-weights-pie">
      <CardHeader>
        <CardTitle className="text-sm">Sensor Weights</CardTitle>
        <CardDescription className="text-xs">
          Pondération des capteurs dans la fusion
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={70}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: "11px" }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="mt-2 text-xs text-center text-muted-foreground">
          <p>Algorithme de fusion: Moyenne pondérée</p>
        </div>
      </CardContent>
    </Card>
  );
}
