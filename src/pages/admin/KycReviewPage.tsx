import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  FileText,
  Users,
  Download,
  Check,
  X,
  Mail,
  Phone,
  Award,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Modal,
  TextArea,
  Spinner,
  EmptyState,
  StatsCard,
  Badge,
  StatusBadge,
  Avatar,
} from '@/components/ui';
import { supabase, STORAGE_BUCKETS, resolveStorageUrl } from '@/lib/supabase';
import { reviewInvestigator } from '@/services/adminService';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

/**
 * KYC review.
 *
 * The previous screen showed a name, a rating and two thumbnails. An admin
 * approving an application is deciding who may read criminal case files,
 * complainant identities and filed evidence — that decision needs the whole
 * submission in front of it.
 *
 * Everything is assembled server-side by `admin_kyc_application()`: the profile,
 * the full application, every guarantor, every document, and the audit history
 * of the record.
 */

interface QueueRow {
  investigator_id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  applied_for_role: string | null;
  requested_role: string | null;
  verification_status: string;
  submitted_at: string | null;
  waiting_days: number | null;
  document_count: number;
  guarantor_count: number;
  has_id: boolean;
  has_summary: boolean;
  is_complete: boolean;
}

interface Application {
  investigator: Record<string, unknown>;
  admin_notes: string | null;
  profile: Record<string, unknown>;
  guarantors: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  history: { action: string; severity: string; details: Record<string, unknown>; at: string }[];
}

const DOC_LABELS: Record<string, string> = {
  national_id: 'National ID',
  passport: 'Passport',
  drivers_license: "Driver's licence",
  service_record: 'Service record',
  academic_certificate: 'Academic certificate',
  professional_certificate: 'Professional certificate',
  call_to_bar: 'Call to bar',
  medical_license: 'Medical licence',
  police_clearance: 'Police clearance',
  reference_letter: 'Reference letter',
  proof_of_address: 'Proof of address',
  cv: 'CV',
  other: 'Other',
};

/** Signs a private KYC object at click time — these are never public URLs. */
function DocumentLink({ path, label }: { path: string; label: string }) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    const url = await resolveStorageUrl(STORAGE_BUCKETS.KYC_DOCUMENTS, path, 600);
    setBusy(false);
    if (!url) {
      toast.error('That document could not be opened.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Button variant="outline" size="sm" icon={Download} loading={busy} onClick={() => void open()}>
      {label}
    </Button>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  const text = value == null || value === '' ? '—' : String(value);
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-surface-400">{label}</p>
      <p className="text-sm text-surface-800">{text}</p>
    </div>
  );
}

export default function KycReviewPage() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Application | null>(null);
  const [loadingApp, setLoadingApp] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_kyc_queue', { p_status: status });
    if (error) toast.error(error.message);
    setQueue((data ?? []) as QueueRow[]);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const openApplication = async (investigatorId: string) => {
    setLoadingApp(true);
    const { data, error } = await supabase.rpc('admin_kyc_application', {
      p_investigator_id: investigatorId,
    });
    setLoadingApp(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setSelected(data as Application);
    setNotes('');
  };

  const submitDecision = async () => {
    if (!selected || !decision) return;
    const inv = selected.investigator as { id: string };

    if (decision === 'rejected' && notes.trim().length < 10) {
      toast.error('Give the applicant a reason — at least 10 characters.');
      return;
    }

    setActing(true);
    const { error } = await reviewInvestigator(inv.id, decision, notes.trim() || undefined);
    setActing(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(
      decision === 'approved'
        ? 'Approved. The applicant now holds the role they applied for.'
        : 'Rejected. The applicant has been notified with your notes.'
    );
    setDecision(null);
    setSelected(null);
    await load();
  };

  const stats = useMemo(
    () => ({
      total: queue.length,
      complete: queue.filter((q) => q.is_complete).length,
      incomplete: queue.filter((q) => !q.is_complete).length,
      waiting: queue.filter((q) => (q.waiting_days ?? 0) >= 3).length,
    }),
    [queue]
  );

  const inv = (selected?.investigator ?? {}) as Record<string, string | number | string[] | null>;
  const prof = (selected?.profile ?? {}) as Record<string, string | null>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Verification review</h1>
        <p className="mt-1 text-surface-500">
          Approving an application grants the role applied for and lets that person read case files,
          complainant identities and filed evidence. Read the whole submission first.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label="In queue" value={stats.total} icon={FileText} />
        <StatsCard label="Complete" value={stats.complete} icon={ShieldCheck} variant="success" />
        <StatsCard label="Incomplete" value={stats.incomplete} icon={AlertTriangle} variant="warning" />
        <StatsCard label="Waiting 3+ days" value={stats.waiting} icon={Clock} variant={stats.waiting ? 'accent' : 'default'} />
      </div>

      <div role="tablist" className="flex flex-wrap gap-2 border-b border-surface-200 pb-3">
        {(
          [
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
          ] as [string, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={status === id}
            onClick={() => setStatus(id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              status === id ? 'bg-brand-500 text-white' : 'text-surface-600 hover:bg-surface-100'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={status === 'pending' ? 'Nothing awaiting review' : 'Nothing here'}
          description="Applications appear here when a professional submits their verification."
        />
      ) : (
        <div className="space-y-3">
          {queue.map((row) => (
            <Card key={row.investigator_id}>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <Avatar name={row.full_name} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-surface-900">{row.full_name}</p>
                    <Badge variant="info">
                      {(row.applied_for_role ?? row.requested_role ?? 'investigator').replace(/_/g, ' ')}
                    </Badge>
                    {row.is_complete ? (
                      <Badge variant="success">Complete</Badge>
                    ) : (
                      <Badge variant="warning">Incomplete</Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-surface-500">{row.email}</p>
                  <p className="mt-0.5 text-xs text-surface-400 tabular-nums">
                    {row.document_count} document{row.document_count === 1 ? '' : 's'} ·{' '}
                    {row.guarantor_count} guarantor{row.guarantor_count === 1 ? '' : 's'}
                    {row.submitted_at && (
                      <> · submitted {formatDistanceToNow(new Date(row.submitted_at), { addSuffix: true })}</>
                    )}
                  </p>
                </div>

                {(row.waiting_days ?? 0) >= 3 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                    <Clock size={12} /> {row.waiting_days}d
                  </span>
                )}

                <Button
                  size="sm"
                  loading={loadingApp}
                  onClick={() => void openApplication(row.investigator_id)}
                >
                  Review
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Full application ─────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Verification application"
        /* Identity documents, service records and guarantors, read side by
           side. `lg` gave this a phone-width column on a desktop screen. */
        size="2xl"
        footer={
          selected && inv.verification_status === 'pending' ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="ghost"
                className="flex-1"
                icon={X}
                onClick={() => setDecision('rejected')}
              >
                Reject
              </Button>
              <Button className="flex-1" icon={Check} onClick={() => setDecision('approved')}>
                Approve &amp; grant role
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <Avatar src={prof.avatar_url ?? undefined} name={prof.full_name ?? ''} size="lg" />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-surface-900">{prof.full_name}</p>
                <p className="text-sm text-surface-500 flex flex-wrap items-center gap-x-3">
                  <span className="inline-flex items-center gap-1"><Mail size={12} />{prof.email}</span>
                  {prof.phone && <span className="inline-flex items-center gap-1"><Phone size={12} />{prof.phone}</span>}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Badge variant="info">
                    Applying as{' '}
                    {String(inv.applied_for_role ?? prof.requested_role ?? 'investigator').replace(/_/g, ' ')}
                  </Badge>
                  <StatusBadge
                    status={
                      inv.verification_status === 'approved'
                        ? 'verified'
                        : inv.verification_status === 'rejected'
                          ? 'rejected'
                          : 'pending'
                    }
                  />
                </div>
              </div>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-surface-900">Identity</h3>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-50 p-3 sm:grid-cols-3">
                <Field label="Date of birth" value={inv.date_of_birth} />
                <Field label="Gender" value={inv.gender} />
                <Field label="Nationality" value={inv.nationality} />
                <Field label="National ID" value={inv.national_id_number} />
                <Field label="State" value={inv.state_of_residence} />
                <Field label="Member since" value={prof.member_since ? format(new Date(prof.member_since), 'd MMM yyyy') : null} />
              </div>
              <div className="mt-2">
                <Field label="Residential address" value={inv.residential_address} />
              </div>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-900">
                <Briefcase size={14} /> Professional
              </h3>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-50 p-3 sm:grid-cols-3">
                <Field label="Experience" value={inv.experience_years ? `${inv.experience_years} years` : null} />
                <Field label="Service area" value={inv.service_area} />
                <Field label="Licence no." value={inv.license_number} />
                <Field label="Licensing body" value={inv.licensing_body} />
                <Field label="Previous employer" value={inv.previous_employer} />
                <Field label="Previous position" value={inv.previous_position} />
              </div>

              {Array.isArray(inv.specialization) && inv.specialization.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(inv.specialization as string[]).map((sp) => (
                    <Badge key={sp} variant="default">{sp}</Badge>
                  ))}
                </div>
              )}

              {inv.professional_summary && (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-surface-400">Summary</p>
                  <p className="whitespace-pre-line text-sm text-surface-700">
                    {String(inv.professional_summary)}
                  </p>
                </div>
              )}
              {inv.qualifications && (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-surface-400">Qualifications</p>
                  <p className="whitespace-pre-line text-sm text-surface-700">
                    {String(inv.qualifications)}
                  </p>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-900">
                <Award size={14} /> Documents ({selected.documents.length + (inv.id_document_url ? 1 : 0) + (inv.service_records_url ? 1 : 0)})
              </h3>
              <div className="flex flex-wrap gap-2">
                {inv.id_document_url && (
                  <DocumentLink path={String(inv.id_document_url)} label="Government ID" />
                )}
                {inv.service_records_url && (
                  <DocumentLink path={String(inv.service_records_url)} label="Service records" />
                )}
                {selected.documents.map((d) => (
                  <DocumentLink
                    key={String(d.id)}
                    path={String(d.file_path)}
                    label={
                      (d.label as string) ||
                      DOC_LABELS[String(d.document_type)] ||
                      String(d.file_name)
                    }
                  />
                ))}
                {selected.documents.length === 0 && !inv.id_document_url && (
                  <p className="text-sm text-accent-600">No documents submitted.</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-900">
                <Users size={14} /> Guarantors ({selected.guarantors.length})
              </h3>
              {selected.guarantors.length === 0 ? (
                <p className="text-sm text-accent-600">
                  No guarantors provided. Two are required.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selected.guarantors.map((g) => (
                    <li key={String(g.id)} className="rounded-lg border border-surface-200 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-surface-900">{String(g.full_name)}</p>
                          <p className="text-sm text-surface-500">
                            {String(g.relationship)} · {String(g.email)} · {String(g.phone)}
                          </p>
                        </div>
                        {g.id_document_url ? (
                          <DocumentLink path={String(g.id_document_url)} label="ID" />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {selected.admin_notes && (
              <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
                <p className="text-xs uppercase tracking-wide text-surface-400">Previous notes</p>
                <p className="text-sm text-surface-700">{selected.admin_notes}</p>
              </div>
            )}

          </div>
        )}
      </Modal>

      {/* ── Decision ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={decision !== null}
        onClose={() => setDecision(null)}
        title={decision === 'approved' ? 'Approve this application' : 'Reject this application'}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            {decision === 'approved' ? (
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600" />
            ) : (
              <ShieldAlert size={20} className="mt-0.5 shrink-0 text-accent-600" />
            )}
            <p className="text-sm text-surface-700">
              {decision === 'approved' ? (
                <>
                  <strong>{prof.full_name}</strong> will be granted the{' '}
                  <strong>
                    {String(inv.applied_for_role ?? prof.requested_role ?? 'investigator').replace(
                      /_/g,
                      ' '
                    )}
                  </strong>{' '}
                  role and their KYC marked approved. They will be able to be assigned to cases and
                  read the evidence filed on them.
                </>
              ) : (
                <>
                  <strong>{prof.full_name}</strong> will be notified with your notes and may
                  resubmit. Their role is unchanged.
                </>
              )}
            </p>
          </div>

          <TextArea
            label={decision === 'rejected' ? 'Reason (required)' : 'Notes (optional)'}
            placeholder={
              decision === 'rejected'
                ? 'e.g. The service record does not cover the period claimed, and the second guarantor could not be reached.'
                : 'Anything worth recording about this decision.'
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              variant={decision === 'rejected' ? 'danger' : 'primary'}
              loading={acting}
              disabled={acting}
              onClick={() => void submitDecision()}
            >
              {decision === 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
