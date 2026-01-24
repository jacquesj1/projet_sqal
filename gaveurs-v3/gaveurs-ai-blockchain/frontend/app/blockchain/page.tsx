'use client';

import { useState } from 'react';
import { Search, Shield, CheckCircle, AlertCircle, Download, QrCode } from 'lucide-react';
import { blockchainApi } from '@/lib/api';
import { formatDateTime, truncateHash, getEventIcon, getEventLabel } from '@/lib/utils';
import type { BlockchainEvent, BlockchainCertificat } from '@/lib/types';

interface VerificationResult {
  valide: boolean;
  blocs_verifies: number;
  erreurs?: string[];
}

export default function BlockchainPage() {
  const [canardId, setCanardId] = useState<string>('');
  const [historique, setHistorique] = useState<BlockchainEvent[]>([]);
  const [certificat, setCertificat] = useState<BlockchainCertificat | null>(null);
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockchainEvent | null>(null);

  const searchBlockchain = async () => {
    if (!canardId) {
      alert('Veuillez entrer un ID de canard');
      return;
    }

    setLoading(true);
    try {
      const [histoData, certData] = await Promise.all([
        blockchainApi.getHistory(parseInt(canardId)),
        blockchainApi.getCertificat(parseInt(canardId)),
      ]);

      setHistorique(histoData as BlockchainEvent[]);
      setCertificat(certData as BlockchainCertificat);
    } catch (error) {
      console.error('Erreur recherche blockchain:', error);
      alert('Canard non trouvé dans la blockchain');
    } finally {
      setLoading(false);
    }
  };

  const verifyIntegrity = async () => {
    setLoading(true);
    try {
      const data = await blockchainApi.verify() as VerificationResult;
      setVerification(data);
    } catch (error) {
      console.error('Erreur vérification:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadCertificate = () => {
    if (!certificat) return;

    const dataStr = JSON.stringify(certificat, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `certificat-canard-${certificat.numero_identification}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateQRCode = () => {
    if (!certificat) return;
    const verificationUrl = `https://gaveurs.fr/verify/${certificat.numero_identification}`;
    alert(`QR Code généré pour: ${verificationUrl}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800 flex items-center gap-3">
          <Shield className="text-blue-600" size={40} />
          Blockchain Explorer
        </h1>

        {/* Recherche */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Canard ou N° Identification
              </label>
              <input
                type="text"
                value={canardId}
                onChange={(e) => setCanardId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchBlockchain()}
                placeholder="Ex: 1 ou FR-40-2024-0001"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 items-end">
              <button
                onClick={searchBlockchain}
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <Search size={20} />
                Rechercher
              </button>
              <button
                onClick={verifyIntegrity}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <Shield size={20} />
                Vérifier Intégrité
              </button>
            </div>
          </div>
        </div>

        {/* Vérification d'intégrité */}
        {verification && (
          <div
            className={`p-6 rounded-lg mb-8 ${
              verification.valide
                ? 'bg-green-100 border-2 border-green-500'
                : 'bg-red-100 border-2 border-red-500'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              {verification.valide ? (
                <CheckCircle className="text-green-600" size={32} />
              ) : (
                <AlertCircle className="text-red-600" size={32} />
              )}
              <h2 className="text-2xl font-bold">
                {verification.valide ? '✅ Blockchain Intègre' : '⚠️ Blockchain Compromise'}
              </h2>
            </div>
            <p className="text-lg">
              Blocs vérifiés: <span className="font-bold">{verification.blocs_verifies}</span>
            </p>
            {verification.erreurs && verification.erreurs.length > 0 && (
              <div className="mt-4">
                <p className="font-bold text-red-700">Erreurs détectées:</p>
                <ul className="list-disc ml-6">
                  {verification.erreurs.map((err, idx) => (
                    <li key={idx} className="text-red-600">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Certificat Consommateur */}
        {certificat && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow-xl p-8 mb-8 border-2 border-blue-300">
            <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
              <h2 className="text-3xl font-bold text-gray-800">📜 Certificat de Traçabilité</h2>
              <div className="flex gap-2">
                <button
                  onClick={downloadCertificate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Download size={18} />
                  Télécharger
                </button>
                <button
                  onClick={generateQRCode}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <QrCode size={18} />
                  QR Code
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold text-lg mb-4 text-blue-800">Informations Générales</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">N° Identification:</span>{' '}
                    {certificat.numero_identification}
                  </p>
                  <p>
                    <span className="font-semibold">Génétique:</span> {certificat.genetique}
                  </p>
                  <p>
                    <span className="font-semibold">Origine:</span> {certificat.origine}
                  </p>
                  <p>
                    <span className="font-semibold">Date Naissance:</span>{' '}
                    {formatDateTime(certificat.date_naissance)}
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold text-lg mb-4 text-green-800">Gavage</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">Poids Initial:</span> {certificat.poids_initial}g
                  </p>
                  <p>
                    <span className="font-semibold">Durée:</span> {certificat.duree_gavage_jours} jours
                  </p>
                  <p>
                    <span className="font-semibold">Nombre de gavages:</span> {certificat.nombre_gavages}
                  </p>
                  <p>
                    <span className="font-semibold">Maïs total:</span>{' '}
                    {certificat.dose_totale_mais_kg.toFixed(2)} kg
                  </p>
                </div>
              </div>

              {certificat.abattoir && (
                <div className="bg-white p-6 rounded-lg shadow col-span-1 md:col-span-2">
                  <h3 className="font-bold text-lg mb-4 text-red-800">Abattage</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p>
                      <span className="font-semibold">Date:</span>{' '}
                      {formatDateTime(certificat.date_abattage)}
                    </p>
                    <p>
                      <span className="font-semibold">Abattoir:</span> {certificat.abattoir.nom}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 p-4 bg-green-100 border-2 border-green-500 rounded-lg">
              <p className="font-bold text-green-800 flex items-center gap-2">
                <CheckCircle size={20} />
                {certificat.verification_blockchain}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                {certificat.blockchain_hashes.length} événements enregistrés dans la blockchain
              </p>
            </div>
          </div>
        )}

        {/* Timeline Blockchain */}
        {historique.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">⛓️ Historique Blockchain Complet</h2>

            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-1 bg-blue-300"></div>

              <div className="space-y-6">
                {historique.map((event, idx) => (
                  <div
                    key={idx}
                    className="relative pl-20 cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors"
                    onClick={() =>
                      setSelectedBlock(selectedBlock?.index === event.index ? null : event)
                    }
                  >
                    <div className="absolute left-4 w-10 h-10 bg-white border-4 border-blue-500 rounded-full flex items-center justify-center text-2xl shadow-lg">
                      {getEventIcon(event.type_evenement)}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex flex-col md:flex-row justify-between items-start mb-2 gap-2">
                        <div>
                          <h3 className="font-bold text-lg text-gray-800">
                            Bloc #{event.index} - {getEventLabel(event.type_evenement)}
                          </h3>
                          <p className="text-sm text-gray-600">{formatDateTime(event.timestamp)}</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full font-bold">
                          Hash: {truncateHash(event.hash)}
                        </span>
                      </div>

                      {selectedBlock?.index === event.index && (
                        <div className="mt-4 pt-4 border-t border-gray-300">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-700">Gaveur ID</p>
                              <p className="text-sm text-gray-600">{event.gaveur_id}</p>
                            </div>
                            {event.abattoir_id && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700">Abattoir ID</p>
                                <p className="text-sm text-gray-600">{event.abattoir_id}</p>
                              </div>
                            )}
                          </div>

                          <div className="mt-4">
                            <p className="text-sm font-semibold text-gray-700 mb-2">Données:</p>
                            <pre className="bg-gray-800 text-green-400 p-4 rounded text-xs overflow-x-auto font-mono">
                              {JSON.stringify(event.donnees, null, 2)}
                            </pre>
                          </div>

                          <div className="mt-4">
                            <p className="text-sm font-semibold text-gray-700">Hash complet:</p>
                            <p className="text-xs font-mono bg-gray-100 p-2 rounded break-all">
                              {event.hash}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* État vide */}
        {!loading && historique.length === 0 && !verification && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <Shield className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-600 mb-2">Explorez la Blockchain</h3>
            <p className="text-gray-500">
              Entrez un ID de canard pour voir tout son historique de traçabilité
            </p>
          </div>
        )}

        {/* Légende */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-4 text-blue-900">📖 Légende des Événements</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌟</span>
              <span className="text-sm">Bloc Genesis</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐣</span>
              <span className="text-sm">Initialisation canard</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌽</span>
              <span className="text-sm">Gavage</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚖️</span>
              <span className="text-sm">Pesée</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚚</span>
              <span className="text-sm">Transport</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏭</span>
              <span className="text-sm">Abattage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
