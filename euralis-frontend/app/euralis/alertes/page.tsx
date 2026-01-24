'use client';

import { useState, useEffect } from 'react';
import { euralisAPI } from '@/lib/euralis/api';
import { AlertTriangle, CheckCircle, Info, AlertCircle, Filter, RefreshCw } from 'lucide-react';
import type { Alerte } from '@/lib/euralis/types';

export default function AlertesPage() {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [filtreStatut, setFiltreStatut] = useState<'all' | 'actives' | 'acquittees'>('actives');
  const [filtreCriticite, setFiltreCriticite] = useState<string>('all');
  const [filtreSite, setFiltreSite] = useState<string>('all');

  useEffect(() => {
    fetchAlertes();
  }, [filtreStatut, filtreCriticite, filtreSite]);

  const fetchAlertes = async () => {
    try {
      setLoading(true);
      setError(null);

      // Construire les paramètres
      const params: any = {};

      if (filtreStatut === 'actives') params.acquittee = false;
      if (filtreStatut === 'acquittees') params.acquittee = true;
      if (filtreCriticite !== 'all') params.criticite = filtreCriticite;
      if (filtreSite !== 'all') params.siteCode = filtreSite;

      const data = await euralisAPI.getAlertes(
        params.criticite,
        params.siteCode,
        params.severite,
        params.acquittee,
        100
      );

      setAlertes(data);
    } catch (err) {
      console.error('Erreur chargement alertes:', err);
      setError('Impossible de charger les alertes');
    } finally {
      setLoading(false);
    }
  };

  const acquitterAlerte = async (id: number) => {
    try {
      await euralisAPI.acquitterAlerte(id);
      // Rafraîchir la liste
      fetchAlertes();
    } catch (err) {
      console.error('Erreur acquittement alerte:', err);
      alert('Erreur lors de l\'acquittement de l\'alerte');
    }
  };

  const getSeverityIcon = (severite: string) => {
    switch (severite) {
      case 'critique':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'important':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getSeverityBadge = (severite: string) => {
    const badges = {
      'critique': 'bg-red-100 text-red-800 border-red-300',
      'important': 'bg-orange-100 text-orange-800 border-orange-300',
      'warning': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'info': 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return badges[severite as keyof typeof badges] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getSeverityLabel = (severite: string) => {
    const labels = {
      'critique': 'Critique',
      'important': 'Important',
      'warning': 'Avertissement',
      'info': 'Information'
    };
    return labels[severite as keyof typeof labels] || severite;
  };

  const alertesActives = alertes.filter(a => !a.acquittee);
  const alertesAcquittees = alertes.filter(a => a.acquittee);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Alertes</h1>
        <p className="text-gray-600 mt-1">
          Supervision des alertes multi-sites - {alertesActives.length} active{alertesActives.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats Rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border-2 border-red-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Alertes Actives</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{alertesActives.length}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critiques</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {alertes.filter(a => a.severite === 'critique' && !a.acquittee).length}
              </p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Importantes</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">
                {alertes.filter(a => a.severite === 'important' && !a.acquittee).length}
              </p>
            </div>
            <AlertCircle className="h-10 w-10 text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Acquittées</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{alertesAcquittees.length}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filtres</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Filtre Statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <select
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes</option>
              <option value="actives">Actives uniquement</option>
              <option value="acquittees">Acquittées uniquement</option>
            </select>
          </div>

          {/* Filtre Criticité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Criticité</label>
            <select
              value={filtreCriticite}
              onChange={(e) => setFiltreCriticite(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes</option>
              <option value="critique">Critique</option>
              <option value="important">Important</option>
              <option value="warning">Avertissement</option>
              <option value="info">Information</option>
            </select>
          </div>

          {/* Filtre Site */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Site</label>
            <select
              value={filtreSite}
              onChange={(e) => setFiltreSite(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les sites</option>
              <option value="LL">LL - Bretagne</option>
              <option value="LS">LS - Pays de Loire</option>
              <option value="MT">MT - Maubourguet</option>
            </select>
          </div>

          {/* Bouton Rafraîchir */}
          <div className="flex items-end">
            <button
              onClick={fetchAlertes}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Rafraîchir
            </button>
          </div>
        </div>
      </div>

      {/* Liste des Alertes */}
      {loading && alertes.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Chargement des alertes...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800">{error}</p>
        </div>
      ) : alertes.length === 0 ? (
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-12 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Aucune alerte</h3>
          <p className="text-gray-600">Aucune alerte ne correspond aux filtres sélectionnés</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {alertes.map((alerte) => (
              <div
                key={alerte.id}
                className={`p-6 hover:bg-gray-50 transition-colors ${
                  alerte.acquittee ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Icône de sévérité */}
                    <div className="flex-shrink-0 mt-1">
                      {getSeverityIcon(alerte.severite)}
                    </div>

                    {/* Contenu de l'alerte */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full border ${getSeverityBadge(
                            alerte.severite
                          )}`}
                        >
                          {getSeverityLabel(alerte.severite)}
                        </span>
                        {alerte.site_code && (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                            Site {alerte.site_code}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(alerte.time).toLocaleString('fr-FR')}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {alerte.type_alerte}
                      </h3>
                      <p className="text-sm text-gray-700">{alerte.message}</p>

                      {alerte.niveau && (
                        <div className="mt-2 text-xs text-gray-600">
                          <span className="font-medium">Niveau:</span> {alerte.niveau}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 ml-4">
                    {alerte.acquittee ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">Acquittée</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => acquitterAlerte(alerte.id)}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Acquitter
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer avec total */}
      {alertes.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-600">
          Affichage de {alertes.length} alerte{alertes.length > 1 ? 's' : ''} •{' '}
          <span className="text-red-600 font-medium">
            {alertesActives.length} active{alertesActives.length > 1 ? 's' : ''}
          </span>{' '}
          •{' '}
          <span className="text-green-600 font-medium">
            {alertesAcquittees.length} acquittée{alertesAcquittees.length > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
