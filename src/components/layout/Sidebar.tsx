import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  Bell,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileText,
  PlusCircle,
  ClipboardList,
  ShieldCheck,
  Scale,
  Stethoscope,
  Home,
  Search,
  Building2,
  Upload,
  Users,
  Briefcase,
  Building,
  Film,
  CreditCard,
  CheckCircle2,
  BarChart3,
  X,
  DollarSign,
  MapPin,
  FileCheck,
  Microscope,
  Video,
  Clock,
  Library,
  Send,
  Heart,
  BookOpen,
  Sliders,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { UserRole } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const coreSection: NavSection = {
  title: 'Main',
  items: [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/messages', label: 'Messages', icon: MessageSquare },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
  ],
};

const accountSection: NavSection = {
  title: 'Account',
  items: [
    { to: '/app/payments', label: 'Payments', icon: CreditCard },
    { to: '/app/profile', label: 'Profile', icon: User },
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ],
};

const roleNavSections: Record<UserRole, NavSection[]> = {
  complainant: [
    {
      title: 'Cases',
      items: [
        { to: '/app/cases', label: 'My Cases', icon: FileText },
        { to: '/app/cases/new', label: 'Report a Case', icon: PlusCircle },
      ],
    },
  ],
  investigator: [
    {
      title: 'Investigations',
      items: [
        { to: '/app/cases/assigned', label: 'Assigned Cases', icon: ClipboardList },
        { to: '/app/cases/submit-report', label: 'Submit Reports', icon: FileCheck },
        { to: '/app/verification', label: 'Verification', icon: ShieldCheck },
      ],
    },
    {
      title: 'Work',
      items: [
        { to: '/app/availability', label: 'Availability', icon: MapPin },
        { to: '/app/earnings', label: 'Earnings', icon: DollarSign },
      ],
    },
  ],
  lawyer: [
    {
      title: 'Legal',
      items: [
        { to: '/app/cases', label: 'Legal Cases', icon: Scale },
        { to: '/app/legal-documents', label: 'Documents', icon: FolderOpen },
      ],
    },
    {
      title: 'Work',
      items: [
        { to: '/app/earnings', label: 'Earnings', icon: DollarSign },
      ],
    },
  ],
  medical_expert: [
    {
      title: 'Forensics',
      items: [
        { to: '/app/cases', label: 'Assigned Cases', icon: Stethoscope },
        { to: '/app/evidence-analysis', label: 'Evidence Analysis', icon: Microscope },
        { to: '/app/cases/submit-report', label: 'Upload Reports', icon: FileCheck },
      ],
    },
  ],
  witness: [
    {
      title: 'Cases',
      items: [
        { to: '/app/cases', label: 'My Cases', icon: FileText },
      ],
    },
  ],
  landlord: [
    {
      title: 'Property',
      items: [
        { to: '/app/property/landlord', label: 'My Properties', icon: Home },
        { to: '/app/property/create', label: 'Add Property', icon: PlusCircle },
        { to: '/app/property/requests', label: 'Tenant Requests', icon: Users },
        { to: '/app/property', label: 'Browse All', icon: Search },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/app/property/transactions', label: 'Transactions', icon: DollarSign },
      ],
    },
  ],
  tenant: [
    {
      title: 'Property',
      items: [
        { to: '/app/property', label: 'Find Property', icon: Search },
        { to: '/app/property/saved', label: 'Saved Properties', icon: Heart },
        { to: '/app/property/tenant', label: 'My Requests', icon: FileText },
        { to: '/app/property/verify', label: 'Verify Property', icon: ShieldCheck },
      ],
    },
  ],
  media_agent: [
    {
      title: 'Media',
      items: [
        { to: '/app/media/agent', label: 'My Dashboard', icon: LayoutDashboard },
        { to: '/app/media/institutions', label: 'Institutions', icon: Building2 },
        { to: '/app/media/record', label: 'Field Recording', icon: Video },
        { to: '/app/media/upload', label: 'Upload Report', icon: Upload },
        { to: '/app/media/activity', label: 'Activity Log', icon: Clock },
      ],
    },
  ],
  admin: [
    {
      title: 'Management',
      items: [
        { to: '/app/admin', label: 'Overview', icon: BarChart3 },
        { to: '/app/admin/users', label: 'Users', icon: Users },
        { to: '/app/admin/cases', label: 'Cases', icon: Briefcase },
        { to: '/app/admin/verifications', label: 'Verifications', icon: CheckCircle2 },
      ],
    },
    {
      title: 'Content',
      items: [
        { to: '/app/admin/properties', label: 'Properties', icon: Building },
        { to: '/app/admin/media', label: 'Media', icon: Film },
        { to: '/app/admin/media/library', label: 'Content Library', icon: Library },
        { to: '/app/admin/media/publish', label: 'Publish', icon: Send },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/app/admin/payments', label: 'Payments', icon: CreditCard },
        { to: '/app/admin/pricing', label: 'Pricing Control', icon: Sliders },
        { to: '/app/admin/analytics', label: 'Analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'Reports',
      items: [
        { to: '/app/admin/institution-reports', label: 'Institution Reports', icon: BookOpen },
      ],
    },
    {
      title: 'Fountain Source',
      items: [
        { to: '/app/admin/security-requests', label: 'Service Requests', icon: ShieldCheck },
      ],
    },
  ],
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  userRole: UserRole;
}

export function Sidebar({
  collapsed,
  onToggle,
  isMobileOpen,
  onMobileClose,
  userRole,
}: SidebarProps) {
  const location = useLocation();
  const roleSections = roleNavSections[userRole] ?? [];
  const allSections = [coreSection, ...roleSections, accountSection];

  const isActive = (path: string) => {
    if (path === '/app/dashboard') return location.pathname === '/app/dashboard';
    if (path === '/app/admin') return location.pathname === '/app/admin';
    return location.pathname.startsWith(path);
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.to);
    const Icon = item.icon;
    return (
      <li key={item.to}>
        <NavLink
          to={item.to}
          onClick={onMobileClose}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
            active
              ? 'bg-forest-50 text-forest-700 font-medium'
              : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
          )}
        >
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg p-1.5',
              active ? 'bg-forest-600 text-white' : 'bg-surface-100 text-surface-600'
            )}
          >
            <Icon size={16} />
          </span>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                key="label"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="truncate"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>
      </li>
    );
  };

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-surface-200',
          'lg:relative lg:z-auto',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64',
          isMobileOpen ? 'w-64' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-surface-200 px-4">
          <NavLink to="/app/dashboard" className="flex items-center gap-3 overflow-hidden">
            <img src="/assets/logo.png" alt="" className="h-10 w-10 shrink-0 object-contain" />
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.div
                  key="brand"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <span className="font-semibold text-surface-900 text-sm">The Security Watch</span>
                  <p className="text-[10px] text-surface-500">...your concern</p>
                </motion.div>
              )}
            </AnimatePresence>
          </NavLink>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onMobileClose}
              className="lg:hidden p-2 rounded-lg text-surface-500 hover:bg-surface-100"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="hidden lg:flex p-2 rounded-lg text-surface-500 hover:bg-surface-100"
              aria-label={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {allSections.map((section, idx) => (
            <div key={section.title} className={cn(idx > 0 && 'mt-4')}>
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.p
                    key={`section-${section.title}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-surface-400"
                  >
                    {section.title}
                  </motion.p>
                )}
              </AnimatePresence>
              {collapsed && idx > 0 && (
                <div className="mx-3 mb-2 border-t border-surface-200" />
              )}
              <ul className="space-y-0.5">
                {section.items.map(renderNavItem)}
              </ul>
            </div>
          ))}
        </nav>
      </motion.aside>
    </>
  );
}
