import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

/**
 * The role-specific dashboard figures.
 *
 * These were hardcoded. Four of them rendered a literal `0`, which is not a
 * placeholder but a false statement — a landlord with pending tenant requests
 * was shown "0", and so was a tenant with saved properties. Everything here is
 * now read from the tables and RPCs that have existed since migrations 005 and
 * 013; this was only ever missing wiring.
 *
 * `undefined` means "not loaded or not applicable" and renders as a dash. That
 * distinction is the whole point: a dash says we do not know, a zero says we
 * do. Only a real count returns 0.
 */
export interface DashboardExtras {
  /** Investigator, lawyer, expert: money not yet paid out. */
  pendingEarnings?: number;
  /** Investigator, lawyer, expert: money received. */
  paidEarnings?: number;
  currency?: string;
  /** Medical expert: analyses still open. */
  pendingAnalyses?: number;
  /** Landlord: verification requests raised against their properties. */
  tenantRequests?: number;
  /** Landlord: value of completed transactions. */
  revenue?: number;
  /** Tenant: saved property count. */
  savedProperties?: number;
  /** Tenant: their own verification requests still in flight. */
  myRequests?: number;
}

interface EarningsRow {
  amount: number | string | null;
  currency: string | null;
  status: string | null;
}

interface TransactionRow {
  amount: number | string | null;
  status: string | null;
}

const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;

/**
 * Fetches only what the role's dashboard actually shows.
 *
 * Counts use `head: true` so Postgres returns the count without the rows —
 * a landlord with hundreds of requests should not download them to render one
 * number.
 *
 * Each figure resolves independently and a failure leaves that one `undefined`
 * rather than rejecting the whole call. One unavailable number should show a
 * dash, not blank the entire overview.
 */
export async function fetchDashboardExtras(
  userId: string,
  role: UserRole
): Promise<DashboardExtras> {
  const out: DashboardExtras = {};

  const settle = async (task: () => Promise<void>) => {
    try {
      await task();
    } catch {
      /* leave the figure undefined — it renders as a dash */
    }
  };

  const jobs: Array<Promise<void>> = [];

  if (role === 'investigator' || role === 'lawyer' || role === 'medical_expert') {
    jobs.push(
      settle(async () => {
        const { data, error } = await supabase.rpc('my_earnings');
        if (error) throw error;

        const rows = (data ?? []) as EarningsRow[];
        // `payments.status` is pending | completed | failed | refunded.
        // Only completed money has actually arrived; only pending is still
        // coming. Failed and refunded are neither, so they are excluded rather
        // than quietly inflating one of the two.
        out.paidEarnings = rows
          .filter((r) => r.status === 'completed')
          .reduce((sum, r) => sum + num(r.amount), 0);
        out.pendingEarnings = rows
          .filter((r) => r.status === 'pending')
          .reduce((sum, r) => sum + num(r.amount), 0);
        out.currency = rows.find((r) => r.currency)?.currency ?? 'NGN';
      })
    );
  }

  if (role === 'medical_expert') {
    jobs.push(
      settle(async () => {
        // 'finalised' and 'completed' are done; 'in_progress' and
        // 'peer_review' still need this expert.
        const { count, error } = await supabase
          .from('forensic_analyses')
          .select('id', { count: 'exact', head: true })
          .eq('expert_id', userId)
          .in('status', ['in_progress', 'peer_review']);
        if (error) throw error;
        out.pendingAnalyses = count ?? 0;
      })
    );
  }

  if (role === 'landlord') {
    jobs.push(
      settle(async () => {
        // Requests raised against properties this landlord owns. The inner
        // join is what scopes it to them — RLS permits reading a request, so
        // without the owner filter this would count the whole platform's.
        const { count, error } = await supabase
          .from('property_verification_requests')
          .select('id, property:properties!inner(owner_id)', { count: 'exact', head: true })
          .eq('property.owner_id', userId)
          .in('status', ['pending', 'in_review']);
        if (error) throw error;
        out.tenantRequests = count ?? 0;
      })
    );

    jobs.push(
      settle(async () => {
        const { data, error } = await supabase.rpc('landlord_transactions');
        if (error) throw error;
        out.revenue = ((data ?? []) as TransactionRow[])
          .filter((r) => r.status === 'completed')
          .reduce((sum, r) => sum + num(r.amount), 0);
      })
    );
  }

  if (role === 'tenant') {
    jobs.push(
      settle(async () => {
        const { count, error } = await supabase
          .from('saved_properties')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);
        if (error) throw error;
        out.savedProperties = count ?? 0;
      })
    );

    jobs.push(
      settle(async () => {
        const { count, error } = await supabase
          .from('property_verification_requests')
          .select('id', { count: 'exact', head: true })
          .eq('requester_id', userId)
          .in('status', ['pending', 'in_review']);
        if (error) throw error;
        out.myRequests = count ?? 0;
      })
    );
  }

  await Promise.all(jobs);
  return out;
}
