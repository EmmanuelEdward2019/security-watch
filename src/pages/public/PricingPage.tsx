import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Home, Building2, Film, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';
import { fetchServicePrices, formatCurrency } from '@/services/paymentService';
import { PRICE_MODULE_LABELS, type ServicePrice, type PriceModule } from '@/types';

const MODULE_ICONS: Record<PriceModule, typeof FileText> = {
  investigation: FileText,
  property: Home,
  media: Film,
  security: Building2,
};

const MODULE_ORDER: PriceModule[] = ['investigation', 'property', 'media', 'security'];

/**
 * Public pricing.
 *
 * The page previously described three fee categories in prose and said rates
 * "vary" — there was no price catalogue anywhere in the platform, and checkout
 * let the payer type whatever amount they liked. It now reads the same
 * `service_prices` table the server uses to price a checkout, so what a visitor
 * is quoted here is exactly what they will be charged.
 *
 * It also no longer advertises Stripe, which was never implemented.
 */
export default function PricingPage() {
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { prices: list } = await fetchServicePrices();
      if (cancelled) return;
      setPrices(list);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<PriceModule, ServicePrice[]>();
    for (const price of prices) {
      const list = map.get(price.module) ?? [];
      list.push(price);
      map.set(price.module, list);
    }
    return MODULE_ORDER.filter((m) => map.has(m)).map(
      (m) => [m, map.get(m) as ServicePrice[]] as const
    );
  }, [prices]);

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-surface-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Pricing &amp; fees
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl">
                  Every fee we charge, published in full. You see the exact amount before you pay, and
                  it is the same figure our system charges at checkout.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/bodyguard-protection.jpg"
                    alt="Transparent pricing for all services"
                    className="w-full h-[280px] sm:h-[360px] object-cover"
                    loading="lazy"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : grouped.length === 0 ? (
              <div className="max-w-2xl mx-auto text-center">
                <p className="text-surface-600">
                  Our published rates are being updated. Please{' '}
                  <Link to="/contact" className="text-forest-600 underline">
                    contact us
                  </Link>{' '}
                  for a quote in the meantime.
                </p>
              </div>
            ) : (
              <div className="space-y-14">
                {grouped.map(([module, items], moduleIndex) => {
                  const Icon = MODULE_ICONS[module];
                  return (
                    <ScrollReveal key={module} delay={moduleIndex * 0.05}>
                      <div>
                        <div className="flex items-center gap-3 mb-6">
                          <Icon className="w-8 h-8 text-forest-600" />
                          <h2 className="text-2xl font-semibold text-surface-900">
                            {PRICE_MODULE_LABELS[module]}
                          </h2>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {items.map((price) => (
                            <div
                              key={price.key}
                              className="flex flex-col p-6 rounded-2xl bg-surface-50 border border-surface-200"
                            >
                              <h3 className="font-semibold text-surface-900">{price.label}</h3>
                              {price.description && (
                                <p className="text-sm text-surface-600 mt-1.5 flex-1">
                                  {price.description}
                                </p>
                              )}
                              <div className="mt-4 pt-4 border-t border-surface-200">
                                <p className="text-2xl font-bold text-surface-900 tabular-nums">
                                  {formatCurrency(Number(price.amount), price.currency)}
                                </p>
                                {price.unit && (
                                  <p className="text-sm text-forest-600 font-medium mt-0.5">
                                    {price.unit}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="py-16 lg:py-24 bg-surface-50">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <ScrollReveal>
              <div className="inline-flex items-center gap-2 mb-4 text-forest-700">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-sm font-medium">Payments verified by the provider</span>
              </div>
              <p className="text-surface-600 mb-8">
                Payment is taken on Paystack's secure checkout — we never see or store your card
                details, and a payment is only recorded once Paystack confirms it directly to our
                servers. Cards, bank transfer and USSD are all supported.
              </p>
              <Link to="/register">
                <Button
                  size="lg"
                  icon={ArrowRight}
                  className="bg-forest-600 hover:bg-forest-700 text-white"
                >
                  Get started
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
