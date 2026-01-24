"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Lot, FormulaireGavageLot, SuggestionIA } from "@/types/lot";
import { calculateJourGavage } from "@/types/lot";

export default function GavagePage() {
  const params = useParams();
  const router = useRouter();
  const lotId = parseInt(params?.id as string, 10);

  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [suggestionIA, setSuggestionIA] = useState<SuggestionIA | null>(null);
  const [dosesLocked, setDosesLocked] = useState({ matin: false, soir: false });
  const [historiqueRecent, setHistoriqueRecent] = useState<any[]>([]);
  const [joursManquants, setJoursManquants] = useState<number[]>([]);
  const [isDateFuture, setIsDateFuture] = useState(false);
  const [prochainJourARemplir, setProchainJourARemplir] = useState<number | null>(null);

  // Fonction pour générer des poids réalistes autour d'une moyenne
  const genererPoidsRealistes = (poidsMoyen: number, nbCanards: number = 10): number[] => {
    // Variation de ±3% autour du poids moyen
    const variation = poidsMoyen * 0.03;
    return Array(nbCanards).fill(0).map(() => {
      const offset = (Math.random() - 0.5) * 2 * variation;
      return Math.round(poidsMoyen + offset);
    });
  };

  const [formData, setFormData] = useState<FormulaireGavageLot>({
    lot_id: lotId,
    date_gavage: new Date().toISOString().split("T")[0],
    jour_gavage: 0,
    dose_matin: 0,
    heure_gavage_matin: "08:30",
    dose_soir: 0,
    heure_gavage_soir: "18:30",
    nb_canards_peses: 10,
    poids_echantillon: genererPoidsRealistes(4500), // Poids initial par défaut, mis à jour quand lot chargé
    poids_moyen_calcule: 0,
    temperature_stabule: 22,
    humidite_stabule: 65,
    suit_courbe_theorique: true,
    remarques: "",
  });

  useEffect(() => {
    if (!isNaN(lotId)) {
      loadLot();
    }
  }, [lotId]);

  // Calculer jour de gavage
  useEffect(() => {
    if (lot) {
      const jour = calculateJourGavage(
        lot.date_debut_gavage.toString(),
        formData.date_gavage
      );
      setFormData((prev) => ({ ...prev, jour_gavage: jour }));

      // Charger suggestion IA
      loadSuggestion(jour);
    }
  }, [formData.date_gavage, lot]);

  const loadLot = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/lots/${lotId}`);
      const data = await response.json();
      setLot(data);

      // Générer des poids réalistes basés sur le poids actuel du lot
      if (data.poids_moyen_actuel > 0) {
        setFormData((prev) => ({
          ...prev,
          poids_echantillon: genererPoidsRealistes(data.poids_moyen_actuel, prev.nb_canards_peses),
        }));
      }

      // Charger l'historique pour déterminer la prochaine date à remplir
      await detectProchainJour(data);
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  const detectProchainJour = async (lotData: Lot) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/lots/${lotId}/historique`);
      if (response.ok) {
        const historique = await response.json();

        console.log(`[DETECTION] Historique chargé: ${historique.length} gavages`);

        // Stocker les 3 derniers gavages pour affichage
        setHistoriqueRecent(historique.slice(0, 3));

        if (historique.length > 0) {
          // Trouver le dernier gavage (historique est trié DESC par date)
          const dernierGavage = historique[0];

          console.log(`[DETECTION] Dernier gavage: J${dernierGavage.jour_gavage} - ${dernierGavage.date_gavage}`);

          // 🆕 DÉTECTER LES JOURS MANQUANTS dans l'historique
          const joursEnregistres = new Set(historique.map((h: any) => h.jour_gavage));
          const dernierJour = dernierGavage.jour_gavage;
          const manquants: number[] = [];

          for (let j = 1; j < dernierJour; j++) {
            if (!joursEnregistres.has(j)) {
              manquants.push(j);
            }
          }

          setJoursManquants(manquants);

          if (manquants.length > 0) {
            console.log(`[ALERTE] Jours manquants détectés: J${manquants.join(', J')}`);
          }

          // Calculer le prochain jour de gavage = dernier jour + 1
          const prochainJourGavage = dernierGavage.jour_gavage + 1;

          // 🆕 Enregistrer le prochain jour à remplir pour l'affichage
          setProchainJourARemplir(prochainJourGavage);

          // Calculer la date correspondante (méthode robuste sans problème de fuseau horaire)
          // Utiliser directement la string de date et ajouter 1 jour manuellement
          const [annee, mois, jourStr] = dernierGavage.date_gavage.split('-').map(Number);
          const dernierDateObj = new Date(annee, mois - 1, jourStr); // mois -1 car Date() compte de 0 à 11

          console.log(`[DEBUG] dernierDate: ${dernierDateObj.toISOString().split('T')[0]}`);

          const prochainDate = new Date(annee, mois - 1, jourStr + 1); // Ajouter 1 au jour

          console.log(`[DEBUG] prochainDate: ${prochainDate.toISOString().split('T')[0]}`);

          // Vérifier si la date est dans le futur (en utilisant les dates locales, pas UTC)
          const aujourdHui = new Date();
          aujourdHui.setHours(0, 0, 0, 0);
          prochainDate.setHours(0, 0, 0, 0);

          // 🔧 FIX: Utiliser la date locale au lieu de UTC pour éviter les problèmes de fuseau horaire
          const aujourdHuiStr = `${aujourdHui.getFullYear()}-${String(aujourdHui.getMonth() + 1).padStart(2, '0')}-${String(aujourdHui.getDate()).padStart(2, '0')}`;
          const prochainDateStr = `${prochainDate.getFullYear()}-${String(prochainDate.getMonth() + 1).padStart(2, '0')}-${String(prochainDate.getDate()).padStart(2, '0')}`;

          console.log(`[DETECTION] Prochaine date calculée: ${prochainDateStr} (J${prochainJourGavage})`);
          console.log(`[DETECTION] Aujourd'hui: ${aujourdHuiStr}`);

          // 🆕 AUTORISER LA SAISIE FUTURE (avec avertissement)
          const dateProposee = prochainDateStr;
          setFormData((prev) => ({
            ...prev,
            date_gavage: dateProposee,
            jour_gavage: prochainJourGavage, // 🆕 Définir explicitement le jour de gavage
          }));

          // Définir si la date est future (comparer les strings de dates pour éviter timezone)
          const isFuture = prochainDateStr > aujourdHuiStr;
          setIsDateFuture(isFuture);

          if (isFuture) {
            console.log(`[ALERTE] ⚠️ Date future proposée - saisie anticipée autorisée`);
          } else {
            console.log(`[DETECTION] ✓ Proposition de la date: ${dateProposee}`);
          }

          // 🆕 Générer poids basés sur le dernier poids réel avec gain réaliste
          // Gain moyen attendu : 60-80g/jour pendant le gavage
          const dernierPoids = dernierGavage.poids_moyen_mesure;
          const gainMoyenAttendu = 70; // 70g de gain par jour
          const poidsEstime = dernierPoids + gainMoyenAttendu;

          setFormData((prev) => ({
            ...prev,
            poids_echantillon: genererPoidsRealistes(poidsEstime, prev.nb_canards_peses),
          }));
        }
        // Si pas d'historique, garder la date du jour
      }
    } catch (error) {
      console.error("Erreur détection prochain jour:", error);
      // En cas d'erreur, garder la date du jour
    }
  };

  const loadSuggestion = async (jour: number) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(
        `${apiUrl}/api/ml/suggestions/lot/${lotId}/jour/${jour}`
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Adapter la réponse backend au format SuggestionIA
          setSuggestionIA({
            dose_matin_suggeree: result.data.dose_matin,
            dose_soir_suggeree: result.data.dose_soir,
            confiance: result.data.confiance / 100, // Backend retourne 0-100, interface attend 0-1
            base_sur: {
              jours_historique: 0,
              lots_similaires: 0
            }
          });
        }
      }
    } catch (error) {
      console.error("Erreur suggestion:", error);
    }
  };

  const accepterSuggestion = () => {
    if (!suggestionIA) return;
    setFormData((prev) => ({
      ...prev,
      dose_matin: suggestionIA.dose_matin_suggeree,
      dose_soir: suggestionIA.dose_soir_suggeree,
    }));
  };

  const validerDose = (periode: "matin" | "soir") => {
    setDosesLocked((prev) => ({ ...prev, [periode]: true }));
  };

  const deverrouillerDose = (periode: "matin" | "soir") => {
    setDosesLocked((prev) => ({ ...prev, [periode]: false }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifier que les doses sont validées
    if (!dosesLocked.matin || !dosesLocked.soir) {
      alert("⚠️ Veuillez valider les doses matin ET soir avant d'enregistrer.");
      return;
    }

    // Vérifier que la date n'est pas déjà enregistrée
    const dateExistante = historiqueRecent.find(
      h => h.date_gavage === formData.date_gavage
    );
    if (dateExistante) {
      alert(
        `⚠️ Un gavage existe déjà pour le ${formData.date_gavage} (J${dateExistante.jour_gavage}).\n\n` +
        `Poids enregistré : ${dateExistante.poids_moyen_mesure}g\n` +
        `Doses : ${dateExistante.dose_matin}g / ${dateExistante.dose_soir}g\n\n` +
        `Veuillez choisir une autre date ou modifier le gavage existant.`
      );
      return;
    }

    setSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/lots/gavage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_id: lotId,
          date_gavage: formData.date_gavage,
          dose_matin: formData.dose_matin,
          dose_soir: formData.dose_soir,
          heure_gavage_matin: formData.heure_gavage_matin,
          heure_gavage_soir: formData.heure_gavage_soir,
          nb_canards_peses: formData.nb_canards_peses,
          poids_echantillon: formData.poids_echantillon,
          temperature_stabule: formData.temperature_stabule,
          humidite_stabule: formData.humidite_stabule,
          suit_courbe_theorique: formData.suit_courbe_theorique,
          raison_ecart: formData.raison_ecart,
          remarques: formData.remarques,
          mortalite_jour: formData.mortalite?.nombre || 0,
          cause_mortalite: formData.mortalite?.cause,
          problemes_sante: formData.problemes_sante,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Erreur enregistrement");
      }

      const result = await response.json();

      alert(`✅ Gavage J${formData.jour_gavage} enregistré!\n${
        result.alerte_generee
          ? `⚠️ Écart: ${result.ecart_courbe_theorique.toFixed(1)}%`
          : "✅ Conforme"
      }`);

      router.push(`/lots/${lotId}/courbes`);
    } catch (error) {
      console.error("Erreur:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";

      // Détecter erreur de doublon
      if (errorMessage.includes("duplicate key") || errorMessage.includes("already exists") || errorMessage.includes("unique constraint")) {
        alert(
          `⚠️ Gavage déjà enregistré pour le ${formData.date_gavage}\n\n` +
          `Un gavage existe déjà pour cette date.\n` +
          `Veuillez choisir une autre date ou consulter l'historique.`
        );
      } else {
        alert(`❌ Erreur lors de l'enregistrement\n\n${errorMessage}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !lot) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-3 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header avec gradient - Style gavage moderne */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-green-600 to-teal-600 p-6 text-white shadow-xl">
          <Link href="/lots" className="mb-2 inline-block text-green-100 hover:text-white">
            ← Retour aux lots
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">
                📝 Gavage J{prochainJourARemplir !== null ? prochainJourARemplir : formData.jour_gavage}
              </h1>
              <p className="mt-2 text-green-100 text-lg">
                Lot {lot.code_lot} · {lot.nombre_canards} canards · {lot.genetique}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-medium">{new Date(formData.date_gavage).toLocaleDateString("fr-FR")}</div>
              <div className="mt-1 text-2xl font-bold">{lot.poids_moyen_actuel}g → {lot.objectif_poids_final}g</div>
            </div>
          </div>
        </div>

        {/* 🆕 NOTIFICATION : Jours Manquants - Modernisée */}
        {joursManquants.length > 0 && (
          <div className="mb-6 rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="text-3xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-yellow-800">
                  {joursManquants.length} jour{joursManquants.length > 1 ? 's' : ''} manquant{joursManquants.length > 1 ? 's' : ''} détecté{joursManquants.length > 1 ? 's' : ''}
                </h3>
                <p className="mt-2 text-sm text-yellow-700">
                  Les jours suivants n'ont pas été renseignés : <strong>J{joursManquants.join(', J')}</strong>
                </p>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/lots/${lotId}/rattrapage`}
                    className="rounded-xl bg-gradient-to-r from-yellow-600 to-orange-600 px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                  >
                    📝 Rattraper ces jours
                  </Link>
                  <Link
                    href={`/lots/${lotId}/historique`}
                    className="rounded-xl border-2 border-yellow-600 bg-white px-6 py-3 text-sm font-bold text-yellow-700 shadow-md transition-all hover:scale-105 hover:bg-yellow-50"
                  >
                    📊 Voir l'historique
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🆕 NOTIFICATION : Date Future (Saisie Anticipée) - Modernisée */}
        {isDateFuture && (
          <div className="mb-6 rounded-2xl border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="text-3xl">ℹ️</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-blue-800">
                  Saisie anticipée autorisée
                </h3>
                <p className="mt-2 text-sm text-blue-700">
                  Vous êtes sur le point d'enregistrer le gavage pour <strong>{formData.date_gavage}</strong>,
                  une date future. Cette saisie anticipée est autorisée mais inhabituelle.
                </p>
                <p className="mt-3 text-xs text-blue-600">
                  💡 Astuce : Il est recommandé de remplir le formulaire le jour même du gavage pour plus de précision.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Suggestion IA - Style moderne avec gradient */}
          {suggestionIA && (
            <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 p-6 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    <span className="text-lg font-bold text-purple-900">Suggestion IA (Courbe PySR)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-white/60 p-3">
                      <p className="text-xs text-gray-600">🌅 Matin</p>
                      <p className="text-2xl font-bold text-purple-700">{suggestionIA.dose_matin_suggeree}g</p>
                    </div>
                    <div className="rounded-lg bg-white/60 p-3">
                      <p className="text-xs text-gray-600">🌙 Soir</p>
                      <p className="text-2xl font-bold text-purple-700">{suggestionIA.dose_soir_suggeree}g</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-purple-600">
                    Confiance : {(suggestionIA.confiance * 100).toFixed(0)}% · Basé sur formule Euralis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={accepterSuggestion}
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  ✨ Utiliser
                </button>
              </div>
            </div>
          )}

          {/* Doses sur UNE SEULE LIGNE avec boutons de validation - Modernisé */}
          <div className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <h3 className="text-xl font-bold text-gray-800">Doses du Jour</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* MATIN */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    🌅 Matin
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.dose_matin || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dose_matin: parseFloat(e.target.value),
                        }))
                      }
                      disabled={dosesLocked.matin}
                      className="w-24 rounded-lg border px-3 py-2 text-center font-bold disabled:bg-gray-100"
                      placeholder="g"
                      required
                    />
                    <input
                      type="time"
                      value={formData.heure_gavage_matin}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          heure_gavage_matin: e.target.value,
                        }))
                      }
                      disabled={dosesLocked.matin}
                      className="flex-1 rounded-lg border px-3 py-2 disabled:bg-gray-100"
                      required
                    />
                  </div>
                </div>
                {dosesLocked.matin ? (
                  <button
                    type="button"
                    onClick={() => deverrouillerDose("matin")}
                    className="rounded-xl bg-gradient-to-r from-gray-400 to-gray-500 px-4 py-2 text-white shadow-md transition-all hover:scale-105"
                    title="Déverrouiller"
                  >
                    🔒
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => validerDose("matin")}
                    className="rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-4 py-2 font-bold text-white shadow-md transition-all hover:scale-105 disabled:from-gray-300 disabled:to-gray-400"
                    disabled={!formData.dose_matin || formData.dose_matin <= 0}
                  >
                    ✓ Valider
                  </button>
                )}
              </div>

              {/* SOIR */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    🌙 Soir
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.dose_soir || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dose_soir: parseFloat(e.target.value),
                        }))
                      }
                      disabled={dosesLocked.soir}
                      className="w-24 rounded-lg border px-3 py-2 text-center font-bold disabled:bg-gray-100"
                      placeholder="g"
                      required
                    />
                    <input
                      type="time"
                      value={formData.heure_gavage_soir}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          heure_gavage_soir: e.target.value,
                        }))
                      }
                      disabled={dosesLocked.soir}
                      className="flex-1 rounded-lg border px-3 py-2 disabled:bg-gray-100"
                      required
                    />
                  </div>
                </div>
                {dosesLocked.soir ? (
                  <button
                    type="button"
                    onClick={() => deverrouillerDose("soir")}
                    className="rounded-xl bg-gradient-to-r from-gray-400 to-gray-500 px-4 py-2 text-white shadow-md transition-all hover:scale-105"
                    title="Déverrouiller"
                  >
                    🔒
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => validerDose("soir")}
                    className="rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-4 py-2 font-bold text-white shadow-md transition-all hover:scale-105 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed"
                    disabled={!formData.dose_soir || formData.dose_soir <= 0 || !dosesLocked.matin}
                    title={!dosesLocked.matin ? "Validez d'abord le matin" : ""}
                  >
                    ✓ Valider
                  </button>
                )}
              </div>
            </div>

            {/* Indicateur de validation */}
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="flex gap-2">
                <span className={dosesLocked.matin ? "text-green-600" : "text-gray-400"}>
                  {dosesLocked.matin ? "✓" : "○"} Matin validé
                </span>
                <span className={dosesLocked.soir ? "text-green-600" : "text-gray-400"}>
                  {dosesLocked.soir ? "✓" : "○"} Soir validé
                </span>
              </div>
              {!dosesLocked.matin && (
                <span className="text-orange-600 font-medium">
                  ⚠️ Validez d'abord le matin
                </span>
              )}
            </div>
          </div>

          {/* Conditions + Observations ENSEMBLE - Modernisé */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Conditions */}
            <div className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-2xl">🌡️</span>
                <h3 className="text-lg font-bold text-gray-800">Conditions Stabule</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Temp. (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.temperature_stabule}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        temperature_stabule: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Humidité (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.humidite_stabule}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        humidite_stabule: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Conformité */}
            <div className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <h3 className="text-lg font-bold text-gray-800">Conformité</h3>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.suit_courbe_theorique}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      suit_courbe_theorique: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">Je suis la courbe théorique</span>
              </label>

              {!formData.suit_courbe_theorique && (
                <input
                  value={formData.raison_ecart || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, raison_ecart: e.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Raison de l'écart..."
                />
              )}
            </div>
          </div>

          {/* Remarques - Modernisé */}
          <div className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-2xl">📝</span>
              <h3 className="text-lg font-bold text-gray-800">Remarques & Observations</h3>
            </div>
            <textarea
              value={formData.remarques}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, remarques: e.target.value }))
              }
              className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              rows={3}
              placeholder="Notez ici vos observations du jour..."
            />
          </div>

          {/* Historique récent et jours à venir - Modernisé */}
          {lot && (
            <div className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                <h3 className="text-lg font-bold text-gray-800">Historique & Jours à venir</h3>
              </div>
              <div className="space-y-2">
                {/* Historique des derniers gavages */}
                {historiqueRecent.map((h, idx) => {
                  // Détecter incohérence de poids (baisse au lieu de hausse)
                  const poidsPrecedent = idx < historiqueRecent.length - 1
                    ? historiqueRecent[idx + 1].poids_moyen_mesure
                    : null;
                  const baissePoids = poidsPrecedent && h.poids_moyen_mesure < poidsPrecedent;
                  const variation = poidsPrecedent
                    ? ((h.poids_moyen_mesure - poidsPrecedent) / poidsPrecedent * 100).toFixed(1)
                    : null;

                  return (
                    <div
                      key={`hist-${idx}`}
                      className={`rounded-lg px-3 py-2 text-xs shadow-sm ${
                        baissePoids ? 'bg-red-50 border border-red-200' : 'bg-white'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">
                            J{h.jour_gavage}
                          </span>
                          <span className="text-gray-500">
                            {new Date(h.date_gavage).toLocaleDateString("fr-FR")}
                          </span>
                          {h.alerte_generee && (
                            <span className="text-orange-500">⚠️</span>
                          )}
                          {baissePoids && (
                            <span className="text-red-600" title="Poids en baisse - incohérent">
                              ⚠️ Perte
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${baissePoids ? 'text-red-600' : 'text-blue-600'}`}>
                            {h.poids_moyen_mesure}g
                          </span>
                          {variation && (
                            <span className={`text-xs ${
                              parseFloat(variation) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {parseFloat(variation) >= 0 ? '+' : ''}{variation}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>🌅 {h.dose_matin}g · 🌙 {h.dose_soir}g</span>
                        {h.remarques && h.remarques.trim() && (
                          <span className="italic text-gray-500">"{h.remarques}"</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Jour actuel */}
                <div className="rounded-lg border-2 border-blue-500 bg-blue-50 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-blue-800">
                    <span>
                      J{formData.jour_gavage || "?"} - {formData.date_gavage}
                    </span>
                    <span className="text-blue-600">📝 En cours</span>
                  </div>
                </div>

                {/* Jours à venir (vides) */}
                {historiqueRecent.length > 0 && (() => {
                  const dernierJour = historiqueRecent[0].jour_gavage;
                  const jourActuel = formData.jour_gavage || dernierJour + 1;
                  const joursRestants = 14 - jourActuel; // Période de gavage = 14 jours
                  const joursAVenir = [];

                  for (let i = 1; i <= Math.min(joursRestants, 3); i++) {
                    const jourFutur = jourActuel + i;
                    const dateFuture = new Date(formData.date_gavage);
                    dateFuture.setDate(dateFuture.getDate() + i);

                    joursAVenir.push(
                      <div
                        key={`futur-${i}`}
                        className="rounded-lg border border-dashed border-gray-300 bg-gray-100 px-3 py-2 text-xs text-gray-500"
                      >
                        <div className="flex items-center justify-between">
                          <span>
                            J{jourFutur} - {dateFuture.toLocaleDateString("fr-FR")}
                          </span>
                          <span className="italic">À venir</span>
                        </div>
                      </div>
                    );
                  }

                  return joursAVenir;
                })()}
              </div>
              <Link
                href={`/lots/${lotId}/historique`}
                className="mt-4 block rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-center text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                📋 Voir tout l'historique →
              </Link>
            </div>
          )}

          {/* Boutons d'action - Modernisés */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting || !dosesLocked.matin || !dosesLocked.soir}
              className="flex-1 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl disabled:from-gray-400 disabled:to-gray-500"
            >
              {submitting ? "⏳ Enregistrement..." : "💾 Enregistrer Gavage"}
            </button>
            <Link
              href={`/lots/${lotId}/courbes`}
              className="flex items-center justify-center rounded-xl border-2 border-blue-500 bg-white px-8 py-4 text-center font-bold text-blue-600 shadow-md transition-all hover:scale-105 hover:bg-blue-50"
            >
              📈 Courbes
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
