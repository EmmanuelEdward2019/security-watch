-- =============================================================================
-- 014 — CLOSE THE PUBLIC WRITE BYPASS
-- =============================================================================
-- `contact_messages` and `security_service_requests` carry an
-- `INSERT WITH CHECK (true)` policy so the public forms work without a session.
--
-- The intent was that submissions arrive through the `public-enquiry` edge
-- function, which rate-limits to 5 per email per hour, validates and length-caps
-- every field, strips control characters, and notifies admins.
--
-- None of that binds. Verified against production: anyone holding the anon key —
-- which ships in the browser bundle — can POST straight to
-- /rest/v1/contact_messages and insert without limit. Three consecutive inserts
-- returned 201.
--
-- The exposure is not data theft; it is unbounded anonymous writes into tables
-- an administrator reads. Left open it is a spam firehose and a slow storage
-- exhaustion vector, and it makes the genuine enquiries unfindable.
--
-- Fix: revoke the direct grant so the edge function, which holds the service-role
-- key and bypasses RLS, becomes the only way in. The web app already submits
-- exclusively through it (`submitPublicEnquiry`), so nothing legitimate breaks.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — Remove the probe rows created while confirming the gap
-- =============================================================================

DELETE FROM public.contact_messages
WHERE email LIKE 'probe%@example.invalid' OR email = 'p@x.invalid';

DELETE FROM public.security_service_requests
WHERE email = 'p@x.invalid';


-- =============================================================================
-- SECTION 2 — Revoke the direct write path
-- =============================================================================
-- The policies stay in place: they are what lets the service role's inserts pass
-- RLS. Removing the table-level grant is what stops an anonymous REST client
-- from reaching them at all.

REVOKE INSERT ON public.contact_messages FROM anon, authenticated;
REVOKE INSERT ON public.security_service_requests FROM anon, authenticated;

COMMENT ON TABLE public.contact_messages IS
  'Public contact form. Writes ONLY via the public-enquiry edge function, which '
  'rate-limits and validates. Direct client INSERT is revoked — see migration 014.';

COMMENT ON TABLE public.security_service_requests IS
  'Fountain Source enquiries. Writes ONLY via the public-enquiry edge function. '
  'Direct client INSERT is revoked — see migration 014.';


-- =============================================================================
-- SECTION 3 — Backstop rate limit inside the database
-- =============================================================================
-- The edge function is now the only caller, but it runs as the service role and
-- so bypasses RLS. If that function is ever changed, or a future job writes here
-- directly, this keeps a ceiling on the damage.
--
-- Deliberately generous — it is a circuit breaker, not the primary control.

CREATE OR REPLACE FUNCTION public.guard_public_enquiry_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent INT;
BEGIN
  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE email = $1 AND created_at > now() - interval ''1 hour''',
    TG_TABLE_NAME
  ) INTO v_recent USING NEW.email;

  IF v_recent >= 20 THEN
    RAISE EXCEPTION
      'Too many submissions from this address in the last hour. Please contact us by phone.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_messages_rate_guard ON public.contact_messages;
CREATE TRIGGER contact_messages_rate_guard
  BEFORE INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_public_enquiry_rate();

DROP TRIGGER IF EXISTS ssr_rate_guard ON public.security_service_requests;
CREATE TRIGGER ssr_rate_guard
  BEFORE INSERT ON public.security_service_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_public_enquiry_rate();

REVOKE ALL ON FUNCTION public.guard_public_enquiry_rate() FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- SECTION 4 — Verification
-- =============================================================================

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.contact_messages', 'INSERT')
     OR has_table_privilege('anon', 'public.security_service_requests', 'INSERT') THEN
    RAISE EXCEPTION 'anon can still insert into a public enquiry table';
  END IF;
  RAISE NOTICE 'Public write bypass closed. Enquiries now route through public-enquiry only.';
END $$;
