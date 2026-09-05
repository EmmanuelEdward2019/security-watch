import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Building2 } from 'lucide-react';
import { useMediaStore } from '@/stores/mediaStore';
import { useAuthStore } from '@/stores/authStore';
import { InstitutionCard } from '@/components/media/InstitutionCard';
import {
  Button,
  Input,
  Select,
  Modal,
  EmptyState,
  Spinner,
} from '@/components/ui';
import toast from 'react-hot-toast';

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

const INSTITUTION_TYPE_FORM_OPTIONS = INSTITUTION_TYPE_OPTIONS.filter((o) => o.value !== '');

export function InstitutionsPage() {
  const { user } = useAuthStore();
  const {
    institutions,
    isLoading,
    fetchInstitutions,
    createInstitution,
    getInstitutionRanking,
  } = useMediaStore();

  const [ranking, setRanking] = useState<{ institution: { id: string }; avgScore: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newInstitution, setNewInstitution] = useState({
    name: '',
    type: 'other' as const,
    location: '',
    address: '',
    supervising_authority: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAddInstitution =
    user?.role === 'admin' || user?.role === 'media_agent';

  useEffect(() => {
    fetchInstitutions();
    getInstitutionRanking().then(setRanking);
  }, [fetchInstitutions, getInstitutionRanking]);

  const rankingMap = new Map(ranking.map((r) => [r.institution.id, r.avgScore]));

  const filteredInstitutions = institutions.filter((i) => {
    const matchesSearch =
      !searchQuery ||
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || i.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleAddInstitution = async () => {
    if (!newInstitution.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setIsSubmitting(true);
    const { error } = await createInstitution(newInstitution);
    setIsSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Institution added');
    setAddModalOpen(false);
    setNewInstitution({
      name: '',
      type: 'other',
      location: '',
      address: '',
      supervising_authority: '',
    });
    fetchInstitutions();
  };

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <section className="bg-brand-700 text-white py-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div>
              <h1 className="text-3xl md:text-4xl font-bold font-display mb-2">
                Institutions
              </h1>
              <p className="text-brand-100">
                Browse and rate public institutions
              </p>
            </div>
            {canAddInstitution && (
              <Button
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                icon={Plus}
                onClick={() => setAddModalOpen(true)}
              >
                Add Institution
              </Button>
            )}
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-8"
        >
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
              size={20}
            />
            <input
              type="search"
              placeholder="Search institutions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-surface-300 px-4 py-2.5 bg-white sm:w-48"
          >
            {INSTITUTION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : filteredInstitutions.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No institutions found"
            description="Try adjusting your search or filters."
            action={
              canAddInstitution && (
                <Button variant="outline" onClick={() => setAddModalOpen(true)}>
                  Add Institution
                </Button>
              )
            }
          />
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredInstitutions.map((inst) => (
                <InstitutionCard
                  key={inst.id}
                  institution={inst}
                  scorePreview={rankingMap.get(inst.id)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Add Institution Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Institution"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={newInstitution.name}
            onChange={(e) =>
              setNewInstitution({ ...newInstitution, name: e.target.value })
            }
            placeholder="Institution name"
          />
          <Select
            label="Type"
            options={INSTITUTION_TYPE_FORM_OPTIONS}
            value={newInstitution.type}
            onChange={(e) =>
              setNewInstitution({
                ...newInstitution,
                type: e.target.value as typeof newInstitution.type,
              })
            }
          />
          <Input
            label="Location"
            value={newInstitution.location}
            onChange={(e) =>
              setNewInstitution({ ...newInstitution, location: e.target.value })
            }
            placeholder="City, area"
          />
          <Input
            label="Address"
            value={newInstitution.address}
            onChange={(e) =>
              setNewInstitution({ ...newInstitution, address: e.target.value })
            }
            placeholder="Full address"
          />
          <Input
            label="Supervising Authority"
            value={newInstitution.supervising_authority}
            onChange={(e) =>
              setNewInstitution({
                ...newInstitution,
                supervising_authority: e.target.value,
              })
            }
            placeholder="e.g. Ministry of Health"
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isSubmitting}
              onClick={handleAddInstitution}
            >
              Add Institution
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
