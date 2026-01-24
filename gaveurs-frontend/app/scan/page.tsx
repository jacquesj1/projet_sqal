'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Search, History, CheckCircle } from 'lucide-react';
import QRScanner from '@/components/QRScanner';
import { qrApi } from '@/lib/api';

interface ScanResult {
  canard_id: number;
  numero_identification: string;
  genetique: string;
  statut: string;
}

export default function ScanPage() {
  const router = useRouter();
  const [scannedData, setScannedData] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');

  const handleScan = async (data: string) => {
    setScannedData(data);
    setError('');
    setLoading(true);

    try {
      const result = await qrApi.scan(data) as ScanResult;
      setScanResult(result);

      // Ajouter aux scans récents
      setRecentScans((prev) => {
        const newScans = [data, ...prev.filter((s) => s !== data)].slice(0, 5);
        return newScans;
      });
    } catch (err) {
      console.error('Erreur scan:', err);
      setError('Canard non trouvé pour ce QR code');
      setScanResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async () => {
    if (!manualInput.trim()) return;
    await handleScan(manualInput.trim());
  };

  const goToCanard = () => {
    if (scanResult) {
      router.push(`/canards/${scanResult.canard_id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800 flex items-center gap-3">
          <QrCode size={40} className="text-blue-600" />
          Scanner QR Code
        </h1>

        {/* Scanner */}
        <QRScanner
          onScan={handleScan}
          onError={(err) => setError(`Erreur caméra: ${err.message}`)}
        />

        {/* Recherche manuelle */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Search size={20} />
            Recherche manuelle
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
              placeholder="Ex: FR-40-2024-0001"
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleManualSearch}
              disabled={loading}
              className="px-6 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
            >
              Rechercher
            </button>
          </div>
        </div>

        {/* Résultat du scan */}
        {loading && (
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Recherche en cours...</p>
          </div>
        )}

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium">{error}</p>
            <p className="text-sm text-red-600 mt-2">Code scanné: {scannedData}</p>
          </div>
        )}

        {scanResult && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="text-green-600" size={24} />
              <h3 className="font-bold text-lg text-green-800">Canard trouvé !</h3>
            </div>

            <div className="space-y-2 mb-4">
              <p>
                <span className="text-gray-600">N° Identification:</span>{' '}
                <span className="font-bold">{scanResult.numero_identification}</span>
              </p>
              <p>
                <span className="text-gray-600">Génétique:</span>{' '}
                <span className="font-bold">{scanResult.genetique}</span>
              </p>
              <p>
                <span className="text-gray-600">Statut:</span>{' '}
                <span className="font-bold">{scanResult.statut}</span>
              </p>
            </div>

            <button
              onClick={goToCanard}
              className="w-full bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700"
            >
              Voir la fiche du canard
            </button>
          </div>
        )}

        {/* Scans récents */}
        {recentScans.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <History size={20} />
              Scans récents
            </h3>
            <div className="space-y-2">
              {recentScans.map((scan, idx) => (
                <button
                  key={idx}
                  onClick={() => handleScan(scan)}
                  className="w-full p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="font-mono text-sm">{scan}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-2 text-blue-900">Comment utiliser le scanner</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Cliquez sur &quot;Démarrer le scan&quot;</li>
            <li>Autorisez l&apos;accès à la caméra</li>
            <li>Positionnez le QR code dans le cadre</li>
            <li>Le scan s&apos;effectue automatiquement</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
