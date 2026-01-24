// ============================================================================
// Spectral Chart Component
// Graphique spectral pour données AS7341
// ============================================================================

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

interface SpectralData {
  wavelength: string;
  intensity: number;
  color: string;
}

interface SpectralChartProps {
  data: SpectralData[];
  title?: string;
  description?: string;
  height?: number;
  showGradient?: boolean;
}

export function SpectralChart({
  data,
  title = 'Spectre d\'Absorption',
  description,
  height = 300,
  showGradient = true,
}: SpectralChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data}>
            <defs>
              {showGradient && (
                <linearGradient id="spectralGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="wavelength" 
              label={{ value: 'Longueur d\'onde (nm)', position: 'insideBottom', offset: -5 }}
            />
            <YAxis 
              label={{ value: 'Intensité', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="intensity"
              stroke="#8884d8"
              strokeWidth={2}
              fill={showGradient ? "url(#spectralGradient)" : "#8884d8"}
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Légende des couleurs spectrales */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {data.map((point, index) => (
            <div key={index} className="flex items-center gap-1">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: point.color }}
              />
              <span className="text-xs text-muted-foreground">{point.wavelength}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
