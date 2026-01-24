'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface RealtimeNotificationsProps {
  wsUrl?: string;
  maxNotifications?: number;
}

export default function RealtimeNotifications({
  wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  maxNotifications = 50,
}: RealtimeNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);

  const connectWebSocket = () => {
    try {
      // Connexion au WebSocket pour les notifications
      const ws = new WebSocket(`${wsUrl}/ws/notifications/`);

      ws.onopen = () => {
        console.log('[WS] Connected to notifications service');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Créer une notification depuis les données reçues
          const notification: Notification = {
            id: data.id || `notif-${Date.now()}`,
            type: data.type || 'info',
            title: data.title || 'Notification',
            message: data.message || '',
            timestamp: data.timestamp || new Date().toISOString(),
            read: false,
          };

          setNotifications((prev) => {
            const updated = [notification, ...prev].slice(0, maxNotifications);
            // Sauvegarder dans localStorage
            localStorage.setItem('euralis_notifications', JSON.stringify(updated));
            return updated;
          });

          // Afficher une notification toast
          showToast(notification);
        } catch (error) {
          console.error('[WS] Error parsing notification:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected from notifications service');
        setIsConnected(false);
        wsRef.current = null;

        // Tentative de reconnexion avec backoff exponentiel
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`[WS] Attempting to reconnect (attempt ${reconnectAttempts.current})...`);
          connectWebSocket();
        }, delay);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WS] Failed to connect:', error);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    // Charger les notifications depuis localStorage au montage
    const savedNotifications = localStorage.getItem('euralis_notifications');
    if (savedNotifications) {
      try {
        setNotifications(JSON.parse(savedNotifications));
      } catch (e) {
        console.error('Error loading saved notifications:', e);
      }
    }

    // Connexion WebSocket
    connectWebSocket();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const showToast = (notification: Notification) => {
    // Utiliser l'API Notifications du navigateur si disponible
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
      });
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      localStorage.setItem('euralis_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      localStorage.setItem('euralis_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      localStorage.setItem('euralis_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem('euralis_notifications');
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getBgColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return date.toLocaleString('fr-FR');
  };

  return (
    <div className="relative">
      {/* Bouton notification */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) requestNotificationPermission();
        }}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <Bell className="h-6 w-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-xs items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
        {/* Indicateur de connexion */}
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          }`}
          title={isConnected ? 'Connecté' : 'Déconnecté'}
        />
      </button>

      {/* Panel des notifications */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est à jour'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Tout marquer lu
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Tout effacer
                  </button>
                </>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Liste des notifications */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Aucune notification</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50/30' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {notification.title}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{notification.message}</p>
                      <p className="text-xs text-gray-500">{formatTimestamp(notification.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
            <p className="text-xs text-gray-500">
              {isConnected ? (
                <>
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                  Connecté au serveur
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                  Reconnexion en cours...
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
