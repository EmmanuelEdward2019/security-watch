import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DataTable,
  type Column,
  Badge,
  Modal,
  Button,
  Input,
  TextArea,
} from '@/components/ui';
import { useMediaStore } from '@/stores/mediaStore';
import type { MediaReport, MediaStatus } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export function MediaApprovalsPage() {
  const { mediaReports, fetchMediaReports, updateMediaReport } = useMediaStore();
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MediaReport | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchMediaReports({ status: 'pending_review' });
    setLoading(false);
  }, [fetchMediaReports]);

  useEffect(() => {
    if (selected) {
      setEditTitle(selected.title);
      setEditDescription(selected.description);
    }
  }, [selected]);

  const handleAction = async (status: MediaStatus) => {
    if (!selected) return;
    setProcessing(true);
    const updates: Partial<MediaReport> = { status };
    if (status === 'published') {
      updates.title = editTitle;
      updates.description = editDescription;
    }
    const { error } = await updateMediaReport(selected.id, updates);
    setProcessing(false);
    if (error) toast.error(error);
    else {
      toast.success(`Report ${status}`);
      setSelected(null);
      fetchMediaReports({ status: 'pending_review' });
    }
  };

  const columns: Column<MediaReport>[] = [
    {
      id: 'title',
      header: 'Title',
      accessor: 'title',
      render: (v) => <span className="font-medium">{String(v)}</span>,
    },
    {
      id: 'institution',
      header: 'Institution',
      accessor: (row) => (row.institution as { name?: string })?.name,
      render: (v) => <span>{String(v ?? '—')}</span>,
    },
    {
      id: 'type',
      header: 'Type',
      accessor: 'media_type',
      render: (v) => <Badge variant="info">{String(v)}</Badge>,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      render: (v) => <Badge variant="warning">{String(v)}</Badge>,
    },
    {
      id: 'date',
      header: 'Date',
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
          Preview
        </button>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-surface-900">Media Approvals</h1>

      <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
        <DataTable
          columns={columns}
          data={mediaReports}
          loading={loading}
          emptyMessage="No pending media reports"
        />
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Review Media" size="xl">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-surface-500 mb-1">Preview</p>
              {selected.media_type === 'video' ? (
                <div className="relative rounded-lg overflow-hidden bg-surface-900 aspect-video">
                  <video
                    src={selected.file_url}
                    controls
                    className="w-full h-full"
                  />
                </div>
              ) : selected.media_type === 'photo' ? (
                <img
                  src={selected.file_url}
                  alt={selected.title}
                  className="rounded-lg max-h-64 object-contain"
                />
              ) : (
                <a
                  href={selected.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  {selected.file_url}
                </a>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Edit title..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Description</label>
              <TextArea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Edit description..."
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="danger" onClick={() => handleAction('rejected')} loading={processing}>
                Reject
              </Button>
              <Button variant="secondary" onClick={() => handleAction('approved')} loading={processing}>
                Approve
              </Button>
              <Button onClick={() => handleAction('published')} loading={processing}>
                Publish
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
