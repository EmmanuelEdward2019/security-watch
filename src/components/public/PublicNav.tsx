import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';

const navLinks = [
  { to: '/', label: 'Home' },
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
  { to: '/about', label: 'About' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
];

export function PublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

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
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((item) =>
              'children' in item ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(item.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    className={cn(
                      'flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
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
                  to={item.to}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive(item.to) ? 'text-forest-600 bg-forest-50' : 'text-surface-600 hover:text-forest-600 hover:bg-surface-50'
                  )}
                >
                  {item.label}
                </Link>
              )
            )}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-forest-600 hover:bg-forest-700 text-white">
                Get started
              </Button>
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-lg text-surface-600 hover:bg-surface-100"
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
            className="lg:hidden border-t border-surface-200 bg-white"
          >
            <div className="px-4 py-4 space-y-2 max-h-[70vh] overflow-y-auto">
              {navLinks.map((item) =>
                'children' in item ? (
                  <div key={item.label}>
                    <p className="px-3 py-2 text-xs font-semibold text-surface-500 uppercase">{item.label}</p>
                    {(item.children ?? []).map((child) => (
                      <Link
                        key={child.to}
                        to={child.to}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'block px-4 py-2 text-sm rounded-lg',
                          isActive(child.to) ? 'text-forest-600 bg-forest-50' : 'text-surface-600'
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'block px-4 py-2 text-sm font-medium rounded-lg',
                      isActive(item.to) ? 'text-forest-600 bg-forest-50' : 'text-surface-600'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              )}
              <div className="pt-4 flex gap-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">Sign in</Button>
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="flex-1">
                  <Button size="sm" className="w-full bg-forest-600 hover:bg-forest-700 text-white">Get started</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
