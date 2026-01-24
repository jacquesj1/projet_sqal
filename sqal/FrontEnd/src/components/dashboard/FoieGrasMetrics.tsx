import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Award, Ruler, Palette, Activity, Target, Droplet, Leaf, Palette as PaletteIcon, Zap } from "lucide-react";

interface FoieGrasMetricsData {
  operational: {
    conformity_rate: number;
    downgrade_rate: number;
    reject_rate: number;
    control_cadence: number;
  };
  quality_scores: {
    dimensional_conformity: number;
    color_conformity: number;
    global_quality_score: number;
  };
  instant_metrics: {
    thickness_mm: number;
    l_star: number;
    delta_e: number;
    volume_mm3: number;
  };
  process_capability: {
    cp: number;
    cpk: number;
    process_capability: "capable" | "acceptable" | "incapable" | "unknown";
    mean: number;
    std: number;
    is_centered: boolean;
  };
  moving_average: {
    moving_avg: number;
    moving_avg_10: number;
    moving_avg_50: number;
    trend: "rising" | "stable" | "falling";
    slope: number;
  };
  dimensional_deviation: {
    deviation_mm: number;
    deviation_percent: number;
    target_mm: number;
    tolerance_mm: number;
    is_within_tolerance: boolean;
  };
  maturity_index: {
    maturity_index: number;
    maturity_stage: "optimal" | "mature" | "immature" | "out_of_spec" | "unknown";
    spectral_ratio_red_nir: number;
  };
  freshness_score: {
    freshness_score: number;
    freshness_trend: "stable" | "degrading" | "unknown";
    estimated_shelf_life_hours: number;
    spectral_degradation_rate: number;
  };
  color_homogeneity: {
    color_homogeneity_cv: number;
    color_uniformity: "excellent" | "good" | "acceptable" | "low" | "unknown";
    color_std_delta_e: number;
    color_mean_delta_e: number;
  };
  spectral_bands: {
    spectral_bands: {
      "415nm_violet": number;
      "445nm_indigo": number;
      "480nm_blue": number;
      "515nm_cyan": number;
      "555nm_green": number;
      "590nm_yellow": number;
      "630nm_orange": number;
      "680nm_red": number;
      "nir_850nm": number;
    };
    spectral_profile: string;
    red_orange_ratio: number;
    total_intensity: number;
  };
  alerts: Array<{
    type: string;
    severity: "critical" | "high" | "medium" | "low";
    message: string;
  }>;
  targets: {
    conformity_target: number;
    cadence_target: number;
  };
}

export function FoieGrasMetrics() {
  const { data, isLoading } = useQuery<FoieGrasMetricsData>({
    queryKey: ['foie-gras-metrics'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/sqal/dashboard/overview`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
    refetchInterval: 5000, // Refresh toutes les 5 secondes
  });

  if (isLoading || !data || !data.quality_scores || !data.operational || !data.instant_metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Chargement...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground mt-1">
                {!data ? 'Connexion à l\'API...' : 'Données en cours de chargement...'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ✅ Fournir des valeurs par défaut pour targets si manquantes
  const targets = data.targets || {
    conformity_target: 95,
    cadence_target: 120
  };

  const getTrendIcon = (value: number, target: number) => {
    if (value >= target) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value >= target * 0.95) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getTrendColor = (value: number, target: number) => {
    if (value >= target) return "text-green-600";
    if (value >= target * 0.95) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Métriques Instantanées - Zone 1 */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Conformité Dimensionnelle */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conformité Dimensionnelle
            </CardTitle>
            <Ruler className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">
                {data.quality_scores.dimensional_conformity.toFixed(1)}%
              </div>
              {getTrendIcon(
                data.quality_scores.dimensional_conformity,
                targets.conformity_target
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Objectif: {targets.conformity_target}%
            </p>
            <div className="mt-2 text-xs">
              <span className="text-muted-foreground">Épaisseur actuelle: </span>
              <span className="font-medium">{data.instant_metrics.thickness_mm.toFixed(1)} mm</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Volume: </span>
              <span className="font-medium">{(data.instant_metrics.volume_mm3 / 1000).toFixed(1)} cm³</span>
            </div>
          </CardContent>
        </Card>

        {/* Conformité Couleur */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conformité Couleur
            </CardTitle>
            <Palette className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">
                {data.quality_scores.color_conformity.toFixed(1)}%
              </div>
              {getTrendIcon(
                data.quality_scores.color_conformity,
                targets.conformity_target
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Objectif: {targets.conformity_target}%
            </p>
            <div className="mt-2 space-y-1 text-xs">
              <div>
                <span className="text-muted-foreground">L* (luminosité): </span>
                <span className="font-medium">{data.instant_metrics.l_star.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">ΔE: </span>
                <span className={`font-medium ${
                  data.instant_metrics.delta_e < 2 ? 'text-green-600' :
                  data.instant_metrics.delta_e < 5 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {data.instant_metrics.delta_e.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Qualité Global */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Score Qualité Global
            </CardTitle>
            <Award className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">
                {data.quality_scores.global_quality_score.toFixed(1)}/100
              </div>
              {getTrendIcon(
                data.quality_scores.global_quality_score,
                targets.conformity_target
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Excellent: &gt;90
            </p>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    data.quality_scores.global_quality_score >= 90 ? 'bg-green-500' :
                    data.quality_scores.global_quality_score >= 75 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${data.quality_scores.global_quality_score}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Opérationnels */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Taux de Conformité */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taux de Conformité</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getTrendColor(
              data.operational.conformity_rate,
              targets.conformity_target
            )}`}>
              {data.operational.conformity_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Objectif: &gt;{targets.conformity_target}%
            </p>
          </CardContent>
        </Card>

        {/* Taux de Déclassement */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taux de Déclassement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              data.operational.downgrade_rate < 5 ? 'text-green-600' :
              data.operational.downgrade_rate < 10 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {data.operational.downgrade_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Extra → 1er choix
            </p>
          </CardContent>
        </Card>

        {/* Taux de Rejet */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taux de Rejet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              data.operational.reject_rate < 2 ? 'text-green-600' :
              data.operational.reject_rate < 5 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {data.operational.reject_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Hors normes
            </p>
          </CardContent>
        </Card>

        {/* Cadence Contrôle */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cadence Contrôle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getTrendColor(
              data.operational.control_cadence,
              targets.cadence_target
            )}`}>
              {data.operational.control_cadence}
            </div>
            <p className="text-xs text-muted-foreground">
              lobes/heure (objectif: {targets.cadence_target})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métriques Avancées - Zone 3 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Métriques Avancées</h3>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">

          {/* Process Capability (Cp/Cpk) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capabilité Process</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">
                  {data.process_capability.cpk.toFixed(2)}
                </div>
                <Badge variant={
                  data.process_capability.process_capability === "capable" ? "default" :
                  data.process_capability.process_capability === "acceptable" ? "secondary" :
                  "destructive"
                }>
                  {data.process_capability.process_capability === "capable" ? "Capable" :
                   data.process_capability.process_capability === "acceptable" ? "Acceptable" :
                   data.process_capability.process_capability === "incapable" ? "Incapable" : "Inconnu"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cpk (process capability index)
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Cp: </span>
                  <span className="font-medium">{data.process_capability.cp.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Moyenne: </span>
                  <span className="font-medium">{data.process_capability.mean.toFixed(1)} mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Écart-type: </span>
                  <span className="font-medium">{data.process_capability.std.toFixed(2)} mm</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Moving Average */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Moyenne Mobile</CardTitle>
              <Activity className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">
                  {data.moving_average.moving_avg.toFixed(1)} mm
                </div>
                {data.moving_average.trend === "rising" && <TrendingUp className="h-4 w-4 text-green-500" />}
                {data.moving_average.trend === "stable" && <Minus className="h-4 w-4 text-yellow-500" />}
                {data.moving_average.trend === "falling" && <TrendingDown className="h-4 w-4 text-red-500" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tendance: {data.moving_average.trend === "rising" ? "Hausse" : data.moving_average.trend === "falling" ? "Baisse" : "Stable"}
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">MM(10): </span>
                  <span className="font-medium">{data.moving_average.moving_avg_10.toFixed(1)} mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">MM(50): </span>
                  <span className="font-medium">{data.moving_average.moving_avg_50.toFixed(1)} mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pente: </span>
                  <span className="font-medium">{data.moving_average.slope.toFixed(3)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dimensional Deviation */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Déviation Dimensionnelle</CardTitle>
              <Target className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className={`text-2xl font-bold ${
                  data.dimensional_deviation.is_within_tolerance ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.dimensional_deviation.deviation_mm > 0 ? '+' : ''}{data.dimensional_deviation.deviation_mm.toFixed(2)} mm
                </div>
                <Badge variant={data.dimensional_deviation.is_within_tolerance ? "default" : "destructive"}>
                  {data.dimensional_deviation.is_within_tolerance ? "OK" : "ALERTE"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Par rapport à {data.dimensional_deviation.target_mm} mm
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Déviation %: </span>
                  <span className="font-medium">{data.dimensional_deviation.deviation_percent > 0 ? '+' : ''}{data.dimensional_deviation.deviation_percent.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tolérance: </span>
                  <span className="font-medium">±{data.dimensional_deviation.tolerance_mm} mm</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Maturity Index */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Indice de Maturité</CardTitle>
              <Leaf className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">
                  {data.maturity_index.maturity_index.toFixed(2)}
                </div>
                <Badge variant={
                  data.maturity_index.maturity_stage === "optimal" ? "default" :
                  data.maturity_index.maturity_stage === "mature" ? "secondary" :
                  "destructive"
                }>
                  {data.maturity_index.maturity_stage === "optimal" ? "Optimal" :
                   data.maturity_index.maturity_stage === "mature" ? "Mûr" :
                   data.maturity_index.maturity_stage === "immature" ? "Immature" :
                   data.maturity_index.maturity_stage === "out_of_spec" ? "Hors spec" : "Inconnu"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ratio spectral Rouge/NIR
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Ratio R/NIR: </span>
                  <span className="font-medium">{data.maturity_index.spectral_ratio_red_nir.toFixed(2)}</span>
                </div>
                <div className="text-muted-foreground mt-1">
                  {data.maturity_index.maturity_stage === "optimal" && "✅ Extra quality"}
                  {data.maturity_index.maturity_stage === "mature" && "🟢 Standard"}
                  {data.maturity_index.maturity_stage === "immature" && "🟡 Acceptable"}
                  {data.maturity_index.maturity_stage === "out_of_spec" && "🔴 À rejeter"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Freshness Score */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Score de Fraîcheur</CardTitle>
              <Droplet className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className={`text-2xl font-bold ${
                  data.freshness_score.freshness_score > 90 ? 'text-green-600' :
                  data.freshness_score.freshness_score > 70 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {data.freshness_score.freshness_score.toFixed(0)}/100
                </div>
                <Badge variant={
                  data.freshness_score.freshness_score > 90 ? "default" :
                  data.freshness_score.freshness_score > 70 ? "secondary" :
                  "destructive"
                }>
                  {data.freshness_score.freshness_score > 90 ? "Excellent" :
                   data.freshness_score.freshness_score > 70 ? "Bon" :
                   data.freshness_score.freshness_score > 50 ? "Acceptable" : "Faible"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Durée de vie estimée
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Shelf life: </span>
                  <span className="font-medium">{data.freshness_score.estimated_shelf_life_hours}h</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Dégradation: </span>
                  <span className="font-medium">{(data.freshness_score.spectral_degradation_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="text-muted-foreground mt-1">
                  {data.freshness_score.freshness_trend === "stable" ? "📊 Stable" : "📉 Dégradation"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Color Homogeneity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Homogénéité Couleur</CardTitle>
              <PaletteIcon className="h-4 w-4 text-pink-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">
                  {data.color_homogeneity.color_homogeneity_cv.toFixed(1)}%
                </div>
                <Badge variant={
                  data.color_homogeneity.color_uniformity === "excellent" ? "default" :
                  data.color_homogeneity.color_uniformity === "good" ? "secondary" :
                  "destructive"
                }>
                  {data.color_homogeneity.color_uniformity === "excellent" ? "Excellent" :
                   data.color_homogeneity.color_uniformity === "good" ? "Bon" :
                   data.color_homogeneity.color_uniformity === "acceptable" ? "Acceptable" : "Faible"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Coefficient de Variation (CV%)
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">ΔE moyen: </span>
                  <span className="font-medium">{data.color_homogeneity.color_mean_delta_e.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ΔE σ: </span>
                  <span className="font-medium">{data.color_homogeneity.color_std_delta_e.toFixed(2)}</span>
                </div>
                <div className="text-muted-foreground mt-1">
                  {data.color_homogeneity.color_uniformity === "excellent" && "✅ Lot homogène"}
                  {data.color_homogeneity.color_uniformity === "good" && "🟢 Bon"}
                  {data.color_homogeneity.color_uniformity === "acceptable" && "🟡 Acceptable"}
                  {data.color_homogeneity.color_uniformity === "low" && "🔴 Hétérogène"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Spectral Bands */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bandes Spectrales</CardTitle>
              <Zap className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">
                  {(data.spectral_bands.total_intensity / 1000).toFixed(1)}k
                </div>
                <Badge variant="secondary">
                  9 canaux
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.spectral_bands.spectral_profile}
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Ratio R/O: </span>
                  <span className="font-medium">{data.spectral_bands.red_orange_ratio.toFixed(2)}</span>
                </div>
                <div className="text-muted-foreground mt-1">
                  415nm - 850nm (9 ch)
                </div>
                <div className="flex gap-1 mt-2">
                  {Object.entries(data.spectral_bands.spectral_bands).map(([key, value]) => (
                    <div
                      key={key}
                      className="h-2 flex-1 rounded"
                      style={{
                        backgroundColor:
                          key.includes('violet') ? '#8b00ff' :
                          key.includes('indigo') ? '#4b0082' :
                          key.includes('blue') ? '#0000ff' :
                          key.includes('cyan') ? '#00ffff' :
                          key.includes('green') ? '#00ff00' :
                          key.includes('yellow') ? '#ffff00' :
                          key.includes('orange') ? '#ff8800' :
                          key.includes('red') ? '#ff0000' : '#888',
                        opacity: Math.min(value / 5000, 1)
                      }}
                      title={`${key}: ${value}`}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
