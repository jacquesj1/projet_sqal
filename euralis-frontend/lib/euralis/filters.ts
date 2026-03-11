/**
 * Utilitaires de filtrage pour les lots
 */

import type { Lot } from './types';
import type { LotFilters } from '@/components/filters/AdvancedLotFilters';

/**
 * Applique les filtres sur une liste de lots
 */
export function applyLotFilters(lots: Lot[], filters: LotFilters): Lot[] {
  return lots.filter((lot) => {
    // Filtre recherche textuelle
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      const matches =
        lot.code_lot?.toLowerCase().includes(searchLower) ||
        lot.site_code?.toLowerCase().includes(searchLower) ||
        lot.souche?.toLowerCase().includes(searchLower) ||
        lot.gaveur_id?.toString().includes(searchLower);

      if (!matches) return false;
    }

    // Filtre statut
    if (filters.statut && filters.statut !== 'all') {
      if (lot.statut !== filters.statut) return false;
    }

    // Filtre site
    if (filters.siteCode) {
      if (lot.site_code !== filters.siteCode) return false;
    }

    // Filtre date début
    if (filters.dateDebut && lot.debut_lot) {
      const lotDate = new Date(lot.debut_lot);
      const filterDate = new Date(filters.dateDebut);
      if (lotDate < filterDate) return false;
    }

    // Filtre date fin
    if (filters.dateFin && lot.debut_lot) {
      const lotDate = new Date(lot.debut_lot);
      const filterDate = new Date(filters.dateFin);
      if (lotDate > filterDate) return false;
    }

    // Filtre ITM minimum
    if (filters.itmMin !== undefined && lot.itm !== undefined) {
      if (lot.itm < filters.itmMin) return false;
    }

    // Filtre ITM maximum
    if (filters.itmMax !== undefined && lot.itm !== undefined) {
      if (lot.itm > filters.itmMax) return false;
    }

    return true;
  });
}

/**
 * Trie les lots selon une colonne et direction
 */
export function sortLots(
  lots: Lot[],
  sortKey: keyof Lot,
  sortDirection: 'asc' | 'desc'
): Lot[] {
  return [...lots].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];

    // Gestion des valeurs nulles/undefined
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Comparaison selon le type
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // Dates
    if ((aVal as unknown) instanceof Date && (bVal as unknown) instanceof Date) {
      return sortDirection === 'asc'
        ? (aVal as unknown as Date).getTime() - (bVal as unknown as Date).getTime()
        : (bVal as unknown as Date).getTime() - (aVal as unknown as Date).getTime();
    }

    // String comparison par défaut
    return sortDirection === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });
}
