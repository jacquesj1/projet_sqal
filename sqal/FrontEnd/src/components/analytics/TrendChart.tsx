// ============================================================================
// SQAL Frontend - Trend Chart Component
// Display metric trends over time with multiple series and filters
// ============================================================================

import { useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FusionResult } from "@/types";

interface TrendChartProps {
  data: FusionResult[];
  metric: string;
  title: string;
  description?: string;
  unit?: string;
  chartType?: "line" | "area";
  showComparison?: boolean;
  referenceValue?: number;
  referenceLine?: { value: number; label: string; color?: string };
  upperLimit?: number;
  lowerLimit?: number;
}

export function TrendChart({
  data,
  metric,
  title,
  description,
  unit = "",
  chartType = "line",
  showComparison = false,
  referenceValue,
  referenceLine,
  upperLimit,
  lowerLimit,
}: TrendChartProps) {
  
  // Transform data for chart
  const chartData = useMemo(() => {
    return data.map((item, index) => {
      const timestamp = new Date(item.timestamp || item.time || '').toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Extract metric value from nested structure
      let value = 0;
      
      // Try different paths based on metric name
      if (metric.startsWith('process_')) {
        value = item.foie_gras_metrics?.[metric] || 0;
      } else if (metric === 'lobe_thickness_mm' || metric === 'estimated_volume_cm3' || 
                 metric === 'dimensional_conformity_score' || metric === 'fill_level_percent') {
        value = item.foie_gras_metrics?.[metric] || 0;
      } else if (metric === 'delta_e' || metric === 'l_star' || metric === 'a_star' || metric === 'b_star') {
        value = item.foie_gras_metrics?.[metric] || 0;
      } else if (metric === 'freshness_index' || metric === 'oxidation_index' || 
                 metric === 'fat_quality_index' || metric === 'color_uniformity') {
        value = item.as7341?.[metric] || 0;
      } else if (metric === 'tof_score' || metric === 'spectral_score' || metric === 'final_score') {
        value = item[metric] || 0;
      }

      return {
        timestamp,
        index,
        value: typeof value === 'number' ? value : 0,
        tofScore: item.tof_score || 0,
        spectralScore: item.spectral_score || 0,
      };
    }).reverse(); // Reverse to show oldest first
  }, [data, metric]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;

    const values = chartData.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = values[values.length - 1];
    
    // Calculate standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    // Calculate trend (simple linear regression slope)
    const n = values.length;
    const sumX = chartData.reduce((sum, _, i) => sum + i, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = chartData.reduce((sum, d, i) => sum + i * d.value, 0);
    const sumX2 = chartData.reduce((sum, _, i) => sum + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const trend = slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable';

    return { mean, min, max, latest, std, trend };
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
            <div className="flex gap-2">
              <Badge variant={
                stats.trend === 'increasing' ? 'default' :
                stats.trend === 'decreasing' ? 'destructive' : 'secondary'
              }>
                {stats.trend === 'increasing' ? '📈' : stats.trend === 'decreasing' ? '📉' : '➡️'} {stats.trend}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Statistics Summary */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-4 text-sm">
            <div>
              <p className="text-muted-foreground">Actuel</p>
              <p className="font-semibold">{stats.latest.toFixed(2)} {unit}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Moyenne</p>
              <p className="font-semibold">{stats.mean.toFixed(2)} {unit}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Min</p>
              <p className="font-semibold">{stats.min.toFixed(2)} {unit}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Max</p>
              <p className="font-semibold">{stats.max.toFixed(2)} {unit}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Écart-type</p>
              <p className="font-semibold">{stats.std.toFixed(2)} {unit}</p>
            </div>
          </div>
        )}

        {/* Chart */}
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'area' ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ value: unit, angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                formatter={(value: number) => [`${value.toFixed(2)} ${unit}`, 'Valeur']}
              />
              <Legend />

              {/* Reference lines */}
              {referenceValue !== undefined && (
                <ReferenceLine 
                  y={referenceValue} 
                  stroke="#888" 
                  strokeDasharray="3 3"
                  label="Référence"
                />
              )}
              {referenceLine && (
                <ReferenceLine 
                  y={referenceLine.value} 
                  stroke={referenceLine.color || "#888"} 
                  strokeDasharray="3 3"
                  label={referenceLine.label}
                />
              )}
              {upperLimit !== undefined && (
                <ReferenceLine 
                  y={upperLimit} 
                  stroke="#ef4444" 
                  strokeDasharray="3 3"
                  label="LSL"
                />
              )}
              {lowerLimit !== undefined && (
                <ReferenceLine 
                  y={lowerLimit} 
                  stroke="#ef4444" 
                  strokeDasharray="3 3"
                  label="LIL"
                />
              )}

              {/* Main data line/area */}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={title}
              />

              {/* Comparison lines (ToF vs Spectral) */}
              {showComparison && (
                <>
                  <Line
                    type="monotone"
                    dataKey="tofScore"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    dot={false}
                    name="Score ToF"
                  />
                  <Line
                    type="monotone"
                    dataKey="spectralScore"
                    stroke="#8b5cf6"
                    strokeWidth={1.5}
                    dot={false}
                    name="Score Spectral"
                  />
                </>
              )}
            </AreaChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ value: unit, angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                formatter={(value: number) => [`${value.toFixed(2)} ${unit}`, 'Valeur']}
              />
              <Legend />

              {/* Reference lines */}
              {referenceValue !== undefined && (
                <ReferenceLine 
                  y={referenceValue} 
                  stroke="#888" 
                  strokeDasharray="3 3"
                  label="Référence"
                />
              )}
              {referenceLine && (
                <ReferenceLine 
                  y={referenceLine.value} 
                  stroke={referenceLine.color || "#888"} 
                  strokeDasharray="3 3"
                  label={referenceLine.label}
                />
              )}
              {upperLimit !== undefined && (
                <ReferenceLine 
                  y={upperLimit} 
                  stroke="#ef4444" 
                  strokeDasharray="3 3"
                  label="LSL"
                />
              )}
              {lowerLimit !== undefined && (
                <ReferenceLine 
                  y={lowerLimit} 
                  stroke="#ef4444" 
                  strokeDasharray="3 3"
                  label="LIL"
                />
              )}

              {/* Main data line/area */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={title}
              />

              {/* Comparison lines (ToF vs Spectral) */}
              {showComparison && (
                <>
                  <Line
                    type="monotone"
                    dataKey="tofScore"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    dot={false}
                    name="Score ToF"
                  />
                  <Line
                    type="monotone"
                    dataKey="spectralScore"
                    stroke="#8b5cf6"
                    strokeWidth={1.5}
                    dot={false}
                    name="Score Spectral"
                  />
                </>
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
