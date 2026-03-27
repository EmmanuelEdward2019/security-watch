import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, AlertTriangle, CheckCircle2, XCircle, CheckCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { Button, EmptyState } from '@/components/ui';
import type { Notification } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';

const typeIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
};

const typeColors = {
  info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700',
  success: 'bg-green-100 text-green-700',
  error: 'bg-accent-100 text-accent-700',
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (user) fetchNotifications(user.user_id);
  }, [user, fetchNotifications]);

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-surface-900">Notifications</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === 'all' ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === 'unread' ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
            )}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={CheckCheck}
              onClick={() => user && markAllAsRead(user.user_id)}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Info}
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
          description="You're all caught up!"
        />
      ) : (
        <ul className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((n, i) => {
              const Icon = typeIcons[n.type];
              return (
                <motion.li
                  key={n.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
                    n.read ? 'bg-white border-surface-200 hover:border-surface-300' : 'bg-brand-50/50 border-brand-200 hover:border-brand-300'
                  )}
                >
                  <div
                    className={cn(
                      'p-2 rounded-lg shrink-0',
                      typeColors[n.type]
                    )}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-medium', !n.read && 'text-surface-900')}>{n.title}</p>
                    <p className="text-sm text-surface-600 mt-0.5">{n.message}</p>
                    <p className="text-xs text-surface-500 mt-2">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </motion.div>
  );
}
