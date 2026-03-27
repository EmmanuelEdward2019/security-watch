import { Link } from 'react-router-dom';
import { Play, Building2 } from 'lucide-react';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

const categories = ['Police', 'Schools', 'Hospitals', 'Markets'];

export default function MediaPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-gradient-to-br from-forest-50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Media & Documentaries
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl">
                  Video feeds, recorded documentaries, and featured stories. 
                  Transparency through media.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/agent-field-ops.jpg"
                    alt="Media and transparency"
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
              <h2 className="text-2xl font-bold text-surface-900 mb-6">Categories</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories.map((cat, i) => (
                  <ScrollReveal key={cat} delay={i * 0.05}>
                    <Link
                      to={`/media?category=${cat.toLowerCase()}`}
                      className="flex items-center gap-3 p-4 rounded-xl bg-surface-50 border border-surface-200 hover:border-forest-200 hover:bg-forest-50/50 transition-all"
                    >
                      <Building2 className="w-6 h-6 text-forest-600" />
                      <span className="font-medium text-surface-700">{cat}</span>
                    </Link>
                  </ScrollReveal>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="py-16 lg:py-24 bg-surface-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h2 className="text-2xl font-bold text-surface-900 mb-8">Featured Stories</h2>
              <div className="grid md:grid-cols-2 gap-8">
                {[1, 2].map((i) => (
                  <ScrollReveal key={i} delay={i * 0.1}>
                    <div className="rounded-2xl overflow-hidden bg-white border border-surface-200">
                      <div className="aspect-video bg-surface-200 flex items-center justify-center">
                        <Play className="w-16 h-16 text-forest-600 opacity-80" />
                      </div>
                      <div className="p-6">
                        <span className="text-sm text-forest-600 font-medium">Documentary</span>
                        <h3 className="text-lg font-semibold text-surface-900 mt-2">
                          Institutional Transparency in Action
                        </h3>
                        <p className="text-surface-600 mt-2 text-sm">
                          How our media agents evaluate and report on public institutions.
                        </p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <ScrollReveal>
              <p className="text-surface-600 mb-8">
                Sign in to upload media, view full documentaries, and access live streams (coming soon).
              </p>
              <Link to="/register">
                <span className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-forest-600 hover:bg-forest-700 text-white font-medium">
                  Get started
                </span>
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
