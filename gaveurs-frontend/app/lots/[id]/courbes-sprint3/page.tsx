'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

export default function CourbesSprint3Page() {
  const params = useParams();
  const router = useRouter();
  const lotId = parseInt(params?.id as string, 10);

  const [dashboard, setDashboard] = useState<Dashboard3Courbes | null>(null);
  const [corrections, setCorrections] = useState<CorrectionIA[]>([]);
  const [courbePredictive, setCourbePredictive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // État pour saisie rapide dose
  const [showSaisieModal, setShowSaisieModal] = useState(false);
  const [saisieForm, setSaisieForm] = useState({
    jour_gavage: 1,
    dose_reelle_g: 0,
    commentaire: ''
  });

  useEffect(() => {
    if (!isNaN(lotId)) {
      loadData();
    }
  }, [lotId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [dashboardData, correctionsData, predictiveData] = await Promise.all([
        courbesAPI.getDashboard3Courbes(lotId),
        // TODO: Récupérer gaveur_id depuis contexte auth
        courbesAPI.getCorrectionsGaveur(1, true).catch(() => []),
        courbesAPI.getCourbePredictive(lotId).catch(() => null)
      ]);

      setDashboard(dashboardData);
      // Filtrer corrections pour ce lot
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
    if (!dashboard) return;

    try {
      const result = await courbesAPI.saisirDoseReelle({
        lot_id: lotId,
        gaveur_id: 1, // TODO: Depuis auth
        site_code: dashboard.courbe_theorique.statut === 'VALIDEE' ? 'LL' : 'LL', // TODO: Depuis lot
        date_gavage: new Date().toISOString().split('T')[0],
        jour_gavage: saisieForm.jour_gavage,
        dose_reelle_g: saisieForm.dose_reelle_g,
        commentaire_gaveur: saisieForm.commentaire || undefined
      });

      alert(`Dose saisie ! Écart: ${result.ecart_pct.toFixed(2)}%${result.alerte_ecart ? ' ⚠️ ALERTE' : ''}`);

      setShowSaisieModal(false);
      loadData(); // Recharger
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  };

  const handleAccepterCorrection = async (correctionId: number, doseSuggeree: number) => {
    try {
      await courbesAPI.repondreCorrectionIA(correctionId, true, doseSuggeree);
      alert('Correction acceptée !');
      loadData();
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Erreur'}`);
    }
  };

  const handleRefuserCorrection = async (correctionId: number) => {
    try {
      await courbesAPI.repondreCorrectionIA(correctionId, false);
      alert('Correction refusée');
      loadData();
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Erreur'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">❌ {error || 'Dashboard non disponible'}</p>
        </div>
      </div>
    );
  }

  // Préparer données graphique
  const maxJour = Math.max(
    ...dashboard.courbe_theorique.courbe.map(d => d.jour),
    ...dashboard.courbe_reelle.map(d => d.jour_gavage)
  );

  const chartData = {
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
      // 3ème courbe: Courbe Prédictive IA (si écarts détectés)
      ...(courbePredictive?.a_des_ecarts ? [{
        label: 'Courbe Prédictive IA',
        data: courbePredictive.courbe_predictive.map((d: any) => d.dose_g),
        borderColor: 'rgb(249, 115, 22)', // Orange
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        borderWidth: 2,
        borderDash: [10, 5], // Tirets différents de la théorique
        pointStyle: 'triangle' // Points triangulaires pour différencier
      }] : [])
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Dashboard 3-Courbes - Lot ${lotId}`,
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

  const stats = dashboard.statistiques;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/lots/${lotId}`} className="text-blue-600 hover:underline mb-4 inline-block">
          ← Retour au lot
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📈 Dashboard 3-Courbes (Sprint 3)
            </h1>
            <p className="text-gray-600">
              Lot {lotId} • Courbe {dashboard.courbe_theorique.statut}
              {dashboard.courbe_theorique.superviseur && ` par ${dashboard.courbe_theorique.superviseur}`}
            </p>
          </div>

          <button
            onClick={() => setShowSaisieModal(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold"
          >
            ➕ Saisir Dose
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Jours saisis</div>
          <div className="text-2xl font-bold text-blue-600">{stats.nb_jours_saisis}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Écart moyen</div>
          <div className={`text-2xl font-bold ${Math.abs(stats.ecart_moyen_pct) > 10 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.ecart_moyen_pct.toFixed(2)}%
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Écart maximum</div>
          <div className={`text-2xl font-bold ${Math.abs(stats.ecart_max_pct) > 10 ? 'text-orange-600' : 'text-green-600'}`}>
            {stats.ecart_max_pct.toFixed(2)}%
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Alertes</div>
          <div className={`text-2xl font-bold ${stats.nb_alertes > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.nb_alertes}
          </div>
        </div>
      </div>

      {/* Graphique */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <Line data={chartData} options={chartOptions} />
      </div>

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

      {/* Équation PySR */}
      {dashboard.courbe_theorique.equation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">🧮 Équation PySR</h3>
          <div className="font-mono text-sm bg-white p-3 rounded border border-blue-100">
            dose(jour) = {dashboard.courbe_theorique.equation}
          </div>
        </div>
      )}

      {/* Historique doses réelles */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">📊 Historique Doses Réelles</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jour</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Théorique</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Réelle</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Écart</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Alerte</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboard.courbe_reelle.map((dose) => (
                <tr key={dose.jour_gavage} className={dose.alerte_ecart ? 'bg-red-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    J{dose.jour_gavage}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(dose.date_gavage).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                    {dose.dose_theorique_g}g
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                    {dose.dose_reelle_g}g
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                    dose.ecart_pct > 10 ? 'text-red-600' :
                    dose.ecart_pct < -10 ? 'text-orange-600' :
                    'text-green-600'
                  }`}>
                    {dose.ecart_pct > 0 ? '+' : ''}{dose.ecart_pct.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {dose.alerte_ecart && <span className="text-red-600 text-lg">⚠️</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Saisie */}
      {showSaisieModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">➕ Saisir Dose Quotidienne</h3>

            <div className="space-y-4">
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dose réelle (grammes) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={saisieForm.dose_reelle_g}
                  onChange={(e) => setSaisieForm({ ...saisieForm, dose_reelle_g: parseFloat(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="150.5"
                />
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
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-semibold"
              >
                Enregistrer
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
