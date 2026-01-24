'use client';

import { useState } from 'react';
import { Brain, Eye, Mic, Zap, Play, CheckCircle, AlertCircle, Loader } from 'lucide-react';

type TrainingStatus = 'idle' | 'running' | 'success' | 'error';

interface TrainingResult {
  status: string;
  message?: string;
  [key: string]: any;
}

export default function AITrainingDashboard() {
  const [visionStatus, setVisionStatus] = useState<TrainingStatus>('idle');
  const [visionResult, setVisionResult] = useState<TrainingResult | null>(null);

  const [voiceStatus, setVoiceStatus] = useState<TrainingStatus>('idle');
  const [voiceResult, setVoiceResult] = useState<TrainingResult | null>(null);

  const [optimizationStatus, setOptimizationStatus] = useState<TrainingStatus>('idle');
  const [optimizationResult, setOptimizationResult] = useState<TrainingResult | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const trainVisionModel = async () => {
    setVisionStatus('running');
    setVisionResult(null);

    try {
      const response = await fetch(`${API_URL}/api/vision/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genetique: 'Mulard',
          epochs: 50,
          batch_size: 32
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        setVisionStatus('success');
        setVisionResult(data);
      } else {
        setVisionStatus('error');
        setVisionResult(data);
      }
    } catch (error: any) {
      setVisionStatus('error');
      setVisionResult({ status: 'error', message: error.message });
    }
  };

  const loadVoiceModel = async () => {
    setVoiceStatus('running');
    setVoiceResult(null);

    try {
      // Test voice assistant by getting supported commands
      const response = await fetch(`${API_URL}/api/voice/commands`);
      const data = await response.json();

      if (data.supported_commands) {
        setVoiceStatus('success');
        setVoiceResult({
          status: 'success',
          message: 'Voice assistant ready',
          nb_commands: data.supported_commands.length
        });
      } else {
        setVoiceStatus('error');
        setVoiceResult({ status: 'error', message: 'Failed to load voice assistant' });
      }
    } catch (error: any) {
      setVoiceStatus('error');
      setVoiceResult({ status: 'error', message: error.message });
    }
  };

  const runOptimization = async () => {
    setOptimizationStatus('running');
    setOptimizationResult(null);

    try {
      const response = await fetch(`${API_URL}/api/optimize/multi-objective`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genetique: 'Mulard',
          population_size: 100,
          n_generations: 50
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        setOptimizationStatus('success');
        setOptimizationResult(data);
      } else {
        setOptimizationStatus('error');
        setOptimizationResult(data);
      }
    } catch (error: any) {
      setOptimizationStatus('error');
      setOptimizationResult({ status: 'error', message: error.message });
    }
  };

  const StatusIcon = ({ status }: { status: TrainingStatus }) => {
    switch (status) {
      case 'running':
        return <Loader className="w-5 h-5 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
          <Brain className="w-10 h-10 text-purple-600" />
          Dashboard d'Entraînement IA
        </h1>
        <p className="text-gray-600">
          Entraînez et testez les modèles d'intelligence artificielle du système Gaveurs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vision par Ordinateur */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Vision par Ordinateur</h2>
              <p className="text-sm text-gray-500">CNN - Détection de poids</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">
              <strong>Modèle:</strong> MobileNetV2 + Dense Layers
            </div>
            <div className="text-sm text-gray-600 mb-2">
              <strong>Input:</strong> Images 224x224 RGB
            </div>
            <div className="text-sm text-gray-600 mb-4">
              <strong>Output:</strong> Poids en grammes
            </div>

            <button
              onClick={trainVisionModel}
              disabled={visionStatus === 'running'}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {visionStatus === 'running' ? (
                <><Loader className="w-5 h-5 animate-spin" /> Entraînement en cours...</>
              ) : (
                <><Play className="w-5 h-5" /> Entraîner le modèle</>
              )}
            </button>
          </div>

          {visionResult && (
            <div className={`p-4 rounded-lg ${visionStatus === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon status={visionStatus} />
                <span className="font-semibold">
                  {visionStatus === 'success' ? 'Entraînement réussi' : 'Erreur'}
                </span>
              </div>
              {visionResult.nb_samples && (
                <div className="text-sm space-y-1">
                  <div>Échantillons: {visionResult.nb_samples}</div>
                  <div>Époques: {visionResult.epochs_trained}</div>
                  <div>MAE: {visionResult.final_mae?.toFixed(2)}g</div>
                  <div>Val MAE: {visionResult.final_val_mae?.toFixed(2)}g</div>
                </div>
              )}
              {visionResult.message && (
                <div className="text-sm mt-2">{visionResult.message}</div>
              )}
            </div>
          )}
        </div>

        {/* Assistant Vocal */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Mic className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Assistant Vocal</h2>
              <p className="text-sm text-gray-500">Whisper - Saisie vocale</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">
              <strong>Modèle:</strong> OpenAI Whisper
            </div>
            <div className="text-sm text-gray-600 mb-2">
              <strong>Langues:</strong> FR, EN, ES, DE
            </div>
            <div className="text-sm text-gray-600 mb-4">
              <strong>Commandes:</strong> 8 patterns
            </div>

            <button
              onClick={loadVoiceModel}
              disabled={voiceStatus === 'running'}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {voiceStatus === 'running' ? (
                <><Loader className="w-5 h-5 animate-spin" /> Chargement...</>
              ) : (
                <><Play className="w-5 h-5" /> Charger le modèle</>
              )}
            </button>
          </div>

          {voiceResult && (
            <div className={`p-4 rounded-lg ${voiceStatus === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon status={voiceStatus} />
                <span className="font-semibold">
                  {voiceStatus === 'success' ? 'Modèle chargé' : 'Erreur'}
                </span>
              </div>
              {voiceResult.nb_commands && (
                <div className="text-sm">
                  Commandes supportées: {voiceResult.nb_commands}
                </div>
              )}
              {voiceResult.message && (
                <div className="text-sm mt-2">{voiceResult.message}</div>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-semibold text-gray-700 mb-2">Exemples de commandes:</div>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• "dose matin 450 grammes"</li>
              <li>• "poids soir 3 kilos 250"</li>
              <li>• "température 21 degrés"</li>
            </ul>
          </div>
        </div>

        {/* Optimisation Multi-Objectifs */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Zap className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Optimisation Multi-Objectifs</h2>
              <p className="text-sm text-gray-500">NSGA-II - Algorithme génétique</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">
              <strong>Algorithme:</strong> NSGA-II (DEAP)
            </div>
            <div className="text-sm text-gray-600 mb-2">
              <strong>Objectifs:</strong> 5 simultanés
            </div>
            <div className="text-sm text-gray-600 mb-4">
              <strong>Output:</strong> Front de Pareto
            </div>

            <button
              onClick={runOptimization}
              disabled={optimizationStatus === 'running'}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {optimizationStatus === 'running' ? (
                <><Loader className="w-5 h-5 animate-spin" /> Optimisation...</>
              ) : (
                <><Play className="w-5 h-5" /> Lancer l'optimisation</>
              )}
            </button>
          </div>

          {optimizationResult && (
            <div className={`p-4 rounded-lg ${optimizationStatus === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon status={optimizationStatus} />
                <span className="font-semibold">
                  {optimizationStatus === 'success' ? 'Optimisation terminée' : 'Erreur'}
                </span>
              </div>
              {optimizationResult.pareto_front_size && (
                <div className="text-sm space-y-1">
                  <div>Solutions: {optimizationResult.pareto_front_size}</div>
                  <div>Générations: {optimizationResult.n_generations}</div>
                  {optimizationResult.best_solution && (
                    <div className="mt-2 pt-2 border-t border-green-300">
                      <div className="font-semibold mb-1">Meilleure solution:</div>
                      <div className="text-xs">
                        Dose matin: {optimizationResult.best_solution.parametres.dose_matin}g
                      </div>
                      <div className="text-xs">
                        Dose soir: {optimizationResult.best_solution.parametres.dose_soir}g
                      </div>
                      <div className="text-xs">
                        ITM: {optimizationResult.best_solution.objectifs.poids_foie_kg}kg
                      </div>
                    </div>
                  )}
                </div>
              )}
              {optimizationResult.message && (
                <div className="text-sm mt-2">{optimizationResult.message}</div>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-semibold text-gray-700 mb-2">Objectifs optimisés:</div>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Maximiser poids foie</li>
              <li>• Maximiser survie</li>
              <li>• Optimiser coûts</li>
              <li>• Minimiser durée</li>
              <li>• Maximiser satisfaction</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-600" />
          À propos de cette page
        </h3>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>Vision par Ordinateur:</strong> Entraîne un réseau de neurones convolutif (CNN)
            pour détecter automatiquement le poids des canards à partir de photos.
            Nécessite des images étiquetées dans la base de données.
          </p>
          <p>
            <strong>Assistant Vocal:</strong> Utilise Whisper d'OpenAI pour transcrire les commandes
            vocales et extraire automatiquement les données de gavage.
            Supporte le français et d'autres langues.
          </p>
          <p>
            <strong>Optimisation Multi-Objectifs:</strong> Utilise l'algorithme génétique NSGA-II
            pour trouver les paramètres optimaux de gavage qui maximisent simultanément
            5 objectifs concurrents. Retourne un front de Pareto de solutions non-dominées.
          </p>
        </div>
      </div>
    </div>
  );
}
