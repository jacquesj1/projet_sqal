import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface SpectralRegionPieProps {
  rawCounts: Record<string, number>;
}

export default function SpectralRegionPie({ rawCounts = {} }: SpectralRegionPieProps) {

  // Group spectral channels into 5 regions
  const calculateRegions = () => {
    const uvViolet = rawCounts.F1_violet || 0;
    const blueCyan =
      (rawCounts.F2_indigo || 0) +
      (rawCounts.F3_blue || 0) +
      (rawCounts.F4_cyan || 0);
    const greenYellow =
      (rawCounts.F5_green || 0) +
      (rawCounts.F6_yellow || 0);
    const orangeRed =
      (rawCounts.F7_orange || 0) +
      (rawCounts.F8_red || 0);
    const nir = rawCounts.NIR || 0;

    const total = uvViolet + blueCyan + greenYellow + orangeRed + nir;

    if (total === 0) return [];

    return [
      {
        name: "UV-Violet",
        value: uvViolet,
        percentage: (uvViolet / total) * 100,
        color: "#8B00FF",
      },
      {
        name: "Blue-Cyan",
        value: blueCyan,
        percentage: (blueCyan / total) * 100,
        color: "#0080FF",
      },
      {
        name: "Green-Yellow",
        value: greenYellow,
        percentage: (greenYellow / total) * 100,
        color: "#80FF00",
      },
      {
        name: "Orange-Red",
        value: orangeRed,
        percentage: (orangeRed / total) * 100,
        color: "#FF4500",
      },
      {
        name: "NIR",
        value: nir,
        percentage: (nir / total) * 100,
        color: "#8B4513",
      },
    ];
  };

  const data = calculateRegions();

  // Custom label renderer
  const renderCustomLabel = (entry: any) => {
    return `${entry.percentage.toFixed(1)}%`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="text-sm font-semibold">{data.name}</p>
          <p className="text-sm">Counts: {data.value.toFixed(0)}</p>
          <p className="text-sm">{data.percentage.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <Card data-testid="spectral-region-pie">
        <CardHeader>
          <CardTitle className="text-sm">Spectral Region Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="spectral-region-pie">
      <CardHeader>
        <CardTitle className="text-sm">Spectral Region Distribution</CardTitle>
        <CardDescription className="text-xs">
          Répartition par zones spectrales (%)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
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
              wrapperStyle={{ fontSize: "10px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
