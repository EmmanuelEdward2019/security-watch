import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, Home, CheckCircle, ArrowRight, Eye, Shield } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal, ParallaxSection } from '@/components/public';
import {
  LandingHero,
  EmotionalStorySection,
  WhoWeAreSection,
  HowItWorksStepsSection,
  RiskTrustSection,
  PropertyVerificationSection,
  TransparencyMediaSection,
  TrustBulletsSection,
  FinalCtaSection,
} from '@/components/landing';

export default function LandingPage() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [0, 80, 0]);

  return (
    <div className="min-h-screen bg-white text-surface-900">
      <PublicNav />

      <LandingHero />

      <section className="py-6 sm:py-8 bg-white border-b border-surface-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 text-sm sm:text-base text-surface-700">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-forest-600 shrink-0" />
              <span className="font-medium">Vetted investigators &amp; legal counsel</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-forest-600 shrink-0" />
              <span className="font-medium">Property due diligence &amp; fraud prevention</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-forest-600 shrink-0" />
              <span className="font-medium">Institutional transparency &amp; monitoring</span>
            </div>
          </div>
        </div>
      </section>

      <EmotionalStorySection />
      <WhoWeAreSection />
      <HowItWorksStepsSection />
      <RiskTrustSection />
      <PropertyVerificationSection />
      <TransparencyMediaSection />
      <TrustBulletsSection />

      <section ref={parallaxRef} className="py-14 lg:py-20 bg-forest-600 relative overflow-hidden">
        <ParallaxSection speed={0.3}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
        </ParallaxSection>
        <motion.div style={{ y }} className="absolute inset-0 pointer-events-none opacity-[0.07]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,800px)] h-[min(90vw,800px)] border border-white rounded-full" />
        </motion.div>
        <div className="relative max-w-6xl mx-auto px-4">
          <ScrollReveal>
            <p className="text-center text-forest-100 text-sm font-semibold uppercase tracking-wider mb-10">
              Our Track Record
            </p>
          </ScrollReveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center text-white">
            {[
              { value: '10,000+', label: 'Cases handled' },
              { value: '500+', label: 'Verified professionals' },
              { value: '36', label: 'States covered nationwide' },
              { value: '24/7', label: 'Operational support' },
            ].map((stat, i) => (
              <ScrollReveal key={stat.label} delay={i * 0.1}>
                <div>
                  <div className="text-3xl sm:text-4xl font-bold mb-1">{stat.value}</div>
                  <div className="text-forest-100">{stat.label}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 mb-3 text-center">
              Our Core Service Divisions
            </h2>
            <p className="text-base sm:text-lg text-surface-600 max-w-2xl mx-auto text-center mb-12">
              Three specialised practice areas — investigative services, property verification, and
              institutional transparency — each designed to deliver measurable outcomes.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Search,
                title: 'Investigative Services',
                desc: 'Engage vetted private investigators, licensed legal practitioners, and forensic specialists for sensitive and complex matters.',
                image: '/assets/hero-professional.jpg',
                link: '/services/investigations',
                fallback:
                  'https://images.unsplash.com/photo-1589829548016-20b91c47e8f3?w=800&q=80',
              },
              {
                icon: Eye,
                title: 'Institutional Transparency',
                desc: 'Independent monitoring, assessment, and reporting on public and private institutions to promote accountability and reform.',
                image: '/assets/contact-support.jpg',
                link: '/services/transparency',
                fallback:
                  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80',
              },
              {
                icon: Home,
                title: 'Property Verification',
                desc: 'Comprehensive title searches, ownership verification, and due diligence services to safeguard your real estate transactions.',
                image: '/assets/property-verification.jpg',
                link: '/services/property',
                fallback:
                  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
              },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 0.1}>
                <Link
                  to={item.link}
                  className="block p-0 rounded-2xl bg-surface-50 border border-surface-200 overflow-hidden hover:shadow-xl hover:border-forest-200 transition-all group"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={item.image}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.src = item.fallback;
                      }}
                    />
                  </div>
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-forest-100 text-forest-600 flex items-center justify-center mx-auto mb-3 group-hover:bg-forest-600 group-hover:text-white transition-colors">
                      <item.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-surface-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-surface-600">{item.desc}</p>
                    <span className="inline-flex items-center gap-1 text-forest-600 font-medium mt-4 group-hover:gap-2 transition-all">
                      Explore <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-surface-50 border-t border-surface-200">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-6 sm:gap-10">
          <p className="text-surface-700 font-medium text-center sm:text-left">
            Learn more about our services or speak with a representative.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/services/investigations">
              <Button variant="outline" size="md" className="border-forest-600 text-forest-700">
                Investigations
              </Button>
            </Link>
            <Link to="/services/property">
              <Button variant="outline" size="md" className="border-forest-600 text-forest-700">
                Property
              </Button>
            </Link>
            <Link to="/partners">
              <Button size="md" className="bg-forest-600 hover:bg-forest-700 text-white">
                Partner
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Fountain Source Preview */}
      <section className="py-16 lg:py-20 bg-surface-900 text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal direction="left">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-forest-600 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <p className="text-forest-300 text-sm font-semibold tracking-wider uppercase">
                  Our Security Division
                </p>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                Fountain Source Ltd
              </h2>
              <p className="mt-2 text-lg text-forest-200 font-semibold">
                We Guard. We Protect. We Secure.
              </p>
              <p className="mt-4 text-surface-300 leading-relaxed">
                Fountain Source Ltd is the security operations arm of The Security Watch,
                delivering professional guard services, security surveillance, VIP escort
                and protocol, event security, logistics, and construction security across
                Nigeria since 1997.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/fountain-source">
                  <Button size="lg" className="bg-forest-500 hover:bg-forest-400 text-white" icon={ArrowRight}>
                    Explore Fountain Source
                  </Button>
                </Link>
                <Link to="/fountain-source/request">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    Request a Service
                  </Button>
                </Link>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-[3/4]">
                  <img
                    src="/assets/fsource-guards-entrance.jpg"
                    alt="Fountain Source security guards"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
                <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-[3/4]">
                  <img
                    src="/assets/fsource-corporate-hq.png"
                    alt="Fountain Source corporate headquarters"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 px-3 py-2">
                    <p className="text-white text-xs font-medium">Corporate Headquarters</p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <FinalCtaSection />

      <PublicFooter />
    </div>
  );
}
