// ============================================================================
// Histogram Chart Component
// Histogramme pour visualisation de distributions
// ============================================================================

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

interface HistogramData {
  bin: string | number;
  count: number;
  color?: string;
}

interface HistogramChartProps {
  data: HistogramData[];
  title: string;
  description?: string;
  height?: number;
  defaultColor?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export function HistogramChart({
  data,
  title,
  description,
  height = 300,
  defaultColor = '#10b981',
  xAxisLabel,
  yAxisLabel,
}: HistogramChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="bin" 
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
            />
            <YAxis 
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
            />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || defaultColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
