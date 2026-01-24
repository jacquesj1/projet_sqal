import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from "recharts";

interface MaterialSignatureHistogramProps {
  bins: number[];               // 128 bins
  binSize?: number;             // 37.5mm per bin (ST datasheet)
  peakBin?: number;             // Primary peak location
  maxBins?: number;             // Max bins to display (default 128)
}

export default function MaterialSignatureHistogram({
  bins = [],
  binSize = 37.5,
  peakBin,
  maxBins = 128,
}: MaterialSignatureHistogramProps) {

  // Prepare chart data (limit to maxBins)
  const chartData = bins.slice(0, maxBins).map((value, index) => ({
    bin: index,
    amplitude: value,
    distance_mm: (index * binSize).toFixed(0),
  }));

  // Auto-detect peak if not provided
  const detectedPeak = peakBin ?? bins.indexOf(Math.max(...bins));
  const peakValue = bins[detectedPeak] || 0;

  // Define foie gras zone (typically between 20-50mm)
  const foieGrasMinBin = Math.floor(20 / binSize);  // ~1 bin
  const foieGrasMaxBin = Math.floor(50 / binSize);  // ~1-2 bins

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="text-sm font-semibold">Bin: {payload[0].payload.bin}</p>
          <p className="text-sm">Distance: {payload[0].payload.distance_mm} mm</p>
          <p className="text-sm">Amplitude: {payload[0].value.toFixed(0)}</p>
        </div>
      );
    }
    return null;
  };

  if (bins.length === 0) {
    return (
      <Card data-testid="material-signature-histogram">
        <CardHeader>
          <CardTitle className="text-sm">Material Signature</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No histogram data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="material-signature-histogram">
      <CardHeader>
        <CardTitle className="text-sm">Material Signature Histogram</CardTitle>
        <CardDescription className="text-xs">
          Histogramme ToF 128 bins (signature matériau)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="bin"
              label={{ value: "Bins (0-128)", position: "insideBottom", offset: -5 }}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              label={{ value: "Amplitude", angle: -90, position: "insideLeft" }}
              tick={{ fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Foie gras zone highlight (background) */}
            <Area
              type="monotone"
              dataKey={(entry) =>
                entry.bin >= foieGrasMinBin && entry.bin <= foieGrasMaxBin
                  ? Math.max(...bins)
                  : 0
              }
              fill="#10B981"
              fillOpacity={0.1}
              stroke="none"
            />

            {/* Main histogram bars */}
            <Bar dataKey="amplitude" fill="#3B82F6" radius={[2, 2, 0, 0]} />

            {/* Peak marker */}
            <ReferenceLine
              x={detectedPeak}
              stroke="#DC2626"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `Pic: bin ${detectedPeak}`,
                position: "top",
                fontSize: 10,
                fill: "#DC2626",
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Stats */}
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-center">
          <div>
            <p className="text-muted-foreground">Pic principal</p>
            <p className="font-semibold">Bin {detectedPeak}</p>
            <p className="text-muted-foreground">({(detectedPeak * binSize).toFixed(0)} mm)</p>
          </div>
          <div>
            <p className="text-muted-foreground">Amplitude max</p>
            <p className="font-semibold">{peakValue.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Bins actifs</p>
            <p className="font-semibold">
              {bins.filter((v) => v > peakValue * 0.1).length} / {bins.length}
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
          <p className="font-semibold text-green-700">
            Zone foie gras: Bins {foieGrasMinBin}-{foieGrasMaxBin} (20-50mm)
          </p>
          <p className="text-muted-foreground">
            1 bin ≈ {binSize} mm selon datasheet ST VL53L8CH
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
