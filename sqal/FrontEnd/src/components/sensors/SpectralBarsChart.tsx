import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { InfoTooltip } from "@components/ui/info-tooltip";

// Configuration des canaux spectraux (identique à Python)
export const SPECTRAL_CHANNELS = {
  F1_violet: { wavelength: 415, color: "#8B00FF", label: "Violet" },
  F2_indigo: { wavelength: 445, color: "#4B0082", label: "Indigo" },
  F3_blue: { wavelength: 480, color: "#0000FF", label: "Blue" },
  F4_cyan: { wavelength: 515, color: "#00FFFF", label: "Cyan" },
  F5_green: { wavelength: 555, color: "#00FF00", label: "Green" },
  F6_yellow: { wavelength: 590, color: "#FFFF00", label: "Yellow" },
  F7_orange: { wavelength: 630, color: "#FF8C00", label: "Orange" },
  F8_red: { wavelength: 680, color: "#FF0000", label: "Red" },
  NIR: { wavelength: 910, color: "#8B4513", label: "NIR" },
};

interface SpectralBarsChartProps {
  rawCounts: Record<string, number>;
  showValues?: boolean;
}

export default function SpectralBarsChart({ rawCounts, showValues = true }: SpectralBarsChartProps) {
  // Prepare chart data
  const chartData = Object.entries(SPECTRAL_CHANNELS).map(([key, info]) => ({
    channel: key,
    label: info.label,
    wavelength: info.wavelength,
    count: rawCounts[key] || 0,
    color: info.color,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Spectre Brut AS7341</CardTitle>
          <InfoTooltip
            side="left"
            maxWidth="md"
            content={
              "Valeurs brutes (0-65535) par canal. Elles reflètent l’intensité lumineuse captée et dépendent de l’éclairage, du produit, du gain et du temps d’intégration. Saturation à 65535 (à éviter).\n\nCanaux: F1~415nm (oxydation précoce), F2~445nm (pigments/fraîcheur), F3~480nm (composés azotés), F4~515nm (transition), F5~555nm (chlorophylle/bile), F6~590nm (caroténoïdes/gras), F7~630nm (hémoglobine/myoglobine), F8~680nm (oxydation lipidique), NIR~910nm (eau/structure)."
            }
          />
        </div>
        <CardDescription className="text-xs">
          9 canaux spectraux (415nm - 910nm)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis
              label={{
                value: "Counts (raw)",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
              }}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border rounded shadow-lg">
                      <p className="text-xs font-semibold" style={{ color: data.color }}>
                        {data.label} ({data.wavelength}nm)
                      </p>
                      <p className="text-xs">
                        Counts: <span className="font-bold">{data.count.toFixed(0)}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {showValues && (
          <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
            {chartData.map((ch) => (
              <div key={ch.channel} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: ch.color }}
                />
                <span className="text-muted-foreground truncate">
                  {ch.label}: {ch.count.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
