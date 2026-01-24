import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { InfoTooltip } from "@components/ui/info-tooltip";

interface KeyIndicatorsBarsProps {
  freshness: number;     // 0-1
  fatQuality: number;    // 0-1
  oxidation: number;     // 0-1
  ratios: {
    vo?: number;         // V/O ratio (Violet/Orange)
    lipid?: number;      // Lipid discoloration index
    nir_v?: number;      // NIR/Violet ratio
  };
}

export default function KeyIndicatorsBars({
  freshness = 0,
  fatQuality = 0,
  oxidation = 0,
  ratios = {},
}: KeyIndicatorsBarsProps) {

  const indicators = [
    {
      label: "Freshness",
      value: freshness,
      ratio: ratios.vo || 0,
      ratioLabel: "V/O",
      color: "bg-green-600",
      progressColor: "green",
    },
    {
      label: "Fat Quality",
      value: fatQuality,
      ratio: ratios.nir_v || 0,
      ratioLabel: "NIR/V",
      color: "bg-orange-500",
      progressColor: "orange",
    },
    {
      label: "Oxidation",
      value: oxidation,
      ratio: ratios.lipid || 0,
      ratioLabel: "Discol. Index",
      color: "bg-red-600",
      progressColor: "red",
    },
  ];

  return (
    <Card data-testid="key-indicators-bars">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Key Indicators</CardTitle>
          <InfoTooltip
            side="left"
            maxWidth="md"
            content={
              "Les barres montrent des indices 0-1 (qualité). Les ratios affichés à droite sont des marqueurs spectrales interprétables:\n  - V/O (Violet/Orange): lié à l’oxydation des lipides (415/630).\n  - NIR/V (NIR/Violet): structure/homogénéité (910/415).\n  - Discoloration index: jaunissement [(555+590)/(415+445)]."
            }
          />
        </div>
        <CardDescription className="text-xs">
          Indicateurs clés avec ratios spectraux
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {indicators.map((indicator, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{indicator.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{indicator.ratioLabel}:</span>
                <span className="font-semibold">{indicator.ratio.toFixed(2)}</span>
              </div>
            </div>

            {/* Custom Progress Bar */}
            <div className="relative h-6 bg-gray-200 rounded-md overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full ${indicator.color} transition-all duration-300`}
                style={{ width: `${Math.min(indicator.value * 100, 100)}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-end pr-2">
                <span className="text-xs font-bold text-white drop-shadow-md">
                  {(indicator.value * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
          <p>• V/O: 415nm/630nm (oxydation lipides)</p>
          <p>• NIR/V: 910nm/415nm (structure / homogénéité)</p>
          <p>• Discoloration: (555+590)/(415+445) (jaunissement)</p>
        </div>
      </CardContent>
    </Card>
  );
}
