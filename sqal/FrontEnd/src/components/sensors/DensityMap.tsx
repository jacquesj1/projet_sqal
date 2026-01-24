import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";

interface DensityMapProps {
  reflectance: number[][];      // 8x8 reflectance matrix
  amplitude: number[][];        // 8x8 amplitude matrix
  tofWeight?: number;           // Weight for reflectance (default 0.6)
  amplitudeWeight?: number;     // Weight for amplitude (default 0.4)
}

export default function DensityMap({
  reflectance = [],
  amplitude = [],
  tofWeight = 0.6,
  amplitudeWeight = 0.4,
}: DensityMapProps) {

  // Calculate weighted density from reflectance and amplitude
  const calculateDensityMap = (): number[][] => {
    const size = reflectance.length || 8;
    const densityMap = Array(size).fill(null).map(() => Array(size).fill(0));

    // Normalize reflectance and amplitude
    const maxReflectance = Math.max(...reflectance.flat(), 1);
    const maxAmplitude = Math.max(...amplitude.flat(), 1);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const normReflectance = (reflectance[y]?.[x] || 0) / maxReflectance;
        const normAmplitude = (amplitude[y]?.[x] || 0) / maxAmplitude;

        // Weighted average
        densityMap[y][x] = tofWeight * normReflectance + amplitudeWeight * normAmplitude;
      }
    }

    return densityMap;
  };

  const densityMap = calculateDensityMap();
  const maxDensity = Math.max(...densityMap.flat(), 0.01);

  // Blues colormap (light blue = low density, dark blue = high density)
  const getBluesColor = (value: number): string => {
    const normalized = value / maxDensity;
    const red = Math.round(255 * (1 - normalized * 0.9));
    const green = Math.round(255 * (1 - normalized * 0.6));
    const blue = 255;
    return `rgb(${red}, ${green}, ${blue})`;
  };

  // Identify density anomalies (very low or very high)
  const meanDensity = densityMap.flat().reduce((a, b) => a + b, 0) / (densityMap.length * densityMap.length);
  const anomalies: Array<{ x: number; y: number }> = [];
  densityMap.forEach((row, y) => {
    row.forEach((value, x) => {
      // Mark anomalies if density is > 2*mean or < 0.5*mean
      if (value > 2 * meanDensity || value < 0.5 * meanDensity) {
        anomalies.push({ x, y });
      }
    });
  });

  if (reflectance.length === 0 || amplitude.length === 0) {
    return (
      <Card data-testid="density-map">
        <CardHeader>
          <CardTitle className="text-sm">Density Map</CardTitle>
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
    <Card data-testid="density-map">
      <CardHeader>
        <CardTitle className="text-sm">Density Map</CardTitle>
        <CardDescription className="text-xs">
          Carte de densité (Reflectance + Amplitude)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative" style={{ aspectRatio: "1/1" }}>
          <svg
            viewBox="0 0 800 800"
            className="w-full h-full"
            style={{ maxHeight: "300px" }}
          >
            {/* Draw blues-scale density map */}
            {densityMap.map((row, y) =>
              row.map((value, x) => (
                <rect
                  key={`cell-${x}-${y}`}
                  x={x * 100}
                  y={y * 100}
                  width={100}
                  height={100}
                  fill={getBluesColor(value)}
                  stroke="#ddd"
                  strokeWidth={1}
                />
              ))
            )}

            {/* Overlay anomaly markers (Red X) */}
            {anomalies.map((anomaly, idx) => {
              const centerX = anomaly.x * 100 + 50;
              const centerY = anomaly.y * 100 + 50;
              return (
                <g key={`anomaly-${idx}`}>
                  <line
                    x1={centerX - 25}
                    y1={centerY - 25}
                    x2={centerX + 25}
                    y2={centerY + 25}
                    stroke="#DC2626"
                    strokeWidth={3}
                  />
                  <line
                    x1={centerX + 25}
                    y1={centerY - 25}
                    x2={centerX - 25}
                    y2={centerY + 25}
                    stroke="#DC2626"
                    strokeWidth={3}
                  />
                </g>
              );
            })}

            {/* Grid lines */}
            {Array.from({ length: 9 }).map((_, i) => (
              <g key={`grid-${i}`}>
                <line
                  x1={i * 100}
                  y1={0}
                  x2={i * 100}
                  y2={800}
                  stroke="#999"
                  strokeWidth={1}
                  opacity={0.3}
                />
                <line
                  x1={0}
                  y1={i * 100}
                  x2={800}
                  y2={i * 100}
                  stroke="#999"
                  strokeWidth={1}
                  opacity={0.3}
                />
              </g>
            ))}
          </svg>

          {/* Legend */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Faible densité</span>
            <div className="flex items-center gap-1">
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <div
                  key={v}
                  className="w-6 h-4 border"
                  style={{ backgroundColor: getBluesColor(v * maxDensity) }}
                />
              ))}
            </div>
            <span className="text-muted-foreground">Haute densité</span>
          </div>

          <div className="mt-2 text-center">
            <span className="text-xs text-muted-foreground">
              Densité moyenne: {meanDensity.toFixed(3)} | Anomalies: {anomalies.length}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
