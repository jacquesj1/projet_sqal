// ============================================================================
// Admin Firmware Page
// Gestion des mises à jour firmware OTA
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Upload, Download, CheckCircle } from "lucide-react";

export function AdminFirmwarePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Firmware OTA</h1>
        <p className="text-muted-foreground">
          Gestion des mises à jour firmware Over-The-Air
        </p>
      </div>

      {/* Version actuelle */}
      <Card>
        <CardHeader>
          <CardTitle>Version Actuelle</CardTitle>
          <CardDescription>Firmware déployé en production</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">v3.2.1</p>
              <p className="text-sm text-muted-foreground">
                Déployé le 15/12/2024
              </p>
            </div>
            <Badge className="bg-green-500">
              <CheckCircle className="w-3 h-3 mr-1" />
              Stable
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Upload nouveau firmware */}
      <Card>
        <CardHeader>
          <CardTitle>Téléverser un Nouveau Firmware</CardTitle>
          <CardDescription>
            Fichier .bin pour ESP32
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Glissez-déposez votre fichier firmware ou cliquez pour parcourir
            </p>
            <Button>Sélectionner un fichier</Button>
          </div>
        </CardContent>
      </Card>

      {/* Historique des versions */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Versions</CardTitle>
          <CardDescription>Versions précédentes disponibles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { version: "v3.2.1", date: "15/12/2024", status: "current" },
              { version: "v3.2.0", date: "01/12/2024", status: "archived" },
              { version: "v3.1.5", date: "15/11/2024", status: "archived" },
            ].map((firmware) => (
              <div
                key={firmware.version}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{firmware.version}</p>
                  <p className="text-sm text-muted-foreground">
                    Publié le {firmware.date}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {firmware.status === "current" ? (
                    <Badge className="bg-green-500">Actuelle</Badge>
                  ) : (
                    <Badge variant="secondary">Archivée</Badge>
                  )}
                  <Button size="sm" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
