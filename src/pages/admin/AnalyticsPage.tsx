import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { Card, CardHeader, CardContent, Button } from '@/components/ui';
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
import { fetchPlatformStats, fetchMonthlyTrends, fetchInstitutionRankings } from '@/services/adminService';
import { format, subMonths, differenceInCalendarMonths } from 'date-fns';
import toast from 'react-hot-toast';

const COLORS = ['#166534', '#15803d', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7'];

export function AnalyticsPage() {
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 6), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [casesByStatus, setCasesByStatus] = useState<{ name: string; value: number }[]>([]);
  const [casesTrend, setCasesTrend] = useState<{ month: string; count: number }[]>([]);
  const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; amount: number }[]>([]);
  const [userGrowth, setUserGrowth] = useState<{ month: string; count: number }[]>([]);
  const [propertyTrend, setPropertyTrend] = useState<{ month: string; count: number }[]>([]);
  const [mediaByInstitution, setMediaByInstitution] = useState<{ name: string; count: number }[]>([]);
  const [topInstitutions, setTopInstitutions] = useState<{ name: string; score: number }[]>([]);

  /**
   * Analytics from SQL aggregates.
   *
   * This used to pull the whole of cases, payments, profiles, properties,
   * media_reports and performance_scores into the browser on every date change,
   * then bucket them in JavaScript. The aggregates now run in Postgres and only
   * the plotted numbers cross the wire.
   */
  const loadAnalytics = useCallback(async () => {
    setLoading(true);

    const monthSpan = Math.max(
      1,
      Math.min(
        24,
        differenceInCalendarMonths(new Date(dateTo), new Date(dateFrom)) + 1
      )
    );

    const [statsResult, trendsResult, rankingsResult] = await Promise.all([
      fetchPlatformStats(),
      fetchMonthlyTrends(monthSpan),
      fetchInstitutionRankings(),
    ]);

    if (statsResult.error) toast.error(statsResult.error);

    const platform = statsResult.stats;
    if (platform) {
      setCasesByStatus(
        Object.entries(platform.casesByStatus ?? {}).map(([name, value]) => ({
          name: name.replace(/_/g, ' '),
          value: Number(value),
        }))
      );
    }

    setCasesTrend(trendsResult.trends.map((t) => ({ month: t.month, count: t.cases })));
    setRevenueByMonth(trendsResult.trends.map((t) => ({ month: t.month, amount: t.revenue })));
    setUserGrowth(trendsResult.trends.map((t) => ({ month: t.month, count: t.users })));
    setPropertyTrend(trendsResult.trends.map((t) => ({ month: t.month, count: t.properties })));

    const ranked = rankingsResult.rankings;
    setMediaByInstitution(
      ranked
        .filter((r) => r.published_reports > 0)
        .slice(0, 8)
        .map((r) => ({ name: r.name, count: r.published_reports }))
    );
    setTopInstitutions(
      ranked
        .filter((r) => r.evaluations > 0)
        .slice(0, 8)
        .map((r) => ({ name: r.name, score: r.avg_score }))
    );

    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const handleExport = () => {
    const data = {
      dateRange: { from: dateFrom, to: dateTo },
      casesByStatus,
      casesTrend,
      revenueByMonth,
      userGrowth,
      propertyTrend,
      mediaByInstitution,
      topInstitutions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateFrom}-${dateTo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-surface-900">Analytics</h1>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-surface-300 px-3 py-2 text-sm"
          />
          <span className="text-surface-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-surface-300 px-3 py-2 text-sm"
          />
          <Button variant="outline" icon={Download} onClick={handleExport}>
            Export
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900">Cases by Status</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={casesByStatus}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {casesByStatus.map((_, i) => (
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
            <h2 className="font-semibold text-surface-900">Cases Trend</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={casesTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
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
            <h2 className="font-semibold text-surface-900">Revenue by Month</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#166534" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900">User Growth</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#166534" fill="#166534" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900">Property Listings Trend</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={propertyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
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
            <h2 className="font-semibold text-surface-900">Media Reports by Institution</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mediaByInstitution} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#166534" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-semibold text-surface-900">Top Institutions by Score</h2>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topInstitutions} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#166534" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
