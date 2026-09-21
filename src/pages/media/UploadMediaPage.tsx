import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMediaStore } from '@/stores/mediaStore';
import { useAuthStore } from '@/stores/authStore';
import { useKycGate } from '@/hooks/useKycGate';
import {
  Button,
  Input,
  Select,
  FileUpload,
  Card,
  CardContent,
} from '@/components/ui';
import { STORAGE_BUCKETS, uploadFile, buildObjectPath, generateFileHash } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { reverseGeocode } from '@/services/geocodingService';

const MEDIA_TYPE_OPTIONS = [
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'photo', label: 'Photo' },
  { value: 'document', label: 'Document' },
];

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  institution_id: z.string().min(1, 'Select an institution'),
  media_type: z.enum(['video', 'audio', 'photo', 'document']),
  tags: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function UploadMediaPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { requireKyc } = useKycGate();
  const { institutions, createMediaReport, fetchInstitutions } = useMediaStore();

  const [file, setFile] = useState<{ id: string; file: File; preview?: string; size: number } | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; address?: string | null } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      institution_id: '',
      media_type: 'video',
      tags: '',
    },
  });

  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGps(fix);
          // Best effort and non-blocking: an upload must not wait on a
          // geocoder, and a missing address is stored as null (033).
          void reverseGeocode(fix.lat, fix.lng).then((place) => {
            if (place) setGps((prev) => (prev ? { ...prev, address: place.displayName } : prev));
          });
        },
        () => setGps(null)
      );
    }
  }, []);

  const institutionOptions = [
    { value: '', label: 'Select institution' },
    ...institutions.map((i) => ({ value: i.id, label: i.name })),
  ];

  const onSubmit = async (data: FormData) => {
    if (!user || !file) {
      toast.error('Please upload a file');
      return;
    }

    // Hard gate: this role handles other people's data or takes money,
    // so it must be verified first. Returns false and shows the prompt.
    if (!requireKyc('upload_media')) return;

    setIsSubmitting(true);

    // Keyed by uploader: the media bucket grants the uploader, admins, and
    // everyone once an administrator publishes the report.
    const path = buildObjectPath(user.user_id, file.file.name);
    // Hashed on the way in so the file can be shown to be unmodified later.
    const hash = await generateFileHash(file.file);

    const { path: storedPath, error: uploadError } = await uploadFile(
      STORAGE_BUCKETS.MEDIA_REPORTS,
      path,
      file.file
    );

    if (uploadError) {
      toast.error(uploadError);
      setIsSubmitting(false);
      return;
    }

    const tags = data.tags
      ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const { id, error } = await createMediaReport({
      institution_id: data.institution_id,
      reporter_id: user.user_id,
      title: data.title,
      description: `${data.description}\n\n— SHA-256 ${hash}`,
      media_type: data.media_type,
      // The object path, not a URL: the bucket is private and reads are signed.
      file_url: storedPath,
      gps_latitude: gps?.lat,
      gps_longitude: gps?.lng,
      gps_address: gps?.address ?? null,
      // status and views are set by a database trigger — a reporter cannot file
      // something already marked published.
      tags,
    });

    setIsSubmitting(false);

    if (error || !id) {
      toast.error(error ?? 'Failed to submit report');
      return;
    }

    toast.success('Report submitted for review');
    navigate('/app/media/agent');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-surface-600">Sign in to upload media reports.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-surface-900 mb-2">
            Upload Media Report
          </h1>
          <p className="text-surface-600 mb-8">
            Submit citizen-reported coverage of public institutions.
          </p>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <Input
                  label="Title"
                  {...register('title')}
                  error={errors.title?.message}
                />
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    {...register('description')}
                    className="w-full rounded-lg border border-surface-300 px-3 py-2 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
                <Select
                  label="Institution"
                  options={institutionOptions}
                  {...register('institution_id')}
                  error={errors.institution_id?.message}
                />
                <Select
                  label="Media Type"
                  options={MEDIA_TYPE_OPTIONS}
                  {...register('media_type')}
                />
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Media File
                  </label>
                  <FileUpload
                    accept="video/*,audio/*,image/*,.pdf,.doc,.docx"
                    multiple={false}
                    value={file ? [file] : []}
                    onChange={(files) => setFile(files[0] ?? null)}
                  />
                </div>
                <Input
                  label="Tags (comma-separated)"
                  placeholder="e.g. service, delay, corruption"
                  {...register('tags')}
                />
                {gps && (
                  <p className="text-sm text-surface-500">
                    GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} (auto-captured)
                  </p>
                )}
                <p className="text-xs text-surface-500">
                  Timestamp will be automatically attached on submit.
                </p>

                {/* Preview */}
                {watch('title') && (
                  <div className="rounded-lg bg-surface-50 p-4 border border-surface-200">
                    <h3 className="text-sm font-medium text-surface-700 mb-2">
                      Preview
                    </h3>
                    <p className="font-medium text-surface-900">{watch('title')}</p>
                    {watch('description') && (
                      <p className="text-sm text-surface-600 mt-1">
                        {watch('description')}
                      </p>
                    )}
                    <p className="text-xs text-surface-500 mt-2">
                      {watch('media_type')} •{' '}
                      {institutions.find((i) => i.id === watch('institution_id'))?.name ?? '—'}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate(-1)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    disabled={!file}
                  >
                    Submit Report
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
