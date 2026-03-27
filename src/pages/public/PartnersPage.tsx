import { Link } from 'react-router-dom';
import { Building2, BarChart3, Award, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-gradient-to-br from-forest-50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Partner With Us
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl">
                  Government bodies, schools, hospitals, police stations—join our transparency program. 
                  Get insights. Improve. Get recognized.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/bodyguard-protection.jpg"
                    alt="Partnership for transparency"
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
              <h2 className="text-2xl font-bold text-surface-900 mb-8">Who Can Partner</h2>
            </ScrollReveal>
            <div className="grid md:grid-cols-2 gap-8">
              {[
                'Government agencies',
                'Police stations',
                'Schools & universities',
                'Hospitals & clinics',
                'Markets & public facilities',
                'Courts & legal bodies',
              ].map((item, i) => (
                <ScrollReveal key={item} delay={i * 0.05}>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-50 border border-surface-200">
                    <Building2 className="w-6 h-6 text-forest-600 shrink-0" />
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
              <h2 className="text-2xl font-bold text-surface-900 mb-8">Benefits</h2>
            </ScrollReveal>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: BarChart3, title: 'Transparency', desc: 'Show the public you\'re committed to improvement.' },
                { icon: Award, title: 'Improvement Insights', desc: 'Get feedback to serve better.' },
                { icon: Building2, title: 'Recognition', desc: 'Top performers earn public recognition.' },
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
              <h2 className="text-2xl font-bold text-surface-900 mb-4">Request Partnership</h2>
              <p className="text-surface-600 mb-8">
                Contact us to discuss how your institution can join our transparency program.
              </p>
              <Link to="/contact">
                <Button size="lg" icon={ArrowRight} className="bg-forest-600 hover:bg-forest-700 text-white">
                  Contact us
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
