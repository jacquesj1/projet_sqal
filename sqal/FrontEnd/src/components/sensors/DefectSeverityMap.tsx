import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";

interface DefectSeverityMapProps {
  matrix: number[][];           // 8x8 distance matrix
  defects: Array<{
    x: number;
    y: number;
    severity: number;           // 0-1
    type: string;
  }>;
}

export default function DefectSeverityMap({ matrix = [], defects = [] }: DefectSeverityMapProps) {

  // Calculate defect severity map from defects array
  const calculateSeverityMap = (): number[][] => {
    const size = matrix.length || 8;
    const severityMap = Array(size).fill(null).map(() => Array(size).fill(0));

    // Map each defect to the severity grid
    defects.forEach((defect) => {
      if (defect.x < size && defect.y < size) {
        severityMap[defect.y][defect.x] = defect.severity;
      }
    });

    return severityMap;
  };

  const severityMap = calculateSeverityMap();
  const maxSeverity = Math.max(...severityMap.flat(), 0.01);

  // Red colormap (white = 0, dark red = 1)
  const getRedColor = (value: number): string => {
    const normalized = value / maxSeverity;
    const red = 255;
    const green = Math.round(255 * (1 - normalized));
    const blue = Math.round(255 * (1 - normalized));
    return `rgb(${red}, ${green}, ${blue})`;
  };

  if (matrix.length === 0) {
    return (
      <Card data-testid="defect-severity-map">
        <CardHeader>
          <CardTitle className="text-sm">Defect Severity Map</CardTitle>
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
    <Card data-testid="defect-severity-map">
      <CardHeader>
        <CardTitle className="text-sm">Defect Severity Map</CardTitle>
        <CardDescription className="text-xs">
          Carte de sévérité des défauts (0-1)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative" style={{ aspectRatio: "1/1" }}>
          <svg
            viewBox="0 0 800 800"
            className="w-full h-full"
            style={{ maxHeight: "300px" }}
          >
            {/* Draw severity heatmap */}
            {severityMap.map((row, y) =>
              row.map((value, x) => (
                <rect
                  key={`cell-${x}-${y}`}
                  x={x * 100}
                  y={y * 100}
                  width={100}
                  height={100}
                  fill={getRedColor(value)}
                  stroke="#ddd"
                  strokeWidth={1}
                />
              ))
            )}

            {/* Overlay defect markers (X) */}
            {defects.map((defect, idx) => {
              const centerX = defect.x * 100 + 50;
              const centerY = defect.y * 100 + 50;
              return (
                <g key={`defect-${idx}`}>
                  {/* Red X marker */}
                  <line
                    x1={centerX - 30}
                    y1={centerY - 30}
                    x2={centerX + 30}
                    y2={centerY + 30}
                    stroke="#DC2626"
                    strokeWidth={4}
                  />
                  <line
                    x1={centerX + 30}
                    y1={centerY - 30}
                    x2={centerX - 30}
                    y2={centerY + 30}
                    stroke="#DC2626"
                    strokeWidth={4}
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
            <span className="text-muted-foreground">Faible sévérité</span>
            <div className="flex items-center gap-1">
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <div
                  key={v}
                  className="w-6 h-4 border"
                  style={{ backgroundColor: getRedColor(v * maxSeverity) }}
                />
              ))}
            </div>
            <span className="text-muted-foreground">Haute sévérité</span>
          </div>

          <div className="mt-2 text-center">
            <span className="text-xs font-semibold text-red-600">
              {defects.length} défaut(s) détecté(s)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
