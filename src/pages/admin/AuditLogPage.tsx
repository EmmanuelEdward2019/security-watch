import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Trash2,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Select,
  Spinner,
  EmptyState,
  StatsCard,
  Modal,
} from '@/components/ui';
import { fetchAuditLogs, fetchSecuritySummary, describeAuditAction } from '@/services/auditService';
import { fetchDeletionRequests, processDeletionRequest } from '@/services/adminService';
import type { AuditLogEntry, SecuritySummary, AccountDeletionRequest } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

const SEVERITY_STYLES: Record<AuditLogEntry['severity'], string> = {
  critical: 'bg-accent-100 text-accent-800',
  warning: 'bg-amber-100 text-amber-800',
  notice: 'bg-brand-100 text-brand-700',
  info: 'bg-surface-100 text-surface-600',
};

/**
 * The audit trail and the erasure queue.
 *
 * Both were absent. `auditService` existed but was never imported, so nothing
 * was ever recorded despite the platform claiming audit coverage of all critical
 * operations — and account deletion requests were dropped on the floor because
 * the table they were written to did not exist.
 *
 * Entries are written by database triggers rather than by the client, so they
 * appear whether or not the UI cooperates, and cannot be forged: client INSERT on
 * `audit_logs` is revoked.
 */
export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SecuritySummary | null>(null);

  const [severity, setSeverity] = useState<AuditLogEntry['severity'] | ''>('');
  const [resourceType, setResourceType] = useState('');

  const [deletions, setDeletions] = useState<AccountDeletionRequest[]>([]);
  const [selectedDeletion, setSelectedDeletion] = useState<AccountDeletionRequest | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const [logsResult, summaryResult, deletionsResult] = await Promise.all([
      fetchAuditLogs({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        severity: severity || undefined,
        resourceType: resourceType || undefined,
      }),
      fetchSecuritySummary(),
      fetchDeletionRequests(),
    ]);

    if (logsResult.error) toast.error(logsResult.error);

    setEntries(logsResult.entries);
    setTotal(logsResult.total);
    setSummary(summaryResult.summary);
    setDeletions(deletionsResult.requests);
    setLoading(false);
  }, [page, severity, resourceType]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDeletions = useMemo(
    () => deletions.filter((d) => d.status === 'pending' || d.status === 'processing'),
    [deletions]
  );

  const handleDeletion = async (action: 'approve' | 'reject') => {
    if (!selectedDeletion) return;

    if (
      action === 'approve' &&
      !window.confirm(
        `Erase ${selectedDeletion.email}? Personal data is anonymised and the login removed. Filed evidence and completed payments are retained for case integrity. This cannot be undone.`
      )
    ) {
      return;
    }

    setProcessing(true);
    const { error, retainedEvidence } = await processDeletionRequest(
      selectedDeletion.id,
      action
    );
    setProcessing(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(
      action === 'approve'
        ? retainedEvidence
          ? `Account erased. ${retainedEvidence} evidence record(s) retained and anonymised.`
          : 'Account erased.'
        : 'Request declined and the user notified.'
    );
    setSelectedDeletion(null);
    await load();
  };

  const exportCsv = () => {
    const header = ['timestamp', 'severity', 'action', 'resource', 'resource_id', 'actor', 'role'];
    const rows = entries.map((e) => [
      e.created_at,
      e.severity,
      e.action,
      e.resource_type,
      e.resource_id ?? '',
      e.actor_name ?? '',
      e.actor_role ?? '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Audit trail</h1>
          <p className="text-surface-500 mt-1">
            Every privileged action on the platform, written by the database rather than the
            application — so it is recorded whether or not the client cooperates.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </Button>
          <Button variant="outline" icon={Download} onClick={exportCsv} disabled={entries.length === 0}>
            Export page
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Blocked writes (24h)"
            value={summary.guardViolations24h}
            icon={ShieldAlert}
            variant={summary.guardViolations24h > 0 ? 'accent' : 'default'}
          />
          <StatsCard
            label="Critical events (7d)"
            value={summary.criticalEvents7d}
            icon={ShieldCheck}
            variant={summary.criticalEvents7d > 0 ? 'warning' : 'success'}
          />
          <StatsCard
            label="Unconfirmed roles"
            value={summary.unconfirmedPrivilegedRoles}
            icon={UserCog}
            variant={summary.unconfirmedPrivilegedRoles > 0 ? 'warning' : 'default'}
          />
          <StatsCard
            label="Erasure requests"
            value={summary.openDeletionRequests}
            icon={Trash2}
            variant={summary.openDeletionRequests > 0 ? 'warning' : 'default'}
          />
        </div>
      )}

      {summary && summary.guardViolationsTotal > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-accent-200 bg-accent-50 p-4">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-accent-600" />
          <div className="text-sm text-accent-900">
            <p className="font-semibold mb-0.5">
              {summary.guardViolationsTotal} blocked privileged write
              {summary.guardViolationsTotal === 1 ? '' : 's'} on record
            </p>
            <p>
              Each of these is an attempt to change a protected field — a role, a verification
              status, a case assignment, a published flag — directly against the API. The write was
              reverted. Filter by <strong>critical</strong> below to see who tried and what they
              targeted.
            </p>
          </div>
        </div>
      )}

      {openDeletions.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900 flex items-center gap-2">
              <Trash2 size={16} /> Erasure requests awaiting action
            </h2>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-surface-100">
              {openDeletions.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-surface-900 truncate">
                      {request.full_name || request.email}
                    </p>
                    <p className="text-sm text-surface-500 truncate">{request.email}</p>
                    {request.reason && (
                      <p className="text-sm text-surface-500 italic mt-0.5">"{request.reason}"</p>
                    )}
                    <p className="text-xs text-surface-400 mt-0.5">
                      Requested{' '}
                      {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                    </p>
                    {request.admin_notes && (
                      <p className="text-xs text-amber-700 mt-1">{request.admin_notes}</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelectedDeletion(request)}>
                    Review
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              options={[
                { value: '', label: 'All severities' },
                { value: 'critical', label: 'Critical' },
                { value: 'warning', label: 'Warning' },
                { value: 'notice', label: 'Notice' },
                { value: 'info', label: 'Info' },
              ]}
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value as AuditLogEntry['severity'] | '');
                setPage(0);
              }}
              aria-label="Filter by severity"
            />
            <Select
              options={[
                { value: '', label: 'All resources' },
                { value: 'profile', label: 'Profiles' },
                { value: 'case', label: 'Cases' },
                { value: 'evidence', label: 'Evidence' },
                { value: 'payment', label: 'Payments' },
                { value: 'property', label: 'Properties' },
                { value: 'media_report', label: 'Media reports' },
                { value: 'investigator', label: 'Investigators' },
                { value: 'conversation_participant', label: 'Conversation access' },
                { value: 'service_price', label: 'Pricing' },
              ]}
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value);
                setPage(0);
              }}
              aria-label="Filter by resource"
            />
            <p className="text-sm text-surface-500 self-center tabular-nums">
              {total.toLocaleString()} {total === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Nothing recorded"
              description="Privileged actions will appear here as they happen — role changes, verification decisions, evidence filings, payment settlements."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[48rem]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-surface-400">
                      <th className="pb-2 pr-4 font-medium">When</th>
                      <th className="pb-2 pr-4 font-medium">Severity</th>
                      <th className="pb-2 pr-4 font-medium">Action</th>
                      <th className="pb-2 pr-4 font-medium">Resource</th>
                      <th className="pb-2 pr-4 font-medium">Actor</th>
                      <th className="pb-2 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {entries.map((entry) => (
                      <tr key={entry.id} className="align-top">
                        <td className="py-3 pr-4 whitespace-nowrap text-surface-500">
                          <span title={format(new Date(entry.created_at), 'd MMM yyyy, HH:mm:ss')}>
                            {format(new Date(entry.created_at), 'd MMM HH:mm')}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={cn(
                              'rounded px-2 py-0.5 text-xs font-medium capitalize',
                              SEVERITY_STYLES[entry.severity]
                            )}
                          >
                            {entry.severity}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-medium text-surface-900">
                          {describeAuditAction(entry.action)}
                        </td>
                        <td className="py-3 pr-4 text-surface-600">
                          <span className="capitalize">{entry.resource_type.replace(/_/g, ' ')}</span>
                          {entry.resource_id && (
                            <span className="block text-xs font-mono text-surface-400">
                              {entry.resource_id.slice(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-surface-600">
                          {entry.actor_name ?? <span className="text-surface-400">system</span>}
                          {entry.actor_role && (
                            <span className="block text-xs text-surface-400 capitalize">
                              {entry.actor_role.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-surface-500">
                          {Object.keys(entry.details ?? {}).length > 0 ? (
                            <code className="text-xs break-all">
                              {JSON.stringify(entry.details).slice(0, 160)}
                            </code>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-surface-100 mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-surface-500 tabular-nums">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={!!selectedDeletion}
        onClose={() => setSelectedDeletion(null)}
        title="Account erasure request"
        size="md"
      >
        {selectedDeletion && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-surface-500">Account</p>
              <p className="font-medium text-surface-900">
                {selectedDeletion.full_name || '—'}
              </p>
              <p className="text-sm text-surface-600">{selectedDeletion.email}</p>
            </div>

            {selectedDeletion.reason && (
              <div>
                <p className="text-sm text-surface-500">Stated reason</p>
                <p className="text-surface-700">{selectedDeletion.reason}</p>
              </div>
            )}

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-800">
                Approving anonymises the profile and removes the login. Records the platform must
                retain — filed evidence, completed payments, case history — are kept with the
                identity stripped. If the account is still on an open case the request is refused
                until that case is closed or reassigned.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                className="flex-1"
                disabled={processing}
                onClick={() => void handleDeletion('reject')}
              >
                Decline
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={processing}
                disabled={processing}
                onClick={() => void handleDeletion('approve')}
              >
                Erase account
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
