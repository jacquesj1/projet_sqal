'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, X, FileText, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { ocrApi, ParsedDocument } from '@/lib/api';

interface OCRCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentScanned: (document: ParsedDocument) => void;
  documentTypes?: ('bon_livraison' | 'fiche_mortalite' | 'fiche_lot')[];
}

export default function OCRCameraModal({
  isOpen,
  onClose,
  onDocumentScanned,
  documentTypes = ['bon_livraison', 'fiche_mortalite', 'fiche_lot'],
}: OCRCameraModalProps) {
  const [selectedType, setSelectedType] = useState<'bon_livraison' | 'fiche_mortalite' | 'fiche_lot'>(
    documentTypes[0]
  );
  const [mode, setMode] = useState<'select' | 'camera' | 'upload' | 'processing' | 'result'>('select');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ParsedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const documentTypeLabels: Record<string, { label: string; icon: string; description: string }> = {
    bon_livraison: {
      label: 'Bon de Livraison',
      icon: '📦',
      description: 'Date, quantité maïs, prix',
    },
    fiche_mortalite: {
      label: 'Fiche Mortalité',
      icon: '⚠️',
      description: 'Date, lot, nombre morts',
    },
    fiche_lot: {
      label: 'Fiche de Lot',
      icon: '📋',
      description: 'Code lot, nb canards, souche',
    },
  };

  const startCamera = useCallback(async () => {
    setMode('camera');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Erreur accès caméra:', err);
      setError("Impossible d'accéder à la caméra. Vérifiez les autorisations.");
      setMode('select');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);
        stopCamera();
        processImage(imageData);
      }
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setError('Veuillez sélectionner un fichier image (JPEG, PNG)');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setCapturedImage(imageData);
        setMode('processing');
        processImage(imageData);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const processImage = async (imageData: string) => {
    setMode('processing');
    setIsLoading(true);
    setError(null);

    try {
      const result = await ocrApi.scanDocument(imageData, selectedType, 'fra');

      setScanResult(result);
      setMode('result');

      if (!result.success) {
        setError("Le document n'a pas pu être analysé correctement.");
      }
    } catch (err) {
      console.error('Erreur OCR:', err);
      setError("Erreur lors de l'analyse du document. Réessayez.");
      setMode('select');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (scanResult) {
      onDocumentScanned(scanResult);
      handleClose();
    }
  };

  const handleRetry = () => {
    setCapturedImage(null);
    setScanResult(null);
    setError(null);
    setMode('select');
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setScanResult(null);
    setError(null);
    setMode('select');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <div className="flex items-center gap-2">
            <FileText size={24} />
            <h2 className="text-lg font-bold">Scanner Document</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {/* Mode Sélection */}
          {mode === 'select' && (
            <div className="space-y-6">
              {/* Type de document */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Type de document
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {documentTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedType === type
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{documentTypeLabels[type].icon}</span>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {documentTypeLabels[type].label}
                          </p>
                          <p className="text-sm text-gray-500">
                            {documentTypeLabels[type].description}
                          </p>
                        </div>
                        {selectedType === type && (
                          <CheckCircle className="ml-auto text-purple-600" size={24} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  className="flex flex-col items-center gap-2 p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg"
                >
                  <Camera size={32} />
                  <span className="font-medium">Prendre Photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
                >
                  <Upload size={32} />
                  <span className="font-medium">Importer Image</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle size={20} />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Mode Caméra */}
          {mode === 'camera' && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Guide de cadrage */}
                <div className="absolute inset-4 border-2 border-white/50 border-dashed rounded-lg pointer-events-none">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="bg-black/50 text-white px-3 py-1 rounded text-sm">
                      Cadrez le document
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    stopCamera();
                    setMode('select');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={capturePhoto}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all"
                >
                  📸 Capturer
                </button>
              </div>

              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Mode Processing */}
          {mode === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <Loader2 size={48} className="animate-spin text-purple-600" />
              </div>
              <p className="text-lg font-medium text-gray-700">Analyse en cours...</p>
              <p className="text-sm text-gray-500">Extraction du texte avec OCR</p>

              {capturedImage && (
                <div className="w-48 h-36 rounded-lg overflow-hidden shadow-lg mt-4">
                  <img
                    src={capturedImage}
                    alt="Document capturé"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {/* Mode Résultat */}
          {mode === 'result' && scanResult && (
            <div className="space-y-4">
              {/* Preview image */}
              {capturedImage && (
                <div className="w-full h-40 rounded-lg overflow-hidden shadow-lg">
                  <img
                    src={capturedImage}
                    alt="Document scanné"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Confiance OCR */}
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  scanResult.ocr_confidence >= 70
                    ? 'bg-green-50 text-green-700'
                    : scanResult.ocr_confidence >= 50
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {scanResult.ocr_confidence >= 70 ? (
                  <CheckCircle size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
                <span className="text-sm font-medium">
                  Confiance: {scanResult.ocr_confidence.toFixed(0)}%
                </span>
              </div>

              {/* Données extraites */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span>{documentTypeLabels[scanResult.document_type]?.icon || '📄'}</span>
                  {documentTypeLabels[scanResult.document_type]?.label || 'Document'}
                </h3>

                <div className="space-y-2">
                  {scanResult.document_type === 'bon_livraison' && (
                    <>
                      {scanResult.data.date_livraison && (
                        <DataRow label="Date" value={scanResult.data.date_livraison} />
                      )}
                      {scanResult.data.numero_bon && (
                        <DataRow label="N° Bon" value={scanResult.data.numero_bon} />
                      )}
                      {scanResult.data.quantite_kg && (
                        <DataRow label="Quantité" value={`${scanResult.data.quantite_kg} kg`} />
                      )}
                      {scanResult.data.total_ht && (
                        <DataRow label="Total HT" value={`${scanResult.data.total_ht.toFixed(2)} €`} />
                      )}
                    </>
                  )}

                  {scanResult.document_type === 'fiche_mortalite' && (
                    <>
                      {scanResult.data.date && <DataRow label="Date" value={scanResult.data.date} />}
                      {scanResult.data.lot_code && (
                        <DataRow label="Lot" value={scanResult.data.lot_code} />
                      )}
                      {scanResult.data.nombre_morts !== undefined && (
                        <DataRow
                          label="Mortalité"
                          value={`${scanResult.data.nombre_morts} canard(s)`}
                        />
                      )}
                      {scanResult.data.causes && scanResult.data.causes.length > 0 && (
                        <DataRow label="Causes" value={scanResult.data.causes.join(', ')} />
                      )}
                    </>
                  )}

                  {scanResult.document_type === 'fiche_lot' && (
                    <>
                      {scanResult.data.code_lot && (
                        <DataRow label="Code Lot" value={scanResult.data.code_lot} />
                      )}
                      {scanResult.data.date_debut && (
                        <DataRow label="Date début" value={scanResult.data.date_debut} />
                      )}
                      {scanResult.data.nb_canards && (
                        <DataRow label="Nb canards" value={`${scanResult.data.nb_canards}`} />
                      )}
                      {scanResult.data.souche && (
                        <DataRow label="Souche" value={scanResult.data.souche} />
                      )}
                      {scanResult.data.poids_moyen_initial && (
                        <DataRow
                          label="Poids moyen"
                          value={`${scanResult.data.poids_moyen_initial} g`}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
                  <AlertCircle size={20} />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  🔄 Recommencer
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all"
                >
                  ✅ Confirmer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-200 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
