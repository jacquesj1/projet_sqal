'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { euralisAPI } from '@/lib/euralis/api';
import { Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import AdvancedLotFilters, { type LotFilters } from '@/components/filters/AdvancedLotFilters';
import { applyLotFilters, sortLots } from '@/lib/euralis/filters';

interface Lot {
  id: number;
  code_lot: string;
  site_code: string;
  gaveur_id: number;
  souche: string | null;
  debut_lot: string;
  itm: number | null;
  sigma: number | null;
  duree_gavage_reelle: number | null;
  pctg_perte_gavage: number | null;
  statut: string;
}

export default function SiteLotsPage() {
  const params = useParams();
  const router = useRouter();
  const siteCode = params.code as string;

  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LotFilters>({
    searchText: '',
    statut: 'all',
  });
  const [sortKey, setSortKey] = useState<keyof Lot>('debut_lot');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const siteNames: Record<string, string> = {
    'LL': 'Bretagne',
    'LS': 'Pays de Loire',
    'MT': 'Maubourguet'
  };

  useEffect(() => {
    const fetchLots = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await euralisAPI.getSiteLots(siteCode);
        setLots(data);
      } catch (err) {
        console.error('Erreur chargement lots:', err);
        setError('Impossible de charger les lots du site');
      } finally {
        setLoading(false);
      }
    };

    fetchLots();
  }, [siteCode]);

  const getStatutBadge = (statut: string) => {
    const badges = {
      'en_cours': 'bg-green-100 text-green-800',
      'termine': 'bg-gray-100 text-gray-800',
      'en_gavage': 'bg-blue-100 text-blue-800',
      'planifie': 'bg-yellow-100 text-yellow-800'
    };
    return badges[statut as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getStatutLabel = (statut: string) => {
    const labels = {
      'en_cours': 'En cours',
      'termine': 'Terminé',
      'en_gavage': 'En gavage',
      'planifie': 'Planifié'
    };
    return labels[statut as keyof typeof labels] || statut;
  };

  // Filtrer et trier les lots
  const filteredAndSortedLots = useMemo(() => {
    const filtered = applyLotFilters(lots, filters);
    return sortLots(filtered, sortKey, sortDirection);
  }, [lots, filters, sortKey, sortDirection]);

  const handleSort = (key: keyof Lot) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (key: keyof Lot) => {
    if (sortKey !== key) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-blue-600" />
    ) : (
      <ArrowDown className="h-4 w-4 text-blue-600" />
    );
  };

  const exportToExcel = () => {
    try {
      // Dynamically import xlsx to avoid SSR issues
      import('xlsx').then((XLSX) => {
        // Préparer les données pour Excel (utiliser les lots filtrés)
        const excelData = filteredAndSortedLots.map(lot => ({
          'Code Lot': lot.code_lot,
          'Site': lot.site_code,
          'Gaveur ID': lot.gaveur_id,
          'Souche': lot.souche || 'N/A',
          'Début Gavage': lot.debut_lot ? new Date(lot.debut_lot).toLocaleDateString('fr-FR') : 'N/A',
          'Durée (jours)': lot.duree_gavage_reelle || 'N/A',
          'ITM (kg)': lot.itm ? lot.itm.toFixed(2) : 'N/A',
          'Sigma': lot.sigma ? lot.sigma.toFixed(2) : 'N/A',
          'Perte (%)': lot.pctg_perte_gavage ? lot.pctg_perte_gavage.toFixed(1) : 'N/A',
          'Statut': getStatutLabel(lot.statut),
        }));

        // Créer le classeur et la feuille
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Lots');

        // Ajuster la largeur des colonnes
        const colWidths = [
          { wch: 15 }, // Code Lot
          { wch: 8 },  // Site
          { wch: 12 }, // Gaveur ID
          { wch: 15 }, // Souche
          { wch: 15 }, // Début Gavage
          { wch: 12 }, // Durée
          { wch: 10 }, // ITM
          { wch: 10 }, // Sigma
          { wch: 10 }, // Perte
          { wch: 12 }, // Statut
        ];
        ws['!cols'] = colWidths;

        // Générer le nom de fichier avec date
        const date = new Date().toISOString().split('T')[0];
        const filename = `Lots_${siteCode}_${date}.xlsx`;

        // Télécharger le fichier
        XLSX.writeFile(wb, filename);
      });
    } catch (error) {
      console.error('Erreur export Excel:', error);
      alert('Erreur lors de l\'export Excel');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Chargement des lots...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">{error}</div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb interactif avec bouton retour */}
      <div className="flex items-center justify-between">
        <div>
          {/* Breadcrumb cliquable */}
          <nav className="flex items-center gap-2 text-sm mb-3">
            <button
              onClick={() => router.push('/euralis/sites')}
              className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Sites
            </button>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <button
              onClick={() => router.push('/euralis/sites')}
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              {siteCode} - {siteNames[siteCode]}
            </button>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900 font-medium">Lots</span>
          </nav>

          {/* Titre */}
          <h1 className="text-3xl font-bold text-gray-900">
            Lots du site {siteCode} - {siteNames[siteCode]}
          </h1>
          <p className="text-gray-600 mt-1">
            {filteredAndSortedLots.length} lot{filteredAndSortedLots.length > 1 ? 's' : ''} affiché{filteredAndSortedLots.length > 1 ? 's' : ''}
            {filteredAndSortedLots.length !== lots.length && ` sur ${lots.length} au total`}
          </p>
        </div>

        {/* Boutons actions */}
        <div className="flex items-center gap-3">
          {/* Bouton Export Excel */}
          <button
            onClick={exportToExcel}
            disabled={lots.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
          >
            <Download className="w-5 h-5" />
            <span className="font-medium">Exporter Excel</span>
          </button>

          {/* Bouton Retour stylé */}
          <button
            onClick={() => router.push('/euralis/sites')}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium text-gray-700 group-hover:text-blue-600">Retour aux sites</span>
          </button>
        </div>
      </div>

      {/* Filtres avancés */}
      <AdvancedLotFilters
        onFiltersChange={setFilters}
        showSiteFilter={false}
        persistenceKey={`lot_filters_${siteCode}`}
      />

      {/* Tableau des lots */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('code_lot')}
                >
                  <div className="flex items-center gap-2">
                    Code Lot
                    {getSortIcon('code_lot')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('gaveur_id')}
                >
                  <div className="flex items-center gap-2">
                    Gaveur ID
                    {getSortIcon('gaveur_id')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('souche')}
                >
                  <div className="flex items-center gap-2">
                    Souche
                    {getSortIcon('souche')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('debut_lot')}
                >
                  <div className="flex items-center gap-2">
                    Début Gavage
                    {getSortIcon('debut_lot')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('duree_gavage_reelle')}
                >
                  <div className="flex items-center gap-2">
                    Durée (jours)
                    {getSortIcon('duree_gavage_reelle')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('itm')}
                >
                  <div className="flex items-center gap-2">
                    ITM
                    {getSortIcon('itm')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('statut')}
                >
                  <div className="flex items-center gap-2">
                    Statut
                    {getSortIcon('statut')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedLots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {lots.length === 0 ? 'Aucun lot trouvé pour ce site' : 'Aucun lot ne correspond aux filtres'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedLots.map((lot) => (
                  <tr key={lot.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{lot.code_lot}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">Gaveur #{lot.gaveur_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{lot.souche || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {lot.debut_lot ? new Date(lot.debut_lot).toLocaleDateString('fr-FR') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {lot.duree_gavage_reelle ? `${lot.duree_gavage_reelle}j` : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {lot.itm ? `${lot.itm.toFixed(2)} kg` : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatutBadge(lot.statut)}`}>
                        {getStatutLabel(lot.statut)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => router.push(`/euralis/lots/${lot.id}`)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Voir détails →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats rapides basées sur les lots filtrés */}
      {filteredAndSortedLots.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-4">
            Statistiques des lots affichés ({filteredAndSortedLots.length} / {lots.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">ITM Moyen</div>
              <div className="text-2xl font-bold text-gray-900">
                {(filteredAndSortedLots.filter(l => l.itm).reduce((acc, l) => acc + (l.itm || 0), 0) /
                  filteredAndSortedLots.filter(l => l.itm).length || 0).toFixed(2)} kg
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Durée Moyenne</div>
              <div className="text-2xl font-bold text-gray-900">
                {(filteredAndSortedLots.filter(l => l.duree_gavage_reelle).reduce((acc, l) => acc + (l.duree_gavage_reelle || 0), 0) /
                  filteredAndSortedLots.filter(l => l.duree_gavage_reelle).length || 0).toFixed(1)}j
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Perte Moyenne</div>
              <div className="text-2xl font-bold text-red-600">
                {(filteredAndSortedLots.filter(l => l.pctg_perte_gavage).reduce((acc, l) => acc + (l.pctg_perte_gavage || 0), 0) /
                  filteredAndSortedLots.filter(l => l.pctg_perte_gavage).length || 0).toFixed(1)}%
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Gaveurs Actifs</div>
              <div className="text-2xl font-bold text-gray-900">
                {new Set(filteredAndSortedLots.map(l => l.gaveur_id)).size}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
