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
  /*
   * Sourced from `profiles`, NOT `investigators`.
   *
   * That distinction is the bug this function was written with. `investigators`
   * holds a professional APPLICATION — specialisation, service area, rating —
   * and someone can hold the investigator role without ever having filed one.
   * The live system has exactly that: an investigator with role='investigator',
   * kyc_status='approved' and no `investigators` row at all, who was therefore
   * invisible to both the matching engine and the first version of this
   * fallback. The screen said "no investigator has been approved yet" while one
   * plainly had been.
   *
   * `profiles` is the authority, and it is the same authority admin_assign_case
   * uses: it checks role and kyc_status and never looks at `investigators`. So
   * anyone listed here is exactly someone the RPC will accept, and the
   * professional detail is joined in where it happens to exist.
   */
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'user_id, full_name, ' +
        'investigator:investigators(id, specialization, service_area, rating, ' +
        'experience_years, is_available, verification_status)'
    )
    .eq('role', 'investigator')
    .eq('kyc_status', 'approved');

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

  return {
    data: rows
      .map((row) => {
        // Supabase returns an embedded to-many relation as an array.
        const raw = row.investigator;
        const detail = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;

        return { row, detail };
      })
      // An explicit `is_available = false` is the person saying they are not
      // taking work. No application row at all is not a refusal — they hold the
      // role and passed verification — so absence must not exclude them.
      .filter(({ detail }) => detail == null || detail.is_available !== false)
      .map(({ row, detail }) => ({
        investigator_id: String(detail?.id ?? row.user_id),
        user_id: String(row.user_id),
        full_name: String(row.full_name ?? 'Unnamed investigator'),
        specialization: (detail?.specialization as string[] | null) ?? [],
        service_area: (detail?.service_area as string | null) ?? '',
        rating: Number(detail?.rating ?? 0),
        experience_years: Number(detail?.experience_years ?? 0),
        total_cases: 0,
        // Unranked. A score here would imply a judgement the engine never made.
        match_score: 0,
        breakdown: {},
      })) as InvestigatorMatch[],
    error: null,
  };
}
