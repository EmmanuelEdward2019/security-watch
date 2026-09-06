import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight, MapPin, Info } from 'lucide-react';
import { Card, CardHeader, CardContent, Select, Spinner, Badge, EmptyState } from '@/components/ui';
import {
  fetchCorroborationClusters,
  type CorroborationCluster,
} from '@/services/corroborationService';

/**
 * The incident board.
 *
 * Administrators can already read every case; what they have never had is the
 * join. This lists cases that at least one unconnected person also reported,
 * nearby and around the same time — an incident view rather than a case list.
 *
 * ORDERED BY DISTINCT REPORTERS, NOT BY REPORT COUNT. Ten reports from two
 * people is a dispute between two people. Three reports from three strangers is
 * an incident. Sorting by the raw count would put the first above the second,
 * which is exactly backwards for deciding where to send somebody.
 */

const CATEGORY_LABEL: Record<string, string> = {
  fraud: 'Fraud',
  robbery: 'Robbery',
  murder: 'Murder',
  assault: 'Assault',
  domestic_dispute: 'Domestic',
  land_dispute: 'Land dispute',
  cybercrime: 'Cybercrime',
  corruption: 'Corruption',
  kidnapping: 'Kidnapping',
  missing_person: 'Missing person',
  other: 'Other',
};

const RADIUS = [
  { value: '0.5', label: 'Within 500m' },
  { value: '2', label: 'Within 2km' },
  { value: '5', label: 'Within 5km' },
  { value: '10', label: 'Within 10km' },
];

const WINDOW = [
  { value: '6', label: '±6 hours' },
  { value: '24', label: '±24 hours' },
  { value: '72', label: '±3 days' },
  { value: '168', label: '±7 days' },
];

const PERIOD = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

export default function CorroborationPage() {
  const [clusters, setClusters] = useState<CorroborationCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ radius: '2', window: '24', days: '30' });

  const load = useCallback(async () => {
    setLoading(true);
    const { clusters: rows } = await fetchCorroborationClusters({
      radiusKm: Number(filters.radius),
      windowHours: Number(filters.window),
      days: Number(filters.days),
      limit: 100,
    });
    setClusters(rows);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900">Corroborated incidents</h1>
        <p className="mt-1 text-sm text-surface-600">
          Cases that unconnected people also reported, in the same place and time window.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-4 py-4 sm:grid-cols-3">
          <Select
            label="Distance"
            value={filters.radius}
            onChange={(e) => setFilters((f) => ({ ...f, radius: e.target.value }))}
            options={RADIUS}
          />
          <Select
            label="Time window"
            value={filters.window}
            onChange={(e) => setFilters((f) => ({ ...f, window: e.target.value }))}
            options={WINDOW}
          />
          <Select
            label="Period"
            value={filters.days}
            onChange={(e) => setFilters((f) => ({ ...f, days: e.target.value }))}
            options={PERIOD}
          />
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : clusters.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No corroborated incidents"
          description="Nothing in this period had an independent report nearby. Try widening the distance or the time window — or this may simply be a quiet period."
        />
      ) : (
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 font-semibold text-surface-900">
              <Users size={18} className="text-brand-500" />
              {clusters.length} {clusters.length === 1 ? 'incident' : 'incidents'}
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-surface-100">
              {clusters.map((c) => (
                <li key={c.caseId}>
                  <Link
                    to={`/app/cases/${c.caseId}`}
                    className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-50"
                  >
                    <span
                      className={
                        c.distinctReporters >= 3
                          ? 'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-forest-600 text-white'
                          : 'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-100 text-surface-700'
                      }
                    >
                      <span className="text-base font-semibold leading-none tabular-nums">
                        {c.distinctReporters}
                      </span>
                      <span className="text-[9px] uppercase leading-none opacity-80">
                        others
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-surface-900">
                        {c.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500">
                        <span>{CATEGORY_LABEL[c.category] ?? c.category}</span>
                        {c.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} />
                            {c.location}
                          </span>
                        )}
                        <span>{new Date(c.occurredAt).toLocaleDateString()}</span>
                        {c.nearestKm !== null && (
                          <span>
                            nearest{' '}
                            {c.nearestKm < 1
                              ? `${Math.round(c.nearestKm * 1000)}m`
                              : `${c.nearestKm}km`}
                          </span>
                        )}
                      </span>
                    </span>

                    <Badge
                      variant={
                        c.urgency === 'critical' || c.urgency === 'high' ? 'danger' : 'default'
                      }
                    >
                      {c.urgency}
                    </Badge>

                    <ArrowRight size={15} className="shrink-0 text-surface-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="flex items-start gap-2 rounded-lg bg-surface-50 p-4 text-xs leading-relaxed text-surface-600">
        <Info size={14} className="mt-0.5 shrink-0 text-surface-400" />
        <span>
          The number on the left counts <strong>distinct reporters</strong>, not reports.
          Reports from the same complainant never corroborate each other, and related
          categories are matched as well as identical ones — a robbery and an assault at
          the same corner within the hour are frequently one event described twice.
        </span>
      </p>
    </div>
  );
}
