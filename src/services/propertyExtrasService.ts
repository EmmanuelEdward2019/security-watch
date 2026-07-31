import { supabase } from '@/lib/supabase';
import type {
  SavedProperty,
  PropertyVerificationRequest,
  LandlordTransaction,
  EarningRecord,
  PropertyRequest,
  BlogPost,
} from '@/types';

/**
 * The property and content features that shipped as hardcoded arrays: saved
 * listings, tenant verification requests, the landlord ledger, payee earnings,
 * and the newsroom.
 */

// =============================================================================
// Saved properties
// =============================================================================

export async function fetchSavedProperties(
  userId: string
): Promise<{ saved: SavedProperty[]; error: string | null }> {
  const { data, error } = await supabase
    .from('saved_properties')
    .select('*, property:properties(*, owner:profiles!owner_id(full_name, avatar_url))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { saved: [], error: error.message };
  return { saved: (data ?? []) as SavedProperty[], error: null };
}

export async function saveProperty(
  userId: string,
  propertyId: string,
  notes?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('saved_properties')
    .upsert(
      { user_id: userId, property_id: propertyId, notes: notes ?? null },
      { onConflict: 'user_id,property_id' }
    );
  return { error: error?.message ?? null };
}

export async function unsaveProperty(
  userId: string,
  propertyId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('saved_properties')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId);
  return { error: error?.message ?? null };
}

/** Which of these property ids the user has saved — for filling in heart icons. */
export async function fetchSavedPropertyIds(
  userId: string,
  propertyIds: string[]
): Promise<Set<string>> {
  if (propertyIds.length === 0) return new Set();

  const { data } = await supabase
    .from('saved_properties')
    .select('property_id')
    .eq('user_id', userId)
    .in('property_id', propertyIds);

  return new Set((data ?? []).map((r) => r.property_id as string));
}

// =============================================================================
// Verification requests (tenant side)
// =============================================================================

export async function fetchMyVerificationRequests(
  userId: string
): Promise<{ requests: PropertyVerificationRequest[]; error: string | null }> {
  const { data, error } = await supabase
    .from('property_verification_requests')
    .select('*, property:properties(*)')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { requests: [], error: error.message };
  return { requests: (data ?? []) as PropertyVerificationRequest[], error: null };
}

/**
 * Raises a verification request. It sits at `pending` until the verification fee
 * is paid — the payments webhook moves it to `in_review`, so the queue can never
 * be entered without a settled payment.
 */
export async function requestPropertyVerification(
  userId: string,
  propertyId: string,
  reason?: string
): Promise<{ id: string | null; error: string | null }> {
  const { data: existing } = await supabase
    .from('property_verification_requests')
    .select('id, status')
    .eq('requester_id', userId)
    .eq('property_id', propertyId)
    .not('status', 'in', '("cancelled","failed")')
    .maybeSingle();

  if (existing) {
    return { id: existing.id as string, error: null };
  }

  const { data, error } = await supabase
    .from('property_verification_requests')
    .insert({ requester_id: userId, property_id: propertyId, reason: reason ?? null })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function cancelVerificationRequest(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('property_verification_requests')
    .update({ status: 'cancelled' })
    .eq('id', id);
  return { error: error?.message ?? null };
}

// =============================================================================
// Landlord ledger and payee earnings
// =============================================================================

export async function fetchLandlordTransactions(): Promise<{
  transactions: LandlordTransaction[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('landlord_transactions');
  if (error) return { transactions: [], error: error.message };

  const transactions = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    payment_id: r.payment_id as string,
    property_id: r.property_id as string,
    property_title: r.property_title as string,
    counterparty_name: (r.counterparty_name as string) ?? null,
    amount: Number(r.amount ?? 0),
    currency: r.currency as string,
    status: r.status as LandlordTransaction['status'],
    purpose: (r.purpose as string) ?? null,
    reference: (r.reference as string) ?? null,
    created_at: r.created_at as string,
  }));

  return { transactions, error: null };
}

export async function fetchMyEarnings(): Promise<{
  earnings: EarningRecord[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('my_earnings');
  if (error) return { earnings: [], error: error.message };

  const earnings = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    payment_id: r.payment_id as string,
    case_id: r.case_id as string,
    case_title: r.case_title as string,
    amount: Number(r.amount ?? 0),
    currency: r.currency as string,
    status: r.status as EarningRecord['status'],
    purpose: (r.purpose as string) ?? null,
    created_at: r.created_at as string,
  }));

  return { earnings, error: null };
}

// =============================================================================
// Tenant enquiries on a landlord's listings
// =============================================================================

export async function fetchTenantRequestsForOwner(): Promise<{
  requests: PropertyRequest[];
  error: string | null;
}> {
  // RLS restricts this to requests on properties the caller owns, so no
  // explicit owner filter is needed.
  const { data, error } = await supabase
    .from('property_requests')
    .select('*, requester:profiles!requester_id(*), property:properties(*)')
    .order('created_at', { ascending: false });

  if (error) return { requests: [], error: error.message };
  return { requests: (data ?? []) as PropertyRequest[], error: null };
}

export async function respondToPropertyRequest(
  id: string,
  status: 'accepted' | 'rejected'
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('property_requests').update({ status }).eq('id', id);
  return { error: error?.message ?? null };
}

// =============================================================================
// Newsroom
// =============================================================================

export async function fetchBlogPosts(options?: {
  category?: string;
  limit?: number;
}): Promise<{ posts: BlogPost[]; error: string | null }> {
  let query = supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (options?.category && options.category !== 'all') {
    query = query.eq('category', options.category);
  }
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) return { posts: [], error: error.message };
  return { posts: (data ?? []) as BlogPost[], error: null };
}

export async function fetchBlogPost(
  slug: string
): Promise<{ post: BlogPost | null; error: string | null }> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) return { post: null, error: error.message };
  return { post: (data as BlogPost) ?? null, error: null };
}

// =============================================================================
// Public enquiry forms
// =============================================================================

export interface EnquiryInput {
  kind: 'security_service' | 'contact';
  fullName: string;
  email: string;
  phone?: string;
  companyName?: string;
  serviceType?: string;
  location?: string;
  subject?: string;
  message: string;
}

/**
 * Submits one of the two public forms.
 *
 * The edge function owns the insert, the confirmation email and the admin
 * notification. Keeping it server-side is what lets the notification email
 * function refuse anonymous callers entirely — the recipient here is always the
 * address that was just recorded, so it cannot be turned into a mail relay.
 */
export async function submitPublicEnquiry(
  input: EnquiryInput
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('public-enquiry', {
    body: input,
  });

  if (error) {
    let message = 'We could not send that. Please try again.';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) message = body.error as string;
      } catch {
        /* keep the friendly default */
      }
    }
    return { error: message };
  }

  const result = data as { error?: string };
  return { error: result?.error ?? null };
}
