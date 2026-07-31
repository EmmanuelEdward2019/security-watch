import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MapPin,
  ArrowRight,
  ShieldCheck,
  ShieldQuestion,
  BedDouble,
  Bath,
  Ruler,
  Home,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { Button, Spinner, Badge } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/services/paymentService';
import type { Property } from '@/types';
import { cn } from '@/utils/cn';

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment',
  house: 'House',
  land: 'Land',
  commercial: 'Commercial',
  office: 'Office',
};

/**
 * Public listing detail.
 *
 * The page previously derived its entire content from the URL id with a chain of
 * ternaries — `id === '1' ? '3-Bedroom Apartment in Lekki' : …` — so any real
 * listing id showed the Victoria Island office. It reads the actual row now, and
 * says so plainly when a listing cannot be found.
 */
export default function PublicPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    setProperty((data as Property) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <PublicNav />
        <main className="pt-16 lg:pt-20">
          <div className="flex justify-center py-32">
            <Spinner size="lg" />
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-white">
        <PublicNav />
        <main className="pt-16 lg:pt-20">
          <div className="max-w-md mx-auto px-4 py-32 text-center">
            <Home className="w-12 h-12 text-surface-300 mx-auto mb-4" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold text-surface-900 mb-2">Listing not available</h1>
            <p className="text-surface-600 mb-6">
              This property may have been withdrawn, or the link may be incomplete.
            </p>
            <Link to="/property">
              <Button className="bg-forest-600 hover:bg-forest-700 text-white" icon={ArrowLeft}>
                Browse all listings
              </Button>
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const isVerified = property.status === 'verified';
  const images = property.images?.length ? property.images : [];

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-8 lg:py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link
              to="/property"
              className="inline-flex items-center gap-2 text-forest-600 hover:underline mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 rounded"
            >
              <ArrowLeft className="w-4 h-4" /> All listings
            </Link>

            <ScrollReveal>
              <div className="grid lg:grid-cols-2 gap-12">
                <div>
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-surface-100">
                    {images.length > 0 ? (
                      <img
                        src={images[activeImage]}
                        alt={property.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home size={48} className="text-surface-300" />
                      </div>
                    )}
                  </div>

                  {images.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {images.map((image, i) => (
                        <button
                          key={image}
                          type="button"
                          onClick={() => setActiveImage(i)}
                          aria-label={`View image ${i + 1}`}
                          aria-current={activeImage === i}
                          className={cn(
                            'h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500',
                            activeImage === i ? 'border-forest-600' : 'border-transparent'
                          )}
                        >
                          <img
                            src={image}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-4',
                      isVerified ? 'bg-forest-100 text-forest-700' : 'bg-amber-100 text-amber-800'
                    )}
                  >
                    {isVerified ? (
                      <>
                        <ShieldCheck className="w-4 h-4" /> Verified by The Security Watch
                      </>
                    ) : (
                      <>
                        <ShieldQuestion className="w-4 h-4" /> Not yet verified
                      </>
                    )}
                  </span>

                  <h1 className="text-3xl font-bold text-surface-900 mb-3 text-balance">
                    {property.title}
                  </h1>

                  <p className="text-2xl font-bold text-forest-600 mb-4 tabular-nums">
                    {formatCurrency(Number(property.price), property.currency)}
                    {property.listing_type === 'rent' && (
                      <span className="text-base font-normal text-surface-500"> / year</span>
                    )}
                  </p>

                  <div className="flex items-center gap-2 text-surface-600 mb-6">
                    <MapPin className="w-5 h-5 shrink-0" />
                    <span>{property.location}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    <Badge variant="default">
                      {PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type}
                    </Badge>
                    <Badge variant="info">
                      {property.listing_type === 'rent' ? 'For rent' : 'For sale'}
                    </Badge>
                  </div>

                  {(property.bedrooms || property.bathrooms || property.area_sqm) && (
                    <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-surface-50 border border-surface-200">
                      {property.bedrooms ? (
                        <div>
                          <BedDouble className="w-5 h-5 text-forest-600 mb-1" />
                          <p className="text-sm text-surface-500">Bedrooms</p>
                          <p className="font-semibold text-surface-900 tabular-nums">
                            {property.bedrooms}
                          </p>
                        </div>
                      ) : null}
                      {property.bathrooms ? (
                        <div>
                          <Bath className="w-5 h-5 text-forest-600 mb-1" />
                          <p className="text-sm text-surface-500">Bathrooms</p>
                          <p className="font-semibold text-surface-900 tabular-nums">
                            {property.bathrooms}
                          </p>
                        </div>
                      ) : null}
                      {property.area_sqm ? (
                        <div>
                          <Ruler className="w-5 h-5 text-forest-600 mb-1" />
                          <p className="text-sm text-surface-500">Area</p>
                          <p className="font-semibold text-surface-900 tabular-nums">
                            {property.area_sqm} m²
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="mb-6">
                    <h2 className="font-semibold text-surface-900 mb-2">About this property</h2>
                    <p className="text-surface-600 whitespace-pre-line leading-relaxed">
                      {property.description}
                    </p>
                  </div>

                  {property.features?.length > 0 && (
                    <div className="mb-8">
                      <h2 className="font-semibold text-surface-900 mb-2">Features</h2>
                      <ul className="grid sm:grid-cols-2 gap-1.5">
                        {property.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-surface-600 text-sm">
                            <Check className="w-4 h-4 text-forest-600 shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 mb-6">
                    <p className="text-sm text-surface-600">
                      {isVerified
                        ? 'Our team has checked this listing’s title documents against the land registry and inspected the property. We still recommend taking your own legal advice before committing funds.'
                        : 'This listing has not been independently verified. Sign in to request a title verification before you commit any money — an owner cannot mark their own listing verified.'}
                    </p>
                  </div>

                  <Link to="/register">
                    <Button
                      size="lg"
                      icon={ArrowRight}
                      className="w-full sm:w-auto bg-forest-600 hover:bg-forest-700 text-white"
                    >
                      Sign in to enquire
                    </Button>
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
