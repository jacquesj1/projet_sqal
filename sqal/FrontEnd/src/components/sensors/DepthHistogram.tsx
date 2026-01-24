import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

interface DepthHistogramProps {
  matrix: number[][];
  binCount?: number;
}

export default function DepthHistogram({ matrix, binCount = 10 }: DepthHistogramProps) {
  const histogramData = useMemo(() => {
    // Flatten matrix
    const values = matrix.flat().filter((v) => v > 0);

    if (values.length === 0) {
      return [];
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const binSize = range / binCount;

    // Initialize bins
    const bins: { range: string; count: number; minValue: number }[] = [];
    for (let i = 0; i < binCount; i++) {
      const binMin = min + i * binSize;
      const binMax = binMin + binSize;
      bins.push({
        range: `${binMin.toFixed(0)}-${binMax.toFixed(0)}`,
        count: 0,
        minValue: binMin,
      });
    }

    // Count values in each bin
    values.forEach((value) => {
      const binIndex = Math.min(
        Math.floor((value - min) / binSize),
        binCount - 1
      );
      bins[binIndex].count++;
    });

    return bins;
  }, [matrix, binCount]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Distribution des Profondeurs</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={histogramData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-2 border rounded shadow-lg">
                      <p className="text-xs font-semibold">
                        Plage: {payload[0].payload.range} mm
                      </p>
                      <p className="text-xs text-blue-600">
                        Fréquence: {payload[0].value}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
