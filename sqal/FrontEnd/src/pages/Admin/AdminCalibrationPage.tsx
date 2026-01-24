// ============================================================================
// Admin Calibration Page
// Calibration des capteurs ToF et AS7341
// ============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Progress } from "@components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import api from "@services/api";
import { 
  Activity, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Settings,
  Radio,
  Waves,
  Target,
  Download,
  Upload
} from "lucide-react";

interface CalibrationData {
  id: string;
  sensor_type: "tof" | "as7341";
  device_id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;
  created_at: string;
  completed_at?: string;
  parameters: Record<string, any>;
}

export function AdminCalibrationPage() {
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const queryClient = useQueryClient();

  // Fetch calibration history
  const { data: calibrations } = useQuery<CalibrationData[]>({
    queryKey: ["admin", "calibrations"],
    queryFn: async () => {
      // TODO: Implement API call
      return [];
    },
    refetchInterval: 5000,
  });

  // Start calibration mutation
  const startCalibration = useMutation({
    mutationFn: async (data: { device_id: string; sensor_type: "tof" | "as7341" }) => {
      // TODO: Implement API call
      return api.admin.startCalibration(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "calibrations"] });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: any }> = {
      pending: { color: "bg-yellow-500", icon: AlertCircle },
      in_progress: { color: "bg-blue-500", icon: RefreshCw },
      completed: { color: "bg-green-500", icon: CheckCircle2 },
      failed: { color: "bg-red-500", icon: AlertCircle },
    };

    const variant = variants[status] || variants.pending;
    const Icon = variant.icon;

    return (
      <Badge className={`${variant.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calibration des Capteurs</h1>
          <p className="text-muted-foreground mt-2">
            Calibration et configuration des capteurs ToF et AS7341
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exporter les données
        </Button>
      </div>

      {/* Calibration Tabs */}
      <Tabs defaultValue="tof" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="tof">
            <Radio className="h-4 w-4 mr-2" />
            Capteur ToF
          </TabsTrigger>
          <TabsTrigger value="as7341">
            <Waves className="h-4 w-4 mr-2" />
            Capteur AS7341
          </TabsTrigger>
        </TabsList>

        {/* ToF Calibration */}
        <TabsContent value="tof" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Quick Calibration Card */}
            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-purple-500/10">
                      <Radio className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle>Calibration Rapide ToF</CardTitle>
                      <CardDescription>Calibration automatique du capteur</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Sélectionner un appareil</Label>
                  <Input
                    placeholder="ID de l'appareil"
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Distance min</p>
                    <p className="font-semibold">30 mm</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Distance max</p>
                    <p className="font-semibold">4000 mm</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Précision</p>
                    <p className="font-semibold">±1 mm</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Temps</p>
                    <p className="font-semibold">~2 min</p>
                  </div>
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
                  onClick={() => startCalibration.mutate({ device_id: selectedDevice, sensor_type: "tof" })}
                  disabled={!selectedDevice || startCalibration.isPending}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {startCalibration.isPending ? "Calibration en cours..." : "Démarrer la calibration"}
                </Button>
              </CardContent>
            </Card>

            {/* Manual Calibration Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <Settings className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle>Calibration Manuelle</CardTitle>
                    <CardDescription>Configuration avancée des paramètres</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Offset de distance (mm)</Label>
                    <Input type="number" placeholder="0" defaultValue="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Crosstalk (kcps)</Label>
                    <Input type="number" placeholder="0" defaultValue="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Timing Budget (ms)</Label>
                    <Input type="number" placeholder="33" defaultValue="33" />
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Appliquer les paramètres
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ToF Calibration Status */}
          <Card>
            <CardHeader>
              <CardTitle>État de la calibration ToF</CardTitle>
              <CardDescription>Suivi en temps réel de la calibration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-semibold">0%</span>
                  </div>
                  <Progress value={0} className="h-2" />
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Calibrations</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm font-medium">Réussies</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                    <p className="text-sm font-medium">Échouées</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AS7341 Calibration */}
        <TabsContent value="as7341" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Quick Calibration Card */}
            <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-blue-500/10">
                      <Waves className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle>Calibration Rapide AS7341</CardTitle>
                      <CardDescription>Calibration spectrale automatique</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Sélectionner un appareil</Label>
                  <Input
                    placeholder="ID de l'appareil"
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Canaux spectraux</span>
                    <span className="font-semibold">11 canaux</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {["415nm", "445nm", "480nm", "515nm", "555nm", "590nm", "630nm", "680nm", "Clear", "NIR", "Flicker"].map((channel, i) => (
                      <div
                        key={i}
                        className="text-center p-2 rounded bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-blue-500/20"
                      >
                        <p className="text-xs font-mono">{channel}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                  onClick={() => startCalibration.mutate({ device_id: selectedDevice, sensor_type: "as7341" })}
                  disabled={!selectedDevice || startCalibration.isPending}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {startCalibration.isPending ? "Calibration en cours..." : "Démarrer la calibration"}
                </Button>
              </CardContent>
            </Card>

            {/* Spectral Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-cyan-500/10">
                    <Activity className="h-6 w-6 text-cyan-500" />
                  </div>
                  <div>
                    <CardTitle>Configuration Spectrale</CardTitle>
                    <CardDescription>Paramètres d'acquisition</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Temps d'intégration (ms)</Label>
                    <Input type="number" placeholder="100" defaultValue="100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Gain</Label>
                    <Input type="number" placeholder="1" defaultValue="1" min="1" max="512" />
                  </div>
                  <div className="space-y-2">
                    <Label>LED Current (mA)</Label>
                    <Input type="number" placeholder="4" defaultValue="4" />
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Appliquer la configuration
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* AS7341 Calibration Status */}
          <Card>
            <CardHeader>
              <CardTitle>État de la calibration AS7341</CardTitle>
              <CardDescription>Suivi en temps réel de la calibration spectrale</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-semibold">0%</span>
                  </div>
                  <Progress value={0} className="h-2" />
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Calibrations</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm font-medium">Réussies</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                    <p className="text-sm font-medium">Échouées</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Calibration History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des calibrations</CardTitle>
          <CardDescription>Liste des calibrations récentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {calibrations && calibrations.length > 0 ? (
              calibrations.map((cal) => (
                <div
                  key={cal.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      {cal.sensor_type === "tof" ? (
                        <Radio className="h-5 w-5 text-purple-500" />
                      ) : (
                        <Waves className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{cal.sensor_type.toUpperCase()} - {cal.device_id}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(cal.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{cal.progress}%</p>
                      <Progress value={cal.progress} className="w-24 h-1" />
                    </div>
                    {getStatusBadge(cal.status)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Aucune calibration enregistrée</p>
                <p className="text-sm">Démarrez une calibration pour voir l'historique</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
