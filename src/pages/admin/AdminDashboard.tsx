import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  FileText,
  Home,
  Film,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { StatsCard, Card, CardHeader, CardContent, Button } from '@/components/ui';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { fetchPlatformStats, fetchMonthlyTrends } from '@/services/adminService';
import { fetchAuditLogs, describeAuditAction } from '@/services/auditService';
import type { AuditLogEntry } from '@/types';
import { fetchSecuritySummary } from '@/services/auditService';
import type { SecuritySummary } from '@/types';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';

const COLORS = ['#166534', '#15803d', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7'];

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeCases: 0,
    verifiedProperties: 0,
    publishedMedia: 0,
    totalRevenue: 0,
    pendingVerifications: 0,
  });
  const [casesOverTime, setCasesOverTime] = useState<{ month: string; count: number }[]>([]);
  const [casesByCategory, setCasesByCategory] = useState<{ name: string; count: number }[]>([]);
  const [userRoles, setUserRoles] = useState<{ name: string; value: number }[]>([]);
  const [revenueOverTime, setRevenueOverTime] = useState<{ month: string; amount: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [security, setSecurity] = useState<SecuritySummary | null>(null);

  /**
   * Dashboard figures come from SQL aggregates.
   *
   * This used to `select('*')` from profiles, cases, properties, media_reports,
   * payments and investigators and count them in JavaScript — shipping every
   * user's personal record to the browser to render six numbers, and falling over
   * in the low thousands of rows.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);

      const [statsResult, trendsResult, securityResult, auditResult] = await Promise.all([
        fetchPlatformStats(),
        fetchMonthlyTrends(6),
        fetchSecuritySummary(),
        fetchAuditLogs({ limit: 8 }),
      ]);

      if (cancelled) return;

      if (statsResult.error) toast.error(statsResult.error);

      const platform = statsResult.stats;
      if (platform) {
        setStats({
          totalUsers: platform.totalUsers,
          activeCases: platform.activeCases,
          verifiedProperties: platform.verifiedProperties,
          publishedMedia: platform.publishedMedia,
          totalRevenue: platform.totalPayments,
          pendingVerifications: platform.pendingVerifications,
        });

        setUserRoles(
          Object.entries(platform.usersByRole ?? {}).map(([name, value]) => ({
            name: name.replace(/_/g, ' '),
            value: Number(value),
          }))
        );

        setCasesByCategory(
          Object.entries(platform.casesByCategory ?? {}).map(([name, count]) => ({
            name: name.replace(/_/g, ' '),
            count: Number(count),
          }))
        );
      }

      setCasesOverTime(
        trendsResult.trends.map((t) => ({ month: t.month, count: t.cases }))
      );
      setRevenueOverTime(
        trendsResult.trends.map((t) => ({ month: t.month, amount: t.revenue }))
      );

      setSecurity(securityResult.summary);

      // Recent activity is the real audit trail now, not a slice of three
      // tables stitched together in the browser.
      setRecentActivity(auditResult.entries);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-12 w-12 rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-surface-900">Admin Dashboard</h1>

      {security && security.guardViolations24h > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-accent-200 bg-accent-50 p-4">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-accent-600" />
          <div className="text-sm text-accent-900">
            <p className="font-semibold mb-0.5">
              {security.guardViolations24h} blocked privileged write
              {security.guardViolations24h === 1 ? '' : 's'} in the last 24 hours
            </p>
            <p>
              Someone attempted to change a protected field — a role, a verification status, a
              published flag — directly against the API. The write was reverted, but this is a strong
              signal that an account is probing the platform.{' '}
              <button
                type="button"
                onClick={() => navigate('/app/admin/users')}
                className="underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 rounded"
              >
                Review user accounts
              </button>
            </p>
          </div>
        </div>
      )}

      {security && security.unconfirmedPrivilegedRoles > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            <strong>{security.unconfirmedPrivilegedRoles}</strong> account
            {security.unconfirmedPrivilegedRoles === 1 ? '' : 's'} hold a privileged role that has
            never been confirmed by an administrator. Review them in user management.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard icon={Users} label="Total Users" value={stats.totalUsers} variant="brand" />
        <StatsCard icon={FileText} label="Active Cases" value={stats.activeCases} variant="accent" />
        <StatsCard icon={Home} label="Verified Properties" value={stats.verifiedProperties} variant="success" />
        <StatsCard icon={Film} label="Published Media" value={stats.publishedMedia} variant="default" />
        <StatsCard
          icon={CreditCard}
          label="Total Revenue"
          value={`${stats.totalRevenue.toLocaleString()}`}
          variant="success"
        />
        <StatsCard
          icon={ShieldCheck}
          label="Pending Verifications"
          value={stats.pendingVerifications}
          variant="warning"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900">Cases Over Time</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={casesOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#166534" strokeWidth={2} dot={{ fill: '#166534' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900">Cases by Category</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={casesByCategory} margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#166534" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900">User Roles Distribution</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={userRoles}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {userRoles.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900">Revenue Over Time</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="amount" stroke="#166534" fill="#166534" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="font-semibold text-surface-900">Recent activity</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin/audit')}>
            View all <ArrowRight size={16} />
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-surface-100">
            {recentActivity.length === 0 && (
              <li className="py-6 text-sm text-surface-500">
                Nothing recorded yet. Case filings, verification decisions, role changes and payment
                settlements all appear here as they happen.
              </li>
            )}
            {recentActivity.map((entry, i) => (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'shrink-0 rounded px-2 py-0.5 text-xs font-medium capitalize',
                      entry.severity === 'critical' && 'bg-accent-100 text-accent-700',
                      entry.severity === 'warning' && 'bg-amber-100 text-amber-800',
                      entry.severity === 'notice' && 'bg-brand-100 text-brand-700',
                      entry.severity === 'info' && 'bg-surface-100 text-surface-600'
                    )}
                  >
                    {entry.resource_type.replace(/_/g, ' ')}
                  </span>
                  <span className="min-w-0 truncate text-surface-700">
                    {describeAuditAction(entry.action)}
                    {entry.actor_name ? ` — ${entry.actor_name}` : ''}
                  </span>
                </div>
                <span className="shrink-0 text-sm text-surface-500" title={format(new Date(entry.created_at), 'd MMM yyyy, HH:mm')}>
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </span>
              </motion.li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button icon={Plus} onClick={() => navigate('/app/admin/users')}>
          Manage Users
        </Button>
        <Button variant="outline" onClick={() => navigate('/app/admin/cases')}>
          Case Oversight
        </Button>
        <Button variant="outline" onClick={() => navigate('/app/admin/verifications')}>
          Verifications
        </Button>
        <Button variant="outline" onClick={() => navigate('/app/admin/payments')}>
          Payment Monitoring
        </Button>
      </div>
    </motion.div>
  );
}
