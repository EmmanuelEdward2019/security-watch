import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';
import { cn } from '@/utils/cn';

const faqs = [
  {
    q: 'Is this legal?',
    a: 'Yes. The Security Watch operates within the law. We connect you with licensed investigators and facilitate legitimate property transactions. We are not law enforcement—we are a platform that connects people with verified professionals.',
  },
  {
    q: 'How are agents verified?',
    a: 'Agents submit ID documents, proof of experience, and two guarantors. Our team reviews each application. Only approved agents receive case assignments. We take verification seriously.',
  },
  {
    q: 'Is my identity protected?',
    a: 'Yes. Your information is encrypted and confidential. We share only what\'s necessary with your assigned investigator. You control what gets disclosed.',
  },
  {
    q: 'How do payments work?',
    a: 'We accept Stripe (international cards) and Paystack (Nigeria & West Africa). You pay when you\'re ready to proceed. Fees are shown upfront—no surprises.',
  },
  {
    q: 'How do I verify a property?',
    a: 'List your property or request verification for one you\'re interested in. We check ownership documents and validate with relevant authorities. Verified properties get a badge.',
  },
  {
    q: 'What if my case isn\'t resolved?',
    a: 'We track every case. If you\'re not satisfied, you can escalate or request a different investigator. We\'re committed to helping you get closure.',
  },
];

export default function FAQsPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Frequently Asked Questions
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl">
                  Common questions about our platform, services, and how we work.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/agent-surveillance.jpg"
                    alt="We're here to help"
                    className="w-full h-[280px] sm:h-[360px] object-cover"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <ScrollReveal key={i}>
                  <div
                    className={cn(
                      'rounded-xl border transition-colors',
                      openIndex === i ? 'border-forest-200 bg-forest-50' : 'border-surface-200 bg-white'
                    )}
                  >
                    <button
                      onClick={() => setOpenIndex(openIndex === i ? null : i)}
                      className="w-full flex items-center justify-between p-6 text-left"
                    >
                      <span className="font-semibold text-surface-900">{faq.q}</span>
                      <ChevronDown
                        className={cn('w-5 h-5 text-surface-500 transition-transform', openIndex === i && 'rotate-180')}
                      />
                    </button>
                    {openIndex === i && (
                      <div className="px-6 pb-6">
                        <p className="text-surface-600">{faq.a}</p>
                      </div>
                    )}
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
