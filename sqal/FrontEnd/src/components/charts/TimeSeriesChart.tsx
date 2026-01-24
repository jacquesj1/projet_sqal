// ============================================================================
// SQAL Frontend - Time Series Chart Component
// Real-time evolution chart for quality metrics over time
// ============================================================================

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DetailedInfoTooltip } from '@/components/ui/info-tooltip';

interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  target?: number;
  ucl?: number;
  lcl?: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  title: string;
  description?: string;
  yAxisLabel: string;
  unit: string;
  target?: number;
  ucl?: number;
  lcl?: number;
  showTrend?: boolean;
  color?: string;
}

export function TimeSeriesChart({
  data,
  title,
  description,
  yAxisLabel,
  unit,
  target,
  ucl,
  lcl,
  showTrend = true,
  color = '#3b82f6',
}: TimeSeriesChartProps) {
  // Calculate trend
  const trend = useMemo(() => {
    if (!showTrend || data.length < 2) return null;

    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;
    const change = lastValue - firstValue;
    const changePercent = (change / firstValue) * 100;

    return {
      direction: change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'stable',
      value: Math.abs(changePercent),
      isPositive: change > 0,
    };
  }, [data, showTrend]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const values = data.map((d) => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = values[values.length - 1];

    return { mean, min, max, latest };
  }, [data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium mb-2">{data.timestamp}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Valeur:</span>
            <span className="text-sm font-bold" style={{ color }}>
              {data.value.toFixed(2)} {unit}
            </span>
          </div>
          {target && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Cible:</span>
              <span className="text-sm">{target.toFixed(2)} {unit}</span>
            </div>
          )}
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
              title="Graphique Série Temporelle"
              description="Suivi de l'évolution d'une métrique qualité dans le temps avec limites de contrôle."
              items={[
                "Ligne bleue/verte : Valeur mesurée en temps réel",
                "Ligne pointillée rouge : Cible à atteindre",
                "UCL/LCL : Limites de contrôle (seuils d'alerte)",
                "Tendance : Évolution (hausse ↗, baisse ↘, stable →)"
              ]}
              side="left"
            />
          </div>
          {trend && (
            <Badge
              variant={
                trend.direction === 'up'
                  ? trend.isPositive
                    ? 'default'
                    : 'destructive'
                  : trend.direction === 'down'
                  ? trend.isPositive
                    ? 'destructive'
                    : 'default'
                  : 'secondary'
              }
              className="flex items-center gap-1"
            >
              {trend.direction === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend.direction === 'down' && <TrendingDown className="h-3 w-3" />}
              {trend.direction === 'stable' && <Minus className="h-3 w-3" />}
              {trend.direction === 'stable' ? 'Stable' : `${trend.value.toFixed(1)}%`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Statistics Summary */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Actuel</p>
              <p className="text-lg font-bold">{stats.latest.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Moyenne</p>
              <p className="text-lg font-bold">{stats.mean.toFixed(2)}</p>
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
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="timestamp"
              className="text-xs"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
              }}
            />
            <YAxis
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
              className="text-xs"
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {/* Reference lines */}
            {target && (
              <ReferenceLine
                y={target}
                stroke="#10b981"
                strokeDasharray="5 5"
                label={{ value: 'Cible', position: 'right', fontSize: 12 }}
              />
            )}
            {ucl && (
              <ReferenceLine
                y={ucl}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{ value: 'UCL', position: 'right', fontSize: 12 }}
              />
            )}
            {lcl && (
              <ReferenceLine
                y={lcl}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{ value: 'LCL', position: 'right', fontSize: 12 }}
              />
            )}

            {/* Main line */}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name={yAxisLabel}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
