'use client';

import { useState, useEffect } from 'react';
import { Stethoscope, Phone, Mail, Calendar, Plus, User, Clock } from 'lucide-react';
import { veterinaireApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Veterinaire } from '@/lib/types';

interface Intervention {
  id: number;
  date: string;
  type: string;
  canard_id: number;
  description: string;
  veterinaire_id: number;
}

export default function VeterinairesPage() {
  const [veterinaires, setVeterinaires] = useState<Veterinaire[]>([]);
  const [selectedVet, setSelectedVet] = useState<Veterinaire | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadVeterinaires();
  }, []);

  useEffect(() => {
    if (selectedVet) {
      loadInterventions(selectedVet.id);
    }
  }, [selectedVet]);

  const loadVeterinaires = async () => {
    try {
      const data = await veterinaireApi.getAll() as Veterinaire[];
      setVeterinaires(data);
      if (data.length > 0) {
        setSelectedVet(data[0]);
      }
    } catch (error) {
      console.error('Erreur chargement vétérinaires:', error);
      // Données de démo
      const mockVets: Veterinaire[] = [
        {
          id: 1,
          nom: 'Dupont',
          prenom: 'Jean',
          numero_ordre: 'VET-40-12345',
          telephone: '+33 5 58 12 34 56',
          email: 'jean.dupont@vet.fr',
          specialite: 'Palmipèdes',
        },
        {
          id: 2,
          nom: 'Martin',
          prenom: 'Marie',
          numero_ordre: 'VET-40-67890',
          telephone: '+33 5 58 98 76 54',
          email: 'marie.martin@vet.fr',
          specialite: 'Aviculture générale',
        },
      ];
      setVeterinaires(mockVets);
      setSelectedVet(mockVets[0]);
    } finally {
      setLoading(false);
    }
  };

  const loadInterventions = async (vetId: number) => {
    try {
      const data = await veterinaireApi.getInterventions(vetId) as Intervention[];
      setInterventions(data);
    } catch (error) {
      // Données de démo
      setInterventions([
        {
          id: 1,
          date: new Date().toISOString(),
          type: 'Visite sanitaire',
          canard_id: 1,
          description: 'Contrôle de routine - RAS',
          veterinaire_id: vetId,
        },
        {
          id: 2,
          date: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
          type: 'Vaccination',
          canard_id: 5,
          description: 'Vaccination grippe aviaire',
          veterinaire_id: vetId,
        },
        {
          id: 3,
          date: new Date(Date.now() - 14 * 24 * 3600000).toISOString(),
          type: 'Consultation',
          canard_id: 3,
          description: 'Problème respiratoire - Traitement prescrit',
          veterinaire_id: vetId,
        },
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
            <Stethoscope className="text-green-600" size={40} />
            Vétérinaires
          </h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center gap-2"
          >
            <Plus size={20} />
            Ajouter un vétérinaire
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste des vétérinaires */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-700">Mes Vétérinaires</h2>
            {veterinaires.map((vet) => (
              <div
                key={vet.id}
                onClick={() => setSelectedVet(vet)}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                  selectedVet?.id === vet.id
                    ? 'ring-2 ring-green-500 bg-green-50'
                    : 'hover:shadow-lg'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="text-green-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold">
                      Dr. {vet.prenom} {vet.nom}
                    </h3>
                    <p className="text-sm text-gray-600">{vet.specialite}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Détails vétérinaire */}
          {selectedVet && (
            <div className="lg:col-span-2 space-y-6">
              {/* Carte de contact */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="text-green-600" size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        Dr. {selectedVet.prenom} {selectedVet.nom}
                      </h2>
                      <p className="text-gray-600">{selectedVet.specialite}</p>
                      <p className="text-sm text-gray-500">N° Ordre: {selectedVet.numero_ordre}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <a
                    href={`tel:${selectedVet.telephone}`}
                    className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Phone className="text-blue-600" size={24} />
                    <div>
                      <p className="text-sm text-gray-600">Téléphone</p>
                      <p className="font-medium">{selectedVet.telephone}</p>
                    </div>
                  </a>

                  <a
                    href={`mailto:${selectedVet.email}`}
                    className="flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <Mail className="text-green-600" size={24} />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{selectedVet.email}</p>
                    </div>
                  </a>
                </div>
              </div>

              {/* Historique des interventions */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Calendar size={24} />
                    Historique des Interventions
                  </h3>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 text-sm">
                    + Nouvelle intervention
                  </button>
                </div>

                {interventions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucune intervention enregistrée</p>
                ) : (
                  <div className="space-y-4">
                    {interventions.map((intervention) => (
                      <div
                        key={intervention.id}
                        className="border-l-4 border-green-500 bg-gray-50 p-4 rounded-r-lg"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold">{intervention.type}</h4>
                            <p className="text-sm text-gray-600">
                              Canard #{intervention.canard_id}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Clock size={14} />
                            {formatDate(intervention.date)}
                          </div>
                        </div>
                        <p className="text-gray-700">{intervention.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Statistiques */}
              <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
                <h3 className="font-bold text-lg mb-4">Statistiques</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{interventions.length}</p>
                    <p className="text-sm text-gray-600">Interventions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {new Set(interventions.map((i) => i.canard_id)).size}
                    </p>
                    <p className="text-sm text-gray-600">Canards suivis</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-purple-600">
                      {interventions.filter((i) => i.type === 'Vaccination').length}
                    </p>
                    <p className="text-sm text-gray-600">Vaccinations</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal ajout vétérinaire */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-6">Ajouter un vétérinaire</h2>
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Jean"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Dupont"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">N° Ordre</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="VET-40-12345"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="+33 5 58 XX XX XX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="email@vet.fr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Palmipèdes"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700"
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-6 bg-gray-300 text-gray-700 p-3 rounded-lg font-bold hover:bg-gray-400"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
