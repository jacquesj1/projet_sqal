"use client";

import React, { useEffect, useState } from "react";
import type { Lot, StatutLot, ApiListResponse } from "@/types/lot";

interface LotSelectorProps {
  gaveurId: number;
  onLotSelect: (lot: Lot) => void;
  filterStatut?: StatutLot[];
  selectedLotId?: number;
  className?: string;
}

export function LotSelector({
  gaveurId,
  onLotSelect,
  filterStatut,
  selectedLotId,
  className = "",
}: LotSelectorProps) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLots = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/lots/gaveur/${gaveurId}`);

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data: ApiListResponse<Lot> = await response.json();

        if (data.success) {
          setLots(data.data || []);
        } else {
          throw new Error(data.error || "Erreur lors du chargement des lots");
        }
      } catch (err) {
        console.error("Erreur chargement lots:", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    if (gaveurId) {
      loadLots();
    }
  }, [gaveurId]);

  // Filtrer les lots par statut
  const lotsFiltered = filterStatut
    ? lots.filter((l) => filterStatut.includes(l.statut))
    : lots;

  // Trier par statut puis par code_lot
  const lotsSorted = [...lotsFiltered].sort((a, b) => {
    // Lots en_gavage en premier
    if (a.statut === "en_gavage" && b.statut !== "en_gavage") return -1;
    if (a.statut !== "en_gavage" && b.statut === "en_gavage") return 1;

    // Puis par code_lot
    return a.code_lot.localeCompare(b.code_lot);
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lotId = parseInt(e.target.value, 10);
    const lot = lots.find((l) => l.id === lotId);

    if (lot) {
      onLotSelect(lot);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <span className="text-gray-600">Chargement des lots...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg bg-red-50 p-4 ${className}`}>
        <p className="text-red-800">❌ {error}</p>
      </div>
    );
  }

  if (lotsSorted.length === 0) {
    return (
      <div className={`rounded-lg bg-yellow-50 p-4 ${className}`}>
        <p className="text-yellow-800">
          ⚠️ Aucun lot trouvé
          {filterStatut && ` avec statut: ${filterStatut.join(", ")}`}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedLotId || ""}
        onChange={handleChange}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-base font-medium shadow-sm transition-all hover:border-blue-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <option value="">-- Sélectionner un lot --</option>

        {lotsSorted.map((lot) => (
          <option key={lot.id} value={lot.id}>
            {lot.code_lot} - {lot.site_origine} ({lot.nombre_canards} canards) -{" "}
            {getStatutLabel(lot.statut)} - J{lot.nombre_jours_gavage_ecoules}
          </option>
        ))}
      </select>

      {/* Icône dropdown */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <svg
          className="h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}

// Helper: Obtenir label français pour statut
function getStatutLabel(statut: StatutLot): string {
  const labels: Record<StatutLot, string> = {
    en_preparation: "En préparation",
    en_gavage: "En gavage",
    termine: "Terminé",
    abattu: "Abattu",
  };

  return labels[statut] || statut;
}

// ============================================================================
// VARIANTE AVEC CARDS (Alternative visuelle)
// ============================================================================

interface LotCardSelectorProps {
  gaveurId: number;
  onLotSelect: (lot: Lot) => void;
  filterStatut?: StatutLot[];
  selectedLotId?: number;
}

export function LotCardSelector({
  gaveurId,
  onLotSelect,
  filterStatut,
  selectedLotId,
}: LotCardSelectorProps) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLots = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/lots/gaveur/${gaveurId}`);
        const data: ApiListResponse<Lot> = await response.json();

        if (data.success) {
          setLots(data.data || []);
        }
      } catch (err) {
        console.error("Erreur:", err);
      } finally {
        setLoading(false);
      }
    };

    if (gaveurId) {
      loadLots();
    }
  }, [gaveurId]);

  const lotsFiltered = filterStatut
    ? lots.filter((l) => filterStatut.includes(l.statut))
    : lots;

  if (loading) {
    return <div className="text-center text-gray-600">Chargement...</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lotsFiltered.map((lot) => (
        <button
          key={lot.id}
          onClick={() => onLotSelect(lot)}
          className={`rounded-lg border-2 p-4 text-left transition-all hover:shadow-lg ${
            selectedLotId === lot.id
              ? "border-blue-500 bg-blue-50 shadow-md"
              : "border-gray-200 bg-white hover:border-blue-300"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">{lot.code_lot}</h3>
            <span
              className={`rounded-full px-2 py-1 text-xs font-bold ${getStatutColor(
                lot.statut
              )}`}
            >
              {getStatutLabel(lot.statut)}
            </span>
          </div>

          <div className="space-y-1 text-sm text-gray-600">
            <p>📍 {lot.site_origine}</p>
            <p>🦆 {lot.nombre_canards} canards</p>
            <p>
              📊 J{lot.nombre_jours_gavage_ecoules} / ~14
            </p>
            <p>
              ⚖️ {lot.poids_moyen_actuel}g / {lot.objectif_poids_final}g
            </p>
          </div>

          {lot.taux_conformite && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Conformité: <span className="font-bold">{lot.taux_conformite.toFixed(1)}%</span>
              </p>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function getStatutColor(statut: StatutLot): string {
  const colors: Record<StatutLot, string> = {
    en_preparation: "bg-gray-100 text-gray-800",
    en_gavage: "bg-green-100 text-green-800",
    termine: "bg-blue-100 text-blue-800",
    abattu: "bg-purple-100 text-purple-800",
  };

  return colors[statut] || "bg-gray-100 text-gray-800";
}
