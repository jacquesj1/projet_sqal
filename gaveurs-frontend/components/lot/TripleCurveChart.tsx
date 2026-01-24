"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import type {
  CurvePoint,
  CourbePrediction,
  NiveauAlerte,
} from "@/types/lot";
import { SEUILS_ALERTE, getNiveauAlerteFromEcart } from "@/types/lot";

interface TripleCurveChartProps {
  lotId: number;
  codeLot: string;
  courbeTheorique: CurvePoint[];
  courbeReelle: CurvePoint[];
  courbePrediction?: CourbePrediction;
  showLegend?: boolean;
  height?: number;
}

export function TripleCurveChart({
  lotId,
  codeLot,
  courbeTheorique,
  courbeReelle,
  courbePrediction,
  showLegend = true,
  height = 400,
}: TripleCurveChartProps) {
  // Calculer l'écart actuel
  const ecartActuel = useMemo(() => {
    if (courbeReelle.length === 0 || courbeTheorique.length === 0) return 0;

    const dernierPointReel = courbeReelle[courbeReelle.length - 1];
    const pointTheoriqueCorrespondant = courbeTheorique.find(
      (p) => p.jour === dernierPointReel.jour
    );

    if (!pointTheoriqueCorrespondant) return 0;

    const ecart =
      ((dernierPointReel.poids - pointTheoriqueCorrespondant.poids) /
        pointTheoriqueCorrespondant.poids) *
      100;

    return ecart;
  }, [courbeReelle, courbeTheorique]);

  // Déterminer niveau d'alerte
  const niveauAlerte = useMemo(() => {
    return getNiveauAlerteFromEcart(ecartActuel);
  }, [ecartActuel]);

  // Préparer les données pour Recharts
  const chartData = useMemo(() => {
    // Combiner toutes les courbes
    const maxJour = Math.max(
      ...courbeTheorique.map((p) => p.jour),
      ...courbeReelle.map((p) => p.jour),
      ...(courbePrediction?.points_predits.map((p) => p.jour) || [])
    );

    const data = [];

    for (let jour = 1; jour <= maxJour; jour++) {
      const pointTheorique = courbeTheorique.find((p) => p.jour === jour);
      const pointReel = courbeReelle.find((p) => p.jour === jour);
      const pointPrediction = courbePrediction?.points_predits.find(
        (p) => p.jour === jour
      );

      data.push({
        jour,
        theorique: pointTheorique?.poids || null,
        reelle: pointReel?.poids || null,
        prediction: pointPrediction?.poids || null,
        predictionLower: pointPrediction?.lower || null,
        predictionUpper: pointPrediction?.upper || null,
      });
    }

    return data;
  }, [courbeTheorique, courbeReelle, courbePrediction]);

  const shouldShowAlerte =
    Math.abs(ecartActuel) >= SEUILS_ALERTE.ECART_INFO;

  return (
    <div className="rounded-lg bg-white p-6 shadow-lg">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">
          📈 Courbes de Gavage - Lot {codeLot}
        </h3>

        {shouldShowAlerte && (
          <div
            className={`flex items-center gap-2 rounded-lg px-4 py-2 ${getNiveauAlerteStyle(
              niveauAlerte
            )}`}
          >
            <span className="text-lg">
              {getNiveauAlerteIcon(niveauAlerte)}
            </span>
            <div>
              <p className="text-sm font-bold">
                Écart détecté : {ecartActuel > 0 ? "+" : ""}
                {ecartActuel.toFixed(1)}%
              </p>
              <p className="text-xs">
                {ecartActuel > 0 ? "En avance" : "En retard"} sur courbe
                théorique
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Graphique */}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            dataKey="jour"
            label={{
              value: "Jour de gavage",
              position: "insideBottom",
              offset: -5,
              style: { fontWeight: "bold" },
            }}
            tick={{ fill: "#6b7280" }}
          />

          <YAxis
            label={{
              value: "Poids moyen (g)",
              angle: -90,
              position: "insideLeft",
              style: { fontWeight: "bold" },
            }}
            tick={{ fill: "#6b7280" }}
          />

          <Tooltip content={<CustomTooltip />} />

          {showLegend && (
            <Legend
              verticalAlign="top"
              height={36}
              iconType="line"
              wrapperStyle={{ paddingBottom: "10px" }}
            />
          )}

          {/* Zone de confiance prédiction (en arrière-plan) */}
          {courbePrediction && courbePrediction.points_predits.length > 0 && (
            <>
              <Area
                type="monotone"
                dataKey="predictionUpper"
                stroke="none"
                fill="#f59e0b"
                fillOpacity={0.1}
              />
              <Area
                type="monotone"
                dataKey="predictionLower"
                stroke="none"
                fill="#f59e0b"
                fillOpacity={0.1}
              />
            </>
          )}

          {/* Courbe Théorique (Bleu) */}
          <Line
            type="monotone"
            dataKey="theorique"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Théorique (PySR)"
            dot={false}
            connectNulls
          />

          {/* Courbe Réelle (Vert) */}
          <Line
            type="monotone"
            dataKey="reelle"
            stroke="#10b981"
            strokeWidth={3}
            name="Réelle"
            dot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
            connectNulls
          />

          {/* Courbe Prédiction IA (Orange pointillé) */}
          {courbePrediction && courbePrediction.points_predits.length > 0 && (
            <Line
              type="monotone"
              dataKey="prediction"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Prédiction IA"
              dot={{
                r: 4,
                fill: "#f59e0b",
                stroke: "#fff",
                strokeWidth: 2,
              }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Légende personnalisée (en bas) */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t border-gray-200 pt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 rounded bg-blue-500"></div>
          <span className="text-gray-700">
            Théorique (PySR Euralis)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-3 w-8 rounded bg-green-500"></div>
          <span className="text-gray-700">Réelle (données saisies)</span>
        </div>

        {courbePrediction && (
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-8 rounded border-2 border-dashed border-orange-500"
              style={{ borderStyle: "dashed" }}
            ></div>
            <span className="text-gray-700">
              Prédiction IA (si écart &gt; {SEUILS_ALERTE.ECART_WARNING}%)
            </span>
          </div>
        )}
      </div>

      {/* Statistiques résumées */}
      <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-xs text-gray-600">Dernier poids réel</p>
          <p className="text-lg font-bold text-gray-800">
            {courbeReelle.length > 0
              ? `${courbeReelle[courbeReelle.length - 1].poids}g`
              : "N/A"}
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-600">Poids théorique attendu</p>
          <p className="text-lg font-bold text-blue-600">
            {courbeTheorique.length > 0 && courbeReelle.length > 0
              ? `${
                  courbeTheorique.find(
                    (p) =>
                      p.jour ===
                      courbeReelle[courbeReelle.length - 1].jour
                  )?.poids || "N/A"
                }g`
              : "N/A"}
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-600">Écart actuel</p>
          <p
            className={`text-lg font-bold ${
              Math.abs(ecartActuel) < SEUILS_ALERTE.ECART_INFO
                ? "text-green-600"
                : Math.abs(ecartActuel) < SEUILS_ALERTE.ECART_CRITIQUE
                ? "text-orange-600"
                : "text-red-600"
            }`}
          >
            {ecartActuel > 0 ? "+" : ""}
            {ecartActuel.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-3 shadow-lg">
      <p className="mb-2 font-bold text-gray-800">Jour {label}</p>

      {payload.map((entry, index) => {
        if (!entry.value) return null;

        return (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            ></div>
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-bold" style={{ color: entry.color }}>
              {typeof entry.value === "number"
                ? `${Math.round(entry.value)}g`
                : entry.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getNiveauAlerteStyle(niveau: NiveauAlerte): string {
  const styles: Record<NiveauAlerte, string> = {
    info: "bg-blue-100 text-blue-800 border border-blue-200",
    warning: "bg-orange-100 text-orange-800 border border-orange-200",
    critique: "bg-red-100 text-red-800 border border-red-200",
  };

  return styles[niveau];
}

function getNiveauAlerteIcon(niveau: NiveauAlerte): string {
  const icons: Record<NiveauAlerte, string> = {
    info: "ℹ️",
    warning: "⚠️",
    critique: "🚨",
  };

  return icons[niveau];
}
