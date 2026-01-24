'use client';

import { useEffect, useState } from 'react';
import type { QualiteSQAL } from '@/types/lot';

interface QualiteCardProps {
  lotId: number;
  className?: string;
}

export default function QualiteCard({ lotId, className = '' }: QualiteCardProps) {
  const [qualiteData, setQualiteData] = useState<QualiteSQAL | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQualiteData();
  }, [lotId]);

  const loadQualiteData = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/lots/${lotId}/qualite`);

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des données qualité');
      }

      const data = await response.json();
      setQualiteData(data);
    } catch (err) {
      console.error('Erreur chargement qualité:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
        </div>
      </div>
    );
  }

  if (error || !qualiteData) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <p className="text-sm">Impossible de charger les données qualité</p>
          {error && <p className="text-xs mt-1 text-red-500">{error}</p>}
        </div>
      </div>
    );
  }

  if (!qualiteData.has_sqal_data) {
    return (
      <div className={`bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg shadow-lg p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gray-300 rounded-lg">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700">Contrôle Qualité SQAL</h3>
        </div>
        <div className="text-center py-6">
          <p className="text-gray-600">Aucune mesure de contrôle qualité disponible</p>
          <p className="text-sm text-gray-500 mt-2">Les données apparaîtront après analyse SQAL</p>
        </div>
      </div>
    );
  }

  const gradeColors: { [key: string]: string } = {
    'A+': 'from-green-500 to-green-600',
    'A': 'from-blue-500 to-blue-600',
    'B': 'from-yellow-500 to-yellow-600',
    'C': 'from-orange-500 to-orange-600',
    'REJECT': 'from-red-500 to-red-600',
  };

  const gradeColor = qualiteData.grades?.majoritaire
    ? gradeColors[qualiteData.grades.majoritaire]
    : 'from-gray-500 to-gray-600';

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Header avec grade majoritaire */}
      <div className={`bg-gradient-to-br ${gradeColor} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold opacity-90">Contrôle Qualité SQAL</h3>
            <p className="text-3xl font-bold mt-2">
              Grade {qualiteData.grades?.majoritaire || 'N/A'}
            </p>
            {qualiteData.nb_echantillons > 0 && (
              <p className="text-sm opacity-75 mt-1">
                {qualiteData.nb_echantillons} échantillon{qualiteData.nb_echantillons > 1 ? 's' : ''} analysé{qualiteData.nb_echantillons > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="opacity-80">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Poids de foie */}
        {qualiteData.poids_foie && (
          <div className="border-b pb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              Poids de Foie
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-pink-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600">Moyen</p>
                <p className="text-xl font-bold text-pink-600">
                  {qualiteData.poids_foie.moyen_g.toFixed(0)} g
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600">Min</p>
                <p className="text-lg font-semibold text-gray-700">
                  {qualiteData.poids_foie.min_g.toFixed(0)} g
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600">Max</p>
                <p className="text-lg font-semibold text-gray-700">
                  {qualiteData.poids_foie.max_g.toFixed(0)} g
                </p>
              </div>
            </div>
            {qualiteData.poids_foie.ecart_type_g && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Écart-type: {qualiteData.poids_foie.ecart_type_g.toFixed(1)} g
              </p>
            )}
          </div>
        )}

        {/* Scores et indices */}
        {qualiteData.scores && (
          <div className="border-b pb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Scores Qualité</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Score moyen</span>
                <div className="flex items-center">
                  <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                    <div
                      className="h-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
                      style={{ width: `${qualiteData.scores.moyen * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    {(qualiteData.scores.moyen * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              {qualiteData.indices_spectraux && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Fraîcheur</span>
                    <div className="flex items-center">
                      <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                        <div
                          className="h-2 bg-green-500 rounded-full"
                          style={{ width: `${qualiteData.indices_spectraux.fraicheur * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {(qualiteData.indices_spectraux.fraicheur * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Oxydation</span>
                    <div className="flex items-center">
                      <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                        <div
                          className="h-2 bg-red-500 rounded-full"
                          style={{ width: `${qualiteData.indices_spectraux.oxydation * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {(qualiteData.indices_spectraux.oxydation * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Qualité gras</span>
                    <div className="flex items-center">
                      <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                        <div
                          className="h-2 bg-yellow-500 rounded-full"
                          style={{ width: `${qualiteData.indices_spectraux.qualite_gras * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {(qualiteData.indices_spectraux.qualite_gras * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Distribution des grades */}
        {qualiteData.grades?.repartition && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Répartition des Grades</h4>
            <div className="space-y-2">
              {Object.entries(qualiteData.grades.repartition)
                .filter(([_, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([grade, count]) => {
                  const percentage = qualiteData.nb_echantillons > 0
                    ? (count / qualiteData.nb_echantillons) * 100
                    : 0;
                  const bgColor = grade === 'A+' ? 'bg-green-500' :
                                 grade === 'A' ? 'bg-blue-500' :
                                 grade === 'B' ? 'bg-yellow-500' :
                                 grade === 'C' ? 'bg-orange-500' :
                                 'bg-red-500';
                  return (
                    <div key={grade} className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-700 w-16">
                        Grade {grade}
                      </span>
                      <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-6 ${bgColor} flex items-center justify-end pr-2 transition-all`}
                          style={{ width: `${percentage}%` }}
                        >
                          {percentage > 10 && (
                            <span className="text-xs font-semibold text-white">
                              {count}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
            </div>
            {qualiteData.grades.pourcent_a_plus_a !== undefined && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">
                    {qualiteData.grades.pourcent_a_plus_a.toFixed(1)}%
                  </span>
                  {' '}de grades A+ ou A
                </p>
              </div>
            )}
          </div>
        )}

        {/* Conformité */}
        {qualiteData.conformite && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-green-800">Conformité</span>
              </div>
              <span className="text-lg font-bold text-green-600">
                {qualiteData.conformite.pourcent_conformes?.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-green-700 mt-1">
              {qualiteData.conformite.nb_conformes} / {qualiteData.nb_echantillons} échantillons conformes
            </p>
          </div>
        )}

        {/* Dates des mesures */}
        {qualiteData.dates && (
          <div className="pt-4 border-t">
            <p className="text-xs text-gray-500">
              Première mesure: {new Date(qualiteData.dates.premiere_mesure).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Dernière mesure: {new Date(qualiteData.dates.derniere_mesure).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
