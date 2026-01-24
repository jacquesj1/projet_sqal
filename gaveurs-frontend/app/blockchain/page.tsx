'use client';

import { useState } from 'react';
import { Search, Shield, CheckCircle, AlertCircle, Download, QrCode, Package } from 'lucide-react';
import { blockchainApi } from '@/lib/api';
import { formatDateTime, truncateHash } from '@/lib/utils';

interface VerificationResult {
  valide: boolean;
  blocs_verifies: number;
  erreurs?: string[];
}

interface LotHistory {
  lot_id: number;
  blockchain_enabled: boolean;
  total_products: number;
  total_events: number;
  products: any[];
  events: any[];
  message?: string;
}

interface LotCertificat {
  lot_id: number;
  code_lot: string;
  site_code: string;
  race: string;
  nombre_canards: number;
  periode_gavage: {
    debut: string | null;
    fin: string | null;
    duree_jours: number | null;
  };
  statut: string;
  blockchain: {
    total_products_verified: number;
    avg_quality_score: number;
    grade_distribution: Record<string, number>;
    products: any[];
  };
  message: string;
}

export default function BlockchainPage() {
  const [lotId, setLotId] = useState<string>('');
  const [historique, setHistorique] = useState<LotHistory | null>(null);
  const [certificat, setCertificat] = useState<LotCertificat | null>(null);
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const searchBlockchain = async () => {
    if (!lotId) {
      alert('Veuillez entrer un ID de lot');
      return;
    }

    setLoading(true);
    try {
      const [histoData, certData] = await Promise.all([
        blockchainApi.getLotHistory(parseInt(lotId)),
        blockchainApi.getLotCertificat(parseInt(lotId)),
      ]);

      setHistorique(histoData as LotHistory);
      setCertificat(certData as LotCertificat);
    } catch (error) {
      console.error('Erreur recherche blockchain:', error);
      alert('Lot non trouvé ou pas de données blockchain disponibles');
      setHistorique(null);
      setCertificat(null);
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
    link.download = `certificat-lot-${certificat.code_lot}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateQRCode = () => {
    if (!certificat) return;
    const verificationUrl = `https://gaveurs.fr/verify/lot/${certificat.code_lot}`;
    alert(`QR Code généré pour: ${verificationUrl}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800 flex items-center gap-3">
          <Shield className="text-blue-600" size={40} />
          Blockchain Explorer - Traçabilité par Lot
        </h1>

        {/* Info importante */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <div className="flex items-start">
            <Package className="text-blue-500 mt-1 mr-3" size={24} />
            <div>
              <p className="font-semibold text-blue-800">Système basé sur les lots</p>
              <p className="text-sm text-blue-700 mt-1">
                Ce système de traçabilité fonctionne par lot de canards. Chaque lot peut générer plusieurs produits finaux avec QR code consommateur.
              </p>
            </div>
          </div>
        </div>

        {/* Recherche */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Lot ou Code Lot
              </label>
              <input
                type="text"
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchBlockchain()}
                placeholder="Ex: 121 ou LL2512001"
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

        {/* Message si pas de blockchain */}
        {historique && !historique.blockchain_enabled && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 mb-8">
            <div className="flex items-start">
              <AlertCircle className="text-yellow-500 mt-1 mr-3" size={24} />
              <div>
                <p className="font-semibold text-yellow-800">Aucune traçabilité blockchain</p>
                <p className="text-sm text-yellow-700 mt-1">{historique.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Certificat Lot */}
        {certificat && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow-xl p-8 mb-8 border-2 border-blue-300">
            <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
              <h2 className="text-3xl font-bold text-gray-800">📜 Certificat de Traçabilité - Lot</h2>
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
                <h3 className="font-bold text-lg mb-4 text-blue-800">Informations Lot</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">Code Lot:</span> {certificat.code_lot}
                  </p>
                  <p>
                    <span className="font-semibold">Site:</span> {certificat.site_code}
                  </p>
                  <p>
                    <span className="font-semibold">Race:</span> {certificat.race}
                  </p>
                  <p>
                    <span className="font-semibold">Nombre de canards:</span> {certificat.nombre_canards}
                  </p>
                  <p>
                    <span className="font-semibold">Statut:</span>{' '}
                    <span className={`px-2 py-1 rounded text-sm ${
                      certificat.statut === 'termine' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {certificat.statut}
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold text-lg mb-4 text-green-800">Période de Gavage</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">Début:</span>{' '}
                    {certificat.periode_gavage.debut
                      ? new Date(certificat.periode_gavage.debut).toLocaleDateString('fr-FR')
                      : 'N/A'}
                  </p>
                  <p>
                    <span className="font-semibold">Fin:</span>{' '}
                    {certificat.periode_gavage.fin
                      ? new Date(certificat.periode_gavage.fin).toLocaleDateString('fr-FR')
                      : 'N/A'}
                  </p>
                  <p>
                    <span className="font-semibold">Durée:</span>{' '}
                    {certificat.periode_gavage.duree_jours || 'N/A'} jours
                  </p>
                </div>
              </div>

              {certificat.blockchain.total_products_verified > 0 && (
                <div className="bg-white p-6 rounded-lg shadow col-span-1 md:col-span-2">
                  <h3 className="font-bold text-lg mb-4 text-purple-800">Traçabilité Blockchain</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Produits vérifiés</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {certificat.blockchain.total_products_verified}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Score qualité moyen</p>
                      <p className="text-2xl font-bold text-green-600">
                        {(certificat.blockchain.avg_quality_score * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Distribution qualité</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {Object.entries(certificat.blockchain.grade_distribution).map(([grade, count]) => (
                          <span key={grade} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {grade}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {certificat.blockchain.products.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Échantillon produits ({certificat.blockchain.products.length} affichés):
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {certificat.blockchain.products.map((product) => (
                          <div key={product.product_id} className="bg-gray-50 p-3 rounded text-sm">
                            <p className="font-mono text-xs text-blue-600">{product.product_id}</p>
                            <p className="text-xs text-gray-600">
                              Grade: <span className="font-semibold">{product.grade}</span> |
                              Score: <span className="font-semibold">{(product.quality_score * 100).toFixed(1)}%</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 p-4 bg-green-100 border-2 border-green-500 rounded-lg">
              <p className="font-bold text-green-800 flex items-center gap-2">
                <CheckCircle size={20} />
                {certificat.message}
              </p>
            </div>
          </div>
        )}

        {/* Timeline Blockchain */}
        {historique && historique.blockchain_enabled && historique.events.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              ⛓️ Historique Blockchain - {historique.total_events} événements
            </h2>

            <div className="mb-4 text-sm text-gray-600">
              {historique.total_products} produits blockchain trouvés pour ce lot
            </div>

            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-1 bg-blue-300"></div>

              <div className="space-y-6">
                {historique.events.map((event, idx) => (
                  <div
                    key={idx}
                    className="relative pl-20 cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors"
                    onClick={() =>
                      setSelectedEvent(selectedEvent?.index === event.index ? null : event)
                    }
                  >
                    <div className="absolute left-4 w-10 h-10 bg-white border-4 border-blue-500 rounded-full flex items-center justify-center text-2xl shadow-lg">
                      📦
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex flex-col md:flex-row justify-between items-start mb-2 gap-2">
                        <div>
                          <h3 className="font-bold text-lg text-gray-800">
                            Bloc #{event.index} - {event.type}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {new Date(event.timestamp).toLocaleString('fr-FR')}
                          </p>
                          <p className="text-xs text-blue-600 font-mono mt-1">
                            Produit: {event.product_id}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full font-bold">
                          Hash: {truncateHash(event.hash)}
                        </span>
                      </div>

                      {selectedEvent?.index === event.index && (
                        <div className="mt-4 pt-4 border-t border-gray-300">
                          <div className="mt-4">
                            <p className="text-sm font-semibold text-gray-700 mb-2">Données événement:</p>
                            <pre className="bg-gray-800 text-green-400 p-4 rounded text-xs overflow-x-auto font-mono">
                              {JSON.stringify(event.data, null, 2)}
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

        {/* Produits du lot */}
        {historique && historique.products && historique.products.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 mt-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              📦 Produits Blockchain du Lot ({historique.products.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historique.products.map((product) => (
                <div key={product.product_id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-mono text-sm text-blue-600 font-semibold">{product.product_id}</p>
                    {product.blockchain_verified && (
                      <CheckCircle className="text-green-500" size={20} />
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    QR: <span className="font-mono">{product.qr_code}</span>
                  </p>
                  {product.production_date && (
                    <p className="text-xs text-gray-600">
                      Date: {new Date(product.production_date).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                  {product.sqal_grade && (
                    <p className="text-xs mt-2">
                      <span className={`px-2 py-1 rounded ${
                        product.sqal_grade === 'A+' ? 'bg-green-100 text-green-800' :
                        product.sqal_grade === 'A' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        Grade: {product.sqal_grade}
                      </span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* État vide */}
        {!loading && !historique && !verification && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <Package className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-600 mb-2">Explorez la Blockchain par Lot</h3>
            <p className="text-gray-500">
              Entrez un ID de lot pour voir toute sa traçabilité blockchain (produits, événements, qualité)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
