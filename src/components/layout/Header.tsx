import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, ChevronDown, LogOut, User, Settings, X } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { cn } from '@/utils/cn';
import type { UserRole } from '@/types';

interface HeaderProps {
  onMenuClick: () => void;
  userRole: UserRole;
}

const roleLabels: Record<UserRole, string> = {
  complainant: 'Client',
  investigator: 'Investigator',
  lawyer: 'Lawyer',
  medical_expert: 'Expert',
  witness: 'Witness',
  landlord: 'Landlord',
  tenant: 'Tenant',
  media_agent: 'Media Agent',
  admin: 'Admin',
};

export function Header({ onMenuClick, userRole }: HeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // `sticky top-0` did the pinning when the window scrolled. <main> owns the
  // scroll now and this sits outside it, so sticky would be inert — the header
  // just needs to refuse to compress.
  return (
    <header className="z-40 h-16 shrink-0 bg-white/95 backdrop-blur-sm border-b border-surface-200">
      <div className="h-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center justify-between gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-surface-500 hover:bg-surface-100"
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search cases, properties..."
                className="w-full bg-surface-50 border border-surface-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                onClick={() => setIsSearchOpen(true)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="md:hidden p-2 rounded-lg text-surface-500 hover:bg-surface-100"
            >
              <Search size={18} />
            </button>

            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 rounded-lg text-surface-500 hover:bg-surface-100"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-accent-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-80 bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden z-50"
                  >
                    <div className="flex items-center justify-between p-4 border-b border-surface-200">
                      <h3 className="font-semibold text-surface-900">Notifications</h3>
                      <button
                        onClick={() => user?.user_id && markAllAsRead(user.user_id)}
                        className="text-sm text-forest-600 hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-surface-500">
                          <p>No notifications yet</p>
                        </div>
                      ) : (
                        notifications.slice(0, 5).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              markAsRead(n.id);
                              setIsNotificationsOpen(false);
                              if (n.link) navigate(n.link);
                            }}
                            className={cn(
                              'w-full text-left p-4 border-b border-surface-100 hover:bg-surface-50',
                              !n.read && 'bg-forest-50/50'
                            )}
                          >
                            <p className={cn('text-sm', !n.read ? 'font-medium text-surface-900' : 'text-surface-600')}>
                              {n.title}
                            </p>
                            <p className="text-xs text-surface-500 mt-0.5 truncate">{n.message}</p>
                          </button>
                        ))
                      )}
                    </div>
                    <Link
                      to="/app/notifications"
                      onClick={() => setIsNotificationsOpen(false)}
                      className="block p-3 text-center text-sm text-forest-600 hover:bg-surface-50"
                    >
                      View all
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-100"
              >
                <Avatar src={user?.avatar_url} name={user?.full_name || 'User'} size="sm" />
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-surface-900 truncate max-w-[100px]">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-surface-500">{roleLabels[userRole]}</p>
                </div>
                <ChevronDown size={14} className="text-surface-500" />
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-56 bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-surface-200">
                      <p className="font-semibold text-surface-900">{user?.full_name || 'User'}</p>
                      <p className="text-xs text-surface-500">{user?.email}</p>
                    </div>
                    <div className="py-2">
                      <Link
                        to="/app/profile"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-surface-600 hover:bg-surface-50"
                      >
                        <User size={16} />
                        Profile
                      </Link>
                      <Link
                        to="/app/settings"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-surface-600 hover:bg-surface-50"
                      >
                        <Settings size={16} />
                        Settings
                      </Link>
                    </div>
                    <div className="border-t border-surface-200 py-2">
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-accent-600 hover:bg-accent-50"
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/20 flex items-start justify-center pt-24"
            onClick={() => setIsSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-xl bg-white rounded-xl shadow-xl mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 p-4 border-b border-surface-200">
                <Search className="w-5 h-5 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="flex-1 text-lg outline-none"
                  autoFocus
                />
                <button onClick={() => setIsSearchOpen(false)} className="p-2 rounded-lg hover:bg-surface-100">
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
