import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Send,
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import { Button, Input, TextArea } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';
import { supabase } from '@/lib/supabase';
import { sendTemplatedEmail } from '@/lib/email';

const SERVICE_OPTIONS = [
  { value: 'security_guards', label: 'Security Guards' },
  { value: 'security_surveillance', label: 'Security Surveillance' },
  { value: 'security_escorts', label: 'Security Escorts & Protocol' },
  { value: 'event_security', label: 'Event Security' },
  { value: 'private_protection', label: 'Private & Home Protection' },
  { value: 'home_security', label: 'Home Security' },
  { value: 'infrastructure_security', label: 'Infrastructure Security' },
  { value: 'maritime_security', label: 'Maritime Security' },
  { value: 'security_training', label: 'Security Training' },
  { value: 'debt_recovery', label: 'Debt Recovery' },
  { value: 'construction', label: 'Construction Services' },
  { value: 'logistics', label: 'Logistics & Fleet Management' },
  { value: 'other', label: 'Other / General Enquiry' },
] as const;

const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(8, 'Valid phone number required'),
  company_name: z.string().optional(),
  service_type: z.string().min(1, 'Please select a service'),
  location: z.string().optional(),
  message: z.string().min(10, 'Please describe what you need (min 10 characters)'),
});

type FormData = z.infer<typeof schema>;

export default function FountainSourceRequestPage() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('service') || '';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      company_name: '',
      service_type: preselected,
      location: '',
      message: '',
    },
  });

  useEffect(() => {
    if (preselected) setValue('service_type', preselected);
  }, [preselected, setValue]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    const { error } = await supabase
      .from('security_service_requests')
      .insert({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        company_name: data.company_name || null,
        service_type: data.service_type,
        location: data.location || null,
        message: data.message,
      });
    setIsSubmitting(false);

    if (error) {
      toast.error('Something went wrong. Please try again or call us directly.');
      return;
    }

    const serviceLabel =
      SERVICE_OPTIONS.find((o) => o.value === data.service_type)?.label ?? data.service_type;
    try {
      await sendTemplatedEmail(data.email, 'security_service_request_received', {
        recipientName: data.full_name.trim().split(/\s+/)[0],
        serviceType: serviceLabel,
        companyName: data.company_name,
        dashboardUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
    } catch {
      /* non-blocking — row is saved */
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white">
        <PublicNav />
        <main className="pt-16 lg:pt-20">
          <div className="min-h-[70vh] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center max-w-lg"
            >
              <div className="w-16 h-16 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold text-surface-900 mb-4">Request received!</h1>
              <p className="text-lg text-surface-600 mb-8">
                Thank you for reaching out to Fountain Source Ltd. Our team will review your request and
                contact you within 24 hours.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/fountain-source">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Back to Fountain Source
                  </Button>
                </Link>
                <Link to="/">
                  <Button className="w-full sm:w-auto bg-forest-600 hover:bg-forest-700 text-white">
                    Go Home
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-16 lg:py-24 bg-gradient-to-br from-forest-50 to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <Link
                to="/fountain-source"
                className="inline-flex items-center gap-2 text-forest-600 hover:text-forest-700 font-medium mb-8"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Fountain Source
              </Link>
              <h1 className="text-3xl sm:text-4xl font-bold text-surface-900 mb-3">
                Request a Service
              </h1>
              <p className="text-lg text-surface-600 max-w-2xl">
                Fill in the form below and our team will get back to you within 24 hours. For urgent
                matters, call <a href="tel:+2349088077730" className="text-forest-600 font-semibold underline">(+234) 908 807 7730</a>.
              </p>
            </ScrollReveal>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-10 rounded-2xl bg-white border border-surface-200 shadow-lg p-6 sm:p-10"
            >
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <Input
                    label="Full Name *"
                    icon={User}
                    placeholder="John Doe"
                    error={errors.full_name?.message}
                    {...register('full_name')}
                  />
                  <Input
                    label="Email *"
                    type="email"
                    icon={Mail}
                    placeholder="you@example.com"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <Input
                    label="Phone *"
                    type="tel"
                    icon={Phone}
                    placeholder="+234 800 000 0000"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                  <Input
                    label="Company / Organization"
                    icon={Building2}
                    placeholder="Your company name (optional)"
                    error={errors.company_name?.message}
                    {...register('company_name')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Service Type *
                  </label>
                  <select
                    {...register('service_type')}
                    className="w-full h-11 px-4 rounded-lg border border-surface-300 bg-white text-surface-900 focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none transition-colors"
                  >
                    <option value="">Select a service…</option>
                    {SERVICE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errors.service_type && (
                    <p className="mt-1 text-sm text-accent-600">{errors.service_type.message}</p>
                  )}
                </div>

                <Input
                  label="Location"
                  icon={MapPin}
                  placeholder="Where do you need the service? (City, State)"
                  error={errors.location?.message}
                  {...register('location')}
                />

                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" /> Describe Your Needs *
                    </span>
                  </label>
                  <TextArea
                    placeholder="Tell us about your security needs, the scope of work, number of guards, duration, or any other details..."
                    rows={5}
                    error={errors.message?.message}
                    {...register('message')}
                  />
                </div>

                <Button
                  type="submit"
                  loading={isSubmitting}
                  size="lg"
                  className="w-full sm:w-auto bg-forest-600 hover:bg-forest-700 text-white"
                  icon={Send}
                >
                  Submit Request
                </Button>
              </form>
            </motion.div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
