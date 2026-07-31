import { create } from 'zustand';
import type { Notification } from '@/types';
import { supabase } from '@/lib/supabase';

/**
 * Notifications — read and acknowledge only.
 *
 * `createNotification` is gone. Any authenticated user could previously insert a
 * notification, and client INSERT has since been revoked: notifications are
 * raised by the SECURITY DEFINER RPCs and edge functions that perform the
 * underlying action, so the inbox cannot be spammed or spoofed.
 */
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  channel: ReturnType<typeof supabase.channel> | null;

  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  subscribeToNotifications: (userId: string) => void;
  unsubscribe: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  channel: null,

  fetchNotifications: async (userId) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      set({ error: error.message });
      return;
    }
    {
      const notifications = (data ?? []) as Notification[];
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      });
    }
  },

  markAsRead: async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: async (userId) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  subscribeToNotifications: (userId) => {
    const existing = get().channel;
    if (existing) void supabase.removeChannel(existing);

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          set((state) => ({
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }));
        }
      )
      .subscribe();

    set({ channel });
  },

  unsubscribe: () => {
    const channel = get().channel;
    if (channel) {
      void supabase.removeChannel(channel);
      set({ channel: null });
    }
  },
}));
