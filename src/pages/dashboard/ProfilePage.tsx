import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, ShieldCheck, MapPin, Briefcase } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Avatar, Button, Input, TextArea, Card, CardHeader, CardContent } from '@/components/ui';
import { uploadFile, buildObjectPath, STORAGE_BUCKETS } from '@/lib/supabase';
import { format } from 'date-fns';
import { USER_ROLE_LABELS } from '@/types';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name required'),
  phone: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      phone: user?.phone ?? '',
      bio: user?.bio ?? '',
      location: user?.location ?? '',
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name ?? '',
        phone: user.phone ?? '',
        bio: user.bio ?? '',
        location: user.location ?? '',
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileForm) => {
    setSaving(true);
    let avatarUrl = user?.avatar_url;
    if (avatarFile && user) {
      const path = buildObjectPath(user.user_id, avatarFile.name);
      const { url, error } = await uploadFile(STORAGE_BUCKETS.AVATARS, path, avatarFile);
      if (error) {
        toast.error('Avatar upload failed');
        setSaving(false);
        return;
      }
      avatarUrl = url;
    }
    const { error } = await updateProfile({ ...data, avatar_url: avatarUrl });
    setSaving(false);
    if (error) toast.error(error);
    else toast.success('Profile updated');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl space-y-6"
    >
      <h1 className="text-2xl font-bold text-surface-900">Profile</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900">Profile Information</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar
                  src={avatarFile ? URL.createObjectURL(avatarFile) : user?.avatar_url}
                  name={user?.full_name ?? ''}
                  size="lg"
                />
                <label className="absolute bottom-0 right-0 p-1.5 bg-brand-500 rounded-full text-white cursor-pointer hover:bg-brand-600 transition-colors">
                  <Camera size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <div>
                <p className="font-medium">{user?.full_name}</p>
                <p className="text-sm text-surface-500">{user?.email}</p>
                <p className="text-sm mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-medium">
                    KYC: {user?.kyc_status}
                  </span>
                </p>
              </div>
            </div>
            <Input
              label="Full Name"
              {...register('full_name')}
              error={errors.full_name?.message}
            />
            <Input
              label="Phone"
              {...register('phone')}
            />
            <Input
              label="Location"
              {...register('location')}
            />
            <TextArea
              label="Bio"
              {...register('bio')}
            />
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900 flex items-center gap-2">
              <ShieldCheck size={20} /> Verification Status
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-surface-600">KYC Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                user?.kyc_status === 'approved' ? 'bg-green-100 text-green-700' :
                user?.kyc_status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {user?.kyc_status === 'approved' ? 'Verified' : user?.kyc_status === 'rejected' ? 'Rejected' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-surface-600">Email</span>
              <span className="text-sm text-surface-900">{user?.email}</span>
            </div>
            {user?.kyc_status !== 'approved' && (
              <p className="text-xs text-surface-500 pt-2 border-t border-surface-100">
                Complete your verification to access all features. Upload required documents in your profile.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900 flex items-center gap-2">
              <Briefcase size={20} /> Role Details
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-surface-600">Role</span>
              <span className="px-3 py-1 rounded-full bg-forest-100 text-forest-700 text-xs font-medium">
                {user?.role ? USER_ROLE_LABELS[user.role] : '—'}
              </span>
            </div>
            {user?.location && (
              <div className="flex items-center justify-between">
                <span className="text-surface-600">Location</span>
                <span className="text-sm text-surface-900 flex items-center gap-1">
                  <MapPin size={14} /> {user.location}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-surface-600">Member since</span>
              <span className="text-sm text-surface-900">
                {user?.created_at ? format(new Date(user.created_at), 'MMMM yyyy') : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      </form>
    </motion.div>
  );
}
