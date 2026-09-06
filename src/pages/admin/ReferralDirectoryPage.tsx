import { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, CheckCircle2, ExternalLink, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Select,
  Spinner,
  EmptyState,
} from '@/components/ui';
import {
  fetchUnverifiedReferrals,
  findReferrals,
  verifyReferral,
  updateReferral,
  KIND_LABEL,
  NIGERIAN_STATES,
  type UnverifiedReferral,
  type Referral,
} from '@/services/referralService';

/**
 * Checking the directory before the public sees it.
 *
 * The seed ships every entry inactive with its telephone number blank, because
 * a wrong number in a security application is somebody in trouble dialling into
 * silence. This is where a person fills those in from the organisation's own
 * published source and switches the entry on.
 *
 * The verification is recorded against whoever did it, and switching an entry
 * back off clears that — so an entry withdrawn because its number turned out to
 * be wrong cannot come back still claiming somebody checked it.
 *
 * The website link is deliberately prominent: the whole job is comparing what
 * is on screen against what the organisation publishes, and making that one
 * click rather than a search is most of what makes the job get done.
 */

export default function ReferralDirectoryPage() {
  const [pending, setPending] = useState<UnverifiedReferral[]>([]);
  const [live, setLive] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { phone: string; state: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([fetchUnverifiedReferrals(), findReferrals({ limit: 100 })]);
    setPending(a.referrals);
    setLive(b.referrals);
    setEdits(
      Object.fromEntries(a.referrals.map((r) => [r.id, { phone: r.phone ?? '', state: r.state }]))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async (r: UnverifiedReferral) => {
    setBusy(r.id);
    const edit = edits[r.id];

    // Saved before the entry is switched on, so an entry can never go live
    // carrying details the administrator meant to correct.
    if (edit && (edit.phone !== (r.phone ?? '') || edit.state !== r.state)) {
      await updateReferral(r.id, {
        phone: edit.phone.trim() || null,
        state: edit.state,
      });
    }

    await verifyReferral(r.id, true);
    setBusy(null);
    await load();
  };

  const withdraw = async (id: string) => {
    setBusy(id);
    await verifyReferral(id, false);
    setBusy(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900">Referral directory</h1>
        <p className="mt-1 text-sm text-surface-600">
          Public help listings. Nothing appears on the site until somebody here has
          checked its contact details.
        </p>
      </div>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 font-semibold text-surface-900">
              <AlertTriangle size={18} className="text-amber-600" />
              {pending.length} waiting to be checked
            </h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
              Open each organisation&apos;s own website, confirm the number there, type it
              in, then publish. Please do not publish a number from memory or from a
              search result — somebody will dial it in an emergency.
            </p>

            {pending.map((r) => (
              <div key={r.id} className="space-y-3 border-t border-surface-100 pt-5 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-surface-900">{r.name}</h3>
                    <p className="text-xs text-surface-500">
                      {KIND_LABEL[r.kind]} · {r.category === 'any' ? 'All categories' : r.category}
                    </p>
                  </div>
                  {r.website && (
                    <a
                      href={r.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1.5 text-sm text-forest-700 underline underline-offset-4"
                    >
                      Open their site
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>

                {r.guidance && (
                  <p className="text-sm leading-relaxed text-surface-600">{r.guidance}</p>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    label="Telephone"
                    value={edits[r.id]?.phone ?? ''}
                    onChange={(e) =>
                      setEdits((s) => ({
                        ...s,
                        [r.id]: { ...s[r.id], phone: e.target.value },
                      }))
                    }
                    placeholder="From their own website"
                  />
                  <Select
                    label="State"
                    value={edits[r.id]?.state ?? r.state}
                    onChange={(e) =>
                      setEdits((s) => ({
                        ...s,
                        [r.id]: { ...s[r.id], state: e.target.value },
                      }))
                    }
                    options={[
                      { value: 'national', label: 'National' },
                      ...NIGERIAN_STATES.map((x) => ({ value: x, label: x })),
                    ]}
                  />
                  <div className="flex items-end">
                    <Button onClick={() => publish(r)} disabled={busy === r.id}>
                      {busy === r.id ? 'Publishing…' : 'Publish'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="flex items-center gap-2 font-semibold text-surface-900">
            <CheckCircle2 size={18} className="text-emerald-600" />
            Live on the site ({live.length})
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          {live.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={LifeBuoy}
                title="Nothing published yet"
                description="The public help page shows an emergency number and an explanation until entries are checked and switched on."
              />
            </div>
          ) : (
            <ul className="divide-y divide-surface-100">
              {live.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-surface-900">
                      {r.name}
                    </span>
                    <span className="block text-xs text-surface-500">
                      {KIND_LABEL[r.kind]} · {r.state} · {r.phone ?? 'no number'}
                    </span>
                  </span>
                  <Button variant="ghost" onClick={() => withdraw(r.id)} disabled={busy === r.id}>
                    Withdraw
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
