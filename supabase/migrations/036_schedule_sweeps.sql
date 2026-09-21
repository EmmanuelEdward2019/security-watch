-- ============================================================================
-- 036 — Schedule the sweeps, inside the database
-- ============================================================================
--
-- Three edge functions do nothing until something calls them on a timer, and
-- nothing ever has. Verified against production before this was written: of 28
-- notifications, not one has `pushed_at` set, so push-dispatch has never run;
-- and payment-reminders shipped in 032 with no caller at all. There was no
-- pg_cron on the project and no scheduled workflow in either repository.
--
-- ── WHY HERE AND NOT IN GITHUB ACTIONS ──────────────────────────────────────
--
-- The repository is private, so every scheduled run is billed by the minute,
-- rounded up per job. push-dispatch wants a one-minute cadence: ~43,000 runs a
-- month, twenty times the free allowance, spent on a curl. pg_cron runs inside
-- the database for nothing, to the minute, and the secrets never leave
-- Supabase.
--
-- ── WHERE THE SECRETS ARE ───────────────────────────────────────────────────
--
-- In Vault, created out of band and never in this file. A migration is
-- committed to git, and a sweep secret in git is a sweep secret on GitHub. The
-- jobs look them up by name at run time:
--
--   project_url               https://<ref>.supabase.co
--   payment_reminder_secret   = the PAYMENT_REMINDER_SECRET function secret
--   push_dispatch_secret      = the PUSH_DISPATCH_SECRET function secret
--
-- A database without them — a local `supabase start` — gets a job that does
-- nothing, rather than one that posts to an empty URL or, worse, calls
-- production from a laptop.
--
-- ── WHAT IS DELIBERATELY NOT SCHEDULED ──────────────────────────────────────
--
-- custodian-sweep. It is the function that releases a case file to a custodian
-- when check-ins lapse. It has never run, it fails closed, and there are no
-- arrangements yet — but switching it on starts automatic disclosure, which is
-- a product decision for a person to make on purpose, not a side effect of
-- scheduling the reminders. Add it with the same helper when that decision is
-- made:
--
--   SELECT cron.schedule('custodian-sweep-hourly', '41 * * * *',
--     $$SELECT public.tsw_invoke_sweep('custodian-sweep', 'x-sweep-secret',
--                                      'custodian_sweep_secret')$$);
-- ============================================================================


-- ── SECTION 1 — the scheduler and the HTTP client ───────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ── SECTION 2 — one way to call a sweep ─────────────────────────────────────

-- Not SECURITY DEFINER: cron jobs run as the role that scheduled them, which
-- can already read Vault. Nothing else should be able to fire a sweep, so
-- EXECUTE is revoked from everyone — including anon and authenticated, which
-- Supabase's default privileges would otherwise hand it to.
CREATE OR REPLACE FUNCTION public.tsw_invoke_sweep(
  p_function    TEXT,
  p_header      TEXT,
  p_secret_name TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'project_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = p_secret_name;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fire and forget. The response lands in net._http_response, which pg_net
  -- expires on its own; the function's own logs carry the detail.
  RETURN net.http_post(
    url                  := rtrim(v_url, '/') || '/functions/v1/' || p_function,
    headers              := jsonb_build_object('content-type', 'application/json', p_header, v_secret),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tsw_invoke_sweep(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;


-- ── SECTION 3 — the schedules ───────────────────────────────────────────────

-- Hourly, off the top of the hour. The cadence lives in the database
-- (payment_reminder_due_at, 032), so a missed run is caught up by the next one
-- rather than skipped, and the ledger's UNIQUE constraint makes overlap free.
SELECT cron.schedule(
  'payment-reminders-hourly',
  '17 * * * *',
  $$SELECT public.tsw_invoke_sweep('payment-reminders', 'x-sweep-secret', 'payment_reminder_secret')$$
);

-- Every minute. A push that arrives ten minutes late about a case assignment
-- is a push someone has stopped waiting for. claim_push_batch (025) only takes
-- the last 24 hours, so switching this on does not replay a backlog.
-- Note the header: push-dispatch reads x-dispatch-secret, not x-sweep-secret.
SELECT cron.schedule(
  'push-dispatch-every-minute',
  '* * * * *',
  $$SELECT public.tsw_invoke_sweep('push-dispatch', 'x-dispatch-secret', 'push_dispatch_secret')$$
);

-- pg_cron keeps a row per run forever. At one run a minute that is half a
-- million rows a year of "succeeded" — prune it daily.
SELECT cron.schedule(
  'prune-cron-history',
  '23 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - INTERVAL '7 days'$$
);


-- ── SECTION 4 — verification ────────────────────────────────────────────────

DO $verify$
BEGIN
  IF has_function_privilege('anon', 'public.tsw_invoke_sweep(text, text, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.tsw_invoke_sweep(text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION '036 failed: tsw_invoke_sweep is callable from the API';
  END IF;

  IF (SELECT count(*) FROM cron.job
      WHERE jobname IN ('payment-reminders-hourly', 'push-dispatch-every-minute', 'prune-cron-history')) <> 3 THEN
    RAISE EXCEPTION '036 failed: not all three jobs are scheduled';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE command LIKE '%custodian-sweep%') THEN
    RAISE EXCEPTION '036 failed: custodian-sweep must not be scheduled by this migration';
  END IF;
END
$verify$;
