import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { uploadFile, buildObjectPath, STORAGE_BUCKETS } from '@/lib/supabase';
import { Button, Input, TextArea, FileUpload } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import type { UploadedFile } from '@/components/ui';
import { ROLE_HOME } from '@/lib/rbac';
import type { UserRole } from '@/types';
import toast from 'react-hot-toast';

const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  bio: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  specialization: z.string().optional(),
  experienceYears: z.number().min(0).max(50).optional(),
  serviceArea: z.string().max(200).optional(),
  businessName: z.string().max(200).optional(),
  registrationNumber: z.string().max(100).optional(),
});

type FormData = z.infer<typeof schema>;

function getDashboardPath(role?: UserRole): string {
  return ROLE_HOME[role ?? 'complainant'];
}

export function ProfileCompletionPage() {
  const [avatarFiles, setAvatarFiles] = useState<UploadedFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();

  useEffect(() => {
    if (user?.full_name && user.full_name.length > 0 && user.bio !== undefined) {
      navigate(getDashboardPath(user.role), { replace: true });
    }
  }, [user, navigate]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      bio: '',
      location: '',
      specialization: '',
      experienceYears: undefined,
      serviceArea: '',
      businessName: '',
      registrationNumber: '',
    },
  });

  const role = user?.role ?? 'complainant';
  const isInvestigator = role === 'investigator';
  const isLandlord = role === 'landlord';

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setProgress(30);

    let avatarUrl: string | undefined;
    if (avatarFiles.length > 0 && avatarFiles[0].file) {
      const path = buildObjectPath(user?.user_id ?? '', avatarFiles[0].file.name);
      const { url, error } = await uploadFile(
        STORAGE_BUCKETS.AVATARS,
        path,
        avatarFiles[0].file
      );
      if (error) {
        toast.error('Avatar upload failed — saving profile without photo');
      } else {
        avatarUrl = url;
      }
    }
    setProgress(60);

    const updates: Record<string, unknown> = {
      full_name: data.full_name,
      bio: data.bio || undefined,
      location: data.location || undefined,
    };
    if (avatarUrl) updates.avatar_url = avatarUrl;

    const { error } = await updateProfile(updates);
    setProgress(100);
    setIsLoading(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Profile updated!');
    navigate(getDashboardPath(user?.role), { replace: true });
  };

  const handleSkip = () => {
    navigate(getDashboardPath(user?.role), { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-surface-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <div className="rounded-2xl border border-surface-200 bg-white shadow-lg p-8">
          <h1 className="text-2xl font-bold text-surface-900">
            Complete your profile
          </h1>
          <p className="mt-1 text-surface-500">
            Add a few details to help others connect with you
          </p>

          {/* Progress bar */}
          <div className="mt-6 h-1.5 rounded-full bg-surface-200 overflow-hidden">
            <motion.div
              className="h-full bg-brand-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
            <Input
              label="Full Name"
              placeholder="Your full name"
              error={form.formState.errors.full_name?.message}
              {...form.register('full_name')}
            />

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">
                Profile photo (optional)
              </label>
              <FileUpload
                accept="image/*"
                multiple={false}
                maxSize={5 * 1024 * 1024}
                value={avatarFiles}
                onChange={setAvatarFiles}
              />
            </div>

            <TextArea
              label="Bio"
              placeholder="Tell us a bit about yourself..."
              rows={4}
              error={form.formState.errors.bio?.message}
              {...form.register('bio')}
            />

            <Input
              label="Location"
              placeholder="City, Country"
              error={form.formState.errors.location?.message}
              {...form.register('location')}
            />

            {isInvestigator && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <Input
                  label="Specialization"
                  placeholder="e.g. Fraud, Cybercrime"
                  error={form.formState.errors.specialization?.message}
                  {...form.register('specialization')}
                />
                <Input
                  label="Years of experience"
                  type="number"
                  placeholder="0"
                  error={form.formState.errors.experienceYears?.message}
                  {...form.register('experienceYears', { valueAsNumber: true })}
                />
                <Input
                  label="Service area"
                  placeholder="e.g. Lagos, Abuja"
                  error={form.formState.errors.serviceArea?.message}
                  {...form.register('serviceArea')}
                />
              </motion.div>
            )}

            {isLandlord && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <Input
                  label="Business name"
                  placeholder="Your company or property business name"
                  error={form.formState.errors.businessName?.message}
                  {...form.register('businessName')}
                />
                <Input
                  label="Registration number"
                  placeholder="CAC or business registration number"
                  error={form.formState.errors.registrationNumber?.message}
                  {...form.register('registrationNumber')}
                />
              </motion.div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkip}
                className="flex-1"
              >
                Skip for now
              </Button>
              <Button
                type="submit"
                loading={isLoading}
                className="flex-1"
              >
                Save profile
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
