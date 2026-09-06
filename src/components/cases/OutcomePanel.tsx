import { useState } from 'react';
import { Gavel, CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Modal,
  Select,
  Input,
  TextArea,
} from '@/components/ui';
import {
  recordOutcome,
  OUTCOME_LABEL,
  OUTCOME_HELP,
  POSITIVE_OUTCOMES,
  type CaseOutcome,
} from '@/services/outcomeService';
import { NIGERIAN_STATES } from '@/services/referralService';

/**
 * What happened, recorded by somebody who is not the complainant.
 *
 * Deliberately not self-reported. An outcome is meant to be citable — it feeds
 * the published figures that hold commands to account — and "the person who
 * filed says it went well" is not a statistic anybody should build on. The
 * database enforces the same rule; this component only decides whether to
 * render.
 *
 * `referred_refused` is given its own place in the list and the longest
 * explanation, because it is the failure the platform exists to make visible
 * and the path of least resistance is to file it under "stalled" — vaguer,
 * kinder, and useless.
 *
 * The institution field warns that it is not published. It is free text and
 * somebody will eventually type an officer's name into it; only the curated
 * link reaches the public scorecard.
 */

export interface OutcomePanelProps {
  caseId: string;
  outcome: string | null;
  outcomeNote: string | null;
  handlingInstitution: string | null;
  outcomeRecordedAt: string | null;
  /** Admin, or a professional assigned to this case. Nobody else. */
  canRecord: boolean;
  onRecorded?: () => void;
}

export function OutcomePanel({
  caseId,
  outcome,
  outcomeNote,
  handlingInstitution,
  outcomeRecordedAt,
  canRecord,
  onRecorded,
}: OutcomePanelProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    outcome: (outcome as CaseOutcome) || ('' as CaseOutcome | ''),
    note: outcomeNote ?? '',
    institution: handlingInstitution ?? '',
    state: '',
  });

  // Nothing recorded and nothing this viewer can do about it: say nothing at
  // all rather than showing an empty panel to a complainant.
  if (!outcome && !canRecord) return null;

  const submit = async () => {
    if (!form.outcome) {
      setError('Choose what happened.');
      return;
    }
    setBusy(true);
    setError(null);

    const { error: err } = await recordOutcome({
      caseId,
      outcome: form.outcome,
      note: form.note.trim() || null,
      institution: form.institution.trim() || null,
      state: form.state || null,
    });

    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setOpen(false);
    onRecorded?.();
  };

  const positive = outcome ? POSITIVE_OUTCOMES.includes(outcome as CaseOutcome) : false;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-surface-900">
            <Gavel size={18} className="text-brand-500" />
            Outcome
          </h2>
          {outcome && (
            <Badge variant={positive ? 'success' : 'default'}>
              {OUTCOME_LABEL[outcome as CaseOutcome] ?? outcome}
            </Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {outcome ? (
            <>
              {outcomeNote && (
                <p className="text-sm leading-relaxed text-surface-700">{outcomeNote}</p>
              )}
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {handlingInstitution && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-surface-500">
                      Handled by
                    </dt>
                    <dd className="text-surface-900">{handlingInstitution}</dd>
                  </div>
                )}
                {outcomeRecordedAt && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-surface-500">
                      Recorded
                    </dt>
                    <dd className="text-surface-900">
                      {new Date(outcomeRecordedAt).toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-surface-600">
              Nothing recorded yet. Recording what happened — including when nothing
              could be done — is what lets the platform show whether reporting works.
            </p>
          )}

          {canRecord && (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              {outcome ? 'Update the outcome' : 'Record the outcome'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Record the outcome">
        <div className="space-y-4">
          <Select
            label="What happened?"
            value={form.outcome}
            onChange={(e) =>
              setForm((f) => ({ ...f, outcome: e.target.value as CaseOutcome }))
            }
            options={[
              { value: '', label: 'Choose…' },
              ...(Object.keys(OUTCOME_LABEL) as CaseOutcome[]).map((k) => ({
                value: k,
                label: OUTCOME_LABEL[k],
              })),
            ]}
          />
          {form.outcome && (
            <p className="rounded-lg bg-surface-50 p-3 text-xs leading-relaxed text-surface-600">
              {OUTCOME_HELP[form.outcome]}
            </p>
          )}

          <Input
            label="Which body handled it? (optional)"
            value={form.institution}
            onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
            placeholder="e.g. Ojodu Division"
          />
          <p className="text-xs text-surface-500">
            Name the command, station or agency — never an individual officer. This field
            is for internal reporting and is never published.
          </p>

          <Select
            label="State (optional)"
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            options={[
              { value: '', label: 'Not specified' },
              ...NIGERIAN_STATES.map((s) => ({ value: s, label: s })),
            ]}
          />

          <TextArea
            label="Anything worth recording (optional)"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            rows={3}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <p className="flex items-start gap-2 text-xs leading-relaxed text-surface-500">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-surface-400" />
            <span>
              The complainant is told when this is recorded, and can see what was entered.
            </span>
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Record it'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
