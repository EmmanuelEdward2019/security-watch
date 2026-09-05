import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';
import { submitPublicEnquiry } from '@/services/propertyExtrasService';

const schema = z.object({
  name: z.string().min(2, 'Please give us your name'),
  email: z.string().email('That email address does not look right'),
  phone: z.string().optional(),
  subject: z.string().min(2, 'What is your message about?'),
  message: z.string().min(10, 'Please tell us a little more — at least 10 characters'),
});

type FormData = z.infer<typeof schema>;

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  /**
   * Sends the enquiry.
   *
   * This used to wait one second and claim success without sending anything —
   * messages from the public contact form reached nobody. It now goes through the
   * public-enquiry function, which records it, emails a confirmation to the
   * address given, and notifies every administrator.
   */
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    const { error } = await submitPublicEnquiry({
      kind: 'contact',
      fullName: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
    });

    setIsSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(
      'Message received. We have emailed you a confirmation and our team will respond within 24 hours.'
    );
    reset();
  };

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Contact Us
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl leading-relaxed">
                  For enquiries regarding our services, partnership opportunities, or
                  general support, please reach out using any of the channels below.
                  Our team is available to assist you promptly and professionally.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/contact-support.jpg"
                    alt="Our team is here to help"
                    className="w-full h-[280px] sm:h-[360px] object-cover"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12">
              <ScrollReveal>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-forest-100 flex items-center justify-center shrink-0">
                      <Mail className="w-6 h-6 text-forest-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900">Email</h3>
                      <a href="mailto:hello@thesecuritywatch.com" className="text-forest-600 hover:underline">
                        hello@thesecuritywatch.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-forest-100 flex items-center justify-center shrink-0">
                      <Phone className="w-6 h-6 text-forest-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900">Phone</h3>
                      <a href="tel:+2348000000000" className="text-forest-600 hover:underline">
                        +234 800 000 0000
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-forest-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6 text-forest-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900">Office</h3>
                      <p className="text-surface-600">Lagos, Nigeria</p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={0.1}>
                <form onSubmit={handleSubmit(onSubmit)} className="p-8 rounded-2xl bg-surface-50 border border-surface-200 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Name</label>
                    <input
                      {...register('name')}
                      className="w-full px-4 py-3 rounded-lg border border-surface-300 focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                      placeholder="Your name"
                    />
                    {errors.name && <p className="mt-1 text-sm text-accent-600">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Email</label>
                    <input
                      {...register('email')}
                      type="email"
                      className="w-full px-4 py-3 rounded-lg border border-surface-300 focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                      placeholder="you@example.com"
                    />
                    {errors.email && <p className="mt-1 text-sm text-accent-600">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">
                      Phone <span className="text-surface-400">(optional)</span>
                    </label>
                    <input
                      {...register('phone')}
                      type="tel"
                      autoComplete="tel"
                      className="w-full px-4 py-3 rounded-lg border border-surface-300 focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                      placeholder="+234 800 000 0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Subject</label>
                    <input
                      {...register('subject')}
                      className="w-full px-4 py-3 rounded-lg border border-surface-300 focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                      placeholder="Subject of your enquiry"
                    />
                    {errors.subject && <p className="mt-1 text-sm text-accent-600">{errors.subject.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Message</label>
                    <textarea
                      {...register('message')}
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-surface-300 focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none resize-none"
                      placeholder="Your message..."
                    />
                    {errors.message && <p className="mt-1 text-sm text-accent-600">{errors.message.message}</p>}
                  </div>
                  <Button type="submit" loading={isSubmitting} icon={Send} className="w-full">
                    Send message
                  </Button>
                </form>
              </ScrollReveal>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
