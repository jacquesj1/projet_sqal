// ============================================================================
// SQAL Frontend - Process Capability Chart
// Display Cp/Cpk evolution and control charts
// ============================================================================

import { useMemo } from "react";
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
  ComposedChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FusionResult } from "@/types";

interface ProcessCapabilityChartProps {
  data: FusionResult[];
  title?: string;
  description?: string;
}

export function ProcessCapabilityChart({
  data,
  title = "Capabilité Process (Cp/Cpk)",
  description = "Évolution de la capabilité du processus dans le temps",
}: ProcessCapabilityChartProps) {
  
  // Transform data for chart
  const chartData = useMemo(() => {
    return data.map((item, index) => {
      const timestamp = new Date(item.timestamp || item.time || '').toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const cp = item.foie_gras_metrics?.process_cp || 0;
      const cpk = item.foie_gras_metrics?.process_cpk || 0;
      const mean = item.foie_gras_metrics?.process_mean || 0;
      const thickness = item.foie_gras_metrics?.lobe_thickness_mm || 0;

      return {
        timestamp,
        index,
        cp,
        cpk,
        mean,
        thickness,
      };
    }).filter(d => d.cp > 0 || d.cpk > 0).reverse(); // Only valid data, oldest first
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;

    const cpValues = chartData.map(d => d.cp).filter(v => v > 0);
    const cpkValues = chartData.map(d => d.cpk).filter(v => v > 0);

    if (cpValues.length === 0) return null;

    const avgCp = cpValues.reduce((a, b) => a + b, 0) / cpValues.length;
    const avgCpk = cpkValues.reduce((a, b) => a + b, 0) / cpkValues.length;
    const latestCp = cpValues[cpValues.length - 1];
    const latestCpk = cpkValues[cpkValues.length - 1];

    // Process capability classification
    const getCapabilityClass = (cpk: number) => {
      if (cpk >= 2.0) return { label: 'Excellent', color: 'success' };
      if (cpk >= 1.67) return { label: 'Très bon', color: 'success' };
      if (cpk >= 1.33) return { label: 'Bon', color: 'default' };
      if (cpk >= 1.0) return { label: 'Acceptable', color: 'warning' };
      return { label: 'Insuffisant', color: 'destructive' };
    };

    const capability = getCapabilityClass(latestCpk);

    return {
      avgCp,
      avgCpk,
      latestCp,
      latestCpk,
      capability,
      count: cpValues.length,
    };
  }, [chartData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {stats && (
            <Badge variant={stats.capability.color as any}>
              {stats.capability.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Statistics Summary */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-4 text-sm">
            <div>
              <p className="text-muted-foreground">Cp actuel</p>
              <p className="font-semibold text-lg">{stats.latestCp.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cpk actuel</p>
              <p className="font-semibold text-lg">{stats.latestCpk.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cp moyen</p>
              <p className="font-semibold">{stats.avgCp.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cpk moyen</p>
              <p className="font-semibold">{stats.avgCpk.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Échantillons</p>
              <p className="font-semibold">{stats.count}</p>
            </div>
          </div>
        )}

        {/* Cp/Cpk Evolution Chart */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-2">Évolution Cp/Cpk</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                domain={[0, 'auto']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                formatter={(value: number) => value.toFixed(2)}
              />
              <Legend />

              {/* Reference lines for capability thresholds */}
              <ReferenceLine 
                y={1.33} 
                stroke="#10b981" 
                strokeDasharray="3 3"
                label={{ value: 'Bon (1.33)', position: 'right', fontSize: 11 }}
              />
              <ReferenceLine 
                y={1.67} 
                stroke="#3b82f6" 
                strokeDasharray="3 3"
                label={{ value: 'Très bon (1.67)', position: 'right', fontSize: 11 }}
              />

              <Line
                type="monotone"
                dataKey="cp"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Cp (capabilité)"
              />
              <Line
                type="monotone"
                dataKey="cpk"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Cpk (capabilité centrée)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Control Chart (Thickness) */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Carte de Contrôle (Épaisseur)</h4>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ value: 'mm', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                formatter={(value: number) => `${value.toFixed(2)} mm`}
              />
              <Legend />

              {/* Control limits (LSL/USL) */}
              <ReferenceLine 
                y={55} 
                stroke="#ef4444" 
                strokeDasharray="3 3"
                label={{ value: 'LSU (55mm)', position: 'right', fontSize: 11 }}
              />
              <ReferenceLine 
                y={45} 
                stroke="#ef4444" 
                strokeDasharray="3 3"
                label={{ value: 'LSI (45mm)', position: 'right', fontSize: 11 }}
              />

              {/* Mean line */}
              <Line
                type="monotone"
                dataKey="mean"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="Moyenne process"
              />

              {/* Control zone (±3σ) */}
              <Area
                type="monotone"
                dataKey="thickness"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.1}
                name="Épaisseur mesurée"
              />

              {/* Actual measurements */}
              <Line
                type="monotone"
                dataKey="thickness"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Épaisseur mesurée"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Capability Interpretation */}
        {stats && (
          <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
            <p className="font-semibold mb-1">Interprétation</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <strong>Cp = {stats.latestCp.toFixed(2)}</strong> : Capabilité potentielle du processus</li>
              <li>• <strong>Cpk = {stats.latestCpk.toFixed(2)}</strong> : Capabilité réelle (centrée)</li>
              <li>• {stats.latestCp > stats.latestCpk 
                ? "Le processus n'est pas parfaitement centré" 
                : "Le processus est bien centré"}</li>
              <li>• Classification : <strong>{stats.capability.label}</strong></li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
