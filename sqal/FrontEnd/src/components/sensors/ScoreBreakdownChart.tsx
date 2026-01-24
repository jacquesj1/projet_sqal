// ============================================================================
// Score Breakdown Chart
// Displays detailed score breakdown for VL53L8CH analysis
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { PieChart, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/ui/tooltip";
import { useMemo } from "react";

interface ScoreBreakdownProps {
  score_breakdown?: {
    volume_score?: number;
    uniformity_score?: number;
    reflectance_score?: number;
    amplitude_score?: number;
    defect_penalty?: number;
  };
}

export function ScoreBreakdownChart({ score_breakdown }: ScoreBreakdownProps) {
  const {
    volume_score = 0,
    uniformity_score = 0,
    reflectance_score = 0,
    amplitude_score = 0,
    defect_penalty = 0,
  } = score_breakdown || {};

  // useMemo to ensure chartData updates when scores change
  const chartData = useMemo(() => [
    {
      name: "Volume",
      score: volume_score * 100,
      fullMark: 100,
      description: "Évalue si le volume mesuré correspond aux standards",
    },
    {
      name: "Uniformité",
      score: uniformity_score * 100,
      fullMark: 100,
      description: "Mesure l'homogénéité de la surface du produit",
    },
    {
      name: "Réflectance",
      score: reflectance_score * 100,
      fullMark: 100,
      description: "Qualité des propriétés optiques de surface",
    },
    {
      name: "Amplitude",
      score: amplitude_score * 100,
      fullMark: 100,
      description: "Cohérence et stabilité du signal IR retourné",
    },
  ], [volume_score, uniformity_score, reflectance_score, amplitude_score]);

  if (!score_breakdown) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <PieChart className="h-4 w-4 text-blue-500" />
            Décomposition du Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Données non disponibles</p>
        </CardContent>
      </Card>
    );
  }

  // Couleurs fixes (pas Tailwind car ne fonctionne pas avec Recharts inline)
  const colors = {
    volume: "#3b82f6",      // blue-500
    uniformity: "#10b981",  // green-500
    reflectance: "#8b5cf6", // violet-500
    amplitude: "#f59e0b",   // amber-500
  };

  const colorArray = [colors.volume, colors.uniformity, colors.reflectance, colors.amplitude];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm">Décomposition du Score Qualité</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Le score final est calculé en combinant 4 critères : Volume (volumétrie du produit),
                  Uniformité (homogénéité de surface), Réflectance (propriétés optiques),
                  et Amplitude (stabilité du signal). Une pénalité est appliquée en cas de défauts.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="text-xs">
          Contribution de chaque critère au score final
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" fontSize={12} />
            <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={80} />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number, _name: string, props: any) => [
                `${value.toFixed(1)}%`,
                props?.payload?.description || ''
              ]}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={colorArray[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Defect Penalty */}
        {defect_penalty > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-900">Pénalité Défauts</span>
              <span className="text-sm font-bold text-red-600">-{(defect_penalty * 100).toFixed(1)}%</span>
            </div>
            <p className="text-xs text-red-700 mt-1">
              Le score final est réduit en raison de la présence de défauts
            </p>
          </div>
        )}

        {/* Score Summary */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {chartData.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded bg-gray-50">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colorArray[idx] }}
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs font-medium cursor-help">{item.name}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{item.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-sm font-bold" style={{ color: colorArray[idx] }}>
                {item.score.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ScoreBreakdownChart;
