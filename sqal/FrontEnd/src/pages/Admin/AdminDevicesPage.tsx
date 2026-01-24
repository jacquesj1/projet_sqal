// ============================================================================
// Admin Devices Page
// Gestion des appareils (capteurs, ESP32)
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import type { DevicesResponse } from "@/types/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import api from "@services/api";
import { Wifi, WifiOff, Activity, Settings, Trash2 } from "lucide-react";

export function AdminDevicesPage() {
  const { data: devicesData } = useQuery<DevicesResponse>({
    queryKey: ["admin", "devices"],
    queryFn: () => api.admin.getDevices(),
    refetchInterval: 5000,
  });

  const getStatusBadge = (status: string) => {
    return status === "online" ? (
      <Badge className="bg-green-500">
        <Wifi className="w-3 h-3 mr-1" />
        En ligne
      </Badge>
    ) : (
      <Badge variant="destructive">
        <WifiOff className="w-3 h-3 mr-1" />
        Hors ligne
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestion des Appareils</h1>
        <p className="text-muted-foreground">
          Surveillez et gérez vos capteurs et appareils connectés
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Appareils</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devicesData?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Ligne</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {devicesData?.online || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hors Ligne</CardTitle>
            <WifiOff className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {devicesData?.offline || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des appareils */}
      <Card>
        <CardHeader>
          <CardTitle>Appareils Connectés</CardTitle>
          <CardDescription>
            {devicesData?.devices?.length || 0} appareil(s) enregistré(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {devicesData?.devices?.map((device: any) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{device.name || device.id}</p>
                    <p className="text-sm text-muted-foreground">
                      Type: {device.type} • Firmware: {device.firmware || "N/A"}
                    </p>
                    {device.location && (
                      <p className="text-sm text-muted-foreground">
                        📍 {device.location}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Mesures</p>
                    <p className="font-bold">{device.totalMeasurements || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Dernière activité</p>
                    <p className="text-sm">
                      {device.lastSeen
                        ? new Date(device.lastSeen).toLocaleString("fr-FR")
                        : "Jamais"}
                    </p>
                  </div>
                  {getStatusBadge(device.status)}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
