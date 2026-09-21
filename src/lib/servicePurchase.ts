import type { ServicePrice } from '@/types';

/** The shape this module needs from an engagement. */
export interface DepositBearing {
  service_key: string;
  status: string;
  deposit_amount: number;
}

/**
 * Which services a person may buy for themselves, and what they actually owe.
 *
 * The platform sells two different things through one checkout screen, and
 * conflating them cost real money:
 *
 *   PLATFORM SERVICES (filing fees, property verification, archive access)
 *   are sold off the catalogue at the listed price. Anyone may buy one.
 *
 *   PROFESSIONAL SERVICES (investigation retainer, legal processing, forensic
 *   analysis) are not for sale. An administrator books a named professional
 *   against a case, which snapshots the agreed total and a deposit onto
 *   `case_engagements`. What is owed is that DEPOSIT.
 *
 * Before this, checkout listed all ten and priced every one from the
 * catalogue. Two consequences, both live:
 *
 *   1. Buying a professional service with no engagement booked took the money
 *      and did nothing — settle_engagement_deposit() matches an
 *      awaiting_deposit row and returns NULL when there is none.
 *   2. Buying one WITH an engagement booked quoted the full total. The
 *      engagement panel's button said "Pay NGN 75,000 deposit" and the next
 *      screen asked for NGN 150,000.
 *
 * payments-initialize enforces this server-side and is the authority. These
 * helpers keep the screen honest before the redirect.
 */

/** A service anyone may buy without an administrator arranging it first. */
export function isSelfServe(price: Pick<ServicePrice, 'is_platform_fee'>): boolean {
  // Undefined means the column was not selected; treat as self-serve so a
  // partial fetch degrades to the old catalogue behaviour rather than an
  // empty screen. The edge function still refuses what it should.
  return price.is_platform_fee !== false;
}

/** The engagement a service is being paid against on this case, if any. */
export function openEngagementFor<E extends DepositBearing>(
  engagements: E[],
  serviceKey: string | undefined
): E | null {
  if (!serviceKey) return null;
  return (
    engagements.find((e) => e.service_key === serviceKey && e.status === 'awaiting_deposit') ?? null
  );
}

/** What checkout may offer: platform services, plus any booked engagement. */
export function purchasableServices<P extends ServicePrice, E extends DepositBearing>(
  prices: P[],
  engagements: E[]
): P[] {
  return prices.filter((p) => isSelfServe(p) || openEngagementFor(engagements, p.key) !== null);
}

/** What the payer actually owes. A deposit is never multiplied by quantity. */
export function amountDue<E extends DepositBearing>(
  price: Pick<ServicePrice, 'amount'>,
  engagement: E | null,
  quantity: number
): number {
  if (engagement) return Number(engagement.deposit_amount);
  return Number(price.amount) * Math.max(1, quantity);
}
