import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useState, useMemo } from "react";
import { Button } from "@components/ui/button";

interface CrossSectionProfileProps {
  matrix: number[][];
  defaultAxis?: "x" | "y";
  defaultIndex?: number;
}

export default function CrossSectionProfile({
  matrix,
  defaultAxis = "x",
  defaultIndex = 0,
}: CrossSectionProfileProps) {
  const [axis, setAxis] = useState<"x" | "y">(defaultAxis);
  const [sliceIndex, setSliceIndex] = useState(defaultIndex);

  const size = matrix.length;

  const profileData = useMemo(() => {
    const data: { position: number; value: number }[] = [];

    if (axis === "x") {
      // Horizontal slice (row)
      const row = Math.min(sliceIndex, size - 1);
      for (let col = 0; col < size; col++) {
        data.push({
          position: col,
          value: matrix[row]?.[col] || 0,
        });
      }
    } else {
      // Vertical slice (column)
      const col = Math.min(sliceIndex, size - 1);
      for (let row = 0; row < size; row++) {
        data.push({
          position: row,
          value: matrix[row]?.[col] || 0,
        });
      }
    }

    return data;
  }, [matrix, axis, sliceIndex, size]);

  const avgValue = useMemo(() => {
    const values = profileData.map((d) => d.value).filter((v) => v > 0);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [profileData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Profil Transversal</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={axis === "x" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAxis("x");
                setSliceIndex(Math.floor(size / 2));
              }}
            >
              Axe X
            </Button>
            <Button
              variant={axis === "y" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAxis("y");
                setSliceIndex(Math.floor(size / 2));
              }}
            >
              Axe Y
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Position:</span>
          <input
            type="range"
            min="0"
            max={size - 1}
            value={sliceIndex}
            onChange={(e) => setSliceIndex(Number(e.target.value))}
            className="flex-1 h-2"
          />
          <span className="text-xs font-medium min-w-[30px]">
            {sliceIndex}/{size - 1}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={profileData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="position"
              label={{
                value: axis === "x" ? "Position X" : "Position Y",
                position: "insideBottom",
                offset: -5,
                fontSize: 10,
              }}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              label={{
                value: "Profondeur (mm)",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
              }}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-2 border rounded shadow-lg">
                      <p className="text-xs font-semibold">
                        Position: {payload[0].payload.position}
                      </p>
                      <p className="text-xs text-blue-600">
                        Profondeur: {typeof payload[0].value === 'number' ? payload[0].value.toFixed(1) : '0.0'} mm
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={avgValue}
              stroke="#22c55e"
              strokeDasharray="5 5"
              label={{
                value: `Moy: ${avgValue.toFixed(1)}`,
                position: "right",
                fontSize: 10,
                fill: "#22c55e",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
