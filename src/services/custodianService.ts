import { supabase } from '@/lib/supabase';

/**
 * The custodian safeguard.
 *
 * A complainant nominates a verified professional and a check-in interval.
 * While they check in, nothing happens. If they stop — and stay stopped through
 * a warned grace period — the case becomes readable by that custodian. The
 * point is to invert an asymmetry: today, silencing a reporter works.
 *
 * Everything enforced here is enforced again in the database (migration 027).
 * This layer exists to make the interface honest, not to make the rules. In
 * particular it must never tell someone they are protected when they are not:
 * `pending_custodian` and `declined` both mean NO safeguard is running, and the
 * UI says so in those words rather than showing a reassuring row.
 */

export type CustodianStatus =
  | 'pending_custodian'
  | 'active'
  | 'paused'
  | 'declined'
  | 'released'
  | 'cancelled';

export interface CustodianRelease {
  id: string;
  caseId: string;
  ownerId: string;
  custodianId: string;
  noteToCustodian: string | null;
  intervalDays: number;
  graceDays: number;
  status: CustodianStatus;
  lastCheckInAt: string;
  warnedAt: string | null;
  acceptedAt: string | null;
  releasedAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface EligibleCustodian {
  userId: string;
  fullName: string;
  role: string;
  serviceArea: string | null;
}

interface RawRelease {
  id: string;
  case_id: string;
  owner_id: string;
  custodian_id: string;
  note_to_custodian: string | null;
  interval_days: number;
  grace_days: number;
  status: string;
  last_check_in_at: string;
  warned_at: string | null;
  accepted_at: string | null;
  released_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

const toRelease = (r: RawRelease): CustodianRelease => ({
  id: r.id,
  caseId: r.case_id,
  ownerId: r.owner_id,
  custodianId: r.custodian_id,
  noteToCustodian: r.note_to_custodian,
  intervalDays: r.interval_days,
  graceDays: r.grace_days,
  status: r.status as CustodianStatus,
  lastCheckInAt: r.last_check_in_at,
  warnedAt: r.warned_at,
  acceptedAt: r.accepted_at,
  releasedAt: r.released_at,
  acknowledgedAt: r.acknowledged_at,
  createdAt: r.created_at,
});

/** The arrangement on one case, if there is one. */
export async function fetchCaseCustodianRelease(
  caseId: string
): Promise<{ release: CustodianRelease | null; error: string | null }> {
  const { data, error } = await supabase
    .from('custodian_releases')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle();

  if (error) return { release: null, error: error.message };
  return { release: data ? toRelease(data as RawRelease) : null, error: null };
}

/** Everything nominating this account, for the custodian's own inbox. */
export async function fetchMyCustodianships(
  userId: string
): Promise<{ releases: CustodianRelease[]; error: string | null }> {
  const { data, error } = await supabase
    .from('custodian_releases')
    .select('*')
    .eq('custodian_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { releases: [], error: error.message };
  return { releases: ((data ?? []) as RawRelease[]).map(toRelease), error: null };
}

/** Everything this account has arranged, so one screen carries every deadline. */
export async function fetchMySafeguards(
  userId: string
): Promise<{ releases: CustodianRelease[]; error: string | null }> {
  const { data, error } = await supabase
    .from('custodian_releases')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { releases: [], error: error.message };
  return { releases: ((data ?? []) as RawRelease[]).map(toRelease), error: null };
}

interface RawCustodian {
  user_id: string;
  full_name: string;
  role: string;
  service_area: string | null;
}

export async function fetchEligibleCustodians(): Promise<{
  custodians: EligibleCustodian[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('eligible_custodians');
  if (error) return { custodians: [], error: error.message };

  return {
    custodians: ((data ?? []) as RawCustodian[]).map((r) => ({
      userId: r.user_id,
      fullName: r.full_name,
      role: r.role,
      serviceArea: r.service_area ?? null,
    })),
    error: null,
  };
}

export async function createCustodianRelease(input: {
  caseId: string;
  custodianId: string;
  intervalDays?: number;
  graceDays?: number;
  note?: string;
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_custodian_release', {
    p_case_id: input.caseId,
    p_custodian_id: input.custodianId,
    p_interval_days: input.intervalDays ?? 14,
    p_grace_days: input.graceDays ?? 3,
    p_note: input.note,
  });

  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}

/**
 * The whole mechanism, from the owner's side.
 *
 * With no id this checks in on everything at once. Someone with three
 * arrangements should not have to remember three deadlines, and forgetting one
 * is exactly the failure that turns into a disclosure.
 */
export async function checkIn(
  releaseId?: string
): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase.rpc('custodian_check_in', {
    p_id: releaseId,
  });
  if (error) return { count: 0, error: error.message };
  return { count: (data as number) ?? 0, error: null };
}

export async function setReleaseStatus(
  releaseId: string,
  status: 'active' | 'paused' | 'cancelled'
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_custodian_release_status', {
    p_id: releaseId,
    p_status: status,
  });
  return { error: error?.message ?? null };
}

export async function respondToRequest(
  releaseId: string,
  accept: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('respond_to_custodian_request', {
    p_id: releaseId,
    p_accept: accept,
  });
  return { error: error?.message ?? null };
}

export async function acknowledgeRelease(
  releaseId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('acknowledge_custodian_release', {
    p_id: releaseId,
  });
  return { error: error?.message ?? null };
}

/**
 * When the next check-in is due, and how much room is left.
 *
 * `dueAt` is the deadline. `releasesAt` is when disclosure actually happens,
 * which is grace measured FROM THE WARNING — so it only exists once a warning
 * has been sent. Showing a release date before then would be a guess presented
 * as a fact, on the one screen where that is least acceptable.
 */
export function releaseSchedule(r: CustodianRelease): {
  dueAt: Date;
  releasesAt: Date | null;
  overdue: boolean;
  hoursLeft: number;
} {
  const dueAt = new Date(
    new Date(r.lastCheckInAt).getTime() + r.intervalDays * 86_400_000
  );
  const releasesAt = r.warnedAt
    ? new Date(new Date(r.warnedAt).getTime() + r.graceDays * 86_400_000)
    : null;

  const target = releasesAt ?? dueAt;
  return {
    dueAt,
    releasesAt,
    overdue: Date.now() > dueAt.getTime(),
    hoursLeft: Math.round((target.getTime() - Date.now()) / 3_600_000),
  };
}

/** Whether a safeguard is actually running. Only `active` is. */
export function isProtecting(r: CustodianRelease | null): boolean {
  return r?.status === 'active';
}
