'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Play, Square, RefreshCw, ExternalLink, Copy } from 'lucide-react';
import QRCode from 'qrcode';

import * as api from '@/lib/api';
import type { ConsumerProduct, BlockchainVerifyResponse } from '@/types/api';

function truncateMiddle(value: string, left: number = 10, right: number = 8) {
  if (!value) return value;
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function E2EDemoPage() {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [codeLot, setCodeLot] = useState<string>('');
  const [products, setProducts] = useState<ConsumerProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ConsumerProduct | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [blockchainVerify, setBlockchainVerify] = useState<BlockchainVerifyResponse | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 6000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  };

  const canVerify = useMemo(() => {
    return !!selectedProduct?.blockchain_hash;
  }, [selectedProduct]);

  const generateQr = async (qrCodeValue: string) => {
    const dataUrl = await QRCode.toDataURL(qrCodeValue, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 10,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    });
    setQrDataUrl(dataUrl);
  };

  useEffect(() => {
    (async () => {
      try {
        if (!selectedProduct?.qr_code) {
          setQrDataUrl(null);
          setQrPayload(null);
          return;
        }

        const traceabilityBaseUrl = process.env.NEXT_PUBLIC_TRACEABILITY_URL || 'http://localhost:3002';
        const url = new URL(`${traceabilityBaseUrl}/trace/${encodeURIComponent(selectedProduct.qr_code)}`);

        if (codeLot) url.searchParams.set('code_lot', codeLot);
        if (selectedProduct.lot_id != null) url.searchParams.set('lot_id', String(selectedProduct.lot_id));
        if (selectedProduct.sqal_grade) url.searchParams.set('grade', selectedProduct.sqal_grade);
        if (selectedProduct.tof_score != null) url.searchParams.set('tof', String(selectedProduct.tof_score));
        if (selectedProduct.as7341_score != null) url.searchParams.set('as7341', String(selectedProduct.as7341_score));

        const payload = url.toString();
        setQrPayload(payload);
        await generateQr(payload);
      } catch (e) {
        setQrDataUrl(null);
        setQrPayload(null);
      }
    })();
  }, [selectedProduct?.qr_code, codeLot, selectedProduct?.lot_id, selectedProduct?.sqal_grade, selectedProduct?.tof_score, selectedProduct?.as7341_score]);

  const refreshProducts = async () => {
    setLoading(true);
    clearMessages();
    try {
      const list = await api.getConsumerProducts(codeLot ? { code_lot: codeLot } : undefined);
      setProducts(list);
      const first = list?.[0] ?? null;
      setSelectedProduct(first);
      setBlockchainVerify(null);
      showSuccess(`Produits chargés: ${list.length}`);
    } catch (e: any) {
      showError(e?.message || 'Échec chargement produits');
    } finally {
      setLoading(false);
    }
  };

  const startSqal = async () => {
    setActionLoading('sqal');
    clearMessages();
    try {
      await api.startControlSqal({ device_id: 'ESP32_LL_01', interval: 30, nb_samples: 50 });
      showSuccess('SQAL démarré');
    } catch (e: any) {
      showError(e?.message || 'Échec démarrage SQAL');
    } finally {
      setActionLoading(null);
    }
  };

  const stopSqal = async () => {
    setActionLoading('sqal-stop');
    clearMessages();
    try {
      await api.stopControlSqal();
      showSuccess('SQAL arrêté');
    } catch (e: any) {
      showError(e?.message || 'Échec arrêt SQAL');
    } finally {
      setActionLoading(null);
    }
  };

  const autoFillFromLatest = async () => {
    setLoading(true);
    clearMessages();
    try {
      const latest = await api.getLatestConsumerProduct();

      const resolvedCodeLot = (latest?.code_lot || '').trim();
      if (resolvedCodeLot) {
        setCodeLot(resolvedCodeLot);
      }

      const list = await api.getConsumerProducts(resolvedCodeLot ? { code_lot: resolvedCodeLot } : undefined);
      setProducts(list);

      const preferred = list.find((p) => p.product_id === latest.product.product_id) || list?.[0] || null;
      const merged = preferred
        ? {
            ...preferred,
            tof_score: latest.product.tof_score ?? preferred.tof_score ?? null,
            as7341_score: latest.product.as7341_score ?? preferred.as7341_score ?? null,
          }
        : null;
      setSelectedProduct(merged);
      setBlockchainVerify(null);

      showSuccess('Auto: dernier produit chargé');
    } catch (e: any) {
      showError(e?.message || 'Auto: échec');
    } finally {
      setLoading(false);
    }
  };

  const startE2EAuto = async () => {
    setActionLoading('e2e-auto');
    clearMessages();
    try {
      await api.startControlGavage({ nb_lots: 3, acceleration: 1440 });
      await api.startControlMonitor({ polling_interval: 10 });

      try {
        await api.startControlSqal({ device_id: 'ESP32_LL_01', interval: 30, nb_samples: 50 });
      } catch {
        // SQAL can also be triggered by the monitor; ignore if it fails to start here.
      }

      const timeoutMs = 60_000;
      const intervalMs = 2_000;
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeoutMs) {
        try {
          const latest = await api.getLatestConsumerProduct();
          await autoFillFromLatest();

          try {
            await api.startControlConsumer({
              interval: 10,
              num_feedbacks: 5,
              code_lot: latest?.code_lot || undefined,
            });
          } catch {
            // Consumer is optional in this one-click flow; ignore if it fails to start.
          }
          return;
        } catch {
          // keep polling
        }
        await sleep(intervalMs);
      }

      showError('Auto: timeout (aucun produit trouvé après 60s)');
    } catch (e: any) {
      showError(e?.message || 'Start E2E + Auto: échec');
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess('Copié');
    } catch {
      showError('Impossible de copier');
    }
  };

  const startGavage = async () => {
    setActionLoading('gavage');
    clearMessages();
    try {
      await api.startControlGavage({ nb_lots: 3, acceleration: 1440 });
      showSuccess('Gavage realtime démarré');
    } catch (e: any) {
      showError(e?.message || 'Échec démarrage gavage');
    } finally {
      setActionLoading(null);
    }
  };

  const stopGavage = async () => {
    setActionLoading('gavage-stop');
    clearMessages();
    try {
      await api.stopControlGavage();
      showSuccess('Gavage arrêté');
    } catch (e: any) {
      showError(e?.message || 'Échec arrêt gavage');
    } finally {
      setActionLoading(null);
    }
  };

  const startMonitor = async () => {
    setActionLoading('monitor');
    clearMessages();
    try {
      await api.startControlMonitor({ polling_interval: 10 });
      showSuccess('Lot Monitor démarré');
    } catch (e: any) {
      showError(e?.message || 'Échec démarrage monitor');
    } finally {
      setActionLoading(null);
    }
  };

  const stopMonitor = async () => {
    setActionLoading('monitor-stop');
    clearMessages();
    try {
      await api.stopControlMonitor();
      showSuccess('Lot Monitor arrêté');
    } catch (e: any) {
      showError(e?.message || 'Échec arrêt monitor');
    } finally {
      setActionLoading(null);
    }
  };

  const startConsumer = async () => {
    setActionLoading('consumer');
    clearMessages();
    try {
      await api.startControlConsumer({ interval: 10, num_feedbacks: 5, code_lot: codeLot || undefined });
      showSuccess('Consumer démarré');
    } catch (e: any) {
      showError(e?.message || 'Échec démarrage consumer');
    } finally {
      setActionLoading(null);
    }
  };

  const stopConsumer = async () => {
    setActionLoading('consumer-stop');
    clearMessages();
    try {
      await api.stopControlConsumer();
      showSuccess('Consumer arrêté');
    } catch (e: any) {
      showError(e?.message || 'Échec arrêt consumer');
    } finally {
      setActionLoading(null);
    }
  };

  const verifyBlockchain = async () => {
    if (!selectedProduct?.blockchain_hash) return;
    setActionLoading('verify');
    clearMessages();
    try {
      const result = await api.verifyBlockchainHash(selectedProduct.blockchain_hash);
      setBlockchainVerify(result);
      if (result?.valid) {
        showSuccess('Blockchain: vérifié');
      } else {
        showError(result?.message || result?.error || 'Blockchain: vérification invalide');
      }
    } catch (e: any) {
      showError(e?.message || 'Échec vérification blockchain');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">E2E Orchestration</h1>
              <p className="text-gray-600 mt-1">Simulators → Backend API → Traceability (QR) → Blockchain verification → Consumer feedback</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold transition-colors"
              >
                Retour
              </Link>
              <button
                onClick={autoFillFromLatest}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors disabled:opacity-50"
                title="Fetch latest product (backend: /api/consumer/latest-product) and refresh product list"
              >
                Latest product
              </button>
              <button
                onClick={refreshProducts}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors disabled:opacity-50"
                title="Refresh products list (backend: /api/consumer/products)"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Refresh
                </span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <div className="font-semibold text-red-800">Erreur</div>
            <div className="text-red-800 mt-1">{error}</div>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg">
            <div className="font-semibold text-green-800">OK</div>
            <div className="text-green-800 mt-1">{success}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Control (simulators via /api/control)</h2>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">code_lot (optional filter)</label>
              <input
                value={codeLot}
                onChange={(e) => setCodeLot(e.target.value.trim())}
                placeholder="Ex: LL2512001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <div className="text-xs text-gray-500 mt-2">
                If set: filters products via <code className="px-1">/api/consumer/products?code_lot=...</code>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={startE2EAuto}
                disabled={actionLoading !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50"
                title="Start gavage + monitor (+ SQAL best-effort), then poll latest product and auto-fill"
              >
                <Play className="w-5 h-5" />
                Start pipeline (auto)
              </button>

              <div className="flex gap-2">
                <button
                  onClick={startGavage}
                  disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-start gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  <span className="w-6 flex justify-center">
                    <Play className="w-5 h-5" />
                  </span>
                  <span>Start gavage</span>
                </button>
                <button
                  onClick={stopGavage}
                  disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-start gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg disabled:opacity-50"
                  title="Stop Gavage"
                >
                  <span className="w-6 flex justify-center">
                    <Square className="w-5 h-5" />
                  </span>
                  <span>Stop gavage</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={startMonitor}
                  disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-start gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  <span className="w-6 flex justify-center">
                    <Play className="w-5 h-5" />
                  </span>
                  <span>Start lot monitor</span>
                </button>
                <button
                  onClick={stopMonitor}
                  disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-start gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg disabled:opacity-50"
                  title="Stop Monitor"
                >
                  <span className="w-6 flex justify-center">
                    <Square className="w-5 h-5" />
                  </span>
                  <span>Stop lot monitor</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={startSqal}
                  disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-start gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  <span className="w-6 flex justify-center">
                    <Play className="w-5 h-5" />
                  </span>
                  <span>Start SQAL</span>
                </button>
                <button
                  onClick={stopSqal}
                  disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-start gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg disabled:opacity-50"
                  title="Stop SQAL"
                >
                  <span className="w-6 flex justify-center">
                    <Square className="w-5 h-5" />
                  </span>
                  <span>Stop SQAL</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={startConsumer}
                  disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-start gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  <span className="w-6 flex justify-center">
                    <Play className="w-5 h-5" />
                  </span>
                  <span>Start consumer</span>
                </button>
                <button
                  onClick={stopConsumer}
                  disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-start gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg disabled:opacity-50"
                  title="Stop Consumer"
                >
                  <span className="w-6 flex justify-center">
                    <Square className="w-5 h-5" />
                  </span>
                  <span>Stop consumer</span>
                </button>
              </div>

              <button
                onClick={refreshProducts}
                disabled={loading || actionLoading !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                <RefreshCw className="w-5 h-5" />
                Load products / QR
              </button>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm font-semibold text-gray-800">Frontends (shortcuts)</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <a
                    href="http://localhost:5173/sensors/vl53l8ch"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-sm font-semibold text-gray-800 text-center"
                  >
                    SQAL - VL53L8CH
                  </a>
                  <a
                    href="http://localhost:5173/sensors/as7341"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-sm font-semibold text-gray-800 text-center"
                  >
                    SQAL - AS7341
                  </a>
                  <a
                    href="http://localhost:3000/euralis/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-sm font-semibold text-gray-800 text-center"
                  >
                    Euralis
                  </a>
                  <a
                    href="http://localhost:3001"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-sm font-semibold text-gray-800 text-center"
                  >
                    Gaveurs
                  </a>
                  <a
                    href="http://localhost:3002"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-sm font-semibold text-gray-800 text-center"
                  >
                    Traceability
                  </a>
                </div>

                {selectedProduct?.lot_id && (
                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <div className="text-xs font-semibold text-gray-700">Current lot (Gaveurs)</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <a
                        href={`http://localhost:3001/lots/${selectedProduct.lot_id}/courbes`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-sm font-semibold text-gray-800 text-center"
                      >
                        Curves
                      </a>
                      <a
                        href={`http://localhost:3001/lots/${selectedProduct.lot_id}/gavage`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-sm font-semibold text-gray-800 text-center"
                      >
                        Gavage form
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500">
                Runbook: start gavage → start monitor → wait 10-30s → load products/QR → verify blockchain.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">QR Code</h2>
              {selectedProduct?.qr_code && (
                <button
                  onClick={() => copyToClipboard(selectedProduct.qr_code)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold"
                >
                  <Copy className="w-4 h-4" />
                  Copier QR
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Code"
                      className="w-full max-w-md mx-auto"
                    />
                  ) : (
                    <div className="text-gray-500">
                      Aucun QR chargé. Clique sur <span className="font-semibold">Charger produits / QR</span>.
                    </div>
                  )}
                </div>

                {selectedProduct?.qr_code && (
                  <div className="mt-3 text-xs text-gray-600 break-all">
                    <span className="font-semibold">QR:</span> {selectedProduct.qr_code}
                  </div>
                )}

                {qrPayload && (
                  <div className="mt-2 text-xs text-gray-600 break-all">
                    <span className="font-semibold">QR payload (URL):</span> {qrPayload}
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Produits</div>
                <div className="border border-gray-200 rounded-lg max-h-72 overflow-auto">
                  {products.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">Aucun produit</div>
                  ) : (
                    products.map((p) => (
                      <button
                        key={p.product_id}
                        onClick={() => { setSelectedProduct(p); setBlockchainVerify(null); }}
                        className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 ${selectedProduct?.product_id === p.product_id ? 'bg-indigo-50' : ''}`}
                      >
                        <div className="text-sm font-semibold text-gray-800">{p.product_id}</div>
                        <div className="text-xs text-gray-600">Grade: {p.sqal_grade ?? 'N/A'}</div>
                        <div className="text-xs text-gray-600">lot_id: {p.lot_id ?? 'N/A'}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">Preuve Blockchain</h3>
                <button
                  onClick={verifyBlockchain}
                  disabled={!canVerify || actionLoading !== null}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  Vérifier
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500">blockchain_hash</div>
                  <div className="mt-1 font-mono text-sm text-gray-800 break-all">
                    {selectedProduct?.blockchain_hash ? truncateMiddle(selectedProduct.blockchain_hash, 18, 14) : 'N/A'}
                  </div>
                  {selectedProduct?.blockchain_hash && (
                    <button
                      onClick={() => copyToClipboard(selectedProduct.blockchain_hash!)}
                      className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold"
                    >
                      <Copy className="w-4 h-4" />
                      Copier
                    </button>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500">résultat</div>
                  <div className="mt-1 text-sm text-gray-800">
                    {blockchainVerify ? (
                      <div>
                        <div className={`font-semibold ${blockchainVerify.valid ? 'text-green-700' : 'text-red-700'}`}>
                          {blockchainVerify.valid ? 'VALIDÉ' : 'INVALIDE'}
                        </div>
                        {blockchainVerify.timestamp && (
                          <div className="text-xs text-gray-600 mt-1">timestamp: {blockchainVerify.timestamp}</div>
                        )}
                        {blockchainVerify.verified_at && (
                          <div className="text-xs text-gray-600">verified_at: {blockchainVerify.verified_at}</div>
                        )}
                        {(blockchainVerify.message || blockchainVerify.error) && (
                          <div className="text-xs text-gray-600 mt-2">{blockchainVerify.message || blockchainVerify.error}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500">Clique sur “Vérifier”</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Endpoint: <code className="px-1">/api/consumer/blockchain/verify/{'{hash}'}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
