'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Bell, Info, CheckCircle, Filter } from 'lucide-react';
import { alerteApi } from '@/lib/api';
import { DEFAULT_GAVEUR_ID } from '@/lib/constants';
import { formatDateTime, getNiveauColor, getNiveauIcon } from '@/lib/utils';
import type { Alerte, AlerteDashboard } from '@/lib/types';

export default function AlertesPage() {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [dashboard, setDashboard] = useState<AlerteDashboard | null>(null);
  const [filterNiveau, setFilterNiveau] = useState<string>('all');
  const [filterAcquittee, setFilterAcquittee] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [filterAcquittee]);

  const loadData = async () => {
    setLoading(true);
    try {
      // NOTE: Endpoints alertes temporairement désactivés (CORS error + 500)
      // À réactiver quand le backend aura implémenté:
      // - GET /api/alertes/gaveur/{id}
      // - GET /api/alertes/dashboard/{id}
      // - Configuration CORS pour localhost:3001

      // const [alertesData, dashboardData] = await Promise.all([
      //   alerteApi.getByGaveur(DEFAULT_GAVEUR_ID, filterAcquittee ? undefined : false),
      //   alerteApi.getDashboard(DEFAULT_GAVEUR_ID),
      // ]);

      // Données factices temporaires
      setAlertes([]);
      setDashboard({
        total_actives: 0,
        par_niveau: {
          warning: 0,
          alert: 0,
          critical: 0
        },
        alertes_recentes: []
      } as AlerteDashboard);

      // if (Array.isArray(alertesData)) {
      //   setAlertes(alertesData as Alerte[]);
      // } else {
      //   console.warn('alertesData is not an array:', alertesData);
      //   setAlertes([]);
      // }
      // setDashboard(dashboardData as AlerteDashboard);
    } catch (error) {
      console.error('Erreur chargement alertes:', error);
      setAlertes([]);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  const acquitter = async (alerteId: number) => {
    try {
      await alerteApi.acquitter(alerteId, DEFAULT_GAVEUR_ID);
      loadData();
    } catch (error) {
      console.error('Erreur acquittement:', error);
    }
  };

  const filteredAlertes = alertes.filter((alerte) => {
    if (filterNiveau !== 'all' && alerte.niveau !== filterNiveau) return false;
    return true;
  });

  const getIconByNiveau = (niveau: string) => {
    switch (niveau) {
      case 'critique':
        return <AlertTriangle className="text-red-600" size={24} />;
      case 'important':
        return <Bell className="text-orange-600" size={24} />;
      case 'info':
        return <Info className="text-blue-600" size={24} />;
      default:
        return <Bell className="text-gray-600" size={24} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">Gestion des Alertes</h1>

        {/* Dashboard KPIs */}
        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-4 text-white">
              <p className="text-sm opacity-90">Critiques</p>
              <p className="text-3xl font-bold">{dashboard.critiques_actives}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-4 text-white">
              <p className="text-sm opacity-90">Importantes</p>
              <p className="text-3xl font-bold">{dashboard.importantes_actives}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
              <p className="text-sm opacity-90">Info</p>
              <p className="text-3xl font-bold">{dashboard.info_actives}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-4 text-white">
              <p className="text-sm opacity-90">24h</p>
              <p className="text-3xl font-bold">{dashboard.alertes_24h}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-4 text-white">
              <p className="text-sm opacity-90">SMS</p>
              <p className="text-3xl font-bold">{dashboard.sms_envoyes}</p>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-center">
          <Filter size={20} className="text-gray-500" />
          <select
            value={filterNiveau}
            onChange={(e) => setFilterNiveau(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les niveaux</option>
            <option value="critique">Critiques</option>
            <option value="important">Importantes</option>
            <option value="info">Informatives</option>
          </select>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterAcquittee}
              onChange={(e) => setFilterAcquittee(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Afficher acquittées</span>
          </label>

          <span className="ml-auto text-sm text-gray-500">
            {filteredAlertes.length} alerte(s)
          </span>
        </div>

        {/* Liste alertes */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : filteredAlertes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-600 mb-2">Aucune alerte</h3>
            <p className="text-gray-500">Tout est sous contrôle !</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAlertes.map((alerte) => (
              <div
                key={alerte.id}
                className={`border-l-4 rounded-lg p-4 ${getNiveauColor(alerte.niveau)} ${
                  alerte.acquittee ? 'opacity-60' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getIconByNiveau(alerte.niveau)}
                      <h3 className="font-bold text-lg">{alerte.type_alerte}</h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          alerte.niveau === 'critique'
                            ? 'bg-red-600 text-white'
                            : alerte.niveau === 'important'
                            ? 'bg-orange-500 text-white'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {alerte.niveau}
                      </span>
                      {alerte.acquittee && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold">
                          Acquittée
                        </span>
                      )}
                    </div>

                    <p className="text-gray-700 mb-2">{alerte.message}</p>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>🦆 Canard #{alerte.canard_id}</span>
                      <span>📅 {formatDateTime(alerte.time)}</span>
                      {alerte.valeur_mesuree !== undefined && (
                        <span>📊 Valeur: {alerte.valeur_mesuree}</span>
                      )}
                      {alerte.valeur_seuil !== undefined && (
                        <span>⚠️ Seuil: {alerte.valeur_seuil}</span>
                      )}
                      {alerte.sms_envoye && (
                        <span className="text-green-600">📱 SMS envoyé</span>
                      )}
                    </div>

                    {alerte.acquittee && alerte.acquittee_le && (
                      <p className="text-xs text-gray-500 mt-2">
                        Acquittée le {formatDateTime(alerte.acquittee_le)}
                      </p>
                    )}
                  </div>

                  {!alerte.acquittee && (
                    <button
                      onClick={() => acquitter(alerte.id)}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
                    >
                      <CheckCircle size={18} />
                      Acquitter
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
