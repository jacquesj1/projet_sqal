import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { InfoTooltip } from "@components/ui/info-tooltip";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface SpectralRatiosChartProps {
  ratios: Record<string, number | undefined>;
}

export default function SpectralRatiosChart({ ratios }: SpectralRatiosChartProps) {
  const ALIAS_TO_CANONICAL: Record<string, string> = {
    violet_orange: "violet_orange_ratio",
    nir_violet: "nir_violet_ratio",
    lipid_discoloration: "discoloration_index",
    lipid_oxidation: "lipid_oxidation_index",
    freshness_meat: "freshness_meat_index",
    oil_oxidation: "oil_oxidation_index",
    red_violet: "red_violet_ratio",
    green_red_ratio: "green_red",
  };

  const DEFINITIONS: Record<
    string,
    {
      label: string;
      description: string;
      optimal?: [number, number];
      acceptable?: [number, number];
      color?: string;
    }
  > = {
    violet_orange_ratio: {
      label: "Violet/Orange",
      description: "Oxydation lipides (415nm/630nm)",
      optimal: [0.25, 0.45],
      acceptable: [0.2, 0.55],
      color: "#a855f7",
    },
    violet_orange: {
      label: "Violet/Orange",
      description: "Alias de violet_orange_ratio",
      optimal: [0.25, 0.45],
      acceptable: [0.2, 0.55],
      color: "#a855f7",
    },
    nir_violet_ratio: {
      label: "NIR/Violet",
      description: "Structure / homogénéité (910nm/415nm)",
      optimal: [1.2, 1.8],
      acceptable: [1.0, 2.0],
      color: "#0ea5e9",
    },
    nir_violet: {
      label: "NIR/Violet",
      description: "Alias de nir_violet_ratio",
      optimal: [1.2, 1.8],
      acceptable: [1.0, 2.0],
      color: "#0ea5e9",
    },
    discoloration_index: {
      label: "Discoloration",
      description: "Jaunissement [(555+590)/(415+445)]",
      optimal: [1.3, 1.7],
      acceptable: [1.1, 2.0],
      color: "#eab308",
    },
    lipid_discoloration: {
      label: "Discoloration",
      description: "Alias de discoloration_index",
      optimal: [1.3, 1.7],
      acceptable: [1.1, 2.0],
      color: "#eab308",
    },
    lipid_oxidation_index: {
      label: "Lipid Oxidation",
      description: "Oxydation acides gras [(630+680)/515]",
      optimal: [0.8, 1.2],
      acceptable: [0.7, 1.4],
      color: "#ef4444",
    },
    lipid_oxidation: {
      label: "Lipid Oxidation",
      description: "Alias de lipid_oxidation_index",
      optimal: [0.8, 1.2],
      acceptable: [0.7, 1.4],
      color: "#ef4444",
    },
    freshness_meat_index: {
      label: "Freshness (meat)",
      description: "Fraîcheur [(415+445)/(630+680)]",
      optimal: [0.35, 0.65],
      acceptable: [0.25, 0.75],
      color: "#22c55e",
    },
    freshness_meat: {
      label: "Freshness (meat)",
      description: "Alias de freshness_meat_index",
      optimal: [0.35, 0.65],
      acceptable: [0.25, 0.75],
      color: "#22c55e",
    },
    oil_oxidation_index: {
      label: "Oil Oxidation",
      description: "Oxydation huiles [(415+480)/(555+590)]",
      optimal: [0.5, 0.8],
      acceptable: [0.4, 0.9],
      color: "#f97316",
    },
    oil_oxidation: {
      label: "Oil Oxidation",
      description: "Alias de oil_oxidation_index",
      optimal: [0.5, 0.8],
      acceptable: [0.4, 0.9],
      color: "#f97316",
    },
    red_nir: {
      label: "Red/NIR",
      description: "Ratio (680nm/910nm)",
      color: "#dc2626",
    },
    red_orange: {
      label: "Red/Orange",
      description: "Ratio (680nm/630nm)",
      color: "#fb923c",
    },
    green_red: {
      label: "Green/Red",
      description: "Ratio (555nm/680nm)",
      color: "#16a34a",
    },
    green_red_ratio: {
      label: "Green/Red",
      description: "Alias de green_red",
      color: "#16a34a",
    },
    blue_green: {
      label: "Blue/Green",
      description: "Ratio (480nm/555nm)",
      color: "#2563eb",
    },
    red_violet_ratio: {
      label: "Red/Violet",
      description: "Oxydation hémoglobine (680nm/415nm)",
      color: "#b91c1c",
    },
    red_violet: {
      label: "Red/Violet",
      description: "Alias de red_violet_ratio",
      color: "#b91c1c",
    },
    yellow_blue_ratio: {
      label: "Yellow/Blue",
      description: "Coloration (590nm/445nm)",
      color: "#ca8a04",
    },
    ratio_clear_nir: {
      label: "Clear/NIR",
      description: "Canal Clear vs NIR",
      color: "#64748b",
    },
    nir_clear_ratio: {
      label: "NIR/Clear",
      description: "Canal NIR vs Clear",
      color: "#64748b",
    },
    normalized_clear: {
      label: "Normalized Clear",
      description: "Alias historique (normalisation Clear)",
      color: "#64748b",
    },
  };

  const ORDER = [
    "violet_orange_ratio",
    "nir_violet_ratio",
    "discoloration_index",
    "lipid_oxidation_index",
    "freshness_meat_index",
    "oil_oxidation_index",
    "red_nir",
    "red_orange",
    "green_red",
    "blue_green",
    "red_violet_ratio",
    "yellow_blue_ratio",
    "ratio_clear_nir",
    "nir_clear_ratio",
    "normalized_clear",
  ];

  // Collapse aliases onto canonical keys to avoid duplicates.
  // Prefer the canonical value if both alias and canonical exist.
  const byCanonical = new Map<string, { key: string; value: number }>();
  for (const [rawKey, rawValue] of Object.entries(ratios)) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
    const canonicalKey = ALIAS_TO_CANONICAL[rawKey] ?? rawKey;
    const existing = byCanonical.get(canonicalKey);
    if (!existing) {
      byCanonical.set(canonicalKey, { key: canonicalKey, value: rawValue });
      continue;
    }
    // If we already have a value and this new one is the canonical key, override.
    if (rawKey === canonicalKey) {
      byCanonical.set(canonicalKey, { key: canonicalKey, value: rawValue });
    }
  }

  const entries = Array.from(byCanonical.values()).map(({ key, value }) => {
    const d = DEFINITIONS[key];
    return {
      key,
      name: d?.label ?? key,
      value,
      description: d?.description ?? "Ratio spectral",
      optimal: d?.optimal,
      acceptable: d?.acceptable,
      color: d?.color ?? "#64748b",
    };
  });

  const orderIndex = new Map(ORDER.map((k, i) => [k, i] as const));
  const chartData = entries.sort((a, b) => {
    const ai = orderIndex.get(a.key);
    const bi = orderIndex.get(b.key);
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return a.key.localeCompare(b.key);
  });

  const chartHeight = Math.min(460, Math.max(220, chartData.length * 22 + 60));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Ratios Spectraux</CardTitle>
          <InfoTooltip
            side="left"
            maxWidth="md"
            content={
              "Affiche tous les ratios calculés par l’analyseur AS7341. Survoler une barre pour voir la définition et, quand disponible, les plages optimale/acceptable (définies dans le simulateur)."
            }
          />
        </div>
        <CardDescription className="text-xs">
          Ratios inter-canaux pour diagnostic qualité
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 10 }}
              width={110}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border rounded shadow-lg">
                      <p className="text-xs font-semibold" style={{ color: data.color }}>
                        {data.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{data.key}</p>
                      <p className="text-xs">
                        Valeur: <span className="font-bold">{Number(data.value).toFixed(3)}</span>
                      </p>
                      <p className="text-xs italic">{data.description}</p>
                      {data.optimal && (
                        <p className="text-xs text-muted-foreground">
                          Optimal: [{data.optimal[0]} ; {data.optimal[1]}]
                        </p>
                      )}
                      {data.acceptable && (
                        <p className="text-xs text-muted-foreground">
                          Acceptable: [{data.acceptable[0]} ; {data.acceptable[1]}]
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} opacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {chartData.map((ratio) => (
            <div key={ratio.key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: ratio.color, opacity: 0.7 }}
              />
              <span className="text-muted-foreground">
                {ratio.name}: {Number(ratio.value).toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
