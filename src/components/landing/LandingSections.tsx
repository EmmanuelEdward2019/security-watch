import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Shield,
  Lock,
  Eye,
  FileSearch,
  Scale,
  Microscope,
  Building2,
  CheckCircle2,
  Handshake,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { ScrollReveal } from '@/components/public';

export function LandingHero() {
  return (
    /*
      Solid forest, one colour, no washes.
      
      This was four stacked layers: a base gradient, an Unsplash photograph at
      40% under mix-blend-overlay, a black scrim, and a radial glow. The
      photograph never actually rendered — the Content-Security-Policy allows
      images only from 'self', data:, blob: and Supabase — so every visitor saw
      three gradients blending into each other over nothing. That murk is the
      "dusty splash".
      
      What replaces it is structural rather than atmospheric: a flat brand
      ground and a hairline rule marking the content column. Crisp geometry,
      not blur, and it reads as a document rather than a landing template.
    */
    <section className="relative flex min-h-[65vh] items-center overflow-hidden bg-forest-600 pt-20 lg:pt-24">
      {/* A single hairline down the measure — the only decoration, and it is a
          line rather than a haze. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-4 hidden w-px bg-white/10 sm:left-6 lg:left-8 lg:block"
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12 lg:py-16">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          <motion.div
            className="lg:col-span-7 order-2 lg:order-1"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <p className="text-forest-300 text-xs md:text-sm font-semibold tracking-widest uppercase mb-2 md:mb-3">
              The Security Watch
            </p>
            <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-[2.25rem] xl:text-5xl font-bold text-white leading-[1.15] tracking-tight">
              <span className="md:hidden">Investigative, security &amp; property services</span>
              <span className="hidden md:inline">
                Professional Investigative, Security &amp; Property Verification Services
              </span>
            </h1>
            <p className="mt-4 md:mt-5 text-sm md:text-base lg:text-lg text-surface-200/95 max-w-2xl leading-relaxed md:hidden">
              Vetted professionals. Secure platform. One place for cases, verification, and transparency.
            </p>
            <p className="mt-5 text-base sm:text-lg text-surface-200/95 max-w-2xl leading-relaxed hidden md:block">
              The Security Watch provides access to vetted private investigators, licensed legal
              practitioners, and forensic specialists. We also offer property verification and
              institutional transparency services — all delivered through a secure, technology-driven
              platform built for accountability.
            </p>
            <div className="mt-6 md:mt-8 flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4">
              <Link to="/register" className="inline-flex">
                <span className="inline-flex items-center justify-center gap-2 min-h-[52px] px-8 rounded-xl bg-forest-500 hover:bg-forest-400 text-white font-semibold shadow-lg shadow-black/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  Report a Case
                  <ArrowRight className="w-5 h-5 shrink-0" />
                </span>
              </Link>
              <Link to="/property" className="inline-flex">
                <span className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-xl border-2 border-white/30 text-white hover:bg-white/10 font-semibold transition-colors">
                  Verify a Property
                </span>
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="lg:col-span-5 order-1 lg:order-2"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.12 }}
          >
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
              <img
                src="/assets/hero-professional.jpg"
                alt="Professional support when you need it most"
                className="w-full aspect-[16/10] sm:aspect-[4/3] lg:aspect-[4/5] object-cover"
                /*
                  No Unsplash fallback. The CSP allows images from 'self',
                  data:, blob: and Supabase only, so the fallback could never
                  load — it swapped a broken local image for a blocked remote
                  one. If the asset is missing the alt text is the honest
                  outcome.
                */
              />
              {/* A solid band, not a fade. The caption needs a legible ground;
                  it does not need the image to dissolve into one. */}
              <div className="absolute inset-x-0 bottom-0 bg-forest-800/95 p-4 sm:p-6 md:p-8">
                <p className="text-white font-semibold text-sm sm:text-base md:text-lg">
                  Investigators · Legal · Forensics
                </p>
                <p className="text-white/80 text-xs sm:text-sm mt-1 hidden sm:block">
                  One secure platform. Verified professionals. Measurable accountability.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function EmotionalStorySection() {
  return (
    <section className="py-12 md:py-16 lg:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 lg:items-center">
          <ScrollReveal>
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-surface-200 aspect-[4/3] lg:aspect-[5/4]">
              <img
                src="/assets/team-collaboration.jpg"
                alt="The Security Watch — professional investigations and accountability"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/15 pointer-events-none" />
            </div>
          </ScrollReveal>
          <div className="text-left lg:pl-2">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 leading-snug">
                About The Security Watch
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.08}>
              <div className="mt-6 md:mt-8 space-y-4 md:space-y-5 text-base sm:text-lg text-surface-600 leading-relaxed">
                <p className="hidden md:block">
                  The Security Watch was established to address the gap between citizens and the
                  professional resources needed to resolve cases of fraud, injustice, property disputes,
                  and institutional misconduct. We provide a structured, confidential, and
                  technology-enabled pathway for individuals to report matters, engage verified
                  professionals, and pursue resolution.
                </p>
                <p className="md:hidden text-surface-600 text-sm leading-relaxed">
                  Structured, confidential support for fraud, property, and institutional matters — with
                  verified professionals on your side.
                </p>
                <p className="text-surface-900 text-base md:text-lg lg:text-xl font-semibold leading-snug">
                  <span className="md:hidden">Expertise and accountability when you need it most.</span>
                  <span className="hidden md:inline">
                    Where the system falls short, we provide the structure, expertise, and accountability
                    to move your case forward.
                  </span>
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}

const whoCards = [
  {
    icon: Shield,
    title: 'Verified Professionals',
    body: 'Every investigator, legal practitioner, and forensic specialist on our platform undergoes a rigorous vetting process that evaluates professional credentials, field experience, and adherence to ethical standards.',
  },
  {
    icon: Lock,
    title: 'Secure Evidence Management',
    body: 'All uploaded materials are processed through a chain-of-custody-compliant system with end-to-end encryption, ensuring evidentiary integrity from submission through to resolution.',
  },
  {
    icon: Eye,
    title: 'Confidential Case Handling',
    body: 'Sensitive and high-risk matters are managed under strict operational protocols — including identity protection, compartmentalised access, and discreet communication channels.',
  },
];

export function WhoWeAreSection() {
  return (
    <section className="py-12 md:py-16 lg:py-20 bg-surface-50 border-y border-surface-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="max-w-3xl mx-auto text-center mb-10 md:mb-14 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-surface-900">Who We Are</h2>
            <p className="mt-2 md:mt-3 text-base md:text-lg text-forest-800 font-semibold">
              A professional services platform built for accountability and resolution.
            </p>
            <p className="mt-4 md:mt-5 text-base sm:text-lg text-surface-600 leading-relaxed hidden md:block">
              The Security Watch operates as a centralised platform connecting individuals and
              organisations with qualified private investigators, licensed legal practitioners,
              forensic analysts, and security consultants. Our mandate is to deliver professional
              case management, property due diligence, and institutional oversight services through
              a secure, transparent, and results-oriented framework.
            </p>
            <p className="mt-3 text-sm text-surface-600 leading-relaxed md:hidden">
              Centralised access to investigators, legal counsel, and specialists — one secure framework.
            </p>
          </div>
        </ScrollReveal>
        <div className="md:hidden grid grid-cols-3 gap-2 mb-8 rounded-xl overflow-hidden border border-surface-200" aria-hidden>
          <img src="/assets/hero-professional.jpg" alt="" className="h-24 w-full object-cover" />
          <img src="/assets/bodyguard-protection.jpg" alt="" className="h-24 w-full object-cover" />
          <img src="/assets/property-verification.jpg" alt="" className="h-24 w-full object-cover" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
          {whoCards.map((card, i) => (
            <ScrollReveal key={card.title} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                className="h-full rounded-2xl bg-white p-5 md:p-8 border border-surface-200 shadow-sm hover:shadow-xl hover:border-forest-200/60 transition-all duration-300 flex flex-col sm:block"
              >
                <div className="flex sm:block items-start gap-4 sm:gap-0">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center shrink-0 mb-0 sm:mb-6">
                    <card.icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg md:text-xl font-bold text-surface-900 mb-0 sm:mb-3">{card.title}</h3>
                    <p className="text-surface-600 leading-relaxed text-sm md:text-base hidden md:block mt-3">{card.body}</p>
                  </div>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  { n: 1, title: 'Submit Your Case', desc: 'Provide a detailed account of the matter and securely upload any supporting evidence or documentation through our encrypted portal.', icon: FileSearch },
  { n: 2, title: 'Professional Matching', desc: 'A one-off filing fee covers triage, and your case is then assigned to the appropriate specialist — whether a private investigator, legal practitioner, or forensic analyst — based on case type and jurisdiction. Your case is saved from the moment you submit it, whether you pay now or later.', icon: Scale },
  { n: 3, title: 'Active Investigation', desc: 'The assigned professional conducts a structured investigation with regular progress updates, milestone tracking, and transparent communication throughout the process.', icon: Shield },
  { n: 4, title: 'Resolution & Documentation', desc: 'Upon completion, you receive a comprehensive case report with findings, evidence, and recommended next steps for legal or administrative follow-through.', icon: CheckCircle2 },
];

export function HowItWorksStepsSection() {
  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 text-center mb-3">How It Works</h2>
          <p className="text-base sm:text-lg text-surface-600 text-center max-w-2xl mx-auto mb-12 sm:mb-14">
            A clearly defined, four-stage process — from initial submission to professional resolution.
          </p>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {steps.map((step, i) => (
            <ScrollReveal key={step.n} delay={i * 0.06}>
              <div className="relative h-full">
                {i < steps.length - 1 && (
                  <div
                    className="hidden lg:block absolute top-10 left-[calc(50%+2rem)] w-[calc(100%-2rem)] h-px bg-forest-300/40"
                    aria-hidden
                  />
                )}
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left h-full">
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-forest-600 text-white text-xl font-bold shadow-lg shadow-forest-900/20 mb-5">
                    {step.n}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-surface-100 text-forest-700 flex items-center justify-center mb-4 mx-auto lg:mx-0">
                    <step.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-surface-900 mb-2">{step.title}</h3>
                  <p className="text-surface-600 text-sm leading-relaxed flex-1">{step.desc}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RiskTrustSection() {
  return (
    <section className="py-16 sm:py-20 bg-surface-900 text-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <ScrollReveal direction="left">
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
              Trained Professionals for Complex and Sensitive Matters
            </h2>
            <p className="mt-6 text-lg text-surface-300 leading-relaxed">
              Our network comprises seasoned investigators and security operatives with backgrounds
              in law enforcement, intelligence, legal practice, and forensic science. They are
              equipped to handle cases that require discretion, persistence, and specialised
              expertise — from financial fraud and land disputes to personal security threats and
              institutional misconduct.
            </p>
            <p className="mt-8 text-xl font-medium text-white border-l-4 border-forest-500 pl-6">
              Every case represents someone&apos;s livelihood, safety, or future. We treat it accordingly.
            </p>
          </ScrollReveal>
          <ScrollReveal direction="right">
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="relative rounded-2xl overflow-hidden aspect-[4/3] border border-white/10"
            >
              <img
                src="/assets/bodyguard-protection.jpg"
                alt="Dedicated professionals on your side"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/35" />
            </motion.div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export function PropertyVerificationSection() {
  return (
    <section className="py-16 sm:py-20 bg-forest-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <ScrollReveal>
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-surface-200">
              <img
                src="/assets/property-verification.jpg"
                alt="Property verification"
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h2 className="text-2xl sm:text-3xl font-bold text-surface-900">
              Property Due Diligence &amp; Verification Services
            </h2>
            <p className="mt-6 text-lg text-surface-600 leading-relaxed">
              Real estate fraud remains one of the most prevalent financial crimes in Nigeria. The
              Security Watch provides comprehensive property verification services — including title
              search, ownership confirmation, encumbrance checks, and agent authentication — so you
              can make informed decisions before any financial commitment.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link to="/property">
                <Button size="lg" className="w-full sm:w-auto bg-forest-600 hover:bg-forest-700 text-white" icon={Building2}>
                  Browse Properties
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-forest-600 text-forest-700 hover:bg-forest-50">
                  Verify Property
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export function TransparencyMediaSection() {
  return (
    <section className="py-16 sm:py-20 bg-white border-t border-surface-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <ScrollReveal>
          <Microscope className="w-10 h-10 text-forest-600 mx-auto mb-5" strokeWidth={1.5} />
          <h2 className="text-2xl sm:text-3xl font-bold text-surface-900">Institutional Transparency &amp; Accountability</h2>
          <p className="mt-6 text-base sm:text-lg text-surface-600 leading-relaxed">
            Beyond individual casework, The Security Watch conducts independent monitoring and
            assessment of public and private institutions — including schools, hospitals, law
            enforcement agencies, and government offices. Through structured, anonymous evaluations,
            we document systemic issues, highlight areas of concern, and recognise institutions
            that demonstrate excellence. Our objective is to promote reform through evidence-based
            reporting and public awareness.
          </p>
          <Link to="/services/transparency" className="inline-block mt-10">
            <span className="text-forest-700 font-semibold hover:text-forest-800 inline-flex items-center gap-2">
              Learn how transparency works <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}

const trustPoints = [
  'Full identity protection throughout every engagement',
  'End-to-end data encryption and secure evidence handling',
  'Every case managed by vetted, qualified professionals',
];

export function TrustBulletsSection() {
  return (
    <section className="py-16 sm:py-20 bg-surface-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <ScrollReveal>
          <ul className="flex flex-col sm:flex-row flex-wrap justify-center gap-6 sm:gap-12">
            {trustPoints.map((text) => (
              <li
                key={text}
                className="flex items-center gap-3 justify-center sm:justify-start text-surface-800 font-medium"
              >
                <CheckCircle2 className="w-6 h-6 text-forest-600 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  /*
   * Solid forest-800. Was three layers — a gradient, a CSP-blocked photograph
   * at 25%, and a 70% scrim over it — which resolved to a murky wash because
   * the photograph never loaded.
   */
  return (
    <section className="relative overflow-hidden border-y border-forest-700 bg-forest-800 py-20 sm:py-24">
      <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
        <ScrollReveal>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
            Take the First Step Toward Resolution
          </h2>
          <div className="mt-10 space-y-4 text-lg sm:text-xl text-surface-200 max-w-2xl mx-auto">
            <p>
              Whether you are dealing with property fraud, an unresolved legal matter,
              a threat to personal safety, or institutional negligence — The Security Watch
              provides the professional framework to address it.
            </p>
            <p className="pt-4 text-white font-semibold text-xl">
              Submit your case today and let qualified professionals take it from here.
            </p>
          </div>
          <div className="mt-12 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="w-full sm:w-auto bg-white text-surface-900 hover:bg-surface-100 font-semibold px-10" icon={ArrowRight}>
                Submit Your Case
              </Button>
            </Link>
            <Link to="/register">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-2 border-white/80 text-white hover:bg-white/10 font-semibold"
                icon={Handshake}
              >
                Get Started
              </Button>
            </Link>
            <Link to="/partners" className="sm:ml-2">
              <span className="inline-flex items-center justify-center min-h-[48px] text-white/90 hover:text-white text-sm font-medium underline underline-offset-4">
                Partner with us
              </span>
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
