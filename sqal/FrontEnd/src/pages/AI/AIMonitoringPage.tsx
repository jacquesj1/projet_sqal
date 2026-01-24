// ============================================================================
// AI Monitoring Page
// Surveillance des performances des modèles IA en production
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import type { AIMetrics, AIModelsResponse } from "@/types/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api from "@services/api";
import { Activity, TrendingUp, Zap, AlertCircle } from "lucide-react";

export function AIMonitoringPage() {
  const { data: metrics } = useQuery<AIMetrics>({
    queryKey: ["ai", "metrics"],
    queryFn: () => api.ai.getMetrics(),
    refetchInterval: 10000,
  });

  const { data: models } = useQuery<AIModelsResponse>({
    queryKey: ["ai", "models"],
    queryFn: () => api.ai.getModels(),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitoring IA</h1>
        <p className="text-muted-foreground">
          Surveillance des performances des modèles en production
        </p>
      </div>

      {/* Métriques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Précision Moyenne</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.averageAccuracy ? (metrics.averageAccuracy * 100).toFixed(1) : "0.0"}%
            </div>
            <p className="text-xs text-muted-foreground">
              Tous modèles confondus
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Précision Validation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.averageValAccuracy ? (metrics.averageValAccuracy * 100).toFixed(1) : "0.0"}%
            </div>
            <p className="text-xs text-muted-foreground">
              Sur données de test
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latence Moyenne</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.averageLatency || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Temps d'inférence
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Modèles Actifs</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {models?.models?.filter((m: any) => m.status === "active").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Sur {models?.total || 0} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Meilleur modèle */}
      {metrics?.bestModel && (
        <Card>
          <CardHeader>
            <CardTitle>Meilleur Modèle en Production</CardTitle>
            <CardDescription>Performances optimales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">{metrics.bestModel.type}</p>
                <p className="text-sm text-muted-foreground">
                  Version {metrics.bestModel.version || "N/A"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Précision</p>
                  <p className="text-2xl font-bold text-green-500">
                    {((metrics.bestModel?.accuracy ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <Badge variant="default" className="bg-green-500">
                  Actif
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des modèles */}
      <Card>
        <CardHeader>
          <CardTitle>Modèles Déployés</CardTitle>
          <CardDescription>
            {models?.total || 0} modèle(s) disponible(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {models?.models?.map((model: any) => (
              <div
                key={model.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{model.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Type: {model.type} • Version: {model.version || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Précision</p>
                    <p className="font-bold">
                      {model.accuracy ? (model.accuracy * 100).toFixed(1) : "N/A"}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Taille</p>
                    <p className="font-mono text-sm">
                      {model.size ? (model.size / 1024 / 1024).toFixed(1) : "N/A"} MB
                    </p>
                  </div>
                  <Badge
                    variant={model.status === "active" ? "default" : "secondary"}
                  >
                    {model.status || "unknown"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Graphique de performance */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution des Performances</CardTitle>
          <CardDescription>Historique de précision sur 30 jours</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics?.performanceHistory || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#10b981"
                name="Précision"
              />
              <Line
                type="monotone"
                dataKey="valAccuracy"
                stroke="#3b82f6"
                name="Validation"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
