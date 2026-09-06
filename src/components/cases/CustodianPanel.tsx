import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldOff, Clock, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Spinner,
  Modal,
  Select,
  TextArea,
} from '@/components/ui';
import {
  fetchCaseCustodianRelease,
  fetchEligibleCustodians,
  createCustodianRelease,
  checkIn,
  setReleaseStatus,
  releaseSchedule,
  type CustodianRelease,
  type EligibleCustodian,
} from '@/services/custodianService';

/**
 * The custodian safeguard, from the complainant's side.
 *
 * THE ONE THING THIS SCREEN MUST NEVER DO is imply protection that is not
 * running. `pending_custodian` means the nominated professional has not
 * answered and nothing will fire; `declined` means they said no. Both are shown
 * as warnings in plain words, because somebody who believes they are protected
 * and is not is in more danger than somebody who knows they are on their own.
 *
 * The check-in button is the entire mechanism from the user's point of view, so
 * it is the largest thing here and it says what it does — not "check in", which
 * means nothing, but what happens if they do not.
 */

const STATUS: Record<
  CustodianRelease['status'],
  { label: string; tone: 'success' | 'warning' | 'danger' | 'default'; blurb: string }
> = {
  pending_custodian: {
    label: 'Waiting on your custodian',
    tone: 'warning',
    blurb:
      'They have been asked and have not answered yet. Nothing will happen until they accept — you are not protected at the moment.',
  },
  active: {
    label: 'Active',
    tone: 'success',
    blurb:
      'Your safeguard is running. Check in before each deadline and this case stays private.',
  },
  paused: {
    label: 'Paused',
    tone: 'default',
    blurb:
      'Paused at your request. Nothing will be released while it stays this way, and no check-ins are needed.',
  },
  declined: {
    label: 'Declined',
    tone: 'danger',
    blurb:
      'They did not accept, so no safeguard is in place on this case. Nominate someone else if you still want one.',
  },
  released: {
    label: 'Released',
    tone: 'danger',
    blurb:
      'Check-ins lapsed past the grace period, so this case was released to your custodian. They can now read it.',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'default',
    blurb: 'You cancelled this arrangement. Nothing will be released.',
  },
};

const INTERVALS = [
  { value: '7', label: 'Every 7 days' },
  { value: '14', label: 'Every 14 days' },
  { value: '30', label: 'Every 30 days' },
  { value: '60', label: 'Every 60 days' },
];

const GRACE = [
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
];

export interface CustodianPanelProps {
  caseId: string;
  /** Only the complainant may arrange one. Others see nothing. */
  isComplainant: boolean;
}

export function CustodianPanel({ caseId, isComplainant }: CustodianPanelProps) {
  const [release, setRelease] = useState<CustodianRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [custodians, setCustodians] = useState<EligibleCustodian[]>([]);
  const [form, setForm] = useState({ custodianId: '', interval: '14', grace: '3', note: '' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { release: r } = await fetchCaseCustodianRelease(caseId);
    setRelease(r);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDialog = async () => {
    setError(null);
    setOpen(true);
    const { custodians: list } = await fetchEligibleCustodians();
    setCustodians(list);
  };

  const submit = async () => {
    if (!form.custodianId) {
      setError('Choose who should receive this case.');
      return;
    }
    setBusy(true);
    const { error: err } = await createCustodianRelease({
      caseId,
      custodianId: form.custodianId,
      intervalDays: Number(form.interval),
      graceDays: Number(form.grace),
      note: form.note.trim() || undefined,
    });
    setBusy(false);

    if (err) {
      setError(err);
      return;
    }
    setOpen(false);
    await load();
  };

  const act = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    const { error: err } = await fn();
    setBusy(false);
    if (err) setError(err);
    await load();
  };

  if (!isComplainant) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  const schedule = release ? releaseSchedule(release) : null;
  const status = release ? STATUS[release.status] : null;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-surface-900">
            {release?.status === 'active' ? (
              <ShieldCheck size={18} className="text-emerald-600" />
            ) : release ? (
              <ShieldAlert size={18} className="text-amber-600" />
            ) : (
              <ShieldOff size={18} className="text-surface-400" />
            )}
            Custodian safeguard
          </h2>
          {status && <Badge variant={status.tone}>{status.label}</Badge>}
        </CardHeader>

        <CardContent className="space-y-4">
          {!release && (
            <>
              <p className="text-sm leading-relaxed text-surface-700">
                Nominate a verified lawyer or investigator to receive this case if you
                stop checking in. While you check in, nothing happens and nobody sees
                anything. If you go quiet past the grace period — and only after we have
                warned you — this case becomes readable by the person you named.
              </p>
              <p className="text-xs leading-relaxed text-surface-500">
                It is never published, never sent to the press, and never shared with
                anyone but the professional you choose, who has to agree first.
              </p>
              <Button onClick={openDialog}>Set up a safeguard</Button>
            </>
          )}

          {release && status && (
            <>
              <p className="text-sm leading-relaxed text-surface-700">{status.blurb}</p>

              {release.status === 'active' && schedule && (
                <>
                  <div
                    className={
                      schedule.overdue
                        ? 'rounded-lg border border-amber-200 bg-amber-50 p-4'
                        : 'rounded-lg border border-surface-200 bg-surface-50 p-4'
                    }
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-surface-900">
                      {schedule.overdue ? (
                        <AlertTriangle size={15} className="text-amber-600" />
                      ) : (
                        <Clock size={15} className="text-surface-400" />
                      )}
                      {schedule.overdue
                        ? 'You have missed a check-in'
                        : `Next check-in by ${schedule.dueAt.toLocaleDateString()}`}
                    </p>
                    <p className="mt-1 text-xs text-surface-600">
                      {/* Only stated once a warning has actually been sent — the
                          grace clock runs from the warning, so before that any
                          release date would be a guess presented as a fact. */}
                      {schedule.releasesAt
                        ? `Unless you check in, this case is released on ${schedule.releasesAt.toLocaleDateString()}.`
                        : `Checking in every ${release.intervalDays} days, with ${release.graceDays} days' grace after a missed one.`}
                    </p>
                  </div>

                  <Button
                    onClick={() => act(() => checkIn(release.id))}
                    disabled={busy}
                    className="w-full"
                  >
                    I&apos;m here — keep this case private
                  </Button>
                </>
              )}

              <div className="flex flex-wrap gap-2 border-t border-surface-100 pt-4">
                {release.status === 'active' && (
                  <Button
                    variant="secondary"
                    onClick={() => act(() => setReleaseStatus(release.id, 'paused'))}
                    disabled={busy}
                  >
                    Pause
                  </Button>
                )}
                {release.status === 'paused' && (
                  <Button
                    variant="secondary"
                    onClick={() => act(() => setReleaseStatus(release.id, 'active'))}
                    disabled={busy}
                  >
                    Resume
                  </Button>
                )}
                {release.status !== 'released' && release.status !== 'cancelled' && (
                  <Button
                    variant="ghost"
                    onClick={() => act(() => setReleaseStatus(release.id, 'cancelled'))}
                    disabled={busy}
                  >
                    Cancel safeguard
                  </Button>
                )}
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Set up a custodian safeguard">
        <div className="space-y-4">
          <Select
            label="Custodian"
            value={form.custodianId}
            onChange={(e) => setForm((f) => ({ ...f, custodianId: e.target.value }))}
            options={[
              { value: '', label: 'Choose a verified professional…' },
              ...custodians.map((c) => ({
                value: c.userId,
                label: `${c.fullName} · ${c.role}${c.serviceArea ? ` · ${c.serviceArea}` : ''}`,
              })),
            ]}
          />
          <p className="text-xs text-surface-500">
            Only lawyers and investigators this platform has verified can act as
            custodians. They have to accept before anything takes effect.
          </p>

          <Select
            label="Check in"
            value={form.interval}
            onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value }))}
            options={INTERVALS}
          />

          <Select
            label="Grace period after a missed check-in"
            value={form.grace}
            onChange={(e) => setForm((f) => ({ ...f, grace: e.target.value }))}
            options={GRACE}
          />
          <p className="text-xs text-surface-500">
            We warn you first. The grace period runs from that warning, not from the
            deadline — so a lost phone or a hospital stay does not release your case.
          </p>

          <TextArea
            label="Note to your custodian (optional)"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Anything they should know if this ever reaches them."
            rows={3}
          />
          <p className="text-xs text-surface-500">
            They only ever see this if the safeguard actually runs.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Sending…' : 'Ask them'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
