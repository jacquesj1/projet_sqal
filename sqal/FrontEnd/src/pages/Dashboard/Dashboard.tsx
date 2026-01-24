// ============================================================================
// SQAL Frontend - Dashboard Page
// Real-time monitoring dashboard with metrics and visualizations
// ============================================================================

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, TrendingUp, TrendingDown, XCircle, CheckCircle } from "lucide-react";
import { FoieGrasMetrics } from "@/components/dashboard/FoieGrasMetrics";
import { FoieGrasAlerts } from "@/components/dashboard/FoieGrasAlerts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { ShewhartChart } from "@/components/charts/ShewhartChart";
import { DistributionChart } from "@/components/charts/DistributionChart";
import { SpectralBandsChart } from "@/components/charts/SpectralBandsChart";
import { Badge } from "@components/ui/badge";
import { InfoTooltip, DetailedInfoTooltip } from "@/components/ui/info-tooltip";
import { useRealtimeStore } from "@stores/realtimeStore";
import { api } from "@services/api";
import { formatNumber, formatPercentage } from "@/utils/formatters";
import { SensorDetailModal } from "@/components/sensors/SensorDetailModal";
import type { DashboardMetrics } from "@/types/api";

export function Dashboard() {
  const {
    latestFusion,
    latestAS7341,
    fusionHistory,
    conformityRate,
    isConnected,
  } = useRealtimeStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSensorType, setModalSensorType] = useState<"tof" | "spectral" | "fusion">("fusion");

  // Fetch total samples count from database
  const { data: dbMetrics } = useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const response = await api.get<DashboardMetrics>("/api/sqal/dashboard/overview");
      return response;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache (was cacheTime in v4)
  });

  // Calculate active alerts from latest fusion data
  const activeAlerts = useMemo(() => {
    if (!latestFusion?.foie_gras_metrics) return 0;
    
    const metrics = latestFusion.foie_gras_metrics;
    let count = 0;
    
    // Alerte 1: Déviation couleur critique (Delta E > 8.0)
    if (metrics.has_critical_color_deviation) count++;
    
    // Alerte 2: Sous-remplissage (|fill_deviation_mm| > 5.0)
    if (metrics.has_underfill) count++;
    
    // Alerte 3: Tendance oxydation (oxidation_severity > 0.4)
    if (metrics.has_oxidation_trend) count++;
    
    // Alerte 4: Grade REJECT ou C (non-conformité)
    if (!metrics.is_compliant) count++;
    
    // Alerte 5: Défauts critiques détectés
    if (metrics.defect_rate_percent && metrics.defect_rate_percent > 0) count++;
    
    return count;
  }, [latestFusion]);

  // Memoize spectral data to ensure it updates when latestAS7341 changes
  const spectralData = useMemo(() => {
    if (!latestAS7341?.channels) {
      return [
        { wavelength: '415nm (Violet)', value: 1250, reference: 1200 },
        { wavelength: '445nm (Indigo)', value: 1580, reference: 1500 },
        { wavelength: '480nm (Bleu)', value: 2100, reference: 2000 },
        { wavelength: '515nm (Cyan)', value: 2450, reference: 2400 },
        { wavelength: '555nm (Vert)', value: 3200, reference: 3100 },
        { wavelength: '590nm (Jaune)', value: 3800, reference: 3700 },
        { wavelength: '630nm (Orange)', value: 4200, reference: 4100 },
        { wavelength: '680nm (Rouge)', value: 3900, reference: 3800 },
        { wavelength: 'NIR (850nm)', value: 2800, reference: 2700 },
      ];
    }
    
    return [
      { wavelength: '415nm (Violet)', value: latestAS7341.channels.F1_415nm || 1250, reference: 1200 },
      { wavelength: '445nm (Indigo)', value: latestAS7341.channels.F2_445nm || 1580, reference: 1500 },
      { wavelength: '480nm (Bleu)', value: latestAS7341.channels.F3_480nm || 2100, reference: 2000 },
      { wavelength: '515nm (Cyan)', value: latestAS7341.channels.F4_515nm || 2450, reference: 2400 },
      { wavelength: '555nm (Vert)', value: latestAS7341.channels.F5_555nm || 3200, reference: 3100 },
      { wavelength: '590nm (Jaune)', value: latestAS7341.channels.F6_590nm || 3800, reference: 3700 },
      { wavelength: '630nm (Orange)', value: latestAS7341.channels.F7_630nm || 4200, reference: 4100 },
      { wavelength: '680nm (Rouge)', value: latestAS7341.channels.F8_680nm || 3900, reference: 3800 },
      { wavelength: 'NIR (850nm)', value: latestAS7341.channels.NIR || 2800, reference: 2700 },
    ];
  }, [latestAS7341]);

  // Fetch dashboard metrics
  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ["dashboard", "metrics"],
    queryFn: () => api.dashboard.getMetrics() as Promise<DashboardMetrics>,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Surveillance en temps réel de la qualité alimentaire
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

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Samples Processed - Period Statistics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">📊 Échantillons Analysés</CardTitle>
              <InfoTooltip
                content="Statistiques d'échantillons analysés par période : aujourd'hui (depuis 00:00), cette semaine (7 derniers jours), ce mois (30 derniers jours), et total historique en base de données."
                side="right"
              />
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Today */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">📅 Aujourd'hui</span>
              <span className="text-sm font-bold">{formatNumber(dbMetrics?.samplesToday || 0, 0)}</span>
            </div>
            <div className="border-t border-border/50" />
            
            {/* Week */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">📆 Cette semaine</span>
              <span className="text-sm font-bold">{formatNumber((dbMetrics?.totalSamples || 0) / 7, 0)}</span>
            </div>
            <div className="border-t border-border/50" />
            
            {/* Month */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">🗓️ Ce mois</span>
              <span className="text-sm font-bold">{formatNumber((dbMetrics?.totalSamples || 0) / 30, 0)}</span>
            </div>
            <div className="border-t border-border/50" />
            
            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">🗄️ Total (historique)</span>
              <span className="text-sm font-bold text-primary">{formatNumber(dbMetrics?.totalSamples || 0, 0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Conformity Rate (Success Rate) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Taux de Conformité</CardTitle>
              <DetailedInfoTooltip
                title="Taux de Conformité"
                description="Pourcentage d'échantillons conformes aux standards qualité (grade A+, A ou B)."
                items={[
                  "≥ 90% : Excellente conformité",
                  "≥ 75% : Bonne conformité",
                  "< 75% : À surveiller - amélioration nécessaire"
                ]}
                side="right"
              />
            </div>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics?.successRate || conformityRate || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {(metrics?.successRate || 0) >= 90 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">Excellent</span>
                </>
              ) : (metrics?.successRate || 0) >= 75 ? (
                <>
                  <Activity className="h-3 w-3 text-blue-600" />
                  <span className="text-blue-600">Bon</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-orange-600" />
                  <span className="text-orange-600">À surveiller</span>
                </>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Average Quality Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Qualité Moyenne</CardTitle>
              <DetailedInfoTooltip
                title="Score Qualité Moyen"
                description="Score moyen de qualité calculé à partir de la fusion des données ToF (60%) et spectrales (40%)."
                items={[
                  "≥ 80% : Excellente qualité",
                  "≥ 60% : Bonne qualité",
                  "< 60% : Qualité à améliorer"
                ]}
                side="right"
              />
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestFusion?.final_score 
                ? formatPercentage(latestFusion.final_score * 100, 0)
                : formatPercentage((metrics?.averageQuality || 0) * 100, 0)}
            </div>
            {latestFusion?.tof_score !== undefined && latestFusion?.spectral_score !== undefined ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">ToF (60%)</span>
                  <Badge variant="outline" className="text-xs">
                    {formatPercentage((latestFusion.tof_score || 0) * 100, 0)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Spectral (40%)</span>
                  <Badge variant="outline" className="text-xs">
                    {formatPercentage((latestFusion.spectral_score || 0) * 100, 0)}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {(metrics?.averageQuality || 0) >= 0.8 ? (
                  <>
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">Excellente</span>
                  </>
                ) : (metrics?.averageQuality || 0) >= 0.6 ? (
                  <>
                    <Activity className="h-3 w-3 text-blue-600" />
                    <span className="text-blue-600">Bonne</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3 text-orange-600" />
                    <span className="text-orange-600">À améliorer</span>
                  </>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Alertes Actives</CardTitle>
              <InfoTooltip
                content="Nombre d'alertes qualité actives détectées par le système (défauts critiques, non-conformités, déviations hors limites). Une alerte nécessite une action corrective immédiate."
                side="right"
              />
            </div>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(activeAlerts, 0)}
            </div>
            {activeAlerts === 0 ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span className="text-green-600">Aucune alerte</span>
              </p>
            ) : (
              <div className="mt-2 space-y-1">
                {latestFusion?.foie_gras_metrics?.has_critical_color_deviation && (
                  <Badge variant="destructive" className="text-xs mr-1">
                    🎨 Couleur
                  </Badge>
                )}
                {latestFusion?.foie_gras_metrics?.has_underfill && (
                  <Badge variant="destructive" className="text-xs mr-1">
                    📦 Remplissage
                  </Badge>
                )}
                {latestFusion?.foie_gras_metrics?.has_oxidation_trend && (
                  <Badge variant="outline" className="text-xs mr-1 border-orange-500 text-orange-600">
                    🟤 Oxydation
                  </Badge>
                )}
                {latestFusion?.foie_gras_metrics && !latestFusion.foie_gras_metrics.is_compliant && (
                  <Badge variant="destructive" className="text-xs mr-1">
                    ⚠️ Non-conforme
                  </Badge>
                )}
                {latestFusion?.foie_gras_metrics?.defect_rate_percent && latestFusion.foie_gras_metrics.defect_rate_percent > 0 && (
                  <Badge variant="destructive" className="text-xs mr-1">
                    🔴 Défauts
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Latest Analysis Result - Enhanced */}
      {!latestFusion && (
        <Card>
          <CardHeader>
            <CardTitle>Dernière Analyse Temps Réel</CardTitle>
            <CardDescription>En attente de données...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="text-center space-y-2">
                <div className="animate-pulse">⏳</div>
                <p className="text-sm">
                  {isConnected 
                    ? "Connexion active • En attente de la première mesure" 
                    : "Déconnecté • Vérifiez la connexion WebSocket"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {latestFusion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Dernière Analyse Temps Réel</span>
              <Badge
                variant={
                  latestFusion.final_grade === "A+" || latestFusion.final_grade === "A"
                    ? "default"
                    : latestFusion.final_grade === "B"
                    ? "secondary"
                    : latestFusion.final_grade === "C"
                    ? "outline"
                    : "destructive"
                }
                className="text-lg font-bold px-4 py-1"
              >
                {latestFusion.final_grade}
              </Badge>
            </CardTitle>
            <CardDescription>
              Résultat de fusion ToF + Spectral • Mise à jour en temps réel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Metrics */}
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID Échantillon</p>
                <p className="text-lg font-bold">{latestFusion.sample_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Score Qualité Global</p>
                <p className="text-lg font-bold text-green-600">
                  {formatPercentage((latestFusion.final_score || 0) * 100, 1)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Défauts Détectés</p>
                <p className="text-lg font-bold">
                  {latestFusion.num_defects || 0}
                  {latestFusion.defects && Array.isArray(latestFusion.defects) && latestFusion.defects.length > 0 && (() => {
                    // Compter les occurrences de chaque type de défaut
                    const defectCounts = latestFusion.defects.reduce((acc: Record<string, number>, defect: string) => {
                      acc[defect] = (acc[defect] || 0) + 1;
                      return acc;
                    }, {});
                    
                    // Formater l'affichage : "3× foreign_body, 2× cavité"
                    const defectSummary = Object.entries(defectCounts)
                      .map(([type, count]) => count > 1 ? `${count}× ${type}` : type)
                      .join(", ");
                    
                    return (
                      <span className="text-sm text-muted-foreground ml-2">
                        ({defectSummary})
                      </span>
                    );
                  })()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                <p className="text-sm font-mono">
                  {new Date().toLocaleTimeString('fr-FR')}
                </p>
              </div>
            </div>

            {/* Detailed Scores */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Scores Détaillés par Capteur</h4>
              <div className="grid gap-4 md:grid-cols-2">
                {/* VL53L8CH Score - Enhanced */}
                <div 
                  className="space-y-3 p-3 rounded-lg border bg-blue-50/50 cursor-pointer hover:bg-blue-100/50 transition-colors"
                  onClick={() => {
                    setModalSensorType("tof");
                    setModalOpen(true);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setModalSensorType("tof");
                      setModalOpen(true);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-blue-900">🔷 ToF VL53L8CH</span>
                    <Badge 
                      variant={
                        (latestFusion.tof_score || 0) >= 0.85 ? "success" :
                        (latestFusion.tof_score || 0) >= 0.75 ? "default" :
                        (latestFusion.tof_score || 0) >= 0.60 ? "warning" : "error"
                      }
                      className="font-mono"
                    >
                      {latestFusion.vl53l8ch_grade || 
                       (latestFusion.tof_score && latestFusion.tof_score >= 0.85 ? 'A+' :
                        latestFusion.tof_score && latestFusion.tof_score >= 0.75 ? 'A' :
                        latestFusion.tof_score && latestFusion.tof_score >= 0.60 ? 'B' :
                        latestFusion.tof_score && latestFusion.tof_score >= 0.45 ? 'C' : 'REJECT') || 'N/A'}
                    </Badge>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${((latestFusion.vl53l8ch_score || latestFusion.tof_score || 0) * 100)}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {formatPercentage((latestFusion.vl53l8ch_score || latestFusion.tof_score || 0) * 100, 0)}
                    </span>
                  </div>

                  {/* Detailed metrics */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">📏 Dimension</span>
                      <span className="font-medium">
                        {latestFusion.foie_gras_metrics?.lobe_thickness_mm?.toFixed(1) || '--'} mm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">📦 Volume</span>
                      <span className="font-medium">
                        {latestFusion.foie_gras_metrics?.estimated_volume_cm3?.toFixed(0) || '--'} cm³
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">📊 Uniformité</span>
                      <span className="font-medium">
                        {latestFusion.foie_gras_metrics?.dimensional_conformity_percent 
                          ? `${(latestFusion.foie_gras_metrics.dimensional_conformity_percent * 100).toFixed(0)}%`
                          : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">📍 Remplissage</span>
                      <span className="font-medium">
                        {latestFusion.foie_gras_metrics?.fill_level_percent?.toFixed(0) || '--'}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* AS7341 Score - Enhanced */}
                <div 
                  className="space-y-3 p-3 rounded-lg border bg-purple-50/50 cursor-pointer hover:bg-purple-100/50 transition-colors"
                  onClick={() => {
                    setModalSensorType("spectral");
                    setModalOpen(true);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setModalSensorType("spectral");
                      setModalOpen(true);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-purple-900">🌈 Spectral AS7341</span>
                    <Badge 
                      variant={
                        (latestFusion.spectral_score || 0) >= 0.85 ? "success" :
                        (latestFusion.spectral_score || 0) >= 0.75 ? "default" :
                        (latestFusion.spectral_score || 0) >= 0.60 ? "warning" : "error"
                      }
                      className="font-mono"
                    >
                      {latestFusion.as7341_grade || 
                       (latestFusion.spectral_score && latestFusion.spectral_score >= 0.85 ? 'A+' :
                        latestFusion.spectral_score && latestFusion.spectral_score >= 0.75 ? 'A' :
                        latestFusion.spectral_score && latestFusion.spectral_score >= 0.60 ? 'B' :
                        latestFusion.spectral_score && latestFusion.spectral_score >= 0.45 ? 'C' : 'REJECT') || 'N/A'}
                    </Badge>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${((latestFusion.as7341_score || latestFusion.spectral_score || 0) * 100)}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {formatPercentage((latestFusion.as7341_score || latestFusion.spectral_score || 0) * 100, 0)}
                    </span>
                  </div>

                  {/* Detailed metrics */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">🎨 Couleur (ΔE)</span>
                      <span className="font-medium">
                        {latestFusion.foie_gras_metrics?.delta_e?.toFixed(2) || '--'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">💡 Luminosité (L*)</span>
                      <span className="font-medium">
                        {latestFusion.foie_gras_metrics?.l_star?.toFixed(1) || '--'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">✨ Fraîcheur</span>
                      <span className="font-medium">
                        {latestFusion.as7341?.freshness_index !== undefined
                          ? `${(latestFusion.as7341.freshness_index * 100).toFixed(0)}%`
                          : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">🟤 Oxydation</span>
                      <span className="font-medium">
                        {latestFusion.foie_gras_metrics?.oxidation_severity !== undefined
                          ? `${(latestFusion.foie_gras_metrics.oxidation_severity * 100).toFixed(0)}%`
                          : '--'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grade Explanation */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Interprétation de la Note</h4>
              <p className="text-sm text-muted-foreground">
                {latestFusion.final_grade === "A+" && "Qualité Premium - Produit d'excellence sans défaut majeur"}
                {latestFusion.final_grade === "A" && "Très Bonne Qualité - Produit conforme aux standards élevés"}
                {latestFusion.final_grade === "B" && "Qualité Acceptable - Produit conforme avec quelques imperfections mineures"}
                {latestFusion.final_grade === "C" && "Qualité Faible - Produit limite, nécessite une attention particulière"}
                {latestFusion.final_grade === "REJECT" && "Non Conforme - Produit rejeté, défauts critiques détectés"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Foie Gras Metrics Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Métriques Qualité Foie Gras</h2>
        </div>
        
        {/* Foie Gras KPIs */}
        <FoieGrasMetrics />
        
        {/* Foie Gras Alerts */}
        <FoieGrasAlerts />
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="realtime" className="space-y-4">
        <TabsList>
          <TabsTrigger value="realtime">Temps Réel</TabsTrigger>
          <TabsTrigger value="analytics">Analyses Avancées</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="devices">Dispositifs</TabsTrigger>
        </TabsList>

        <TabsContent value="realtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Flux Temps Réel</CardTitle>
              <CardDescription>
                Derniers {fusionHistory.length} résultats d'analyse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fusionHistory.slice(0, 10).map((result, index) => {
                  const grade = result.final_grade || 'N/A';
                  const score = result.final_score ?? 0;
                  const defects = result.defects || [];
                  
                  return (
                    <div
                      key={result.id || index}
                      className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={grade === "A+" || grade === "A" ? "success" : grade === "B" ? "default" : grade === "C" ? "warning" : "error"}>
                          {grade}
                        </Badge>
                        <div className="text-sm">
                          <p className="font-medium">Score: {(score * 100).toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">
                            {defects.length > 0 ? `${defects.length} défaut(s)` : 'Aucun défaut'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {(score * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {result.timestamp 
                            ? new Date(result.timestamp).toLocaleTimeString("fr-FR", {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })
                            : "Maintenant"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Advanced Analytics Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-4">Analyses Statistiques Avancées</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Visualisations détaillées des métriques qualité avec cartes de contrôle, distributions et spectres
              </p>
            </div>

            {/* Time Series Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <TimeSeriesChart
                data={fusionHistory.slice(-50).map((result: any) => ({
                  timestamp: result.time || new Date().toISOString(),
                  value: result.foie_gras_metrics?.lobe_thickness_mm || result.lobe_thickness_mm || 50,
                  target: 50,
                  ucl: 55,
                  lcl: 45,
                }))}
                title="Évolution Épaisseur ToF"
                description="Suivi temps réel de l'épaisseur des lobes (Foie Gras)"
                yAxisLabel="Épaisseur"
                unit="mm"
                target={50}
                ucl={55}
                lcl={45}
                color="#3b82f6"
              />
              <TimeSeriesChart
                data={fusionHistory.slice(-50).map((result: any) => ({
                  timestamp: result.time || new Date().toISOString(),
                  value: result.foie_gras_metrics?.delta_e || result.delta_e || 2.5,
                  target: 2.0,
                  ucl: 5.0,
                  lcl: 0,
                }))}
                title="Évolution Delta E"
                description="Suivi de la déviation couleur (Lab vs référence)"
                yAxisLabel="Delta E"
                unit=""
                target={2.0}
                ucl={5.0}
                lcl={0}
                color="#10b981"
              />
            </div>

            {/* Shewhart Control Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <ShewhartChart
                data={fusionHistory.slice(-30).map((result: any, index) => ({
                  index: index + 1,
                  value: result.foie_gras_metrics?.lobe_thickness_mm || result.lobe_thickness_mm || 50,
                  timestamp: result.time || new Date().toISOString(),
                }))}
                title="Carte de Contrôle - Épaisseur Lobes"
                description="Contrôle statistique de l'épaisseur (Foie Gras) - Cp/Cpk temps réel"
                yAxisLabel="Épaisseur (mm)"
                unit="mm"
                mean={latestFusion?.foie_gras_metrics?.process_mean || 50}
                ucl={55}
                lcl={45}
                cp={latestFusion?.foie_gras_metrics?.process_cp || undefined}
                cpk={latestFusion?.foie_gras_metrics?.process_cpk || undefined}
                target={50}
              />
              <ShewhartChart
                data={fusionHistory.slice(-30).map((result: any, index) => ({
                  index: index + 1,
                  value: result.final_score ? result.final_score * 100 : 72,
                  timestamp: result.time || new Date().toISOString(),
                }))}
                title="Carte de Contrôle - Score Qualité"
                description="Contrôle statistique du score de qualité final"
                yAxisLabel="Score"
                unit="%"
                mean={72}
                ucl={90}
                lcl={50}
                cp={1.2}
                cpk={1.1}
                target={80}
              />
            </div>

            {/* Distribution Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <DistributionChart
                data={fusionHistory.slice(-100).map((r: any) => r.foie_gras_metrics?.lobe_thickness_mm || r.lobe_thickness_mm || 50)}
                title="Distribution Épaisseur"
                description="Histogramme et courbe normale (100 derniers échantillons)"
                xAxisLabel="Épaisseur (mm)"
                unit="mm"
                bins={15}
                lsl={45}
                usl={55}
                showNormalCurve={true}
              />
              <DistributionChart
                data={fusionHistory.slice(-100).map((r: any) => r.foie_gras_metrics?.delta_e || r.delta_e || 2.5)}
                title="Distribution Delta E"
                description="Histogramme des déviations couleur (100 derniers échantillons)"
                xAxisLabel="Delta E"
                unit=""
                bins={15}
                lsl={0}
                usl={5}
                showNormalCurve={true}
              />
            </div>

            {/* Spectral Analysis */}
            <SpectralBandsChart
              data={spectralData}
              title="Analyse Spectrale Complète"
              description="Signature spectrale 415nm-NIR (temps réel)"
              spectralProfile="foie_gras_cru_extra"
              showReference={true}
              showRadar={true}
            />
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Analyses</CardTitle>
              <CardDescription>Voir l'historique complet</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Accédez à la page Analyses pour voir l'historique complet
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>État des Dispositifs</CardTitle>
              <CardDescription>Statut des capteurs et dispositifs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Dispositifs Actifs</p>
                    <p className="text-2xl font-bold">{metrics?.activeDevices || 0}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Dispositifs Hors Ligne</p>
                    <p className="text-2xl font-bold">{(metrics?.totalDevices ?? 0) - (metrics?.activeDevices ?? 0)}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sensor Detail Modal */}
      <SensorDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        data={latestFusion}
        sensorType={modalSensorType}
      />
    </div>
  );
}
