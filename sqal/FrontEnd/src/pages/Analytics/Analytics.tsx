// ============================================================================
// SQAL Frontend - Analytics Page
// Detailed statistics, trends, and advanced analysis
// ============================================================================

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Badge } from "@components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, PieChart, Calendar, Activity } from "lucide-react";
import { api } from "@services/api";
import { formatNumber, formatPercentage } from "@/utils/formatters";
import { useRealtimeStore } from "@stores/realtimeStore";
import { TrendChart } from "@/components/analytics/TrendChart";
import { MetricsDistributionChart } from "@/components/analytics/MetricsDistributionChart";
import { ProcessCapabilityChart } from "@/components/analytics/ProcessCapabilityChart";
import type { DashboardMetrics } from "@/types/api";

export default function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<"day" | "week" | "month">("week");
  const [activeTab, setActiveTab] = useState("overview");

  // Get realtime data from store
  const { fusionHistory } = useRealtimeStore();

  // Fetch dashboard metrics
  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const response = await api.dashboard.getMetrics();
      return response;
    },
    refetchInterval: 30000,
  });

  // Calculate grade distribution percentages
  const gradeDistribution = useMemo(() => {
    if (!metrics?.gradeDistribution) return [];
    
    const total = Object.values(metrics.gradeDistribution).reduce((sum: number, count: number) => sum + count, 0);
    
    return Object.entries(metrics.gradeDistribution).map(([grade, count]: [string, number]) => ({
      grade,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      color: getGradeColor(grade),
    }));
  }, [metrics]);

  // Calculate trends
  const trends = useMemo(() => {
    if (!metrics) return null;
    
    const todayCount = metrics.samplesToday || 0;
    const weekCount = (metrics.totalSamples || 0) / 7; // Estimation
    const monthCount = (metrics.totalSamples || 0) / 30; // Estimation
    
    // Estimate daily average
    const dailyAverage = weekCount;
    const todayVsAverage = todayCount - dailyAverage;
    const todayTrend = todayVsAverage > 0 ? "up" : todayVsAverage < 0 ? "down" : "stable";
    const todayTrendPercent = dailyAverage > 0 ? (todayVsAverage / dailyAverage) * 100 : 0;
    
    return {
      today: {
        count: todayCount,
        trend: todayTrend,
        change: todayTrendPercent,
      },
      week: {
        count: weekCount,
        dailyAverage,
      },
      month: {
        count: monthCount,
        dailyAverage: monthCount / 30,
      },
    };
  }, [metrics]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">📈 Analytics</h1>
          <p className="text-muted-foreground">
            Statistiques détaillées et analyse des tendances
          </p>
        </div>
        
        {/* Period Selector */}
        <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
          <TabsList>
            <TabsTrigger value="day">Jour</TabsTrigger>
            <TabsTrigger value="week">Semaine</TabsTrigger>
            <TabsTrigger value="month">Mois</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">📊 Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="trends">📈 Tendances</TabsTrigger>
          <TabsTrigger value="distributions">📊 Distributions</TabsTrigger>
          <TabsTrigger value="process">🎯 Process</TabsTrigger>
          <TabsTrigger value="comparison">🔄 Comparaisons</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Key Metrics with Trends */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Samples */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Échantillons</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(metrics?.totalSamples || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Depuis le début
                </p>
              </CardContent>
            </Card>

            {/* Today's Samples */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aujourd'hui</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(trends?.today.count || 0)}</div>
                {trends && trends.today.trend !== "stable" && (
                  <p className="text-xs flex items-center gap-1 mt-1">
                    {trends.today.trend === "up" ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={trends.today.trend === "up" ? "text-green-500" : "text-red-500"}>
                      {Math.abs(trends.today.change).toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">vs moyenne</span>
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Conformity Rate */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taux de Conformité</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercentage((metrics?.successRate || 0) / 100)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Échantillons conformes
                </p>
              </CardContent>
            </Card>

            {/* Average Quality */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Qualité Moyenne</CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercentage((metrics?.averageQuality || 0) / 100)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Score global
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Distribution des Grades</CardTitle>
              <CardDescription>Répartition des échantillons par grade de qualité</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {gradeDistribution.map((item) => (
                  <div key={item.grade} className="flex items-center gap-4">
                    <Badge variant={item.color as "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "error" | "info"} className="w-16 justify-center">
                      {item.grade}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{item.count} échantillons</span>
                        <span className="text-sm text-muted-foreground">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: `var(--${item.color})`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TrendChart
              data={fusionHistory}
              metric="lobe_thickness_mm"
              title="Évolution de l'épaisseur"
              description="Épaisseur du lobe de foie gras dans le temps"
              unit="mm"
              chartType="line"
              lowerLimit={45}
              upperLimit={55}
            />
            <TrendChart
              data={fusionHistory}
              metric="delta_e"
              title="Évolution Delta E"
              description="Écart colorimétrique par rapport à la référence"
              unit=""
              chartType="area"
              referenceValue={5}
            />
            <TrendChart
              data={fusionHistory}
              metric="freshness_index"
              title="Indice de Fraîcheur"
              description="Évolution de la fraîcheur dans le temps"
              unit=""
              chartType="area"
            />
            <TrendChart
              data={fusionHistory}
              metric="final_score"
              title="Score Final"
              description="Score de qualité global"
              unit=""
              chartType="line"
              showComparison={true}
            />
          </div>
        </TabsContent>

        {/* Distributions Tab */}
        <TabsContent value="distributions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricsDistributionChart
              data={fusionHistory}
              metric="lobe_thickness_mm"
              title="Distribution de l'épaisseur"
              description="Histogramme des épaisseurs mesurées"
              unit="mm"
              bins={12}
            />
            <MetricsDistributionChart
              data={fusionHistory}
              metric="delta_e"
              title="Distribution Delta E"
              description="Histogramme des écarts colorimétriques"
              unit=""
              bins={10}
            />
            <MetricsDistributionChart
              data={fusionHistory}
              metric="tof_score"
              title="Distribution Score ToF"
              description="Histogramme des scores ToF"
              unit=""
              bins={10}
            />
            <MetricsDistributionChart
              data={fusionHistory}
              metric="spectral_score"
              title="Distribution Score Spectral"
              description="Histogramme des scores spectraux"
              unit=""
              bins={10}
            />
          </div>
        </TabsContent>

        {/* Process Capability Tab */}
        <TabsContent value="process" className="space-y-4">
          <ProcessCapabilityChart data={fusionHistory} />
          
          <div className="grid gap-4 md:grid-cols-2">
            <TrendChart
              data={fusionHistory}
              metric="process_cp"
              title="Évolution Cp"
              description="Capabilité potentielle du processus"
              unit=""
              chartType="line"
              referenceLine={{ value: 1.33, label: 'Bon', color: '#10b981' }}
            />
            <TrendChart
              data={fusionHistory}
              metric="process_cpk"
              title="Évolution Cpk"
              description="Capabilité réelle (centrée)"
              unit=""
              chartType="line"
              referenceLine={{ value: 1.33, label: 'Bon', color: '#10b981' }}
            />
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comparaison ToF vs Spectral</CardTitle>
              <CardDescription>Analyse comparative des scores par capteur</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={fusionHistory}
                metric="final_score"
                title="Scores comparés"
                description="Évolution des scores ToF et Spectral"
                unit=""
                chartType="line"
                showComparison={true}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <MetricsDistributionChart
              data={fusionHistory}
              metric="dimensional_conformity_score"
              title="Uniformité ToF"
              description="Distribution du score de conformité dimensionnelle"
              unit=""
              bins={10}
            />
            <MetricsDistributionChart
              data={fusionHistory}
              metric="color_uniformity"
              title="Uniformité Couleur"
              description="Distribution de l'uniformité colorimétrique"
              unit=""
              bins={10}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function to get grade color
function getGradeColor(grade: string): string {
  switch (grade) {
    case "A+": return "success";
    case "A": return "default";
    case "B": return "warning";
    case "C": return "warning";
    case "REJECT": return "destructive";
    default: return "secondary";
  }
}
