'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter, Bird, TrendingUp, AlertTriangle } from 'lucide-react';
import { canardApi } from '@/lib/api';
import { DEFAULT_GAVEUR_ID, GENETIQUES } from '@/lib/constants';
import { formatDate, getStatutColor, getStatutLabel, getGenetiqueEmoji } from '@/lib/utils';
import type { Canard } from '@/lib/types';

export default function CanardsPage() {
  const [canards, setCanards] = useState<Canard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGenetique, setFilterGenetique] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadCanards();
  }, []);

  const loadCanards = async () => {
    try {
      const data = await canardApi.getByGaveur(DEFAULT_GAVEUR_ID) as Canard[];
      setCanards(data);
    } catch (error) {
      console.error('Erreur chargement canards:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCanards = canards.filter((canard) => {
    if (searchTerm && !canard.numero_identification.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterGenetique !== 'all' && canard.genetique !== filterGenetique) {
      return false;
    }
    if (filterStatut !== 'all' && canard.statut !== filterStatut) {
      return false;
    }
    return true;
  });

  const stats = {
    total: canards.length,
    enGavage: canards.filter((c) => c.statut === 'en_gavage').length,
    termines: canards.filter((c) => c.statut === 'termine').length,
    decedes: canards.filter((c) => c.statut === 'decede').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Mes Canards</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={20} />
            Ajouter un canard
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-green-600">En gavage</p>
            <p className="text-3xl font-bold text-green-700">{stats.enGavage}</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-sm text-blue-600">Terminés</p>
            <p className="text-3xl font-bold text-blue-700">{stats.termines}</p>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-sm text-red-600">Décédés</p>
            <p className="text-3xl font-bold text-red-700">{stats.decedes}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par numéro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={filterGenetique}
              onChange={(e) => setFilterGenetique(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes génétiques</option>
              {GENETIQUES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous statuts</option>
              <option value="en_gavage">En gavage</option>
              <option value="termine">Terminé</option>
              <option value="decede">Décédé</option>
            </select>
          </div>

          <span className="text-sm text-gray-500">{filteredCanards.length} canard(s)</span>
        </div>

        {/* Liste canards */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : filteredCanards.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <Bird className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-600 mb-2">Aucun canard trouvé</h3>
            <p className="text-gray-500">Ajoutez votre premier canard pour commencer</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCanards.map((canard) => (
              <Link key={canard.id} href={`/canards/${canard.id}`}>
                <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{getGenetiqueEmoji(canard.genetique)}</span>
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">
                          {canard.numero_identification}
                        </h3>
                        <p className="text-sm text-gray-600">{canard.genetique}</p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${getStatutColor(
                        canard.statut
                      )}`}
                    >
                      {getStatutLabel(canard.statut)}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Poids initial</span>
                      <span className="font-medium">{canard.poids_initial}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Poids actuel</span>
                      <span className="font-medium text-green-600">
                        {canard.poids_actuel || canard.poids_initial}g
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Naissance</span>
                      <span className="font-medium">{formatDate(canard.date_naissance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Origine</span>
                      <span className="font-medium">{canard.origine}</span>
                    </div>
                  </div>

                  {canard.poids_actuel && canard.poids_actuel > canard.poids_initial && (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-600">
                        <TrendingUp size={18} />
                        <span className="font-medium">
                          +{canard.poids_actuel - canard.poids_initial}g
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {(
                          ((canard.poids_actuel - canard.poids_initial) / canard.poids_initial) *
                          100
                        ).toFixed(1)}
                        % de gain
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Modal ajout canard */}
        {showAddModal && (
          <AddCanardModal onClose={() => setShowAddModal(false)} onSuccess={loadCanards} />
        )}
      </div>
    </div>
  );
}

function AddCanardModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    numero_identification: '',
    genetique: 'Mulard' as 'Mulard' | 'Barbarie' | 'Pekin',
    date_naissance: '',
    origine: '',
    numero_lot_canard: '',
    poids_initial: 0,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await canardApi.create({
        ...formData,
        gaveur_id: DEFAULT_GAVEUR_ID,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erreur création canard:', error);
      alert('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-6">Ajouter un canard</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              N° Identification
            </label>
            <input
              type="text"
              value={formData.numero_identification}
              onChange={(e) =>
                setFormData({ ...formData, numero_identification: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="FR-40-2024-0001"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Génétique</label>
            <select
              value={formData.genetique}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  genetique: e.target.value as 'Mulard' | 'Barbarie' | 'Pekin',
                })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Mulard">Mulard</option>
              <option value="Barbarie">Barbarie</option>
              <option value="Pekin">Pekin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de naissance
            </label>
            <input
              type="date"
              value={formData.date_naissance}
              onChange={(e) => setFormData({ ...formData, date_naissance: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origine</label>
            <input
              type="text"
              value={formData.origine}
              onChange={(e) => setFormData({ ...formData, origine: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Couvoir XYZ"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° Lot</label>
            <input
              type="text"
              value={formData.numero_lot_canard}
              onChange={(e) => setFormData({ ...formData, numero_lot_canard: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="LOT-2024-001"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Poids initial (g)
            </label>
            <input
              type="number"
              value={formData.poids_initial}
              onChange={(e) =>
                setFormData({ ...formData, poids_initial: Number(e.target.value) })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="3200"
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Création...' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 bg-gray-300 text-gray-700 p-3 rounded-lg font-bold hover:bg-gray-400"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
