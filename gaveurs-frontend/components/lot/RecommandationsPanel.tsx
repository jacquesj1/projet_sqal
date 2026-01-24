"use client";

import React, { useEffect, useState } from "react";
import type {
  Recommandation,
  NiveauAlerte,
  ApiResponse,
} from "@/types/lot";

interface RecommandationsPanelProps {
  lotId: number;
  ecart: number;
  niveau: NiveauAlerte;
  className?: string;
}

interface RecommandationsResponse {
  recommandations: Recommandation[];
  ecart_actuel: number;
  niveau_alerte: NiveauAlerte;
}

export function RecommandationsPanel({
  lotId,
  ecart,
  niveau,
  className = "",
}: RecommandationsPanelProps) {
  const [recommandations, setRecommandations] = useState<Recommandation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecommandations = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(
          `${apiUrl}/api/ml/recommandations/lot/${lotId}`
        );

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data: ApiResponse<RecommandationsResponse> = await response.json();

        if (data.success && data.data) {
          setRecommandations(data.data.recommandations || []);
        } else {
          throw new Error(
            data.error || "Erreur lors du chargement des recommandations"
          );
        }
      } catch (err) {
        console.error("Erreur recommandations:", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    loadRecommandations();
  }, [lotId]);

  if (loading) {
    return (
      <div
        className={`mt-4 flex items-center justify-center rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4 ${className}`}
      >
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <span className="ml-2 text-blue-800">
          Chargement des recommandations...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`mt-4 rounded-lg border-l-4 border-red-500 bg-red-50 p-4 ${className}`}
      >
        <p className="text-red-800">
          ❌ Erreur : {error}
        </p>
      </div>
    );
  }

  if (recommandations.length === 0) {
    return (
      <div
        className={`mt-4 rounded-lg border-l-4 border-green-500 bg-green-50 p-4 ${className}`}
      >
        <p className="text-green-800">
          ✅ Aucune recommandation nécessaire - Le lot est conforme à la courbe
          théorique
        </p>
      </div>
    );
  }

  return (
    <div
      className={`mt-4 rounded-lg border-l-4 p-4 ${getBorderColor(niveau)} ${getBgColor(
        niveau
      )} ${className}`}
    >
      {/* Header */}
      <h4 className="mb-3 text-lg font-bold">💡 Recommandations IA</h4>

      {/* Liste des recommandations */}
      <div className="space-y-3">
        {recommandations.map((rec, idx) => (
          <RecommandationCard key={idx} recommandation={rec} />
        ))}
      </div>

      {/* Footer explicatif */}
      <div className="mt-4 border-t border-gray-200 pt-3">
        <p className="text-xs text-gray-600">
          Ces recommandations sont générées par un modèle de Machine Learning
          (Random Forest + Prophet) basé sur l'historique de gavage de ce lot
          et de lots similaires.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// RECOMMANDATION CARD
// ============================================================================

interface RecommandationCardProps {
  recommandation: Recommandation;
}

function RecommandationCard({ recommandation }: RecommandationCardProps) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Icône */}
        <span className="text-3xl">{getTypeIcon(recommandation.type)}</span>

        {/* Contenu */}
        <div className="flex-1">
          {/* Message principal */}
          <p className="font-medium text-gray-800">{recommandation.message}</p>

          {/* Ajustement de dose */}
          {recommandation.ajustement_dose !== 0 && (
            <div className="mt-2 rounded-md bg-gray-50 p-2">
              <p className="text-sm text-gray-600">
                Ajustement suggéré :
                <span
                  className={`ml-1 font-bold ${
                    recommandation.ajustement_dose > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {recommandation.ajustement_dose > 0 ? "+" : ""}
                  {recommandation.ajustement_dose}g par gavage
                </span>
              </p>
            </div>
          )}

          {/* Impact prévu */}
          {recommandation.impact_prevu && (
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p className="font-medium">Impact prévu :</p>
              <ul className="ml-4 list-inside list-disc">
                {recommandation.impact_prevu.poids_final_estime && (
                  <li>
                    Poids final estimé :{" "}
                    <span className="font-bold text-gray-800">
                      {recommandation.impact_prevu.poids_final_estime}g
                    </span>
                  </li>
                )}
                {recommandation.impact_prevu.jours_gavage_estimes && (
                  <li>
                    Durée totale estimée :{" "}
                    <span className="font-bold text-gray-800">
                      {recommandation.impact_prevu.jours_gavage_estimes} jours
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Badge urgence */}
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${getUrgenceBadgeStyle(
            recommandation.urgence
          )}`}
        >
          {recommandation.urgence}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getBorderColor(niveau: NiveauAlerte): string {
  const colors: Record<NiveauAlerte, string> = {
    info: "border-blue-500",
    warning: "border-orange-500",
    critique: "border-red-500",
  };

  return colors[niveau];
}

function getBgColor(niveau: NiveauAlerte): string {
  const colors: Record<NiveauAlerte, string> = {
    info: "bg-blue-50",
    warning: "bg-orange-50",
    critique: "bg-red-50",
  };

  return colors[niveau];
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    augmenter_dose: "⬆️",
    reduire_dose: "⬇️",
    maintenir: "✅",
    alerter_veterinaire: "🚨",
  };

  return icons[type] || "💡";
}

function getUrgenceBadgeStyle(urgence: NiveauAlerte): string {
  const styles: Record<NiveauAlerte, string> = {
    info: "bg-blue-100 text-blue-800",
    warning: "bg-orange-100 text-orange-800",
    critique: "bg-red-100 text-red-800",
  };

  return styles[urgence];
}

// ============================================================================
// VARIANTE COMPACT (Pour dashboard)
// ============================================================================

export function RecommandationsCompact({ lotId }: { lotId: number }) {
  const [recommandations, setRecommandations] = useState<Recommandation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(
          `${apiUrl}/api/ml/recommandations/lot/${lotId}`
        );
        const data: ApiResponse<RecommandationsResponse> = await response.json();

        if (data.success && data.data) {
          setRecommandations(data.data.recommandations || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [lotId]);

  if (loading) {
    return <div className="text-sm text-gray-600">Chargement...</div>;
  }

  if (recommandations.length === 0) {
    return (
      <div className="text-sm text-green-600">
        ✅ Aucune action nécessaire
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recommandations.slice(0, 2).map((rec, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2 rounded-md bg-orange-50 p-2 text-sm"
        >
          <span>{getTypeIcon(rec.type)}</span>
          <p className="flex-1 text-orange-800">{rec.message}</p>
        </div>
      ))}

      {recommandations.length > 2 && (
        <p className="text-xs text-gray-500">
          +{recommandations.length - 2} autre(s) recommandation(s)
        </p>
      )}
    </div>
  );
}
