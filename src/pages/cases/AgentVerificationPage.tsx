import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { STORAGE_BUCKETS, buildObjectPath } from '@/lib/supabase';
import {
  Button,
  Input,
  FileUpload,
  Card,
  CardContent,
  StatusBadge,
  Spinner,
} from '@/components/ui';
import type { UploadedFile } from '@/components/ui/FileUpload';
import type { Investigator, VerificationStatus } from '@/types';
import { cn } from '@/utils/cn';

const STEPS = [
  { id: 1, title: 'ID Upload' },
  { id: 2, title: 'Service Records' },
  { id: 3, title: 'Guarantors' },
  { id: 4, title: 'Review' },
];

const guarantorSchema = z.object({
  full_name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(10, 'Valid phone required'),
  relationship: z.string().min(2, 'Relationship required'),
});

type GuarantorData = z.infer<typeof guarantorSchema>;

const STATUS_CONFIG: Record<VerificationStatus, { label: string; variant: 'pending' | 'active' | 'verified' | 'rejected' }> = {
  pending: { label: 'Pending', variant: 'pending' },
  approved: { label: 'Approved', variant: 'verified' },
  rejected: { label: 'Rejected', variant: 'rejected' },
};

export function AgentVerificationPage() {
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [investigator, setInvestigator] = useState<Investigator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [idFiles, setIdFiles] = useState<UploadedFile[]>([]);
  const [serviceFiles, setServiceFiles] = useState<UploadedFile[]>([]);
  const [guarantor1Files, setGuarantor1Files] = useState<UploadedFile[]>([]);
  const [guarantor2Files, setGuarantor2Files] = useState<UploadedFile[]>([]);

  const guarantor1Form = useForm<GuarantorData>({
    resolver: zodResolver(guarantorSchema),
    defaultValues: { full_name: '', email: '', phone: '', relationship: '' },
  });

  const guarantor2Form = useForm<GuarantorData>({
    resolver: zodResolver(guarantorSchema),
    defaultValues: { full_name: '', email: '', phone: '', relationship: '' },
  });

  useEffect(() => {
    async function loadInvestigator() {
      if (!user?.user_id) {
        setIsLoading(false);
        return;
      }
      const { data } = await supabase
        .from('investigators')
        .select('*')
        .eq('user_id', user.user_id)
        .single();
      setInvestigator(data as Investigator | null);
      setIsLoading(false);
    }
    loadInvestigator();
  }, [user?.user_id]);

  const handleNext = async () => {
    if (step === 1) {
      if (idFiles.length === 0) {
        toast.error('Please upload at least one ID document');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (serviceFiles.length === 0) {
        toast.error('Please upload service records');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const v1 = await guarantor1Form.trigger();
      const v2 = await guarantor2Form.trigger();
      if (v1 && v2 && guarantor1Files.length > 0 && guarantor2Files.length > 0) {
        setStep(4);
      } else {
        if (!v1 || !v2) toast.error('Please fill all guarantor fields');
        else toast.error('Please upload ID for both guarantors');
      }
    }
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!user?.user_id) return;
    setIsSubmitting(true);
    try {
      /**
       * Uploads one KYC document and returns its object PATH.
       *
       * `kyc-documents` is a private bucket. This used to return
       * `getPublicUrl()`, which produces a URL that resolves to an error — so
       * the documents were written but neither the applicant nor the reviewing
       * admin could ever open them. Paths are stored and signed at read time
       * instead; see AgentVerificationTab.
       */
      const uploadToStorage = async (
        files: UploadedFile[],
        folder: string
      ): Promise<string | null> => {
        if (files.length === 0) return null;
        const file = files[0].file;
        // The KYC policy checks the first path segment, so the user id must lead.
        const path = buildObjectPath(user.user_id, `${folder}-${file.name}`);
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKETS.KYC_DOCUMENTS)
          .upload(path, file, { upsert: false });
        if (error) throw error;
        return data.path;
      };

      const idUrl = await uploadToStorage(idFiles, 'id');
      const serviceUrl = await uploadToStorage(serviceFiles, 'service');
      const guarantor1IdUrl = await uploadToStorage(guarantor1Files, 'guarantor1');
      const guarantor2IdUrl = await uploadToStorage(guarantor2Files, 'guarantor2');

      const g1 = guarantor1Form.getValues();
      const g2 = guarantor2Form.getValues();

      const { data: invData, error: invError } = await supabase
        .from('investigators')
        .upsert(
          {
            user_id: user.user_id,
            id_document_url: idUrl,
            service_records_url: serviceUrl,
            verification_status: 'pending',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('id')
        .single();
      if (invError) throw invError;

      const investigatorId = (invData as { id: string })?.id;

      if (investigatorId) {
        await supabase.from('guarantors').insert([
          {
            investigator_id: investigatorId,
            full_name: g1.full_name,
            email: g1.email,
            phone: g1.phone,
            relationship: g1.relationship,
            id_document_url: guarantor1IdUrl,
            verification_status: 'pending',
          },
          {
            investigator_id: investigatorId,
            full_name: g2.full_name,
            email: g2.email,
            phone: g2.phone,
            relationship: g2.relationship,
            id_document_url: guarantor2IdUrl,
            verification_status: 'pending',
          },
        ]);
      }

      toast.success('Verification submitted! We will review your application.');
      setInvestigator({
        ...investigator!,
        verification_status: 'pending',
        id_document_url: idUrl ?? undefined,
        service_records_url: serviceUrl ?? undefined,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const status = investigator?.verification_status ?? 'pending';
  const statusConfig = STATUS_CONFIG[status];
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';

  return (
    <div className="min-h-screen bg-surface-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Status banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card
            className={cn(
              isApproved && 'border-green-200 bg-green-50/50',
              isRejected && 'border-accent-200 bg-accent-50/50'
            )}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      isApproved && 'bg-green-100',
                      isRejected && 'bg-accent-100',
                      !isApproved && !isRejected && 'bg-amber-100'
                    )}
                  >
                    {isApproved ? (
                      <Check className="text-green-600" size={24} />
                    ) : isRejected ? (
                      <AlertCircle className="text-accent-600" size={24} />
                    ) : (
                      <ShieldCheck className="text-amber-600" size={24} />
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-surface-900">
                      Verification Status
                    </h2>
                    <StatusBadge status={statusConfig.variant} />
                  </div>
                </div>
              </div>
              {investigator?.admin_notes && (
                <div className="mt-4 p-3 rounded-lg bg-surface-100">
                  <p className="text-sm font-medium text-surface-700">Admin Notes</p>
                  <p className="text-sm text-surface-600 mt-1">
                    {investigator.admin_notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {isApproved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-surface-600">
              Your verification has been approved. You can now accept case assignments.
            </p>
          </motion.div>
        )}

        {!isApproved && (
          <>
            {/* Progress */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
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
                  animate={{ width: `${(step / STEPS.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>

            {/* Form */}
            <Card>
              <CardContent className="p-6 sm:p-8">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h3 className="font-semibold text-surface-900">
                        Upload ID Document
                      </h3>
                      <p className="text-sm text-surface-600">
                        Passport, National ID (NIN), or Driver's License
                      </p>
                      <FileUpload
                        accept="image/*,.pdf"
                        multiple={false}
                        value={idFiles}
                        onChange={setIdFiles}
                      />
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h3 className="font-semibold text-surface-900">
                        Service Records
                      </h3>
                      <p className="text-sm text-surface-600">
                        Upload your experience and service records
                      </p>
                      <FileUpload
                        accept="image/*,.pdf,.doc,.docx"
                        multiple
                        value={serviceFiles}
                        onChange={setServiceFiles}
                      />
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-8"
                    >
                      <h3 className="font-semibold text-surface-900">
                        Guarantors (2 required)
                      </h3>
                      <div className="space-y-6">
                        <div className="p-4 rounded-lg border border-surface-200 space-y-4">
                          <p className="text-sm font-medium text-surface-700">
                            Guarantor 1
                          </p>
                          <Input
                            label="Full Name"
                            error={guarantor1Form.formState.errors.full_name?.message}
                            {...guarantor1Form.register('full_name')}
                          />
                          <Input
                            label="Email"
                            type="email"
                            error={guarantor1Form.formState.errors.email?.message}
                            {...guarantor1Form.register('email')}
                          />
                          <Input
                            label="Phone"
                            error={guarantor1Form.formState.errors.phone?.message}
                            {...guarantor1Form.register('phone')}
                          />
                          <Input
                            label="Relationship"
                            placeholder="e.g. Colleague, Supervisor"
                            error={guarantor1Form.formState.errors.relationship?.message}
                            {...guarantor1Form.register('relationship')}
                          />
                          <FileUpload
                            accept="image/*,.pdf"
                            multiple={false}
                            value={guarantor1Files}
                            onChange={setGuarantor1Files}
                          />
                        </div>
                        <div className="p-4 rounded-lg border border-surface-200 space-y-4">
                          <p className="text-sm font-medium text-surface-700">
                            Guarantor 2
                          </p>
                          <Input
                            label="Full Name"
                            error={guarantor2Form.formState.errors.full_name?.message}
                            {...guarantor2Form.register('full_name')}
                          />
                          <Input
                            label="Email"
                            type="email"
                            error={guarantor2Form.formState.errors.email?.message}
                            {...guarantor2Form.register('email')}
                          />
                          <Input
                            label="Phone"
                            error={guarantor2Form.formState.errors.phone?.message}
                            {...guarantor2Form.register('phone')}
                          />
                          <Input
                            label="Relationship"
                            placeholder="e.g. Colleague, Supervisor"
                            error={guarantor2Form.formState.errors.relationship?.message}
                            {...guarantor2Form.register('relationship')}
                          />
                          <FileUpload
                            accept="image/*,.pdf"
                            multiple={false}
                            value={guarantor2Files}
                            onChange={setGuarantor2Files}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h3 className="font-semibold text-surface-900">
                        Review & Submit
                      </h3>
                      <div className="rounded-lg bg-surface-50 p-4 space-y-3 text-sm">
                        <p>
                          <strong>ID Documents:</strong> {idFiles.length} file(s)
                        </p>
                        <p>
                          <strong>Service Records:</strong> {serviceFiles.length} file(s)
                        </p>
                        <p>
                          <strong>Guarantor 1:</strong>{' '}
                          {guarantor1Form.watch('full_name')} (
                          {guarantor1Form.watch('email')})
                        </p>
                        <p>
                          <strong>Guarantor 2:</strong>{' '}
                          {guarantor2Form.watch('full_name')} (
                          {guarantor2Form.watch('email')})
                        </p>
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
                      icon={isSubmitting ? undefined : Check}
                      loading={isSubmitting}
                      onClick={handleSubmit}
                    >
                      Submit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
