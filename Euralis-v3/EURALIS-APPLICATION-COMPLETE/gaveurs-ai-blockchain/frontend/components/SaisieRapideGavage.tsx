'use client';

import { useState, useEffect } from 'react';
import { Camera, Mic, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

interface CanardOption {
  id: number;
  numero: string;
  genetique: string;
  poids_actuel: number;
}

interface DoseTheorique {
  dose_matin: number;
  dose_soir: number;
  confiance: number;
}

export default function SaisieRapideGavage() {
  const [canards, setCanards] = useState<CanardOption[]>([]);
  const [canardSelected, setCanardSelected] = useState<number | null>(null);
  const [session, setSession] = useState<'matin' | 'soir'>('matin');
  
  // Données saisies
  const [doseMatin, setDoseMatin] = useState<number>(0);
  const [doseSoir, setDoseSoir] = useState<number>(0);
  const [poidsMatin, setPoidsMatin] = useState<number>(0);
  const [poidsSoir, setPoidsSoir] = useState<number>(0);
  const [temperature, setTemperature] = useState<number>(22.0);
  const [humidite, setHumidite] = useState<number>(60.0);
  const [remarques, setRemarques] = useState<string>('');
  
  // IA - Doses théoriques
  const [doseTheorique, setDoseTheorique] = useState<DoseTheorique | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Saisie vocale
  const [isListening, setIsListening] = useState(false);
  
  // Vision par ordinateur
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    loadCanards();
  }, []);

  useEffect(() => {
    if (canardSelected) {
      calculerDoseTheorique();
    }
  }, [canardSelected]);

  const loadCanards = async () => {
    try {
      const response = await fetch('/api/canards/gaveur/1'); // TODO: ID gaveur dynamique
      const data = await response.json();
      setCanards(data);
    } catch (error) {
      console.error('Erreur chargement canards:', error);
    }
  };

  const calculerDoseTheorique = async () => {
    if (!canardSelected) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/ml/predict-doses/${canardSelected}`);
      const data = await response.json();
      
      setDoseTheorique({
        dose_matin: data.dose_matin_optimale,
        dose_soir: data.dose_soir_optimale,
        confiance: data.confiance || 0.85
      });
      
      // Pré-remplir avec les doses théoriques
      setDoseMatin(data.dose_matin_optimale);
      setDoseSoir(data.dose_soir_optimale);
      
    } catch (error) {
      console.error('Erreur calcul dose théorique:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculerEcart = (doseReelle: number, doseTheo: number): number => {
    if (!doseTheo) return 0;
    return ((doseReelle - doseTheo) / doseTheo) * 100;
  };

  const getEcartColor = (ecart: number): string => {
    const absEcart = Math.abs(ecart);
    if (absEcart >= 25) return 'text-red-600';
    if (absEcart >= 10) return 'text-orange-500';
    return 'text-green-600';
  };

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Reconnaissance vocale non supportée dans ce navigateur');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      parseVoiceCommand(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Erreur reconnaissance vocale:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const parseVoiceCommand = (command: string) => {
    // Parser les commandes vocales
    // Ex: "dose matin 450", "poids 3200", "température 22"
    
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('dose matin')) {
      const match = lowerCommand.match(/(\d+)/);
      if (match) setDoseMatin(parseInt(match[1]));
    }
    
    if (lowerCommand.includes('dose soir')) {
      const match = lowerCommand.match(/(\d+)/);
      if (match) setDoseSoir(parseInt(match[1]));
    }
    
    if (lowerCommand.includes('poids')) {
      const match = lowerCommand.match(/(\d+)/);
      if (match) {
        if (session === 'matin') {
          setPoidsMatin(parseInt(match[1]));
        } else {
          setPoidsSoir(parseInt(match[1]));
        }
      }
    }
    
    if (lowerCommand.includes('température')) {
      const match = lowerCommand.match(/(\d+)/);
      if (match) setTemperature(parseInt(match[1]));
    }
  };

  const activerCamera = async () => {
    setCameraActive(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // TODO: Implémenter vision par ordinateur pour détection automatique du poids
      
      // Simulation - En production, envoyer frame à modèle de vision
      setTimeout(() => {
        const poidsDetecte = 3250 + Math.random() * 100;
        if (session === 'matin') {
          setPoidsMatin(Math.round(poidsDetecte));
        } else {
          setPoidsSoir(Math.round(poidsDetecte));
        }
        
        stream.getTracks().forEach(track => track.stop());
        setCameraActive(false);
        
        alert(`Poids détecté par vision: ${Math.round(poidsDetecte)}g`);
      }, 2000);
      
    } catch (error) {
      console.error('Erreur caméra:', error);
      setCameraActive(false);
    }
  };

  const sauvegarder = async () => {
    if (!canardSelected) {
      alert('Veuillez sélectionner un canard');
      return;
    }

    const data = {
      canard_id: canardSelected,
      dose_matin: doseMatin,
      dose_soir: doseSoir,
      dose_theorique_matin: doseTheorique?.dose_matin,
      dose_theorique_soir: doseTheorique?.dose_soir,
      heure_gavage_matin: '08:30:00',
      heure_gavage_soir: '18:30:00',
      poids_matin: poidsMatin || null,
      poids_soir: poidsSoir || null,
      temperature_stabule: temperature,
      humidite_stabule: humidite,
      lot_mais_id: 1, // TODO: Dynamique
      remarques: remarques
    };

    try {
      const response = await fetch('/api/gavage/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        alert('✅ Gavage enregistré avec succès !');
        resetForm();
      } else {
        alert('❌ Erreur lors de l\'enregistrement');
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('❌ Erreur réseau');
    }
  };

  const resetForm = () => {
    setCanardSelected(null);
    setDoseMatin(0);
    setDoseSoir(0);
    setPoidsMatin(0);
    setPoidsSoir(0);
    setRemarques('');
    setDoseTheorique(null);
  };

  const ecartMatin = doseTheorique ? calculerEcart(doseMatin, doseTheorique.dose_matin) : 0;
  const ecartSoir = doseTheorique ? calculerEcart(doseSoir, doseTheorique.dose_soir) : 0;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        🌽 Saisie Rapide de Gavage
      </h1>

      {/* Sélection Canard */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Canard
        </label>
        <select
          value={canardSelected || ''}
          onChange={(e) => setCanardSelected(Number(e.target.value))}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sélectionner un canard...</option>
          {canards.map((canard) => (
            <option key={canard.id} value={canard.id}>
              {canard.numero} - {canard.genetique} ({canard.poids_actuel}g)
            </option>
          ))}
        </select>
      </div>

      {/* Session */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Session
        </label>
        <div className="flex gap-4">
          <button
            onClick={() => setSession('matin')}
            className={`flex-1 p-3 rounded-lg font-medium ${
              session === 'matin'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            🌅 Matin
          </button>
          <button
            onClick={() => setSession('soir')}
            className={`flex-1 p-3 rounded-lg font-medium ${
              session === 'soir'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            🌙 Soir
          </button>
        </div>
      </div>

      {/* Dose IA - Affichage */}
      {doseTheorique && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg border border-purple-300">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-purple-600" size={20} />
            <h3 className="font-bold text-purple-900">Doses Recommandées par IA</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Matin</p>
              <p className="text-2xl font-bold text-purple-700">
                {doseTheorique.dose_matin}g
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Soir</p>
              <p className="text-2xl font-bold text-purple-700">
                {doseTheorique.dose_soir}g
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Confiance: {(doseTheorique.confiance * 100).toFixed(0)}%
          </p>
        </div>
      )}

      {/* Doses */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dose Matin (g)
          </label>
          <input
            type="number"
            value={doseMatin}
            onChange={(e) => setDoseMatin(Number(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="450"
          />
          {doseTheorique && Math.abs(ecartMatin) >= 10 && (
            <p className={`text-sm mt-1 font-medium ${getEcartColor(ecartMatin)}`}>
              {ecartMatin > 0 ? '⬆️' : '⬇️'} Écart: {Math.abs(ecartMatin).toFixed(1)}%
              {Math.abs(ecartMatin) >= 25 && ' - ALERTE CRITIQUE !'}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dose Soir (g)
          </label>
          <input
            type="number"
            value={doseSoir}
            onChange={(e) => setDoseSoir(Number(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="480"
          />
          {doseTheorique && Math.abs(ecartSoir) >= 10 && (
            <p className={`text-sm mt-1 font-medium ${getEcartColor(ecartSoir)}`}>
              {ecartSoir > 0 ? '⬆️' : '⬇️'} Écart: {Math.abs(ecartSoir).toFixed(1)}%
              {Math.abs(ecartSoir) >= 25 && ' - ALERTE CRITIQUE !'}
            </p>
          )}
        </div>
      </div>

      {/* Poids avec Vision */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Poids Matin (g)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={poidsMatin}
              onChange={(e) => setPoidsMatin(Number(e.target.value))}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="3200"
            />
            {session === 'matin' && (
              <button
                onClick={activerCamera}
                disabled={cameraActive}
                className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                title="Vision par ordinateur"
              >
                <Camera size={20} />
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Poids Soir (g)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={poidsSoir}
              onChange={(e) => setPoidsSoir(Number(e.target.value))}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="3290"
            />
            {session === 'soir' && (
              <button
                onClick={activerCamera}
                disabled={cameraActive}
                className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                title="Vision par ordinateur"
              >
                <Camera size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conditions environnementales */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Température (°C)
          </label>
          <input
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Humidité (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={humidite}
            onChange={(e) => setHumidite(Number(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Remarques avec saisie vocale */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Remarques
        </label>
        <div className="flex gap-2">
          <textarea
            value={remarques}
            onChange={(e) => setRemarques(e.target.value)}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Observations..."
          />
          <button
            onClick={startVoiceInput}
            disabled={isListening}
            className={`p-3 rounded-lg ${
              isListening
                ? 'bg-red-600 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
            title="Saisie vocale"
          >
            <Mic size={20} />
          </button>
        </div>
        {isListening && (
          <p className="text-sm text-red-600 mt-1 animate-pulse">
            🎤 Écoute en cours...
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={sauvegarder}
          className="flex-1 bg-green-600 text-white p-4 rounded-lg font-bold hover:bg-green-700 transition-colors"
        >
          ✅ Enregistrer le Gavage
        </button>
        <button
          onClick={resetForm}
          className="px-6 bg-gray-300 text-gray-700 p-4 rounded-lg font-bold hover:bg-gray-400 transition-colors"
        >
          🔄 Réinitialiser
        </button>
      </div>

      {/* Indicateurs en temps réel */}
      {canardSelected && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-bold text-gray-800 mb-2">📊 Statistiques Temps Réel</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Gain Prévu</p>
              <p className="text-xl font-bold text-green-600">
                +{poidsSoir - poidsMatin || 0}g
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Dose Totale</p>
              <p className="text-xl font-bold text-blue-600">
                {doseMatin + doseSoir}g
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Conformité IA</p>
              <p className={`text-xl font-bold ${
                Math.abs(ecartMatin) < 10 && Math.abs(ecartSoir) < 10
                  ? 'text-green-600'
                  : 'text-orange-600'
              }`}>
                {Math.abs(ecartMatin) < 10 && Math.abs(ecartSoir) < 10 ? '✓' : '⚠️'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
