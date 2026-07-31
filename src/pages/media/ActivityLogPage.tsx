import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Film, Star, ShieldAlert, Building2 } from 'lucide-react';
import {
  Card,
  CardContent,
  StatusBadge,
  EmptyState,
  Spinner,
  Badge,
} from '@/components/ui';
import { fetchMyActivity } from '@/services/adminService';
import { describeAuditAction } from '@/services/auditService';
import type { ActivityEntry } from '@/types';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

type FilterKind = 'all' | ActivityEntry['kind'];

const KIND_META: Record<ActivityEntry['kind'], { label: string; icon: typeof Film }> = {
  media_report: { label: 'Report filed', icon: Film },
  institution_score: { label: 'Institution rated', icon: Star },
  audit: { label: 'Account activity', icon: ShieldAlert },
};

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE d MMMM yyyy');
}

/**
 * The agent's own activity feed.
 *
 * Was a hardcoded array of invented site visits. Now assembled in SQL from the
 * reports they filed, the institutions they rated, and their audited account
 * actions — so it reflects what actually happened rather than what looked
 * plausible.
 */
export default function ActivityLogPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKind>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { entries: rows, error } = await fetchMyActivity(100);
    if (error) toast.error(error);
    setEntries(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.kind === filter)),
    [entries, filter]
  );

  // Group into days so a long feed stays scannable.
  const grouped = useMemo(() => {
    const days = new Map<string, ActivityEntry[]>();
    for (const entry of visible) {
      const key = dayLabel(entry.occurred_at);
      const list = days.get(key) ?? [];
      list.push(entry);
      days.set(key, list);
    }
    return [...days.entries()];
  }, [visible]);

  const counts = useMemo(
    () => ({
      all: entries.length,
      media_report: entries.filter((e) => e.kind === 'media_report').length,
      institution_score: entries.filter((e) => e.kind === 'institution_score').length,
      audit: entries.filter((e) => e.kind === 'audit').length,
    }),
    [entries]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Activity log</h1>
        <p className="text-surface-500 mt-1">
          Everything you have filed and rated, plus a record of actions taken on your account.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Filter activity"
        className="flex flex-wrap gap-2 border-b border-surface-200 pb-3"
      >
        {(
          [
            ['all', `All (${counts.all})`],
            ['media_report', `Reports (${counts.media_report})`],
            ['institution_score', `Ratings (${counts.institution_score})`],
            ['audit', `Account (${counts.audit})`],
          ] as [FilterKind, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              filter === id ? 'bg-brand-500 text-white' : 'text-surface-600 hover:bg-surface-100'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nothing here yet"
          description={
            entries.length === 0
              ? 'File a field report or rate an institution and your activity will start appearing here.'
              : 'No activity of that kind.'
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayEntries]) => (
            <div key={day}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-surface-400 mb-2">
                {day}
              </h2>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-surface-100">
                    {dayEntries.map((entry) => {
                      const meta = KIND_META[entry.kind];
                      const Icon = meta.icon;
                      return (
                        <li key={`${entry.kind}-${entry.id}`} className="flex gap-3 p-4">
                          <div className="mt-0.5 shrink-0 rounded-full bg-surface-100 p-2">
                            <Icon size={15} className="text-surface-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-medium text-surface-900 text-sm">
                                {entry.kind === 'audit'
                                  ? describeAuditAction(entry.title)
                                  : entry.title}
                              </p>
                              {entry.kind === 'media_report' ? (
                                <StatusBadge
                                  status={
                                    entry.status === 'published'
                                      ? 'completed'
                                      : entry.status === 'approved'
                                        ? 'active'
                                        : entry.status === 'rejected'
                                          ? 'rejected'
                                          : 'pending'
                                  }
                                />
                              ) : (
                                <Badge variant="default">{meta.label}</Badge>
                              )}
                            </div>
                            {entry.detail && (
                              <p className="text-sm text-surface-500 mt-0.5 flex items-center gap-1.5">
                                {entry.kind === 'media_report' && (
                                  <Building2 size={12} className="shrink-0" />
                                )}
                                <span className="truncate">{entry.detail}</span>
                              </p>
                            )}
                            <p className="text-xs text-surface-400 mt-1">
                              {format(new Date(entry.occurred_at), 'HH:mm')} ·{' '}
                              {formatDistanceToNow(new Date(entry.occurred_at), { addSuffix: true })}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
