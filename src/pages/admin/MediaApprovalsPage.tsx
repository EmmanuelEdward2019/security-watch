import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
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
import { STORAGE_BUCKETS, resolveStorageUrl } from '@/lib/supabase';
import type { MediaReport, MediaStatus } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export function MediaApprovalsPage() {
  const { mediaReports, fetchMediaReports, reviewMediaReport } = useMediaStore();
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MediaReport | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [processing, setProcessing] = useState(false);

  /**
   * `file_url` holds a storage *path* inside the private `media-reports` bucket,
   * not a URL. Feeding it straight to <video src> resolved it against the app
   * origin and 404'd, so nothing filed from the field was actually viewable —
   * an approval queue where the reviewer cannot see the evidence is worse than
   * no queue at all. Sign it on open instead, and let it expire with the modal.
   */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    if (!selected?.file_url) {
      setPreviewUrl(null);
      return;
    }

    let active = true;
    setPreviewUrl(null);
    setPreviewError(false);

    void resolveStorageUrl(STORAGE_BUCKETS.MEDIA_REPORTS, selected.file_url).then((url) => {
      if (!active) return;
      if (url) setPreviewUrl(url);
      else setPreviewError(true);
    });

    return () => {
      active = false;
    };
  }, [selected?.file_url]);

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

  /**
   * Records the moderation decision.
   *
   * Publication used to be a plain UPDATE the reporter themselves was allowed to
   * make, so unreviewed allegations about named institutions could go live
   * without an admin seeing them. It is an admin-only RPC now, which also
   * notifies the reporter and writes the audit entry.
   */
  const handleAction = async (status: MediaStatus) => {
    if (!selected) return;
    setProcessing(true);

    // Any admin copy-edits are saved before the status moves, because a report
    // stops being editable once it leaves review.
    if (
      status === 'published' &&
      (editTitle !== selected.title || editDescription !== selected.description)
    ) {
      await useMediaStore.getState().updateMediaReport(selected.id, {
        title: editTitle,
        description: editDescription,
      });
    }

    const { error } = await reviewMediaReport(selected.id, status);
    setProcessing(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success(
      status === 'published'
        ? 'Published to the public archive.'
        : status === 'approved'
          ? 'Approved.'
          : 'Rejected. The reporter has been notified.'
    );
    setSelected(null);
    void fetchMediaReports({ status: 'pending_review' });
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

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Review Media" size="2xl">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-surface-500 mb-1">Preview</p>
              {previewError ? (
                <p className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  This file could not be loaded from storage. It may have been removed, or the
                  path recorded on the report may not match the uploaded object.
                </p>
              ) : !previewUrl ? (
                <div className="flex items-center gap-2 rounded-lg bg-surface-100 p-4 text-sm text-surface-500">
                  <span className="h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                  Loading media…
                </div>
              ) : selected.media_type === 'video' ? (
                <div className="relative rounded-lg overflow-hidden bg-surface-900 aspect-video">
                  <video src={previewUrl} controls playsInline className="w-full h-full" />
                </div>
              ) : selected.media_type === 'audio' ? (
                <div className="rounded-lg bg-surface-100 p-4">
                  <audio src={previewUrl} controls className="w-full" />
                </div>
              ) : selected.media_type === 'photo' ? (
                <img
                  src={previewUrl}
                  alt={selected.title}
                  className="rounded-lg max-h-64 object-contain"
                />
              ) : (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  Open attachment
                </a>
              )}
            </div>
            {/*
              Where it was recorded. The review modal showed the file, the
              title and the description and nothing at all about place, so an
              administrator deciding whether a report about a named
              institution is plausible had no way to see whether it was even
              filmed in the right state. The address is stored at capture
              (033); the coordinates are the fallback and the thing that can
              actually be checked.
            */}
            {(selected.gps_address ||
              selected.gps_latitude != null ||
              selected.gps_longitude != null) && (
              <div className="flex items-start gap-2 rounded-lg border border-surface-200 bg-surface-50 p-3">
                <MapPin size={16} className="mt-0.5 shrink-0 text-brand-500" />
                <div className="min-w-0">
                  {selected.gps_address ? (
                    <p className="text-sm font-medium text-surface-900">{selected.gps_address}</p>
                  ) : (
                    <p className="text-sm text-surface-500">No address resolved for this fix.</p>
                  )}
                  {selected.gps_latitude != null && selected.gps_longitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${selected.gps_latitude},${selected.gps_longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs tabular-nums text-brand-600 hover:underline"
                    >
                      {selected.gps_latitude.toFixed(6)}, {selected.gps_longitude.toFixed(6)} — view on map
                    </a>
                  )}
                </div>
              </div>
            )}

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
