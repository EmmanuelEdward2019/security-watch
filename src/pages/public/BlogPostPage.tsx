import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Newspaper } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';
import { fetchBlogPost } from '@/services/propertyExtrasService';
import type { BlogPost } from '@/types';
import { format } from 'date-fns';

/**
 * A single article.
 *
 * Read from `blog_posts` rather than a hardcoded map. An unknown slug used to
 * silently fall through to the land-fraud article, which meant a mistyped or
 * retired URL served the wrong piece under the wrong heading; it now says the
 * article could not be found.
 *
 * The body is rendered as paragraphs of plain text, deliberately — not as HTML —
 * so editorial content can never inject markup into the page.
 */
export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { post: found } = await fetchBlogPost(slug);
      if (cancelled) return;
      setPost(found);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const paragraphs = (post?.body ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <article className="py-16 lg:py-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 text-forest-600 hover:underline mb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 rounded"
              >
                <ArrowLeft className="w-4 h-4" /> Back to blog
              </Link>

              {loading ? (
                <div className="flex justify-center py-16">
                  <Spinner size="lg" />
                </div>
              ) : !post ? (
                <div className="text-center py-12">
                  <Newspaper
                    className="w-12 h-12 text-surface-300 mx-auto mb-4"
                    strokeWidth={1.5}
                  />
                  <h1 className="text-2xl font-bold text-surface-900 mb-2">
                    We could not find that article
                  </h1>
                  <p className="text-surface-600 mb-6">
                    It may have been retired, or the link may be incomplete.
                  </p>
                  <Link to="/blog" className="text-forest-600 font-medium hover:underline">
                    Browse everything we have published
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-surface-500 mb-4">
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
                    {post.author_name && <span>by {post.author_name}</span>}
                  </div>

                  <h1 className="text-3xl sm:text-4xl font-bold text-surface-900 mb-6 text-balance">
                    {post.title}
                  </h1>

                  {post.cover_image_url && (
                    <img
                      src={post.cover_image_url}
                      alt=""
                      className="w-full rounded-2xl mb-8 object-cover max-h-[420px]"
                    />
                  )}

                  {post.excerpt && (
                    <p className="text-xl text-surface-700 leading-relaxed mb-8">{post.excerpt}</p>
                  )}

                  <div className="space-y-5">
                    {paragraphs.map((paragraph, i) => (
                      <p key={i} className="text-lg text-surface-600 leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {post.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-surface-200">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-surface-100 px-3 py-1 text-sm text-surface-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </ScrollReveal>
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
