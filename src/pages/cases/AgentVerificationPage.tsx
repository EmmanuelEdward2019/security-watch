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
  TextArea,
  Select,
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
  { id: 1, title: 'Identity' },
  { id: 2, title: 'Background' },
  { id: 3, title: 'Documents' },
  { id: 4, title: 'Guarantors' },
  { id: 5, title: 'Review' },
];

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
];

const SPECIALISATIONS = [
  'Missing persons', 'Fraud and financial crime', 'Cybercrime', 'Land and property',
  'Surveillance', 'Background checks', 'Corporate investigation', 'Family and matrimonial',
  'Criminal defence', 'Human rights', 'Forensic pathology', 'Forensic psychology',
  'Medical records analysis', 'Ballistics', 'Digital forensics',
];

/**
 * Identity, as required by submit_kyc_for_review() in migration 013.
 *
 * The RPC enforces these server-side so web and mobile cannot diverge. The
 * screen used to collect none of them — it uploaded two files and wrote
 * `verification_status` directly, which meant an admin approved a professional
 * on a filename. NIN is validated to Nigeria's 11-digit format.
 */
const identitySchema = z.object({
  date_of_birth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((value) => {
      const dob = new Date(value);
      if (Number.isNaN(dob.getTime())) return false;
      const age = (Date.now() - dob.getTime()) / 31_557_600_000;
      return age >= 18 && age <= 100;
    }, 'You must be between 18 and 100 years old'),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  national_id_number: z
    .string()
    .regex(/^\d{11}$/, 'A NIN is exactly 11 digits'),
  residential_address: z.string().min(10, 'Enter your full residential address'),
  state_of_residence: z.string().min(2, 'Select your state of residence'),
  nationality: z.string().min(2, 'Nationality is required'),
});

type IdentityData = z.infer<typeof identitySchema>;

/** Professional standing — what an admin actually weighs when approving. */
const backgroundSchema = z.object({
  professional_summary: z
    .string()
    .min(50, 'Give at least 50 characters describing your professional background'),
  qualifications: z.string().min(3, 'List your qualifications'),
  license_number: z.string().optional(),
  licensing_body: z.string().optional(),
  previous_employer: z.string().optional(),
  previous_position: z.string().optional(),
});

type BackgroundData = z.infer<typeof backgroundSchema>;

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
  const [extraFiles, setExtraFiles] = useState<UploadedFile[]>([]);
  const [specialisation, setSpecialisation] = useState<string[]>([]);

  const identityForm = useForm<IdentityData>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      date_of_birth: '',
      gender: 'prefer_not_to_say',
      national_id_number: '',
      residential_address: '',
      state_of_residence: '',
      nationality: 'Nigerian',
    },
  });

  const backgroundForm = useForm<BackgroundData>({
    resolver: zodResolver(backgroundSchema),
    defaultValues: {
      professional_summary: '',
      qualifications: '',
      license_number: '',
      licensing_body: '',
      previous_employer: '',
      previous_position: '',
    },
  });

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
        // An applicant has no row until they submit — .single() would raise
        // PGRST116 on every first visit.
        .maybeSingle();
      const existing = (data as Investigator | null) ?? null;
      setInvestigator(existing);

      // A rejected applicant resubmits by correcting what was wrong, not by
      // retyping their date of birth.
      if (existing) {
        identityForm.reset({
          date_of_birth: existing.date_of_birth ?? '',
          gender: existing.gender ?? 'prefer_not_to_say',
          national_id_number: existing.national_id_number ?? '',
          residential_address: existing.residential_address ?? '',
          state_of_residence: existing.state_of_residence ?? '',
          nationality: existing.nationality ?? 'Nigerian',
        });
        backgroundForm.reset({
          professional_summary: existing.professional_summary ?? '',
          qualifications: existing.qualifications ?? '',
          license_number: existing.license_number ?? '',
          licensing_body: existing.licensing_body ?? '',
          previous_employer: existing.previous_employer ?? '',
          previous_position: existing.previous_position ?? '',
        });
        setSpecialisation(existing.specialization ?? []);
      }

      setIsLoading(false);
    }
    loadInvestigator();
  }, [user?.user_id]);

  const hasStoredId = Boolean(investigator?.id_document_url);
  const hasStoredService = Boolean(investigator?.service_records_url);

  const handleNext = async () => {
    if (step === 1) {
      if (!(await identityForm.trigger())) {
        toast.error('Complete every identity field before continuing');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const ok = await backgroundForm.trigger();
      if (!ok) {
        toast.error('Complete your professional background before continuing');
        return;
      }
      if (specialisation.length === 0) {
        toast.error('Select at least one area of specialisation');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // A returning applicant already has these on file.
      if (idFiles.length === 0 && !hasStoredId) {
        toast.error('Upload a government-issued ID');
        return;
      }
      if (serviceFiles.length === 0 && !hasStoredService) {
        toast.error('Upload your service records');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      const v1 = await guarantor1Form.trigger();
      const v2 = await guarantor2Form.trigger();
      if (v1 && v2 && guarantor1Files.length > 0 && guarantor2Files.length > 0) {
        setStep(5);
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

      const idUrl = (await uploadToStorage(idFiles, 'id')) ?? investigator?.id_document_url ?? null;
      const serviceUrl =
        (await uploadToStorage(serviceFiles, 'service')) ?? investigator?.service_records_url ?? null;
      const guarantor1IdUrl = await uploadToStorage(guarantor1Files, 'guarantor1');
      const guarantor2IdUrl = await uploadToStorage(guarantor2Files, 'guarantor2');

      const identity = identityForm.getValues();
      const background = backgroundForm.getValues();
      const g1 = guarantor1Form.getValues();
      const g2 = guarantor2Form.getValues();

      const { data: invData, error: invError } = await supabase
        .from('investigators')
        .upsert(
          {
            user_id: user.user_id,
            // Identity — required by submit_kyc_for_review()
            date_of_birth: identity.date_of_birth,
            gender: identity.gender,
            national_id_number: identity.national_id_number,
            residential_address: identity.residential_address,
            state_of_residence: identity.state_of_residence,
            nationality: identity.nationality,
            // Professional standing
            professional_summary: background.professional_summary,
            qualifications: background.qualifications,
            license_number: background.license_number || null,
            licensing_body: background.licensing_body || null,
            previous_employer: background.previous_employer || null,
            previous_position: background.previous_position || null,
            specialization: specialisation,
            id_document_url: idUrl,
            service_records_url: serviceUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('id')
        .single();
      if (invError) throw invError;

      const investigatorId = (invData as { id: string })?.id;

      if (investigatorId) {
        /*
         * Guarantors are replaced, not appended.
         *
         * The previous version inserted two more rows on every submission, so a
         * rejected applicant who fixed one phone number and resubmitted ended up
         * with four guarantors, then six, and the admin screen showed all of
         * them with no way to tell which pair was current.
         *
         * The DELETE policy that makes the replacement work arrives in migration
         * 016. Until that is applied the delete is filtered by RLS and silently
         * removes nothing, so we re-count afterwards and skip the insert rather
         * than recreate the duplication we are trying to fix. Once 016 is live
         * the count is zero and the insert always runs.
         */
        await supabase.from('guarantors').delete().eq('investigator_id', investigatorId);

        const { count: remaining } = await supabase
          .from('guarantors')
          .select('id', { count: 'exact', head: true })
          .eq('investigator_id', investigatorId);

        if ((remaining ?? 0) >= 2) {
          toast('Your existing guarantors were kept — contact support to change them.', {
            icon: 'ℹ️',
          });
        } else {
          const { error: gErr } = await supabase.from('guarantors').insert(
            [
              { ...g1, id_document_url: guarantor1IdUrl },
              { ...g2, id_document_url: guarantor2IdUrl },
            ].map((g) => ({
              investigator_id: investigatorId,
              full_name: g.full_name,
              email: g.email,
              phone: g.phone,
              relationship: g.relationship,
              id_document_url: g.id_document_url,
              verification_status: 'pending' as const,
            }))
          );
          if (gErr) throw gErr;
        }

        // Documents are replaced too — 013 already grants the applicant DELETE
        // on their own pending documents, so this one works today.
        await supabase.from('kyc_documents').delete().eq('investigator_id', investigatorId);

        // Supporting documents, one row each, so an admin sees a labelled list
        // rather than two anonymous thumbnails.
        const documentRows: Array<{
          investigator_id: string;
          uploaded_by: string;
          document_type: string;
          label: string;
          file_path: string;
          file_name: string;
          file_size: number;
          file_type: string;
        }> = [];

        const registerDocs = async (files: UploadedFile[], type: string, label: string) => {
          for (const entry of files) {
            const path = await uploadToStorage([entry], type);
            if (!path) continue;
            documentRows.push({
              investigator_id: investigatorId,
              uploaded_by: user.user_id,
              document_type: type,
              label,
              file_path: path,
              file_name: entry.file.name,
              file_size: entry.file.size,
              file_type: entry.file.type || 'application/octet-stream',
            });
          }
        };

        await registerDocs(extraFiles, 'other', 'Supporting document');

        if (idUrl && idFiles[0]) {
          documentRows.push({
            investigator_id: investigatorId,
            uploaded_by: user.user_id,
            document_type: 'national_id',
            label: 'Government-issued ID',
            file_path: idUrl,
            file_name: idFiles[0].file.name,
            file_size: idFiles[0].file.size,
            file_type: idFiles[0].file.type || 'application/octet-stream',
          });
        }
        if (serviceUrl && serviceFiles[0]) {
          documentRows.push({
            investigator_id: investigatorId,
            uploaded_by: user.user_id,
            document_type: 'service_record',
            label: 'Service record',
            file_path: serviceUrl,
            file_name: serviceFiles[0].file.name,
            file_size: serviceFiles[0].file.size,
            file_type: serviceFiles[0].file.type || 'application/octet-stream',
          });
        }

        if (documentRows.length > 0) {
          const { error: docErr } = await supabase.from('kyc_documents').insert(documentRows);
          if (docErr) throw docErr;
        }
      }

      /*
       * Hand off to the server for the actual state change.
       *
       * The status was previously set from the client by writing
       * `verification_status: 'pending'` into the upsert above. That is the one
       * column the guard trigger in migration 004 pins, so on a resubmission it
       * silently did nothing — and more importantly no admin was ever notified
       * and nothing was written to the audit log. submit_kyc_for_review()
       * re-checks completeness server-side, stamps submitted_at, records which
       * role was applied for, notifies every admin and writes the audit entry.
       */
      const { error: rpcError } = await supabase.rpc('submit_kyc_for_review');
      if (rpcError) throw rpcError;

      toast.success('Verification submitted! We will review your application.');
      // Re-read rather than patching local state: the server decides the status.
      const { data: refreshed } = await supabase
        .from('investigators')
        .select('*')
        .eq('user_id', user.user_id)
        .maybeSingle();
      setInvestigator((refreshed as Investigator | null) ?? investigator);
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
                      <div>
                        <h3 className="font-semibold text-surface-900">Your identity</h3>
                        <p className="text-sm text-surface-600">
                          These details are checked against the ID you upload next. They are
                          visible only to you and to the administrators reviewing your
                          application.
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                          type="date"
                          label="Date of birth"
                          max={new Date().toISOString().slice(0, 10)}
                          error={identityForm.formState.errors.date_of_birth?.message}
                          {...identityForm.register('date_of_birth')}
                        />
                        <Select
                          label="Gender"
                          error={identityForm.formState.errors.gender?.message}
                          options={[
                            { value: 'male', label: 'Male' },
                            { value: 'female', label: 'Female' },
                            { value: 'other', label: 'Other' },
                            { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                          ]}
                          {...identityForm.register('gender')}
                        />
                      </div>

                      <Input
                        label="National Identification Number (NIN)"
                        placeholder="11 digits"
                        inputMode="numeric"
                        maxLength={11}
                        error={identityForm.formState.errors.national_id_number?.message}
                        {...identityForm.register('national_id_number')}
                      />

                      <TextArea
                        label="Residential address"
                        rows={3}
                        placeholder="House number, street, area, city"
                        error={identityForm.formState.errors.residential_address?.message}
                        {...identityForm.register('residential_address')}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Select
                          label="State of residence"
                          error={identityForm.formState.errors.state_of_residence?.message}
                          options={[
                            { value: '', label: 'Select a state' },
                            ...NIGERIAN_STATES.map((st) => ({ value: st, label: st })),
                          ]}
                          {...identityForm.register('state_of_residence')}
                        />
                        <Input
                          label="Nationality"
                          error={identityForm.formState.errors.nationality?.message}
                          {...identityForm.register('nationality')}
                        />
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2b"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div>
                        <h3 className="font-semibold text-surface-900">
                          Professional background
                        </h3>
                        <p className="text-sm text-surface-600">
                          An administrator decides here whether you should be able to read
                          criminal case files. Be specific.
                        </p>
                      </div>

                      <TextArea
                        label="Professional summary"
                        rows={5}
                        placeholder="Your experience, the kind of work you have done, and why you are applying."
                        error={backgroundForm.formState.errors.professional_summary?.message}
                        {...backgroundForm.register('professional_summary')}
                      />

                      <TextArea
                        label="Qualifications"
                        rows={3}
                        placeholder="Degrees, diplomas, professional training"
                        error={backgroundForm.formState.errors.qualifications?.message}
                        {...backgroundForm.register('qualifications')}
                      />

                      <div>
                        <label className="mb-2 block text-sm font-medium text-surface-700">
                          Areas of specialisation
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {SPECIALISATIONS.map((item) => {
                            const active = specialisation.includes(item);
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() =>
                                  setSpecialisation((current) =>
                                    active
                                      ? current.filter((c) => c !== item)
                                      : [...current, item]
                                  )
                                }
                                className={cn(
                                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                                  active
                                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                                    : 'border-surface-300 text-surface-600 hover:border-surface-400'
                                )}
                              >
                                {item}
                              </button>
                            );
                          })}
                        </div>
                        {specialisation.length === 0 && (
                          <p className="mt-2 text-xs text-surface-500">
                            Select at least one.
                          </p>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                          label="Licence number (optional)"
                          {...backgroundForm.register('license_number')}
                        />
                        <Input
                          label="Licensing body (optional)"
                          placeholder="e.g. Nigerian Bar Association"
                          {...backgroundForm.register('licensing_body')}
                        />
                        <Input
                          label="Previous employer (optional)"
                          {...backgroundForm.register('previous_employer')}
                        />
                        <Input
                          label="Previous position (optional)"
                          {...backgroundForm.register('previous_position')}
                        />
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="font-semibold text-surface-900">Documents</h3>
                        <p className="text-sm text-surface-600">
                          Files are stored in a private bucket. Only you and the reviewing
                          administrator can open them.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-surface-700">
                          Government-issued ID
                        </p>
                        <p className="text-xs text-surface-500">
                          Passport, National ID card (NIN slip), or driver's licence. The name
                          and NIN must match what you entered.
                        </p>
                        {hasStoredId && idFiles.length === 0 && (
                          <p className="text-xs text-green-700">
                            An ID is already on file. Upload a new one only to replace it.
                          </p>
                        )}
                        <FileUpload
                          accept="image/*,.pdf"
                          multiple={false}
                          value={idFiles}
                          onChange={setIdFiles}
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-surface-700">Service records</p>
                        <p className="text-xs text-surface-500">
                          Employment history, discharge papers, or professional registration.
                        </p>
                        {hasStoredService && serviceFiles.length === 0 && (
                          <p className="text-xs text-green-700">
                            Service records are already on file.
                          </p>
                        )}
                        <FileUpload
                          accept="image/*,.pdf,.doc,.docx"
                          multiple
                          value={serviceFiles}
                          onChange={setServiceFiles}
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-surface-700">
                          Supporting documents (optional)
                        </p>
                        <p className="text-xs text-surface-500">
                          Call to bar, medical licence, police clearance, academic
                          certificates, CV — anything that strengthens your application.
                        </p>
                        <FileUpload
                          accept="image/*,.pdf,.doc,.docx"
                          multiple
                          value={extraFiles}
                          onChange={setExtraFiles}
                        />
                      </div>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div
                      key="step4"
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

                  {step === 5 && (
                    <motion.div
                      key="step5"
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
