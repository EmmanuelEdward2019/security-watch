import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Building2, Film, Music, Image as ImageIcon, FileText, MapPin } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';
import { supabase } from '@/lib/supabase';
import type { MediaReport, Institution } from '@/types';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';

const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'All institutions' },
  { value: 'police', label: 'Police' },
  { value: 'school', label: 'Schools' },
  { value: 'hospital', label: 'Hospitals' },
  { value: 'market', label: 'Markets' },
  { value: 'court', label: 'Courts' },
  { value: 'government', label: 'Government' },
];

const MEDIA_ICONS = {
  video: Film,
  audio: Music,
  photo: ImageIcon,
  document: FileText,
} as const;

/**
 * The public transparency archive.
 *
 * This page showed four category links and two placeholder cards reading
 * "Institutional Transparency in Action" over an empty grey box. It now lists the
 * reports an administrator has actually published.
 *
 * Only published reports are readable — by RLS on the table and by the storage
 * policy on the bucket — so nothing under review is exposed here.
 */
export default function MediaPage() {
  const [reports, setReports] = useState<(MediaReport & { institution?: Institution })[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase
      .from('media_reports')
      .select('*, institution:institutions(id, name, type, location)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(48);

    setReports((data ?? []) as (MediaReport & { institution?: Institution })[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (category ? reports.filter((r) => r.institution?.type === category) : reports),
    [reports, category]
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const report of reports) {
      const type = report.institution?.type;
      if (type) out[type] = (out[type] ?? 0) + 1;
    }
    return out;
  }, [reports]);

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-gradient-to-br from-forest-50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Transparency archive
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl">
                  Field reports on public institutions, filed by our agents and reviewed before
                  publication. Every item here has been checked by an editor — nothing goes live
                  unreviewed.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/agent-field-ops.jpg"
                    alt="Media agents documenting institutional performance"
                    className="w-full h-[280px] sm:h-[360px] object-cover"
                    loading="lazy"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div
                className="flex flex-wrap gap-2 mb-10"
                role="group"
                aria-label="Filter by institution type"
              >
                {CATEGORIES.map((option) => {
                  const count = option.value ? counts[option.value] : reports.length;
                  return (
                    <button
                      key={option.value || 'all'}
                      type="button"
                      onClick={() => setCategory(option.value)}
                      aria-pressed={category === option.value}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-medium transition-all',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500',
                        category === option.value
                          ? 'border-forest-600 bg-forest-600 text-white'
                          : 'border-surface-200 bg-surface-50 text-surface-700 hover:border-forest-200 hover:bg-forest-50/50'
                      )}
                    >
                      <Building2 className="w-4 h-4" />
                      {option.label}
                      {count ? (
                        <span className="text-sm opacity-70 tabular-nums">{count}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </ScrollReveal>

            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : visible.length === 0 ? (
              <div className="max-w-lg mx-auto text-center py-12">
                <Play className="w-12 h-12 text-surface-300 mx-auto mb-4" strokeWidth={1.5} />
                <h2 className="text-lg font-semibold text-surface-900 mb-1">
                  {reports.length === 0 ? 'Nothing published yet' : 'No reports in that category'}
                </h2>
                <p className="text-surface-600">
                  {reports.length === 0
                    ? 'Our agents are in the field. Published reports will appear here once they have been reviewed.'
                    : 'Try another institution type.'}
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {visible.map((report, i) => {
                  const Icon = MEDIA_ICONS[report.media_type] ?? FileText;
                  return (
                    <ScrollReveal key={report.id} delay={Math.min(i, 8) * 0.06}>
                      <article className="flex flex-col h-full rounded-2xl overflow-hidden bg-white border border-surface-200 hover:border-forest-200 hover:shadow-lg transition-all">
                        <div className="aspect-video bg-surface-100 flex items-center justify-center relative">
                          {report.thumbnail_url ? (
                            <img
                              src={report.thumbnail_url}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Icon className="w-12 h-12 text-surface-300" strokeWidth={1.5} />
                          )}
                          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-surface-700 capitalize">
                            {report.media_type}
                          </span>
                        </div>

                        <div className="p-6 flex flex-col flex-1">
                          <span className="text-sm text-forest-600 font-medium flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 shrink-0" />
                            <span className="truncate">
                              {report.institution?.name ?? 'Institution'}
                            </span>
                          </span>

                          <h2 className="text-lg font-semibold text-surface-900 mt-2 line-clamp-2">
                            {report.title}
                          </h2>

                          <p className="text-surface-600 mt-2 text-sm line-clamp-3 flex-1">
                            {report.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-surface-400">
                            <span>{format(new Date(report.created_at), 'd MMM yyyy')}</span>
                            {report.institution?.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {report.institution.location}
                              </span>
                            )}
                            <span className="tabular-nums">{report.views ?? 0} views</span>
                          </div>
                        </div>
                      </article>
                    </ScrollReveal>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="py-16 lg:py-24 bg-surface-50">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <ScrollReveal>
              <p className="text-surface-600 mb-8">
                Sign in to watch full recordings, rate institutions on the five performance measures,
                and download the per-institution performance dossiers.
              </p>
              <Link to="/register">
                <span className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-forest-600 hover:bg-forest-700 text-white font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500">
                  Get started
                </span>
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
