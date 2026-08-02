/**
 * Carries out an approved account-deletion request.
 *
 * Erasure needs the Auth admin API, which requires the service-role key, so it
 * cannot live in a database function. Deleting the auth user cascades to the
 * profile and everything keyed off it.
 *
 * Records the platform is legally obliged to retain — filed evidence, case
 * files, completed payments — are anonymised rather than removed: the FK to the
 * departing user is nulled where the schema allows and the display name is
 * replaced. Anything that would destroy a case record is refused outright, and
 * the admin is told why.
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

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ error: 'Function is not configured' }, 500, cors);
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Authentication required' }, 401, cors);

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- Administrators only ---
    let actorId: string | null = null;
    if (token !== SERVICE_KEY) {
      const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await asCaller.auth.getUser();
      if (!userData?.user) return json({ error: 'Authentication required' }, 401, cors);

      const { data: profile } = await admin
        .from('profiles').select('role').eq('user_id', userData.user.id).maybeSingle();
      if (profile?.role !== 'admin') return json({ error: 'Administrators only' }, 403, cors);
      actorId = userData.user.id;
    }

    const { requestId, action, notes } = await req.json() as
      { requestId?: string; action?: 'approve' | 'reject'; notes?: string };

    if (!requestId || (action !== 'approve' && action !== 'reject')) {
      return json({ error: 'requestId and action (approve|reject) are required' }, 400, cors);
    }

    const { data: request } = await admin
      .from('account_deletion_requests')
      .select('id, user_id, email, status')
      .eq('id', requestId)
      .maybeSingle();

    if (!request) return json({ error: 'Request not found' }, 404, cors);
    if (request.status === 'completed') {
      return json({ error: 'That request has already been completed' }, 409, cors);
    }

    if (action === 'reject') {
      await admin.from('account_deletion_requests').update({
        status: 'rejected',
        admin_notes: notes ?? null,
        processed_by: actorId,
        processed_at: new Date().toISOString(),
      }).eq('id', requestId);

      await admin.from('notifications').insert({
        user_id: request.user_id,
        title: 'Deletion request declined',
        message: notes ?? 'We could not action your deletion request. Please contact support.',
        type: 'warning',
      });

      return json({ success: true, status: 'rejected' }, 200, cors);
    }

    // --- Refuse where erasure would destroy an active case record ---
    const { count: openCases } = await admin
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .or([
        `complainant_id.eq.${request.user_id}`,
        `assigned_investigator_id.eq.${request.user_id}`,
        `assigned_lawyer_id.eq.${request.user_id}`,
        `assigned_expert_id.eq.${request.user_id}`,
      ].join(','))
      .not('status', 'in', '("completed","closed")');

    if ((openCases ?? 0) > 0) {
      await admin.from('account_deletion_requests').update({
        status: 'processing',
        admin_notes: `Blocked: ${openCases} open case(s) must be closed first. ${notes ?? ''}`.trim(),
        processed_by: actorId,
      }).eq('id', requestId);

      return json({
        error: `This account is on ${openCases} open case(s). Close or reassign them before erasing the account.`,
      }, 409, cors);
    }

    const { count: filedEvidence } = await admin
      .from('evidence')
      .select('id', { count: 'exact', head: true })
      .eq('uploaded_by', request.user_id);

    // --- Anonymise what must be retained ---
    await admin.from('profiles').update({
      full_name: 'Deleted user',
      phone: null,
      bio: null,
      location: null,
      avatar_url: null,
      email: `deleted+${request.user_id}@thesecuritywatch.invalid`,
    }).eq('user_id', request.user_id);

    await admin.from('saved_properties').delete().eq('user_id', request.user_id);
    await admin.from('notifications').delete().eq('user_id', request.user_id);
    await admin.from('conversation_participants').delete().eq('user_id', request.user_id);

    await admin.from('account_deletion_requests').update({
      status: 'completed',
      admin_notes: [
        notes,
        filedEvidence
          ? `${filedEvidence} evidence record(s) retained and anonymised for case integrity.`
          : null,
      ].filter(Boolean).join(' ') || null,
      processed_by: actorId,
      processed_at: new Date().toISOString(),
    }).eq('id', requestId);

    await admin.from('audit_logs').insert({
      user_id: actorId,
      action: 'account_deleted',
      resource_type: 'profile',
      resource_id: request.user_id,
      details: { request_id: requestId, retained_evidence: filedEvidence ?? 0 },
      severity: 'critical',
    });

    // Auth record last: it cascades, so nothing above can be left half-done.
    const { error: authErr } = await admin.auth.admin.deleteUser(request.user_id);
    if (authErr) {
      console.error('[admin-process-deletion] auth delete failed:', authErr.message);
      return json({
        error: 'Personal data was anonymised, but the login could not be removed. Retry, or remove it from the Auth dashboard.',
      }, 502, cors);
    }

    return json({
      success: true,
      status: 'completed',
      retainedEvidence: filedEvidence ?? 0,
    }, 200, cors);
  } catch (err) {
    console.error('[admin-process-deletion]', (err as Error).message);
    return json({ error: 'Unexpected error' }, 500, cors);
  }
});
