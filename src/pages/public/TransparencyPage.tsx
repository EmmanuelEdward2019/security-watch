import { Link } from 'react-router-dom';
import { Building2, Clock, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

export default function TransparencyPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-gradient-to-br from-forest-50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Institutional Transparency
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl leading-relaxed">
                  The Security Watch conducts independent, anonymous assessments of public and
                  private institutions — evaluating service delivery, operational standards, and
                  professional conduct. Our objective is not to penalise, but to provide
                  evidence-based insights that drive measurable improvement and public accountability.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/contact-support.jpg"
                    alt="Institutional transparency and accountability"
                    className="w-full h-[280px] sm:h-[360px] object-cover"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h2 className="text-2xl font-bold text-surface-900 mb-8">What We Do</h2>
            </ScrollReveal>
            <div className="grid md:grid-cols-2 gap-8">
              <ScrollReveal>
                <div className="p-8 rounded-2xl bg-surface-50 border border-surface-200">
                  <Building2 className="w-12 h-12 text-forest-600 mb-4" />
                  <h3 className="text-xl font-semibold text-surface-900 mb-2">Independent Institutional Assessment</h3>
                  <p className="text-surface-600 leading-relaxed">
                    Our trained media agents conduct discreet, on-site evaluations of police stations,
                    educational institutions, healthcare facilities, government offices, and commercial
                    establishments. All assessments follow a standardised methodology and are documented
                    for reporting and publication.
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <div className="p-8 rounded-2xl bg-surface-50 border border-surface-200">
                  <Clock className="w-12 h-12 text-forest-600 mb-4" />
                  <h3 className="text-xl font-semibold text-surface-900 mb-2">Evaluation Criteria</h3>
                  <ul className="space-y-2 text-surface-600">
                    <li>• Punctuality &amp; operational readiness</li>
                    <li>• Facility hygiene &amp; maintenance standards</li>
                    <li>• Staff professionalism &amp; conduct</li>
                    <li>• Quality &amp; timeliness of service delivery</li>
                    <li>• Compliance with regulatory requirements</li>
                  </ul>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24 bg-forest-600">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <ScrollReveal>
              <Sparkles className="w-12 h-12 text-white mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">Our Objective</h2>
              <p className="text-forest-100 mb-8 text-lg leading-relaxed max-w-2xl mx-auto">
                Our transparency programme is designed to foster constructive improvement, not punitive
                action. Institutions that demonstrate high standards are publicly recognised and
                commended. Those with identified deficiencies receive documented recommendations for
                reform. The ultimate beneficiary is the public — through better, more accountable services.
              </p>
              <Link to="/partners">
                <Button size="lg" className="bg-white text-surface-900 hover:bg-forest-50" icon={ArrowRight}>
                  Partner with us
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
