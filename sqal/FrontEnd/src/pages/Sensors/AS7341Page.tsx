// ============================================================================
// AS7341 (Spectral) Sensor Page
// Dashboard complet identique à as7341_visualizations.py
// ============================================================================

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import SpectralBarsChart from "@components/sensors/SpectralBarsChart";
import NormalizedSpectrum from "@components/sensors/NormalizedSpectrum";
import SpectralRatiosChart from "@components/sensors/SpectralRatiosChart";
import FreshnessGauge from "@components/sensors/FreshnessGauge";
import OxidationGauge from "@components/sensors/OxidationGauge";
import FatQualityGauge from "@components/sensors/FatQualityGauge";
import ColorUniformityGauge from "@components/sensors/ColorUniformityGauge";
import { useRealtimeStore } from "@stores/realtimeStore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Palette,
  Download,
  RefreshCw,
  AlertTriangle,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react";
import { InfoTooltip } from "@components/ui/info-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AS7341Page() {
  const { latestAS7341, isConnected } = useRealtimeStore();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const dataOrigin = (latestAS7341 as any)?.__data_origin as string | undefined;
  const fallbackReasons = (latestAS7341 as any)?.__fallback_reasons as string[] | undefined;

  useEffect(() => {
    console.log("🟡 AS7341Page - WebSocket connected:", isConnected);
    console.log("🟡 AS7341Page - latestAS7341:", latestAS7341);

    if (latestAS7341) {
      setLastUpdate(new Date());
    }
  }, [isConnected, latestAS7341]);

  // Extract data from WebSocket
  const rawCounts = latestAS7341?.raw_counts || {};
  const qualityMetrics = latestAS7341?.quality_metrics || {};
  const spectralRatios = latestAS7341?.spectral_ratios || {};
  const defects = latestAS7341?.defects || [];
  const grade = latestAS7341?.grade || "N/A";
  const quality_score = latestAS7341?.quality_score || 0;
  const score_breakdown: any = (latestAS7341 as any)?.score_breakdown;

  // Individual metrics
  const freshness_index = (latestAS7341 as any)?.freshness_index ?? qualityMetrics.freshness_index ?? 0;
  const oxidation_index = (latestAS7341 as any)?.oxidation_index ?? qualityMetrics.oxidation_index ?? 0;
  const fat_quality_index = (latestAS7341 as any)?.fat_quality_index ?? qualityMetrics.fat_quality_index ?? 0;
  const color_uniformity = (latestAS7341 as any)?.color_uniformity ?? qualityMetrics.color_uniformity ?? 0;

  // Backend currently does not provide AS7341 score_breakdown.
  // Compute a UI fallback based on analyzer weights so the breakdown card always renders.
  const computedScoreBreakdown =
    score_breakdown && typeof score_breakdown === "object"
      ? score_breakdown
      : {
          freshness_score: freshness_index * 0.35,
          fat_quality_score: fat_quality_index * 0.30,
          color_score: color_uniformity * 0.20,
          anti_oxidation_score: (1 - oxidation_index) * 0.15,
        };

  const refetch = () => {
    console.log("🔄 Manual refetch requested");
  };

  const getGradeBadgeVariant = (grade: string) => {
    if (grade === "A+" || grade === "A") return "default";
    if (grade === "B") return "secondary";
    if (grade === "C") return "outline";
    return "destructive";
  };

  const getGradeColor = (grade: string) => {
    const gradeColors: Record<string, string> = {
      "A+": "text-green-700",
      "A": "text-green-600",
      "B": "text-orange-500",
      "C": "text-orange-600",
      "REJECT": "text-red-600",
    };
    return gradeColors[grade] || "text-gray-600";
  };

  if (!latestAS7341) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto" />
          <h2 className="text-2xl font-semibold">En attente des données AS7341...</h2>
          <p className="text-muted-foreground">
            {isConnected
              ? "WebSocket connecté - En attente des premières mesures"
              : "Connexion au WebSocket..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Palette className="h-8 w-8 text-orange-500" />
            AS7341 Dashboard - Spectral Sensor
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-muted-foreground flex items-center gap-2">
              Analyse spectrale 9 canaux (415nm - 910nm) - Identique à Python
            </p>
            {dataOrigin === "fallback" ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      Fallback
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-md">
                    <p className="text-sm">{`Valeurs en mode fallback (certaines données manquantes dans le flux).\n\nRaisons: ${(fallbackReasons && fallbackReasons.length > 0 ? fallbackReasons.join(", ") : "inconnues")}`}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                Analyse
              </Badge>
            )}
            {isConnected ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Wifi className="h-3 w-3 mr-1" />
                Connecté
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-600">
                <WifiOff className="h-3 w-3 mr-1" />
                Déconnecté
              </Badge>
            )}
            {lastUpdate && (
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                <Clock className="h-3 w-3 mr-1" />
                {lastUpdate.toLocaleTimeString()}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard Complet</TabsTrigger>
          <TabsTrigger value="analysis">Analyse Détaillée</TabsTrigger>
          <TabsTrigger value="defects">Défauts</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab - Layout 3x3 comme Python (Figure_1_AS7341.png) */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* LIGNE 1 : Indicateurs (design individuel) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FreshnessGauge value={freshness_index} />

            <div className="grid grid-cols-2 gap-4">
              <FatQualityGauge value={fat_quality_index} />
              <OxidationGauge value={oxidation_index} />
            </div>

            <ColorUniformityGauge value={color_uniformity} />
          </div>

          {/* LIGNE 2 : Spectres (Raw, Normalized, Ratios) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpectralBarsChart rawCounts={rawCounts} showValues={true} />
            <NormalizedSpectrum rawCounts={rawCounts} showReference={false} />
            <SpectralRatiosChart ratios={spectralRatios} />
          </div>

          {/* LIGNE 4 : Grade Final & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 4.1 Grade Final */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Grade Spectral</CardTitle>
                  <InfoTooltip
                    side="left"
                    maxWidth="md"
                    content={
                      "Grade final calculé à partir du score de qualité global et des anomalies détectées. Le score est normalisé entre 0 et 1 (affiché ici en %)."
                    }
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className={`text-6xl font-bold ${getGradeColor(grade)}`}>
                    {grade}
                  </div>
                  <Badge variant={getGradeBadgeVariant(grade)} className="text-lg">
                    Score: {(quality_score * 100).toFixed(1)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 4.2 Métriques Complémentaires */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Métriques Complémentaires</CardTitle>
                  <InfoTooltip
                    side="left"
                    maxWidth="md"
                    content={
                      "Ratios simples dérivés des canaux (ex: Red/NIR, Red/Orange, Green/Red). Ils complètent les ratios 'principaux' du simulateur (Violet/Orange, NIR/Violet, Discoloration, etc.)."
                    }
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      Uniformité couleur:
                      <InfoTooltip
                        side="left"
                        content={
                          "Indice 0-1 (1 = couleur très uniforme). Utilisé dans les barres et le radar de qualité."
                        }
                      />
                    </span>
                    <span className="text-sm font-medium">
                      {(color_uniformity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      Ratio Red/NIR:
                      <InfoTooltip side="left" content={'680nm / 910nm. Sensible à la structure et à l\'absorption IR.'} />
                    </span>
                    <span className="text-sm font-medium">
                      {spectralRatios.red_nir?.toFixed(2) || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      Ratio Red/Orange:
                      <InfoTooltip side="left" content={"680nm / 630nm. Indicateur de balance colorimétrique (rouge vs orange)."} />
                    </span>
                    <span className="text-sm font-medium">
                      {spectralRatios.red_orange?.toFixed(2) || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      Ratio Green/Red:
                      <InfoTooltip side="left" content={"555nm / 680nm. Indice de couleur (alias: green_red_ratio dans le simulateur)."} />
                    </span>
                    <span className="text-sm font-medium">
                      {(spectralRatios.green_red ?? spectralRatios.green_red_ratio)?.toFixed?.(2) || "N/A"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4.3 Summary Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Résumé</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">État général:</span>
                    <Badge variant={quality_score > 0.7 ? "default" : "destructive"}>
                      {quality_score > 0.85 ? "Excellent" :
                       quality_score > 0.7 ? "Bon" :
                       quality_score > 0.5 ? "Acceptable" : "Faible"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Nb défauts:</span>
                    <span className={`text-sm font-medium ${defects.length === 0 ? "text-green-600" : "text-red-600"}`}>
                      {defects.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Canaux actifs:</span>
                    <span className="text-sm font-medium">
                      {Object.keys(rawCounts).length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LIGNE 5 : Décomposition du score */}
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Décomposition du Score Qualité</CardTitle>
                <CardDescription className="text-xs">Contribution de chaque critère au score final</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={[
                      { name: "Fraîcheur (35%)", score: (computedScoreBreakdown.freshness_score ?? 0) * 100 },
                      { name: "Qualité lipidique (30%)", score: (computedScoreBreakdown.fat_quality_score ?? 0) * 100 },
                      { name: "Couleur (20%)", score: (computedScoreBreakdown.color_score ?? 0) * 100 },
                      { name: "Anti-oxydation (15%)", score: (computedScoreBreakdown.anti_oxidation_score ?? 0) * 100 },
                    ]}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={170} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)} pts`, ""]}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {["#3b82f6", "#10b981", "#f59e0b", "#ef4444"].map((c, i) => (
                        <Cell key={`cell-${i}`} fill={c} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Somme contributions</span>
                  <span>{(
                    ((computedScoreBreakdown.freshness_score ?? 0) +
                      (computedScoreBreakdown.fat_quality_score ?? 0) +
                      (computedScoreBreakdown.color_score ?? 0) +
                      (computedScoreBreakdown.anti_oxidation_score ?? 0)) *
                    100
                  ).toFixed(1)} pts</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Analyse spectrale détaillée */}
            <Card>
              <CardHeader>
                <CardTitle>Analyse Spectrale Complète</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Canaux Spectraux (nm)</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(rawCounts).map(([channel, count]) => (
                      <div key={channel} className="flex justify-between">
                        <span className="text-muted-foreground">{channel}:</span>
                        <span className="font-medium">{count.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Métriques de qualité détaillées */}
            <Card>
              <CardHeader>
                <CardTitle>Métriques de Qualité</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Fraîcheur:</span>
                    <span className="font-semibold">{(freshness_index * 100).toFixed(1)}%</span>

                    <span className="text-muted-foreground">Qualité lipidique:</span>
                    <span className="font-semibold">{(fat_quality_index * 100).toFixed(1)}%</span>

                    <span className="text-muted-foreground">Oxydation:</span>
                    <span className="font-semibold">{(oxidation_index * 100).toFixed(1)}%</span>

                    <span className="text-muted-foreground">Uniformité:</span>
                    <span className="font-semibold">{(color_uniformity * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Defects Tab */}
        <TabsContent value="defects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Défauts Spectraux Détectés</CardTitle>
              <CardDescription>
                {defects.length} défaut(s) identifié(s) par analyse spectrale
              </CardDescription>
            </CardHeader>
            <CardContent>
              {defects.length === 0 ? (
                <p className="text-sm text-green-600 font-semibold text-center py-8">
                  ✓ Aucun défaut spectral détecté
                </p>
              ) : (
                <div className="space-y-2">
                  {defects.map((defect: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 border rounded-lg bg-orange-50 border-orange-200"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-semibold">
                          Défaut {idx + 1}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{defect}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AS7341Page;
