import { useCallback, useEffect, useState } from 'react';
import {
  DataTable,
  Badge,
  Modal,
  Button,
  TextArea,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { supabase, STORAGE_BUCKETS, resolveStorageUrl } from '@/lib/supabase';
import { reviewInvestigator } from '@/services/adminService';
import type { Investigator } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

/**
 * Opens a KYC document.
 *
 * `kyc-documents` is a private bucket, so these rows hold an object path and the
 * URL has to be signed at click time. The page previously rendered the stored
 * value straight into `href` and `src`, which meant the reviewing admin could
 * never actually see the ID they were being asked to approve.
 *
 * `resolveStorageUrl` also recovers a path from the legacy public URLs written
 * before that was fixed, so older applications still open.
 */
function KycDocumentLink({
  path,
  label,
  preview = false,
}: {
  path: string;
  label: string;
  preview?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const signed = await resolveStorageUrl(STORAGE_BUCKETS.KYC_DOCUMENTS, path, 600);
      if (!cancelled) {
        setUrl(signed);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (loading) return <span className="text-sm text-surface-400">Loading\u2026</span>;
  if (!url) {
    return (
      <span className="text-sm text-accent-600" title={path}>
        Unavailable
      </span>
    );
  }

  if (preview) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <img src={url} alt={label} className="w-full h-40 object-cover" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-brand-600 hover:underline"
    >
      {label}
    </a>
  );
}

export function AgentVerificationTab() {
  const [agents, setAgents] = useState<(Investigator & { profile?: { full_name: string; avatar_url?: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<(Investigator & { profile?: { full_name: string; avatar_url?: string } }) | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('investigators')
      .select('*, profile:profiles!user_id(full_name, avatar_url)')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setAgents((data as typeof agents) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  /**
   * Approving an agent both marks the record verified and grants the role they
   * applied for, in one transaction.
   *
   * `investigators.verification_status` is pinned by a trigger — an investigator
   * used to be able to approve themselves and then receive real case
   * assignments. Direct UPDATEs are now reverted and logged, so this has to go
   * through the RPC.
   */
  const handleApprove = async () => {
    if (!selected) return;
    setProcessing(true);
    const { error } = await reviewInvestigator(selected.id, 'approved', notes || undefined);
    setProcessing(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Agent approved and their role granted.');
    setSelected(null);
    setNotes('');
    void loadAgents();
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!notes.trim()) {
      toast.error('Give the applicant a reason for the rejection.');
      return;
    }
    setProcessing(true);
    const { error } = await reviewInvestigator(selected.id, 'rejected', notes);
    setProcessing(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Agent rejected and notified.');
    setSelected(null);
    setNotes('');
    void loadAgents();
  };

  const columns: Column<Investigator & { profile?: { full_name: string } }>[] = [
    {
      id: 'name',
      header: 'Agent',
      accessor: (row) => (row.profile as { full_name?: string })?.full_name,
      render: (v) => <span className="font-medium">{String(v ?? 'Unknown')}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'verification_status',
      render: (v) => (
        <Badge variant={v === 'approved' ? 'success' : v === 'rejected' ? 'danger' : 'warning'}>
          {String(v)}
        </Badge>
      ),
    },
    {
      id: 'date',
      header: 'Submitted',
      accessor: 'created_at',
      render: (v) => format(new Date(String(v)), 'MMM d, yyyy'),
    },
    {
      id: 'docs',
      header: 'Documents',
      accessor: () => null,
      render: (_, row) => (
        <div className="flex gap-2">
          {row.id_document_url && (
            <KycDocumentLink path={row.id_document_url} label="ID" />
          )}
          {row.service_records_url && (
            <KycDocumentLink path={row.service_records_url} label="Records" />
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      accessor: () => null,
      render: (_, row) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          className="text-sm text-brand-600 hover:underline font-medium"
        >
          Review
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
        <DataTable
          columns={columns}
          data={agents}
          loading={loading}
          emptyMessage="No agent verifications"
        />
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Review Agent" size="2xl">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="font-medium">{(selected.profile as { full_name?: string })?.full_name ?? 'Unknown'}</p>
              <p className="text-sm text-surface-500">Rating: {selected.rating}/5 • Specialization: {selected.specialization?.join(', ')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {selected.id_document_url && (
                <div>
                  <p className="text-sm font-medium text-surface-700 mb-2">ID Document</p>
                  <KycDocumentLink path={selected.id_document_url} label="ID document" preview />
                </div>
              )}
              {selected.service_records_url && (
                <div>
                  <p className="text-sm font-medium text-surface-700 mb-2">Service Records</p>
                  <KycDocumentLink path={selected.service_records_url} label="View document" />
                </div>
              )}
            </div>
            <TextArea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add review notes..."
            />
            <div className="flex gap-2">
              <Button variant="danger" onClick={handleReject} loading={processing}>
                Reject
              </Button>
              <Button onClick={handleApprove} loading={processing}>
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
