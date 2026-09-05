import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  Eye,
  Users,
  Truck,
  HardHat,
  GraduationCap,
  Landmark,
  Ship,
  UserCheck,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Award,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

const services = [
  {
    icon: Eye,
    title: 'Security Surveillance',
    desc: 'Advanced monitoring systems and round-the-clock surveillance solutions for businesses and residences.',
    slug: 'security_surveillance',
  },
  {
    icon: Users,
    title: 'Security Guards',
    desc: 'Professionally trained, vetted guards for offices, estates, banks, and industrial facilities.',
    slug: 'security_guards',
  },
  {
    icon: Shield,
    title: 'Security Escorts & Protocol',
    desc: 'VIP movement protection, cash-in-transit escorts, and dignitary protocol services.',
    slug: 'security_escorts',
  },
  {
    icon: Building2,
    title: 'Event Security',
    desc: 'Discreet and comprehensive indoor/outdoor event security — corporate, social, religious, and educational.',
    slug: 'event_security',
  },
  {
    icon: UserCheck,
    title: 'Private & Home Protection',
    desc: 'Personal security solutions for individuals, families, and high-net-worth clients.',
    slug: 'private_protection',
  },
  {
    icon: Landmark,
    title: 'Infrastructure Security',
    desc: 'Risk identification, prevention, and mitigation for large-scale construction and infrastructure projects.',
    slug: 'infrastructure_security',
  },
  {
    icon: Ship,
    title: 'Maritime Security',
    desc: 'Specialized protection for ports, shipping operations, and offshore installations.',
    slug: 'maritime_security',
  },
  {
    icon: GraduationCap,
    title: 'Security Training',
    desc: 'Comprehensive training programmes for duty supervisors, patrol teams, and new recruits.',
    slug: 'security_training',
  },
  {
    icon: Truck,
    title: 'Logistics & Fleet',
    desc: 'Vehicle leasing, fleet management, and full-maintenance solutions for public and private sectors.',
    slug: 'logistics',
  },
  {
    icon: HardHat,
    title: 'Construction Services',
    desc: 'Intelligence on political and violent risks to large-scale projects. Risk allocation for contractors.',
    slug: 'construction',
  },
];

const stats = [
  { value: 'Since 1997', label: 'Established' },
  { value: '500+', label: 'Clients served' },
  { value: '36', label: 'States covered' },
  { value: '24/7', label: 'Response time' },
];

const whyUs = [
  'Vetted, bonded, and guaranteed guards',
  'Radio control & central monitoring systems',
  'Tripartite agreement with guarantors of impeccable character',
  'Regular training in crime prevention and safety technology',
  'Clients in banking, manufacturing, and the public sector',
  'Metal detectors, communication systems, and guard dogs deployed',
];

export default function FountainSourcePage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        {/* Hero */}
        {/*
          Solid surface-950 — a deliberately darker, colder ground than the
          main site's forest. Fountain Source is the corporate security arm and
          should not look like the civic platform wearing a different hat.
          Previously the same three-layer gradient-plus-blocked-photograph
          treatment as every other hero, which is what made the pages
          indistinguishable.
        */}
        <section className="relative flex min-h-[70vh] items-center overflow-hidden bg-surface-950">
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-4 hidden w-px bg-white/10 sm:left-6 lg:left-8 lg:block"
          />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-forest-300 sm:text-sm">
                  A Division of The Security Watch
                </p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Fountain Source Ltd
                </h1>
                {/* Scales with the heading rather than sitting at a fixed
                    2xl, which crowded the h1 on small screens and left the
                    line looking like a stray sentence on large ones. */}
                <p className="mt-3 text-lg font-semibold tracking-wide text-forest-200 sm:text-xl lg:text-2xl">
                  We Guard. We Protect. We Secure.
                </p>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-surface-200/90 sm:text-lg">
                  A symbol of efficiency in security guard operations, construction, logistics, and debt
                  recovery services. Rendering valuable and inestimable services since 1997.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Link to="/fountain-source/request">
                    <span className="inline-flex items-center justify-center gap-2 min-h-[52px] px-8 rounded-xl bg-forest-500 hover:bg-forest-400 text-white font-semibold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]">
                      Request Service
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  </Link>
                  <a href="tel:+2349088077730">
                    <span className="inline-flex items-center justify-center gap-2 min-h-[52px] px-8 rounded-xl border-2 border-white/30 text-white hover:bg-white/10 font-semibold transition-colors">
                      <Phone className="w-5 h-5 shrink-0" />
                      Call Now
                    </span>
                  </a>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.12 }}
              >
                <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                  <img
                    src="/assets/fsource-corporate-hq.png"
                    alt="Fountain Source Corporate Office, Lagos"
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                    <p className="text-white font-medium">
                      Fountain Source Nig. Ltd — A Security Company with a Vision
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-10 bg-forest-700">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center text-white">
              {stats.map((s, i) => (
                <ScrollReveal key={s.label} delay={i * 0.08}>
                  <div className="text-2xl sm:text-3xl font-bold">{s.value}</div>
                  <div className="text-forest-100 text-sm mt-1">{s.label}</div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section className="py-20 lg:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <p className="text-forest-600 font-semibold text-sm uppercase tracking-wider mb-3">Who We Are</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-surface-900">
                  A Security Company with a Vision
                </h2>
                <p className="mt-6 text-lg text-surface-600 leading-relaxed">
                  Founded in 1997, Fountain Source Ltd has developed a diverse network of successful
                  business relationships in the organized private sector as well as government parastatals
                  and commissions.
                </p>
                <p className="mt-4 text-surface-600 leading-relaxed">
                  We are fully committed to the development and sustenance of indigenous manpower for the
                  Private Security Guard industry, in addition to maintaining an environmentally
                  crime-free society. With a dynamic management team, we are poised to attain
                  pre-eminence as a leading indigenous Private Guard Service Company.
                </p>
                <p className="mt-4 text-surface-700 font-medium italic">Motto: In God We Trust</p>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <div className="relative rounded-2xl overflow-hidden shadow-xl border border-surface-200">
                  <img
                    src="/assets/fsource-corporate-hq.png"
                    alt="Fountain Source Corporate Headquarters, Lagos"
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-5 py-4">
                    <p className="text-white text-sm font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 shrink-0" />
                      Our Corporate Headquarters
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Services Grid */}
        <section className="py-20 lg:py-28 bg-surface-50 border-y border-surface-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-14">
                <h2 className="text-3xl sm:text-4xl font-bold text-surface-900">Our Services</h2>
                <p className="mt-4 text-lg text-surface-600">
                  Comprehensive security, logistics, and construction solutions tailored to your needs.
                </p>
              </div>
            </ScrollReveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {services.map((svc, i) => (
                <ScrollReveal key={svc.slug} delay={i * 0.04}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="h-full rounded-2xl bg-white p-6 border border-surface-200 shadow-sm hover:shadow-lg hover:border-forest-200/60 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center mb-5">
                      <svc.icon className="w-6 h-6" strokeWidth={2} />
                    </div>
                    <h3 className="text-lg font-bold text-surface-900 mb-2">{svc.title}</h3>
                    <p className="text-surface-600 text-sm leading-relaxed mb-4">{svc.desc}</p>
                    <Link
                      to={`/fountain-source/request?service=${svc.slug}`}
                      className="inline-flex items-center gap-1 text-forest-600 text-sm font-medium hover:gap-2 transition-all"
                    >
                      Request <ArrowRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Guards Image Banner */}
        <section className="py-20 lg:py-28 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 mb-16">
              <ScrollReveal>
                <div className="rounded-2xl overflow-hidden shadow-xl border border-surface-200">
                  <img
                    src="/assets/fsource-guards-entrance.jpg"
                    alt="Fountain Source security guards on duty"
                    className="w-full aspect-[16/10] object-cover"
                  />
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <div className="rounded-2xl overflow-hidden shadow-xl border border-surface-200">
                  <img
                    src="/assets/fsource-guards-briefing.jpg"
                    alt="Security operations briefing"
                    className="w-full aspect-[16/10] object-cover"
                  />
                </div>
              </ScrollReveal>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h2 className="text-3xl sm:text-4xl font-bold text-surface-900 mb-6">
                  Why Choose Fountain Source?
                </h2>
                <ul className="space-y-4">
                  {whyUs.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-forest-600 shrink-0 mt-0.5" />
                      <span className="text-surface-700 leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-forest-50 border border-forest-200/60 p-6 text-center">
                    <Award className="w-8 h-8 text-forest-600 mx-auto mb-3" />
                    <p className="font-bold text-surface-900 text-lg">29+ Years</p>
                    <p className="text-surface-600 text-sm">Industry experience</p>
                  </div>
                  <div className="rounded-xl bg-forest-50 border border-forest-200/60 p-6 text-center">
                    <Users className="w-8 h-8 text-forest-600 mx-auto mb-3" />
                    <p className="font-bold text-surface-900 text-lg">500+</p>
                    <p className="text-surface-600 text-sm">Satisfied clients</p>
                  </div>
                  <div className="rounded-xl bg-forest-50 border border-forest-200/60 p-6 text-center">
                    <Clock className="w-8 h-8 text-forest-600 mx-auto mb-3" />
                    <p className="font-bold text-surface-900 text-lg">24/7</p>
                    <p className="text-surface-600 text-sm">Rapid response</p>
                  </div>
                  <div className="rounded-xl bg-forest-50 border border-forest-200/60 p-6 text-center">
                    <Shield className="w-8 h-8 text-forest-600 mx-auto mb-3" />
                    <p className="font-bold text-surface-900 text-lg">75%</p>
                    <p className="text-surface-600 text-sm">Debt recovery rate</p>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Our Approach */}
        <section className="py-20 lg:py-28 bg-surface-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <ScrollReveal>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">Our Approach</h2>
              <p className="text-surface-300 text-lg leading-relaxed max-w-3xl mx-auto">
                The success of any security organization depends on the calibre of its guards on the
                ground. At recruitment, emphasis is placed on personal intelligence, physical build, and
                experience. Our guards — including duty supervisors, coordinating supervisors, and patrol
                superintendents — hold a minimum of WAEC and/or a first degree, depending on the cadre
                and needs of each client.
              </p>
              <p className="text-surface-300 text-lg leading-relaxed max-w-3xl mx-auto mt-6">
                Since the business of security is a dynamic one, our guards undergo regular courses in
                physical and mental alertness, crime prevention, detection, and the use of modern safety
                technology. Guarantors to our guards are men of impeccable character who endorse our
                tripartite bond agreement — ensuring honesty and assiduousness to duty.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Contact / CTA */}
        <section className="py-20 lg:py-28 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h2 className="text-3xl sm:text-4xl font-bold text-surface-900">
                  Need help? Our security team is ready.
                </h2>
                <p className="mt-4 text-lg text-surface-600">
                  Fill out our online form, call us, or visit our office. We are ready to keep you and
                  your business safe and secure.
                </p>
                <div className="mt-8 space-y-4">
                  <a
                    href="tel:+2349088077730"
                    className="flex items-center gap-3 text-surface-800 hover:text-forest-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-forest-100 text-forest-700 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <span className="font-medium">(+234) 908 807 7730</span>
                  </a>
                  <a
                    href="mailto:info@fsourceltd.com"
                    className="flex items-center gap-3 text-surface-800 hover:text-forest-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-forest-100 text-forest-700 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <span className="font-medium">info@fsourceltd.com</span>
                  </a>
                  <div className="flex items-start gap-3 text-surface-800">
                    <div className="w-10 h-10 rounded-lg bg-forest-100 text-forest-700 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <span className="font-medium">
                      8, Desalu Street, Off Olaleye Road,
                      <br />
                      Ebute-Metta, Lagos, Nigeria
                    </span>
                  </div>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <div className="rounded-2xl bg-white border border-surface-200 p-8 sm:p-10 shadow-lg text-center">
                  <h3 className="text-2xl font-bold text-surface-900 mb-4">Get protection today</h3>
                  <p className="text-surface-600 mb-8">
                    Tell us what you need and we&apos;ll respond within 24 hours.
                  </p>
                  <Link to="/fountain-source/request">
                    <Button
                      size="lg"
                      className="w-full bg-forest-600 hover:bg-forest-700 text-white"
                      icon={ArrowRight}
                    >
                      Request a Service
                    </Button>
                  </Link>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
