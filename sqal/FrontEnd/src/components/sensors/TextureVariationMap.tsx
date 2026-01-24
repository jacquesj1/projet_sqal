import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";

interface TextureVariationMapProps {
  matrix: number[][];           // 8x8 distance matrix
  windowSize?: number;          // Default 3 (3x3 local variance)
}

export default function TextureVariationMap({
  matrix = [],
  windowSize = 3,
}: TextureVariationMapProps) {

  // Calculate local variance for each pixel
  const calculateTextureVariance = (): number[][] => {
    const size = matrix.length || 8;
    const varianceMap = Array(size).fill(null).map(() => Array(size).fill(0));
    const halfWindow = Math.floor(windowSize / 2);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Collect values in local window
        const windowValues: number[] = [];
        for (let dy = -halfWindow; dy <= halfWindow; dy++) {
          for (let dx = -halfWindow; dx <= halfWindow; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < size && nx >= 0 && nx < size) {
              windowValues.push(matrix[ny][nx]);
            }
          }
        }

        // Calculate variance
        if (windowValues.length > 0) {
          const mean = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
          const variance =
            windowValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
            windowValues.length;
          varianceMap[y][x] = Math.sqrt(variance); // Standard deviation
        }
      }
    }

    return varianceMap;
  };

  const varianceMap = calculateTextureVariance();
  const maxVariance = Math.max(...varianceMap.flat(), 0.01);

  // Grayscale colormap (black = low variance, white = high variance)
  const getGrayscaleColor = (value: number): string => {
    const normalized = value / maxVariance;
    const gray = Math.round(255 * normalized);
    return `rgb(${gray}, ${gray}, ${gray})`;
  };

  // Identify high-variance zones for X markers
  const highVarianceThreshold = maxVariance * 0.7;
  const highVarianceZones: Array<{ x: number; y: number }> = [];
  varianceMap.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value > highVarianceThreshold) {
        highVarianceZones.push({ x, y });
      }
    });
  });

  if (matrix.length === 0) {
    return (
      <Card data-testid="texture-variation-map">
        <CardHeader>
          <CardTitle className="text-sm">Texture Variation Map</CardTitle>
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
    <Card data-testid="texture-variation-map">
      <CardHeader>
        <CardTitle className="text-sm">Texture Variation Map</CardTitle>
        <CardDescription className="text-xs">
          Variations de texture de surface (échelle de gris)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative" style={{ aspectRatio: "1/1" }}>
          <svg
            viewBox="0 0 800 800"
            className="w-full h-full"
            style={{ maxHeight: "300px" }}
          >
            {/* Draw grayscale texture map */}
            {varianceMap.map((row, y) =>
              row.map((value, x) => (
                <rect
                  key={`cell-${x}-${y}`}
                  x={x * 100}
                  y={y * 100}
                  width={100}
                  height={100}
                  fill={getGrayscaleColor(value)}
                  stroke="#ddd"
                  strokeWidth={1}
                />
              ))
            )}

            {/* Overlay high-variance markers (Red X) */}
            {highVarianceZones.map((zone, idx) => {
              const centerX = zone.x * 100 + 50;
              const centerY = zone.y * 100 + 50;
              return (
                <g key={`marker-${idx}`}>
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
            <span className="text-muted-foreground">Texture lisse</span>
            <div className="flex items-center gap-1">
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <div
                  key={v}
                  className="w-6 h-4 border"
                  style={{ backgroundColor: getGrayscaleColor(v * maxVariance) }}
                />
              ))}
            </div>
            <span className="text-muted-foreground">Texture rugueuse</span>
          </div>

          <div className="mt-2 text-center">
            <span className="text-xs text-muted-foreground">
              Variance max: {maxVariance.toFixed(2)} mm | Zones à haute variance: {highVarianceZones.length}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
