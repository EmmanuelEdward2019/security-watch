import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Send, Save, Paperclip, Clock } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Input,
  Select,
  TextArea,
  FileUpload,
  Spinner,
  EmptyState,
  StatusBadge,
} from '@/components/ui';
import type { UploadedFile } from '@/components/ui/FileUpload';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchMyAssignedCases,
  submitInvestigationReport,
  fetchInvestigationReports,
} from '@/services/caseWorkService';
import {
  INVESTIGATION_REPORT_STATUS_LABELS,
  type InvestigationReport,
  type Case,
} from '@/types';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

type AssignedCase = Pick<Case, 'id' | 'title' | 'status' | 'category' | 'urgency' | 'location' | 'created_at'>;

/**
 * Investigator and expert report filing.
 *
 * This screen previously listed three hardcoded case references, waited 1.2
 * seconds, and showed "Report submitted successfully" without writing anything.
 * Investigators had no way to file findings at all.
 */
export default function SubmitReportPage() {
  const user = useAuthStore((s) => s.user);

  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [previous, setPrevious] = useState<InvestigationReport[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCase, setSelectedCase] = useState('');
  const [title, setTitle] = useState('');
  const [findings, setFindings] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [casesResult, reportsResult] = await Promise.all([
      fetchMyAssignedCases(),
      fetchInvestigationReports({ authorId: user.user_id }),
    ]);

    if (casesResult.error) toast.error(casesResult.error);
    if (reportsResult.error) toast.error(reportsResult.error);

    setCases(casesResult.cases);
    setPrevious(reportsResult.reports);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setSelectedCase('');
    setTitle('');
    setFindings('');
    setRecommendations('');
    setFiles([]);
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!user) return;

    if (!selectedCase) {
      toast.error('Choose the case this report belongs to.');
      return;
    }
    if (!title.trim()) {
      toast.error('Give the report a title.');
      return;
    }
    if (findings.trim().length < 20) {
      toast.error('Findings need at least 20 characters — describe what you established.');
      return;
    }

    setIsSubmitting(true);

    const { error } = await submitInvestigationReport(
      {
        caseId: selectedCase,
        title: title.trim(),
        findings: findings.trim(),
        recommendations: recommendations.trim() || undefined,
        files: files.map((f) => f.file),
        asDraft,
      },
      user.user_id
    );

    setIsSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(asDraft ? 'Draft saved.' : 'Report filed. The complainant has been notified.');
    reset();
    await load();
  };

  const caseOptions = cases.map((c) => ({
    value: c.id,
    label: `${c.title} — ${c.category.replace(/_/g, ' ')} (${c.location || 'no location'})`,
  }));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Submit investigation report</h1>
        <p className="text-surface-500 mt-1">
          File your findings against a case you are assigned to. Once submitted, the substance of a
          report cannot be edited — it becomes part of the case record.
        </p>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No open cases assigned to you"
          description="Reports are filed against a case you are working on. When an administrator assigns you one, it will appear here."
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-surface-900">Report details</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="Case"
                  options={caseOptions}
                  placeholder="Select the case"
                  value={selectedCase}
                  onChange={(e) => setSelectedCase(e.target.value)}
                  required
                />
                <Input
                  label="Report title"
                  placeholder="e.g. Preliminary findings — site visit and witness interviews"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
                <TextArea
                  label="Findings"
                  placeholder="What did you establish? Include dates, locations, people spoken to, and what each source confirmed or contradicted."
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  rows={10}
                  required
                  helperText={`${findings.length} characters — be specific and factual.`}
                />
                <TextArea
                  label="Recommendations (optional)"
                  placeholder="What should happen next? Escalation, further evidence needed, referral to legal."
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-semibold text-surface-900 flex items-center gap-2">
                  <Paperclip size={16} /> Supporting files
                </h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-surface-500">
                  Attachments are hashed with SHA-256 on upload and stored against the case. They are
                  visible only to the people assigned to it.
                </p>
                <FileUpload
                  multiple
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                  maxSize={50 * 1024 * 1024}
                  value={files}
                  onChange={setFiles}
                />
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void handleSubmit(false)}
                loading={isSubmitting}
                disabled={isSubmitting}
                icon={Send}
              >
                File report
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleSubmit(true)}
                disabled={isSubmitting}
                icon={Save}
              >
                Save as draft
              </Button>
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-4">
              <CardHeader>
                <h2 className="font-semibold text-surface-900">Your recent reports</h2>
              </CardHeader>
              <CardContent>
                {previous.length === 0 ? (
                  <p className="text-sm text-surface-500">
                    Nothing filed yet. Your reports will be listed here.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {previous.slice(0, 8).map((report) => (
                      <li
                        key={report.id}
                        className="pb-3 border-b border-surface-100 last:border-0 last:pb-0"
                      >
                        <p className="text-sm font-medium text-surface-800 line-clamp-2">
                          {report.title}
                        </p>
                        <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
                          {report.case?.title ?? 'Case unavailable'}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <StatusBadge
                            status={
                              report.status === 'accepted'
                                ? 'completed'
                                : report.status === 'revision_requested'
                                  ? 'pending'
                                  : report.status === 'draft'
                                    ? 'pending'
                                    : 'in-progress'
                            }
                          />
                          <span className="text-xs text-surface-400">
                            {INVESTIGATION_REPORT_STATUS_LABELS[report.status]}
                          </span>
                        </div>
                        <p className="text-xs text-surface-400 mt-1 flex items-center gap-1">
                          <Clock size={11} />
                          {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </motion.div>
  );
}
