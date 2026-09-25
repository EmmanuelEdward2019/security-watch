-- ============================================================================
-- 038 — The push sweep took the database down. Unschedule it, and fix it.
-- ============================================================================
--
-- 036 scheduled `push-dispatch` every minute through pg_net. On 25 September
-- the database stopped accepting connections: authentication and every query
-- timed out, nobody could sign in to either client, and the dashboard could
-- not load either — SQL editor, Cron and Extensions all read the database it
-- could no longer reach. The Postgres log, every minute for hours:
--
--   cron job 2 starting: SELECT public.tsw_invoke_sweep('push-dispatch', …)
--   cron job 2 job startup timeout
--
-- alongside "could not accept SSL connection: EOF detected", cancel requests
-- matching no process, checkpoints taking 120 seconds, and ordinary queries
-- taking 20. Recovery took a project restart, and pg_cron was then removed by
-- hand to stop it recurring.
--
-- Other projects on the same account stayed healthy throughout. That is the
-- detail that settles authorship: this was not a platform fault, it was this
-- migration's job.
--
-- ── WHAT WENT WRONG ─────────────────────────────────────────────────────────
--
-- `tsw_invoke_sweep` posted with `timeout_milliseconds := 60000`. pg_net makes
-- those calls from a SINGLE background worker. When the calls became slow —
-- Supabase's API gateway was degraded that week — each one held that worker
-- for up to a minute while a new one was queued every minute. Three mistakes,
-- each sufficient on its own:
--
--   1. A ONE-MINUTE CADENCE for work that is not urgent to the minute. A push
--      arriving late is nothing; the database being unreachable is everything.
--   2. A TIMEOUT LONGER THAN THE INTERVAL. Any endpoint slower than a minute
--      guarantees a backlog the schedule can never drain.
--   3. NO BACK PRESSURE. The job never asked whether the previous request had
--      finished. A sweep that cannot keep up must skip a turn, not pile on.
--
-- ── WHAT THIS MIGRATION DOES ────────────────────────────────────────────────
--
-- Fixes the function, and leaves NOTHING SCHEDULED. After an outage caused by
-- a schedule, restoring that schedule automatically would be the wrong
-- default: switching it back on is a decision to take deliberately, with the
-- ready-made statement at the bottom of this file.
--
-- It is also what stops 036 from recreating the one-minute job on any database
-- built from this history.
--
-- ── WHAT IS OFF WHILE NOTHING IS SCHEDULED ──────────────────────────────────
--
--   push-dispatch      Notifications still appear in the app. None is
--                      delivered to a handset. No device is registered for
--                      push yet, so today this costs nothing.
--   payment-reminders  Nobody is chased for an unpaid filing fee, engagement
--                      deposit or property verification. The cadence lives in
--                      the database (032), so a sweep run later catches up
--                      rather than skipping anyone.
-- ============================================================================


-- ── SECTION 1 — nothing scheduled ───────────────────────────────────────────

-- Guarded and dynamic: pg_cron has been removed from this project, so the
-- `cron` schema does not exist and a direct reference would not parse.
DO $stop$
DECLARE
  v_job TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '038: pg_cron is not installed; nothing to unschedule.';
    RETURN;
  END IF;

  FOREACH v_job IN ARRAY ARRAY[
    'push-dispatch-every-minute',
    'push-dispatch-every-5-min',
    'payment-reminders-hourly',
    'prune-cron-history'
  ] LOOP
    EXECUTE format(
      'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = %L', v_job
    );
  END LOOP;
END
$stop$;


-- ── SECTION 2 — a sweep that yields ─────────────────────────────────────────

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
  v_url     TEXT;
  v_secret  TEXT;
  v_pending INT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'project_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = p_secret_name;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  /*
   * Back pressure.
   *
   * pg_net sends from one background worker. If requests are still waiting,
   * that worker is behind, and adding another makes it worse — which is how a
   * minute-by-minute sweep exhausted the database rather than failing
   * quietly. Skip this turn; the next one tries again, and the queue drains
   * on its own once the endpoint recovers.
   */
  SELECT count(*) INTO v_pending FROM net.http_request_queue;
  IF v_pending > 10 THEN
    RAISE LOG 'tsw_invoke_sweep: % requests still pending, skipping %', v_pending, p_function;
    RETURN NULL;
  END IF;

  RETURN net.http_post(
    url                  := rtrim(v_url, '/') || '/functions/v1/' || p_function,
    headers              := jsonb_build_object('content-type', 'application/json', p_header, v_secret),
    body                 := '{}'::jsonb,
    -- Deliberately shorter than any interval this is scheduled at, so a slow
    -- endpoint can never accumulate. The sweeps are idempotent; a dropped
    -- call costs one cycle.
    timeout_milliseconds := 8000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tsw_invoke_sweep(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;


-- ── SECTION 3 — verification ────────────────────────────────────────────────

DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'tsw_invoke_sweep' AND prosrc LIKE '%60000%'
  ) THEN
    RAISE EXCEPTION '038 failed: tsw_invoke_sweep still uses the 60s timeout';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'tsw_invoke_sweep' AND prosrc LIKE '%http_request_queue%'
  ) THEN
    RAISE EXCEPTION '038 failed: tsw_invoke_sweep has no back pressure';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tsw_invoke_sweep')
  THEN
    -- Only meaningful when pg_cron is present; the query is dynamic for the
    -- same reason as SECTION 1.
    DECLARE v_left INT;
    BEGIN
      EXECUTE 'SELECT count(*) FROM cron.job WHERE command LIKE ''%tsw_invoke_sweep%'''
        INTO v_left;
      IF v_left > 0 THEN
        RAISE EXCEPTION '038 failed: % sweep job(s) still scheduled', v_left;
      END IF;
    END;
  END IF;
END
$verify$;


-- ── Turning the sweeps back on, when someone decides to ─────────────────────
--
-- Requires pg_cron (Dashboard → Database → Extensions), and the Vault entries
-- described in DEPLOYMENT.md. Five minutes, never one:
--
--   SELECT cron.schedule('push-dispatch-every-5-min', '*/5 * * * *',
--     $$SELECT public.tsw_invoke_sweep('push-dispatch', 'x-dispatch-secret',
--                                      'push_dispatch_secret')$$);
--
--   SELECT cron.schedule('payment-reminders-hourly', '17 * * * *',
--     $$SELECT public.tsw_invoke_sweep('payment-reminders', 'x-sweep-secret',
--                                      'payment_reminder_secret')$$);
--
-- Then watch `cron.job_run_details` and `net._http_response` for a few cycles
-- before walking away from it.
