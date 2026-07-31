/**
 * Compiles an institutional performance dossier.
 *
 * SECURITY MODEL
 *
 * The report is built from data that is already public — published media
 * reports and institution scores — so any signed-in user may request one. What
 * changed is that the caller must actually be signed in: the function holds
 * the service-role key, and previously accepted a bare anon key (which ships in
 * the browser bundle) as sufficient authorization.
 *
 * The generated HTML is also escaped now. Institution names are admin-authored
 * but were being interpolated raw into a document we hand back for display.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://thesecuritywatch.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin)
    || /^http:\/\/localhost:\d+$/.test(origin)
    || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0] ?? '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** Institution text is admin-authored, but never trust it into markup. */
function esc(value: unknown): string {
  return String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (req: Request) => {
  const corsHeaders = corsFor(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Function is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    let callerId: string | null = null;

    if (token !== SERVICE_KEY) {
      const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userErr } = await asCaller.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      callerId = userData.user.id;
    }

    const { institution_id, report_type } = await req.json();

    if (!institution_id || typeof institution_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'institution_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: institution } = await supabase
      .from('institutions')
      .select('*')
      .eq('id', institution_id)
      .single();

    if (!institution) {
      return new Response(
        JSON.stringify({ error: 'Institution not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: scores } = await supabase
      .from('performance_scores')
      .select('*')
      .eq('institution_id', institution_id);

    const { data: reports } = await supabase
      .from('media_reports')
      .select('*')
      .eq('institution_id', institution_id)
      .eq('status', 'published');

    const avgScores = {
      punctuality: 0,
      professionalism: 0,
      cleanliness: 0,
      integrity: 0,
      service_delivery: 0,
      overall: 0,
    };

    if (scores && scores.length > 0) {
      for (const s of scores) {
        avgScores.punctuality += s.punctuality;
        avgScores.professionalism += s.professionalism;
        avgScores.cleanliness += s.cleanliness;
        avgScores.integrity += s.integrity;
        avgScores.service_delivery += s.service_delivery;
        avgScores.overall += s.overall_score;
      }
      const count = scores.length;
      avgScores.punctuality = Math.round((avgScores.punctuality / count) * 100) / 100;
      avgScores.professionalism = Math.round((avgScores.professionalism / count) * 100) / 100;
      avgScores.cleanliness = Math.round((avgScores.cleanliness / count) * 100) / 100;
      avgScores.integrity = Math.round((avgScores.integrity / count) * 100) / 100;
      avgScores.service_delivery = Math.round((avgScores.service_delivery / count) * 100) / 100;
      avgScores.overall = Math.round((avgScores.overall / count) * 100) / 100;
    }

    const reportData = {
      institution: {
        name: institution.name,
        type: institution.type,
        location: institution.location,
        supervising_authority: institution.supervising_authority,
      },
      performance: {
        total_evaluations: scores?.length || 0,
        average_scores: avgScores,
        grade:
          avgScores.overall >= 4
            ? 'A'
            : avgScores.overall >= 3
              ? 'B'
              : avgScores.overall >= 2
                ? 'C'
                : 'D',
      },
      media_coverage: {
        total_reports: reports?.length || 0,
        report_types: reports?.reduce(
          (acc: Record<string, number>, r) => {
            acc[r.media_type] = (acc[r.media_type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
      generated_at: new Date().toISOString(),
      report_type: report_type || 'summary',
    };

    // Generate HTML report
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Institution Report - ${esc(institution.name)}</title>
  <style>
    body { font-family: 'Inter', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1e293b; }
    .header { text-align: center; border-bottom: 3px solid #166534; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #166534; margin-bottom: 5px; }
    .header p { color: #64748b; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #166534; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .score-item { background: #f8fafc; padding: 12px; border-radius: 8px; }
    .score-item .label { font-size: 14px; color: #64748b; }
    .score-item .value { font-size: 24px; font-weight: 700; color: #166534; }
    .grade { font-size: 48px; font-weight: 900; text-align: center; padding: 20px; border-radius: 12px; }
    .grade-A { background: #dcfce7; color: #166534; }
    .grade-B { background: #fef9c3; color: #854d0e; }
    .grade-C { background: #fed7aa; color: #9a3412; }
    .grade-D { background: #fecaca; color: #991b1b; }
    .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>The Security Watch</h1>
    <p>Institutional Performance Report</p>
  </div>
  <div class="section">
    <h2>Institution Details</h2>
    <p><strong>Name:</strong> ${esc(institution.name)}</p>
    <p><strong>Type:</strong> ${esc(institution.type)}</p>
    <p><strong>Location:</strong> ${esc(institution.location)}</p>
    <p><strong>Supervising Authority:</strong> ${esc(institution.supervising_authority)}</p>
  </div>
  <div class="section">
    <h2>Performance Grade</h2>
    <div class="grade grade-${reportData.performance.grade}">${reportData.performance.grade}</div>
    <p style="text-align:center;">Based on ${reportData.performance.total_evaluations} evaluations</p>
  </div>
  <div class="section">
    <h2>Score Breakdown</h2>
    <div class="score-grid">
      <div class="score-item"><div class="label">Punctuality</div><div class="value">${avgScores.punctuality}/5</div></div>
      <div class="score-item"><div class="label">Professionalism</div><div class="value">${avgScores.professionalism}/5</div></div>
      <div class="score-item"><div class="label">Cleanliness</div><div class="value">${avgScores.cleanliness}/5</div></div>
      <div class="score-item"><div class="label">Integrity</div><div class="value">${avgScores.integrity}/5</div></div>
      <div class="score-item"><div class="label">Service Delivery</div><div class="value">${avgScores.service_delivery}/5</div></div>
      <div class="score-item"><div class="label">Overall</div><div class="value">${avgScores.overall}/5</div></div>
    </div>
  </div>
  <div class="section">
    <h2>Media Coverage</h2>
    <p>Total Published Reports: ${reportData.media_coverage.total_reports}</p>
  </div>
  <div class="footer">
    <p>Generated by The Security Watch on ${new Date().toLocaleDateString()}</p>
    <p>This report is confidential and intended for authorized use only.</p>
  </div>
</body>
</html>`;

    await supabase.from('audit_logs').insert({
      user_id: callerId,
      action: 'report_generated',
      resource_type: 'institution',
      resource_id: institution_id,
      details: { report_type: report_type || 'summary' },
    });

    return new Response(
      JSON.stringify({ report: reportData, html }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
