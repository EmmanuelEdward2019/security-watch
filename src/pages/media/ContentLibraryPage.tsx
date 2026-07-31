import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, Library, Film, Music, Image as ImageIcon, FileText, Eye, Building2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Select,
  StatusBadge,
  EmptyState,
  Spinner,
  StatsCard,
} from '@/components/ui';
import { useMediaStore } from '@/stores/mediaStore';
import type { MediaReport, MediaStatus } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const MEDIA_ICONS = {
  video: Film,
  audio: Music,
  photo: ImageIcon,
  document: FileText,
} as const;

/**
 * Full media archive for administrators.
 *
 * Was a hardcoded `mockMedia` array. Reads every report now, at any status, with
 * search and filtering — the counterpart to the publish queue, which only shows
 * what is waiting for a decision.
 */
export default function ContentLibraryPage() {
  const navigate = useNavigate();
  const { mediaReports, fetchMediaReports, isLoading, error } = useMediaStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MediaStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async () => {
    await fetchMediaReports();
  }, [fetchMediaReports]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return mediaReports.filter((report) => {
      if (statusFilter && report.status !== statusFilter) return false;
      if (typeFilter && report.media_type !== typeFilter) return false;
      if (!term) return true;
      return (
        report.title.toLowerCase().includes(term) ||
        report.description?.toLowerCase().includes(term) ||
        report.institution?.name?.toLowerCase().includes(term) ||
        report.tags?.some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [mediaReports, search, statusFilter, typeFilter]);

  const stats = useMemo(
    () => ({
      total: mediaReports.length,
      published: mediaReports.filter((r) => r.status === 'published').length,
      pending: mediaReports.filter((r) => r.status === 'pending_review').length,
      views: mediaReports.reduce((sum, r) => sum + (r.views ?? 0), 0),
    }),
    [mediaReports]
  );

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
        <h1 className="text-2xl font-bold text-surface-900">Content library</h1>
        <p className="text-surface-500 mt-1">
          Every field report filed against an institution, at any stage of review.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total reports" value={stats.total} icon={Library} />
        <StatsCard label="Published" value={stats.published} icon={Eye} variant="success" />
        <StatsCard label="Awaiting review" value={stats.pending} icon={FileText} variant="warning" />
        <StatsCard label="Total views" value={stats.views} icon={Eye} variant="brand" />
      </div>

      <Card>
        <CardHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              icon={Search}
              placeholder="Search title, institution or tag"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search the library"
            />
            <Select
              options={[
                { value: '', label: 'All statuses' },
                { value: 'pending_review', label: 'Awaiting review' },
                { value: 'approved', label: 'Approved' },
                { value: 'published', label: 'Published' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MediaStatus | '')}
              aria-label="Filter by status"
            />
            <Select
              options={[
                { value: '', label: 'All media types' },
                { value: 'video', label: 'Video' },
                { value: 'audio', label: 'Audio' },
                { value: 'photo', label: 'Photo' },
                { value: 'document', label: 'Document' },
              ]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by media type"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Library}
              title={mediaReports.length === 0 ? 'The library is empty' : 'Nothing matches'}
              description={
                mediaReports.length === 0
                  ? 'Reports filed by media agents will be collected here.'
                  : 'Try a different search or clear the filters.'
              }
            />
          ) : (
            <ul className="divide-y divide-surface-100">
              {visible.map((report: MediaReport) => {
                const Icon = MEDIA_ICONS[report.media_type] ?? FileText;
                return (
                  <li key={report.id} className="flex flex-wrap gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="mt-0.5 shrink-0 rounded-lg bg-surface-100 p-2.5">
                      <Icon size={18} className="text-surface-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="font-medium text-surface-900 line-clamp-1">{report.title}</h2>
                        <StatusBadge status={statusOf(report.status)} />
                      </div>

                      <p className="text-sm text-surface-500 flex items-center gap-1.5 mt-0.5">
                        <Building2 size={12} className="shrink-0" />
                        <span className="truncate">
                          {report.institution?.name ?? 'Unknown institution'}
                        </span>
                      </p>

                      <p className="text-sm text-surface-600 line-clamp-2 mt-1">
                        {report.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-surface-400">
                        <span>{format(new Date(report.created_at), 'd MMM yyyy')}</span>
                        <span className="capitalize">{report.media_type}</span>
                        <span className="tabular-nums">{report.views ?? 0} views</span>
                        {report.gps_latitude != null && report.gps_longitude != null && (
                          <span className="tabular-nums">
                            {report.gps_latitude.toFixed(4)}, {report.gps_longitude.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Eye}
                        onClick={() => navigate(`/app/media/${report.id}`)}
                      >
                        Open
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
