'use client';

import { useState, useEffect } from 'react';
import { Package, ChevronDown } from 'lucide-react';
import type { Lot } from '@/types/lot';

interface LotSelectorProps {
  selectedLotId: number | null;
  onLotChange: (lotId: number) => void;
  className?: string;
}

export default function LotSelector({ selectedLotId, onLotChange, className = '' }: LotSelectorProps) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Hardcoded gaveur_id pour démo
  const GAVEUR_ID = 1;

  useEffect(() => {
    loadLots();
  }, []);

  const loadLots = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/lots/gaveur/${GAVEUR_ID}`);
      const data = await response.json();

      if (Array.isArray(data)) {
        // Trier: lots en gavage en premier, puis par ID décroissant
        const sorted = data.sort((a, b) => {
          if (a.statut === 'en_gavage' && b.statut !== 'en_gavage') return -1;
          if (a.statut !== 'en_gavage' && b.statut === 'en_gavage') return 1;
          return b.id - a.id;
        });
        setLots(sorted);

        // Sélectionner le premier lot en gavage si aucun lot n'est sélectionné
        if (!selectedLotId && sorted.length > 0) {
          const firstEnGavage = sorted.find(l => l.statut === 'en_gavage');
          onLotChange(firstEnGavage?.id || sorted[0].id);
        }
      }
    } catch (error) {
      console.error('Erreur chargement lots:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedLot = lots.find(l => l.id === selectedLotId);
  const lotsEnGavage = lots.filter(l => l.statut === 'en_gavage');
  const lotsAutres = lots.filter(l => l.statut !== 'en_gavage');

  const getStatutBadge = (statut: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      'en_preparation': { label: 'Préparation', className: 'bg-gray-100 text-gray-700' },
      'en_gavage': { label: 'En gavage', className: 'bg-green-100 text-green-700' },
      'termine': { label: 'Terminé', className: 'bg-blue-100 text-blue-700' },
      'abattu': { label: 'Abattu', className: 'bg-purple-100 text-purple-700' }
    };
    const badge = badges[statut] || { label: statut, className: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const calculateJourGavage = (lot: Lot) => {
    if (!lot.date_debut_gavage) return null;
    const debut = new Date(lot.date_debut_gavage);
    const aujourdhui = new Date();
    const diffTime = Math.abs(aujourdhui.getTime() - debut.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 shadow-sm p-4 ${className}`}>
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded"></div>
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-48 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <p className="text-yellow-800 text-sm">
          Aucun lot trouvé. Créez votre premier lot pour commencer.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Bouton sélecteur */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white rounded-lg border-2 border-blue-200 shadow-md hover:shadow-lg transition-all p-4 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-lg p-2">
              <Package size={24} className="text-blue-600" />
            </div>
            <div>
              {selectedLot ? (
                <>
                  <div className="font-bold text-gray-900 text-lg">
                    Lot {selectedLot.id} - {selectedLot.race}
                  </div>
                  <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                    <span>{selectedLot.nombre_canards} canards</span>
                    <span>•</span>
                    {selectedLot.statut === 'en_gavage' && selectedLot.date_debut_gavage && (
                      <span className="font-semibold text-green-600">
                        J{calculateJourGavage(selectedLot)}/14
                      </span>
                    )}
                    {getStatutBadge(selectedLot.statut)}
                  </div>
                </>
              ) : (
                <div className="font-bold text-gray-900">Sélectionner un lot</div>
              )}
            </div>
          </div>
          <ChevronDown
            size={20}
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg border border-gray-200 shadow-xl z-50 max-h-96 overflow-y-auto">
          {/* Lots en gavage */}
          {lotsEnGavage.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-green-50 border-b border-green-100 text-sm font-semibold text-green-800">
                🎯 Lots en gavage ({lotsEnGavage.length})
              </div>
              {lotsEnGavage.map((lot) => {
                const jourGavage = calculateJourGavage(lot);
                return (
                  <button
                    key={lot.id}
                    onClick={() => {
                      onLotChange(lot.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-green-50 transition-colors border-b border-gray-100 ${
                      selectedLotId === lot.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-900">
                          Lot {lot.id} - {lot.race}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {lot.nombre_canards} canards • Début: {lot.date_debut_gavage ? new Date(lot.date_debut_gavage).toLocaleDateString('fr-FR') : 'N/A'}
                        </div>
                      </div>
                      <div className="text-right">
                        {jourGavage && (
                          <div className="text-sm font-bold text-green-600">J{jourGavage}/14</div>
                        )}
                        {getStatutBadge(lot.statut)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Autres lots */}
          {lotsAutres.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-700">
                📦 Autres lots ({lotsAutres.length})
              </div>
              {lotsAutres.map((lot) => (
                <button
                  key={lot.id}
                  onClick={() => {
                    onLotChange(lot.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                    selectedLotId === lot.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-gray-900">
                        Lot {lot.id} - {lot.race}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {lot.nombre_canards} canards
                      </div>
                    </div>
                    <div>{getStatutBadge(lot.statut)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overlay pour fermer le dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
