import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, Upload, Loader2 , ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCaseStore } from '@/stores/caseStore';
import { useKycGate } from '@/hooks/useKycGate';
import { useAuthStore } from '@/stores/authStore';
import {
  Button,
  Input,
  Select,
  TextArea,
  FileUpload,
  Modal,
  Card,
  CardContent,
  LocationPicker,
} from '@/components/ui';
import { uploadFile, generateFileHash, buildObjectPath, STORAGE_BUCKETS } from '@/lib/supabase';
import type { UploadedFile } from '@/components/ui/FileUpload';
import {
  CASE_CATEGORY_LABELS,
  CASE_URGENCY_LABELS,
  type CaseCategory,
  type CaseUrgency,
} from '@/types';
import { cn } from '@/utils/cn';

const STEPS = [
  { id: 1, title: 'Basic Info' },
  { id: 2, title: 'Location' },
  { id: 3, title: 'Evidence' },
  { id: 4, title: 'Review' },
];

const step1Schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.enum([
    'fraud', 'robbery', 'murder', 'assault', 'domestic_dispute',
    'land_dispute', 'cybercrime', 'corruption', 'kidnapping', 'missing_person', 'other'
  ]),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});

const step2Schema = z.object({
  location: z.string().min(2, 'Location is required'),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

const CATEGORY_OPTIONS = Object.entries(CASE_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const URGENCY_OPTIONS = Object.entries(CASE_URGENCY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const ACCEPT_TYPES = 'image/*,video/*,audio/*,.pdf,.doc,.docx';

export function CreateCasePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createCase, addEvidence } = useCaseStore();

  const [step, setStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { requireKyc } = useKycGate();
  const [createdUrgency, setCreatedUrgency] = useState<CaseUrgency>('medium');
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      title: '',
      description: '',
      category: 'other',
      urgency: 'medium',
    },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      location: '',
      latitude: '',
      longitude: '',
    },
  });

  const handleNext = async () => {
    if (step === 1) {
      const valid = await step1Form.trigger();
      if (valid) setStep(2);
    } else if (step === 2) {
      const valid = await step2Form.trigger();
      if (valid) setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    if (!user?.user_id) {
      toast.error('You must be logged in to create a case');
      return;
    }

    // Prompts an unverified complainant but does NOT stop them. Reporting a
    // crime is never gated — see useKycGate for why that distinction exists.
    requireKyc('create_case');

    setIsSubmitting(true);
    try {
      const step1Data = step1Form.getValues();
      const step2Data = step2Form.getValues();

      const caseData = {
        title: step1Data.title,
        description: step1Data.description,
        category: step1Data.category as CaseCategory,
        urgency: step1Data.urgency as CaseUrgency,
        location: step2Data.location,
        latitude: step2Data.latitude ? parseFloat(step2Data.latitude) : undefined,
        longitude: step2Data.longitude ? parseFloat(step2Data.longitude) : undefined,
        complainant_id: user.user_id,
        status: 'submitted' as const,
      };

      const { id, error } = await createCase(caseData);
      if (error || !id) {
        toast.error(error ?? 'Failed to create case');
        return;
      }

      // Upload evidence files
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

      setCreatedCaseId(id);
      setCreatedUrgency(step1Data.urgency as CaseUrgency);
      setShowSuccessModal(true);
      toast.success('Case filed. Complete the filing fee to activate it.');
    } catch (err) {
      console.error('Case creation failed:', err);
      toast.error('Something went wrong while creating the case. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (step / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-surface-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Progress */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <div className="flex justify-between mb-2">
            {STEPS.map((s) => (
              <span
                key={s.id}
                className={cn(
                  'text-sm font-medium',
                  step >= s.id ? 'text-brand-600' : 'text-surface-400'
                )}
              >
                {s.title}
              </span>
            ))}
          </div>
          <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>

        {/* Form */}
        <Card className="overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <Input
                    label="Case Title"
                    placeholder="Brief title for your case"
                    error={step1Form.formState.errors.title?.message}
                    {...step1Form.register('title')}
                  />
                  <TextArea
                    label="Description"
                    placeholder="Provide detailed description of the incident..."
                    rows={5}
                    error={step1Form.formState.errors.description?.message}
                    {...step1Form.register('description')}
                  />
                  <Select
                    label="Category"
                    options={CATEGORY_OPTIONS}
                    error={step1Form.formState.errors.category?.message}
                    {...step1Form.register('category')}
                  />
                  <Select
                    label="Urgency"
                    options={URGENCY_OPTIONS}
                    error={step1Form.formState.errors.urgency?.message}
                    {...step1Form.register('urgency')}
                  />
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/*
                    Replaces three raw fields (a free-text Location plus bare
                    latitude/longitude number inputs). Those produced case
                    records whose location read "6.5244, 3.3792" — unusable for
                    the investigator who has to travel there. The picker resolves
                    coordinates to a street address and keeps both.
                  */}
                  <LocationPicker
                    label="Where did this occur?"
                    required
                    error={step2Form.formState.errors.location?.message}
                    value={{
                      location: step2Form.watch('location') ?? '',
                      latitude: step2Form.watch('latitude')
                        ? Number(step2Form.watch('latitude'))
                        : undefined,
                      longitude: step2Form.watch('longitude')
                        ? Number(step2Form.watch('longitude'))
                        : undefined,
                    }}
                    onChange={(next) => {
                      step2Form.setValue('location', next.location, { shouldValidate: true });
                      step2Form.setValue(
                        'latitude',
                        next.latitude != null ? String(next.latitude) : ''
                      );
                      step2Form.setValue(
                        'longitude',
                        next.longitude != null ? String(next.longitude) : ''
                      );
                    }}
                  />
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-sm text-surface-600 mb-4">
                    Upload images, videos, audio, or documents as evidence.
                  </p>
                  <FileUpload
                    accept={ACCEPT_TYPES}
                    multiple
                    value={uploadedFiles}
                    onChange={setUploadedFiles}
                  />
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="rounded-lg bg-surface-50 p-4 space-y-3">
                    <h4 className="font-semibold text-surface-900">{step1Form.watch('title')}</h4>
                    <p className="text-sm text-surface-600">{step1Form.watch('description')}</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-2 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-medium">
                        {CASE_CATEGORY_LABELS[step1Form.watch('category') as CaseCategory]}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                        {CASE_URGENCY_LABELS[step1Form.watch('urgency') as CaseUrgency]}
                      </span>
                    </div>
                    <p className="text-sm text-surface-600">
                      <strong>Location:</strong> {step2Form.watch('location')}
                    </p>
                    {uploadedFiles.length > 0 && (
                      <p className="text-sm text-surface-600">
                        <strong>Evidence:</strong> {uploadedFiles.length} file(s)
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex justify-between mt-8 pt-6 border-t border-surface-200">
              <Button
                variant="ghost"
                icon={ChevronLeft}
                onClick={handleBack}
                disabled={step === 1}
              >
                Back
              </Button>
              {step < 4 ? (
                <Button icon={ChevronRight} onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button
                  icon={isSubmitting ? Loader2 : Upload}
                  loading={isSubmitting}
                  onClick={handleSubmit}
                >
                  Submit Case
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          navigate(createdCaseId ? `/app/cases/${createdCaseId}` : '/app/cases');
        }}
        title="Case filed"
        size="md"
      >
        <div className="py-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
            <Check className="text-brand-600" size={32} />
          </div>

          <p className="mb-4 text-center text-surface-600">
            Your case is on file and an administrator can see it. The next step is the filing fee —
            an investigator is assigned once it clears.
          </p>

          {/*
            Payment comes AFTER the case exists, never before. A crime report is
            not held behind a paywall; the fee activates the investigation, and
            the case remains on record either way. The price is read from the
            service_prices catalogue by the server — urgent filings cost more, so
            the purpose key follows the urgency chosen on step one.
          */}
          <div className="mb-5 rounded-xl border border-surface-200 bg-surface-50 p-4">
            <p className="text-sm font-medium text-surface-800">Filing fee</p>
            <p className="mt-0.5 text-sm text-surface-600">
              {createdUrgency === 'critical' || createdUrgency === 'high'
                ? 'Priority triage, for high and critical urgency cases.'
                : 'Standard filing and triage.'}{' '}
              The exact amount is shown at checkout before you pay anything.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setShowSuccessModal(false);
                navigate(`/app/cases/${createdCaseId}`);
              }}
            >
              Pay later
            </Button>
            <Button
              className="flex-1"
              icon={ArrowRight}
              onClick={() => {
                setShowSuccessModal(false);
                const purpose =
                  createdUrgency === 'critical' || createdUrgency === 'high'
                    ? 'case_filing_urgent'
                    : 'case_filing_standard';
                navigate(
                  `/app/payments?purpose=${purpose}&caseId=${encodeURIComponent(createdCaseId ?? '')}`
                );
              }}
            >
              Continue to payment
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-surface-400">
            You can pay later from the case page. Until then the case stays unassigned.
          </p>
        </div>
      </Modal>
    </div>
  );
}
