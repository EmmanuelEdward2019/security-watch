import { supabase } from '@/lib/supabase';
import type { InvestigatorMatch } from '@/types';

/**
 * Investigator matching and institution reports.
 *
 * Both edge functions were written, deployable, and never called — this module
 * was dead code, so matching never ran in production. They are wired into admin
 * case oversight and the institution reports screen now.
 *
 * The matching function suggests only. Assignment goes through the
 * admin_assign_case RPC, which re-checks that the assignee holds the role and
 * has passed verification. A person confirms who gains access to a case file.
 *
 * The old `sendNotificationEmail(to, subject, html)` helper is gone: raw
 * recipient and raw HTML made the email function an open relay. Use
 * `sendTemplatedEmail` from lib/email instead.
 */

export interface MatchResult {
  case: { id: string; title: string; status: string };
  matches: InvestigatorMatch[];
  recommended: InvestigatorMatch | null;
  note?: string;
}

/** Edge function errors carry our own message in the response body. */
async function readFunctionError(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return body.error as string;
    } catch {
      /* fall through to the transport message */
    }
  }
  return (error as { message?: string })?.message ?? fallback;
}

/** Ranked investigator suggestions for a case. Administrators only. */
export async function suggestInvestigators(
  caseId: string
): Promise<{ data: MatchResult | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('match-investigator', {
    body: { case_id: caseId },
  });

  if (error) {
    return { data: null, error: await readFunctionError(error, 'Could not load suggestions') };
  }
  return { data: data as MatchResult, error: null };
}

/**
 * Assigns a professional to a case.
 *
 * The RPC validates role and KYC, updates the case, notifies both parties and
 * writes the audit entry in one transaction, so a half-applied assignment is
 * not possible.
 */
export async function assignCaseProfessional(
  caseId: string,
  userId: string,
  slot: 'investigator' | 'lawyer' | 'expert' = 'investigator'
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_assign_case', {
    p_case_id: caseId,
    p_user_id: userId,
    p_slot: slot,
  });
  return { error: error?.message ?? null };
}

export interface InstitutionReport {
  institution: {
    name: string;
    type: string;
    location: string;
    supervising_authority: string;
  };
  performance: {
    total_evaluations: number;
    average_scores: {
      punctuality: number;
      professionalism: number;
      cleanliness: number;
      integrity: number;
      service_delivery: number;
      overall: number;
    };
    grade: 'A' | 'B' | 'C' | 'D';
  };
  media_coverage: {
    total_reports: number;
    report_types?: Record<string, number>;
  };
  generated_at: string;
  report_type: string;
}

/** Builds an institution performance dossier plus a printable HTML version. */
export async function generateInstitutionReport(
  institutionId: string,
  reportType: 'summary' | 'detailed' = 'summary'
): Promise<{ report: InstitutionReport | null; html: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: { institution_id: institutionId, report_type: reportType },
  });

  if (error) {
    return {
      report: null,
      html: null,
      error: await readFunctionError(error, 'Could not generate that report'),
    };
  }

  const result = data as { report?: InstitutionReport; html?: string };
  return { report: result.report ?? null, html: result.html ?? null, error: null };
}

/** Hands the generated dossier to the browser as a download. */
export function downloadReportHtml(html: string, institutionName: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${institutionName.replace(/[^\w-]+/g, '-').toLowerCase()}-report.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Assignable investigators, read straight from the database.
 *
 * The fallback for when the matching engine is unreachable.
 *
 * Assignment used to depend entirely on `match-investigator`: the modal
 * rendered only what that function returned, so any failure — the function
 * being down, a network blip, a transport error the browser reports as
 * "Failed to send a request to the Edge Function" — left the admin looking at
 * "No verified, available investigator matches this case yet" with no way to
 * assign anybody. An edge function was a single point of failure for a core
 * administrative operation.
 *
 * This is deliberately the same eligibility rule the engine applies —
 * approved, available, and holding the investigator role — so the fallback
 * list can never contain someone the engine would have excluded. What is lost
 * without the engine is the ranking, not the safety: `admin_assign_case`
 * re-checks role and verification server-side either way, so nothing here can
 * grant access the RPC would refuse.
 */
export async function listAssignableInvestigators(): Promise<{
  data: InvestigatorMatch[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('investigators')
    .select(
      'id, user_id, specialization, service_area, rating, experience_years, ' +
        'profile:profiles!inner(user_id, full_name, role, kyc_status)'
    )
    .eq('verification_status', 'approved')
    .eq('is_available', true);

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

  const eligible = rows.filter((row) => {
    const profile = row.profile as { role?: string; kyc_status?: string } | null;
    return profile?.role === 'investigator' && profile?.kyc_status === 'approved';
  });

  return {
    data: eligible.map((row) => {
      const profile = row.profile as { user_id: string; full_name: string };
      return {
        investigator_id: String(row.id),
        user_id: profile.user_id,
        full_name: profile.full_name,
        specialization: (row.specialization as string[] | null) ?? [],
        service_area: (row.service_area as string | null) ?? '',
        rating: Number(row.rating ?? 0),
        experience_years: Number(row.experience_years ?? 0),
        total_cases: 0,
        // No score: this list is unranked, and showing a number would imply a
        // judgement the engine never made.
        match_score: 0,
        breakdown: {},
      } as InvestigatorMatch;
    }),
    error: null,
  };
}
