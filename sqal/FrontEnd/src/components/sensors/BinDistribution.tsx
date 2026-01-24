import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@components/ui/badge";

interface BinDistributionProps {
  bins: number[];
  binSize?: number;
  maxBins?: number;
  // Advanced metrics from backend bins_analysis
  density_score?: number;
  multi_peak_count?: number;
  peak_bin?: number;
  signal_quality?: number;
  surface_roughness?: number;
  texture_score?: number;
}

export default function BinDistribution({
  bins,
  binSize = 37.5,
  maxBins = 128,
  density_score,
  multi_peak_count,
  peak_bin,
  signal_quality,
  surface_roughness,
  texture_score,
}: BinDistributionProps) {
  // Convert bins array to chart data
  const chartData = bins.slice(0, maxBins).map((count, index) => ({
    bin: index,
    distance: (index * binSize).toFixed(0),
    count: count,
  }));

  // Find peak bin (use backend value if available, otherwise calculate)
  const calculatedPeakBin = bins.indexOf(Math.max(...bins));
  const finalPeakBin = peak_bin ?? calculatedPeakBin;
  const peakDistance = (finalPeakBin * binSize).toFixed(0);

  // Detect multiple peaks (use backend value if available)
  const detectMultiplePeaks = (): number => {
    if (multi_peak_count !== undefined) return multi_peak_count;

    // Simple peak detection: find local maxima
    let peaks = 0;
    const threshold = Math.max(...bins) * 0.3; // 30% of max
    for (let i = 1; i < bins.length - 1; i++) {
      if (bins[i] > threshold && bins[i] > bins[i-1] && bins[i] > bins[i+1]) {
        peaks++;
      }
    }
    return peaks;
  };

  const peaksCount = detectMultiplePeaks();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Distribution Bins ToF</CardTitle>
        <CardDescription className="text-xs">
          Histogramme temps-de-vol ({bins.length} bins, {binSize} mm/bin)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Advanced Metrics Summary */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
          <div className="p-2 bg-blue-50 rounded border border-blue-200">
            <p className="text-muted-foreground">Pic principal</p>
            <p className="font-semibold text-blue-700">Bin {finalPeakBin} (~{peakDistance} mm)</p>
          </div>
          <div className="p-2 bg-purple-50 rounded border border-purple-200">
            <p className="text-muted-foreground">Pics multiples</p>
            <p className="font-semibold text-purple-700">{peaksCount} détecté(s)</p>
          </div>
          <div className="p-2 bg-green-50 rounded border border-green-200">
            <p className="text-muted-foreground">Qualité signal</p>
            <p className="font-semibold text-green-700">
              {signal_quality !== undefined ? (signal_quality * 100).toFixed(0) + '%' : 'N/A'}
            </p>
          </div>
        </div>

        {/* Advanced Scores (if available from backend) */}
        {(density_score !== undefined || texture_score !== undefined || surface_roughness !== undefined) && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {density_score !== undefined && (
              <Badge variant="outline" className="text-xs">
                Densité: {(density_score * 100).toFixed(0)}%
              </Badge>
            )}
            {texture_score !== undefined && (
              <Badge variant="outline" className="text-xs">
                Texture: {(texture_score * 100).toFixed(0)}%
              </Badge>
            )}
            {surface_roughness !== undefined && (
              <Badge variant="outline" className="text-xs">
                Rugosité: {surface_roughness.toFixed(3)}
              </Badge>
            )}
          </div>
        )}

        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="bin"
              label={{
                value: "Bin Index",
                position: "insideBottom",
                offset: -5,
                fontSize: 10,
              }}
              tick={{ fontSize: 9 }}
              interval={Math.floor(chartData.length / 8)}
            />
            <YAxis
              label={{
                value: "Photon Count",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
              }}
              tick={{ fontSize: 9 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-2 border rounded shadow-lg">
                      <p className="text-xs font-semibold">
                        Bin: {payload[0].payload.bin}
                      </p>
                      <p className="text-xs text-green-600">
                        Distance: ~{payload[0].payload.distance} mm
                      </p>
                      <p className="text-xs text-blue-600">
                        Counts: {payload[0].value}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="count"
              fill="#8b5cf6"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
