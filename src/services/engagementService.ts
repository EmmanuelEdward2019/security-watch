import { supabase } from '@/lib/supabase';

/**
 * Engagements and payouts.
 *
 * An engagement is a named professional booked against a case at a catalogue
 * price. The complainant pays a deposit to mobilise them; The Security Watch
 * holds it and releases the professional's share against the payout ledger,
 * keeping its commission.
 *
 * Every write goes through a SECURITY DEFINER RPC. The tables refuse client
 * inserts outright — an engagement a client could create is an engagement a
 * client could price, and a ledger row a client could write is money they
 * could award themselves.
 */

export interface BookableService {
  key: string;
  label: string;
  amount: number;
  currency: string;
  commission_rate: number;
}

export interface CaseEngagement {
  id: string;
  case_id: string;
  professional_id: string;
  professional_role: 'investigator' | 'lawyer' | 'medical_expert';
  service_key: string;
  currency: string;
  total_amount: number;
  commission_rate: number;
  commission_amount: number;
  professional_amount: number;
  deposit_rate: number;
  deposit_amount: number;
  deposit_paid_at: string | null;
  status: 'awaiting_deposit' | 'funded' | 'in_progress' | 'completed' | 'cancelled';
  note: string | null;
  created_at: string;
  professional?: { full_name: string | null; email: string | null } | null;
}

export interface PayoutRow {
  id: string;
  engagement_id: string;
  professional_id: string;
  amount: number;
  currency: string;
  reason: 'deposit_share' | 'balance_share' | 'adjustment';
  status: 'accrued' | 'approved' | 'released' | 'cancelled';
  transfer_reference: string | null;
  released_at: string | null;
  created_at: string;
  professional?: { full_name: string | null; email: string | null } | null;
}

/**
 * Services that can actually fund an engagement.
 *
 * Filters on `is_platform_fee`, which is the same rule the RPC enforces. The
 * filing fee and the platform's own services are excluded: offering them here
 * would let an administrator book a professional against money that is not
 * theirs, and the RPC would then reject it with an error the admin could do
 * nothing about.
 */
export async function fetchBookableServices(): Promise<{
  services: BookableService[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('service_prices')
    .select('key, label, amount, currency, commission_rate')
    .eq('is_active', true)
    .eq('is_platform_fee', false)
    .order('amount');

  if (error) return { services: [], error: error.message };

  return {
    services: (data ?? []).map((r) => ({
      key: String(r.key),
      label: String(r.label),
      amount: Number(r.amount),
      currency: String(r.currency),
      commission_rate: Number(r.commission_rate),
    })),
    error: null,
  };
}

export async function fetchCaseEngagements(
  caseId: string
): Promise<{ engagements: CaseEngagement[]; error: string | null }> {
  const { data, error } = await supabase
    .from('case_engagements')
    .select('*, professional:profiles!professional_id(full_name, email)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) return { engagements: [], error: error.message };
  return { engagements: (data ?? []) as unknown as CaseEngagement[], error: null };
}

export async function createEngagement(input: {
  caseId: string;
  professionalId: string;
  role: 'investigator' | 'lawyer' | 'medical_expert';
  serviceKey: string;
  depositRate?: number;
  note?: string;
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_create_engagement', {
    p_case_id: input.caseId,
    p_professional_id: input.professionalId,
    p_role: input.role,
    p_service_key: input.serviceKey,
    p_deposit_rate: input.depositRate ?? 0.5,
    p_note: input.note ?? undefined,
  });

  // The RPC's exceptions are written to be shown to people — "that professional
  // has not completed verification", "that fee belongs to the platform".
  return { id: (data as string | null) ?? null, error: error?.message ?? null };
}

/** Everything owed, newest first. Admin-only by RLS. */
export async function fetchPayoutQueue(
  status?: PayoutRow['status']
): Promise<{ payouts: PayoutRow[]; error: string | null }> {
  let query = supabase
    .from('payout_ledger')
    .select('*, professional:profiles!professional_id(full_name, email)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return { payouts: [], error: error.message };
  return { payouts: (data ?? []) as unknown as PayoutRow[], error: null };
}

/**
 * Records that a payout has been sent.
 *
 * The reference is mandatory, enforced both here and by a CHECK on the table.
 * Marking money as paid without one is not a record — it is an assertion
 * nobody can verify later, on a table whose whole purpose is being verifiable.
 */
export async function releasePayout(
  ledgerId: string,
  reference: string,
  note?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_release_payout', {
    p_ledger_id: ledgerId,
    p_reference: reference,
    p_note: note ?? undefined,
  });

  return { error: error?.message ?? null };
}

export interface BookableProfessional {
  user_id: string;
  full_name: string;
  email: string | null;
  role: 'investigator' | 'lawyer' | 'medical_expert';
  /** True once they have somewhere for a payout to go. */
  has_payout_account: boolean;
}

/**
 * Professionals who can be booked in a given role.
 *
 * Sourced from `profiles`, matching the authority `admin_create_engagement`
 * checks — role and kyc_status. Reading `investigators` instead would miss
 * anyone holding the role without a professional application on file, which is
 * a real state on this platform and the exact bug that made the assign modal
 * claim no investigator existed when one did.
 *
 * `has_payout_account` is surfaced so an administrator knows before booking
 * that a payout will have nowhere to go. It is deliberately not a blocker:
 * the work can be agreed now and the bank details added before the money moves.
 */
export async function listBookableProfessionals(
  role: BookableProfessional['role']
): Promise<{ professionals: BookableProfessional[]; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, role, payout:payout_accounts(user_id)')
    .eq('role', role)
    .eq('kyc_status', 'approved')
    .order('full_name');

  if (error) return { professionals: [], error: error.message };

  return {
    professionals: (data ?? []).map((r) => {
      const raw = (r as Record<string, unknown>).payout;
      const payout = Array.isArray(raw) ? raw[0] : raw;

      return {
        user_id: String(r.user_id),
        full_name: String(r.full_name ?? 'Unnamed'),
        email: (r.email as string) ?? null,
        role,
        has_payout_account: payout != null,
      };
    }),
    error: null,
  };
}

/** The split an engagement would create, computed the same way the RPC does. */
export function previewSplit(service: BookableService, depositRate: number) {
  // round() to 2dp on the commission, then subtract — matching the SQL exactly,
  // so what the administrator is shown is what gets written.
  const commission = Math.round(service.amount * service.commission_rate * 100) / 100;
  const professional = service.amount - commission;
  const deposit = Math.round(service.amount * depositRate * 100) / 100;
  const depositProfessionalShare =
    Math.round(deposit * (1 - service.commission_rate) * 100) / 100;

  return { commission, professional, deposit, depositProfessionalShare };
}
