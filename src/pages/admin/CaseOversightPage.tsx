import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Eye, Sparkles, Briefcase } from 'lucide-react';
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
import { EngagementModal } from '@/components/admin/EngagementModal';
import {
  suggestInvestigators,
  assignCaseProfessional,
  listAssignableInvestigators,
} from '@/services/matchingService';
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

/**
 * Name over email for a person cell.
 *
 * The investigator column showed a bare email address. It was already reading
 * `full_name` — the problem is that `handle_new_user()` falls back to the email
 * when a signup carries no full_name in its metadata, so for those accounts the
 * display name IS the address, permanently.
 *
 * Showing both is the fix an admin actually needs: the name to recognise who is
 * on the case, the address to tell two people with the same name apart, or to
 * contact them. Where the name is only the email fallback there is nothing to
 * add, so the address is shown once rather than twice.
 */
function PersonCell({ person }: { person: { full_name?: string; email?: string } | null }) {
  const name = person?.full_name?.trim() ?? '';
  const email = person?.email?.trim() ?? '';

  if (!name && !email) return <span className="text-surface-400">—</span>;

  const nameIsFallback = !name || name.toLowerCase() === email.toLowerCase();

  if (nameIsFallback) {
    return <span className="text-surface-700">{email || name}</span>;
  }

  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate font-medium text-surface-900">{name}</p>
      {email && <p className="truncate text-xs text-surface-500">{email}</p>}
    </div>
  );
}

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
  const [showEngagementModal, setShowEngagementModal] = useState(false);
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

      if (!error && data) {
        setMatches(data.matches);
        setMatchNote(data.note ?? null);
        setLoadingMatches(false);
        return;
      }

      /*
       * The matching engine is unreachable. Fall back to the raw list rather
       * than leaving the admin unable to assign anyone.
       *
       * This screen used to render only what the edge function returned, so any
       * failure — the function down, a network blip, the transport error the
       * browser reports as "Failed to send a request to the Edge Function" —
       * showed "no investigator matches this case yet" and offered no way to
       * proceed. Ranking is a convenience; assigning an investigator to a
       * criminal case is not, and it should not depend on a separate service
       * being up.
       *
       * Nothing is loosened by this. The fallback applies the same eligibility
       * rule, and admin_assign_case re-checks role and verification server-side
       * regardless of which list the name came from.
       */
      const fallback = await listAssignableInvestigators();
      if (cancelled) return;

      if (fallback.error) {
        toast.error(error ?? 'Could not load investigators');
        setMatchNote(null);
      } else if (fallback.data.length === 0) {
        // The fallback query succeeded and genuinely found nobody. That is a
        // statement about the verification queue, not about the engine being
        // down, and saying "could not load" here would send an admin hunting
        // for a fault that does not exist.
        setMatchNote(
          'No investigator has been approved yet. Approve one in the verification ' +
            'queue and they will appear here.'
        );
      } else {
        setMatches(fallback.data);
        setMatchNote(
          'Ranked suggestions are unavailable, so these are shown unranked. ' +
            'Eligibility is unchanged: every investigator listed is verified and available.'
        );
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
      render: (_v, row) => (
        <PersonCell person={row.complainant as { full_name?: string; email?: string } | null} />
      ),
    },
    {
      id: 'investigator',
      header: 'Investigator',
      accessor: (row) => (row.investigator as { full_name?: string })?.full_name,
      render: (_v, row) => (
        <PersonCell person={row.investigator as { full_name?: string; email?: string } | null} />
      ),
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

      {/*
        A grid, not a flex row. Select and Input each wrap themselves in a
        `w-full` div, so as flex children they every one claimed the full width
        and the five filters stacked into a column on desktop — the `w-40` on
        each only ever reached the inner control, never the wrapper.
      */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Select
          aria-label="Filter by status"
          options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
        <Select
          aria-label="Filter by category"
          options={[{ value: '', label: 'All categories' }, ...CATEGORY_OPTIONS]}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        />
        <Select
          aria-label="Filter by urgency"
          options={[{ value: '', label: 'All urgencies' }, ...URGENCY_OPTIONS]}
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
        />
        <Input
          type="date"
          aria-label="Filed from"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          aria-label="Filed until"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
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
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowAssignModal(true)} icon={UserPlus}>
                Assign Investigator
              </Button>
              {/*
                Separate from assignment on purpose. Assigning grants access to
                the case file; booking creates an obligation to pay someone.
                Merging them would mean an administrator could not bring a
                second opinion onto a case without committing to a fee.
              */}
              <Button
                variant="secondary"
                onClick={() => setShowEngagementModal(true)}
                icon={Briefcase}
              >
                Book engagement
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {selectedCase && (
        <EngagementModal
          caseId={selectedCase.id}
          isOpen={showEngagementModal}
          onClose={() => setShowEngagementModal(false)}
          onBooked={() => void loadCases()}
        />
      )}

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
                        {/* Shown when it adds something. For accounts whose
                            full_name fell back to the address it would just be
                            the same string twice. */}
                        {match.email &&
                          match.email.toLowerCase() !== match.full_name.toLowerCase() && (
                            <span className="text-xs text-surface-500">{match.email}</span>
                          )}
                        {/* Only when the engine actually ranked them. The
                            fallback list is unranked, and "Best match" or
                            "0 pts" there would assert a judgement nothing
                            made. */}
                        {match.match_score > 0 && index === 0 && (
                          <Badge variant="success">Best match</Badge>
                        )}
                        {match.match_score > 0 && (
                          <Badge variant="info">{match.match_score} pts</Badge>
                        )}
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
