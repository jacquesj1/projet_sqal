'use client';

import { useWebSocket } from '@/context/WebSocketContext';
import { Wifi, WifiOff } from 'lucide-react';

export default function ConnectionStatus() {
  const { isConnected } = useWebSocket();

  return (
    <div
      className={`fixed bottom-4 left-4 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium shadow-lg z-50 ${
        isConnected
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}
    >
      {isConnected ? (
        <>
          <Wifi size={16} />
          <span>Connecté</span>
        </>
      ) : (
        <>
          <WifiOff size={16} />
          <span>Déconnecté</span>
        </>
      )}
    </div>
  );
}
