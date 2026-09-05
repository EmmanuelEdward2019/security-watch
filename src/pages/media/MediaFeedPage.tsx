import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Eye, Video, Image, Mic, FileText } from 'lucide-react';
import { useMediaStore } from '@/stores/mediaStore';
import {
  Card,
  CardContent,
  Select,
  EmptyState,
  Spinner,
  Badge,
} from '@/components/ui';
import { formatDistanceToNow } from 'date-fns';
import type { MediaReport } from '@/types';

const MEDIA_TYPE_ICONS: Record<string, typeof Video> = {
  video: Video,
  audio: Mic,
  photo: Image,
  document: FileText,
};

const INSTITUTION_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'police', label: 'Police' },
  { value: 'school', label: 'School' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'market', label: 'Market' },
  { value: 'government', label: 'Government' },
  { value: 'court', label: 'Court' },
  { value: 'other', label: 'Other' },
];

export function MediaFeedPage() {
  const { mediaReports, isLoading, fetchMediaReports, fetchInstitutions } =
    useMediaStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [institutionTypeFilter, setInstitutionTypeFilter] = useState('');

  useEffect(() => {
    fetchMediaReports({ status: 'published' });
    fetchInstitutions();
  }, [fetchMediaReports, fetchInstitutions]);

  const filteredReports = mediaReports.filter((report) => {
    const matchesSearch =
      !searchQuery ||
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.institution?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      !institutionTypeFilter ||
      report.institution?.type === institutionTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <section className="bg-brand-700 text-white py-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl"
          >
            <h1 className="text-3xl md:text-4xl font-bold font-display mb-2">
              Media Feed
            </h1>
            <p className="text-brand-100 mb-6">
              Citizen-reported coverage of public institutions
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
                  size={20}
                />
                <input
                  type="search"
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
              <Select
                options={INSTITUTION_TYPE_OPTIONS}
                value={institutionTypeFilter}
                onChange={(e) => setInstitutionTypeFilter(e.target.value)}
                className="sm:w-48"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : filteredReports.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No media reports found"
            description="Check back later for new citizen-reported coverage."
          />
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredReports.map((report, index) => (
                <MediaReportCard key={report.id} report={report} index={index} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function MediaReportCard({
  report,
  index,
}: {
  report: MediaReport;
  index: number;
}) {
  const MediaIcon = MEDIA_TYPE_ICONS[report.media_type] ?? Video;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
    >
      <Link to={`/app/media/${report.id}`}>
        <Card hover className="h-full overflow-hidden">
          <div className="relative aspect-video bg-surface-100">
            {report.thumbnail_url ? (
              <img
                src={report.thumbnail_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-brand-50">
                <MediaIcon size={48} className="text-brand-400" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/50 text-white text-xs">
              <Eye size={14} />
              {report.views} views
            </div>
          </div>
          <CardContent className="p-4">
            <h3 className="font-semibold text-surface-900 line-clamp-2 mb-2">
              {report.title}
            </h3>
            <p className="text-sm text-surface-600 mb-2">
              {report.institution?.name ?? 'Unknown institution'}
            </p>
            <p className="text-xs text-surface-500 mb-2">
              {report.reporter?.full_name ?? 'Anonymous'} •{' '}
              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
            </p>
            {report.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {report.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="default" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
