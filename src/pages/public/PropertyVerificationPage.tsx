import { Link } from 'react-router-dom';
import { Shield, FileCheck, Handshake, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

export default function PropertyVerificationPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-surface-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Property Verification
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl leading-relaxed">
                  The Security Watch offers comprehensive property due diligence services designed
                  to protect individuals and businesses from fraudulent real estate transactions.
                  We independently verify ownership, authenticate documentation, and facilitate
                  connections with legitimate, verified property owners and agents.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/property-verification.jpg"
                    alt="Verified property transactions"
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
              <h2 className="text-2xl font-bold text-surface-900 mb-8">Our Verification Process</h2>
            </ScrollReveal>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: FileCheck, title: 'Ownership Verification', desc: 'We conduct independent checks against land registries and relevant authorities to confirm that the purported owner holds a valid and undisputed title to the property.' },
                { icon: Shield, title: 'Document Authentication', desc: 'All title deeds, survey plans, certificates of occupancy, and related instruments are reviewed for authenticity, consistency, and legal validity.' },
                { icon: Handshake, title: 'Verified Connections', desc: 'We facilitate introductions between prospective buyers or tenants and property owners whose credentials and documentation have been independently verified.' },
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
              <h2 className="text-2xl font-bold text-surface-900 mb-8">Why Choose The Security Watch</h2>
            </ScrollReveal>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { title: 'Verified Listings Only', desc: 'Every property on our platform has undergone an independent verification process before being listed.' },
                { title: 'Transparent Fee Structure', desc: 'Competitive and clearly communicated commission rates with no hidden charges.' },
                { title: 'Secure Transaction Framework', desc: 'All payments and documentation are processed through protected, auditable channels.' },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.1}>
                  <div className="p-6 rounded-xl bg-white border border-surface-200">
                    <CheckCircle className="w-8 h-8 text-forest-600 mb-3" />
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
              <h2 className="text-2xl font-bold text-surface-900 mb-4">Get Started</h2>
              <div className="flex flex-wrap justify-center gap-4">
                <Link to="/property">
                  <Button size="lg" icon={ArrowRight} className="bg-forest-600 hover:bg-forest-700 text-white">
                    Verify a property
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="lg" variant="outline">List your property</Button>
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
