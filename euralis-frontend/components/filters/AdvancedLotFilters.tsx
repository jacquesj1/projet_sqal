'use client';

import { useState, useEffect } from 'react';
import { Search, X, RotateCcw, Calendar, TrendingUp } from 'lucide-react';

export interface LotFilters {
  searchText: string;
  dateDebut?: string;
  dateFin?: string;
  itmMin?: number;
  itmMax?: number;
  statut: string;
  siteCode?: string;
}

interface AdvancedLotFiltersProps {
  onFiltersChange: (filters: LotFilters) => void;
  showSiteFilter?: boolean;
  persistenceKey?: string;
}

const defaultFilters: LotFilters = {
  searchText: '',
  dateDebut: undefined,
  dateFin: undefined,
  itmMin: undefined,
  itmMax: undefined,
  statut: 'all',
  siteCode: undefined,
};

export default function AdvancedLotFilters({
  onFiltersChange,
  showSiteFilter = false,
  persistenceKey = 'euralis_lot_filters',
}: AdvancedLotFiltersProps) {
  const [filters, setFilters] = useState<LotFilters>(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Charger les filtres depuis localStorage au montage
  useEffect(() => {
    const savedFilters = localStorage.getItem(persistenceKey);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setFilters(parsed);
        onFiltersChange(parsed);
      } catch (e) {
        console.error('Erreur parsing filtres sauvegardés:', e);
      }
    }
  }, [persistenceKey]);

  // Sauvegarder les filtres dans localStorage quand ils changent
  useEffect(() => {
    localStorage.setItem(persistenceKey, JSON.stringify(filters));
    onFiltersChange(filters);
  }, [filters, persistenceKey]);

  const handleFilterChange = (key: keyof LotFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    localStorage.removeItem(persistenceKey);
  };

  const hasActiveFilters = () => {
    return (
      filters.searchText !== '' ||
      filters.dateDebut !== undefined ||
      filters.dateFin !== undefined ||
      filters.itmMin !== undefined ||
      filters.itmMax !== undefined ||
      filters.statut !== 'all' ||
      filters.siteCode !== undefined
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filtres</h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters() && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Réinitialiser
            </button>
          )}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          >
            {showAdvanced ? 'Masquer filtres avancés' : 'Afficher filtres avancés'}
          </button>
        </div>
      </div>

      {/* Recherche textuelle (toujours visible) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Recherche
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={filters.searchText}
            onChange={(e) => handleFilterChange('searchText', e.target.value)}
            placeholder="Code lot, gaveur, race..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {filters.searchText && (
            <button
              onClick={() => handleFilterChange('searchText', '')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Recherche dans le code lot, gaveur, race, souche...
        </p>
      </div>

      {/* Filtres de base */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Statut */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Statut
          </label>
          <select
            value={filters.statut}
            onChange={(e) => handleFilterChange('statut', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="en_cours">En cours</option>
            <option value="termine">Terminé</option>
            <option value="planifie">Planifié</option>
            <option value="annule">Annulé</option>
          </select>
        </div>

        {/* Site (conditionnel) */}
        {showSiteFilter && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Site
            </label>
            <select
              value={filters.siteCode || 'all'}
              onChange={(e) =>
                handleFilterChange('siteCode', e.target.value === 'all' ? undefined : e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les sites</option>
              <option value="LL">LL - Bretagne</option>
              <option value="LS">LS - Pays de Loire</option>
              <option value="MT">MT - Maubourguet</option>
            </select>
          </div>
        )}
      </div>

      {/* Filtres avancés (collapsible) */}
      {showAdvanced && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          {/* Plage de dates */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4" />
              Période de début de gavage
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Date début</label>
                <input
                  type="date"
                  value={filters.dateDebut || ''}
                  onChange={(e) => handleFilterChange('dateDebut', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Date fin</label>
                <input
                  type="date"
                  value={filters.dateFin || ''}
                  onChange={(e) => handleFilterChange('dateFin', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Plage ITM */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <TrendingUp className="h-4 w-4" />
              ITM (Indice Technique Moyen)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">ITM minimum (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={filters.itmMin ?? ''}
                  onChange={(e) =>
                    handleFilterChange('itmMin', e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="Ex: 14.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">ITM maximum (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={filters.itmMax ?? ''}
                  onChange={(e) =>
                    handleFilterChange('itmMax', e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="Ex: 16.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Résumé des filtres actifs */}
      {hasActiveFilters() && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Filtres actifs:</span>{' '}
            {[
              filters.searchText && `Recherche: "${filters.searchText}"`,
              filters.statut !== 'all' && `Statut: ${filters.statut}`,
              filters.siteCode && `Site: ${filters.siteCode}`,
              filters.dateDebut && `Depuis: ${filters.dateDebut}`,
              filters.dateFin && `Jusqu'à: ${filters.dateFin}`,
              filters.itmMin && `ITM min: ${filters.itmMin} kg`,
              filters.itmMax && `ITM max: ${filters.itmMax} kg`,
            ]
              .filter(Boolean)
              .join(' • ')}
          </p>
        </div>
      )}
    </div>
  );
}
