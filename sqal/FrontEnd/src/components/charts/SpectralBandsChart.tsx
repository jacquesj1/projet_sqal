// ============================================================================
// SQAL Frontend - Spectral Bands Chart Component
// Full spectrum visualization (415nm-NIR) with signature comparison
// ============================================================================

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailedInfoTooltip } from '@/components/ui/info-tooltip';

interface SpectralBand {
  wavelength: string;
  value: number;
  reference?: number;
}

interface SpectralBandsChartProps {
  data: SpectralBand[];
  title: string;
  description?: string;
  spectralProfile?: string;
  showReference?: boolean;
  showRadar?: boolean;
}

export function SpectralBandsChart({
  data,
  title,
  description,
  spectralProfile = 'unknown',
  showReference = false,
  showRadar = true,
}: SpectralBandsChartProps) {
  // Calculate normalized signature and reference
  const normalizedData = useMemo(() => {
    const totalIntensity = data.reduce((sum, band) => sum + band.value, 0);
    const totalReference = data.reduce((sum, band) => sum + (band.reference || 0), 0);
    
    return data.map((band) => ({
      ...band,
      normalized: totalIntensity > 0 ? (band.value / totalIntensity) * 100 : 0,
      normalizedReference: totalReference > 0 ? ((band.reference || 0) / totalReference) * 100 : 0,
    }));
  }, [data]);

  // Calculate spectral ratios
  const ratios = useMemo(() => {
    const red = data.find((b) => b.wavelength.includes('680'))?.value || 0;
    const nir = data.find((b) => b.wavelength.includes('nir') || b.wavelength.includes('850'))?.value || 0;
    const blue = data.find((b) => b.wavelength.includes('480'))?.value || 0;
    const green = data.find((b) => b.wavelength.includes('555'))?.value || 0;

    return {
      redNirRatio: nir > 0 ? red / nir : 0,
      blueRedRatio: red > 0 ? blue / red : 0,
      greenRedRatio: red > 0 ? green / red : 0,
    };
  }, [data]);

  // Get wavelength color
  const getWavelengthColor = (wavelength: string): string => {
    if (wavelength.includes('415') || wavelength.includes('violet')) return '#8b5cf6';
    if (wavelength.includes('445') || wavelength.includes('indigo')) return '#6366f1';
    if (wavelength.includes('480') || wavelength.includes('blue')) return '#3b82f6';
    if (wavelength.includes('515') || wavelength.includes('cyan')) return '#06b6d4';
    if (wavelength.includes('555') || wavelength.includes('green')) return '#10b981';
    if (wavelength.includes('590') || wavelength.includes('yellow')) return '#eab308';
    if (wavelength.includes('630') || wavelength.includes('orange')) return '#f97316';
    if (wavelength.includes('680') || wavelength.includes('red')) return '#ef4444';
    if (wavelength.includes('nir') || wavelength.includes('850')) return '#991b1b';
    return '#6b7280';
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const color = getWavelengthColor(data.wavelength);

    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <p className="text-sm font-medium">{data.wavelength}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Intensité:</span>
            <span className="text-sm font-bold">{data.value.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Normalisé:</span>
            <span className="text-sm font-bold">{data.normalized.toFixed(1)}%</span>
          </div>
          {showReference && data.reference && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Référence:</span>
              <span className="text-sm">{data.reference.toFixed(0)}</span>
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
              title="Analyse Spectrale AS7341"
              description="Signature spectrale 9 bandes (415nm-NIR) pour caractérisation couleur et qualité du foie gras."
              items={[
                "Spectre : Barres d'intensité par longueur d'onde",
                "Normalisé : Signature relative (% du total)",
                "Radar : Comparaison visuelle signature vs référence",
                "Ratios : Bleu/Rouge et Vert/Rouge (indicateurs qualité)"
              ]}
              side="left"
            />
          </div>
          <Badge variant={spectralProfile.includes('extra') ? 'default' : 'secondary'}>
            {spectralProfile.replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Spectral Ratios */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Ratio Rouge/NIR</p>
            <p className="text-lg font-bold">{ratios.redNirRatio.toFixed(2)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Ratio Bleu/Rouge</p>
            <p className="text-lg font-bold">{ratios.blueRedRatio.toFixed(2)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Ratio Vert/Rouge</p>
            <p className="text-lg font-bold">{ratios.greenRedRatio.toFixed(2)}</p>
          </div>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="spectrum" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="spectrum">Spectre</TabsTrigger>
            <TabsTrigger value="normalized">Normalisé</TabsTrigger>
            {showRadar && <TabsTrigger value="radar">Radar</TabsTrigger>}
          </TabsList>

          {/* Spectrum View */}
          <TabsContent value="spectrum" className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={normalizedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="spectralGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="14%" stopColor="#6366f1" />
                    <stop offset="28%" stopColor="#3b82f6" />
                    <stop offset="42%" stopColor="#06b6d4" />
                    <stop offset="56%" stopColor="#10b981" />
                    <stop offset="70%" stopColor="#eab308" />
                    <stop offset="84%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="wavelength"
                  label={{ value: 'Longueur d\'onde', position: 'insideBottom', offset: -5 }}
                  className="text-xs"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  label={{ value: 'Intensité', angle: -90, position: 'insideLeft' }}
                  className="text-xs"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="url(#spectralGradient)"
                  strokeWidth={2}
                  fill="url(#spectralGradient)"
                  fillOpacity={0.3}
                  name="Intensité spectrale"
                />
                {showReference && (
                  <Area
                    type="monotone"
                    dataKey="reference"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="none"
                    name="Référence"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* Normalized View */}
          <TabsContent value="normalized" className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={normalizedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="normalizedGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="14%" stopColor="#6366f1" />
                    <stop offset="28%" stopColor="#3b82f6" />
                    <stop offset="42%" stopColor="#06b6d4" />
                    <stop offset="56%" stopColor="#10b981" />
                    <stop offset="70%" stopColor="#eab308" />
                    <stop offset="84%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="wavelength"
                  label={{ value: 'Longueur d\'onde', position: 'insideBottom', offset: -5 }}
                  className="text-xs"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  label={{ value: 'Contribution (%)', angle: -90, position: 'insideLeft' }}
                  className="text-xs"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="normalized"
                  stroke="url(#normalizedGradient)"
                  strokeWidth={2}
                  fill="url(#normalizedGradient)"
                  fillOpacity={0.3}
                  name="Signature normalisée (%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* Radar View */}
          {showRadar && (
            <TabsContent value="radar" className="mt-4">
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={normalizedData}>
                  <PolarGrid strokeDasharray="3 3" />
                  <PolarAngleAxis 
                    dataKey="wavelength" 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 20]} 
                    tick={{ fontSize: 10 }} 
                    tickCount={5}
                  />
                  {showReference && (
                    <Radar
                      name="Référence"
                      dataKey="normalizedReference"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="#f59e0b"
                      fillOpacity={0.1}
                      strokeDasharray="5 5"
                    />
                  )}
                  <Radar
                    name="Signature spectrale (temps réel)"
                    dataKey="normalized"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="line"
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </TabsContent>
          )}
        </Tabs>

        {/* Spectral Analysis Info */}
        <div className="mt-4 p-3 rounded-lg bg-muted">
          <p className="text-sm font-medium mb-2">Analyse Spectrale</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Profil: </span>
              <span className="font-bold">{spectralProfile.replace(/_/g, ' ')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Bandes: </span>
              <span className="font-bold">{data.length}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {ratios.redNirRatio > 2.0 && '✓ Signature foie gras cru extra (ratio R/NIR > 2.0)'}
            {ratios.redNirRatio > 1.5 && ratios.redNirRatio <= 2.0 && '⚠ Signature foie gras cru standard (1.5 < ratio R/NIR ≤ 2.0)'}
            {ratios.redNirRatio > 1.0 && ratios.redNirRatio <= 1.5 && '⚠ Signature foie gras cuit (1.0 < ratio R/NIR ≤ 1.5)'}
            {ratios.redNirRatio <= 1.0 && '✗ Signature atypique (ratio R/NIR ≤ 1.0)'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
