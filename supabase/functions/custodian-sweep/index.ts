/**
 * Runs the custodian-release clock.
 *
 * Two-phase, deliberately (see migration 027). A lapsed check-in first
 * produces a WARNING to the complainant; only after the grace period expires,
 * measured from that warning, does the case become readable by the custodian.
 * Nothing here fires on a first missed deadline, because the most likely cause
 * of a missed deadline is a flat battery, not a reprisal.
 *
 * FAILING CLOSED IS THE RULE. Every uncertain path here leaves the case
 * private. If the warning cannot be written, the grace clock never starts and
 * no release follows. If `execute_custodian_release` finds the state changed
 * underneath it — a check-in landing between this sweep's read and its write —
 * it does nothing and says so. A missed release is a delay; a wrong release
 * cannot be undone, because the file has been read.
 *
 * Schedule this alongside push-dispatch. Daily is enough — grace periods are
 * measured in days — but running hourly costs nothing and shortens the gap
 * between a lapse and the warning that gives someone a chance to act.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface DueRow {
  id: string;
  case_id: string;
  owner_id: string;
  custodian_id: string;
  action: 'warn' | 'release';
  overdue_hours: number;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Constant-time, so the secret cannot be recovered by timing guesses. */
function secretMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expected = Deno.env.get('CUSTODIAN_SWEEP_SECRET') ?? '';
  if (!expected) {
    // Refuses rather than running open. This function discloses case files.
    console.error('CUSTODIAN_SWEEP_SECRET is not set; refusing to run');
    return json({ error: 'Not configured' }, 500);
  }

  if (!secretMatches(req.headers.get('x-sweep-secret') ?? '', expected)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.rpc('custodian_releases_due');

  if (error) {
    console.error('custodian_releases_due failed', error.message);
    return json({ error: 'Query failed' }, 500);
  }

  const due = (data ?? []) as DueRow[];
  let warned = 0;
  let released = 0;
  let failed = 0;

  for (const row of due) {
    if (row.action === 'warn') {
      const { error: warnErr } = await supabase.rpc('mark_custodian_release_warned', {
        p_id: row.id,
      });
      if (warnErr) {
        // Left un-warned on purpose. `warned_at` stays NULL, so the grace
        // clock has not started and the next sweep tries again — rather than
        // a release whose warning was never delivered.
        console.error('warn failed', row.id, warnErr.message);
        failed++;
      } else {
        warned++;
      }
      continue;
    }

    const { error: relErr } = await supabase.rpc('execute_custodian_release', {
      p_id: row.id,
    });
    if (relErr) {
      console.error('release failed', row.id, relErr.message);
      failed++;
    } else {
      released++;
    }
  }

  // No case ids in the response. This is an operational count and it goes into
  // logs; which specific cases were disclosed is in the audit trail, behind
  // authentication, where it belongs.
  return json({ due: due.length, warned, released, failed }, 200);
});
