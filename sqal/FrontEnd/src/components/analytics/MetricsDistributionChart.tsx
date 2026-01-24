// ============================================================================
// SQAL Frontend - Metrics Distribution Chart
// Display histograms and statistical distributions
// ============================================================================

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { FusionResult } from "@/types";

interface MetricsDistributionChartProps {
  data: FusionResult[];
  metric: string;
  title: string;
  description?: string;
  unit?: string;
  bins?: number;
}

export function MetricsDistributionChart({
  data,
  metric,
  title,
  description,
  unit = "",
  bins = 10,
}: MetricsDistributionChartProps) {
  
  // Extract values and create histogram
  const { histogramData, stats } = useMemo(() => {
    // Extract metric values
    const values = data.map(item => {
      if (metric.startsWith('process_')) {
        return item.foie_gras_metrics?.[metric] || 0;
      } else if (metric === 'lobe_thickness_mm' || metric === 'estimated_volume_cm3' || 
                 metric === 'dimensional_conformity_score' || metric === 'fill_level_percent') {
        return item.foie_gras_metrics?.[metric] || 0;
      } else if (metric === 'delta_e' || metric === 'l_star') {
        return item.foie_gras_metrics?.[metric] || 0;
      } else if (metric === 'freshness_index' || metric === 'oxidation_index' || 
                 metric === 'fat_quality_index' || metric === 'color_uniformity') {
        return item.as7341?.[metric] || 0;
      } else if (metric === 'tof_score' || metric === 'spectral_score' || metric === 'final_score') {
        return item[metric] || 0;
      }
      return 0;
    }).filter(v => v > 0);

    if (values.length === 0) {
      return { histogramData: [], stats: null };
    }

    // Calculate statistics
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    
    // Calculate median
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    // Create histogram bins
    const binWidth = (max - min) / bins;
    const histogram = Array.from({ length: bins }, (_, i) => ({
      range: `${(min + i * binWidth).toFixed(1)}-${(min + (i + 1) * binWidth).toFixed(1)}`,
      count: 0,
      binStart: min + i * binWidth,
      binEnd: min + (i + 1) * binWidth,
    }));

    // Fill histogram
    values.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
      if (binIndex >= 0 && binIndex < bins) {
        histogram[binIndex].count++;
      }
    });

    return {
      histogramData: histogram,
      stats: { mean, median, min, max, std, count: values.length },
    };
  }, [data, metric, bins]);

  // Color bins based on value
  const getBarColor = (binStart: number, binEnd: number) => {
    const midpoint = (binStart + binEnd) / 2;
    
    // For scores (0-1 range)
    if (metric.includes('score') || metric.includes('index')) {
      if (midpoint >= 0.85) return '#10b981'; // green
      if (midpoint >= 0.75) return '#3b82f6'; // blue
      if (midpoint >= 0.60) return '#f59e0b'; // orange
      return '#ef4444'; // red
    }
    
    // Default gradient
    return '#3b82f6';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {/* Statistics Summary */}
        {stats && (
          <div className="grid grid-cols-6 gap-4 mb-4 text-sm">
            <div>
              <p className="text-muted-foreground">Échantillons</p>
              <p className="font-semibold">{stats.count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Moyenne</p>
              <p className="font-semibold">{stats.mean.toFixed(2)} {unit}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Médiane</p>
              <p className="font-semibold">{stats.median.toFixed(2)} {unit}</p>
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

        {/* Histogram */}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={histogramData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="range" 
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              label={{ value: 'Fréquence', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              formatter={(value: number) => [`${value} échantillons`, 'Fréquence']}
            />
            <Legend />
            <Bar 
              dataKey="count" 
              name="Fréquence"
              radius={[4, 4, 0, 0]}
            >
              {histogramData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getBarColor(entry.binStart, entry.binEnd)} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
