import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Microscope,
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
  Send,
  Lock,
  FileSearch,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Select,
  TextArea,
  Input,
  FileUpload,
  Spinner,
  EmptyState,
  StatsCard,
  StatusBadge,
  Badge,
} from '@/components/ui';
import type { UploadedFile } from '@/components/ui/FileUpload';
import { useAuthStore } from '@/stores/authStore';
import { useCaseStore } from '@/stores/caseStore';
import {
  fetchMyAssignedCases,
  fetchCaseEvidence,
  submitForensicAnalysis,
  fetchForensicAnalyses,
  updateForensicAnalysis,
} from '@/services/caseWorkService';
import {
  FORENSIC_ANALYSIS_TYPE_LABELS,
  FORENSIC_CONFIDENCE_LABELS,
  FORENSIC_STATUS_LABELS,
  type ForensicAnalysis,
  type ForensicAnalysisType,
  type ForensicConfidence,
  type Case,
  type Evidence,
} from '@/types';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

type AssignedCase = Pick<Case, 'id' | 'title' | 'status' | 'category' | 'urgency' | 'location' | 'created_at'>;

const ANALYSIS_TYPE_OPTIONS = (
  Object.entries(FORENSIC_ANALYSIS_TYPE_LABELS) as [ForensicAnalysisType, string][]
).map(([value, label]) => ({ value, label }));

const CONFIDENCE_OPTIONS = (
  Object.entries(FORENSIC_CONFIDENCE_LABELS) as [ForensicConfidence, string][]
).map(([value, label]) => ({ value, label }));

/**
 * Forensic and medical evidence analysis.
 *
 * The medical-expert role had no working feature: pending cases, tools and
 * completed analyses were all hardcoded arrays. Analyses now persist against the
 * case, can be attached to a specific piece of evidence, and record a custody
 * entry when evidence is examined.
 *
 * Evidence integrity is checked here rather than asserted: downloading re-hashes
 * the file and compares it against the SHA-256 recorded at upload.
 */
export default function EvidenceAnalysisPage() {
  const user = useAuthStore((s) => s.user);
  const downloadEvidence = useCaseStore((s) => s.downloadEvidence);

  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [analyses, setAnalyses] = useState<ForensicAnalysis[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<Record<string, boolean | null>>({});

  const [caseId, setCaseId] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [analysisType, setAnalysisType] = useState<ForensicAnalysisType | ''>('');
  const [methodology, setMethodology] = useState('');
  const [findings, setFindings] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [confidence, setConfidence] = useState<ForensicConfidence>('moderate');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [casesResult, analysesResult] = await Promise.all([
      fetchMyAssignedCases(),
      fetchForensicAnalyses({ expertId: user.user_id }),
    ]);

    if (casesResult.error) toast.error(casesResult.error);
    if (analysesResult.error) toast.error(analysesResult.error);

    setCases(casesResult.cases);
    setAnalyses(analysesResult.analyses);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Load the evidence list whenever the selected case changes.
  useEffect(() => {
    if (!caseId) {
      setEvidence([]);
      setEvidenceId('');
      return;
    }

    let cancelled = false;
    void (async () => {
      const { evidence: items, error } = await fetchCaseEvidence(caseId);
      if (cancelled) return;
      if (error) toast.error(error);
      setEvidence(items);
      setEvidenceId('');
    })();

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const stats = useMemo(() => {
    const finalised = analyses.filter((a) => a.status === 'finalised').length;
    const inProgress = analyses.filter((a) => a.status === 'in_progress').length;
    const conclusive = analyses.filter((a) => a.confidence === 'conclusive').length;
    return { total: analyses.length, finalised, inProgress, conclusive };
  }, [analyses]);

  const handleVerify = async (item: Evidence) => {
    setVerifying(item.id);
    const { blob, verified, error } = await downloadEvidence(item);
    setVerifying(null);

    if (error) {
      toast.error(error);
      return;
    }

    setIntegrity((prev) => ({ ...prev, [item.id]: verified }));

    if (verified === false) {
      toast.error(
        'Integrity check FAILED — this file does not match the hash recorded at upload. Do not rely on it; report this immediately.',
        { duration: 8000 }
      );
    } else if (verified === true) {
      toast.success('Integrity verified against the recorded SHA-256.');
    }

    if (blob) {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Give the tab time to claim the blob before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  };

  const handleSubmit = async (status: ForensicAnalysis['status']) => {
    if (!user) return;

    if (!caseId) {
      toast.error('Choose the case this analysis belongs to.');
      return;
    }
    if (!analysisType) {
      toast.error('Choose the type of analysis.');
      return;
    }
    if (findings.trim().length < 20) {
      toast.error('Findings need at least 20 characters.');
      return;
    }
    if (!conclusion.trim()) {
      toast.error('State your conclusion.');
      return;
    }

    setSubmitting(true);
    const { error } = await submitForensicAnalysis(
      {
        caseId,
        evidenceId: evidenceId || null,
        analysisType,
        methodology: methodology.trim() || undefined,
        findings: findings.trim(),
        conclusion: conclusion.trim(),
        confidence,
        files: files.map((f) => f.file),
        status,
      },
      user.user_id
    );
    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(
      status === 'finalised'
        ? 'Analysis finalised. It is now part of the case record and cannot be edited.'
        : 'Analysis recorded.'
    );
    setAnalysisType('');
    setMethodology('');
    setFindings('');
    setConclusion('');
    setConfidence('moderate');
    setFiles([]);
    setEvidenceId('');
    await load();
  };

  const handleFinalise = async (analysis: ForensicAnalysis) => {
    if (
      !window.confirm(
        'Finalise this analysis? Once finalised it becomes part of the case record and can no longer be edited.'
      )
    ) {
      return;
    }
    const { error } = await updateForensicAnalysis(analysis.id, { status: 'finalised' });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Analysis finalised.');
    await load();
  };

  const caseOptions = cases.map((c) => ({
    value: c.id,
    label: `${c.title} — ${c.category.replace(/_/g, ' ')}`,
  }));

  const evidenceOptions = [
    { value: '', label: 'Not tied to a specific exhibit' },
    ...evidence.map((e) => ({ value: e.id, label: e.file_name })),
  ];

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
        <h1 className="text-2xl font-bold text-surface-900">Evidence analysis</h1>
        <p className="text-surface-500 mt-1">
          Record forensic and medical findings against the cases you are assigned to. Examining an
          exhibit is logged to its chain of custody.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total analyses" value={stats.total} icon={ClipboardList} />
        <StatsCard label="In progress" value={stats.inProgress} icon={Microscope} variant="brand" />
        <StatsCard label="Finalised" value={stats.finalised} icon={Lock} variant="success" />
        <StatsCard label="Conclusive" value={stats.conclusive} icon={ShieldCheck} variant="success" />
      </div>

      {cases.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No cases assigned to you"
          description="Analyses are recorded against a case you are assigned to. An administrator will assign you as the forensic or medical expert when one needs your input."
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-surface-900">Record an analysis</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="Case"
                  options={caseOptions}
                  placeholder="Select the case"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  required
                />

                {caseId && (
                  <Select
                    label="Exhibit"
                    options={evidenceOptions}
                    value={evidenceId}
                    onChange={(e) => setEvidenceId(e.target.value)}
                  />
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <Select
                    label="Analysis type"
                    options={ANALYSIS_TYPE_OPTIONS}
                    placeholder="Select a type"
                    value={analysisType}
                    onChange={(e) => setAnalysisType(e.target.value as ForensicAnalysisType)}
                    required
                  />
                  <Select
                    label="Confidence"
                    options={CONFIDENCE_OPTIONS}
                    value={confidence}
                    onChange={(e) => setConfidence(e.target.value as ForensicConfidence)}
                  />
                </div>

                <Input
                  label="Methodology (optional)"
                  placeholder="e.g. Gas chromatography–mass spectrometry, duplicate samples"
                  value={methodology}
                  onChange={(e) => setMethodology(e.target.value)}
                  maxLength={300}
                />

                <TextArea
                  label="Findings"
                  placeholder="What did the examination show? Include measurements, observations and anything inconsistent with the account on file."
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  rows={8}
                  required
                />

                <TextArea
                  label="Conclusion"
                  placeholder="Your professional opinion, stated plainly, and its limits."
                  value={conclusion}
                  onChange={(e) => setConclusion(e.target.value)}
                  rows={4}
                  required
                />

                <FileUpload
                  accept="image/*,.pdf,.doc,.docx"
                  multiple
                  maxSize={50 * 1024 * 1024}
                  value={files}
                  onChange={setFiles}
                />

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => void handleSubmit('completed')}
                    loading={submitting}
                    disabled={submitting}
                    icon={Send}
                  >
                    Record analysis
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleSubmit('in_progress')}
                    disabled={submitting}
                  >
                    Save as in progress
                  </Button>
                </div>
              </CardContent>
            </Card>

            {caseId && evidence.length > 0 && (
              <Card>
                <CardHeader>
                  <h2 className="font-semibold text-surface-900">Exhibits on this case</h2>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-surface-100">
                    {evidence.map((item) => {
                      const checked = integrity[item.id];
                      return (
                        <li key={item.id} className="py-3 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-surface-900 truncate">
                              {item.file_name}
                            </p>
                            <p className="text-xs text-surface-500 font-mono truncate mt-0.5">
                              {item.file_hash
                                ? `SHA-256 ${item.file_hash.slice(0, 24)}…`
                                : 'No hash recorded'}
                            </p>
                            {checked === true && (
                              <span className="inline-flex items-center gap-1 text-xs text-brand-700 mt-1">
                                <ShieldCheck size={12} /> Integrity verified
                              </span>
                            )}
                            {checked === false && (
                              <span className="inline-flex items-center gap-1 text-xs text-accent-700 mt-1">
                                <ShieldAlert size={12} /> Hash mismatch — do not rely on this file
                              </span>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={verifying === item.id}
                            disabled={verifying !== null}
                            onClick={() => void handleVerify(item)}
                          >
                            Open &amp; verify
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-4">
              <CardHeader>
                <h2 className="font-semibold text-surface-900">Your analyses</h2>
              </CardHeader>
              <CardContent>
                {analyses.length === 0 ? (
                  <p className="text-sm text-surface-500">
                    Nothing recorded yet. Your analyses will appear here.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {analyses.slice(0, 10).map((analysis) => (
                      <li
                        key={analysis.id}
                        className="pb-3 border-b border-surface-100 last:border-0 last:pb-0"
                      >
                        <p className="text-sm font-medium text-surface-800">
                          {FORENSIC_ANALYSIS_TYPE_LABELS[analysis.analysis_type]}
                        </p>
                        <p className="text-xs text-surface-500 line-clamp-1 mt-0.5">
                          {analysis.case?.title ?? 'Case unavailable'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <StatusBadge
                            status={
                              analysis.status === 'finalised'
                                ? 'completed'
                                : analysis.status === 'in_progress'
                                  ? 'in-progress'
                                  : 'pending'
                            }
                          />
                                  <Badge variant="info">
                            {FORENSIC_CONFIDENCE_LABELS[analysis.confidence]}
                          </Badge>
                        </div>
                        <p className="text-xs text-surface-400 mt-1">
                          {FORENSIC_STATUS_LABELS[analysis.status]} ·{' '}
                          {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
                        </p>
                        {analysis.status !== 'finalised' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 px-0"
                            onClick={() => void handleFinalise(analysis)}
                          >
                            Finalise
                          </Button>
                        )}
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
