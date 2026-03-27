import { useEffect, useState } from 'react';
import {
  DataTable,
  Badge,
  Modal,
  Button,
  TextArea,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Investigator, VerificationStatus } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export function AgentVerificationTab() {
  const [agents, setAgents] = useState<(Investigator & { profile?: { full_name: string; avatar_url?: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<(Investigator & { profile?: { full_name: string; avatar_url?: string } }) | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setLoading(true);
    const { data } = await supabase
      .from('investigators')
      .select('*, profile:profiles!user_id(full_name, avatar_url)')
      .order('created_at', { ascending: false });
    setAgents((data as typeof agents) ?? []);
    setLoading(false);
  }

  const handleApprove = async () => {
    if (!selected) return;
    setProcessing(true);
    const { error } = await supabase
      .from('investigators')
      .update({ verification_status: 'approved' as VerificationStatus, admin_notes: notes })
      .eq('id', selected.id);
    setProcessing(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Agent approved');
      setSelected(null);
      setNotes('');
      loadAgents();
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setProcessing(true);
    const { error } = await supabase
      .from('investigators')
      .update({ verification_status: 'rejected' as VerificationStatus, admin_notes: notes })
      .eq('id', selected.id);
    setProcessing(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Agent rejected');
      setSelected(null);
      setNotes('');
      loadAgents();
    }
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
            <a
              href={row.id_document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 hover:underline"
            >
              ID
            </a>
          )}
          {row.service_records_url && (
            <a
              href={row.service_records_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 hover:underline"
            >
              Records
            </a>
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

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Review Agent" size="lg">
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
                  <a
                    href={selected.id_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border overflow-hidden"
                  >
                    <img src={selected.id_document_url} alt="ID" className="w-full h-40 object-cover" />
                  </a>
                </div>
              )}
              {selected.service_records_url && (
                <div>
                  <p className="text-sm font-medium text-surface-700 mb-2">Service Records</p>
                  <a
                    href={selected.service_records_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    View document
                  </a>
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
