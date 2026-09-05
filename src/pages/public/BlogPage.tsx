import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight, Clock, Newspaper } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';
import { fetchBlogPosts } from '@/services/propertyExtrasService';
import type { BlogPost } from '@/types';
import { format } from 'date-fns';

/**
 * Newsroom index.
 *
 * The posts were a hardcoded array, so publishing anything meant a code change
 * and a deploy. They live in `blog_posts` now, filtered to published, and are
 * editable without touching the build.
 */
export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { posts: list } = await fetchBlogPosts();
      if (cancelled) return;
      setPosts(list);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-sky-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                Blog &amp; insights
              </h1>
              <p className="text-xl text-surface-600 max-w-2xl">
                Guides and reporting to help you stay safe and make informed decisions.
              </p>
            </ScrollReveal>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : posts.length === 0 ? (
              <div className="max-w-md mx-auto text-center py-12">
                <Newspaper className="w-12 h-12 text-surface-300 mx-auto mb-4" strokeWidth={1.5} />
                <h2 className="text-lg font-semibold text-surface-900 mb-1">Nothing published yet</h2>
                <p className="text-surface-600">
                  Our first pieces are being prepared. Check back shortly.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {posts.map((post, i) => (
                  <ScrollReveal key={post.slug} delay={Math.min(i, 6) * 0.08}>
                    <Link
                      to={`/blog/${post.slug}`}
                      className="flex flex-col h-full rounded-2xl bg-surface-50 border border-surface-200 hover:border-forest-200 hover:bg-forest-50/50 transition-all group overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
                    >
                      {post.cover_image_url && (
                        <img
                          src={post.cover_image_url}
                          alt=""
                          className="h-48 w-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-surface-500 mb-3">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(post.published_at ?? post.created_at), 'd MMMM yyyy')}
                          </span>
                          {post.read_minutes ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="w-4 h-4" />
                              {post.read_minutes} min read
                            </span>
                          ) : null}
                        </div>

                        <h2 className="text-xl font-semibold text-surface-900 mb-2 group-hover:text-forest-600 transition-colors">
                          {post.title}
                        </h2>

                        {post.excerpt && <p className="text-surface-600 mb-4 flex-1">{post.excerpt}</p>}

                        <span className="inline-flex items-center gap-1 text-forest-600 font-medium group-hover:gap-2 transition-all mt-auto">
                          Read more <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </Link>
                  </ScrollReveal>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
