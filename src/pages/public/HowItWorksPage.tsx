import { Link } from 'react-router-dom';
import { FileText, Home, Building2, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-forest-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">How It Works</h1>
                <p className="text-xl text-surface-600 max-w-2xl leading-relaxed">
                  The Security Watch serves three distinct user groups — individuals seeking
                  investigative or legal support, parties involved in property transactions, and
                  institutions committed to improving operational standards. Below is a step-by-step
                  overview of how each service pathway operates.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/agent-surveillance.jpg"
                    alt="Getting started with The Security Watch"
                    className="w-full h-[280px] sm:h-[360px] object-cover"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* For Individuals */}
        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="flex items-center gap-3 mb-12">
                <div className="w-12 h-12 rounded-xl bg-forest-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-forest-600" />
                </div>
                <h2 className="text-2xl font-bold text-surface-900">Investigative &amp; Legal Services</h2>
              </div>
            </ScrollReveal>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: 1, title: 'Submit Your Case', desc: 'Provide a detailed account and securely upload any supporting evidence or documentation.' },
                { step: 2, title: 'Professional Matching', desc: 'Your case is reviewed and assigned to a verified specialist based on case type and jurisdiction.' },
                { step: 3, title: 'Active Investigation', desc: 'The assigned professional conducts a structured investigation with regular progress updates.' },
                { step: 4, title: 'Resolution & Report', desc: 'Receive a comprehensive case report with findings and recommended next steps.' },
              ].map((item, i) => (
                <ScrollReveal key={item.step} delay={i * 0.1}>
                  <div className="relative">
                    <div className="p-6 rounded-xl bg-surface-50 border border-surface-200">
                      <span className="text-2xl font-bold text-forest-600">{item.step}</span>
                      <h3 className="font-semibold text-surface-900 mt-2">{item.title}</h3>
                      <p className="text-sm text-surface-600 mt-1">{item.desc}</p>
                    </div>
                    {i < 3 && (
                      <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-6 -translate-y-1/2">
                        <ArrowRight className="w-6 h-6 text-surface-300" />
                      </div>
                    )}
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal>
              <div className="mt-8 text-center">
                <Link to="/register">
                  <Button icon={ArrowRight}>Report a case</Button>
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* For Property */}
        <section className="py-16 lg:py-24 bg-surface-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="flex items-center gap-3 mb-12">
                <div className="w-12 h-12 rounded-xl bg-forest-100 flex items-center justify-center">
                  <Home className="w-6 h-6 text-forest-600" />
                </div>
                <h2 className="text-2xl font-bold text-surface-900">Property Verification &amp; Transactions</h2>
              </div>
            </ScrollReveal>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { title: 'List or Search', desc: 'Property owners submit listings for verification. Buyers and tenants search verified inventories.' },
                { title: 'Independent Verification', desc: 'Ownership, documentation, and title authenticity are independently confirmed.' },
                { title: 'Verified Introductions', desc: 'Parties are connected through secure, platform-mediated channels.' },
                { title: 'Complete Transaction', desc: 'Finalise your transaction with documented, verified assurances in place.' },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.1}>
                  <div className="p-6 rounded-xl bg-white border border-surface-200">
                    <CheckCircle className="w-8 h-8 text-forest-600 mb-2" />
                    <h3 className="font-semibold text-surface-900">{item.title}</h3>
                    <p className="text-sm text-surface-600 mt-1">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link to="/property">
                  <Button icon={ArrowRight}>Browse properties</Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline">List your property</Button>
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* For Institutions */}
        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="flex items-center gap-3 mb-12">
                <div className="w-12 h-12 rounded-xl bg-forest-100 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-forest-600" />
                </div>
                <h2 className="text-2xl font-bold text-surface-900">Institutional Transparency Programme</h2>
              </div>
            </ScrollReveal>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { title: 'Enrol', desc: 'Institutions register for our independent assessment programme.' },
                { title: 'Assessment', desc: 'Trained agents evaluate operational standards, service delivery, and compliance.' },
                { title: 'Insights & Recommendations', desc: 'Receive detailed performance reports with actionable recommendations for improvement.' },
                { title: 'Recognition', desc: 'Institutions meeting high standards receive public commendation and certification.' },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.1}>
                  <div className="p-6 rounded-xl bg-surface-50 border border-surface-200">
                    <CheckCircle className="w-8 h-8 text-forest-600 mb-2" />
                    <h3 className="font-semibold text-surface-900">{item.title}</h3>
                    <p className="text-sm text-surface-600 mt-1">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal>
              <div className="mt-8 text-center">
                <Link to="/partners">
                  <Button icon={ArrowRight}>Partner with us</Button>
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
