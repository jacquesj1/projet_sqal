/**
 * Hook React pour WebSocket temps réel - Données gavage
 * DÉSACTIVÉ: Utiliser WebSocketContext à la place
 * Ce hook était pour /ws/realtime/ (Euralis multi-sites)
 * Frontend Gaveurs doit utiliser /ws/gaveur/{id}
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

// HOOK DÉSACTIVÉ - Ne pas utiliser dans frontend gaveurs
const HOOK_DISABLED = true;

export interface GavageRealtimeData {
  code_lot: string;
  gaveur_id: number;
  gaveur_nom: string;
  site: string;
  genetique: string;
  jour: number;
  moment: 'matin' | 'soir';
  dose_theorique: number;
  dose_reelle: number;
  poids_moyen: number;
  nb_canards_vivants: number;
  taux_mortalite: number;
  temperature_stabule: number;
  humidite_stabule: number;
  timestamp: string;
  pret_abattage?: boolean;
}

export interface GavageRealtimeMessage {
  type: 'gavage_realtime';
  data: GavageRealtimeData;
  timestamp: string;
}

interface UseRealtimeGavageOptions {
  enabled?: boolean;
  onMessage?: (data: GavageRealtimeData) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseRealtimeGavageReturn {
  lastMessage: GavageRealtimeData | null;
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
}

export function useRealtimeGavage(
  options: UseRealtimeGavageOptions = {}
): UseRealtimeGavageReturn {
  const {
    enabled = true,
    onMessage,
    onError,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
  } = options;

  const [lastMessage, setLastMessage] = useState<GavageRealtimeData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    // Nettoie intervals
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Ferme WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    // Envoie heartbeat toutes les 30s
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);
  }, []);

  const connect = useCallback(() => {
    // HOOK DÉSACTIVÉ - Retourner immédiatement
    if (HOOK_DISABLED || !enabled) {
      console.warn('⚠️ useRealtimeGavage est désactivé. Utiliser WebSocketContext à la place.');
      return;
    }

    try {
      const ws = new WebSocket(`${WS_URL}/ws/realtime/`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket Gavage connecté');
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Message de connexion
          if (message.type === 'connection_established') {
            console.log('🔗 Connexion établie:', message.message);
            return;
          }

          // Message heartbeat ACK
          if (message.type === 'heartbeat_ack') {
            return;
          }

          // Message gavage temps réel
          if (message.type === 'gavage_realtime') {
            const gavageData = message.data as GavageRealtimeData;
            setLastMessage(gavageData);

            if (onMessage) {
              onMessage(gavageData);
            }

            console.log(
              `📊 Gavage reçu: ${gavageData.code_lot} J${gavageData.jour} ${gavageData.moment}`
            );
          }
        } catch (err) {
          console.error('Erreur parsing message WebSocket:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ Erreur WebSocket:', event);
        setError('Erreur de connexion WebSocket');
        setIsConnected(false);

        if (onError) {
          onError(event);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket fermé:', event.code, event.reason);
        setIsConnected(false);

        // Cleanup heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Reconnexion automatique
        if (enabled && reconnectAttempts < maxReconnectAttempts) {
          console.log(
            `🔄 Reconnexion dans ${reconnectInterval}ms (tentative ${reconnectAttempts + 1}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, reconnectInterval);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          setError('Nombre maximum de tentatives de reconnexion atteint');
        }
      };
    } catch (err) {
      console.error('Erreur création WebSocket:', err);
      setError('Impossible de créer la connexion WebSocket');
    }
  }, [
    enabled,
    onMessage,
    onError,
    reconnectInterval,
    maxReconnectAttempts,
    reconnectAttempts,
    startHeartbeat,
  ]);

  // Connexion initiale
  useEffect(() => {
    connect();

    // Cleanup au démontage
    return () => {
      cleanup();
    };
  }, [connect, cleanup]);

  return {
    lastMessage,
    isConnected,
    error,
    reconnectAttempts,
  };
}
