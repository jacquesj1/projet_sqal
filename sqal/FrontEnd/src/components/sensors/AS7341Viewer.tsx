// ============================================================================
// AS7341 Spectral Sensor Viewer Component
// Visualisation des données spectrales
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AS7341Data {
  channels: {
    F1_415nm: number;
    F2_445nm: number;
    F3_480nm: number;
    F4_515nm: number;
    F5_555nm: number;
    F6_590nm: number;
    F7_630nm: number;
    F8_680nm: number;
    Clear: number;
    NIR: number;
  };
  freshness_index: number;
  fat_quality_index: number;
  oxidation_index: number;
  spectral_ratios: {
    blue_red: number;
    green_nir: number;
    yellow_blue: number;
  };
  color_uniformity: number;
}

interface AS7341ViewerProps {
  data: AS7341Data | null;
  isLoading?: boolean;
}

export function AS7341Viewer({ data, isLoading = false }: AS7341ViewerProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capteur Spectral AS7341</CardTitle>
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capteur Spectral AS7341</CardTitle>
          <CardDescription>Aucune donnée disponible</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Préparer les données pour le graphique
  const chartData = [
    { name: "415nm", value: data.channels.F1_415nm, color: "#8B00FF" },
    { name: "445nm", value: data.channels.F2_445nm, color: "#0000FF" },
    { name: "480nm", value: data.channels.F3_480nm, color: "#00BFFF" },
    { name: "515nm", value: data.channels.F4_515nm, color: "#00FF00" },
    { name: "555nm", value: data.channels.F5_555nm, color: "#7FFF00" },
    { name: "590nm", value: data.channels.F6_590nm, color: "#FFFF00" },
    { name: "630nm", value: data.channels.F7_630nm, color: "#FFA500" },
    { name: "680nm", value: data.channels.F8_680nm, color: "#FF0000" },
  ];

  const getIndexColor = (value: number) => {
    if (value >= 0.8) return "default";
    if (value >= 0.6) return "secondary";
    return "destructive";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capteur Spectral AS7341</CardTitle>
        <CardDescription>Analyse spectrale 10 canaux</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Indices de qualité */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Fraîcheur</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{((data.freshness_index ?? 0) * 100).toFixed(1)}%</p>
              <Badge variant={getIndexColor(data.freshness_index ?? 0)}>
                {(data.freshness_index ?? 0) >= 0.8 ? "Excellent" : (data.freshness_index ?? 0) >= 0.6 ? "Bon" : "Faible"}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Qualité du gras</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{((data.fat_quality_index ?? 0) * 100).toFixed(1)}%</p>
              <Badge variant={getIndexColor(data.fat_quality_index ?? 0)}>
                {(data.fat_quality_index ?? 0) >= 0.8 ? "Excellent" : (data.fat_quality_index ?? 0) >= 0.6 ? "Bon" : "Faible"}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Oxydation</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{((data.oxidation_index ?? 0) * 100).toFixed(1)}%</p>
              <Badge variant={getIndexColor(1 - (data.oxidation_index ?? 0))}>
                {(data.oxidation_index ?? 0) <= 0.2 ? "Faible" : (data.oxidation_index ?? 0) <= 0.4 ? "Modérée" : "Élevée"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Graphique spectral */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Spectre d'absorption</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ratios spectraux */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Ratio Bleu/Rouge</p>
            <p className="font-mono">{(data.spectral_ratios?.blue_red ?? 0).toFixed(3)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ratio Vert/NIR</p>
            <p className="font-mono">{(data.spectral_ratios?.green_nir ?? 0).toFixed(3)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ratio Jaune/Bleu</p>
            <p className="font-mono">{(data.spectral_ratios?.yellow_blue ?? 0).toFixed(3)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
