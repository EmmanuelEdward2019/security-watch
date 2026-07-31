import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Search, Download, BarChart3, FileText, Star } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Select,
  Spinner,
  EmptyState,
  Badge,
  StatsCard,
} from '@/components/ui';
import { fetchInstitutionRankings } from '@/services/adminService';
import { generateInstitutionReport, downloadReportHtml } from '@/services/matchingService';
import type { InstitutionRanking } from '@/types';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

const TYPE_OPTIONS = [
  { value: '', label: 'All institution types' },
  { value: 'police', label: 'Police' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'school', label: 'School' },
  { value: 'court', label: 'Court' },
  { value: 'market', label: 'Market' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
];

function grade(score: number): { letter: string; className: string } {
  if (score >= 4) return { letter: 'A', className: 'bg-green-100 text-green-800' };
  if (score >= 3) return { letter: 'B', className: 'bg-amber-100 text-amber-800' };
  if (score >= 2) return { letter: 'C', className: 'bg-orange-100 text-orange-800' };
  if (score > 0) return { letter: 'D', className: 'bg-accent-100 text-accent-800' };
  return { letter: '—', className: 'bg-surface-100 text-surface-500' };
}

/**
 * Institution performance dossiers.
 *
 * Was a hardcoded list of institutions with a "View report" button that went
 * nowhere — and the `generate-report` edge function that produces the dossier was
 * never called from anywhere in the app. Both are connected now: rankings come
 * from a SQL aggregate, and the report is generated on demand and downloadable.
 */
export default function InstitutionReportsPage() {
  const [rankings, setRankings] = useState<InstitutionRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { rankings: rows, error } = await fetchInstitutionRankings();
    if (error) toast.error(error);
    setRankings(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rankings.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (!term) return true;
      return (
        r.name.toLowerCase().includes(term) || r.location?.toLowerCase().includes(term)
      );
    });
  }, [rankings, search, typeFilter]);

  const stats = useMemo(() => {
    const evaluated = rankings.filter((r) => r.evaluations > 0);
    const average =
      evaluated.length > 0
        ? evaluated.reduce((sum, r) => sum + r.avg_score, 0) / evaluated.length
        : 0;
    return {
      institutions: rankings.length,
      evaluated: evaluated.length,
      evaluations: rankings.reduce((sum, r) => sum + r.evaluations, 0),
      average: Math.round(average * 100) / 100,
    };
  }, [rankings]);

  const handleGenerate = async (institution: InstitutionRanking) => {
    setGenerating(institution.institution_id);
    const { html, error } = await generateInstitutionReport(institution.institution_id, 'detailed');
    setGenerating(null);

    if (error || !html) {
      toast.error(error ?? 'Could not generate that report.');
      return;
    }

    downloadReportHtml(html, institution.name);
    toast.success('Report downloaded.');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Institution reports</h1>
        <p className="text-surface-500 mt-1">
          Performance across every monitored institution, scored on punctuality, professionalism,
          cleanliness, integrity and service delivery.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Institutions" value={stats.institutions} icon={Building2} />
        <StatsCard label="With ratings" value={stats.evaluated} icon={Star} variant="brand" />
        <StatsCard label="Total ratings" value={stats.evaluations} icon={BarChart3} />
        <StatsCard
          label="Average score"
          value={stats.average > 0 ? `${stats.average} / 5` : '—'}
          icon={FileText}
          variant={stats.average >= 3 ? 'success' : 'warning'}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              icon={Search}
              placeholder="Search by name or location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search institutions"
            />
            <Select
              options={TYPE_OPTIONS}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by institution type"
            />
          </div>
        </CardHeader>

        <CardContent>
          {visible.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={rankings.length === 0 ? 'No institutions yet' : 'Nothing matches'}
              description={
                rankings.length === 0
                  ? 'Add institutions from the institutions screen to start collecting performance data.'
                  : 'Try a different search or clear the filter.'
              }
            />
          ) : (
            <ul className="divide-y divide-surface-100">
              {visible.map((institution, index) => {
                const g = grade(institution.avg_score);
                return (
                  <li
                    key={institution.institution_id}
                    className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <span className="w-8 text-sm text-surface-400 tabular-nums shrink-0">
                      {index + 1}
                    </span>

                    <div
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold',
                        g.className
                      )}
                      aria-label={`Grade ${g.letter}`}
                    >
                      {g.letter}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium text-surface-900">{institution.name}</h2>
                        <Badge variant="default">{institution.type}</Badge>
                      </div>
                      <p className="text-sm text-surface-500 truncate">{institution.location}</p>
                      <p className="text-xs text-surface-400 mt-0.5 tabular-nums">
                        {institution.evaluations}{' '}
                        {institution.evaluations === 1 ? 'rating' : 'ratings'} ·{' '}
                        {institution.published_reports} published{' '}
                        {institution.published_reports === 1 ? 'report' : 'reports'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-surface-900 tabular-nums">
                        {institution.evaluations > 0 ? institution.avg_score.toFixed(2) : '—'}
                      </p>
                      <p className="text-xs text-surface-400">out of 5</p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      icon={Download}
                      loading={generating === institution.institution_id}
                      disabled={generating !== null}
                      onClick={() => void handleGenerate(institution)}
                    >
                      Dossier
                    </Button>
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
