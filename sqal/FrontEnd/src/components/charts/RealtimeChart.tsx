// ============================================================================
// Realtime Chart Component
// Graphique temps réel pour les données de capteurs
// ============================================================================

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

interface DataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

interface RealtimeChartProps {
  data: DataPoint[];
  title: string;
  description?: string;
  dataKey?: string;
  xAxisKey?: string;
  color?: string;
  height?: number;
  showLegend?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
}

export function RealtimeChart({
  data,
  title,
  description,
  dataKey = 'value',
  xAxisKey = 'timestamp',
  color = '#3b82f6',
  height = 300,
  showLegend = true,
  yAxisLabel,
  xAxisLabel,
}: RealtimeChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={xAxisKey} 
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
            />
            <YAxis 
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
            />
            <Tooltip />
            {showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
