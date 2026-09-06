import { supabase } from '@/lib/supabase';

/**
 * Where to go tonight.
 *
 * Most reports will never become a paid engagement. Until now those people got
 * a case row and silence, which is the worst available answer for the majority
 * of everyone who touches this platform. What they need is concrete: which body
 * handles this, what to do when the demand is for a bribe, where the nearest
 * sexual assault referral centre is.
 *
 * READABLE WITHOUT AN ACCOUNT, deliberately. Somebody looking for a number at
 * two in the morning must not be asked to sign up first.
 *
 * NOTHING UNVERIFIED IS RETURNED. The seed ships inactive and `find_referrals`
 * filters on `is_active`, which an administrator sets only after checking the
 * contact details against the organisation's own published source. A wrong
 * number here is somebody in trouble dialling into silence, so the default is
 * to show nothing rather than to show something plausible.
 */

export type ReferralKind =
  | 'emergency'
  | 'police'
  | 'anti_corruption'
  | 'legal_aid'
  | 'human_rights'
  | 'medical'
  | 'shelter'
  | 'ngo'
  | 'regulator'
  | 'missing_persons';

export interface Referral {
  id: string;
  name: string;
  kind: ReferralKind;
  category: string;
  state: string;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  guidance: string | null;
  /** True when this body is in the state the caller asked about. */
  isLocal: boolean;
}

export const KIND_LABEL: Record<ReferralKind, string> = {
  emergency: 'Emergency',
  police: 'Police',
  anti_corruption: 'Anti-corruption',
  legal_aid: 'Legal aid',
  human_rights: 'Human rights',
  medical: 'Medical',
  shelter: 'Shelter and support',
  ngo: 'Support organisation',
  regulator: 'Regulator',
  missing_persons: 'Missing persons',
};

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const;

interface RawReferral {
  id: string;
  name: string;
  kind: string;
  category: string;
  state: string;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  guidance: string | null;
  is_local: boolean;
}

export async function findReferrals(options?: {
  category?: string | null;
  state?: string | null;
  limit?: number;
}): Promise<{ referrals: Referral[]; error: string | null }> {
  const { data, error } = await supabase.rpc('find_referrals', {
    p_category: options?.category ?? undefined,
    p_state: options?.state ?? undefined,
    p_limit: options?.limit ?? 20,
  });

  if (error) return { referrals: [], error: error.message };

  return {
    referrals: ((data ?? []) as RawReferral[]).map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind as ReferralKind,
      category: r.category,
      state: r.state,
      phone: r.phone ?? null,
      altPhone: r.alt_phone ?? null,
      email: r.email ?? null,
      website: r.website ?? null,
      address: r.address ?? null,
      guidance: r.guidance ?? null,
      isLocal: Boolean(r.is_local),
    })),
    error: null,
  };
}

// ── The administrator's side ────────────────────────────────────────────────

export interface UnverifiedReferral {
  id: string;
  name: string;
  kind: ReferralKind;
  category: string;
  state: string;
  phone: string | null;
  website: string | null;
  guidance: string | null;
}

interface RawUnverified {
  id: string;
  name: string;
  kind: string;
  category: string;
  state: string;
  phone: string | null;
  website: string | null;
  guidance: string | null;
}

/** Everything still waiting on a human to check its contact details. */
export async function fetchUnverifiedReferrals(): Promise<{
  referrals: UnverifiedReferral[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('admin_unverified_referrals');
  if (error) return { referrals: [], error: error.message };

  return {
    referrals: ((data ?? []) as RawUnverified[]).map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind as ReferralKind,
      category: r.category,
      state: r.state,
      phone: r.phone ?? null,
      website: r.website ?? null,
      guidance: r.guidance ?? null,
    })),
    error: null,
  };
}

/**
 * Publishes an entry, or withdraws one.
 *
 * Withdrawing clears the verification too, so an entry switched off because its
 * number turned out to be wrong cannot come back still claiming somebody
 * checked it.
 */
export async function verifyReferral(
  id: string,
  active: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_verify_referral', {
    p_id: id,
    p_active: active,
  });
  return { error: error?.message ?? null };
}

/** Editing an entry before publishing it. Admin-only via RLS. */
export async function updateReferral(
  id: string,
  fields: Partial<{
    phone: string | null;
    alt_phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    guidance: string | null;
    state: string;
    category: string;
    priority: number;
  }>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('referral_resources').update(fields).eq('id', id);
  return { error: error?.message ?? null };
}
