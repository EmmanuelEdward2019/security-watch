import { supabase } from '@/lib/supabase';
import type {
  DashboardStats,
  MonthlyTrend,
  Profile,
  UserRole,
  KycStatus,
  AccountDeletionRequest,
  ContactMessage,
  ContactMessageStatus,
  SecurityServiceRequest,
  ServicePrice,
  PropertyVerificationRequest,
  InstitutionRanking,
  ActivityEntry,
} from '@/types';

/**
 * Administrative operations.
 *
 * Two things changed here structurally:
 *
 *   * Dashboard figures come from SQL aggregates rather than `select('*')` over
 *     whole tables. The admin pages used to pull every profile, case, property,
 *     payment and media row into the browser to render a handful of counts,
 *     which shipped everyone's personal data to the client and fell over in the
 *     low thousands of rows.
 *
 *   * Privileged writes go through RPCs. Roles, verification statuses, property
 *     badges and publication flags are pinned by database triggers, so a direct
 *     UPDATE would be silently reverted and logged as an escalation attempt.
 */

// =============================================================================
// Dashboard and analytics
// =============================================================================

export async function fetchPlatformStats(): Promise<{
  stats: DashboardStats | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('admin_platform_stats');
  if (error) return { stats: null, error: error.message };
  return { stats: data as DashboardStats, error: null };
}

export async function fetchMonthlyTrends(
  months = 6
): Promise<{ trends: MonthlyTrend[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_monthly_trends', { p_months: months });
  if (error) return { trends: [], error: error.message };

  const trends = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    month: new Date(row.month as string).toLocaleDateString('en-NG', {
      month: 'short',
      year: '2-digit',
    }),
    cases: Number(row.cases ?? 0),
    users: Number(row.users ?? 0),
    properties: Number(row.properties ?? 0),
    media: Number(row.media ?? 0),
    revenue: Number(row.revenue ?? 0),
  }));

  return { trends, error: null };
}

// =============================================================================
// Users
// =============================================================================

export interface UserListFilters {
  role?: UserRole;
  kycStatus?: KycStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function fetchUsers(
  filters: UserListFilters = {}
): Promise<{ users: Profile[]; total: number; error: string | null }> {
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.role) query = query.eq('role', filters.role);
  if (filters.kycStatus) query = query.eq('kyc_status', filters.kycStatus);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term}`);
  }

  const limit = filters.limit ?? 25;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return { users: [], total: 0, error: error.message };
  return { users: (data ?? []) as Profile[], total: count ?? 0, error: null };
}

/**
 * Changes a user's role.
 *
 * Goes through an RPC because `profiles.role` is pinned by a trigger — a direct
 * UPDATE is reverted and recorded as a guard violation. The RPC also refuses to
 * demote the last remaining administrator.
 */
export async function setUserRole(
  userId: string,
  role: UserRole
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_set_user_role', {
    p_user_id: userId,
    p_role: role,
  });
  return { error: error?.message ?? null };
}

export async function setKycStatus(
  userId: string,
  status: KycStatus
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_set_kyc_status', {
    p_user_id: userId,
    p_status: status,
  });
  return { error: error?.message ?? null };
}

/** Users who asked for a privileged role at signup and are awaiting review. */
export async function fetchPendingRoleRequests(): Promise<{
  users: Profile[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .not('requested_role', 'is', null)
    .neq('requested_role', 'complainant')
    .is('role_confirmed_at', null)
    .order('created_at', { ascending: false });

  if (error) return { users: [], error: error.message };
  return { users: (data ?? []) as Profile[], error: null };
}

// =============================================================================
// Verification queues
// =============================================================================

export async function reviewInvestigator(
  investigatorId: string,
  status: 'approved' | 'rejected' | 'pending',
  notes?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_review_investigator', {
    p_investigator_id: investigatorId,
    p_status: status,
    p_notes: notes ?? null,
  });
  return { error: error?.message ?? null };
}

export async function reviewGuarantor(
  guarantorId: string,
  status: 'approved' | 'rejected' | 'pending'
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_review_guarantor', {
    p_guarantor_id: guarantorId,
    p_status: status,
  });
  return { error: error?.message ?? null };
}

export async function setPropertyStatus(
  propertyId: string,
  status: 'unverified' | 'pending' | 'verified'
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_set_property_status', {
    p_property_id: propertyId,
    p_status: status,
    p_verify_documents: status === 'verified',
  });
  return { error: error?.message ?? null };
}

export async function reviewMediaReport(
  reportId: string,
  status: 'approved' | 'rejected' | 'published' | 'pending_review',
  note?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_review_media_report', {
    p_report_id: reportId,
    p_status: status,
    p_note: note ?? null,
  });
  return { error: error?.message ?? null };
}

export async function fetchVerificationRequests(): Promise<{
  requests: PropertyVerificationRequest[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('property_verification_requests')
    .select('*, property:properties(*), requester:profiles!requester_id(*)')
    .order('created_at', { ascending: false });

  if (error) return { requests: [], error: error.message };
  return { requests: (data ?? []) as PropertyVerificationRequest[], error: null };
}

export async function resolveVerificationRequest(
  requestId: string,
  status: PropertyVerificationRequest['status'],
  notes?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_resolve_verification_request', {
    p_request_id: requestId,
    p_status: status,
    p_notes: notes ?? null,
  });
  return { error: error?.message ?? null };
}

// =============================================================================
// Pricing
// =============================================================================

export async function fetchAllServicePrices(): Promise<{
  prices: ServicePrice[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('service_prices')
    .select('*')
    .order('module')
    .order('sort_order');

  if (error) return { prices: [], error: error.message };
  return { prices: (data ?? []) as ServicePrice[], error: null };
}

/**
 * Updates a price. Changes are audited — an admin altering what people are
 * charged is a `warning`-severity event.
 */
export async function updateServicePrice(
  id: string,
  updates: Partial<Pick<ServicePrice, 'amount' | 'currency' | 'label' | 'description' | 'unit' | 'is_active'>>
): Promise<{ error: string | null }> {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('service_prices')
    .update({ ...updates, updated_by: session?.user?.id ?? null })
    .eq('id', id);
  return { error: error?.message ?? null };
}

// =============================================================================
// Account deletion queue
// =============================================================================

export async function fetchDeletionRequests(): Promise<{
  requests: AccountDeletionRequest[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .order('requested_at', { ascending: false });

  if (error) return { requests: [], error: error.message };
  return { requests: (data ?? []) as AccountDeletionRequest[], error: null };
}

/**
 * Approves or declines an erasure request.
 *
 * Approval runs in an edge function because deleting the auth user needs the
 * Auth admin API. It refuses while the account is still on an open case, and
 * anonymises records the platform must retain (filed evidence, completed
 * payments) rather than destroying case history.
 */
export async function processDeletionRequest(
  requestId: string,
  action: 'approve' | 'reject',
  notes?: string
): Promise<{ error: string | null; retainedEvidence?: number }> {
  const { data, error } = await supabase.functions.invoke('admin-process-deletion', {
    body: { requestId, action, notes },
  });

  if (error) {
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) message = body.error as string;
      } catch {
        /* keep transport message */
      }
    }
    return { error: message };
  }

  const result = data as { retainedEvidence?: number };
  return { error: null, retainedEvidence: result?.retainedEvidence };
}

// =============================================================================
// Inbound enquiries
// =============================================================================

export async function fetchContactMessages(): Promise<{
  messages: ContactMessage[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { messages: [], error: error.message };
  return { messages: (data ?? []) as ContactMessage[], error: null };
}

export async function updateContactMessage(
  id: string,
  updates: { status?: ContactMessageStatus; admin_notes?: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('contact_messages').update(updates).eq('id', id);
  return { error: error?.message ?? null };
}

export async function fetchSecurityServiceRequests(): Promise<{
  requests: SecurityServiceRequest[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('security_service_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { requests: [], error: error.message };
  return { requests: (data ?? []) as SecurityServiceRequest[], error: null };
}

export async function updateSecurityServiceRequest(
  id: string,
  updates: { status?: SecurityServiceRequest['status']; admin_notes?: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('security_service_requests').update(updates).eq('id', id);
  return { error: error?.message ?? null };
}

// =============================================================================
// Institutions and activity
// =============================================================================

/** Institution league table, aggregated in SQL. Public — used by the archive. */
export async function fetchInstitutionRankings(): Promise<{
  rankings: InstitutionRanking[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('institution_rankings');
  if (error) return { rankings: [], error: error.message };

  const rankings = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    institution_id: r.institution_id as string,
    name: r.name as string,
    type: r.type as InstitutionRanking['type'],
    location: r.location as string,
    avg_score: Number(r.avg_score ?? 0),
    evaluations: Number(r.evaluations ?? 0),
    published_reports: Number(r.published_reports ?? 0),
  }));

  return { rankings, error: null };
}

/** The signed-in user's own activity feed, built from their real records. */
export async function fetchMyActivity(
  limit = 50
): Promise<{ entries: ActivityEntry[]; error: string | null }> {
  const { data, error } = await supabase.rpc('my_activity', { p_limit: limit });
  if (error) return { entries: [], error: error.message };

  const entries = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    kind: r.kind as ActivityEntry['kind'],
    title: r.title as string,
    detail: (r.detail as string) ?? null,
    status: r.status as string,
    occurred_at: r.occurred_at as string,
  }));

  return { entries, error: null };
}
