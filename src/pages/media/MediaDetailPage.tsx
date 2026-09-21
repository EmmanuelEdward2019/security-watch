import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, Eye, Video, Image, Mic, FileText } from 'lucide-react';
import { useMediaStore } from '@/stores/mediaStore';
import {
  Button,
  Card,
  CardContent,
  Avatar,
  Badge,
  Spinner,
  EmptyState,
} from '@/components/ui';
import { formatDistanceToNow } from 'date-fns';
const MEDIA_TYPE_ICONS: Record<string, typeof Video> = {
  video: Video,
  audio: Mic,
  photo: Image,
  document: FileText,
};

export function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    currentReport,
    mediaReports,
    isLoading,
    fetchMediaReport,
    fetchMediaReports,
    getMediaUrl,
    recordView,
  } = useMediaStore();

  // The bucket is private and the row stores an object path, so playback needs a
  // short-lived signed URL. Previously a public URL was stored for a private
  // bucket, which never resolved — media simply did not play.
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState(false);

  useEffect(() => {
    if (id) void fetchMediaReport(id);
    void fetchMediaReports({ status: 'published' });
  }, [id, fetchMediaReport, fetchMediaReports]);

  useEffect(() => {
    if (!currentReport) return;

    let cancelled = false;
    setMediaUrl(null);
    setUrlError(false);

    void (async () => {
      const url = await getMediaUrl(currentReport);
      if (cancelled) return;
      if (url) setMediaUrl(url);
      else setUrlError(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentReport, getMediaUrl]);

  // Counted once per mount, through an RPC — `views` is not a writable column.
  useEffect(() => {
    if (currentReport?.status === 'published' && currentReport.id) {
      void recordView(currentReport.id);
    }
  }, [currentReport?.id, currentReport?.status, recordView]);

  const relatedReports = mediaReports
    .filter((r) => r.id !== id && r.institution_id === currentReport?.institution_id)
    .slice(0, 3);

  if (isLoading && !currentReport) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!currentReport) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          title="Report not found"
          description="This media report may have been removed or doesn't exist."
          action={
            <Link to="/app/media">
              <Button variant="outline">Back to Feed</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const MediaIcon = MEDIA_TYPE_ICONS[currentReport.media_type] ?? Video;
  const isVideo = currentReport.media_type === 'video';
  const isAudio = currentReport.media_type === 'audio';
  const isImage = currentReport.media_type === 'photo';

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/app/media"
          className="inline-flex items-center gap-2 text-sm text-surface-600 hover:text-brand-600 mb-6"
        >
          <ChevronLeft size={16} />
          Back to feed
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid lg:grid-cols-3 gap-8"
        >
          {/* Media player */}
          <div className="lg:col-span-2">
            <div className="rounded-xl overflow-hidden bg-black aspect-video">
              {urlError ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-white p-8 text-center">
                  <FileText size={48} className="mb-3 opacity-50" />
                  <p className="text-sm text-surface-300">
                    This recording is not available to you. Reports are visible to the agent who
                    filed them, to administrators, and to everyone once published.
                  </p>
                </div>
              ) : !mediaUrl ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Spinner size="lg" />
                </div>
              ) : (
                <>
                  {isVideo && (
                    <video
                      src={mediaUrl}
                      controls
                      className="w-full h-full"
                      poster={currentReport.thumbnail_url}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                  {isAudio && (
                    <div className="w-full h-full flex items-center justify-center bg-surface-900">
                      <audio src={mediaUrl} controls className="w-full max-w-md" />
                    </div>
                  )}
                  {isImage && (
                    <img
                      src={mediaUrl}
                      alt={currentReport.title}
                      className="w-full h-full object-contain"
                    />
                  )}
                  {!isVideo && !isAudio && !isImage && (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white p-8">
                      <FileText size={64} className="mb-4 opacity-50" />
                      <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-400 hover:underline"
                      >
                        Open document
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-4">
              <h1 className="text-2xl font-bold text-surface-900 mb-2">
                {currentReport.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-surface-600">
                <span className="flex items-center gap-1">
                  <Eye size={16} />
                  {currentReport.views} views
                </span>
                <span>
                  {formatDistanceToNow(new Date(currentReport.created_at), {
                    addSuffix: true,
                  })}
                </span>
                <Badge variant="info" size="sm">
                  {currentReport.media_type}
                </Badge>
              </div>
              {currentReport.description && (
                <p className="mt-4 text-surface-700 leading-relaxed">
                  {currentReport.description}
                </p>
              )}
              {currentReport.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {currentReport.tags.map((tag) => (
                    <Badge key={tag} variant="default" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Institution */}
            {currentReport.institution && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-surface-900 mb-2">
                    Institution
                  </h3>
                  <p className="text-surface-700">{currentReport.institution.name}</p>
                  <p className="text-sm text-surface-500 mt-1">
                    {currentReport.institution.type}
                  </p>
                  {currentReport.institution.location && (
                    <div className="flex items-center gap-1.5 mt-2 text-sm text-surface-600">
                      <MapPin size={14} className="text-brand-500" />
                      {currentReport.institution.location}
                    </div>
                  )}
                  <Link
                    to={`/app/media/institutions/${currentReport.institution.id}`}
                    className="inline-block mt-3 text-sm text-brand-600 hover:underline"
                  >
                    View institution details →
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Reporter */}
            {currentReport.reporter && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-surface-900 mb-2">Reporter</h3>
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={currentReport.reporter.avatar_url}
                      name={currentReport.reporter.full_name}
                      size="md"
                    />
                    <div>
                      <p className="font-medium text-surface-900">
                        {currentReport.reporter.full_name}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* GPS */}
            {(currentReport.gps_latitude != null || currentReport.gps_longitude != null) && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-surface-900 mb-2 flex items-center gap-2">
                    <MapPin size={18} className="text-brand-500" />
                    Location
                  </h3>
                  {/* The address is what tells a reviewer where this is at a
                      glance; the coordinates are what can be checked. Both,
                      in that order. */}
                  {currentReport.gps_address && (
                    <p className="text-sm font-medium text-surface-900">
                      {currentReport.gps_address}
                    </p>
                  )}
                  <p className="text-sm text-surface-600 tabular-nums">
                    {currentReport.gps_latitude?.toFixed(6)}, {currentReport.gps_longitude?.toFixed(6)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${currentReport.gps_latitude},${currentReport.gps_longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm text-brand-600 hover:underline"
                  >
                    View on map →
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>

        {/* Related reports */}
        {relatedReports.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-16"
          >
            <h2 className="text-xl font-semibold text-surface-900 mb-6">
              Related Reports
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedReports.map((r) => (
                <Link key={r.id} to={`/app/media/${r.id}`}>
                  <Card hover>
                    <div className="aspect-video bg-surface-100">
                      {r.thumbnail_url ? (
                        <img
                          src={r.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MediaIcon size={32} className="text-surface-400" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium text-surface-900 line-clamp-2 text-sm">
                        {r.title}
                      </h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
