// ============================================================================
// SQAL Frontend - Distribution Chart Component
// Histogram with normal curve overlay and statistics
// ============================================================================

import { useMemo } from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DetailedInfoTooltip } from '@/components/ui/info-tooltip';

interface DistributionChartProps {
  data: number[];
  title: string;
  description?: string;
  xAxisLabel: string;
  unit: string;
  bins?: number;
  mean?: number;
  std?: number;
  lsl?: number;
  usl?: number;
  showNormalCurve?: boolean;
}

export function DistributionChart({
  data,
  title,
  description,
  xAxisLabel,
  unit,
  bins = 20,
  mean: providedMean,
  std: providedStd,
  lsl,
  usl,
  showNormalCurve = true,
}: DistributionChartProps) {
  // Calculate histogram and statistics
  const { histogram, stats, normalCurve } = useMemo(() => {
    if (data.length === 0) {
      return { histogram: [], stats: null, normalCurve: [] };
    }

    // Calculate statistics
    const mean = providedMean ?? data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (data.length - 1);
    const std = providedStd ?? Math.sqrt(variance);
    const min = Math.min(...data);
    const max = Math.max(...data);
    const median = [...data].sort((a, b) => a - b)[Math.floor(data.length / 2)];

    // Create histogram bins
    const binWidth = (max - min) / bins;
    const histogramData: { bin: string; binCenter: number; count: number; frequency: number }[] = [];

    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const binCenter = (binStart + binEnd) / 2;
      const count = data.filter((v) => v >= binStart && v < binEnd).length;
      const frequency = count / data.length;

      histogramData.push({
        bin: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
        binCenter,
        count,
        frequency,
      });
    }

    // Generate normal curve
    const normalCurveData = showNormalCurve
      ? histogramData.map((bin) => {
          const x = bin.binCenter;
          const z = (x - mean) / std;
          const normalValue = (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
          return {
            ...bin,
            normalFrequency: normalValue * binWidth,
          };
        })
      : [];

    return {
      histogram: histogramData,
      stats: { mean, std, min, max, median, count: data.length },
      normalCurve: normalCurveData,
    };
  }, [data, bins, providedMean, providedStd, showNormalCurve]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium mb-2">{data.bin} {unit}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Effectif:</span>
            <span className="text-sm font-bold">{data.count}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Fréquence:</span>
            <span className="text-sm font-bold">{(data.frequency * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            <DetailedInfoTooltip
              title="Graphique de Distribution"
              description="Histogramme avec courbe normale pour analyser la distribution statistique des mesures."
              items={[
                "Barres bleues : Fréquence des valeurs mesurées",
                "Courbe rouge : Distribution normale théorique",
                "LSL/USL : Limites de spécification (tolérances)",
                "Moyenne, écart-type, médiane : Statistiques descriptives"
              ]}
              side="left"
            />
          </div>
          {stats && (
            <Badge variant="outline">
              {stats.count} échantillons
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Statistics Summary */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Moyenne</p>
              <p className="text-lg font-bold">{stats.mean.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Écart-type</p>
              <p className="text-lg font-bold">{stats.std.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Médiane</p>
              <p className="text-lg font-bold">{stats.median.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Min</p>
              <p className="text-lg font-bold">{stats.min.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Max</p>
              <p className="text-lg font-bold">{stats.max.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Chart */}
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={showNormalCurve ? normalCurve : histogram} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="binCenter"
              type="number"
              domain={['dataMin', 'dataMax']}
              label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
              className="text-xs"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => value.toFixed(1)}
            />
            <YAxis
              yAxisId="left"
              label={{ value: 'Fréquence', angle: -90, position: 'insideLeft' }}
              className="text-xs"
              tick={{ fontSize: 12 }}
            />
            {showNormalCurve && (
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Densité normale', angle: 90, position: 'insideRight' }}
                className="text-xs"
                tick={{ fontSize: 12 }}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {/* Reference lines */}
            {stats && (
              <ReferenceLine
                x={stats.mean}
                stroke="#3b82f6"
                strokeWidth={2}
                label={{ value: 'μ', position: 'top', fontSize: 14 }}
                yAxisId="left"
              />
            )}
            {lsl && (
              <ReferenceLine
                x={lsl}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: 'LSL', position: 'top', fontSize: 12 }}
                yAxisId="left"
              />
            )}
            {usl && (
              <ReferenceLine
                x={usl}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: 'USL', position: 'top', fontSize: 12 }}
                yAxisId="left"
              />
            )}

            {/* Histogram bars */}
            <Bar
              dataKey="frequency"
              fill="#3b82f6"
              fillOpacity={0.6}
              name="Distribution"
              yAxisId="left"
            />

            {/* Normal curve */}
            {showNormalCurve && (
              <Line
                type="monotone"
                dataKey="normalFrequency"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Courbe normale"
                yAxisId="right"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Distribution Info */}
        {stats && (
          <div className="mt-4 p-3 rounded-lg bg-muted">
            <p className="text-sm font-medium mb-2">Analyse de Distribution</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Plage: </span>
                <span className="font-bold">{(stats.max - stats.min).toFixed(2)} {unit}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Coefficient de variation: </span>
                <span className="font-bold">{((stats.std / stats.mean) * 100).toFixed(1)}%</span>
              </div>
            </div>
            {(lsl || usl) && stats && (
              <div className="mt-2">
                <span className="text-muted-foreground text-xs">
                  {lsl && usl && (
                    <>
                      Conformité: {((data.filter(v => v >= lsl && v <= usl).length / data.length) * 100).toFixed(1)}%
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
