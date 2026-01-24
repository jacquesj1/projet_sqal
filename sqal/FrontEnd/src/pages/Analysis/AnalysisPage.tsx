// ============================================================================
// Analysis Page - Analyse Temps Réel
// Page principale d'analyse avec capteurs ToF et Spectral
// ============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Badge } from "@components/ui/badge";
import { VL53L8CHViewer } from "@components/sensors/VL53L8CHViewer";
import { AS7341Viewer } from "@components/sensors/AS7341Viewer";
import { useRealtimeStore } from "@stores/realtimeStore";
import api from "@services/api";
import { Activity, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { AnalysisHistoryResponse } from "@/types/api";

export function AnalysisPage() {
  const { latestFusion, latestVL53L8CH, latestAS7341, isConnected } = useRealtimeStore();
  const [selectedTab, setSelectedTab] = useState("realtime");

  // Récupérer les dernières analyses
  const { data: recentAnalyses } = useQuery<AnalysisHistoryResponse>({
    queryKey: ["analysis", "recent"],
    queryFn: () => api.analysis.getHistory({ limit: 10 }),
    refetchInterval: 5000,
  });

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A+":
        return "bg-green-500";
      case "A":
        return "bg-green-400";
      case "B":
        return "bg-yellow-500";
      case "C":
        return "bg-orange-500";
      case "REJECT":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getGradeIcon = (grade: string) => {
    switch (grade) {
      case "A+":
      case "A":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "B":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "C":
      case "REJECT":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analyse Temps Réel</h1>
          <p className="text-muted-foreground">
            Capteurs ToF + Spectral • Fusion IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="text-sm font-medium">
            {isConnected ? "Temps Réel Actif" : "Déconnecté"}
          </span>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="realtime">Temps Réel</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="statistics">Statistiques</TabsTrigger>
        </TabsList>

        {/* Onglet Temps Réel */}
        <TabsContent value="realtime" className="space-y-6">
          {/* Résultat de fusion actuel */}
          {latestFusion && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Résultat de Fusion</span>
                  <div className="flex items-center gap-2">
                    {getGradeIcon(latestFusion.final_grade || 'N/A')}
                    <Badge className={getGradeColor(latestFusion.final_grade || 'N/A')}>
                      Grade {latestFusion.final_grade || 'N/A'}
                    </Badge>
                  </div>
                </CardTitle>
                <CardDescription>
                  Échantillon: {latestFusion.id} • Score: {((latestFusion.final_score ?? 0) * 100).toFixed(1)}%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Score ToF</p>
                    <p className="text-2xl font-bold">
                      {latestFusion.vl53l8ch_grade || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Score Spectral</p>
                    <p className="text-2xl font-bold">
                      {latestFusion.as7341_grade || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Défauts</p>
                    <p className="text-2xl font-bold text-red-500">
                      {latestFusion.num_defects || 0}
                    </p>
                  </div>
                </div>

                {latestFusion.defects && latestFusion.defects.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Défauts détectés:</p>
                    <div className="flex flex-wrap gap-2">
                      {latestFusion.defects.map((defect: string, index: number) => (
                        <Badge key={index} variant="destructive">
                          {defect}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Visualisations capteurs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VL53L8CHViewer
              data={latestVL53L8CH as any}
              isLoading={!isConnected}
            />
            <AS7341Viewer
              data={latestAS7341 as any}
              isLoading={!isConnected}
            />
          </div>
        </TabsContent>

        {/* Onglet Historique */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dernières Analyses</CardTitle>
              <CardDescription>
                {recentAnalyses?.analyses?.length || 0} analyses récentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentAnalyses?.analyses?.map((analysis: any) => (
                  <div
                    key={analysis.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      {getGradeIcon(analysis.grade)}
                      <div>
                        <p className="font-medium">{analysis.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(analysis.time).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">
                          {(analysis.qualityScore * 100).toFixed(1)}%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {analysis.numDefects} défaut(s)
                        </p>
                      </div>
                      <Badge className={getGradeColor(analysis.grade)}>
                        {analysis.grade}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Statistiques */}
        <TabsContent value="statistics">
          <Card>
            <CardHeader>
              <CardTitle>Statistiques d'Analyse</CardTitle>
              <CardDescription>Vue d'ensemble des performances</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Statistiques détaillées à venir...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
