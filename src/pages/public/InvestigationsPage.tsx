import { Link } from 'react-router-dom';
import { Search, Scale, Microscope, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

export default function InvestigationsPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-forest-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Investigative Services
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl leading-relaxed">
                  The Security Watch provides access to qualified private investigators,
                  licensed legal practitioners, and accredited forensic analysts. Each
                  professional on our platform is rigorously vetted and matched to your
                  case based on expertise, jurisdiction, and the nature of the matter at hand.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/agent-field-ops.jpg"
                    alt="Professional investigative services"
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
              <h2 className="text-2xl font-bold text-surface-900 mb-8">Our Service Areas</h2>
            </ScrollReveal>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Search, title: 'Private Investigations', desc: 'Confidential, structured investigations conducted by vetted operatives with backgrounds in law enforcement, intelligence, and private security.' },
                { icon: Scale, title: 'Legal Advisory & Representation', desc: 'Direct access to licensed legal practitioners for case assessment, documentation, litigation support, and representation across multiple jurisdictions.' },
                { icon: Microscope, title: 'Forensic & Technical Analysis', desc: 'Accredited forensic specialists providing evidence examination, digital forensics, document authentication, and expert witness support.' },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.1}>
                  <div className="p-8 rounded-2xl bg-surface-50 border border-surface-200">
                    <item.icon className="w-12 h-12 text-forest-600 mb-4" />
                    <h3 className="text-xl font-semibold text-surface-900 mb-2">{item.title}</h3>
                    <p className="text-surface-600">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24 bg-surface-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h2 className="text-2xl font-bold text-surface-900 mb-8">Types of Cases We Handle</h2>
            </ScrollReveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                'Land fraud & disputes',
                'Financial fraud',
                'Missing persons',
                'Personal disputes',
                'Theft & robbery',
                'Domestic matters',
                'Cybercrime',
                'Corruption & whistleblowing',
              ].map((item, i) => (
                <ScrollReveal key={item} delay={i * 0.05}>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-surface-200">
                    <CheckCircle className="w-5 h-5 text-forest-600 shrink-0" />
                    <span className="font-medium text-surface-700">{item}</span>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <ScrollReveal>
              <h2 className="text-2xl font-bold text-surface-900 mb-4">Submit a Case</h2>
              <p className="text-surface-600 mb-8 max-w-xl mx-auto leading-relaxed">
                Register on the platform, provide a detailed account of your matter along with
                any supporting documentation, and our team will assign a qualified professional
                to your case.
              </p>
              <Link to="/register">
                <Button size="lg" icon={ArrowRight} className="bg-forest-600 hover:bg-forest-700 text-white">
                  Report a case
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
