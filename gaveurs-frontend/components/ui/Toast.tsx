'use client';

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto-remove after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const icons = {
    success: <CheckCircle className="text-green-500" size={24} />,
    error: <AlertCircle className="text-red-500" size={24} />,
    warning: <AlertTriangle className="text-orange-500" size={24} />,
    info: <Info className="text-blue-500" size={24} />,
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-orange-50 border-orange-200',
    info: 'bg-blue-50 border-blue-200',
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg shadow-lg border min-w-[300px] max-w-md
        ${bgColors[toast.type]}
        ${isExiting ? 'animate-slide-out' : 'animate-slide-in'}
      `}
    >
      {icons[toast.type]}
      <div className="flex-1">
        <p className="font-bold text-gray-800">{toast.title}</p>
        {toast.message && <p className="text-sm text-gray-600 mt-1">{toast.message}</p>}
      </div>
      <button
        onClick={handleRemove}
        className="p-1 hover:bg-gray-200 rounded-full transition-colors"
      >
        <X size={16} className="text-gray-500" />
      </button>
    </div>
  );
}

// Composant pour afficher les notifications WebSocket
export function WebSocketNotifications() {
  const { addToast } = useToast();

  useEffect(() => {
    // Cette fonction sera appelée par le WebSocket context
    const handleWebSocketMessage = (event: CustomEvent) => {
      const { type, data } = event.detail;

      if (type === 'alerte') {
        const level = data.niveau === 'critique' ? 'error' : data.niveau === 'important' ? 'warning' : 'info';
        addToast({
          type: level,
          title: `Alerte ${data.niveau}`,
          message: data.message,
          duration: data.niveau === 'critique' ? 10000 : 5000,
        });
      }

      if (type === 'notification') {
        addToast({
          type: 'info',
          title: 'Notification',
          message: data.message,
        });
      }
    };

    window.addEventListener('ws-message', handleWebSocketMessage as EventListener);
    return () => {
      window.removeEventListener('ws-message', handleWebSocketMessage as EventListener);
    };
  }, [addToast]);

  return null;
}
