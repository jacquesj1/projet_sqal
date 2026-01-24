"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Package, TrendingUp, CheckCircle, Clock, AlertTriangle, BarChart3, Zap } from "lucide-react";
import type { Lot, StatutLot } from "@/types/lot";
import Breadcrumb from "@/components/Breadcrumb";

export default function LotsPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState<StatutLot | "tous">("tous");

  // Hardcoded gaveur_id pour démo (devrait venir du contexte Auth)
  const GAVEUR_ID = 1;

  useEffect(() => {
    loadLots();
  }, []);

  const loadLots = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/lots/gaveur/${GAVEUR_ID}`);
      const data = await response.json();

      if (Array.isArray(data)) {
        setLots(data);
      }
    } catch (error) {
      console.error("Erreur chargement lots:", error);
    } finally {
      setLoading(false);
    }
  };

  const lotsFiltered =
    filterStatut === "tous"
      ? lots
      : lots.filter((l) => l.statut === filterStatut);

  const lotsEnGavage = lots.filter((l) => l.statut === "en_gavage");
  const lotsTermines = lots.filter((l) => l.statut === "termine" || l.statut === "abattu");
  const lotsPreparation = lots.filter((l) => l.statut === "en_preparation");
  const totalCanards = lots.reduce((sum, l) => sum + l.nombre_canards, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Breadcrumb />
      </div>
      {/* Header avec gradient - Style gavage */}
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Package size={40} />
              <h1 className="text-4xl font-bold">Mes Lots de Gavage</h1>
            </div>
            <p className="text-blue-100 text-lg">
              Gérez vos lots de canards et suivez leur progression en temps réel
            </p>
          </div>

          <Link
            href="/lots/nouveau"
            className="flex items-center gap-2 rounded-xl bg-white px-6 py-4 font-bold text-blue-600 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            <Zap size={20} />
            Nouveau Lot
          </Link>
        </div>
      </div>

      {/* Statistiques rapides - Style gavage avec gradients */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp size={32} className="opacity-80" />
            <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              ACTIFS
            </div>
          </div>
          <p className="text-green-100 text-sm">Lots en gavage</p>
          <p className="mt-2 text-5xl font-bold">{lotsEnGavage.length}</p>
          <p className="mt-2 text-green-100 text-sm">
            {lotsEnGavage.reduce((sum, l) => sum + l.nombre_canards, 0)} canards
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle size={32} className="opacity-80" />
            <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              TERMINÉS
            </div>
          </div>
          <p className="text-blue-100 text-sm">Lots terminés</p>
          <p className="mt-2 text-5xl font-bold">{lotsTermines.length}</p>
          <p className="mt-2 text-blue-100 text-sm">Ce mois</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Clock size={32} className="opacity-80" />
            <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              EN ATTENTE
            </div>
          </div>
          <p className="text-orange-100 text-sm">En préparation</p>
          <p className="mt-2 text-5xl font-bold">{lotsPreparation.length}</p>
          <p className="mt-2 text-orange-100 text-sm">Prêts à démarrer</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 size={32} className="opacity-80" />
            <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              TOTAL
            </div>
          </div>
          <p className="text-purple-100 text-sm">Canards en élevage</p>
          <p className="mt-2 text-5xl font-bold">{totalCanards}</p>
          <p className="mt-2 text-purple-100 text-sm">
            {lots.length} lots actifs
          </p>
        </div>
      </div>

      {/* Filtres - Style moderne avec gradients */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="font-bold text-gray-700 text-lg">Filtrer par statut :</p>
        <button
          onClick={() => setFilterStatut("tous")}
          className={`rounded-xl px-6 py-3 text-sm font-bold shadow-md transition-all ${
            filterStatut === "tous"
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white scale-105"
              : "bg-white text-gray-700 hover:bg-gray-50 hover:scale-105"
          }`}
        >
          🌟 Tous ({lots.length})
        </button>
        <button
          onClick={() => setFilterStatut("en_gavage")}
          className={`rounded-xl px-6 py-3 text-sm font-bold shadow-md transition-all ${
            filterStatut === "en_gavage"
              ? "bg-gradient-to-r from-green-500 to-green-600 text-white scale-105"
              : "bg-white text-gray-700 hover:bg-gray-50 hover:scale-105"
          }`}
        >
          🚀 En gavage ({lotsEnGavage.length})
        </button>
        <button
          onClick={() => setFilterStatut("termine")}
          className={`rounded-xl px-6 py-3 text-sm font-bold shadow-md transition-all ${
            filterStatut === "termine"
              ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white scale-105"
              : "bg-white text-gray-700 hover:bg-gray-50 hover:scale-105"
          }`}
        >
          ✅ Terminés ({lotsTermines.length})
        </button>
        <button
          onClick={() => setFilterStatut("en_preparation")}
          className={`rounded-xl px-6 py-3 text-sm font-bold shadow-md transition-all ${
            filterStatut === "en_preparation"
              ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white scale-105"
              : "bg-white text-gray-700 hover:bg-gray-50 hover:scale-105"
          }`}
        >
          ⏳ En préparation ({lotsPreparation.length})
        </button>
      </div>

      {/* Liste des lots */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Chargement des lots...</p>
          </div>
        </div>
      ) : lotsFiltered.length === 0 ? (
        <div className="rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 p-16 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-300">
            <Package size={40} className="text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-700">Aucun lot trouvé</p>
          <p className="mt-2 text-gray-600">
            Créez votre premier lot pour commencer le suivi
          </p>
          <Link
            href="/lots/nouveau"
            className="mt-6 inline-block rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-8 py-4 font-bold text-white shadow-lg transition-all hover:scale-105"
          >
            + Créer mon premier lot
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lotsFiltered.map((lot) => (
            <LotCard key={lot.id} lot={lot} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LOT CARD COMPONENT - Style gavage avec gradients
// ============================================================================

function LotCard({ lot }: { lot: Lot }) {
  const progressPourcent = Math.min(
    (lot.poids_moyen_actuel / lot.objectif_poids_final) * 100,
    100
  );

  const getStatutBadge = (statut: StatutLot) => {
    switch (statut) {
      case "en_gavage":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
            <TrendingUp size={14} />
            EN GAVAGE
          </span>
        );
      case "termine":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
            <CheckCircle size={14} />
            TERMINÉ
          </span>
        );
      case "en_preparation":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
            <Clock size={14} />
            EN PRÉPARATION
          </span>
        );
      case "abattu":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
            <CheckCircle size={14} />
            ABATTU
          </span>
        );
      default:
        return null;
    }
  };

  const getCardGradient = (statut: StatutLot) => {
    switch (statut) {
      case "en_gavage":
        return "from-green-50 to-green-100 border-green-300";
      case "termine":
        return "from-blue-50 to-blue-100 border-blue-300";
      case "en_preparation":
        return "from-orange-50 to-orange-100 border-orange-300";
      case "abattu":
        return "from-gray-50 to-gray-100 border-gray-300";
      default:
        return "from-gray-50 to-gray-100 border-gray-300";
    }
  };

  return (
    <div
      className={`rounded-2xl border-2 bg-gradient-to-br p-6 shadow-lg transition-all hover:scale-105 hover:shadow-xl ${getCardGradient(
        lot.statut
      )}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">{lot.code_lot}</h3>
          <p className="text-sm text-gray-600">{lot.site_code || lot.site_origine || 'N/A'}</p>
        </div>
        {getStatutBadge(lot.statut)}
      </div>

      {/* Infos principales */}
      <div className="mb-4 space-y-2 rounded-xl bg-white/60 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Canards :</span>
          <span className="font-bold text-gray-800">{lot.nb_canards_initial || 'N/A'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Poids actuel :</span>
          <span className="font-bold text-gray-800">
            {lot.poids_moyen_actuel ? lot.poids_moyen_actuel.toFixed(0) + 'g' : 'N/A'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">ITM :</span>
          <span className="font-bold text-gray-800">
            {lot.itm ? lot.itm.toFixed(2) : 'N/A'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Génétique :</span>
          <span className="font-bold text-gray-800 capitalize">{lot.genetique || 'N/A'}</span>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="mb-4">
        <div className="mb-2 flex justify-between text-xs font-bold">
          <span className="text-gray-700">Progression</span>
          <span className="text-gray-800">{progressPourcent.toFixed(0)}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all ${
              progressPourcent >= 100
                ? "bg-gradient-to-r from-blue-500 to-blue-600"
                : "bg-gradient-to-r from-green-500 to-green-600"
            }`}
            style={{ width: `${Math.min(progressPourcent, 100)}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/lots/${lot.id}/gavage`}
          className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 text-center text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
        >
          📝 Gavage
        </Link>
        <Link
          href={`/lots/${lot.id}/courbes`}
          className="rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3 text-center text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
        >
          📈 Courbes
        </Link>
        <Link
          href={`/lots/${lot.id}/historique`}
          className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-center text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
        >
          📋 Historique
        </Link>
        <Link
          href={`/analytics?lot=${lot.id}`}
          className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-center text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
        >
          📊 Stats
        </Link>
      </div>

      {/* Alertes si présentes */}
      {lot.statut === "en_gavage" && lot.poids_moyen_actuel < lot.poids_moyen_initial && (
        <div className="mt-4 rounded-xl bg-red-100 border-2 border-red-300 p-3 flex items-center gap-2">
          <AlertTriangle className="text-red-600" size={20} />
          <p className="text-xs font-bold text-red-700">
            Poids inférieur au poids initial !
          </p>
        </div>
      )}
    </div>
  );
}
