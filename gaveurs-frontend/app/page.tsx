'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { AlertTriangle, Cloud, TrendingUp, History, BarChart3 } from 'lucide-react';
import LotSelector from '@/components/dashboard/LotSelector';
import { courbesAPI, type Dashboard3Courbes, type CorrectionIA } from '@/lib/courbes-api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Page d'accueil - Dashboard 3-Courbes IA
 *
 * Nouvelle page centrale pour les gaveurs avec:
 * - Sélecteur de lot en haut
 * - Dashboard 3-Courbes (théorique/réelle/prédictive)
 * - Widgets: Alertes, Météo, Actions rapides
 */
export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard3Courbes | null>(null);
  const [corrections, setCorrections] = useState<CorrectionIA[]>([]);
  const [courbePredictive, setCourbePredictive] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // État pour saisie rapide dose
  const [showSaisieModal, setShowSaisieModal] = useState(false);
  const [saisieForm, setSaisieForm] = useState({
    jour_gavage: 1,
    session: 'matin' as 'matin' | 'soir',
    dose_reelle_g: 0,
    commentaire: ''
  });

  // Déterminer automatiquement la session actuelle (matin avant 14h, soir après)
  const getSessionActuelle = (): 'matin' | 'soir' => {
    const heure = new Date().getHours();
    return heure < 14 ? 'matin' : 'soir';
  };

  // Détecter le paramètre ?lot= dans l'URL
  useEffect(() => {
    const lotIdFromUrl = searchParams.get('lot');
    if (lotIdFromUrl) {
      setSelectedLotId(parseInt(lotIdFromUrl, 10));
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedLotId) {
      loadDashboardData(selectedLotId);
    }
  }, [selectedLotId]);

  // Mettre à jour le formulaire automatiquement quand les données changent
  useEffect(() => {
    if (dashboard && dashboard.courbe_reelle) {
      const dernierJourSaisi = dashboard.courbe_reelle.length > 0
        ? Math.max(...dashboard.courbe_reelle.map(d => d.jour_gavage))
        : 0;
      const prochainJour = dernierJourSaisi + 1;
      const sessionActuelle = getSessionActuelle();

      // Trouver la dose suggérée (divisée par 2 car c'est par session, pas par jour)
      let doseJournaliere = dashboard.courbe_theorique.courbe[prochainJour - 1]?.dose_g || 0;

      if (courbePredictive?.courbe_predictive) {
        const pointPredictif = courbePredictive.courbe_predictive.find((p: any) => p.jour === prochainJour);
        if (pointPredictif) {
          doseJournaliere = pointPredictif.dose_g;
        }
      }

      // Dose par session = dose journalière / 2 (approximation, matin = 45%, soir = 55% en réalité)
      const doseSuggeree = sessionActuelle === 'matin'
        ? Math.round(doseJournaliere * 0.45)
        : Math.round(doseJournaliere * 0.55);

      setSaisieForm({
        jour_gavage: prochainJour,
        session: sessionActuelle,
        dose_reelle_g: doseSuggeree,
        commentaire: ''
      });
    }
  }, [dashboard, courbePredictive]);

  const loadDashboardData = async (lotId: number) => {
    setLoading(true);
    setError(null);

    try {
      const [dashboardData, correctionsData, predictiveData] = await Promise.all([
        courbesAPI.getDashboard3Courbes(lotId),
        courbesAPI.getCorrectionsGaveur(1, true).catch(() => []),
        courbesAPI.getCourbePredictive(lotId).catch(() => null)
      ]);

      setDashboard(dashboardData);
      setCorrections(correctionsData.filter(c => c.lot_id === lotId));
      setCourbePredictive(predictiveData);
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSaisirDose = async () => {
    if (!dashboard || !selectedLotId) return;

    try {
      const result = await courbesAPI.saisirDoseReelle({
        lot_id: selectedLotId,
        gaveur_id: 1,
        site_code: 'LL',
        date_gavage: new Date().toISOString().split('T')[0],
        jour_gavage: saisieForm.jour_gavage,
        dose_reelle_g: saisieForm.dose_reelle_g,
        commentaire_gaveur: saisieForm.commentaire || undefined
      });

      alert(`Dose saisie ! Écart: ${result.ecart_pct.toFixed(2)}%${result.alerte_ecart ? ' ⚠️ ALERTE' : ''}`);

      setShowSaisieModal(false);
      // Réinitialiser le commentaire
      setSaisieForm(prev => ({ ...prev, commentaire: '' }));
      if (selectedLotId) loadDashboardData(selectedLotId);
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  };

  const handleAccepterCorrection = async (correctionId: number, doseSuggeree: number) => {
    try {
      await courbesAPI.repondreCorrectionIA(correctionId, true, doseSuggeree);
      alert('Correction acceptée !');
      if (selectedLotId) loadDashboardData(selectedLotId);
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Erreur'}`);
    }
  };

  const handleRefuserCorrection = async (correctionId: number) => {
    try {
      await courbesAPI.repondreCorrectionIA(correctionId, false);
      alert('Correction refusée');
      if (selectedLotId) loadDashboardData(selectedLotId);
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Erreur'}`);
    }
  };

  // Préparer données graphique
  const chartData = dashboard ? (() => {
    const maxJour = Math.max(
      ...dashboard.courbe_theorique.courbe.map(d => d.jour),
      ...dashboard.courbe_reelle.map(d => d.jour_gavage)
    );

    return {
      labels: Array.from({ length: maxJour }, (_, i) => `J${i + 1}`),
      datasets: [
        {
          label: 'Courbe Théorique PySR',
          data: dashboard.courbe_theorique.courbe.map(d => d.dose_g),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          borderWidth: 2,
          borderDash: [5, 5]
        },
        {
          label: 'Courbe Réelle (Gaveur)',
          data: Array.from({ length: maxJour }, (_, i) => {
            const point = dashboard.courbe_reelle.find(d => d.jour_gavage === i + 1);
            return point ? point.dose_reelle_g : null;
          }),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          fill: true,
          tension: 0.2,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 3
        },
        ...(courbePredictive?.a_des_ecarts ? [{
          label: 'Courbe Prédictive IA',
          data: courbePredictive.courbe_predictive.map((d: any) => d.dose_g),
          borderColor: 'rgb(249, 115, 22)',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          borderWidth: 2,
          borderDash: [10, 5],
          pointStyle: 'triangle'
        }] : [])
      ]
    };
  })() : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Dashboard 3-Courbes IA - Lot ${selectedLotId || ''}`,
        font: { size: 18, weight: 'bold' as const }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y + 'g';
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Dose (grammes)'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Jour de gavage'
        },
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      {/* Header avec sélecteur de lot */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📈 Dashboard 3-Courbes IA
            </h1>
            <p className="text-gray-600">
              Suivez vos courbes de gavage en temps réel avec l'intelligence artificielle
            </p>
          </div>

          {/* Boutons actions rapides */}
          <div className="flex gap-3">
            <Link
              href="/lots"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-semibold"
            >
              <BarChart3 size={20} />
              Tous les lots
            </Link>
            {selectedLotId && dashboard && (() => {
              const dernierJourSaisi = dashboard.courbe_reelle.length > 0
                ? Math.max(...dashboard.courbe_reelle.map(d => d.jour_gavage))
                : 0;
              const prochainJour = dernierJourSaisi + 1;
              const sessionActuelle = getSessionActuelle();

              let doseJournaliere = dashboard.courbe_theorique.courbe[prochainJour - 1]?.dose_g || 0;
              if (courbePredictive?.courbe_predictive) {
                const pointPredictif = courbePredictive.courbe_predictive.find((p: any) => p.jour === prochainJour);
                if (pointPredictif) doseJournaliere = pointPredictif.dose_g;
              }

              const doseSession = sessionActuelle === 'matin'
                ? Math.round(doseJournaliere * 0.45)
                : Math.round(doseJournaliere * 0.55);

              return (
                <button
                  onClick={() => {
                    setSaisieForm({
                      jour_gavage: prochainJour,
                      session: sessionActuelle,
                      dose_reelle_g: doseSession,
                      commentaire: ''
                    });
                    setShowSaisieModal(true);
                  }}
                  className={`flex items-center gap-2 px-6 py-2 text-white rounded-lg font-semibold shadow-md ${
                    sessionActuelle === 'matin'
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {sessionActuelle === 'matin' ? '🌅' : '🌙'} Saisir Dose {sessionActuelle === 'matin' ? 'Matin' : 'Soir'}
                </button>
              );
            })()}
          </div>
        </div>

        {/* Sélecteur de lot */}
        <LotSelector
          selectedLotId={selectedLotId}
          onLotChange={setSelectedLotId}
          className="mb-6"
        />
      </div>

      {/* Contenu principal */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">❌ {error}</p>
        </div>
      )}

      {!loading && !error && dashboard && (
        <>
          {/* Stats rapides */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-600 font-medium">Jours saisis</div>
              <div className="text-3xl font-bold text-blue-600 mt-1">
                {dashboard.statistiques.nb_jours_saisis}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                / {dashboard.courbe_theorique.courbe.length} jours
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-600 font-medium">Écart moyen</div>
              <div className={`text-3xl font-bold mt-1 ${Math.abs(dashboard.statistiques.ecart_moyen_pct) > 10 ? 'text-red-600' : 'text-green-600'}`}>
                {dashboard.statistiques.ecart_moyen_pct > 0 ? '+' : ''}{dashboard.statistiques.ecart_moyen_pct.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                vs courbe théorique
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
              <div className="text-sm text-gray-600 font-medium">Écart maximum</div>
              <div className={`text-3xl font-bold mt-1 ${Math.abs(dashboard.statistiques.ecart_max_pct) > 10 ? 'text-orange-600' : 'text-green-600'}`}>
                {dashboard.statistiques.ecart_max_pct.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Pire écart détecté
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500">
              <div className="text-sm text-gray-600 font-medium">Alertes</div>
              <div className={`text-3xl font-bold mt-1 ${dashboard.statistiques.nb_alertes > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {dashboard.statistiques.nb_alertes}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {dashboard.statistiques.nb_alertes > 0 ? 'Action requise' : 'Tout va bien'}
              </div>
            </div>
          </div>

          {/* Grid principal: Graphique + Widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Graphique 3-Courbes (2/3) */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="h-96">
                  {chartData && <Line data={chartData} options={chartOptions} />}
                </div>

                {/* Actions rapides sous le graphique */}
                <div className="mt-6 flex gap-3">
                  {(() => {
                    const sessionActuelle = getSessionActuelle();
                    return (
                      <button
                        onClick={() => setShowSaisieModal(true)}
                        className={`flex-1 text-white px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                          sessionActuelle === 'matin'
                            ? 'bg-orange-500 hover:bg-orange-600'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {sessionActuelle === 'matin' ? '🌅' : '🌙'} Saisir Dose {sessionActuelle === 'matin' ? 'Matin' : 'Soir'}
                      </button>
                    );
                  })()}
                  <Link
                    href={`/lots/${selectedLotId}/historique`}
                    className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-2"
                  >
                    <History size={20} />
                    Historique
                  </Link>
                  <Link
                    href="/analytics"
                    className="flex-1 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 font-semibold flex items-center justify-center gap-2"
                  >
                    <TrendingUp size={20} />
                    Analytics
                  </Link>
                </div>
              </div>
            </div>

            {/* Widgets sidebar (1/3) */}
            <div className="space-y-6">
              {/* Widget Alertes */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={20} className="text-orange-600" />
                  <h3 className="font-bold text-gray-900">Alertes Récentes</h3>
                </div>
                {corrections.length > 0 ? (
                  <div className="space-y-2">
                    {corrections.slice(0, 3).map((correction) => (
                      <div key={correction.id} className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm">
                        <div className="font-semibold text-yellow-900">
                          J{correction.jour_gavage} - Écart {correction.ecart_detecte_pct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-yellow-700 mt-1">
                          Dose suggérée: {correction.dose_suggeree_g}g
                        </div>
                      </div>
                    ))}
                    {corrections.length > 3 && (
                      <Link href="/alertes" className="text-blue-600 text-xs hover:underline block mt-2">
                        Voir toutes les alertes ({corrections.length})
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">✅ Aucune alerte active</p>
                )}
              </div>

              {/* Widget Météo */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Cloud size={20} className="text-blue-600" />
                  <h3 className="font-bold text-gray-900">Météo du Jour</h3>
                </div>
                <div className="text-center py-4">
                  <div className="text-4xl mb-2">☀️</div>
                  <div className="text-2xl font-bold text-gray-900">22°C</div>
                  <div className="text-sm text-gray-600 mt-1">Ensoleillé</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Humidité: 65% • Vent: 12 km/h
                  </div>
                </div>
              </div>

              {/* Widget Prochaine Action */}
              <div className={`rounded-lg shadow-md p-4 text-white ${
                getSessionActuelle() === 'matin'
                  ? 'bg-gradient-to-br from-orange-500 to-amber-600'
                  : 'bg-gradient-to-br from-indigo-600 to-purple-700'
              }`}>
                <h3 className="font-bold mb-3">
                  {getSessionActuelle() === 'matin' ? '🌅' : '🌙'} Prochaine Dose
                </h3>
                {(() => {
                  // Trouver le dernier jour saisi (max de courbe_reelle)
                  const dernierJourSaisi = dashboard.courbe_reelle.length > 0
                    ? Math.max(...dashboard.courbe_reelle.map(d => d.jour_gavage))
                    : 0;

                  const prochainJour = dernierJourSaisi + 1;
                  const maxJours = dashboard.courbe_theorique.courbe.length;
                  const sessionActuelle = getSessionActuelle();

                  // Vérifier si tous les jours sont saisis
                  if (prochainJour > maxJours) {
                    return (
                      <div className="text-center py-4">
                        <div className="text-2xl mb-2">✅</div>
                        <div className="text-sm">
                          Lot terminé !
                        </div>
                      </div>
                    );
                  }

                  // Trouver la dose journalière suggérée
                  let doseJournaliere = dashboard.courbe_theorique.courbe[prochainJour - 1]?.dose_g || 0;
                  let typeDose = 'théorique';

                  if (courbePredictive?.courbe_predictive) {
                    const pointPredictif = courbePredictive.courbe_predictive.find((p: any) => p.jour === prochainJour);
                    if (pointPredictif) {
                      doseJournaliere = pointPredictif.dose_g;
                      typeDose = 'prédictive IA';
                    }
                  }

                  // Dose par session
                  const doseSession = sessionActuelle === 'matin'
                    ? Math.round(doseJournaliere * 0.45)
                    : Math.round(doseJournaliere * 0.55);

                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-lg font-bold">
                          Jour {prochainJour} - {sessionActuelle === 'matin' ? 'Matin' : 'Soir'}
                        </div>
                        <div className="text-xs bg-white/20 px-2 py-1 rounded">
                          {sessionActuelle === 'matin' ? '~45%' : '~55%'}
                        </div>
                      </div>
                      <div className="text-3xl font-bold my-3">
                        {doseSession}g
                      </div>
                      <div className="text-xs opacity-80 mb-3">
                        {typeDose === 'prédictive IA' ? '🤖 IA' : '📊 Théorique'} • Total jour: {doseJournaliere.toFixed(0)}g
                      </div>
                      <button
                        onClick={() => {
                          setSaisieForm({
                            jour_gavage: prochainJour,
                            session: sessionActuelle,
                            dose_reelle_g: doseSession,
                            commentaire: ''
                          });
                          setShowSaisieModal(true);
                        }}
                        className="w-full bg-white text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-100 font-semibold"
                      >
                        Saisir dose {sessionActuelle}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Équation PySR */}
          {dashboard.courbe_theorique.equation && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">🧮 Équation PySR v2</h3>
              <div className="font-mono text-sm bg-white p-3 rounded border border-blue-100">
                dose(jour) = {dashboard.courbe_theorique.equation}
              </div>
            </div>
          )}

          {/* Corrections IA en attente */}
          {corrections.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-yellow-900 mb-4">
                🤖 Corrections IA en attente ({corrections.length})
              </h3>
              <div className="space-y-4">
                {corrections.map((correction) => (
                  <div key={correction.id} className="bg-white rounded-lg p-4 border border-yellow-300">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-gray-900">
                          Jour {correction.jour_gavage} - Écart: {correction.ecart_detecte_pct.toFixed(2)}%
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {correction.raison_suggestion}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">
                          {correction.dose_suggeree_g}g
                        </div>
                        <div className="text-xs text-gray-500">
                          Confiance: {(correction.confiance_score * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleAccepterCorrection(correction.id, correction.dose_suggeree_g)}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-semibold"
                      >
                        ✅ Accepter
                      </button>
                      <button
                        onClick={() => handleRefuserCorrection(correction.id)}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm font-semibold"
                      >
                        ❌ Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Message si aucun lot sélectionné */}
      {!selectedLotId && !loading && (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Bienvenue sur votre Dashboard
          </h2>
          <p className="text-gray-600 mb-6">
            Sélectionnez un lot ci-dessus pour voir les courbes de gavage IA
          </p>
          <Link
            href="/lots"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            <BarChart3 size={20} />
            Voir tous mes lots
          </Link>
        </div>
      )}

      {/* Modal Saisie Dose */}
      {showSaisieModal && dashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {saisieForm.session === 'matin' ? '🌅' : '🌙'} Saisir Dose {saisieForm.session === 'matin' ? 'Matin' : 'Soir'}
            </h3>

            {/* Info suggestion */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-900">
                💡 Saisie d'une dose ({saisieForm.session}).
                <strong> 2 doses par jour</strong> : matin + soir.
              </p>
            </div>

            <div className="space-y-4">
              {/* Sélection Session */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session <span className="text-red-600">*</span>
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSaisieForm({ ...saisieForm, session: 'matin' })}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                      saisieForm.session === 'matin'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    🌅 Matin
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaisieForm({ ...saisieForm, session: 'soir' })}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                      saisieForm.session === 'soir'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    🌙 Soir
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jour de gavage <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={dashboard.courbe_theorique.courbe.length}
                  value={saisieForm.jour_gavage}
                  onChange={(e) => setSaisieForm({ ...saisieForm, jour_gavage: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Jour {saisieForm.jour_gavage} / {dashboard.courbe_theorique.courbe.length}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dose {saisieForm.session} (grammes) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={saisieForm.dose_reelle_g}
                  onChange={(e) => setSaisieForm({ ...saisieForm, dose_reelle_g: parseFloat(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                  placeholder="450"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {saisieForm.session === 'matin' ? '~45%' : '~55%'} de la dose journalière
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commentaire (optionnel)
                </label>
                <textarea
                  value={saisieForm.commentaire}
                  onChange={(e) => setSaisieForm({ ...saisieForm, commentaire: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                  placeholder="Canards très voraces aujourd'hui"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSaisirDose}
                className={`flex-1 text-white px-4 py-2 rounded-md font-semibold ${
                  saisieForm.session === 'matin'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                Enregistrer dose {saisieForm.session}
              </button>
              <button
                onClick={() => setShowSaisieModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
