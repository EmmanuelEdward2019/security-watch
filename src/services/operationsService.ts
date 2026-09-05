import { supabase } from '@/lib/supabase';

/**
 * The queues that quietly rot.
 *
 * The analytics screen answers "how much" — how many cases, how much revenue.
 * It does not answer the question an administrator actually needs each morning,
 * which is "what is stuck". A case nobody was assigned to, a verification
 * nobody reviewed, a payout accrued and never sent: none of these raise an
 * error, none appear as a failure, and each is somebody waiting.
 *
 * Deliberately no new RPC or migration. Every count here is readable by an
 * administrator through existing RLS, so this works against the live database
 * today rather than waiting on a schema change.
 *
 * Each count resolves independently and a failure leaves that one `undefined`
 * rather than rejecting the batch — one unavailable number must not blank the
 * whole board.
 */

export interface StuckQueue {
  key: string;
  label: string;
  /** What an administrator should do about it. */
  action: string;
  /** Where to go and do it. */
  href: string;
  count: number | undefined;
  /** How long something must sit before it counts as stuck. */
  thresholdDays: number;
  /** Above this, the row is flagged. Zero is always fine. */
  warnAt: number;
}

const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

async function countOrUndefined(
  build: () => PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number | undefined> {
  try {
    const { count, error } = await build();
    if (error) return undefined;
    return count ?? 0;
  } catch {
    return undefined;
  }
}

export async function fetchStuckQueues(): Promise<StuckQueue[]> {
  const [
    unassignedCases,
    staleKyc,
    unreleasedPayouts,
    awaitingDeposit,
    pendingMedia,
    pendingPropertyChecks,
  ] = await Promise.all([
    // Filed, still nobody on it. `head: true` so Postgres returns the number
    // without the rows.
    countOrUndefined(() =>
      supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .is('assigned_investigator_id', null)
        .in('status', ['submitted', 'under_review'])
        .lt('created_at', daysAgo(3))
    ),

    // Someone submitted identity documents and has heard nothing.
    countOrUndefined(() =>
      supabase
        .from('investigators')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'pending')
        .not('submitted_at', 'is', null)
        .lt('submitted_at', daysAgo(7))
    ),

    // Money owed to a professional that has not left the platform. This one
    // has no time threshold — an unreleased payout is worth seeing on day one.
    countOrUndefined(() =>
      supabase
        .from('payout_ledger')
        .select('id', { count: 'exact', head: true })
        .in('status', ['accrued', 'approved'])
    ),

    // A professional has been booked but the complainant never paid, so the
    // work has not started and nobody has been told.
    countOrUndefined(() =>
      supabase
        .from('case_engagements')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'awaiting_deposit')
        .lt('created_at', daysAgo(3))
    ),

    // A field report sitting in review is an allegation nobody has judged.
    countOrUndefined(() =>
      supabase
        .from('media_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_review')
        .lt('created_at', daysAgo(3))
    ),

    countOrUndefined(() =>
      supabase
        .from('property_verification_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'in_review'])
        .lt('created_at', daysAgo(5))
    ),
  ]);

  return [
    {
      key: 'unassigned_cases',
      label: 'Cases with no investigator',
      action: 'Assign someone, or close the case',
      href: '/app/admin/cases',
      count: unassignedCases,
      thresholdDays: 3,
      warnAt: 1,
    },
    {
      key: 'stale_kyc',
      label: 'Verifications awaiting review',
      action: 'Review the application',
      href: '/app/admin/kyc',
      count: staleKyc,
      thresholdDays: 7,
      warnAt: 1,
    },
    {
      key: 'unreleased_payouts',
      label: 'Payouts owed but not sent',
      action: 'Transfer, then record the reference',
      href: '/app/admin/payouts',
      count: unreleasedPayouts,
      thresholdDays: 0,
      warnAt: 1,
    },
    {
      key: 'awaiting_deposit',
      label: 'Engagements never funded',
      action: 'Chase the deposit, or cancel',
      href: '/app/admin/cases',
      count: awaitingDeposit,
      thresholdDays: 3,
      warnAt: 1,
    },
    {
      key: 'pending_media',
      label: 'Field reports awaiting review',
      action: 'Publish or reject',
      href: '/app/admin/media',
      count: pendingMedia,
      thresholdDays: 3,
      warnAt: 1,
    },
    {
      key: 'pending_property',
      label: 'Property checks outstanding',
      action: 'Complete the verification',
      href: '/app/admin/verifications',
      count: pendingPropertyChecks,
      thresholdDays: 5,
      warnAt: 1,
    },
  ];
}
