import { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, AlertTriangle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Select, TextArea, Button, Badge, Spinner } from '@/components/ui';
import {
  createEngagement,
  fetchBookableServices,
  fetchCaseEngagements,
  listBookableProfessionals,
  previewSplit,
  type BookableProfessional,
  type BookableService,
  type CaseEngagement,
} from '@/services/engagementService';

/**
 * Books a professional against a case at a catalogue price.
 *
 * The engagement is the money agreement, deliberately separate from assignment.
 * Assigning grants access to the case file; booking creates an obligation to
 * pay someone. Conflating them would mean every assignment implied a fee, and
 * an administrator could not bring a second opinion onto a case without
 * committing to pay for it.
 *
 * The split is shown before anything is written, computed exactly as the RPC
 * computes it. An administrator is agreeing money on someone's behalf and
 * should see the figures they are agreeing to, not discover them afterwards on
 * the payout ledger.
 */

const ROLE_LABEL: Record<BookableProfessional['role'], string> = {
  investigator: 'Investigator',
  lawyer: 'Lawyer',
  medical_expert: 'Medical expert',
};

const STATUS_VARIANT: Record<CaseEngagement['status'], 'success' | 'warning' | 'danger' | 'default'> = {
  awaiting_deposit: 'warning',
  funded: 'success',
  in_progress: 'success',
  completed: 'default',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<CaseEngagement['status'], string> = {
  awaiting_deposit: 'Awaiting deposit',
  funded: 'Funded',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export interface EngagementModalProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Fired after a successful booking, so the caller can refresh. */
  onBooked?: () => void;
}

export function EngagementModal({ caseId, isOpen, onClose, onBooked }: EngagementModalProps) {
  const [role, setRole] = useState<BookableProfessional['role']>('investigator');
  const [professionals, setProfessionals] = useState<BookableProfessional[]>([]);
  const [services, setServices] = useState<BookableService[]>([]);
  const [existing, setExisting] = useState<CaseEngagement[]>([]);

  const [professionalId, setProfessionalId] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [depositPercent, setDepositPercent] = useState('50');
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);

    const [svc, eng] = await Promise.all([
      fetchBookableServices(),
      fetchCaseEngagements(caseId),
    ]);

    if (svc.error) toast.error(svc.error);
    setServices(svc.services);
    setExisting(eng.engagements);
    setLoading(false);
  }, [caseId, isOpen]);

  useEffect(() => {
    void load();
  }, [load]);

  // The professional list depends on the role, so it reloads when that changes.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setProfessionalId('');

    void listBookableProfessionals(role).then(({ professionals: list, error }) => {
      if (cancelled) return;
      if (error) toast.error(error);
      setProfessionals(list);
    });

    return () => {
      cancelled = true;
    };
  }, [role, isOpen]);

  const service = useMemo(
    () => services.find((s) => s.key === serviceKey) ?? null,
    [services, serviceKey]
  );

  const depositRate = Math.min(Math.max(Number(depositPercent) || 0, 1), 100) / 100;
  const split = service ? previewSplit(service, depositRate) : null;
  const chosen = professionals.find((p) => p.user_id === professionalId) ?? null;

  const money = (v: number, currency = service?.currency ?? 'NGN') =>
    `${currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const submit = async () => {
    if (!professionalId) {
      toast.error('Choose who is being booked.');
      return;
    }
    if (!service) {
      toast.error('Choose the service being engaged.');
      return;
    }

    setSaving(true);
    const { error } = await createEngagement({
      caseId,
      professionalId,
      role,
      serviceKey: service.key,
      depositRate,
      note: note.trim() || undefined,
    });
    setSaving(false);

    if (error) {
      // The RPC's messages are written for people to read.
      toast.error(error);
      return;
    }

    toast.success('Engagement booked. The complainant has been asked for the deposit.');
    setProfessionalId('');
    setServiceKey('');
    setNote('');
    onBooked?.();
    void load();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book an engagement" size="lg">
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
            <Info size={18} className="mt-0.5 shrink-0 text-brand-600" />
            <p className="text-xs text-brand-800">
              Booking creates the fee agreement, not case access — assign separately.
              The complainant is asked for the deposit; The Security Watch holds it and
              releases this professional&apos;s share once you record the transfer.
            </p>
          </div>

          {existing.length > 0 && (
            <div className="rounded-lg border border-surface-200 p-3">
              <p className="mb-2 text-xs font-medium text-surface-700">
                Already booked on this case
              </p>
              <ul className="space-y-1.5">
                {existing.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-surface-700">
                      {e.professional?.full_name ?? 'Unknown'} · {ROLE_LABEL[e.professional_role]}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-surface-500">
                        {e.currency} {Number(e.total_amount).toLocaleString()}
                      </span>
                      <Badge variant={STATUS_VARIANT[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as BookableProfessional['role'])}
            options={[
              { value: 'investigator', label: 'Investigator' },
              { value: 'lawyer', label: 'Lawyer' },
              { value: 'medical_expert', label: 'Medical expert' },
            ]}
          />

          <Select
            label="Professional"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            options={[
              {
                value: '',
                label: professionals.length
                  ? 'Select…'
                  : `No verified ${ROLE_LABEL[role].toLowerCase()} available`,
              },
              ...professionals.map((p) => ({
                value: p.user_id,
                label: p.email && p.email !== p.full_name
                  ? `${p.full_name} — ${p.email}`
                  : p.full_name,
              })),
            ]}
          />

          {/*
            Flagged, not blocked. The work can be agreed now and the bank
            details added before the money moves — but an administrator should
            know a payout will have nowhere to go.
          */}
          {chosen && !chosen.has_payout_account && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                {chosen.full_name} has not added a payout account. You can still book
                this, but nothing can be transferred until they do.
              </p>
            </div>
          )}

          <Select
            label="Service"
            value={serviceKey}
            onChange={(e) => setServiceKey(e.target.value)}
            options={[
              { value: '', label: 'Select…' },
              ...services.map((s) => ({
                value: s.key,
                label: `${s.label} — ${s.currency} ${s.amount.toLocaleString()}`,
              })),
            ]}
          />

          <div>
            <label
              htmlFor="deposit-percent"
              className="mb-1.5 block text-sm font-medium text-surface-700"
            >
              Deposit to mobilise (%)
            </label>
            <input
              id="deposit-percent"
              type="number"
              min={1}
              max={100}
              value={depositPercent}
              onChange={(e) => setDepositPercent(e.target.value)}
              className="w-full rounded-lg border border-surface-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {split && service && (
            <div className="rounded-lg bg-surface-50 p-4">
              <p className="mb-3 text-xs font-medium text-surface-700">
                What this commits to
              </p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-surface-500">Total fee</dt>
                  <dd className="font-medium tabular-nums text-surface-900">
                    {money(service.amount)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-surface-500">
                    Security Watch commission ({Math.round(service.commission_rate * 100)}%)
                  </dt>
                  <dd className="tabular-nums text-surface-700">{money(split.commission)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-surface-500">Professional&apos;s share</dt>
                  <dd className="tabular-nums text-surface-700">{money(split.professional)}</dd>
                </div>
                <div className="mt-2 flex justify-between border-t border-surface-200 pt-2">
                  <dt className="font-medium text-surface-700">
                    Deposit requested now ({Math.round(depositRate * 100)}%)
                  </dt>
                  <dd className="font-semibold tabular-nums text-surface-900">
                    {money(split.deposit)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-surface-500">
                    &nbsp;&nbsp;of which accrues to them on payment
                  </dt>
                  <dd className="tabular-nums text-surface-700">
                    {money(split.depositProfessionalShare)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <TextArea
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Scope, agreed timeline, anything the record should carry."
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={saving} icon={Briefcase}>
              Book engagement
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
