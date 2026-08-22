/**
 * Suggests verified investigators for a case, ranked by fit.
 *
 * SECURITY MODEL
 *
 * This function holds the service-role key, which bypasses RLS entirely. It
 * previously accepted any `case_id` from any caller and, on a good enough
 * score, silently reassigned the case — meaning anyone with the anon key from
 * the browser bundle could move real criminal cases onto an investigator of
 * their choosing and hand them the case file.
 *
 * Now:
 *   * The caller must present a real user JWT and be an administrator.
 *   * The function only ever *suggests*. Assignment goes through the
 *     admin_assign_case RPC, which re-checks the assignee's role and
 *     verification status. A human decides who sees a murder or kidnapping
 *     file — the scorer does not.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://thesecuritywatch.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Vercel deployment URLs for THIS project only.
 *
 * Every preview build and the bare project domain live on *.vercel.app, so an
 * admin testing on a preview URL had their browser block the request before it
 * was sent — surfacing as "Failed to send a request to the Edge Function",
 * which reads like a network fault rather than a CORS rejection.
 *
 * Scoped to the project slug deliberately. A blanket *.vercel.app rule would let
 * any application hosted on Vercel call these functions.
 */
const VERCEL_ORIGIN = /^https:\/\/security-watch(-[a-z0-9-]+)?\.vercel\.app$/;

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin)
    || VERCEL_ORIGIN.test(origin)
    || /^http:\/\/localhost:\d+$/.test(origin)
    || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0] ?? '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

interface Investigator {
  id: string;
  user_id: string;
  specialization: string[];
  experience_years: number;
  service_area: string;
  rating: number;
  total_cases: number;
  verification_status: string;
  is_available: boolean;
}

interface CaseData {
  category: string;
  location: string;
  urgency: string;
}

interface ScoreBreakdown {
  specialization: number;
  location: number;
  experience: number;
  rating: number;
  availability: number;
  urgency: number;
}

const CATEGORY_SPECIALISATIONS: Record<string, string[]> = {
  fraud: ['fraud', 'financial_crimes', 'cybercrime'],
  robbery: ['robbery', 'theft', 'property_crime'],
  murder: ['homicide', 'violent_crime'],
  assault: ['assault', 'violent_crime'],
  domestic_dispute: ['domestic', 'family_law', 'mediation'],
  land_dispute: ['property', 'land', 'real_estate'],
  cybercrime: ['cybercrime', 'digital_forensics', 'fraud'],
  corruption: ['corruption', 'public_sector', 'whistleblower'],
  kidnapping: ['kidnapping', 'missing_persons', 'violent_crime'],
  missing_person: ['missing_persons', 'search_rescue'],
};

function scoreInvestigator(
  investigator: Investigator,
  caseData: CaseData
): { total: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    specialization: 0,
    location: 0,
    experience: 0,
    rating: 0,
    availability: 0,
    urgency: 0,
  };

  // Specialization overlap (0–30)
  const relevant = CATEGORY_SPECIALISATIONS[caseData.category] ?? [];
  const matching = (investigator.specialization ?? []).filter((s) =>
    relevant.some((r) => s.toLowerCase().includes(r))
  );
  breakdown.specialization = Math.min(matching.length * 10, 30);

  // Location proximity (0–25)
  const area = investigator.service_area?.toLowerCase() ?? '';
  const location = caseData.location?.toLowerCase() ?? '';
  if (area && location && area.includes(location)) {
    breakdown.location = 25;
  } else if (area && location) {
    const areaWords = area.split(/[\s,]+/).filter(Boolean);
    const locWords = location.split(/[\s,]+/).filter(Boolean);
    const overlap = areaWords.filter((w) => locWords.includes(w));
    breakdown.location = Math.min(overlap.length * 8, 20);
  }

  // Experience (0–20)
  breakdown.experience = Math.min((investigator.experience_years ?? 0) * 2, 20);

  // Reputation (0–15)
  breakdown.rating = ((investigator.rating ?? 0) / 5) * 15;

  // Capacity — a lighter caseload scores better (0–10)
  breakdown.availability = Math.max(0, 10 - (investigator.total_cases ?? 0));

  // Urgency weighting toward proven performers
  if (caseData.urgency === 'critical' && (investigator.rating ?? 0) >= 4) {
    breakdown.urgency = 10;
  } else if (caseData.urgency === 'high' && (investigator.rating ?? 0) >= 3.5) {
    breakdown.urgency = 5;
  }

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { total: Math.round(total * 100) / 100, breakdown };
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ error: 'Function is not configured' }, 500, cors);
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ error: 'Authentication required' }, 401, cors);
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const isServiceRole = token === SERVICE_KEY;

    // --- Authorize the caller before touching the service-role client ---
    if (!isServiceRole) {
      const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userErr } = await asCaller.auth.getUser();
      if (userErr || !userData?.user) {
        return json({ error: 'Authentication required' }, 401, cors);
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (profile?.role !== 'admin') {
        return json({ error: 'Administrators only' }, 403, cors);
      }
    }

    const { case_id } = await req.json();
    if (!case_id || typeof case_id !== 'string') {
      return json({ error: 'case_id is required' }, 400, cors);
    }

    const { data: caseData, error: caseError } = await admin
      .from('cases')
      .select('id, title, category, location, urgency, status')
      .eq('id', case_id)
      .maybeSingle();

    if (caseError || !caseData) {
      return json({ error: 'Case not found' }, 404, cors);
    }

    /*
     * Eligibility comes from `profiles`, not `investigators`.
     *
     * This query used to start at `investigators` with an INNER join to
     * profiles, requiring verification_status='approved' and
     * is_available=true on that table. But `investigators` holds a
     * professional APPLICATION, and someone can hold the investigator role
     * without ever having filed one — the live system has exactly that. Those
     * investigators were invisible to matching entirely, so an admin was told
     * no investigator was available while one was.
     *
     * `profiles` is the authority, and the same authority admin_assign_case
     * uses: it checks role and kyc_status and never reads `investigators`. So
     * anyone returned here is someone the RPC will accept. The application row
     * is joined in for scoring detail where it exists.
     */
    const { data: candidates, error: invError } = await admin
      .from('profiles')
      .select(
        'user_id, full_name, location, ' +
          'investigator:investigators(id, specialization, service_area, rating, ' +
          'experience_years, is_available, verification_status, languages)'
      )
      .eq('role', 'investigator')
      .eq('kyc_status', 'approved');

    if (invError) {
      return json({ error: 'Could not load investigators' }, 500, cors);
    }

    // Flatten so scoring sees the shape it expects, with the profile nested.
    const eligible = (candidates ?? [])
      .map((row: Record<string, unknown>) => {
        const raw = row.investigator;
        const detail = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;

        return {
          ...(detail ?? {}),
          id: detail?.id ?? row.user_id,
          user_id: row.user_id,
          is_available: detail?.is_available,
          profile: {
            user_id: row.user_id,
            full_name: row.full_name,
            role: 'investigator',
            kyc_status: 'approved',
            location: row.location,
          },
        } as Record<string, unknown>;
      })
      // An explicit false is the person declining work. No application row is
      // not a refusal — they hold the role and passed verification.
      .filter((inv) => inv.is_available !== false);

    if (eligible.length === 0) {
      return json(
        { matches: [], note: 'No verified and available investigators match this case yet.' },
        200,
        cors
      );
    }

    const matches = eligible
      .map((inv) => {
        const { total, breakdown } = scoreInvestigator(
          inv as unknown as Investigator,
          caseData as CaseData
        );
        const profile = (inv as Record<string, unknown>).profile as
          { full_name?: string } | null;
        return {
          investigator_id: (inv as Record<string, unknown>).id as string,
          user_id: (inv as Record<string, unknown>).user_id as string,
          full_name: profile?.full_name ?? 'Unknown',
          specialization: (inv as Record<string, unknown>).specialization as string[],
          service_area: (inv as Record<string, unknown>).service_area as string,
          experience_years: (inv as Record<string, unknown>).experience_years as number,
          rating: (inv as Record<string, unknown>).rating as number,
          total_cases: (inv as Record<string, unknown>).total_cases as number,
          match_score: total,
          breakdown,
        };
      })
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5);

    // Deliberately no auto-assignment. Suggestions are returned for an admin to
    // confirm through admin_assign_case, which re-validates the assignee.
    return json(
      {
        case: { id: caseData.id, title: caseData.title, status: caseData.status },
        matches,
        recommended: matches[0] ?? null,
      },
      200,
      cors
    );
  } catch (err) {
    console.error('[match-investigator]', (err as Error).message);
    return json({ error: 'Unexpected error' }, 500, cors);
  }
});
