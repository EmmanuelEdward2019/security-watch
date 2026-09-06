import { supabase } from '@/lib/supabase';

/**
 * What actually happened.
 *
 * `cases.status` ended at 'completed' or 'closed', which made a conviction and
 * an abandoned file indistinguishable in the record. That left the platform
 * unable to answer the only question that matters to somebody deciding whether
 * to report at all: does this work?
 *
 * The aggregates are the civic dividend. Which commands resolve matters, how
 * long they take, and which categories go nowhere is what turns a service into
 * an accountability institution.
 *
 * TWO THINGS THE PUBLIC FUNCTIONS DO THAT THE ADMIN ONES DO NOT: they suppress
 * any group below five cases, because "one murder case in Bayelsa, unresolved"
 * is a person and not a statistic; and they name institutions only from the
 * curated table, never from the free-text field, because somebody will
 * eventually type an officer's name into it.
 */

export type CaseOutcome =
  | 'resolved'
  | 'referred_accepted'
  | 'referred_refused'
  | 'prosecution_commenced'
  | 'conviction'
  | 'acquittal'
  | 'withdrawn'
  | 'no_action_possible'
  | 'stalled'
  | 'duplicate';

export const OUTCOME_LABEL: Record<CaseOutcome, string> = {
  resolved: 'Resolved',
  referred_accepted: 'Referred — accepted',
  referred_refused: 'Referred — refused or ignored',
  prosecution_commenced: 'Prosecution commenced',
  conviction: 'Conviction',
  acquittal: 'Acquittal',
  withdrawn: 'Withdrawn by complainant',
  no_action_possible: 'No action possible',
  stalled: 'Stalled',
  duplicate: 'Duplicate',
};

/**
 * What each outcome means, in the words the person recording it needs.
 *
 * `referred_refused` carries the longest note on purpose. It is the failure the
 * platform exists to make visible, and the temptation is to record it as
 * "stalled" — which is vaguer, kinder, and useless.
 */
export const OUTCOME_HELP: Record<CaseOutcome, string> = {
  resolved: 'The matter was settled to the complainant’s satisfaction.',
  referred_accepted: 'Handed to the police or another agency, and they took it on.',
  referred_refused:
    'Handed over and refused, or never acknowledged. Record it here rather than as stalled — this is the outcome the platform exists to make visible.',
  prosecution_commenced: 'A charge was actually laid.',
  conviction: 'The matter went to court and ended in a conviction.',
  acquittal: 'The matter went to court and ended in an acquittal.',
  withdrawn: 'The complainant chose to stop.',
  no_action_possible: 'Everything available was tried and nothing could be done.',
  stalled: 'Still open, nothing moving. Honest, and better than leaving it blank.',
  duplicate: 'The same incident is already recorded on another case.',
};

export const POSITIVE_OUTCOMES: CaseOutcome[] = [
  'resolved',
  'conviction',
  'prosecution_commenced',
  'referred_accepted',
];

export async function recordOutcome(input: {
  caseId: string;
  outcome: CaseOutcome;
  note?: string | null;
  institution?: string | null;
  state?: string | null;
  institutionId?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('record_case_outcome', {
    p_case_id: input.caseId,
    p_outcome: input.outcome,
    p_note: input.note ?? undefined,
    p_institution: input.institution ?? undefined,
    p_state: input.state ?? undefined,
    p_institution_id: input.institutionId ?? undefined,
  });
  return { error: error?.message ?? null };
}

interface RawLedger {
  category: string;
  outcome: string;
  cases: number;
  median_days: number | null;
  institutions: number;
}

interface RawScorecard {
  institution: string;
  state: string | null;
  cases: number;
  accepted: number;
  refused: number;
  resolved?: number;
  median_days: number | null;
}

interface RawPublicOutcome {
  category: string;
  cases: number;
  resolved: number;
  referred_out: number;
  no_action: number;
  still_open: number;
  median_days: number | null;
}

// ── Administrator ledgers ───────────────────────────────────────────────────

export interface OutcomeLedgerRow {
  category: string;
  /** 'not_recorded' for cases nobody has answered for yet. */
  outcome: string;
  cases: number;
  medianDays: number | null;
  institutions: number;
}

export async function fetchOutcomeLedger(
  days = 365
): Promise<{ rows: OutcomeLedgerRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_outcome_ledger', { p_days: days });
  if (error) return { rows: [], error: error.message };

  return {
    rows: ((data ?? []) as RawLedger[]).map((r) => ({
      category: r.category,
      outcome: r.outcome,
      cases: r.cases ?? 0,
      medianDays: r.median_days ?? null,
      institutions: r.institutions ?? 0,
    })),
    error: null,
  };
}

export interface ScorecardRow {
  institution: string;
  state: string | null;
  cases: number;
  accepted: number;
  refused: number;
  resolved?: number;
  medianDays: number | null;
}

export async function fetchInstitutionScorecard(
  days = 365
): Promise<{ rows: ScorecardRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_institution_scorecard', {
    p_days: days,
  });
  if (error) return { rows: [], error: error.message };

  return {
    rows: ((data ?? []) as RawScorecard[]).map((r) => ({
      institution: r.institution,
      state: r.state ?? null,
      cases: r.cases ?? 0,
      accepted: r.accepted ?? 0,
      refused: r.refused ?? 0,
      resolved: r.resolved ?? 0,
      medianDays: r.median_days ?? null,
    })),
    error: null,
  };
}

// ── Published figures ───────────────────────────────────────────────────────

export interface PublicOutcomeRow {
  category: string;
  cases: number;
  resolved: number;
  referredOut: number;
  noAction: number;
  stillOpen: number;
  medianDays: number | null;
}

export async function fetchPublicOutcomes(
  months = 12
): Promise<{ rows: PublicOutcomeRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('public_outcome_summary', {
    p_months: months,
  });
  if (error) return { rows: [], error: error.message };

  return {
    rows: ((data ?? []) as RawPublicOutcome[]).map((r) => ({
      category: r.category,
      cases: r.cases ?? 0,
      resolved: r.resolved ?? 0,
      referredOut: r.referred_out ?? 0,
      noAction: r.no_action ?? 0,
      stillOpen: r.still_open ?? 0,
      medianDays: r.median_days ?? null,
    })),
    error: null,
  };
}

export async function fetchPublicScorecard(
  months = 12
): Promise<{ rows: ScorecardRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('public_institution_scorecard', {
    p_months: months,
  });
  if (error) return { rows: [], error: error.message };

  return {
    rows: ((data ?? []) as RawScorecard[]).map((r) => ({
      institution: r.institution,
      state: r.state ?? null,
      cases: r.cases ?? 0,
      accepted: r.accepted ?? 0,
      refused: r.refused ?? 0,
      medianDays: r.median_days ?? null,
    })),
    error: null,
  };
}

/**
 * The suppression floor, mirrored from the database so the interface can
 * explain an empty table rather than looking broken.
 *
 * If this and `tsw_min_cell()` ever disagree the page is merely wrong about
 * its own footnote — the database still decides what is published, which is
 * the correct place for that decision to live.
 */
export const MIN_PUBLISHED_CELL = 5;
