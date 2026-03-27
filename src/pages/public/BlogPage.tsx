import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

const posts = [
  { slug: 'avoid-land-scams', title: 'How to Avoid Land Scams in Nigeria', excerpt: 'Red flags to watch for and steps to verify property ownership before you pay.', date: '2024-03-15' },
  { slug: 'private-investigations', title: 'How Private Investigations Work', excerpt: 'What to expect when you report a case and get matched with an investigator.', date: '2024-03-10' },
  { slug: 'property-verification', title: 'Understanding Property Verification', excerpt: 'Why it matters and how we validate ownership and documents.', date: '2024-03-05' },
  { slug: 'institutional-transparency', title: 'Why Institutional Transparency Matters', excerpt: 'How anonymous evaluations help improve public services for everyone.', date: '2024-02-28' },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-gradient-to-br from-forest-50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                Blog & Insights
              </h1>
              <p className="text-xl text-surface-600 max-w-2xl">
                Tips, guides, and stories to help you stay safe and make informed decisions.
              </p>
            </ScrollReveal>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8">
              {posts.map((post, i) => (
                <ScrollReveal key={post.slug} delay={i * 0.1}>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="block p-6 rounded-2xl bg-surface-50 border border-surface-200 hover:border-forest-200 hover:bg-forest-50/50 transition-all group"
                  >
                    <div className="flex items-center gap-2 text-sm text-surface-500 mb-3">
                      <Calendar className="w-4 h-4" />
                      {post.date}
                    </div>
                    <h2 className="text-xl font-semibold text-surface-900 mb-2 group-hover:text-forest-600 transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-surface-600 mb-4">{post.excerpt}</p>
                    <span className="inline-flex items-center gap-1 text-forest-600 font-medium group-hover:gap-2 transition-all">
                      Read more <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
