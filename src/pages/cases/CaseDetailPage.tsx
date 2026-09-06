import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Calendar,
  MessageSquare,
  CreditCard,
  Upload,
  Star,
  Mail,
  Phone,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useCaseStore } from '@/stores/caseStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Tabs,
  Select,
  Avatar,
  StatusBadge,
  Badge,
  FileUpload,
  EmptyState,
  Spinner,
} from '@/components/ui';
import { CaseStatusTracker } from '@/components/cases/CaseStatusTracker';
import { EvidenceTimeline } from '@/components/cases/EvidenceTimeline';
import { EngagementPanel } from '@/components/cases/EngagementPanel';
import { CorroborationPanel } from '@/components/cases/CorroborationPanel';
import { CustodianPanel } from '@/components/cases/CustodianPanel';
import { EvidenceGrantPanel } from '@/components/cases/EvidenceGrantPanel';
import { OutcomePanel } from '@/components/cases/OutcomePanel';
import { uploadFile, generateFileHash, buildObjectPath, STORAGE_BUCKETS } from '@/lib/supabase';
import type { UploadedFile } from '@/components/ui/FileUpload';
import {
  CASE_CATEGORY_LABELS,
  CASE_URGENCY_LABELS,
  CASE_STATUS_LABELS,
  type CaseStatus,
} from '@/types';
import { cn } from '@/utils/cn';

const STATUS_OPTIONS = Object.entries(CASE_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentCase,
    evidence,
    isLoading,
    fetchCase,
    fetchEvidence,
    updateCase,
    addEvidence,
  } = useCaseStore();

  const [activeTab, setActiveTab] = useState('overview');
  const [showEvidenceUpload, setShowEvidenceUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const canEditStatus = user?.role === 'admin' || user?.role === 'investigator';

  /*
   * Who may record what happened.
   *
   * Administrators, and the professionals actually assigned to THIS case —
   * matching what `record_case_outcome` enforces. Deliberately not the
   * complainant: the outcome feeds a published scorecard that names
   * institutions, and a figure derived from self-reported success is not
   * something anyone should cite.
   */
  const canRecordOutcome =
    user?.role === 'admin' ||
    (!!user?.user_id &&
      (currentCase?.assigned_investigator_id === user.user_id ||
        currentCase?.assigned_lawyer_id === user.user_id ||
        currentCase?.assigned_expert_id === user.user_id));
  const canAddEvidence =
    user?.role === 'complainant' ||
    user?.role === 'investigator' ||
    user?.role === 'admin';

  useEffect(() => {
    if (id) {
      fetchCase(id);
      fetchEvidence(id);
    }
  }, [id, fetchCase, fetchEvidence]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    const { error } = await updateCase(id, { status: newStatus as CaseStatus });
    if (error) toast.error(error);
    else toast.success('Status updated');
  };

  const handleEvidenceUpload = async () => {
    if (!id || !user?.user_id || uploadedFiles.length === 0) return;
    setIsUploading(true);
    try {
      for (const uf of uploadedFiles) {
        // The first path segment is the case id: the evidence storage policy
        // grants read and write to that case's participants, which is what makes
        // filed evidence readable by the investigator and admin who need it.
        // upsert is off, so a colliding path fails rather than silently
        // replacing bytes that a recorded hash still claims to describe.
        const path = buildObjectPath(id, uf.file.name);
        const hash = await generateFileHash(uf.file);

        const { path: storedPath, error: uploadError } = await uploadFile(
          STORAGE_BUCKETS.EVIDENCE,
          path,
          uf.file
        );
        if (uploadError) {
          toast.error(`Could not upload ${uf.file.name}: ${uploadError}`);
          continue;
        }

        // chain_of_custody is written by a database trigger from the
        // authenticated identity — the client no longer authors provenance.
        const { error: recordError } = await addEvidence({
          case_id: id,
          uploaded_by: user.user_id,
          file_url: storedPath,
          file_name: uf.file.name,
          file_type: uf.file.type,
          file_size: uf.file.size,
          file_hash: hash,
        });
        if (recordError) {
          toast.error(`Uploaded ${uf.file.name} but could not record it: ${recordError}`);
        }
      }
      setUploadedFiles([]);
      setShowEvidenceUpload(false);
      toast.success('Evidence uploaded');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading && !currentCase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!currentCase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          title="Case not found"
          description="The case you're looking for doesn't exist or you don't have access."
          action={
            <Button variant="outline" onClick={() => navigate('/app/cases')}>
              Back to Cases
            </Button>
          }
        />
      </div>
    );
  }

  const uploaderNames: Record<string, string> = {};
  evidence.forEach((e) => {
    if (!uploaderNames[e.uploaded_by]) {
      uploaderNames[e.uploaded_by] =
        currentCase.complainant?.user_id === e.uploaded_by
          ? currentCase.complainant.full_name
          : currentCase.investigator?.user_id === e.uploaded_by
            ? currentCase.investigator.full_name
            : 'Unknown';
    }
  });

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div>
            <h3 className="font-semibold text-surface-900 mb-2">Description</h3>
            <p className="text-surface-600 whitespace-pre-wrap">
              {currentCase.description}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-surface-600">
              <MapPin size={20} className="text-brand-500 shrink-0" />
              <span>{currentCase.location}</span>
            </div>
            <div className="flex items-center gap-3 text-surface-600">
              <Calendar size={20} className="text-brand-500 shrink-0" />
              <span>Created {format(new Date(currentCase.created_at), 'MMM d, yyyy')}</span>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-surface-900 mb-3">Status Timeline</h3>
            <CaseStatusTracker currentStatus={currentCase.status} />
          </div>

          {/*
            Booking an engagement notifies the complainant that a deposit is
            needed and links them here. Without this the flow dead-ended: the
            case screen knew nothing about the engagement, showed no amount and
            offered no way to pay.
          */}
          <EngagementPanel
            caseId={currentCase.id}
            isComplainant={currentCase.complainant_id === user?.user_id}
          />

          {/*
            Whether anyone unconnected reported the same thing. Counts only —
            never another complainant's title, name or case id, because in a
            land dispute or a domestic matter that identifies the neighbour.
          */}
          <CorroborationPanel caseId={currentCase.id} />

          {/*
            Recorded by an administrator or an assigned professional, never by
            the complainant: these figures feed the published scorecard, and
            self-reported success is not citable.
          */}
          <OutcomePanel
            caseId={currentCase.id}
            outcome={currentCase.outcome ?? null}
            outcomeNote={currentCase.outcome_note ?? null}
            handlingInstitution={currentCase.handling_institution ?? null}
            outcomeRecordedAt={currentCase.outcome_recorded_at ?? null}
            canRecord={canRecordOutcome}
            onRecorded={() => id && void fetchCase(id)}
          />

          {/*
            Only the complainant sees this — arranging disclosure of somebody
            else's case file over their head is not a feature.
          */}
          <CustodianPanel
            caseId={currentCase.id}
            isComplainant={currentCase.complainant_id === user?.user_id}
          />
        </motion.div>
      ),
    },
    {
      id: 'evidence',
      label: 'Evidence',
      content: (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {canAddEvidence && (
            <div className="flex justify-end">
              <Button
                icon={Upload}
                variant="outline"
                onClick={() => setShowEvidenceUpload(!showEvidenceUpload)}
              >
                {showEvidenceUpload ? 'Cancel' : 'Upload Evidence'}
              </Button>
            </div>
          )}
          <AnimatePresence>
            {showEvidenceUpload && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="mb-6">
                  <CardContent className="p-4">
                    <FileUpload
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                      multiple
                      value={uploadedFiles}
                      onChange={setUploadedFiles}
                    />
                    <Button
                      className="mt-4"
                      onClick={handleEvidenceUpload}
                      loading={isUploading}
                      disabled={uploadedFiles.length === 0}
                    >
                      Upload
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
          {/*
            Sharing outward. Sits above the timeline because the question
            "who has this been shown to" belongs next to the exhibits, not
            buried under them — it is one of the first things anyone asks of a
            chain of custody.
          */}
          <EvidenceGrantPanel
            caseId={currentCase.id}
            evidence={evidence.map((e) => ({ id: e.id, file_name: e.file_name }))}
          />

          {/* Case context so a custody certificate identifies its own subject,
              and the issuer so the document records who produced it. */}
          {evidence.length > 0 ? (
            <EvidenceTimeline
              evidence={evidence}
              uploaderNames={uploaderNames}
              caseTitle={currentCase.title}
              caseId={currentCase.id}
              issuedBy={user?.full_name ?? user?.email ?? 'The Security Watch'}
            />
          ) : (
            <EmptyState
              title="No evidence yet"
              description="Evidence files will appear here once uploaded."
            />
          )}
        </motion.div>
      ),
    },
    {
      id: 'team',
      label: 'Team',
      content: (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentCase.investigator && (
              <TeamMemberCard
                role="Investigator"
                profile={currentCase.investigator}
                rating={4.8}
              />
            )}
            {currentCase.assigned_lawyer_id && (
              <TeamMemberCard role="Lawyer" placeholder />
            )}
            {currentCase.assigned_expert_id && (
              <TeamMemberCard role="Expert" placeholder />
            )}
          </div>
          {!currentCase.investigator && !currentCase.assigned_lawyer_id && !currentCase.assigned_expert_id && (
            <EmptyState
              title="No team assigned"
              description="Team members will be assigned as the case progresses."
            />
          )}
        </motion.div>
      ),
    },
    {
      id: 'communication',
      label: 'Communication',
      content: (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12"
        >
          <MessageSquare size={48} className="text-surface-300 mb-4" />
          <h3 className="font-semibold text-surface-900 mb-2">Case Messages</h3>
          <p className="text-surface-600 text-center max-w-sm mb-6">
            Communicate with your investigator and team through our secure messaging system.
          </p>
          <Button
            icon={MessageSquare}
            onClick={() => navigate('/app/messages')}
          >
            Open Messages
          </Button>
        </motion.div>
      ),
    },
    {
      id: 'payments',
      label: 'Payments',
      content: (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex justify-end">
            <Button icon={CreditCard}>Make Payment</Button>
          </div>
          <EmptyState
            icon={CreditCard}
            title="No payments yet"
            description="Payment history for this case will appear here."
          />
        </motion.div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
            >
              <div>
                <h1 className="text-2xl font-bold text-surface-900">
                  {currentCase.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <StatusBadge status={currentCase.status.replace(/_/g, '-')} />
                  <Badge variant="warning">
                    {CASE_URGENCY_LABELS[currentCase.urgency]}
                  </Badge>
                  <Badge variant="info">
                    {CASE_CATEGORY_LABELS[currentCase.category]}
                  </Badge>
                  <span className="text-sm text-surface-500">
                    {format(new Date(currentCase.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              {canEditStatus && (
                <Select
                  options={STATUS_OPTIONS}
                  value={currentCase.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-44"
                />
              )}
            </motion.div>

            {/* Tabs */}
            <Card>
              <CardContent className="p-6">
                <Tabs
                  tabs={tabs}
                  value={activeTab}
                  onChange={setActiveTab}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-surface-900">Quick Info</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-surface-500 uppercase">Status</p>
                    <StatusBadge status={currentCase.status.replace(/_/g, '-')} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-surface-500 uppercase">Urgency</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          URGENCY_COLORS[currentCase.urgency]
                        )}
                      />
                      {CASE_URGENCY_LABELS[currentCase.urgency]}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-surface-500 uppercase">Assigned Team</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {currentCase.investigator ? (
                        <Avatar
                          src={currentCase.investigator.avatar_url}
                          name={currentCase.investigator.full_name}
                          size="sm"
                        />
                      ) : (
                        <span className="text-sm text-surface-500">Not assigned</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-surface-500 uppercase">Key Dates</p>
                    <p className="text-sm text-surface-700 mt-1">
                      Created: {format(new Date(currentCase.created_at), 'MMM d, yyyy')}
                    </p>
                    <p className="text-sm text-surface-700">
                      Updated: {format(new Date(currentCase.updated_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate('/app/messages')}
                    icon={MessageSquare}
                  >
                    Message Team
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamMemberCard({
  role,
  profile,
  rating,
  placeholder,
}: {
  role: string;
  profile?: { full_name: string; avatar_url?: string; email?: string; phone?: string };
  rating?: number;
  placeholder?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={profile?.avatar_url}
            name={profile?.full_name ?? 'TBD'}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-surface-500 uppercase">{role}</p>
            <p className="font-semibold text-surface-900 truncate">
              {profile?.full_name ?? 'To be assigned'}
            </p>
            {rating && (
              <div className="flex items-center gap-1 mt-1">
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <span className="text-sm text-surface-600">{rating}</span>
              </div>
            )}
          </div>
        </div>
        {profile && !placeholder && (
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" size="sm" icon={Mail} className="flex-1">
              Email
            </Button>
            <Button variant="ghost" size="sm" icon={Phone} className="flex-1">
              Call
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
