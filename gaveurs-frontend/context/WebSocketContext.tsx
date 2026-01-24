'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import type { WebSocketMessage } from '@/lib/types';

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: unknown) => void;
  subscribe: (type: string, callback: (data: unknown) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

// Singleton WebSocket pour éviter multiples connexions
let globalWS: WebSocket | null = null;
let globalReconnectTimeout: NodeJS.Timeout | null = null;

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Si une connexion existe déjà, ne pas en créer une nouvelle
    if (globalWS && (globalWS.readyState === WebSocket.OPEN || globalWS.readyState === WebSocket.CONNECTING)) {
      console.log('✅ WebSocket déjà connecté, réutilisation');
      wsRef.current = globalWS;
      setIsConnected(globalWS.readyState === WebSocket.OPEN);
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const gaveurId = user.id || 1;

      const ws = new WebSocket(`${WS_URL}/ws/gaveur/${gaveurId}`);

      ws.onopen = () => {
        console.log('✅ WebSocket Gavage connecté');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Notifier les subscribers du type spécifique
          const callbacks = subscribersRef.current.get(message.type);
          if (callbacks) {
            callbacks.forEach((callback) => callback(message.data));
          }

          // Notifier les subscribers 'all'
          const allCallbacks = subscribersRef.current.get('all');
          if (allCallbacks) {
            allCallbacks.forEach((callback) => callback(message));
          }
        } catch (err) {
          console.error('Erreur parsing message WebSocket:', err);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket fermé: 1005');
        setIsConnected(false);
        globalWS = null;
        wsRef.current = null;

        // Reconnexion avec backoff exponentiel
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`🔄 Reconnexion dans ${delay / 1000}s (tentative ${reconnectAttempts.current}/${maxReconnectAttempts})`);

          if (globalReconnectTimeout) {
            clearTimeout(globalReconnectTimeout);
          }

          globalReconnectTimeout = setTimeout(connect, delay);
          reconnectTimeoutRef.current = globalReconnectTimeout;
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Erreur WebSocket:', error);
      };

      globalWS = ws;
      wsRef.current = ws;
    } catch (err) {
      console.error('Erreur connexion WebSocket:', err);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      // Ne PAS fermer la connexion globale lors du cleanup
      // car elle doit persister à travers les remontages du composant
      // La connexion sera fermée uniquement lors du unmount final de l'app
      // ou lors de la fermeture du navigateur
      console.log('WebSocketProvider cleanup - connexion maintenue');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket non connecté');
    }
  }, []);

  const subscribe = useCallback((type: string, callback: (data: unknown) => void) => {
    if (!subscribersRef.current.has(type)) {
      subscribersRef.current.set(type, new Set());
    }
    subscribersRef.current.get(type)!.add(callback);

    // Retourner fonction de désabonnement
    return () => {
      subscribersRef.current.get(type)?.delete(callback);
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, sendMessage, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
