import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  FileText,
  Home,
  Film,
  CreditCard,
  ShieldCheck,
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
import { supabase } from '@/lib/supabase';
import { format, subMonths } from 'date-fns';
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
  const [recentActivity, setRecentActivity] = useState<{ type: string; title: string; date: string; id?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: profiles } = await supabase.from('profiles').select('*');
        const { data: cases } = await supabase.from('cases').select('*');
        const { data: properties } = await supabase.from('properties').select('*');
        const { data: media } = await supabase.from('media_reports').select('*');
        const { data: payments } = await supabase.from('payments').select('*');
        const { data: investigators } = await supabase.from('investigators').select('*');

        const totalUsers = profiles?.length ?? 0;
        const activeCases = cases?.filter((c) => !['completed', 'closed'].includes(c.status)).length ?? 0;
        const verifiedProperties = properties?.filter((p) => p.status === 'verified').length ?? 0;
        const publishedMedia = media?.filter((m) => m.status === 'published').length ?? 0;
        const totalRevenue = payments?.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0) ?? 0;
        const pendingVerifications = investigators?.filter((i) => i.verification_status === 'pending').length ?? 0;

        setStats({
          totalUsers,
          activeCases,
          verifiedProperties,
          publishedMedia,
          totalRevenue,
          pendingVerifications,
        });

        const rolesCount: Record<string, number> = {};
        profiles?.forEach((p) => {
          rolesCount[p.role] = (rolesCount[p.role] ?? 0) + 1;
        });
        setUserRoles(
          Object.entries(rolesCount).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
        );

        const categoryCount: Record<string, number> = {};
        cases?.forEach((c) => {
          categoryCount[c.category] = (categoryCount[c.category] ?? 0) + 1;
        });
        setCasesByCategory(
          Object.entries(categoryCount).map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }))
        );

        const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
        const casesByMonth = months.map((m) => ({
          month: format(m, 'MMM'),
          count: cases?.filter((c) => {
            const d = new Date(c.created_at);
            return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
          }).length ?? 0,
        }));
        setCasesOverTime(casesByMonth);

        const revenueByMonth = months.map((m) => {
          const completed = payments?.filter((p) => p.status === 'completed') ?? [];
          const inMonth = completed.filter((p) => {
            const d = new Date(p.created_at);
            return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
          });
          return { month: format(m, 'MMM'), amount: inMonth.reduce((s, p) => s + p.amount, 0) };
        });
        setRevenueOverTime(revenueByMonth);

        const activities: { type: string; title: string; date: string; id?: string }[] = [];
        cases?.slice(0, 3).forEach((c) => {
          activities.push({ type: 'case', title: c.title, date: c.created_at, id: c.id });
        });
        payments?.slice(0, 2).forEach((p) => {
          activities.push({
            type: 'payment',
            title: `${p.currency} ${p.amount} - ${p.description}`,
            date: p.created_at,
          });
        });
        profiles?.slice(0, 2).forEach((p) => {
          activities.push({
            type: 'user',
            title: `${p.full_name} joined`,
            date: p.created_at,
          });
        });
        activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecentActivity(activities.slice(0, 8));
      } finally {
        setLoading(false);
      }
    }
    load();
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
          <h2 className="font-semibold text-surface-900">Recent Activity</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin/cases')}>
            View all <ArrowRight size={16} />
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-surface-100">
            {recentActivity.map((a, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium capitalize',
                      a.type === 'case' && 'bg-brand-100 text-brand-700',
                      a.type === 'payment' && 'bg-green-100 text-green-700',
                      a.type === 'user' && 'bg-sky-100 text-sky-700'
                    )}
                  >
                    {a.type}
                  </span>
                  <span className="text-surface-700 truncate max-w-[200px]">{a.title}</span>
                </div>
                <span className="text-sm text-surface-500">{format(new Date(a.date), 'MMM d, HH:mm')}</span>
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
