import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Inbox, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, Spinner, EmptyState } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchMyCustodianships,
  fetchMySafeguards,
  respondToRequest,
  acknowledgeRelease,
  checkIn,
  releaseSchedule,
  type CustodianRelease,
} from '@/services/custodianService';

/**
 * Both sides of the custodian arrangement, on one page.
 *
 * A professional sees what they have been asked to hold and what has actually
 * been released to them. A complainant sees every safeguard they have running
 * and can check in on all of them at once — someone with three arrangements
 * should not have to visit three cases to keep them alive, and forgetting one
 * is precisely the failure that turns into a disclosure.
 *
 * Nominations are shown as a decision, not a notification. Accepting means
 * taking on a real obligation to somebody who may be in danger, so the wording
 * says what is being agreed to rather than dressing it up as an inbox item.
 */

export default function CustodianInboxPage() {
  const userId = useAuthStore((s) => s.user?.user_id ?? null);
  const [held, setHeld] = useState<CustodianRelease[]>([]);
  const [mine, setMine] = useState<CustodianRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [a, b] = await Promise.all([
      fetchMyCustodianships(userId),
      fetchMySafeguards(userId),
    ]);
    setHeld(a.releases);
    setMine(b.releases);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const pending = held.filter((r) => r.status === 'pending_custodian');
  const released = held.filter((r) => r.status === 'released');
  const holding = held.filter((r) => r.status === 'active' || r.status === 'paused');
  const active = mine.filter((r) => r.status === 'active');

  const nothing =
    pending.length === 0 && released.length === 0 && holding.length === 0 && mine.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900">Custodian safeguards</h1>
        <p className="mt-1 text-sm text-surface-600">
          Arrangements that release a case file if the person who filed it stops checking
          in.
        </p>
      </div>

      {nothing && (
        <EmptyState
          icon={Inbox}
          title="Nothing here"
          description="You have not been asked to hold a case, and you have not set up a safeguard on one of your own."
        />
      )}

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 font-semibold text-surface-900">
              <ShieldAlert size={18} className="text-amber-600" />
              You have been asked to act as a custodian
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-surface-700">
              If you accept, and the complainant stops checking in past the grace period,
              their case file and its evidence become readable by you. You would be
              expected to act on it. Nothing happens unless you accept.
            </p>

            <ul className="divide-y divide-surface-100">
              {pending.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-surface-900">
                      Checks in every {r.intervalDays} days, {r.graceDays} days&apos; grace
                    </span>
                    <span className="block text-xs text-surface-500">
                      Asked {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  <Button onClick={() => act(() => respondToRequest(r.id, true))} disabled={busy}>
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => act(() => respondToRequest(r.id, false))}
                    disabled={busy}
                  >
                    Decline
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {released.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 font-semibold text-surface-900">
              <ShieldAlert size={18} className="text-red-600" />
              Released to you
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-surface-700">
              These complainants stopped checking in. Their cases are now readable by you.
              Read the note they left before you do anything else.
            </p>

            <ul className="divide-y divide-surface-100">
              {released.map((r) => (
                <li key={r.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1 text-sm text-surface-700">
                      Released{' '}
                      {r.releasedAt ? new Date(r.releasedAt).toLocaleDateString() : ''}
                    </span>
                    <Link to={`/app/cases/${r.caseId}`}>
                      <Button variant="secondary">
                        Open the case
                        <ArrowRight size={14} />
                      </Button>
                    </Link>
                    {!r.acknowledgedAt && (
                      <Button
                        variant="ghost"
                        onClick={() => act(() => acknowledgeRelease(r.id))}
                        disabled={busy}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                  {r.noteToCustodian && (
                    <p className="rounded-lg bg-surface-50 p-3 text-sm leading-relaxed text-surface-700">
                      {r.noteToCustodian}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {holding.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 font-semibold text-surface-900">
              <ShieldCheck size={18} className="text-emerald-600" />
              You are holding {holding.length} {holding.length === 1 ? 'case' : 'cases'}
            </h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-surface-600">
              Nothing is required of you while these people keep checking in. You will be
              told if that changes.
            </p>
          </CardContent>
        </Card>
      )}

      {mine.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-surface-900">
              <ShieldCheck size={18} className="text-brand-500" />
              Your own safeguards
            </h2>
            {active.length > 0 && (
              // One button for every arrangement. Three deadlines to remember is
              // three chances to forget one.
              <Button onClick={() => act(() => checkIn())} disabled={busy}>
                Check in on all {active.length}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-surface-100">
              {mine.map((r) => {
                const s = releaseSchedule(r);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <Link
                        to={`/app/cases/${r.caseId}`}
                        className="block text-sm font-medium text-surface-900 hover:underline"
                      >
                        Case safeguard
                      </Link>
                      <span className="block text-xs text-surface-500">
                        {r.status === 'active'
                          ? s.overdue
                            ? 'Check-in overdue'
                            : `Next check-in ${s.dueAt.toLocaleDateString()}`
                          : 'Not currently protecting this case'}
                      </span>
                    </span>
                    <Badge
                      variant={
                        r.status === 'active'
                          ? s.overdue
                            ? 'warning'
                            : 'success'
                          : r.status === 'released' || r.status === 'declined'
                            ? 'danger'
                            : 'default'
                      }
                    >
                      {r.status.replace(/_/g, ' ')}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
