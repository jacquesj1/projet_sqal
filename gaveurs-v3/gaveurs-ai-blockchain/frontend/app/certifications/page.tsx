'use client';

import { useState, useEffect } from 'react';
import { Award, Calendar, Download, Plus, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { certificationApi } from '@/lib/api';
import { DEFAULT_GAVEUR_ID, TYPES_CERTIFICATION } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { Certification } from '@/lib/types';

export default function CertificationsPage() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadCertifications();
  }, []);

  const loadCertifications = async () => {
    try {
      const data = await certificationApi.getByGaveur(DEFAULT_GAVEUR_ID) as Certification[];
      setCertifications(data);
    } catch (error) {
      console.error('Erreur chargement certifications:', error);
      // Données de démo
      setCertifications([
        {
          id: 1,
          type: 'Label Rouge',
          numero_certification: 'LR-2024-001234',
          organisme_certificateur: 'INAO',
          date_obtention: '2024-01-15',
          date_expiration: '2025-01-15',
        },
        {
          id: 2,
          type: 'IGP',
          numero_certification: 'IGP-SWF-2024-5678',
          organisme_certificateur: 'INAO',
          date_obtention: '2024-02-01',
          date_expiration: '2025-02-01',
        },
        {
          id: 3,
          type: 'Bio',
          numero_certification: 'FR-BIO-01-2024-9012',
          organisme_certificateur: 'Ecocert',
          date_obtention: '2023-06-01',
          date_expiration: '2024-06-01',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getCertificationStatus = (cert: Certification) => {
    const now = new Date();
    const expiration = new Date(cert.date_expiration);
    const daysUntilExpiration = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiration < 0) return { status: 'expired', label: 'Expirée', color: 'red' };
    if (daysUntilExpiration < 30) return { status: 'warning', label: 'Expire bientôt', color: 'orange' };
    return { status: 'valid', label: 'Valide', color: 'green' };
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Label Rouge':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'IGP':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Bio':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'AOP':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const filteredCertifications = certifications.filter((cert) => {
    if (filter === 'all') return true;
    if (filter === 'valid') return getCertificationStatus(cert).status === 'valid';
    if (filter === 'warning') return getCertificationStatus(cert).status === 'warning';
    if (filter === 'expired') return getCertificationStatus(cert).status === 'expired';
    return cert.type === filter;
  });

  const stats = {
    total: certifications.length,
    valid: certifications.filter((c) => getCertificationStatus(c).status === 'valid').length,
    warning: certifications.filter((c) => getCertificationStatus(c).status === 'warning').length,
    expired: certifications.filter((c) => getCertificationStatus(c).status === 'expired').length,
  };

  const downloadCertificate = (cert: Certification) => {
    const data = JSON.stringify(cert, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `certification-${cert.numero_certification}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
            <Award className="text-yellow-600" size={40} />
            Certifications
          </h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-bold hover:bg-yellow-700 flex items-center gap-2"
          >
            <Plus size={20} />
            Ajouter une certification
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-green-600">Valides</p>
            <p className="text-3xl font-bold text-green-700">{stats.valid}</p>
          </div>
          <div className="bg-orange-50 rounded-lg shadow p-4 border-l-4 border-orange-500">
            <p className="text-sm text-orange-600">À renouveler</p>
            <p className="text-3xl font-bold text-orange-700">{stats.warning}</p>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-sm text-red-600">Expirées</p>
            <p className="text-3xl font-bold text-red-700">{stats.expired}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Toutes
          </button>
          <button
            onClick={() => setFilter('valid')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'valid' ? 'bg-green-600 text-white' : 'bg-green-100 hover:bg-green-200 text-green-800'
            }`}
          >
            Valides
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'warning' ? 'bg-orange-600 text-white' : 'bg-orange-100 hover:bg-orange-200 text-orange-800'
            }`}
          >
            À renouveler
          </button>
          <button
            onClick={() => setFilter('expired')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'expired' ? 'bg-red-600 text-white' : 'bg-red-100 hover:bg-red-200 text-red-800'
            }`}
          >
            Expirées
          </button>
          <div className="border-l mx-2"></div>
          {TYPES_CERTIFICATION.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === type ? 'bg-yellow-600 text-white' : getTypeColor(type)
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Liste des certifications */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-yellow-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : filteredCertifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <Award className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-600 mb-2">Aucune certification</h3>
            <p className="text-gray-500">Ajoutez votre première certification</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCertifications.map((cert) => {
              const status = getCertificationStatus(cert);
              return (
                <div key={cert.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  {/* Header avec type */}
                  <div className={`p-4 ${getTypeColor(cert.type)} border-b`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">{cert.type}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          status.color === 'green'
                            ? 'bg-green-500 text-white'
                            : status.color === 'orange'
                            ? 'bg-orange-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Contenu */}
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">N° Certification</p>
                      <p className="font-mono font-medium">{cert.numero_certification}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Organisme</p>
                      <p className="font-medium">{cert.organisme_certificateur}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Obtention</p>
                        <p className="font-medium">{formatDate(cert.date_obtention)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Expiration</p>
                        <p
                          className={`font-medium ${
                            status.color === 'red'
                              ? 'text-red-600'
                              : status.color === 'orange'
                              ? 'text-orange-600'
                              : ''
                          }`}
                        >
                          {formatDate(cert.date_expiration)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-gray-50 border-t flex gap-2">
                    <button
                      onClick={() => downloadCertificate(cert)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Download size={16} />
                      Télécharger
                    </button>
                    <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300">
                      <FileText size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal ajout certification */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-6">Ajouter une certification</h2>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500">
                    {TYPES_CERTIFICATION.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    N° Certification
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="LR-2024-XXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organisme certificateur
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="INAO"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date d&apos;obtention
                    </label>
                    <input
                      type="date"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date d&apos;expiration
                    </label>
                    <input
                      type="date"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-yellow-600 text-white p-3 rounded-lg font-bold hover:bg-yellow-700"
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
