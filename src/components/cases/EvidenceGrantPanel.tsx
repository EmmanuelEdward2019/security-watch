import { useCallback, useEffect, useState } from 'react';
import { Link2, Copy, Check, Eye, XCircle, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Spinner,
  Modal,
  Input,
  Select,
  TextArea,
} from '@/components/ui';
import {
  fetchCaseGrants,
  createGrant,
  revokeGrant,
  grantUrl,
  grantState,
  type EvidenceGrant,
  type IssuedGrant,
} from '@/services/evidenceGrantService';

/**
 * Sharing evidence outside the platform without giving up control of it.
 *
 * THE ONE-TIME TOKEN SHAPES THIS WHOLE COMPONENT. The database stores only a
 * SHA-256 of the link, so there is no call that reads one back — not for us,
 * not for support. If the user closes the dialog without copying, the link is
 * gone and has to be reissued. That is why the token is shown on its own, in a
 * dialog that cannot be dismissed by accident, with the warning stated before
 * the link rather than under it.
 *
 * The wording about the watermark is deliberately unflattering. It deters and
 * it attributes; it does not stop a determined recipient photographing the
 * screen. Overselling it here would lead somebody to share material they would
 * otherwise have thought twice about, which is the opposite of the point.
 */

const EXPIRY = [
  { value: '24', label: '24 hours' },
  { value: '72', label: '3 days' },
  { value: '168', label: '7 days' },
  { value: '720', label: '30 days' },
];

export interface EvidenceGrantPanelProps {
  caseId: string;
  /** Exhibits on this case, so a grant can name one rather than the lot. */
  evidence: { id: string; file_name: string }[];
}

export function EvidenceGrantPanel({ caseId, evidence }: EvidenceGrantPanelProps) {
  const [grants, setGrants] = useState<EvidenceGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedGrant | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    recipientName: '',
    recipientEmail: '',
    purpose: '',
    // Defaults to a single exhibit rather than the case: a case-wide grant is a
    // standing right that picks up exhibits added later, which is rarely what
    // somebody means when they say "send this to my lawyer".
    evidenceId: evidence[0]?.id ?? '',
    hours: '72',
    maxViews: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { grants: rows } = await fetchCaseGrants(caseId);
    setGrants(rows);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!form.recipientName.trim()) {
      setError('Who is this for? Their name goes on the material they see.');
      return;
    }
    setBusy(true);
    setError(null);

    const { grant, error: err } = await createGrant({
      caseId,
      recipientName: form.recipientName.trim(),
      recipientEmail: form.recipientEmail.trim() || null,
      purpose: form.purpose.trim() || null,
      evidenceId: form.evidenceId || null,
      expiresInHours: Number(form.hours),
      maxViews: form.maxViews ? Number(form.maxViews) : null,
    });

    setBusy(false);
    if (err || !grant) {
      setError(err ?? 'Could not create that link.');
      return;
    }

    setOpen(false);
    setIssued(grant);
    setCopied(false);
    await load();
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(grantUrl(issued.token));
      setCopied(true);
    } catch {
      // Clipboard access can be refused. The link is on screen and selectable,
      // so this is a convenience failing, not the feature failing.
      setCopied(false);
    }
  };

  const withdraw = async (id: string) => {
    setBusy(true);
    await revokeGrant(id);
    setBusy(false);
    await load();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-surface-900">
            <Link2 size={18} className="text-brand-500" />
            Shared access
          </h2>
          <Button variant="secondary" onClick={() => setOpen(true)} disabled={evidence.length === 0}>
            Share evidence
          </Button>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : grants.length === 0 ? (
            <p className="text-sm leading-relaxed text-surface-600">
              Send evidence to a lawyer, an insurer or an investigating officer with a
              link that expires, can be withdrawn at any time, and records every time it
              is opened — instead of a download you can never take back.
            </p>
          ) : (
            <ul className="divide-y divide-surface-100">
              {grants.map((g) => {
                const state = grantState(g);
                return (
                  <li key={g.id} className="flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-surface-900">
                        {g.recipientName}
                      </span>
                      <span className="block truncate text-xs text-surface-500">
                        {g.evidenceName ?? 'Whole case'}
                        {g.purpose ? ` · ${g.purpose}` : ''}
                      </span>
                      <span className="mt-0.5 flex items-center gap-3 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                          <Eye size={11} />
                          {g.viewCount}
                          {g.maxViews !== null ? ` / ${g.maxViews}` : ''}
                        </span>
                        <span>
                          {g.revokedAt
                            ? `Withdrawn ${new Date(g.revokedAt).toLocaleDateString()}`
                            : `Expires ${new Date(g.expiresAt).toLocaleDateString()}`}
                        </span>
                      </span>
                    </span>

                    <Badge variant={state.tone}>{state.label}</Badge>

                    {g.isLive && (
                      <Button
                        variant="ghost"
                        onClick={() => withdraw(g.id)}
                        disabled={busy}
                        aria-label={`Withdraw access for ${g.recipientName}`}
                      >
                        <XCircle size={15} />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Share evidence">
        <div className="space-y-4">
          <Input
            label="Who is this for?"
            value={form.recipientName}
            onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
            placeholder="Their full name, or their firm"
          />
          <p className="text-xs text-surface-500">
            This name is shown across the material while they read it, and every time
            they open it is recorded against it.
          </p>

          <Select
            label="What are you sharing?"
            value={form.evidenceId}
            onChange={(e) => setForm((f) => ({ ...f, evidenceId: e.target.value }))}
            options={[
              ...evidence.map((e) => ({ value: e.id, label: e.file_name })),
              { value: '', label: 'Everything on this case' },
            ]}
          />

          <Select
            label="Expires after"
            value={form.hours}
            onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
            options={EXPIRY}
          />

          <Input
            label="Limit the number of opens (optional)"
            type="number"
            min={1}
            value={form.maxViews}
            onChange={(e) => setForm((f) => ({ ...f, maxViews: e.target.value }))}
            placeholder="No limit"
          />

          <Input
            label="Their email (optional)"
            type="email"
            value={form.recipientEmail}
            onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))}
          />

          <TextArea
            label="What is it for? (optional)"
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
            placeholder="Recorded on the case, so months from now it is clear why this was shared."
            rows={2}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Creating…' : 'Create link'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* The link is displayed once and is not recoverable, so this dialog says
          that BEFORE showing it — a warning underneath would be read after the
          decision to close has already been made. */}
      <Modal
        isOpen={Boolean(issued)}
        onClose={() => setIssued(null)}
        title="Copy this link now"
      >
        {issued && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                This is the only time you will see this link. We store it in a form we
                cannot read back, so if you lose it you will need to create a new one.
              </span>
            </p>

            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-100 px-3 py-2 font-mono text-xs text-surface-800">
                {grantUrl(issued.token)}
              </code>
              <Button onClick={copy} variant="secondary">
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-surface-500">
              Expires {new Date(issued.expiresAt).toLocaleString()}. You can withdraw it
              at any time, including after it has been opened. The recipient&apos;s name
              is shown across the material, which deters a casual forward and makes a
              leaked screenshot attributable — but it will not stop somebody determined
              to photograph the screen.
            </p>

            <div className="flex justify-end">
              <Button onClick={() => setIssued(null)}>
                {copied ? 'Done' : 'I have copied it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
