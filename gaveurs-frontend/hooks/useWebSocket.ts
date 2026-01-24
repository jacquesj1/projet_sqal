import { useEffect, useCallback } from 'react';
import { useWebSocket } from '@/context/WebSocketContext';

export function useWebSocketEvent(type: string, callback: (data: unknown) => void) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(type, callback);
    return unsubscribe;
  }, [type, callback, subscribe]);
}

export function useAlertesLive(onAlerte: (alerte: unknown) => void) {
  const stableCallback = useCallback(onAlerte, []);
  useWebSocketEvent('alerte', stableCallback);
}

export function useGavagesLive(onGavage: (gavage: unknown) => void) {
  const stableCallback = useCallback(onGavage, []);
  useWebSocketEvent('gavage', stableCallback);
}

export function usePoidsLive(onPoids: (poids: unknown) => void) {
  const stableCallback = useCallback(onPoids, []);
  useWebSocketEvent('poids', stableCallback);
}

export function useAnomaliesLive(onAnomalie: (anomalie: unknown) => void) {
  const stableCallback = useCallback(onAnomalie, []);
  useWebSocketEvent('anomalie', stableCallback);
}

export function useNotificationsLive(onNotification: (notification: unknown) => void) {
  const stableCallback = useCallback(onNotification, []);
  useWebSocketEvent('notification', stableCallback);
}

export function useAllMessagesLive(onMessage: (message: unknown) => void) {
  const stableCallback = useCallback(onMessage, []);
  useWebSocketEvent('all', stableCallback);
}
