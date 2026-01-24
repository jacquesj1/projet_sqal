// ============================================================================
// CombinedDefectsTable - Combined defects from VL53L8CH + AS7341 + Fusion
// Matching Python fusion_visualizations.py defects display
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

interface Defect {
  type: string;
  source: string;
  severity?: number | string;
  position?: { x: number; y: number };
}

interface CombinedDefectsTableProps {
  fusionDefects?: Defect[];
  vl53l8chDefects?: Array<{ type: string; position: { x: number; y: number }; severity: string }>;
  as7341Defects?: string[];
}

export default function CombinedDefectsTable({
  fusionDefects = [],
  vl53l8chDefects = [],
  as7341Defects = [],
}: CombinedDefectsTableProps) {
  // Combine all defects with source information
  const allDefects: Defect[] = [
    ...fusionDefects.map((d) => ({ ...d, source: d.source || "fusion" })),
    ...vl53l8chDefects.map((d) => ({
      type: d.type,
      source: "vl53l8ch",
      severity: d.severity,
      position: d.position,
    })),
    ...as7341Defects.map((d) => ({
      type: d,
      source: "as7341",
      severity: undefined,
      position: undefined,
    })),
  ];

  const getSeverityBadge = (severity: number | string | undefined) => {
    if (severity === undefined) {
      return <Badge variant="outline" className="text-xs">N/A</Badge>;
    }

    const severityNum = typeof severity === "string"
      ? severity === "high" ? 0.8 : severity === "medium" ? 0.5 : 0.2
      : severity;

    if (severityNum > 0.7) {
      return <Badge variant="destructive" className="text-xs">Élevée</Badge>;
    } else if (severityNum > 0.4) {
      return <Badge variant="default" className="text-xs bg-orange-500">Moyenne</Badge>;
    } else {
      return <Badge variant="secondary" className="text-xs">Faible</Badge>;
    }
  };

  const getSourceIcon = (source: string) => {
    if (source === "vl53l8ch") {
      return <div className="w-3 h-3 rounded-full bg-blue-500" title="VL53L8CH (ToF)" />;
    } else if (source === "as7341") {
      return <div className="w-3 h-3 rounded-full bg-orange-500" title="AS7341 (Spectral)" />;
    } else if (source === "fusion") {
      return <div className="w-3 h-3 rounded-full bg-purple-500" title="Fusion" />;
    }
    return <Info className="h-3 w-3 text-gray-500" />;
  };

  const getSourceLabel = (source: string) => {
    const sourceLabels: Record<string, string> = {
      vl53l8ch: "ToF",
      as7341: "Spectral",
      fusion: "Fusion",
      VL53L8CH: "ToF",
      AS7341: "Spectral",
    };
    return sourceLabels[source] || source;
  };

  const totalDefects = allDefects.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          Défauts Détectés (Multi-Capteurs)
        </CardTitle>
        <CardDescription className="text-xs">
          {totalDefects} défaut(s) total détecté(s) par les deux capteurs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalDefects === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-sm font-semibold text-green-600">
              ✓ Aucun défaut détecté
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Produit conforme aux critères de qualité
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground border-b pb-2">
              <div className="col-span-1">#</div>
              <div className="col-span-2">Source</div>
              <div className="col-span-5">Type de défaut</div>
              <div className="col-span-2">Sévérité</div>
              <div className="col-span-2">Position</div>
            </div>

            {/* Defect rows */}
            {allDefects.map((defect, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 text-xs items-center py-2 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                {/* Index */}
                <div className="col-span-1 font-medium text-muted-foreground">
                  {idx + 1}
                </div>

                {/* Source */}
                <div className="col-span-2 flex items-center gap-1">
                  {getSourceIcon(defect.source)}
                  <span className="text-xs">{getSourceLabel(defect.source)}</span>
                </div>

                {/* Defect Type */}
                <div className="col-span-5 font-medium">
                  {defect.type}
                </div>

                {/* Severity */}
                <div className="col-span-2">
                  {getSeverityBadge(defect.severity)}
                </div>

                {/* Position */}
                <div className="col-span-2 text-muted-foreground">
                  {defect.position
                    ? `(${defect.position.x}, ${defect.position.y})`
                    : "—"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {totalDefects > 0 && (
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">
                  ToF: {vl53l8chDefects.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-muted-foreground">
                  Spectral: {as7341Defects.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-muted-foreground">
                  Fusion: {fusionDefects.length}
                </span>
              </div>
            </div>
            <span className="font-semibold">Total: {totalDefects}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
