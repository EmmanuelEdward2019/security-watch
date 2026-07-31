import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Eye, Sparkles } from 'lucide-react';
import {
  DataTable,
  Badge,
  Select,
  Input,
  Modal,
  Button,
  Avatar,
  Spinner,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { useCaseStore } from '@/stores/caseStore';
import { suggestInvestigators, assignCaseProfessional } from '@/services/matchingService';
import type { InvestigatorMatch } from '@/types';
import type { Case, CaseStatus, CaseCategory, CaseUrgency } from '@/types';
import {
  CASE_STATUS_LABELS,
  CASE_CATEGORY_LABELS,
  CASE_URGENCY_LABELS,
} from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = Object.entries(CASE_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const CATEGORY_OPTIONS = Object.entries(CASE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
const URGENCY_OPTIONS = Object.entries(CASE_URGENCY_LABELS).map(([value, label]) => ({ value, label }));

export function CaseOversightPage() {
  const { cases, fetchCases, updateCaseStatus } = useCaseStore();
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [matches, setMatches] = useState<InvestigatorMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchNote, setMatchNote] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    await fetchCases(undefined, undefined);
    setLoading(false);
  }, [fetchCases]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  /**
   * Ranked suggestions from the matching engine.
   *
   * The engine was written but never called, so matching never ran. It suggests
   * only — assignment goes through admin_assign_case, which re-checks the
   * assignee's role and verification before granting them the case file.
   */
  useEffect(() => {
    if (!showAssignModal || !selectedCase) return;

    let cancelled = false;
    setLoadingMatches(true);
    setMatches([]);
    setMatchNote(null);

    void (async () => {
      const { data, error } = await suggestInvestigators(selectedCase.id);
      if (cancelled) return;

      if (error) {
        toast.error(error);
      } else if (data) {
        setMatches(data.matches);
        setMatchNote(data.note ?? null);
      }
      setLoadingMatches(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [showAssignModal, selectedCase]);

  const filtered = cases.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (urgencyFilter && c.urgency !== urgencyFilter) return false;
    if (dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(c.created_at) > new Date(dateTo)) return false;
    return true;
  });

  const handleAssignInvestigator = async (userId: string) => {
    if (!selectedCase) return;
    setAssigning(userId);
    const { error } = await assignCaseProfessional(selectedCase.id, userId, 'investigator');
    setAssigning(null);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Investigator assigned. Both parties have been notified.');
    setShowAssignModal(false);
    setSelectedCase(null);
    await loadCases();
  };

  const handleStatusChange = async (caseId: string, status: CaseStatus) => {
    const { error } = await updateCaseStatus(caseId, status);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Status updated');
    await loadCases();
  };

  const columns: Column<Case>[] = [
    {
      id: 'title',
      header: 'Title',
      accessor: 'title',
      render: (v) => <span className="font-medium">{String(v)}</span>,
    },
    {
      id: 'category',
      header: 'Category',
      accessor: 'category',
      render: (v) => <Badge variant="info">{CASE_CATEGORY_LABELS[v as CaseCategory] ?? v}</Badge>,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      render: (v) => <Badge variant="default">{CASE_STATUS_LABELS[v as CaseStatus] ?? v}</Badge>,
    },
    {
      id: 'urgency',
      header: 'Urgency',
      accessor: 'urgency',
      render: (v) => (
        <Badge variant={v === 'critical' ? 'danger' : v === 'high' ? 'warning' : 'default'}>
          {CASE_URGENCY_LABELS[v as CaseUrgency] ?? v}
        </Badge>
      ),
    },
    {
      id: 'complainant',
      header: 'Complainant',
      accessor: (row) => (row.complainant as { full_name?: string })?.full_name,
      render: (v) => (v != null && v !== '' ? String(v) : '—'),
    },
    {
      id: 'investigator',
      header: 'Investigator',
      accessor: (row) => (row.investigator as { full_name?: string })?.full_name,
      render: (v) => (v != null && v !== '' ? String(v) : '—'),
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedCase(row)}
            className="p-2 rounded-lg text-surface-500 hover:text-brand-600 hover:bg-brand-50"
            aria-label="View case"
          >
            <Eye size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedCase(row);
              setShowAssignModal(true);
            }}
            className="p-2 rounded-lg text-surface-500 hover:text-brand-600 hover:bg-brand-50"
            aria-label="Assign investigator"
          >
            <UserPlus size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-surface-900">Case Oversight</h1>

      <div className="flex flex-wrap gap-4">
        <Select
          options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
        />
        <Select
          options={[{ value: '', label: 'All categories' }, ...CATEGORY_OPTIONS]}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-40"
        />
        <Select
          options={[{ value: '', label: 'All urgencies' }, ...URGENCY_OPTIONS]}
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
          className="w-40"
        />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyMessage="No cases found"
        />
      </div>

      <Modal isOpen={!!selectedCase && !showAssignModal} onClose={() => setSelectedCase(null)} title="Case Details" size="lg">
        {selectedCase && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">{selectedCase.title}</h3>
              <p className="text-surface-600 mt-1">{selectedCase.description}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge>{CASE_CATEGORY_LABELS[selectedCase.category]}</Badge>
              <Badge>{CASE_STATUS_LABELS[selectedCase.status]}</Badge>
              <Badge>{CASE_URGENCY_LABELS[selectedCase.urgency]}</Badge>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Status</label>
              <select
                value={selectedCase.status}
                onChange={(e) => handleStatusChange(selectedCase.id, e.target.value as CaseStatus)}
                className="w-full rounded-lg border border-surface-300 px-3 py-2"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={() => setShowAssignModal(true)} icon={UserPlus}>
              Assign Investigator
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedCase(null);
        }}
        title="Assign an investigator"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-brand-50 border border-brand-200 p-3">
            <Sparkles size={18} className="text-brand-600 mt-0.5 shrink-0" />
            <p className="text-xs text-brand-800">
              Ranked by specialisation overlap, service area, experience, rating and current
              caseload. Only verified and available investigators appear. Assigning grants access to
              the full case file, including filed evidence.
            </p>
          </div>

          {loadingMatches ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" />
            </div>
          ) : matches.length === 0 ? (
            <p className="text-sm text-surface-600 py-4">
              {matchNote ??
                'No verified, available investigator matches this case yet. Approve an investigator in the verification queue first.'}
            </p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {matches.map((match, index) => (
                <li key={match.investigator_id}>
                  <button
                    type="button"
                    onClick={() => void handleAssignInvestigator(match.user_id)}
                    disabled={assigning !== null}
                    className="w-full flex items-start gap-3 p-3 rounded-lg border border-surface-200 hover:border-brand-300 hover:bg-brand-50/50 text-left transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <Avatar name={match.full_name} size="md" />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-surface-900">{match.full_name}</p>
                        {index === 0 && <Badge variant="success">Best match</Badge>}
                        <Badge variant="info">{match.match_score} pts</Badge>
                      </div>

                      <p className="text-sm text-surface-500 mt-0.5">
                        {match.specialization?.length
                          ? match.specialization.join(', ')
                          : 'General practice'}
                        {match.service_area ? ` · ${match.service_area}` : ''}
                      </p>

                      <p className="text-xs text-surface-400 mt-1 tabular-nums">
                        Rating {match.rating}/5 · {match.experience_years} yrs ·{' '}
                        {match.total_cases} active {match.total_cases === 1 ? 'case' : 'cases'}
                      </p>

                      <p className="text-xs text-surface-400 mt-1">
                        Specialisation {match.breakdown.specialization} · Location{' '}
                        {match.breakdown.location} · Experience {match.breakdown.experience} ·
                        Availability {match.breakdown.availability}
                      </p>
                    </div>

                    {assigning === match.user_id && <Spinner size="sm" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </motion.div>
  );
}
