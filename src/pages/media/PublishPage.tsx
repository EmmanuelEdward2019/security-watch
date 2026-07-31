import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  CheckCircle,
  XCircle,
  Building2,
  MapPin,
  Eye,
  ShieldAlert,
  Globe,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  TextArea,
  StatusBadge,
  EmptyState,
  Spinner,
  Modal,
  StatsCard,
  Badge,
} from '@/components/ui';
import { useMediaStore } from '@/stores/mediaStore';
import type { MediaReport, MediaStatus } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

type QueueTab = 'pending_review' | 'approved' | 'published' | 'rejected';

/**
 * Publication queue.
 *
 * Was a hardcoded list of already-published items with a scheduling form that
 * did nothing. This is now the real moderation gate: reports arrive as
 * `pending_review`, and only an administrator acting here can approve, publish or
 * reject one. Reporters can no longer publish their own work, which is what keeps
 * unreviewed allegations about named institutions off the public archive.
 */
export default function PublishPage() {
  const navigate = useNavigate();
  const { mediaReports, fetchMediaReports, reviewMediaReport, isLoading, error } = useMediaStore();

  const [tab, setTab] = useState<QueueTab>('pending_review');
  const [selected, setSelected] = useState<MediaReport | null>(null);
  const [decision, setDecision] = useState<MediaStatus | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    await fetchMediaReports();
  }, [fetchMediaReports]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const counts = useMemo(
    () => ({
      pending_review: mediaReports.filter((r) => r.status === 'pending_review').length,
      approved: mediaReports.filter((r) => r.status === 'approved').length,
      published: mediaReports.filter((r) => r.status === 'published').length,
      rejected: mediaReports.filter((r) => r.status === 'rejected').length,
    }),
    [mediaReports]
  );

  const visible = useMemo(
    () => mediaReports.filter((r) => r.status === tab),
    [mediaReports, tab]
  );

  const openDecision = (report: MediaReport, nextStatus: MediaStatus) => {
    setSelected(report);
    setDecision(nextStatus);
    setNote('');
  };

  const confirmDecision = async () => {
    if (!selected || !decision) return;

    if (decision === 'rejected' && note.trim().length < 10) {
      toast.error('Give the reporter a reason — at least 10 characters.');
      return;
    }

    setActing(true);
    const { error: reviewError } = await reviewMediaReport(selected.id, decision, note.trim() || undefined);
    setActing(false);

    if (reviewError) {
      toast.error(reviewError);
      return;
    }

    toast.success(
      decision === 'published'
        ? 'Published to the public archive.'
        : decision === 'approved'
          ? 'Approved. Publish it when you are ready.'
          : 'Rejected. The reporter has been notified.'
    );

    setSelected(null);
    setDecision(null);
    setNote('');
    await load();
  };

  const statusOf = (status: MediaStatus) =>
    status === 'published'
      ? 'completed'
      : status === 'approved'
        ? 'active'
        : status === 'rejected'
          ? 'rejected'
          : 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Publication queue</h1>
        <p className="text-surface-500 mt-1">
          Review what agents have filed before it reaches the public archive. Publishing makes a
          report visible to anyone.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <ShieldAlert size={20} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-0.5">Publishing names an institution publicly</p>
          <p>
            Check that the recording supports the claim being made, that the institution is correctly
            identified, and that no bystander is identifiable without cause. A published report can be
            quoted and carries legal weight for the platform.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Awaiting review" value={counts.pending_review} icon={Eye} variant="warning" />
        <StatsCard label="Approved" value={counts.approved} icon={CheckCircle} variant="brand" />
        <StatsCard label="Published" value={counts.published} icon={Globe} variant="success" />
        <StatsCard label="Rejected" value={counts.rejected} icon={XCircle} />
      </div>

      <div
        role="tablist"
        aria-label="Filter the queue"
        className="flex flex-wrap gap-2 border-b border-surface-200 pb-3"
      >
        {(
          [
            ['pending_review', `Awaiting review (${counts.pending_review})`],
            ['approved', `Approved (${counts.approved})`],
            ['published', `Published (${counts.published})`],
            ['rejected', `Rejected (${counts.rejected})`],
          ] as [QueueTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              tab === id ? 'bg-brand-500 text-white' : 'text-surface-600 hover:bg-surface-100'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Send}
          title={tab === 'pending_review' ? 'Nothing waiting for review' : 'Nothing here'}
          description={
            tab === 'pending_review'
              ? 'When a media agent files a field report, it will appear here for a decision.'
              : 'There are no reports with this status.'
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-surface-900 line-clamp-1">{report.title}</h2>
                    <p className="text-sm text-surface-500 flex items-center gap-1.5 mt-0.5">
                      <Building2 size={13} className="shrink-0" />
                      <span className="truncate">
                        {report.institution?.name ?? 'Unknown institution'}
                        {report.institution?.location ? ` · ${report.institution.location}` : ''}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{report.media_type}</Badge>
                    <StatusBadge status={statusOf(report.status)} />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-surface-700 whitespace-pre-line">{report.description}</p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-surface-400">
                  <span>
                    Filed {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })} ·{' '}
                    {format(new Date(report.created_at), 'd MMM yyyy, HH:mm')}
                  </span>
                  <span>by {report.reporter?.full_name ?? 'Unknown agent'}</span>
                  {report.gps_latitude != null && report.gps_longitude != null && (
                    <span className="flex items-center gap-1 tabular-nums">
                      <MapPin size={11} />
                      {report.gps_latitude.toFixed(5)}, {report.gps_longitude.toFixed(5)}
                    </span>
                  )}
                </div>

                {report.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {report.tags.map((tag) => (
                      <Badge key={tag} variant="default">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Eye}
                    onClick={() => navigate(`/app/media/${report.id}`)}
                  >
                    Review the recording
                  </Button>

                  {report.status === 'pending_review' && (
                    <>
                      <Button
                        size="sm"
                        icon={CheckCircle}
                        onClick={() => openDecision(report, 'approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={XCircle}
                        onClick={() => openDecision(report, 'rejected')}
                      >
                        Reject
                      </Button>
                    </>
                  )}

                  {report.status === 'approved' && (
                    <>
                      <Button
                        size="sm"
                        icon={Globe}
                        onClick={() => openDecision(report, 'published')}
                      >
                        Publish
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={XCircle}
                        onClick={() => openDecision(report, 'rejected')}
                      >
                        Reject
                      </Button>
                    </>
                  )}

                  {report.status === 'published' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={XCircle}
                      onClick={() => openDecision(report, 'approved')}
                    >
                      Unpublish
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!selected && !!decision}
        onClose={() => {
          setSelected(null);
          setDecision(null);
        }}
        title={
          decision === 'published'
            ? 'Publish this report'
            : decision === 'approved'
              ? 'Approve this report'
              : 'Reject this report'
        }
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600">
            {decision === 'published' ? (
              <>
                <strong>{selected?.title}</strong> will become visible to anyone, including
                unauthenticated visitors, and will be attributed to{' '}
                {selected?.institution?.name ?? 'the named institution'}.
              </>
            ) : decision === 'approved' ? (
              <>
                <strong>{selected?.title}</strong> will be marked approved. It stays out of the
                public archive until you publish it.
              </>
            ) : (
              <>
                <strong>{selected?.title}</strong> will be rejected and the reporter notified. Tell
                them why so they can correct it.
              </>
            )}
          </p>

          <TextArea
            label={decision === 'rejected' ? 'Reason (required)' : 'Note to the reporter (optional)'}
            placeholder={
              decision === 'rejected'
                ? 'e.g. The institution in the footage does not match the one selected.'
                : 'Anything the reporter should know.'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
          />

          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setSelected(null);
                setDecision(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              variant={decision === 'rejected' ? 'danger' : 'primary'}
              loading={acting}
              disabled={acting}
              onClick={() => void confirmDecision()}
            >
              {decision === 'published'
                ? 'Publish'
                : decision === 'approved'
                  ? 'Approve'
                  : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
