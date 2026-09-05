/**
 * Opens a time-boxed evidence grant for someone with no account.
 *
 * The recipient is a lawyer, an insurer, an officer — somebody outside the
 * platform holding a link. That link is a bearer credential to criminal case
 * material, which shapes everything here:
 *
 *   * The token is never compared in this function. It is handed to
 *     `resolve_evidence_grant`, which hashes it and matches on the hash, so
 *     the plaintext is never logged, never in a query plan, and never stored.
 *
 *   * Signed storage URLs live for sixty seconds. Long enough to load a page,
 *     too short to be a link somebody forwards. Expiry, revocation and the
 *     view ceiling are all re-checked in the database on every call, so a
 *     revoked grant stops working immediately rather than at the next refresh.
 *
 *   * The response carries no case id, no complainant, no professional and no
 *     custody trail. Only the exhibits the grant names, and the recipient name
 *     the page stamps across them.
 *
 * ON THE WATERMARK, HONESTLY: the overlay is drawn by the viewer page, so it
 * is a deterrent and an attribution aid, not a forensic control. A determined
 * recipient photographs the screen. What actually constrains them is that
 * every open is counted and recorded against their name.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://thesecuritywatch.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** Scoped to this project's slug — a blanket *.vercel.app would let any site call this. */
const VERCEL_ORIGIN = /^https:\/\/security-watch(-[a-z0-9-]+)?\.vercel\.app$/;

/** Sixty seconds. See the header. */
const SIGNED_URL_TTL = 60;

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
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

interface GrantRow {
  grant_id: string;
  case_id: string;
  case_title: string;
  evidence_id: string | null;
  recipient_name: string;
  purpose: string | null;
  expires_at: string;
  views_left: number | null;
}

interface EvidenceRow {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  file_hash: string | null;
  description: string | null;
  created_at: string;
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  let token = '';
  try {
    const body = await req.json();
    token = typeof body?.token === 'string' ? body.token : '';
  } catch {
    return json({ error: 'Invalid request' }, 400, cors);
  }

  if (!token || token.length < 32) {
    return json({ error: 'This link is not valid.' }, 404, cors);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const { data: grants, error: grantErr } = await supabase.rpc('resolve_evidence_grant', {
    p_token: token,
  });

  if (grantErr) {
    console.error('resolve_evidence_grant failed', grantErr.message);
    return json({ error: 'Could not open this link.' }, 500, cors);
  }

  const grant = ((grants ?? []) as GrantRow[])[0];

  if (!grant) {
    // One message for expired, revoked, used up and never-existed. Telling a
    // holder which of those applies confirms the link was once real, and
    // distinguishing "wrong token" from "revoked" is the difference an
    // enumeration attempt would measure.
    return json(
      { error: 'This link is no longer valid. It may have expired or been withdrawn.' },
      404,
      cors
    );
  }

  const { data: items, error: itemsErr } = await supabase.rpc('evidence_for_grant', {
    p_grant_id: grant.grant_id,
  });

  if (itemsErr) {
    console.error('evidence_for_grant failed', itemsErr.message);
    return json({ error: 'Could not open this link.' }, 500, cors);
  }

  const evidence = (items ?? []) as EvidenceRow[];

  const signed = await Promise.all(
    evidence.map(async (e) => {
      const { data, error } = await supabase.storage
        .from('evidence')
        .createSignedUrl(e.file_url, SIGNED_URL_TTL);

      if (error) console.error('sign failed', e.id, error.message);

      return {
        id: e.id,
        file_name: e.file_name,
        file_type: e.file_type,
        file_size: e.file_size,
        // Included so the recipient can verify the file against the
        // certificate independently. It is the point of the whole exercise.
        file_hash: e.file_hash,
        description: e.description,
        created_at: e.created_at,
        // Null when signing failed. The page shows the exhibit as unavailable
        // rather than dropping it silently — a missing row reads as "there was
        // nothing", which is a different and worse claim.
        url: data?.signedUrl ?? null,
      };
    })
  );

  // Counted once per opening, not once per file. `record_evidence_grant_view`
  // also increments the view ceiling, so this call is what eventually closes a
  // limited grant.
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const { error: viewErr } = await supabase.rpc('record_evidence_grant_view', {
    p_grant_id: grant.grant_id,
    // Hashed in the database with the grant id as salt — never stored raw.
    p_ip: forwarded.split(',')[0]?.trim() || null,
    p_user_agent: req.headers.get('user-agent'),
    p_evidence_id: grant.evidence_id,
  });

  // Logged, not fatal. Refusing to show the material because the audit write
  // failed would punish the recipient for our fault; the counts are
  // reconcilable afterwards.
  if (viewErr) console.error('record_evidence_grant_view failed', viewErr.message);

  return json(
    {
      case_title: grant.case_title,
      recipient_name: grant.recipient_name,
      purpose: grant.purpose,
      expires_at: grant.expires_at,
      views_left: grant.views_left,
      url_ttl_seconds: SIGNED_URL_TTL,
      evidence: signed,
    },
    200,
    cors
  );
});
