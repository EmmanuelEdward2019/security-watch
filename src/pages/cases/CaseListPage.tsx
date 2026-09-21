import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  LayoutGrid,
  List,
  Plus,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useCaseStore } from '@/stores/caseStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Button,
  Input,
  Select,
  StatsCard,
  EmptyState,
} from '@/components/ui';
import { CaseCard } from '@/components/cases/CaseCard';
import {
  CASE_STATUS_LABELS,
  CASE_CATEGORY_LABELS,
  CASE_URGENCY_LABELS,
} from '@/types';
import { cn } from '@/utils/cn';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...Object.entries(CASE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  ...Object.entries(CASE_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

const URGENCY_OPTIONS = [
  { value: '', label: 'All urgencies' },
  ...Object.entries(CASE_URGENCY_LABELS).map(([value, label]) => ({ value, label })),
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function CaseListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-surface-200 bg-white p-5 animate-pulse"
        >
          <div className="h-5 bg-surface-200 rounded w-3/4 mb-3" />
          <div className="flex gap-2 mb-3">
            <div className="h-6 w-20 bg-surface-200 rounded-full" />
            <div className="h-6 w-24 bg-surface-200 rounded-full" />
          </div>
          <div className="h-4 bg-surface-200 rounded w-full mb-2" />
          <div className="h-4 bg-surface-200 rounded w-1/3 mt-4" />
        </div>
      ))}
    </div>
  );
}

export function CaseListPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const {
    cases,
    isLoading,
    filters,
    fetchCases,
    setFilters,
  } = useCaseStore();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchInput, setSearchInput] = useState(filters.search ?? '');

  const userId = user?.user_id;
  const role = user?.role;
  const canCreateCase = role === 'complainant' || role === 'admin';

  useEffect(() => {
    if (isAuthenticated) {
      if (role === 'admin') {
        fetchCases(undefined, role);
      } else if (userId) {
        fetchCases(userId, role);
      }
    }
  }, [isAuthenticated, userId, role, fetchCases]);

  const handleSearch = useCallback(() => {
    setFilters({ ...filters, search: searchInput || undefined });
    if (role === 'admin') fetchCases(undefined, role);
    else if (userId) fetchCases(userId, role);
  }, [filters, searchInput, setFilters, fetchCases, userId, role]);

  const handleFilterChange = useCallback(
    (key: keyof typeof filters, value: string) => {
      const newFilters = { ...filters, [key]: value || undefined };
      setFilters(newFilters);
      if (role === 'admin') fetchCases(undefined, role);
      else if (userId) fetchCases(userId, role);
    },
    [filters, setFilters, fetchCases, userId, role]
  );

  const activeCount = cases.filter(
    (c) => !['completed', 'closed'].includes(c.status)
  ).length;
  const investigatingCount = cases.filter(
    (c) => c.status === 'investigating' || c.status === 'assigned'
  ).length;
  const completedCount = cases.filter(
    (c) => c.status === 'completed' || c.status === 'closed'
  ).length;

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-surface-900">
              {role === 'complainant' ? 'My Cases' : role === 'investigator' ? 'Assigned Cases' : 'Cases'}
            </h1>
            <p className="mt-1 text-surface-600">
              {role === 'complainant'
                ? 'Track and manage your reported cases'
                : 'View and manage assigned investigations'}
            </p>
          </div>
          {canCreateCase && (
            <Button
              icon={Plus}
              onClick={() => navigate('/app/cases/new')}
              size="lg"
            >
              Create New Case
            </Button>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <StatsCard
            icon={FileText}
            label="Total Cases"
            value={cases.length}
            variant="default"
          />
          <StatsCard
            icon={AlertCircle}
            label="Active"
            value={activeCount}
            variant="brand"
          />
          <StatsCard
            icon={ClipboardList}
            label="Under Investigation"
            value={investigatingCount}
            variant="success"
          />
          <StatsCard
            icon={CheckCircle2}
            label="Completed"
            value={completedCount}
            variant="default"
          />
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          /* Was flex-col until lg, so on any laptop under 1024px the search
             box and all three selects stacked into a column. flex-wrap keeps
             them on one line and wraps rather than stacking. */
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          <div className="flex min-w-[16rem] flex-1 gap-2">
            <Input
              placeholder="Search cases..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              icon={Search}
              className="max-w-md"
            />
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select
              options={STATUS_OPTIONS}
              value={filters.status ?? ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-40"
            />
            <Select
              options={CATEGORY_OPTIONS}
              value={filters.category ?? ''}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-44"
            />
            <Select
              options={URGENCY_OPTIONS}
              value={filters.urgency ?? ''}
              onChange={(e) => handleFilterChange('urgency', e.target.value)}
              className="w-36"
            />
            <div className="flex border border-surface-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white text-surface-600 hover:bg-surface-50'
                )}
                aria-label="Grid view"
              >
                <LayoutGrid size={20} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white text-surface-600 hover:bg-surface-50'
                )}
                aria-label="List view"
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <CaseListSkeleton />
        ) : cases.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <EmptyState
              icon={FileText}
              title="No cases found"
              description={
                canCreateCase
                  ? "You haven't created any cases yet. Create your first case to get started."
                  : 'No cases are assigned to you at the moment.'
              }
              action={
                canCreateCase ? (
                  <Button icon={Plus} onClick={() => navigate('/app/cases/new')}>
                    Create New Case
                  </Button>
                ) : undefined
              }
            />
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'flex flex-col gap-3'
            )}
          >
            <AnimatePresence mode="popLayout">
              {cases.map((caseItem) => (
                <motion.div
                  key={caseItem.id}
                  variants={itemVariants}
                  layout
                  className={viewMode === 'list' ? 'max-w-4xl' : ''}
                >
                  <CaseCard
                    caseData={caseItem}
                    onClick={() => navigate(`/app/cases/${caseItem.id}`)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
