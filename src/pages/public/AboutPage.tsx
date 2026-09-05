import { Link } from 'react-router-dom';
import { Target, Eye, Heart, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        {/* Hero */}
        <section className="relative py-20 lg:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-white" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <p className="text-forest-600 font-medium mb-4">About Us</p>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  The Security Watch
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl leading-relaxed">
                  The Security Watch is a professional services and technology platform that
                  provides investigative, legal, security, property verification, and institutional
                  transparency services. We connect individuals and organisations with qualified
                  professionals to address matters of fraud, injustice, property disputes, and
                  systemic accountability — through a secure, structured, and results-driven framework.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/team-collaboration.jpg"
                    alt="Our team working together for justice and transparency"
                    className="w-full h-[280px] sm:h-[360px] object-cover"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12">
              <ScrollReveal>
                <div className="p-8 rounded-2xl bg-forest-50 border border-forest-100 overflow-hidden">
                  <div className="aspect-video rounded-xl overflow-hidden mb-6 -mx-2">
                    <img
                      src="/assets/bodyguard-protection.jpg"
                      alt="Our mission in action"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Target className="w-12 h-12 text-forest-600 mb-4" />
                  <h2 className="text-2xl font-bold text-surface-900 mb-4">Our Mission</h2>
                  <p className="text-surface-600 leading-relaxed">
                    To provide individuals and organisations with access to qualified
                    professionals, secure technology, and structured processes that enable
                    them to investigate wrongdoing, verify property transactions, hold
                    institutions accountable, and pursue justice through legitimate,
                    evidence-based channels.
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <div className="p-8 rounded-2xl bg-surface-50 border border-surface-200 overflow-hidden">
                  <div className="aspect-video rounded-xl overflow-hidden mb-6 -mx-2">
                    <img
                      src="/assets/professional-woman.jpg"
                      alt="Our vision for the future"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Eye className="w-12 h-12 text-forest-600 mb-4" />
                  <h2 className="text-2xl font-bold text-surface-900 mb-4">Our Vision</h2>
                  <p className="text-surface-600 leading-relaxed">
                    To establish The Security Watch as the foremost professional services
                    platform for investigative operations, institutional reform, and real
                    estate due diligence across Africa — setting the benchmark for
                    accountability, transparency, and ethical practice in the private
                    security and investigations sector.
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Why We Exist */}
        <section className="py-16 lg:py-24 bg-surface-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h2 className="text-3xl font-bold text-surface-900 mb-4 text-center">Why We Exist</h2>
              <p className="text-lg text-surface-600 max-w-2xl mx-auto text-center mb-12 leading-relaxed">
                The Security Watch was founded in response to systemic challenges that continue to affect
                millions of people across the country and the broader continent.
              </p>
            </ScrollReveal>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Shield, title: 'Erosion of Public Trust', desc: 'Citizens have increasingly lost confidence in the institutions and systems designed to protect them. We restore that trust by providing access to verified professionals and transparent, auditable processes.' },
                { icon: Heart, title: 'Prevalence of Property Fraud', desc: 'Fraudulent land sales, forged documentation, and predatory agents cause devastating financial losses to families. We provide independent verification, title searches, and due diligence to safeguard transactions.' },
                { icon: Users, title: 'Institutional Accountability Gaps', desc: 'Schools, healthcare facilities, law enforcement agencies, and government offices often operate without adequate oversight. We conduct structured, independent assessments to document performance and drive systemic improvement.' },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.1}>
                  <div className="p-6 rounded-xl bg-white border border-surface-200 text-center">
                    <item.icon className="w-10 h-10 text-forest-600 mx-auto mb-4" />
                    <h3 className="font-semibold text-surface-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-surface-600">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 lg:py-24 bg-forest-600">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <ScrollReveal>
              <h2 className="text-3xl font-bold text-white mb-4">Work With Us</h2>
              <p className="text-forest-100 mb-8 text-lg leading-relaxed max-w-2xl mx-auto">
                Whether you require professional investigative assistance, wish to join our
                network of verified specialists, or are an organisation seeking to improve
                transparency and accountability — we invite you to engage with The Security Watch.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link to="/register">
                  <Button size="lg" className="bg-white text-surface-900 hover:bg-forest-50">
                    Get started
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                    Contact us
                  </Button>
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
