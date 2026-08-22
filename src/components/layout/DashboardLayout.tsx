import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { KycBanner } from '@/components/auth/KycBanner';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@/stores/authStore';

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  /*
   * The scroll container is <main>, not the window.
   *
   * The shell used to be `min-h-screen` with the sidebar `lg:relative` inside
   * it, so the aside's height grew with the content and the whole document
   * scrolled — taking the navigation with it. Clicking a tab then jumped the
   * viewport, and on a long page the nav had scrolled off entirely.
   *
   * Now the shell is exactly the viewport, and only the content area scrolls.
   * The sidebar cannot move because there is nowhere for it to move to.
   */
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // The global ScrollToTop scrolls the window, which no longer scrolls here.
    // Reset the pane that actually does, so a new route starts at its top
    // without the page itself shifting.
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 text-surface-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        isMobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        userRole={user?.role ?? 'complainant'}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setMobileSidebarOpen((o) => !o)}
          userRole={user?.role ?? 'complainant'}
        />
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6"
        >
          {/*
            Sits above the routed content on every authenticated screen. A user
            who never completed verification previously had no way to connect
            that fact to their case sitting untouched.
          */}
          <div className="mb-4 empty:mb-0">
            <KycBanner />
          </div>

          {/*
            No AnimatePresence, and no exit animation, deliberately.

            This was `<AnimatePresence mode="wait">` with a 0.2s exit. `mode
            ="wait"` holds the incoming route until the outgoing one has
            finished animating away, so every tab click ran: fade the old page
            out over 200ms, show NOTHING, then mount the new page, then wait
            for its lazy chunk, then fade in over another 200ms.

            That mid-sequence nothing is the blank screen — it was guaranteed on
            every navigation regardless of network, and on a slow chunk the
            blank simply lasted longer. Removing the exit lets the new route
            mount immediately, so the Suspense spinner appears at once instead
            of after a void.

            The remaining fade starts at 0.6 rather than 0: content is legible
            the instant it mounts, and the animation only settles it.
          */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
