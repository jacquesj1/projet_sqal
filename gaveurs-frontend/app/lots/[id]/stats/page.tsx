'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Lot } from '@/types/lot';
import QualiteCard from '@/components/lots/QualiteCard';
import { KPICard } from '@/components/ui/Card';

export default function StatsPage() {
  const params = useParams();
  const router = useRouter();
  const lotId = parseInt(params?.id as string, 10);

  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isNaN(lotId)) {
      loadLot();
    }
  }, [lotId]);

  const loadLot = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/lots/${lotId}`);
      if (!response.ok) throw new Error('Erreur chargement lot');
      const data = await response.json();
      setLot(data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-600">Lot non trouvé</p>
            <Link href="/lots" className="text-blue-600 hover:underline mt-4 inline-block">
              Retour aux lots
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/lots/${lotId}/gavage`}
            className="text-blue-600 hover:underline flex items-center mb-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au gavage
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">
            Statistiques - Lot {lot.code_lot}
          </h1>
          <p className="text-gray-600 mt-2">
            {lot.nombre_canards} canards · {lot.souche} · Gaveur {lot.gaveur_id}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <KPICard
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            }
            label="Poids actuel moyen"
            value={`${lot.poids_moyen_actuel.toFixed(0)} g`}
            color="blue"
            subtitle={`Départ: ${lot.poids_moyen_initial.toFixed(0)} g`}
          />
          <KPICard
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            label="Gain de poids"
            value={`${(lot.poids_moyen_actuel - lot.poids_moyen_initial).toFixed(0)} g`}
            color="green"
            subtitle={`+${(((lot.poids_moyen_actuel - lot.poids_moyen_initial) / lot.poids_moyen_initial) * 100).toFixed(1)}%`}
          />
          <KPICard
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            label="ITM"
            value={lot.itm?.toFixed(2) || 'N/A'}
            color="purple"
            subtitle="Indice de transformation"
          />
          <KPICard
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="Durée gavage"
            value={lot.duree_gavage_prevue || 'N/A'}
            color="orange"
            subtitle="jours"
          />
        </div>

        {/* Grille principale */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations générales */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Informations Générales</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Date début</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {new Date(lot.date_debut_gavage).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date fin prévue</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {lot.date_fin_prevue
                      ? new Date(lot.date_fin_prevue).toLocaleDateString('fr-FR')
                      : 'Non définie'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Nombre canards</p>
                  <p className="text-lg font-semibold text-gray-800">{lot.nombre_canards}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Souche</p>
                  <p className="text-lg font-semibold text-gray-800">{lot.souche}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Statut</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      lot.statut === 'termine'
                        ? 'bg-green-100 text-green-800'
                        : lot.statut === 'en_cours'
                        ? 'bg-blue-100 text-blue-800'
                        : lot.statut === 'planifie'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {lot.statut}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Site</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {lot.site_id || 'Non assigné'}
                  </p>
                </div>
              </div>
            </div>

            {/* Placeholder pour futurs graphiques */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Courbes de Gavage</h2>
              <div className="text-center py-12 text-gray-500">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                </svg>
                <p>Les graphiques de courbes seront affichés ici</p>
                <Link
                  href={`/lots/${lotId}/courbes-sprint3`}
                  className="text-blue-600 hover:underline mt-2 inline-block"
                >
                  Voir les courbes détaillées
                </Link>
              </div>
            </div>
          </div>

          {/* Colonne droite - 1/3 */}
          <div className="space-y-6">
            {/* Carte Qualité SQAL */}
            <QualiteCard lotId={lotId} />

            {/* Navigation rapide */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Navigation</h3>
              <div className="space-y-2">
                <Link
                  href={`/lots/${lotId}/gavage`}
                  className="block p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <p className="font-semibold text-blue-800">Saisie gavage</p>
                  <p className="text-xs text-blue-600">Ajouter des données</p>
                </Link>
                <Link
                  href={`/lots/${lotId}/historique`}
                  className="block p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <p className="font-semibold text-green-800">Historique</p>
                  <p className="text-xs text-green-600">Voir les données passées</p>
                </Link>
                <Link
                  href={`/lots/${lotId}/courbes-sprint3`}
                  className="block p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                >
                  <p className="font-semibold text-purple-800">Courbes</p>
                  <p className="text-xs text-purple-600">Analyse graphique</p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
