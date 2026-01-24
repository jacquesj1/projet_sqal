// ============================================================================
// SQAL Frontend - Sensors Page
// Vue d'ensemble des capteurs et données brutes
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Sensors() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Capteurs</h1>
        <p className="text-muted-foreground">
          Surveillance des capteurs VL53L8CH et AS7341
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>VL53L8CH - Time of Flight</CardTitle>
            <CardDescription>Capteur de distance et profondeur</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configuration et données en temps réel du capteur ToF
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AS7341 - Spectral</CardTitle>
            <CardDescription>Capteur spectral 11 canaux</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Analyse spectrale et indices de qualité
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
