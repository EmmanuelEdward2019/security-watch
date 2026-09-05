import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Home, ArrowRight, BedDouble, Bath, ShieldCheck } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/services/paymentService';
import type { Property } from '@/types';
import { cn } from '@/utils/cn';

type ListingFilter = 'all' | 'rent' | 'sale';

/**
 * Public marketplace.
 *
 * Three invented listings were hardcoded here, with a comment reading "in
 * production, fetch from Supabase". It reads the real table now — anonymous
 * visitors may see active listings under the existing RLS policy, so no
 * authentication is required.
 */
export default function PublicPropertyListPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ListingFilter>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('is_active', true)
      .order('status', { ascending: false }) // verified listings first
      .order('created_at', { ascending: false })
      .limit(60);

    setProperties((data ?? []) as Property[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (filter !== 'all' && p.listing_type !== filter) return false;
      if (verifiedOnly && p.status !== 'verified') return false;
      if (!term) return true;
      return (
        p.location?.toLowerCase().includes(term) ||
        p.title?.toLowerCase().includes(term) ||
        p.address?.toLowerCase().includes(term)
      );
    });
  }, [properties, search, filter, verifiedOnly]);

  const verifiedCount = properties.filter((p) => p.status === 'verified').length;

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-16 lg:py-24 bg-surface-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                Property listings
              </h1>
              <p className="text-xl text-surface-600 max-w-2xl mb-8">
                Browse listings across Nigeria. A verified badge means our team has checked the title
                documents against the registry and inspected the property — it is not something an
                owner can set themselves.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                  <input
                    type="search"
                    placeholder="Search by location, title or address"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search listings"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-surface-300 focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                  />
                </div>

                <div className="flex gap-2" role="group" aria-label="Filter by listing type">
                  {(['all', 'sale', 'rent'] as ListingFilter[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFilter(option)}
                      aria-pressed={filter === option}
                      className={cn(
                        'px-4 py-3 rounded-lg font-medium transition-colors',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500',
                        filter === option
                          ? 'bg-forest-600 text-white'
                          : 'bg-white border border-surface-300 text-surface-700 hover:bg-surface-50'
                      )}
                    >
                      {option === 'all' ? 'All' : option === 'sale' ? 'For sale' : 'For rent'}
                    </button>
                  ))}
                </div>
              </div>

              {verifiedCount > 0 && (
                <label className="inline-flex items-center gap-2 mt-4 text-sm text-surface-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="rounded border-surface-300 text-forest-600 focus:ring-forest-500"
                  />
                  Verified listings only ({verifiedCount})
                </label>
              )}
            </ScrollReveal>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : visible.length === 0 ? (
              <div className="max-w-md mx-auto text-center py-12">
                <Home className="w-12 h-12 text-surface-300 mx-auto mb-4" strokeWidth={1.5} />
                <h2 className="text-lg font-semibold text-surface-900 mb-1">
                  {properties.length === 0 ? 'No listings yet' : 'Nothing matches that search'}
                </h2>
                <p className="text-surface-600 mb-6">
                  {properties.length === 0
                    ? 'Listings will appear here as landlords add them.'
                    : 'Try a different location, or clear the filters.'}
                </p>
                <Link to="/register">
                  <Button className="bg-forest-600 hover:bg-forest-700 text-white">
                    List your property
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-surface-500 mb-6 tabular-nums">
                  {visible.length} {visible.length === 1 ? 'listing' : 'listings'}
                </p>

                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((property, i) => (
                    <ScrollReveal key={property.id} delay={Math.min(i, 8) * 0.06}>
                      <Link
                        to={`/property/${property.id}`}
                        className="flex flex-col h-full rounded-2xl border border-surface-200 overflow-hidden hover:border-forest-200 hover:shadow-lg transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
                      >
                        <div className="relative">
                          {property.images?.[0] ? (
                            <img
                              src={property.images[0]}
                              alt={property.title}
                              className="h-52 w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-52 w-full bg-surface-100 flex items-center justify-center">
                              <Home size={36} className="text-surface-300" />
                            </div>
                          )}

                          {property.status === 'verified' && (
                            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-medium text-white">
                              <ShieldCheck size={12} /> Verified
                            </span>
                          )}
                        </div>

                        <div className="p-5 flex flex-col flex-1">
                          <h2 className="font-semibold text-surface-900 group-hover:text-forest-600 transition-colors line-clamp-2">
                            {property.title}
                          </h2>

                          <p className="text-sm text-surface-500 flex items-center gap-1.5 mt-1.5">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="truncate">{property.location}</span>
                          </p>

                          {(property.bedrooms || property.bathrooms) && (
                            <div className="flex items-center gap-4 text-sm text-surface-500 mt-2">
                              {property.bedrooms ? (
                                <span className="flex items-center gap-1">
                                  <BedDouble className="w-4 h-4" /> {property.bedrooms}
                                </span>
                              ) : null}
                              {property.bathrooms ? (
                                <span className="flex items-center gap-1">
                                  <Bath className="w-4 h-4" /> {property.bathrooms}
                                </span>
                              ) : null}
                            </div>
                          )}

                          <div className="mt-auto pt-4">
                            <p className="text-lg font-bold text-surface-900 tabular-nums">
                              {formatCurrency(Number(property.price), property.currency)}
                              {property.listing_type === 'rent' && (
                                <span className="text-sm font-normal text-surface-500"> / year</span>
                              )}
                            </p>
                            <span className="inline-flex items-center gap-1 text-forest-600 text-sm font-medium mt-1 group-hover:gap-2 transition-all">
                              View details <ArrowRight className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    </ScrollReveal>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
