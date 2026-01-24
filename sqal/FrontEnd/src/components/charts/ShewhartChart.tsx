// ============================================================================
// SQAL Frontend - Shewhart Control Chart Component
// Statistical process control chart with UCL/LCL and Cp/Cpk
// ============================================================================

import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { DetailedInfoTooltip } from '@/components/ui/info-tooltip';

interface ShewhartDataPoint {
  index: number;
  value: number;
  timestamp?: string;
  isOutOfControl?: boolean;
}

interface ShewhartChartProps {
  data: ShewhartDataPoint[];
  title: string;
  description?: string;
  yAxisLabel: string;
  unit: string;
  mean: number;
  ucl: number;
  lcl: number;
  cp?: number;
  cpk?: number;
  target?: number;
}

export function ShewhartChart({
  data,
  title,
  description,
  yAxisLabel,
  unit,
  mean,
  ucl,
  lcl,
  cp,
  cpk,
  target,
}: ShewhartChartProps) {
  // Detect out-of-control points
  const processedData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      isOutOfControl: point.value > ucl || point.value < lcl,
    }));
  }, [data, ucl, lcl]);

  // Calculate statistics
  const stats = useMemo(() => {
    const outOfControlCount = processedData.filter((p) => p.isOutOfControl).length;
    const inControlRate = ((data.length - outOfControlCount) / data.length) * 100;
    
    // Process capability classification
    let capability = 'unknown';
    if (cpk !== undefined) {
      if (cpk >= 1.33) capability = 'capable';
      else if (cpk >= 1.0) capability = 'acceptable';
      else capability = 'incapable';
    }

    return {
      outOfControlCount,
      inControlRate,
      capability,
    };
  }, [processedData, data.length, cpk]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium mb-2">Point #{data.index}</p>
        {data.timestamp && (
          <p className="text-xs text-muted-foreground mb-2">{data.timestamp}</p>
        )}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Valeur:</span>
            <span className={`text-sm font-bold ${data.isOutOfControl ? 'text-red-600' : 'text-green-600'}`}>
              {data.value.toFixed(2)} {unit}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Statut:</span>
            <span className={`text-sm ${data.isOutOfControl ? 'text-red-600' : 'text-green-600'}`}>
              {data.isOutOfControl ? 'Hors contrôle' : 'Sous contrôle'}
            </span>
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
              title="Carte de Contrôle Shewhart (SPC)"
              description="Outil de contrôle statistique des processus (Statistical Process Control) pour surveiller la stabilité et la capabilité du processus de production."
              items={[
                "UCL/LCL : Limites de contrôle (±3σ)",
                "Points hors limites : Processus instable",
                "Cp : Capabilité potentielle (≥1.33 = capable)",
                "Cpk : Capabilité réelle avec centrage (≥1.33 = capable)",
                "Cp ≈ Cpk : Processus bien centré"
              ]}
              side="left"
            />
          </div>
          <div className="flex items-center gap-2">
            {stats.capability === 'capable' && (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Capable
              </Badge>
            )}
            {stats.capability === 'acceptable' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Acceptable
              </Badge>
            )}
            {stats.capability === 'incapable' && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Incapable
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Statistics Summary */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Moyenne</p>
            <p className="text-lg font-bold">{mean.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">UCL</p>
            <p className="text-lg font-bold text-red-600">{ucl.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">LCL</p>
            <p className="text-lg font-bold text-red-600">{lcl.toFixed(2)}</p>
          </div>
          {cp !== undefined && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Cp</p>
              <p className="text-lg font-bold">{cp.toFixed(2)}</p>
            </div>
          )}
          {cpk !== undefined && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Cpk</p>
              <p className="text-lg font-bold">{cpk.toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* Control Status */}
        <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted">
          <div className="flex items-center gap-2">
            {stats.outOfControlCount === 0 ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">Process sous contrôle</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium">
                  {stats.outOfControlCount} point(s) hors contrôle
                </span>
              </>
            )}
          </div>
          <Badge variant="outline">
            {stats.inControlRate.toFixed(1)}% sous contrôle
          </Badge>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="index"
              type="number"
              name="Point"
              label={{ value: 'Numéro de point', position: 'insideBottom', offset: -5 }}
              className="text-xs"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              dataKey="value"
              type="number"
              name={yAxisLabel}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
              className="text-xs"
              tick={{ fontSize: 12 }}
              domain={[lcl - (ucl - lcl) * 0.1, ucl + (ucl - lcl) * 0.1]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {/* Reference lines */}
            <ReferenceLine
              y={mean}
              stroke="#3b82f6"
              strokeWidth={2}
              label={{ value: `Moyenne (${mean.toFixed(2)})`, position: 'right', fontSize: 12 }}
            />
            <ReferenceLine
              y={ucl}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ value: `UCL (${ucl.toFixed(2)})`, position: 'right', fontSize: 12 }}
            />
            <ReferenceLine
              y={lcl}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ value: `LCL (${lcl.toFixed(2)})`, position: 'right', fontSize: 12 }}
            />
            {target && (
              <ReferenceLine
                y={target}
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{ value: `Cible (${target.toFixed(2)})`, position: 'right', fontSize: 12 }}
              />
            )}

            {/* Data points */}
            <Scatter name={yAxisLabel} data={processedData} fill="#3b82f6">
              {processedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isOutOfControl ? '#ef4444' : '#3b82f6'}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Process Capability Info */}
        {(cp !== undefined || cpk !== undefined) && (
          <div className="mt-4 p-3 rounded-lg bg-muted">
            <p className="text-sm font-medium mb-2">Capabilité du Process</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {cp !== undefined && (
                <div>
                  <span className="text-muted-foreground">Cp (potentiel): </span>
                  <span className="font-bold">{cp.toFixed(3)}</span>
                </div>
              )}
              {cpk !== undefined && (
                <div>
                  <span className="text-muted-foreground">Cpk (réel): </span>
                  <span className="font-bold">{cpk.toFixed(3)}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.capability === 'capable' && '✓ Process capable (Cpk ≥ 1.33)'}
              {stats.capability === 'acceptable' && '⚠ Process acceptable (1.0 ≤ Cpk < 1.33)'}
              {stats.capability === 'incapable' && '✗ Process incapable (Cpk < 1.0)'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
