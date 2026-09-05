import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardHeader, CardContent, Spinner } from '@/components/ui';
import { fetchStuckQueues, type StuckQueue } from '@/services/operationsService';

/**
 * What is stuck, on the admin dashboard.
 *
 * The analytics below this answer "how much". This answers the question an
 * administrator actually needs first: what is waiting on me. A case nobody was
 * assigned, a verification nobody reviewed, a payout accrued and never sent —
 * none of those raise an error or appear as a failure, and each one is a person
 * waiting without knowing why.
 *
 * A count of zero is shown as settled rather than hidden. "Nothing stuck" is
 * information; an absent row just looks like something failed to load.
 */
export function StuckQueues() {
  const [queues, setQueues] = useState<StuckQueue[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setQueues(await fetchStuckQueues());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flagged = queues.filter((q) => q.count !== undefined && q.count >= q.warnAt);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-surface-900">
          <Activity size={18} className="text-brand-500" />
          Needs attention
        </h2>
        {!loading && (
          <span className="text-xs text-surface-500">
            {flagged.length === 0
              ? 'Nothing waiting'
              : `${flagged.length} queue${flagged.length === 1 ? '' : 's'} waiting`}
          </span>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <ul className="divide-y divide-surface-100">
            {queues.map((q) => {
              // `undefined` means the query failed — deliberately distinct from
              // a measured zero, which is good news.
              const unknown = q.count === undefined;
              const isFlagged = !unknown && q.count! >= q.warnAt;

              return (
                <li key={q.key}>
                  <Link
                    to={q.href}
                    className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-surface-50"
                  >
                    <span
                      className={
                        isFlagged
                          ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600'
                          : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600'
                      }
                    >
                      {isFlagged ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-surface-900">{q.label}</span>
                      <span className="block text-xs text-surface-500">
                        {isFlagged ? q.action : 'Clear'}
                        {q.thresholdDays > 0 && isFlagged
                          ? ` · waiting over ${q.thresholdDays} day${q.thresholdDays === 1 ? '' : 's'}`
                          : ''}
                      </span>
                    </span>

                    <span
                      className={
                        unknown
                          ? 'text-sm text-surface-400'
                          : isFlagged
                            ? 'text-lg font-semibold tabular-nums text-amber-700'
                            : 'text-lg font-semibold tabular-nums text-surface-400'
                      }
                    >
                      {unknown ? '—' : q.count}
                    </span>

                    <ArrowRight size={15} className="shrink-0 text-surface-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
