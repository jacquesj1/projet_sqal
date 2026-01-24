// ============================================================================
// SQAL Frontend - System Page
// Configuration système et paramètres
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function System() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Système</h1>
        <p className="text-muted-foreground">
          Configuration et paramètres système
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Paramètres Généraux</CardTitle>
            <CardDescription>Configuration de l'application</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Langue, timezone, notifications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Intégrations</CardTitle>
            <CardDescription>APIs et services externes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Keycloak, WebSocket, TimescaleDB
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
