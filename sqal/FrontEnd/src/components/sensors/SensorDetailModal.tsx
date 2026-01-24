// ============================================================================
// SQAL Frontend - Sensor Detail Modal
// Comprehensive view of all sensor analyses (ToF + Spectral)
// ============================================================================

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  BarChart3,
  Layers,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Gauge
} from "lucide-react";
import type { FusionResult } from "@/types";

interface SensorDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FusionResult | null;
  sensorType: "tof" | "spectral" | "fusion";
}

export function SensorDetailModal({ open, onOpenChange, data, sensorType }: SensorDetailModalProps) {
  if (!data) return null;

  const metrics = data.foie_gras_metrics;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {sensorType === "tof" && "🔷 Analyses ToF VL53L8CH"}
            {sensorType === "spectral" && "🌈 Analyses Spectral AS7341"}
            {sensorType === "fusion" && "🔬 Analyses Fusion Complète"}
            <Badge variant="outline" className="ml-2">
              {data.sample_id}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Analyses détaillées et métriques avancées • {new Date(data.timestamp || data.time || '').toLocaleString("fr-FR")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          <Tabs defaultValue="metrics" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="metrics">
                <Gauge className="h-4 w-4 mr-2" />
                Métriques
              </TabsTrigger>
              <TabsTrigger value="analysis">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analyses
              </TabsTrigger>
              <TabsTrigger value="defects">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Défauts
              </TabsTrigger>
              <TabsTrigger value="quality">
                <CheckCircle className="h-4 w-4 mr-2" />
                Qualité
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Métriques Clés */}
            <TabsContent value="metrics" className="space-y-4 mt-4">
              {(sensorType === "tof" || sensorType === "fusion") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Métriques ToF (VL53L8CH)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <MetricItem 
                      label="Épaisseur moyenne" 
                      value={metrics?.lobe_thickness_mm?.toFixed(2)} 
                      unit="mm"
                      icon="📏"
                    />
                    <MetricItem 
                      label="Volume estimé" 
                      value={metrics?.estimated_volume_cm3?.toFixed(0)} 
                      unit="cm³"
                      icon="📦"
                    />
                    <MetricItem 
                      label="Uniformité surface" 
                      value={metrics?.surface_uniformity ? (metrics.surface_uniformity * 100).toFixed(1) : undefined} 
                      unit="%"
                      icon="📊"
                    />
                    <MetricItem 
                      label="Niveau remplissage" 
                      value={metrics?.fill_level_percent?.toFixed(1)} 
                      unit="%"
                      icon="📍"
                    />
                    <MetricItem 
                      label="Écart remplissage" 
                      value={metrics?.fill_deviation_mm?.toFixed(2)} 
                      unit="mm"
                      icon="📐"
                    />
                    <MetricItem 
                      label="Score conformité" 
                      value={data.tof_score ? (data.tof_score * 100).toFixed(1) : undefined} 
                      unit="%"
                      icon="✅"
                    />
                  </CardContent>
                </Card>
              )}

              {(sensorType === "spectral" || sensorType === "fusion") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Métriques Spectral (AS7341)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <MetricItem 
                      label="Delta E (écart couleur)" 
                      value={metrics?.delta_e?.toFixed(2)} 
                      unit=""
                      icon="🎨"
                    />
                    <MetricItem 
                      label="Luminosité L*" 
                      value={metrics?.l_star?.toFixed(1)} 
                      unit=""
                      icon="💡"
                    />
                    <MetricItem 
                      label="a* (rouge-vert)" 
                      value={metrics?.a_star?.toFixed(1)} 
                      unit=""
                      icon="🟡"
                    />
                    <MetricItem 
                      label="b* (jaune-bleu)" 
                      value={metrics?.b_star?.toFixed(1)} 
                      unit=""
                      icon="🟠"
                    />
                    <MetricItem 
                      label="Score fraîcheur" 
                      value={metrics?.freshness_score ? (metrics.freshness_score * 100).toFixed(1) : undefined} 
                      unit="%"
                      icon="✨"
                    />
                    <MetricItem 
                      label="Oxydation" 
                      value={metrics?.oxidation_severity !== undefined ? (metrics.oxidation_severity * 100).toFixed(1) : undefined} 
                      unit="%"
                      icon="🟤"
                    />
                  </CardContent>
                </Card>
              )}

              {sensorType === "fusion" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Métriques Fusion
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <MetricItem 
                      label="Score final" 
                      value={data.final_score ? (data.final_score * 100).toFixed(1) : undefined} 
                      unit="%"
                      icon="🎯"
                      highlight
                    />
                    <MetricItem 
                      label="Grade final" 
                      value={data.final_grade} 
                      unit=""
                      icon="🏆"
                      highlight
                    />
                    <MetricItem 
                      label="Contribution ToF" 
                      value={data.tof_contribution ? (data.tof_contribution * 100).toFixed(0) : undefined} 
                      unit="%"
                      icon="🔷"
                    />
                    <MetricItem 
                      label="Contribution Spectral" 
                      value={data.spectral_contribution ? (data.spectral_contribution * 100).toFixed(0) : undefined} 
                      unit="%"
                      icon="🌈"
                    />
                    <MetricItem 
                      label="Nombre de défauts" 
                      value={data.num_defects?.toString()} 
                      unit=""
                      icon="⚠️"
                    />
                    <MetricItem 
                      label="Taux de défauts" 
                      value={metrics?.defect_rate_percent?.toFixed(1)} 
                      unit="%"
                      icon="📊"
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab 2: Analyses Avancées */}
            <TabsContent value="analysis" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Analyses Avancées</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {metrics?.has_critical_color_deviation !== undefined && (
                    <AnalysisItem
                      label="Déviation couleur critique"
                      status={!metrics.has_critical_color_deviation}
                      details={metrics.has_critical_color_deviation ? "Écart colorimétrique hors tolérance" : "Couleur conforme"}
                    />
                  )}
                  {metrics?.has_underfill !== undefined && (
                    <AnalysisItem
                      label="Remplissage insuffisant"
                      status={!metrics.has_underfill}
                      details={metrics.has_underfill ? "Niveau de remplissage sous le minimum" : "Remplissage conforme"}
                    />
                  )}
                  {metrics?.has_oxidation_trend !== undefined && (
                    <AnalysisItem
                      label="Tendance oxydation"
                      status={!metrics.has_oxidation_trend}
                      details={metrics.has_oxidation_trend ? "Oxydation détectée" : "Pas d'oxydation"}
                    />
                  )}
                  {metrics?.is_compliant !== undefined && (
                    <AnalysisItem
                      label="Conformité globale"
                      status={metrics.is_compliant}
                      details={metrics.is_compliant ? "Produit conforme aux standards" : "Non-conformité détectée"}
                      highlight
                    />
                  )}
                </CardContent>
              </Card>

              {metrics?.process_cp !== undefined && metrics?.process_cp !== null && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Capabilité Process
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <MetricItem 
                      label="Cp (capabilité)" 
                      value={metrics.process_cp?.toFixed(2)} 
                      unit=""
                      icon="📈"
                    />
                    <MetricItem 
                      label="Cpk (capabilité centrée)" 
                      value={metrics.process_cpk?.toFixed(2)} 
                      unit=""
                      icon="🎯"
                    />
                    <MetricItem 
                      label="Moyenne process" 
                      value={metrics.process_mean?.toFixed(2)} 
                      unit="mm"
                      icon="📊"
                    />
                    <MetricItem 
                      label="Écart-type process" 
                      value={metrics.process_std?.toFixed(2)} 
                      unit="mm"
                      icon="📉"
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab 3: Défauts Détectés */}
            <TabsContent value="defects" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Défauts Détectés</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.defects && data.defects.length > 0 ? (
                    <div className="space-y-2">
                      {data.defects.map((defect, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <div>
                              <p className="font-medium text-sm">{defect}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>Aucun défaut détecté</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 4: Scores Qualité */}
            <TabsContent value="quality" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Scores de Qualité</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <QualityScoreBar 
                    label="Score ToF" 
                    score={data.tof_score || 0} 
                    color="blue"
                  />
                  <QualityScoreBar 
                    label="Score Spectral" 
                    score={data.spectral_score || 0} 
                    color="purple"
                  />
                  <Separator />
                  <QualityScoreBar 
                    label="Score Final (Fusion)" 
                    score={data.final_score || 0} 
                    color="green"
                    highlight
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Helper Components
function MetricItem({ 
  label, 
  value, 
  unit, 
  icon, 
  highlight = false 
}: { 
  label: string; 
  value?: string; 
  unit: string; 
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${highlight ? 'bg-blue-50 border-blue-200' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={`font-semibold ${highlight ? 'text-blue-700' : ''}`}>
        {value !== undefined ? `${value} ${unit}` : '--'}
      </span>
    </div>
  );
}

function AnalysisItem({ 
  label, 
  status, 
  details,
  highlight = false 
}: { 
  label: string; 
  status: boolean; 
  details: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${highlight ? 'bg-blue-50 border-blue-200' : ''}`}>
      {status ? (
        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">{details}</p>
      </div>
    </div>
  );
}

function QualityScoreBar({ 
  label, 
  score, 
  color,
  highlight = false 
}: { 
  label: string; 
  score: number; 
  color: "blue" | "purple" | "green";
  highlight?: boolean;
}) {
  const colorClasses = {
    blue: "bg-blue-600",
    purple: "bg-purple-600",
    green: "bg-green-600"
  };

  return (
    <div className={`space-y-2 ${highlight ? 'p-3 rounded-lg bg-green-50 border border-green-200' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${highlight ? 'text-green-900' : ''}`}>{label}</span>
        <span className={`text-sm font-bold ${highlight ? 'text-green-700' : ''}`}>
          {(score * 100).toFixed(1)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`${colorClasses[color]} h-3 rounded-full transition-all`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}
