import { Link } from 'react-router-dom';
import { FileText, Home, Building2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-gradient-to-br from-forest-50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Pricing & Fees
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl">
                  Transparent pricing. No hidden costs. Rates are determined per case or service.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/bodyguard-protection.jpg"
                    alt="Transparent pricing for all services"
                    className="w-full h-[280px] sm:h-[360px] object-cover"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: FileText, title: 'Investigation Fees', desc: 'Rates vary by case type, complexity, and location. You\'ll get a quote after submitting your case.', note: 'Per case' },
                { icon: Home, title: 'Property Listing', desc: 'Affordable fees for landlords to list and verify properties. Low commission on successful transactions.', note: 'Per listing' },
                { icon: Building2, title: 'Verification Fees', desc: 'Document verification and ownership checks. One-time fee per property.', note: 'Per verification' },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.1}>
                  <div className="p-8 rounded-2xl bg-surface-50 border border-surface-200">
                    <item.icon className="w-12 h-12 text-forest-600 mb-4" />
                    <h3 className="text-xl font-semibold text-surface-900 mb-2">{item.title}</h3>
                    <p className="text-surface-600 mb-4">{item.desc}</p>
                    <p className="text-sm font-medium text-forest-600">{item.note}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24 bg-surface-50">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <ScrollReveal>
              <p className="text-surface-600 mb-8">
                Sign up to report a case or list a property. You'll see exact fees before you commit. 
                We accept Stripe (international) and Paystack (Nigeria & West Africa).
              </p>
              <Link to="/register">
                <Button size="lg" icon={ArrowRight} className="bg-forest-600 hover:bg-forest-700 text-white">
                  Get started
                </Button>
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
