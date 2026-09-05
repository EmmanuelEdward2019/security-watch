import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, LogIn, UserPlus } from 'lucide-react';
import { cn } from '@/utils/cn';

interface NavChild {
  to: string;
  label: string;
}

interface NavLink {
  to?: string;
  label: string;
  children?: NavChild[];
}

/*
 * No "Home" entry. The wordmark to the left of this nav already goes home —
 * that is the convention everywhere — so the slot was costing a row of
 * wrapping for a link people already know how to reach.
 *
 * About leads instead: it is the first thing someone assessing whether to
 * trust a platform like this actually wants.
 */
const navLinks: NavLink[] = [
  { to: '/about', label: 'About' },
  {
    label: 'Services',
    children: [
      { to: '/services/investigations', label: 'Investigations' },
      { to: '/services/property', label: 'Property Verification' },
      { to: '/services/transparency', label: 'Institutional Transparency' },
      { to: '/fountain-source', label: 'Fountain Source Security' },
    ],
  },
  { to: '/how-it-works', label: 'How It Works' },
  {
    label: 'Resources',
    children: [
      { to: '/property', label: 'Property Listings' },
      { to: '/media', label: 'Media & Reports' },
      { to: '/reports', label: 'Reports & Insights' },
      { to: '/blog', label: 'Blog' },
      { to: '/faqs', label: 'FAQs' },
    ],
  },
  {
    label: 'Join Us',
    children: [
      { to: '/become-agent', label: 'Become an Agent' },
      { to: '/partners', label: 'Partner With Us' },
    ],
  },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
];

export function PublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [expandedMobile, setExpandedMobile] = useState<string | null>(null);
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const toggleMobileSubmenu = (label: string) => {
    setExpandedMobile((prev) => (prev === label ? null : label));
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-surface-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link to="/" className="flex items-center gap-3">
            <img src="/assets/logo.png" alt="The Security Watch" className="h-10 w-10 lg:h-12 lg:w-12 object-contain" />
            <div>
              <span className="font-semibold text-forest-700 text-sm lg:text-base">The Security Watch</span>
              <p className="text-[10px] lg:text-xs text-surface-500 hidden sm:block">...your concern</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          {/*
            xl, not lg, and flex-nowrap.

            Seven items plus the wordmark and two calls to action do not fit in
            1024px, which is why the row was breaking onto a second line. Rather
            than let it wrap, the full nav now appears only where it genuinely
            fits and the (already complete) mobile menu covers everything below
            that. min-w-0 lets the row shrink before anything overflows.
          */}
          <div className="hidden min-w-0 flex-nowrap items-center gap-1 xl:flex">
            {navLinks.map((item) =>
              item.children ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(item.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    className={cn(
                      'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      openDropdown === item.label ? 'text-forest-600 bg-forest-50' : 'text-surface-600 hover:text-forest-600 hover:bg-surface-50'
                    )}
                  >
                    {item.label}
                    <ChevronDown className={cn('w-4 h-4 transition-transform', openDropdown === item.label && 'rotate-180')} />
                  </button>
                  <AnimatePresence>
                    {openDropdown === item.label && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 mt-1 py-2 w-48 bg-white rounded-xl shadow-lg border border-surface-200"
                      >
                        {(item.children ?? []).map((child) => (
                          <Link
                            key={child.to}
                            to={child.to}
                            className={cn(
                              'block px-4 py-2 text-sm transition-colors',
                              isActive(child.to) ? 'text-forest-600 font-medium bg-forest-50' : 'text-surface-600 hover:bg-surface-50'
                            )}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  key={item.to}
                  to={item.to!}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.to!) ? 'text-forest-600 bg-forest-50' : 'text-surface-600 hover:text-forest-600 hover:bg-surface-50'
                  )}
                >
                  {item.label}
                </Link>
              )
            )}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden shrink-0 items-center gap-3 xl:flex">
            <Link to="/login">
              <button className="group relative inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-forest-700 rounded-xl border-2 border-forest-200 bg-white hover:bg-forest-50 hover:border-forest-300 transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap">
                <LogIn className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                Sign in
              </button>
            </Link>
            <Link to="/register">
              <button className="group relative inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-forest-600 hover:bg-forest-700 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-forest-500/25 whitespace-nowrap">
                <UserPlus className="w-4 h-4 transition-transform group-hover:scale-110" />
                Get started
              </button>
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="xl:hidden p-2 rounded-lg text-surface-600 hover:bg-surface-100"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="xl:hidden border-t border-surface-200 bg-white overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1 max-h-[75vh] overflow-y-auto">
              {navLinks.map((item) =>
                item.children ? (
                  <div key={item.label}>
                    {/* Collapsible parent */}
                    <button
                      onClick={() => toggleMobileSubmenu(item.label)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                        expandedMobile === item.label
                          ? 'text-forest-700 bg-forest-50'
                          : 'text-surface-700 hover:bg-surface-50'
                      )}
                    >
                      {item.label}
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 text-surface-400 transition-transform duration-200',
                          expandedMobile === item.label && 'rotate-180 text-forest-600'
                        )}
                      />
                    </button>

                    {/* Collapsible children */}
                    <AnimatePresence>
                      {expandedMobile === item.label && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="ml-3 pl-3 border-l-2 border-forest-100 space-y-0.5 py-1">
                            {(item.children ?? []).map((child) => (
                              <Link
                                key={child.to}
                                to={child.to}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                  'block px-3 py-2 text-sm rounded-lg transition-colors',
                                  isActive(child.to)
                                    ? 'text-forest-600 font-medium bg-forest-50'
                                    : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                                )}
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    key={item.to}
                    to={item.to!}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'block px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      isActive(item.to!) ? 'text-forest-600 bg-forest-50' : 'text-surface-700 hover:bg-surface-50'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              )}

              {/* Mobile Auth Buttons — premium design */}
              <div className="pt-4 mt-3 border-t border-surface-100 space-y-2.5">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2.5 w-full px-4 py-3 text-sm font-semibold text-forest-700 rounded-xl border-2 border-forest-200 bg-white hover:bg-forest-50 active:bg-forest-100 transition-all duration-200 shadow-sm"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2.5 w-full px-4 py-3.5 text-sm font-semibold text-white rounded-xl bg-forest-600 hover:bg-forest-700 active:bg-forest-800 transition-all duration-200 shadow-md"
                >
                  <UserPlus className="w-4 h-4" />
                  Get started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
