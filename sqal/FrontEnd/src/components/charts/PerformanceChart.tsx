// ============================================================================
// Performance Chart Component
// Graphique de performance pour suivi des modèles IA
// ============================================================================

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

interface PerformanceData {
  epoch: number;
  trainLoss?: number;
  valLoss?: number;
  trainAccuracy?: number;
  valAccuracy?: number;
}

interface PerformanceChartProps {
  data: PerformanceData[];
  title?: string;
  description?: string;
  height?: number;
  showLoss?: boolean;
  showAccuracy?: boolean;
}

export function PerformanceChart({
  data,
  title = 'Performance d\'Entraînement',
  description,
  height = 300,
  showLoss = true,
  showAccuracy = true,
}: PerformanceChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Graphique de Loss */}
          {showLoss && (
            <div>
              <h4 className="text-sm font-medium mb-2">Loss (Perte)</h4>
              <ResponsiveContainer width="100%" height={height}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="epoch" 
                    label={{ value: 'Époque', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'Loss', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="trainLoss"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Train Loss"
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="valLoss"
                    stroke="#f97316"
                    strokeWidth={2}
                    name="Validation Loss"
                    dot={{ r: 3 }}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Graphique d'Accuracy */}
          {showAccuracy && (
            <div>
              <h4 className="text-sm font-medium mb-2">Précision (Accuracy)</h4>
              <ResponsiveContainer width="100%" height={height}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="epoch" 
                    label={{ value: 'Époque', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }}
                    domain={[0, 100]}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="trainAccuracy"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Train Accuracy"
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="valAccuracy"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Validation Accuracy"
                    dot={{ r: 3 }}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
