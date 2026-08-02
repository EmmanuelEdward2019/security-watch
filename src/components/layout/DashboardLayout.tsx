import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { KycBanner } from '@/components/auth/KycBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@/stores/authStore';

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-screen bg-surface-50 text-surface-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        isMobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        userRole={user?.role ?? 'complainant'}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          onMenuClick={() => setMobileSidebarOpen((o) => !o)}
          userRole={user?.role ?? 'complainant'}
        />
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {/*
            Sits above the routed content on every authenticated screen. A user
            who never completed verification previously had no way to connect
            that fact to their case sitting untouched.
          */}
          <div className="mb-4 empty:mb-0">
            <KycBanner />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
