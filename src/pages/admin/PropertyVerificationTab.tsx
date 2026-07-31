import { useCallback, useEffect, useState } from 'react';
import {
  DataTable,
  type Column,
  Badge,
  Modal,
  Button,
  TextArea,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { setPropertyStatus } from '@/services/adminService';
import type { Property } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export function PropertyVerificationTab() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Property | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('properties')
      .select('*, owner:profiles!owner_id(full_name, avatar_url)')
      .in('status', ['pending', 'unverified'])
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setProperties((data as Property[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  /**
   * Grants the verified badge and marks the title documents checked.
   *
   * `properties.status` is pinned by a trigger — an owner used to be able to
   * stamp their own listing verified, which is the whole value of the badge — so
   * this goes through an admin-only RPC.
   */
  const handleApprove = async () => {
    if (!selected) return;
    setProcessing(true);
    const { error } = await setPropertyStatus(selected.id, 'verified');
    setProcessing(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Property verified. The badge is now live on the listing.');
    setSelected(null);
    setNotes('');
    void loadProperties();
  };

  const handleReject = async () => {
    if (!selected) return;
    setProcessing(true);
    const { error } = await setPropertyStatus(selected.id, 'unverified');
    setProcessing(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Verification declined.');
    setSelected(null);
    setNotes('');
    void loadProperties();
  };

  const columns: Column<Property>[] = [
    {
      id: 'title',
      header: 'Property',
      accessor: 'title',
      render: (v) => <span className="font-medium">{String(v)}</span>,
    },
    {
      id: 'owner',
      header: 'Owner',
      accessor: (row) => (row.owner as { full_name?: string })?.full_name,
      render: (v) => <span>{String(v ?? '—')}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      render: (v) => (
        <Badge variant={v === 'verified' ? 'success' : v === 'rejected' ? 'danger' : 'warning'}>
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
          data={properties}
          loading={loading}
          emptyMessage="No property verifications"
        />
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Review Property" size="lg">
        {selected && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">{selected.title}</h3>
              <p className="text-surface-600 mt-1">{selected.description}</p>
              <p className="text-sm text-surface-500 mt-2">
                {selected.location} • {selected.currency} {selected.price.toLocaleString()}
              </p>
            </div>
            {selected.images?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-surface-700 mb-2">Images</p>
                <div className="grid grid-cols-3 gap-2">
                  {selected.images.slice(0, 6).map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      className="rounded-lg h-24 object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
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
