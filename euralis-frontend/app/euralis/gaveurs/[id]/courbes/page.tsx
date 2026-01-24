'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { euralisAPI } from '@/lib/euralis/api';
import { ArrowLeft, TrendingDown, Award, AlertCircle, Save, RefreshCw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface JourCourbe {
  jour: number;
  matin: number;
  soir: number;
  total: number;
}

interface CourbeRecommandation {
  gaveur: {
    id: number;
    nom: string;
    prenom?: string;
    nb_lots_historique: number;
    itm_moyen: number;
    mortalite_moyenne: number;
    cluster: number;
  };
  courbe_recommandee: JourCourbe[];
  metadata: {
    cluster: number;
    itm_historique: number;
    itm_cible: number;
    mortalite_historique: number;
    nb_canards: number;
    souche: string;
    total_mais_par_canard_g: number;
    total_mais_lot_kg: number;
    facteur_ajustement: number;
    date_generation: string;
    source: string;
  };
  recommandations: string[];
  courbe_existante: any;
}

interface PerformanceHistory {
  gaveur_id: number;
  lots: Array<{
    id: number;
    code_lot: string;
    debut_lot: string;
    duree_jours: number;
    itm: number;
    sigma: number;
    mortalite_pct: number;
    total_mais_kg: number;
    poids_foie_moyen_g: number;
    nb_canards: number;
    souche: string;
    production_kg: number;
  }>;
  statistiques: {
    itm_moyen: number;
    itm_min: number;
    itm_max: number;
    mortalite_moyenne: number;
    production_totale_kg: number;
    nb_lots: number;
    tendance_itm: string;
  };
}

export default function CourbesOptimalesPage() {
  const params = useParams();
  const router = useRouter();
  const gaveurId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationStep, setValidationStep] = useState<'review' | 'validated' | 'saved'>('review');
  const [courbeData, setCourbeData] = useState<CourbeRecommandation | null>(null);
  const [historyData, setHistoryData] = useState<PerformanceHistory | null>(null);
  const [nbCanards, setNbCanards] = useState(800);
  const [souche, setSouche] = useState('Mulard');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [gaveurId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger recommandation
      const recommandation = await euralisAPI.getGaveurCourbeRecommandee(gaveurId, nbCanards, souche);
      setCourbeData(recommandation);

      // Charger historique
      const history = await euralisAPI.getGaveurPerformanceHistory(gaveurId, 10);
      setHistoryData(history);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCourbe = () => {
    setValidationStep('validated');
  };

  const handleSaveCourbe = async () => {
    if (!courbeData) return;

    try {
      setSaving(true);
      await euralisAPI.sauvegarderCourbeRecommandee(gaveurId, {
        courbe: courbeData.courbe_recommandee,
        metadata: {
          ...courbeData.metadata,
          notes: notes,
        },
      });
      setValidationStep('saved');
      alert('Courbe sauvegardée avec succès ! Elle est maintenant prête à être soumise au gaveur.');
      await loadData(); // Recharger pour obtenir la courbe sauvegardée
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerer = async () => {
    await loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!courbeData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Impossible de charger les données du gaveur</p>
        </div>
      </div>
    );
  }

  // Préparer données pour graphique
  const chartData = courbeData.courbe_recommandee.map((jour) => ({
    jour: `J${jour.jour}`,
    Matin: jour.matin,
    Soir: jour.soir,
    Total: jour.total,
  }));

  // Cluster labels
  const clusterLabels = ['Excellent', 'Très bon', 'Bon', 'À améliorer', 'Critique'];
  const clusterColors = ['text-green-600', 'text-blue-600', 'text-yellow-600', 'text-orange-600', 'text-red-600'];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Workflow Validation Banner */}
      <div className="mb-6 bg-white rounded-lg shadow-lg border-2 border-blue-500 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Workflow de Validation</h3>
          <div className="flex gap-2">
            {['review', 'validated', 'saved'].map((step, idx) => (
              <div
                key={step}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  validationStep === step
                    ? 'bg-blue-600 text-white'
                    : idx < ['review', 'validated', 'saved'].indexOf(validationStep)
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-sm font-bold">
                  {idx + 1}
                </div>
                <span className="text-sm font-medium">
                  {step === 'review' ? 'Revue' : step === 'validated' ? 'Validée' : 'Sauvegardée'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {validationStep === 'review' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 mb-3">
              📋 Vérifiez la courbe recommandée ci-dessous. Assurez-vous qu'elle correspond au profil du gaveur.
            </p>
            <button
              onClick={handleValidateCourbe}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              ✓ Valider la courbe
            </button>
          </div>
        )}

        {validationStep === 'validated' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-900 mb-3">
              ✓ Courbe validée ! Ajoutez des notes (optionnel) puis sauvegardez pour finaliser.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes pour le gaveur (optionnel)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
            <button
              onClick={handleSaveCourbe}
              disabled={saving}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
            >
              {saving ? '💾 Sauvegarde...' : '💾 Sauvegarder et Finaliser'}
            </button>
          </div>
        )}

        {validationStep === 'saved' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-900 mb-2">
              🎉 Courbe sauvegardée avec succès ! Elle est maintenant disponible pour le gaveur.
            </p>
            <p className="text-xs text-purple-700">
              Le gaveur peut consulter cette courbe dans son application mobile ou tableau de bord.
            </p>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Retour
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Courbe Optimale - {courbeData.gaveur.nom} {courbeData.gaveur.prenom || ''}
            </h1>
            <p className="text-gray-600 mt-1">
              Recommandation personnalisée basée sur {courbeData.gaveur.nb_lots_historique} lots historiques
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRegenerer}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <RefreshCw className="h-4 w-4" />
              Régénérer
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cluster Performance</p>
              <p className={`text-2xl font-bold ${clusterColors[courbeData.gaveur.cluster]}`}>
                {clusterLabels[courbeData.gaveur.cluster]}
              </p>
            </div>
            <Award className="h-10 w-10 text-gray-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ITM Historique</p>
              <p className="text-2xl font-bold text-gray-900">{courbeData.metadata.itm_historique.toFixed(2)}</p>
            </div>
            <TrendingDown className="h-10 w-10 text-gray-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ITM Cible</p>
              <p className="text-2xl font-bold text-green-600">{courbeData.metadata.itm_cible.toFixed(2)}</p>
            </div>
            <TrendingDown className="h-10 w-10 text-green-300" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Amélioration: {(courbeData.metadata.itm_historique - courbeData.metadata.itm_cible).toFixed(2)} points
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Maïs</p>
              <p className="text-2xl font-bold text-gray-900">
                {(courbeData.metadata.total_mais_par_canard_g / 1000).toFixed(1)} kg
              </p>
            </div>
            <AlertCircle className="h-10 w-10 text-gray-300" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Par canard • Facteur: {(courbeData.metadata.facteur_ajustement * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Graphique Courbe */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Courbe de Gavage Recommandée (11 jours)</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="jour" />
            <YAxis label={{ value: 'Dose (g)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Matin" stroke="#3b82f6" strokeWidth={2} />
            <Line type="monotone" dataKey="Soir" stroke="#10b981" strokeWidth={2} />
            <Line type="monotone" dataKey="Total" stroke="#8b5cf6" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau Détaillé */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Détail Journalier</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jour</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matin (g)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Soir (g)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total (g)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cumul (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {courbeData.courbe_recommandee.map((jour, idx) => {
                const cumul = courbeData.courbe_recommandee
                  .slice(0, idx + 1)
                  .reduce((sum, j) => sum + j.total, 0);
                return (
                  <tr key={jour.jour} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Jour {jour.jour}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{jour.matin}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{jour.soir}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                      {jour.total}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(cumul / 1000).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-100 font-semibold">
                <td className="px-6 py-4 text-sm text-gray-900">TOTAL</td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {courbeData.courbe_recommandee.reduce((sum, j) => sum + j.matin, 0)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {courbeData.courbe_recommandee.reduce((sum, j) => sum + j.soir, 0)}
                </td>
                <td className="px-6 py-4 text-sm text-blue-600">
                  {courbeData.metadata.total_mais_par_canard_g}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {(courbeData.metadata.total_mais_par_canard_g / 1000).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommandations */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow border-2 border-blue-200 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-blue-600" />
          Recommandations Personnalisées
        </h2>
        <div className="space-y-3">
          {courbeData.recommandations.map((rec, idx) => (
            <div key={idx} className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-gray-800">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Historique Performances */}
      {historyData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Historique Performances</h2>

          {/* Stats Résumé */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">ITM Moyen</p>
              <p className="text-lg font-bold text-gray-900">
                {historyData.statistiques.itm_moyen?.toFixed(2) || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Meilleur ITM</p>
              <p className="text-lg font-bold text-green-600">
                {historyData.statistiques.itm_min?.toFixed(2) || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Production Totale</p>
              <p className="text-lg font-bold text-gray-900">
                {historyData.statistiques.production_totale_kg?.toFixed(0) || '0'} kg
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tendance</p>
              <p className="text-lg font-bold text-blue-600 capitalize">
                {historyData.statistiques.tendance_itm || 'N/A'}
              </p>
            </div>
          </div>

          {/* Tableau Lots */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code Lot</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ITM</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mortalité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Production</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {historyData.lots.map((lot) => (
                  <tr key={lot.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {lot.code_lot}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(lot.debut_lot).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                      {lot.itm?.toFixed(2) || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {lot.mortalite_pct?.toFixed(1) || '0'}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lot.production_kg?.toFixed(0) || 'N/A'} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
