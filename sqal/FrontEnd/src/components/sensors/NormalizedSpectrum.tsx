import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { SPECTRAL_CHANNELS } from "./SpectralBarsChart";
import { InfoTooltip } from "@components/ui/info-tooltip";

interface NormalizedSpectrumProps {
  rawCounts: Record<string, number>;
  referenceSpectrum?: Record<string, number>;
  showReference?: boolean;
}

export default function NormalizedSpectrum({
  rawCounts,
  referenceSpectrum,
  showReference = false,
}: NormalizedSpectrumProps) {
  // Normalize to 0-1
  const spectralCounts = Object.fromEntries(
    Object.entries(rawCounts).filter(([key]) => key in SPECTRAL_CHANNELS)
  );

  const maxCount = Math.max(...Object.values(spectralCounts), 1);

  // Prepare chart data
  const chartData = Object.entries(SPECTRAL_CHANNELS).map(([key, info]) => {
    const normalized = (spectralCounts[key] || 0) / maxCount;
    const reference = referenceSpectrum
      ? (referenceSpectrum[key] || 0) / Math.max(...Object.values(referenceSpectrum), 1)
      : null;

    return {
      wavelength: info.wavelength,
      label: info.label,
      normalized: normalized,
      reference: reference,
      color: info.color,
    };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Spectre Normalisé</CardTitle>
          <InfoTooltip
            side="left"
            maxWidth="md"
            content={
              "Profil spectral normalisé (0-1): on divise chaque canal par le maximum du spectre pour comparer la *forme* (répartition relative entre canaux) sans dépendre de l’intensité globale (éclairage/gain/intégration).\n\nInterprétation: variations de forme = changements de composition/oxydation/pigments; intensité brute élevée seule peut venir du gain ou de l’éclairage."
            }
          />
        </div>
        <CardDescription className="text-xs">
          Profil spectral normalisé (0-1)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="wavelength"
              label={{
                value: "Wavelength (nm)",
                position: "insideBottom",
                offset: -5,
                fontSize: 10,
              }}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              label={{
                value: "Norm. Intensity",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
              }}
              domain={[0, 1.1]}
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
                        Intensity: <span className="font-bold">{data.normalized.toFixed(3)}</span>
                      </p>
                      {data.reference !== null && (
                        <p className="text-xs text-muted-foreground">
                          Ref: {data.reference.toFixed(3)}
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            {showReference && referenceSpectrum && (
              <Legend wrapperStyle={{ fontSize: "10px" }} />
            )}

            {/* Actual spectrum */}
            <Line
              type="monotone"
              dataKey="normalized"
              stroke="#000000"
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={payload.color}
                    stroke="#000"
                    strokeWidth={1.5}
                  />
                );
              }}
              name="Mesure actuelle"
            />

            {/* Reference spectrum */}
            {showReference && referenceSpectrum && (
              <Line
                type="monotone"
                dataKey="reference"
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Référence"
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        {/* Color legend */}
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {chartData.map((ch) => (
            <div
              key={ch.wavelength}
              className="flex items-center gap-1 text-xs"
            >
              <div
                className="w-3 h-3 rounded-full border-2 border-black"
                style={{ backgroundColor: ch.color }}
              />
              <span className="text-muted-foreground">{ch.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
