// ============================================================================
// Notification Store - Zustand
// Gestion des notifications et alertes
// ============================================================================

import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  togglePanel: () => void;
  setOpen: (open: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,

  addNotification: (notification) =>
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        read: false,
      };

      const newNotifications = [newNotification, ...state.notifications];

      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter((n) => !n.read).length,
      };
    }),

  markAsRead: (id) =>
    set((state) => {
      const newNotifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );

      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter((n) => !n.read).length,
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  removeNotification: (id) =>
    set((state) => {
      const newNotifications = state.notifications.filter((n) => n.id !== id);

      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter((n) => !n.read).length,
      };
    }),

  clearAll: () =>
    set({
      notifications: [],
      unreadCount: 0,
    }),

  togglePanel: () =>
    set((state) => ({ isOpen: !state.isOpen })),

  setOpen: (open) =>
    set({ isOpen: open }),
}));
