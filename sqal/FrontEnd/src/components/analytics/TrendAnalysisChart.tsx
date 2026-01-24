import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, TrendingUp, TrendingDown, Activity } from 'lucide-react';

// Types
interface TrendDataPoint {
  timestamp: string;
  value: number;
  avg: number;
  min: number;
  max: number;
}

interface TrendAnalysisChartProps {
  deviceId: string;
  className?: string;
}

type MetricType = 'quality_score' | 'volume' | 'freshness' | 'height';
type TimeRange = '1h' | '24h' | '7d' | '30d';
type ChartType = 'line' | 'area' | 'bar';

// Metric configurations (agroalimentaire specific)
const METRICS: Record<
  MetricType,
  {
    label: string;
    unit: string;
    color: string;
    thresholdGood: number;
    thresholdWarning: number;
  }
> = {
  quality_score: {
    label: 'Score Qualité',
    unit: '',
    color: '#10b981', // Green
    thresholdGood: 0.85,
    thresholdWarning: 0.70,
  },
  volume: {
    label: 'Volume',
    unit: 'mm³',
    color: '#3b82f6', // Blue
    thresholdGood: 120,
    thresholdWarning: 100,
  },
  freshness: {
    label: 'Indice Fraîcheur',
    unit: '',
    color: '#8b5cf6', // Purple
    thresholdGood: 0.80,
    thresholdWarning: 0.65,
  },
  height: {
    label: 'Hauteur Moyenne',
    unit: 'mm',
    color: '#f59e0b', // Amber
    thresholdGood: 25,
    thresholdWarning: 20,
  },
};

const TIME_RANGES: Record<TimeRange, string> = {
  '1h': 'Dernière heure',
  '24h': 'Dernières 24h',
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
};

/**
 * TrendAnalysisChart - Professional trend visualization for agro-food quality
 *
 * Features:
 * - Real-time data from API
 * - Multiple chart types (line, area, bar)
 * - Responsive design (mobile-first)
 * - Threshold indicators
 * - Statistical summary
 * - Professional color palette
 */
export const TrendAnalysisChart: React.FC<TrendAnalysisChartProps> = ({
  deviceId,
  className = '',
}) => {
  // State
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricType>('quality_score');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [chartType, setChartType] = useState<ChartType>('line');

  const metricConfig = METRICS[metric];

  // Fetch trend data
  useEffect(() => {
    const fetchTrendData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/analysis/trends/${deviceId}?metric=${metric}&time_range=${timeRange}`
        );

        if (!response.ok) {
          throw new Error('Échec de chargement des données');
        }

        const trendData: TrendDataPoint[] = await response.json();

        // Format timestamps for display
        const formattedData = trendData.map((point) => ({
          ...point,
          displayTime: new Date(point.timestamp).toLocaleString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            day: timeRange === '30d' || timeRange === '7d' ? '2-digit' : undefined,
            month: timeRange === '30d' || timeRange === '7d' ? 'short' : undefined,
          }),
        }));

        setData(formattedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchTrendData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchTrendData, 30000);

    return () => clearInterval(interval);
  }, [deviceId, metric, timeRange]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (data.length === 0) return null;

    const values = data.map((d) => d.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Trend calculation (simple linear regression)
    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const xSum = xValues.reduce((a, b) => a + b, 0);
    const ySum = sum;
    const xySum = xValues.reduce((acc, x, i) => acc + x * values[i], 0);
    const xxSum = xValues.reduce((acc, x) => acc + x * x, 0);
    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);

    return {
      avg,
      min,
      max,
      trend: slope > 0.001 ? 'up' : slope < -0.001 ? 'down' : 'stable',
      trendValue: Math.abs(slope * 100),
    };
  }, [data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="rounded-lg border bg-white p-3 shadow-lg dark:bg-gray-800">
        <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          {data.displayTime}
        </p>
        <div className="space-y-1">
          <p className="text-sm">
            <span className="font-semibold" style={{ color: metricConfig.color }}>
              Valeur:{' '}
            </span>
            {data.value.toFixed(3)} {metricConfig.unit}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Moyenne: {data.avg.toFixed(3)} {metricConfig.unit}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Min: {data.min.toFixed(3)} | Max: {data.max.toFixed(3)}
          </p>
        </div>
      </div>
    );
  };

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    const axisProps = {
      xAxis: (
        <XAxis
          dataKey="displayTime"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-gray-600 dark:text-gray-400"
        />
      ),
      yAxis: (
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-gray-600 dark:text-gray-400"
          label={{
            value: `${metricConfig.label} (${metricConfig.unit})`,
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 12 },
          }}
        />
      ),
      grid: <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />,
      tooltip: <Tooltip content={<CustomTooltip />} />,
      legend: (
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="line"
        />
      ),
    };

    // Reference lines for thresholds
    const thresholds = (
      <>
        <ReferenceLine
          y={metricConfig.thresholdGood}
          stroke="#10b981"
          strokeDasharray="3 3"
          label={{
            value: 'Bon',
            position: 'right',
            fontSize: 10,
          }}
        />
        <ReferenceLine
          y={metricConfig.thresholdWarning}
          stroke="#f59e0b"
          strokeDasharray="3 3"
          label={{
            value: 'Attention',
            position: 'right',
            fontSize: 10,
          }}
        />
      </>
    );

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {axisProps.grid}
            {axisProps.xAxis}
            {axisProps.yAxis}
            {axisProps.tooltip}
            {axisProps.legend}
            {thresholds}
            <Line
              type="monotone"
              dataKey="value"
              stroke={metricConfig.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name={metricConfig.label}
            />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name="Moyenne"
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {axisProps.grid}
            {axisProps.xAxis}
            {axisProps.yAxis}
            {axisProps.tooltip}
            {axisProps.legend}
            {thresholds}
            <Area
              type="monotone"
              dataKey="value"
              stroke={metricConfig.color}
              fill={metricConfig.color}
              fillOpacity={0.3}
              name={metricConfig.label}
            />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name="Moyenne"
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {axisProps.grid}
            {axisProps.xAxis}
            {axisProps.yAxis}
            {axisProps.tooltip}
            {axisProps.legend}
            {thresholds}
            <Bar
              dataKey="value"
              fill={metricConfig.color}
              radius={[4, 4, 0, 0]}
              name={metricConfig.label}
            />
          </BarChart>
        );
    }
  };

  return (
    <Card className={`${className} w-full`}>
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Activity className="h-5 w-5 text-primary" />
              Analyse de Tendance
            </CardTitle>
            <CardDescription className="mt-1 text-sm">
              Évolution {METRICS[metric].label.toLowerCase()} - Device {deviceId}
            </CardDescription>
          </div>

          {/* Statistics Summary */}
          {stats && (
            <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                {stats.trend === 'up' ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : stats.trend === 'down' ? (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                ) : (
                  <Activity className="h-5 w-5 text-gray-600" />
                )}
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">Moyenne</p>
                  <p className="text-sm font-semibold">
                    {stats.avg.toFixed(2)} {metricConfig.unit}
                  </p>
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Amplitude</p>
                <p className="text-sm font-semibold">
                  {stats.min.toFixed(2)} - {stats.max.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Metric Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Métrique:</span>
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricType)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METRICS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Période:</span>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIME_RANGES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chart Type Tabs */}
          <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
            <TabsList className="grid w-full grid-cols-3 sm:w-[240px]">
              <TabsTrigger value="line">Ligne</TabsTrigger>
              <TabsTrigger value="area">Aire</TabsTrigger>
              <TabsTrigger value="bar">Barres</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading State */}
        {loading && (
          <div className="flex h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Chargement des données...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Chart */}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height={400}>
            {renderChart()}
          </ResponsiveContainer>
        )}

        {/* No Data State */}
        {!loading && !error && data.length === 0 && (
          <div className="flex h-[400px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Aucune donnée disponible pour cette période
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
