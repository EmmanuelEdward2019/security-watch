import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Eye } from 'lucide-react';
import {
  DataTable,
  Badge,
  Select,
  Input,
  Modal,
  Button,
  Avatar,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { useCaseStore } from '@/stores/caseStore';
import { supabase } from '@/lib/supabase';
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

interface Investigator {
  id: string;
  user_id: string;
  specialization: string[];
  rating: number;
  profile?: { full_name: string; avatar_url?: string };
}

export function CaseOversightPage() {
  const { cases, fetchCases, updateCase, assignInvestigator } = useCaseStore();
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [investigators, setInvestigators] = useState<Investigator[]>([]);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadCases();
  }, []);

  async function loadCases() {
    setLoading(true);
    await fetchCases(undefined, undefined);
    setLoading(false);
  }

  useEffect(() => {
    if (showAssignModal) {
      supabase
        .from('investigators')
        .select('*, profile:profiles!user_id(full_name, avatar_url)')
        .eq('verification_status', 'approved')
        .then(({ data }) => {
          const list = (data ?? []).map((d) => ({
            id: d.id,
            user_id: d.user_id,
            specialization: d.specialization ?? [],
            rating: d.rating ?? 0,
            profile: (d as { profile?: { full_name: string; avatar_url?: string } }).profile,
          }));
          setInvestigators(list);
        });
    }
  }, [showAssignModal]);

  const filtered = cases.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (urgencyFilter && c.urgency !== urgencyFilter) return false;
    if (dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(c.created_at) > new Date(dateTo)) return false;
    return true;
  });

  const handleAssignInvestigator = async (investigatorId: string) => {
    if (!selectedCase) return;
    setAssigning(true);
    const { error } = await assignInvestigator(selectedCase.id, investigatorId);
    setAssigning(false);
    if (error) toast.error(error);
    else {
      toast.success('Investigator assigned');
      setShowAssignModal(false);
      setSelectedCase(null);
      loadCases();
    }
  };

  const handleStatusChange = async (caseId: string, status: CaseStatus) => {
    const { error } = await updateCase(caseId, { status });
    if (error) toast.error(error);
    else {
      toast.success('Status updated');
      loadCases();
    }
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
        title="Assign Investigator"
        size="md"
      >
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {investigators.map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => handleAssignInvestigator(inv.user_id)}
              disabled={assigning}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-surface-200 hover:border-brand-300 hover:bg-brand-50/50 text-left transition-colors"
            >
              <Avatar
                src={inv.profile?.avatar_url}
                name={inv.profile?.full_name ?? 'Unknown'}
                size="md"
              />
              <div className="flex-1">
                <p className="font-medium">{inv.profile?.full_name ?? 'Unknown'}</p>
                <p className="text-sm text-surface-500">
                  Rating: {inv.rating}/5 • {inv.specialization?.join(', ') || 'General'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </motion.div>
  );
}
