import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  PlusCircle,
  ClipboardList,
  ShieldCheck,
  Scale,
  Home,
  Search,
  Film,
  Upload,
  ArrowRight,
  Bell,
  DollarSign,
  Building2,
  Eye,
  Stethoscope,
  MapPin,
  Users,
  Video,
  Heart,
} from 'lucide-react';
import { StatsCard, Card, CardHeader, CardContent, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useCaseStore } from '@/stores/caseStore';
import { usePropertyStore } from '@/stores/propertyStore';
import { useMediaStore } from '@/stores/mediaStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { CASE_STATUS_LABELS } from '@/types';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

interface QuickAction {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  to: string;
  color: string;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { cases, fetchCases } = useCaseStore();
  const { properties, fetchProperties } = usePropertyStore();
  const { mediaReports, fetchMediaReports } = useMediaStore();
  const { notifications, fetchNotifications } = useNotificationStore();

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/app/admin', { replace: true });
      return;
    }
    if (user?.user_id) {
      fetchCases(user.user_id, user.role);
      fetchNotifications(user.user_id);
      if (user.role === 'landlord') fetchProperties(user.user_id);
      if (user.role === 'media_agent') fetchMediaReports({ reporterId: user.user_id });
    }
  }, [user, navigate, fetchCases, fetchProperties, fetchMediaReports, fetchNotifications]);

  if (user?.role === 'admin') return null;

  const myCases = cases.filter((c) => c.complainant_id === user?.user_id);
  const assignedCases = cases.filter((c) => c.assigned_investigator_id === user?.user_id);
  const activeCases = myCases.filter((c) => !['completed', 'closed'].includes(c.status));
  const myProperties = properties.filter((p) => p.owner_id === user?.user_id);
  const myReports = mediaReports;
  const recentNotifications = notifications.slice(0, 5);

  /*
   * Derived from data this page already holds, rather than hardcoded.
   *
   * Several figures below were literal `0`s. That is not a placeholder, it is a
   * false statement: a media agent who had filed reports against four
   * institutions was shown "Institutions Visited: 0". The remaining ones that
   * genuinely have no source yet show "--", which at least says "unknown"
   * rather than asserting nothing happened.
   */
  const institutionsVisited = new Set(
    myReports.map((r) => r.institution_id).filter(Boolean)
  ).size;

  const quickActions: Record<string, QuickAction[]> = {
    complainant: [
      { label: 'Report a Case', icon: PlusCircle, to: '/app/cases/new', color: 'bg-forest-600' },
      { label: 'View My Cases', icon: FileText, to: '/app/cases', color: 'bg-blue-600' },
      { label: 'Messages', icon: Bell, to: '/app/messages', color: 'bg-amber-600' },
    ],
    witness: [
      { label: 'View Cases', icon: FileText, to: '/app/cases', color: 'bg-forest-600' },
      { label: 'Messages', icon: Bell, to: '/app/messages', color: 'bg-blue-600' },
    ],
    investigator: [
      { label: 'View Assigned', icon: ClipboardList, to: '/app/cases/assigned', color: 'bg-forest-600' },
      { label: 'Submit Report', icon: FileText, to: '/app/cases/submit-report', color: 'bg-blue-600' },
      { label: 'Set Availability', icon: MapPin, to: '/app/availability', color: 'bg-amber-600' },
      { label: 'View Earnings', icon: DollarSign, to: '/app/earnings', color: 'bg-emerald-600' },
    ],
    lawyer: [
      { label: 'Legal Cases', icon: Scale, to: '/app/cases', color: 'bg-forest-600' },
      { label: 'Upload Documents', icon: FileText, to: '/app/legal-documents', color: 'bg-blue-600' },
      { label: 'View Earnings', icon: DollarSign, to: '/app/earnings', color: 'bg-emerald-600' },
    ],
    medical_expert: [
      { label: 'Assigned Cases', icon: Stethoscope, to: '/app/cases', color: 'bg-forest-600' },
      { label: 'Evidence Analysis', icon: Eye, to: '/app/evidence-analysis', color: 'bg-blue-600' },
      { label: 'Upload Reports', icon: Upload, to: '/app/cases/submit-report', color: 'bg-amber-600' },
    ],
    landlord: [
      { label: 'My Properties', icon: Home, to: '/app/property/landlord', color: 'bg-forest-600' },
      { label: 'Add Property', icon: PlusCircle, to: '/app/property/create', color: 'bg-blue-600' },
      { label: 'Tenant Requests', icon: Users, to: '/app/property/requests', color: 'bg-amber-600' },
      { label: 'Transactions', icon: DollarSign, to: '/app/property/transactions', color: 'bg-emerald-600' },
    ],
    tenant: [
      { label: 'Find Property', icon: Search, to: '/app/property', color: 'bg-forest-600' },
      { label: 'Saved Properties', icon: Heart, to: '/app/property/saved', color: 'bg-blue-600' },
      { label: 'My Requests', icon: FileText, to: '/app/property/tenant', color: 'bg-amber-600' },
      { label: 'Verify Property', icon: ShieldCheck, to: '/app/property/verify', color: 'bg-emerald-600' },
    ],
    media_agent: [
      { label: 'My Dashboard', icon: Film, to: '/app/media/agent', color: 'bg-forest-600' },
      { label: 'Field Recording', icon: Video, to: '/app/media/record', color: 'bg-blue-600' },
      { label: 'Upload Report', icon: Upload, to: '/app/media/upload', color: 'bg-amber-600' },
      { label: 'Institutions', icon: Building2, to: '/app/media/institutions', color: 'bg-emerald-600' },
    ],
  };

  const userQuickActions = quickActions[user?.role ?? 'complainant'] ?? [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">
          Welcome back, {(user?.full_name ?? '').split(' ')[0]}
        </h1>
        <p className="text-surface-500 mt-1">Here&apos;s what&apos;s happening with your account.</p>
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {userQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.to}
                onClick={() => navigate(action.to)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-surface-200 hover:shadow-md hover:border-forest-200 transition-all group"
              >
                <div className={`w-10 h-10 rounded-lg ${action.color} text-white flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon size={20} />
                </div>
                <span className="text-xs font-medium text-surface-700 text-center">{action.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Role-specific stats */}
      {(user?.role === 'complainant' || user?.role === 'witness') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard icon={FileText} label="My Cases" value={myCases.length} variant="sky" />
          <StatsCard icon={ClipboardList} label="Active Cases" value={activeCases.length} variant="warning" />
        </div>
      )}

      {user?.role === 'investigator' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard icon={ClipboardList} label="Assigned Cases" value={assignedCases.length} variant="sky" />
          <StatsCard icon={ShieldCheck} label="Under Investigation" value={assignedCases.filter((c) => c.status === 'investigating').length} variant="warning" />
          <StatsCard icon={DollarSign} label="Pending Payout" value="--" variant="teal" />
        </div>
      )}

      {user?.role === 'lawyer' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard icon={Scale} label="Legal Cases" value={assignedCases.length} variant="sky" />
          <StatsCard icon={DollarSign} label="Earnings" value="--" variant="teal" />
        </div>
      )}

      {user?.role === 'medical_expert' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard icon={Stethoscope} label="Assigned Cases" value={assignedCases.length} variant="sky" />
          <StatsCard icon={Eye} label="Pending Analysis" value="--" variant="warning" />
        </div>
      )}

      {user?.role === 'landlord' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard icon={Home} label="My Properties" value={myProperties.length} variant="violet" />
          <StatsCard icon={Users} label="Tenant Requests" value="--" variant="warning" />
          <StatsCard icon={DollarSign} label="Revenue" value="--" variant="teal" />
        </div>
      )}

      {user?.role === 'tenant' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard icon={Heart} label="Saved Properties" value="--" variant="rose" />
          <StatsCard icon={FileText} label="My Requests" value="--" variant="sky" />
        </div>
      )}

      {user?.role === 'media_agent' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard icon={Film} label="My Reports" value={myReports.length} variant="violet" />
          <StatsCard icon={Building2} label="Institutions Visited" value={institutionsVisited} variant="sky" />
        </div>
      )}

      {/* Two-column layout: Recent Activity + Notifications */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="font-semibold text-surface-900">Recent Activity</h2>
          </CardHeader>
          <CardContent>
            {(user?.role === 'complainant' || user?.role === 'witness') && (
              myCases.length === 0 ? (
                <p className="text-surface-500 py-6 text-center">No cases yet. Create your first case to get started.</p>
              ) : (
                <ul className="divide-y divide-surface-100">
                  {myCases.slice(0, 5).map((c) => (
                    <motion.li
                      key={c.id}
                      variants={itemVariants}
                      className="flex items-center justify-between py-3 cursor-pointer hover:bg-surface-50 -mx-2 px-2 rounded-lg"
                      onClick={() => navigate(`/app/cases/${c.id}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">{c.title}</p>
                        <p className="text-xs text-surface-500">{CASE_STATUS_LABELS[c.status]}</p>
                      </div>
                      <ArrowRight size={16} className="text-surface-400" />
                    </motion.li>
                  ))}
                </ul>
              )
            )}

            {user?.role === 'investigator' && (
              assignedCases.length === 0 ? (
                <p className="text-surface-500 py-6 text-center">No assigned cases.</p>
              ) : (
                <ul className="divide-y divide-surface-100">
                  {assignedCases.slice(0, 5).map((c) => (
                    <motion.li
                      key={c.id}
                      variants={itemVariants}
                      className="flex items-center justify-between py-3 cursor-pointer hover:bg-surface-50 -mx-2 px-2 rounded-lg"
                      onClick={() => navigate(`/app/cases/${c.id}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">{c.title}</p>
                        <p className="text-xs text-surface-500">{CASE_STATUS_LABELS[c.status]}</p>
                      </div>
                      <ArrowRight size={16} className="text-surface-400" />
                    </motion.li>
                  ))}
                </ul>
              )
            )}

            {(user?.role === 'lawyer' || user?.role === 'medical_expert') && (
              <p className="text-surface-500 py-6 text-center">No active cases assigned yet.</p>
            )}

            {user?.role === 'landlord' && (
              myProperties.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-surface-500 mb-3">No properties listed yet.</p>
                  <Button size="sm" onClick={() => navigate('/app/property/create')}>Add Property</Button>
                </div>
              ) : (
                <ul className="divide-y divide-surface-100">
                  {myProperties.slice(0, 5).map((p) => (
                    <motion.li
                      key={p.id}
                      variants={itemVariants}
                      className="flex items-center justify-between py-3 cursor-pointer hover:bg-surface-50 -mx-2 px-2 rounded-lg"
                      onClick={() => navigate(`/app/property/${p.id}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">{p.title}</p>
                        <p className="text-xs text-surface-500">{p.status}</p>
                      </div>
                      <ArrowRight size={16} className="text-surface-400" />
                    </motion.li>
                  ))}
                </ul>
              )
            )}

            {user?.role === 'tenant' && (
              <div className="py-6 text-center">
                <p className="text-surface-500 mb-3">Browse verified properties to find your next home.</p>
                <Button size="sm" onClick={() => navigate('/app/property')}>Browse Properties</Button>
              </div>
            )}

            {user?.role === 'media_agent' && (
              myReports.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-surface-500 mb-3">No reports yet.</p>
                  <Button size="sm" onClick={() => navigate('/app/media/upload')}>Upload Report</Button>
                </div>
              ) : (
                <ul className="divide-y divide-surface-100">
                  {myReports.slice(0, 5).map((r) => (
                    <motion.li key={r.id} variants={itemVariants} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-sm">{r.title}</p>
                        <p className="text-xs text-surface-500">{r.status}</p>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="font-semibold text-surface-900">Notifications</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/app/notifications')}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {recentNotifications.length === 0 ? (
              <p className="text-surface-500 py-6 text-center">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-surface-100">
                {recentNotifications.map((n) => (
                  <li
                    key={n.id}
                    className="py-3 cursor-pointer hover:bg-surface-50 -mx-2 px-2 rounded-lg"
                    onClick={() => n.link && navigate(n.link)}
                  >
                    <p className={`text-sm ${n.read ? 'text-surface-600' : 'font-medium text-surface-900'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-surface-500 mt-0.5 truncate">{n.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
