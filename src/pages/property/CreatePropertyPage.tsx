import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePropertyStore } from '@/stores/propertyStore';
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
import { STORAGE_BUCKETS, uploadFile, buildObjectPath } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';

const STEPS = [
  { id: 'basic', title: 'Basic Info' },
  { id: 'details', title: 'Details' },
  { id: 'images', title: 'Images' },
  { id: 'documents', title: 'Documents' },
  { id: 'review', title: 'Review' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'office', label: 'Office' },
];

const LISTING_TYPE_OPTIONS = [
  { value: 'sale', label: 'For Sale' },
  { value: 'rent', label: 'For Rent' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'NGN', label: 'NGN' },
];

const step1Schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  property_type: z.enum(['apartment', 'house', 'land', 'commercial', 'office']),
  listing_type: z.enum(['sale', 'rent']),
  price: z.number().min(1, 'Price is required'),
  currency: z.string().min(1, 'Currency is required'),
});

const step2Schema = z.object({
  location: z.string().min(2, 'Location is required'),
  address: z.string().min(5, 'Address is required'),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  area_sqm: z.number().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

export function CreatePropertyPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { requireKyc } = useKycGate();
  const { createProperty, addDocument } = usePropertyStore();

  const [step, setStep] = useState(0);
  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState('');
  const [imageFiles, setImageFiles] = useState<{ id: string; file: File; preview?: string; size: number }[]>([]);
  const [documentFiles, setDocumentFiles] = useState<{ id: string; file: File; preview?: string; size: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      title: '',
      description: '',
      property_type: 'apartment',
      listing_type: 'rent',
      price: 0,
      currency: 'USD',
    },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      location: '',
      address: '',
      bedrooms: undefined,
      bathrooms: undefined,
      area_sqm: undefined,
    },
  });

  const addFeature = () => {
    const trimmed = featureInput.trim();
    if (trimmed && !features.includes(trimmed)) {
      setFeatures([...features, trimmed]);
      setFeatureInput('');
    }
  };

  const removeFeature = (f: string) => {
    setFeatures(features.filter((x) => x !== f));
  };

  const handleImageChange = (files: { id: string; file: File; preview?: string; size: number }[]) => {
    setImageFiles(files);
  };

  const handleDocumentChange = (files: { id: string; file: File; preview?: string; size: number }[]) => {
    setDocumentFiles(files);
  };

  const canProceed = () => {
    if (step === 0) return step1Form.formState.isValid;
    if (step === 1) return step2Form.formState.isValid;
    if (step === 2) return imageFiles.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be logged in to create a property');
      return;
    }

    const basic = step1Form.getValues();
    const details = step2Form.getValues();

    // Hard gate: this role handles other people's data or takes money,
    // so it must be verified first. Returns false and shows the prompt.
    if (!requireKyc('list_property')) return;

    setIsSubmitting(true);

    // Upload images
    const imageUrls: string[] = [];
    for (const { file } of imageFiles) {
      const path = buildObjectPath(user.user_id, file.name);
      const { url, error } = await uploadFile(STORAGE_BUCKETS.PROPERTY_IMAGES, path, file);
      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        setIsSubmitting(false);
        return;
      }
      imageUrls.push(url);
    }

    const { id, error } = await createProperty({
      owner_id: user.user_id,
      title: basic.title,
      description: basic.description,
      property_type: basic.property_type,
      listing_type: basic.listing_type,
      price: basic.price,
      currency: basic.currency,
      location: details.location,
      address: details.address,
      bedrooms: details.bedrooms,
      bathrooms: details.bathrooms,
      area_sqm: details.area_sqm,
      status: 'unverified',
      is_active: true,
      images: imageUrls,
      features,
    });

    if (error || !id) {
      toast.error(error ?? 'Failed to create property');
      setIsSubmitting(false);
      return;
    }

    // Upload documents
    for (const { file } of documentFiles) {
      // Title documents are keyed by property: only the owner and admins can
      // read them.
      const path = buildObjectPath(id, file.name);
      const { path: storedPath, error: docError } = await uploadFile(
        STORAGE_BUCKETS.PROPERTY_DOCUMENTS,
        path,
        file
      );

      if (!docError && storedPath) {
        await addDocument({
          property_id: id,
          /*
           * `other`, not the file extension.
           *
           * This used to store `file.name.split('.').pop()` — so a title deed
           * was filed as "pdf" and a survey plan as "jpg". An administrator
           * reviewing the listing saw a list of file formats rather than what
           * each document actually was, and the type could never match the
           * vocabulary the rest of the platform uses.
           *
           * The type is set properly from the property screen, where the
           * uploader chooses it. Here it is honestly unknown.
           */
          document_type: 'other',
          /*
           * The PATH, not a URL.
           *
           * property-documents is a private bucket, so uploadFile returns a
           * SIGNED url — which expires. Storing it meant every document record
           * created here rotted within the hour and could never be opened
           * again. It also disagreed with the mobile client, which has always
           * stored the path.
           */
          file_url: storedPath,
          file_name: file.name,
          verified: false,
        });
      }
    }

    toast.success('Property created successfully!');
    navigate('/app/property/landlord');
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-surface-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-2xl font-bold text-surface-900 mb-8">List New Property</h1>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors',
                  i < step
                    ? 'bg-brand-500 text-white'
                    : i === step
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-200 text-surface-500'
                )}
              >
                {i < step ? <Check size={18} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-12 h-0.5 mx-1',
                    i < step ? 'bg-brand-500' : 'bg-surface-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <Input
                    label="Title"
                    {...step1Form.register('title')}
                    error={step1Form.formState.errors.title?.message}
                  />
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      {...step1Form.register('description')}
                      className="w-full rounded-lg border border-surface-300 px-3 py-2 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                    {step1Form.formState.errors.description && (
                      <p className="text-sm text-accent-500 mt-1">
                        {step1Form.formState.errors.description.message}
                      </p>
                    )}
                  </div>
                  <Controller
                    name="property_type"
                    control={step1Form.control}
                    render={({ field }) => (
                      <Select
                        label="Property Type"
                        options={PROPERTY_TYPE_OPTIONS}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    )}
                  />
                  <Controller
                    name="listing_type"
                    control={step1Form.control}
                    render={({ field }) => (
                      <Select
                        label="Listing Type"
                        options={LISTING_TYPE_OPTIONS}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Price"
                      type="number"
                      {...step1Form.register('price', { valueAsNumber: true })}
                      error={step1Form.formState.errors.price?.message}
                    />
                    <Controller
                      name="currency"
                      control={step1Form.control}
                      render={({ field }) => (
                        <Select
                          label="Currency"
                          options={CURRENCY_OPTIONS}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      )}
                    />
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <Input
                    label="Location"
                    placeholder="City, area"
                    {...step2Form.register('location')}
                    error={step2Form.formState.errors.location?.message}
                  />
                  <Input
                    label="Address"
                    placeholder="Full street address"
                    {...step2Form.register('address')}
                    error={step2Form.formState.errors.address?.message}
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <Input
                      label="Bedrooms"
                      type="number"
                      {...step2Form.register('bedrooms', { valueAsNumber: true })}
                    />
                    <Input
                      label="Bathrooms"
                      type="number"
                      {...step2Form.register('bathrooms', { valueAsNumber: true })}
                    />
                    <Input
                      label="Area (m²)"
                      type="number"
                      {...step2Form.register('area_sqm', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1.5">
                      Features
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={featureInput}
                        onChange={(e) => setFeatureInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                        placeholder="e.g. Parking, Pool"
                        className="flex-1 rounded-lg border border-surface-300 px-3 py-2"
                      />
                      <Button type="button" variant="outline" onClick={addFeature}>
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {features.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-200 text-sm"
                        >
                          {f}
                          <button
                            type="button"
                            onClick={() => removeFeature(f)}
                            className="text-surface-500 hover:text-accent-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <FileUpload
                    accept="image/*"
                    multiple
                    value={imageFiles}
                    onChange={handleImageChange}
                  />
                  <p className="text-sm text-surface-500 mt-2">
                    Upload at least one image of your property.
                  </p>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <FileUpload
                    accept=".pdf,.doc,.docx,image/*"
                    multiple
                    value={documentFiles}
                    onChange={handleDocumentChange}
                  />
                  <p className="text-sm text-surface-500 mt-2">
                    Upload ownership documents (optional but recommended for verification).
                  </p>
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
                  <div className="rounded-lg bg-surface-50 p-4 space-y-2">
                    <p>
                      <strong>Title:</strong> {step1Form.watch('title')}
                    </p>
                    <p>
                      <strong>Type:</strong> {step1Form.watch('property_type')} -{' '}
                      {step1Form.watch('listing_type')}
                    </p>
                    <p>
                      <strong>Price:</strong> {step1Form.watch('currency')}{' '}
                      {step1Form.watch('price')?.toLocaleString()}
                    </p>
                    <p>
                      <strong>Location:</strong> {step2Form.watch('location')}
                    </p>
                    <p>
                      <strong>Images:</strong> {imageFiles.length} uploaded
                    </p>
                    <p>
                      <strong>Documents:</strong> {documentFiles.length} uploaded
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-between mt-8 pt-6 border-t border-surface-200">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                icon={ChevronLeft}
              >
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button
                  variant="primary"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canProceed()}
                  icon={ChevronRight}
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="primary"
                  loading={isSubmitting}
                  onClick={handleSubmit}
                >
                  Create Property
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
