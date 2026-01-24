"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Lot, DonneeGavageQuotidien } from "@/types/lot";

export default function HistoriquePage() {
  const params = useParams();
  const lotId = parseInt(params?.id as string, 10);

  const [lot, setLot] = useState<Lot | null>(null);
  const [historique, setHistorique] = useState<DonneeGavageQuotidien[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isNaN(lotId)) {
      loadData();
    }
  }, [lotId]);

  const loadData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const [lotRes, histRes] = await Promise.all([
        fetch(`${apiUrl}/api/lots/${lotId}`),
        fetch(`${apiUrl}/api/lots/${lotId}/historique`),
      ]);

      const lotData = await lotRes.json();
      const histData = await histRes.json();

      setLot(lotData);
      setHistorique(Array.isArray(histData) ? histData : []);
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!lot) {
    return <div className="p-6">Lot non trouvé</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/lots" className="mb-4 inline-block text-blue-600 hover:underline">
          ← Retour aux lots
        </Link>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">📋 Historique Gavage</h1>
            <p className="mt-2 text-gray-600">
              Lot {lot.code_lot} - {historique.length} enregistrement(s)
            </p>
          </div>

          <Link
            href={`/lots/${lotId}/gavage`}
            className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700"
          >
            📝 Nouveau Gavage
          </Link>
        </div>

        {historique.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-xl text-gray-600">Aucun gavage enregistré</p>
          </div>
        ) : (
          <div className="space-y-4">
            {historique.map((gavage) => (
              <GavageCard key={gavage.id} gavage={gavage} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GavageCard({ gavage }: { gavage: DonneeGavageQuotidien }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-4">
            <h3 className="text-xl font-bold">
              Jour {gavage.jour_gavage} -{" "}
              {new Date(gavage.date_gavage).toLocaleDateString("fr-FR")}
            </h3>
            {gavage.alerte_generee && (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
                ⚠️ {gavage.niveau_alerte?.toUpperCase()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-gray-600">Matin</p>
              <p className="font-bold">{gavage.dose_matin}g à {gavage.heure_gavage_matin}</p>
            </div>
            <div>
              <p className="text-gray-600">Soir</p>
              <p className="font-bold">{gavage.dose_soir}g à {gavage.heure_gavage_soir}</p>
            </div>
            <div>
              <p className="text-gray-600">Poids moyen</p>
              <p className="font-bold">{gavage.poids_moyen_mesure}g</p>
            </div>
            <div>
              <p className="text-gray-600">Échantillon</p>
              <p className="font-bold">{gavage.nb_canards_peses} canards</p>
            </div>
          </div>

          {gavage.ecart_poids_pourcent !== null && gavage.ecart_poids_pourcent !== undefined && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-gray-600">Écart courbe:</span>
              <span
                className={`font-bold ${
                  Math.abs(gavage.ecart_poids_pourcent) < 5
                    ? "text-green-600"
                    : Math.abs(gavage.ecart_poids_pourcent) < 10
                    ? "text-orange-600"
                    : "text-red-600"
                }`}
              >
                {gavage.ecart_poids_pourcent > 0 ? "+" : ""}
                {gavage.ecart_poids_pourcent.toFixed(1)}%
              </span>
              {!gavage.suit_courbe_theorique && (
                <span className="text-gray-500">
                  (Écart volontaire)
                </span>
              )}
            </div>
          )}

          {gavage.remarques && (
            <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
              <p className="text-gray-700">📝 {gavage.remarques}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-4 rounded-lg bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
        >
          {expanded ? "Masquer" : "Détails"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-700">Conditions stabule:</p>
              <p>Température: {gavage.temperature_stabule}°C</p>
              <p>Humidité: {gavage.humidite_stabule}%</p>
            </div>
            <div>
              <p className="font-medium text-gray-700">Poids échantillon:</p>
              <div className="flex flex-wrap gap-1">
                {gavage.poids_echantillon.map((p, idx) => (
                  <span key={idx} className="rounded bg-gray-100 px-2 py-1">
                    {p}g
                  </span>
                ))}
              </div>
            </div>
          </div>

          {gavage.raison_ecart && (
            <div className="mt-3 rounded-md bg-yellow-50 p-3">
              <p className="text-sm text-yellow-800">
                <strong>Raison de l'écart:</strong> {gavage.raison_ecart}
              </p>
            </div>
          )}

          {gavage.recommandations_ia && gavage.recommandations_ia.length > 0 && (
            <div className="mt-3 rounded-md bg-purple-50 p-3">
              <p className="mb-2 text-sm font-bold text-purple-900">
                💡 Recommandations IA:
              </p>
              <ul className="space-y-1 text-sm text-purple-800">
                {gavage.recommandations_ia.map((rec: any, idx: number) => (
                  <li key={idx}>• {rec.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
