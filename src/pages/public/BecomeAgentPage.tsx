import { Link } from 'react-router-dom';
import { Shield, FileCheck, Users, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

export default function BecomeAgentPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-forest-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Become an Agent
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl leading-relaxed">
                  The Security Watch is actively recruiting qualified professionals to join
                  our vetted network of investigators, legal practitioners, and forensic
                  specialists. If you have relevant experience and a commitment to ethical
                  practice, we invite you to apply.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/bodyguard-protection.jpg"
                    alt="Join our network of verified investigators"
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
              <h2 className="text-2xl font-bold text-surface-900 mb-8">Eligible Professional Backgrounds</h2>
            </ScrollReveal>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                'Retired military personnel',
                'Former police officers',
                'Intelligence officers',
                'Licensed private investigators',
                'Legal professionals',
                'Forensic experts',
              ].map((item, i) => (
                <ScrollReveal key={item} delay={i * 0.05}>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-50 border border-surface-200">
                    <CheckCircle className="w-5 h-5 text-forest-600 shrink-0" />
                    <span className="font-medium text-surface-700">{item}</span>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24 bg-surface-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h2 className="text-2xl font-bold text-surface-900 mb-8">Application Requirements</h2>
            </ScrollReveal>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: FileCheck, title: 'Identity & Credentials', desc: 'A valid government-issued ID (international passport, NIN, or driver\'s licence) along with verifiable proof of professional experience or certification.' },
                { icon: Users, title: 'Professional References', desc: 'A minimum of two professional guarantors who can attest to your competence, integrity, and professional conduct.' },
                { icon: Shield, title: 'Vetting & Onboarding', desc: 'All applications undergo a thorough review by our compliance team. Approved professionals are onboarded and eligible to receive case assignments.' },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.1}>
                  <div className="p-6 rounded-xl bg-white border border-surface-200">
                    <item.icon className="w-10 h-10 text-forest-600 mb-3" />
                    <h3 className="font-semibold text-surface-900">{item.title}</h3>
                    <p className="text-sm text-surface-600 mt-1">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <ScrollReveal>
              <h2 className="text-2xl font-bold text-surface-900 mb-4">Begin Your Application</h2>
              <p className="text-surface-600 mb-8 max-w-xl mx-auto leading-relaxed">
                Create an account on the platform and select the appropriate professional role
                during registration. You will then be guided through the verification and
                onboarding process.
              </p>
              <Link to="/register">
                <Button size="lg" icon={ArrowRight} className="bg-forest-600 hover:bg-forest-700 text-white">
                  Apply now
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
