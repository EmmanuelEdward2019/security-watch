-- ============================================================================
-- 032 — Payment obligations, the filing-fee gate, and reminders
-- ============================================================================
--
-- Three gaps, all of them downstream of the same omission.
--
-- 1. A PAID FILING FEE CHANGED NOTHING. 021 fixed this for engagements and
--    said so in its own header, but only for engagements. A completed
--    `case_filing_standard` payment still calls settle_engagement_deposit(),
--    finds no engagement awaiting it, and returns NULL. The case is not
--    stamped, no administrator is told it is funded, and nothing anywhere
--    records that the fee was ever owed.
--
-- 2. THE FILING SCREEN PROMISES A GATE THAT DOES NOT EXIST. CreateCasePage
--    tells the complainant "You can pay later from the case page. Until then
--    the case stays unassigned." Nothing enforced that. An unpaid case could
--    be assigned and worked exactly like a paid one, so the sentence was not
--    a policy, it was a hope.
--
-- 3. NOBODY WAS EVER REMINDED. "Pay later" had no later. There was no record
--    of an outstanding obligation, so there was nothing to chase and no way
--    to ask how much money was sitting uncollected.
--
-- ── THE BACKFILL IS THE DANGEROUS PART ──────────────────────────────────────
--
-- Every case that exists when this migration runs predates the requirement.
-- Defaulting them to "fee required, unpaid" would freeze every live
-- investigation the moment the gate in SECTION 2 goes in, and would send a
-- reminder to every complainant on the platform for a fee nobody ever asked
-- them for. SECTION 1 therefore backfills existing rows to
-- filing_fee_required = false and only NEW cases carry the obligation.
--
-- ── WHY THE GATE IS SOFT ────────────────────────────────────────────────────
--
-- An unpaid case is never deleted, never closed automatically and never
-- hidden from the person who filed it. On a platform where a filing may be
-- the only written record that someone feared a reprisal, destroying that
-- record over an unpaid fee is not a collections policy, it is a harm. The
-- gate withholds the SERVICE — assignment to a professional — and nothing
-- else. Administrators can still close an unpaid case by hand, because
-- sometimes that is the right call and the gate must not stand in the way.
-- ============================================================================


-- ── SECTION 1 — the obligation on a case ────────────────────────────────────

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS filing_fee_required BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS filing_fee_paid_at TIMESTAMPTZ;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS filing_payment_id UUID
    REFERENCES public.payments(id) ON DELETE SET NULL;

-- A one-shot marker table, so a re-run of this migration cannot reach back and
-- exempt cases filed after it first applied. Created before it is read; the
-- alternative (catching undefined_table) buys nothing and reads worse.
CREATE TABLE IF NOT EXISTS public.schema_migration_marks (
  mark       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schema_migration_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schema_migration_marks FROM PUBLIC, anon, authenticated;

-- The backfill described in the header: every case that already exists was
-- never asked for a fee, so it is not owed one.
DO $backfill$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.schema_migration_marks WHERE mark = '032_backfill'
  ) THEN
    UPDATE public.cases
    SET filing_fee_required = false
    WHERE filing_fee_paid_at IS NULL;

    INSERT INTO public.schema_migration_marks (mark) VALUES ('032_backfill');
  END IF;
END
$backfill$;

CREATE INDEX IF NOT EXISTS idx_cases_filing_fee_outstanding
  ON public.cases(created_at)
  WHERE filing_fee_required AND filing_fee_paid_at IS NULL;

COMMENT ON COLUMN public.cases.filing_fee_required IS
  'False for cases that predate 032, which were never asked for a fee. New cases default true.';
COMMENT ON COLUMN public.cases.filing_fee_paid_at IS
  'Stamped only by settle_case_filing_fee(), which only the webhook may call. Never written from a client.';


-- ── SECTION 2 — the gate ────────────────────────────────────────────────────

-- Two jobs, in this order.
--
-- 1. PIN THE FEE COLUMNS. `cases` has an UPDATE policy for case participants
--    and no column grants, so without this a complainant could PATCH their own
--    case with `filing_fee_paid_at = now()` — or INSERT one with
--    `filing_fee_required = false` — straight through the REST API and walk
--    past the fee. `guard_cases` (004) pins status and assignment the same way
--    but predates these columns. Only elevated code (settle_case_filing_fee,
--    via tsw_elevate) and administrators — who may waive a fee — can set them.
--
-- 2. WITHHOLD ASSIGNMENT, and only assignment. Closing, editing, commenting,
--    uploading evidence and every other operation on an unpaid case are
--    deliberately untouched. This check applies even to elevated callers: the
--    way past it is to pay or to be waived, not to be privileged.
CREATE OR REPLACE FUNCTION public.enforce_filing_fee_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (public.tsw_is_elevated() OR public.is_admin()) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.filing_fee_required := true;
      NEW.filing_fee_paid_at  := NULL;
      NEW.filing_payment_id   := NULL;
    ELSE
      NEW.filing_fee_required := OLD.filing_fee_required;
      NEW.filing_fee_paid_at  := OLD.filing_fee_paid_at;
      NEW.filing_payment_id   := OLD.filing_payment_id;
    END IF;
  END IF;

  IF NOT NEW.filing_fee_required OR NEW.filing_fee_paid_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('assigned', 'investigating', 'legal_processing') THEN
    RAISE EXCEPTION 'The filing fee for this case has not been paid, so it cannot be moved to %.', NEW.status
      USING ERRCODE = 'check_violation',
            HINT = 'The complainant pays from the case page. The case can still be closed if that is the right outcome.';
  END IF;

  IF NEW.assigned_investigator_id IS NOT NULL
     OR NEW.assigned_lawyer_id IS NOT NULL
     OR NEW.assigned_expert_id IS NOT NULL THEN
    RAISE EXCEPTION 'The filing fee for this case has not been paid, so a professional cannot be assigned to it.'
      USING ERRCODE = 'check_violation',
            HINT = 'The complainant pays from the case page.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_filing_fee_gate ON public.cases;
CREATE TRIGGER trg_enforce_filing_fee_gate
  BEFORE INSERT OR UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_filing_fee_gate();


-- ── SECTION 3 — settling the filing fee ─────────────────────────────────────

-- The counterpart to settle_engagement_deposit, and called from the same place
-- in the webhook. Idempotent: a Paystack retry finds the case already stamped
-- and returns NULL without notifying anyone a second time.
CREATE OR REPLACE FUNCTION public.settle_case_filing_fee(p_payment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pay  public.payments%ROWTYPE;
  v_case public.cases%ROWTYPE;
  v_admin RECORD;
BEGIN
  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND OR v_pay.status <> 'completed' OR v_pay.case_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_pay.purpose NOT IN ('case_filing_standard', 'case_filing_urgent') THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_case FROM public.cases WHERE id = v_pay.case_id FOR UPDATE;
  IF NOT FOUND OR v_case.filing_fee_paid_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- Elevate first. The gate trigger pins the fee columns for every other
  -- caller, and would silently discard this write without it.
  PERFORM public.tsw_elevate();

  UPDATE public.cases
  SET filing_fee_paid_at = now(),
      filing_payment_id  = p_payment_id,
      updated_at         = now()
  WHERE id = v_case.id;

  -- The obligation is discharged; stop chasing it.
  DELETE FROM public.payment_reminders
  WHERE obligation_kind = 'case_filing' AND obligation_id = v_case.id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_case.complainant_id,
    'Case filing fee received',
    format('Your filing fee for "%s" has been received. The case can now be assigned.', v_case.title),
    'success',
    format('/app/cases/%s', v_case.id)
  );

  -- Administrators need to know a case is now workable, which is the whole
  -- point of collecting the fee.
  FOR v_admin IN
    SELECT user_id FROM public.profiles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_admin.user_id,
      'Case funded and awaiting assignment',
      format('"%s" has been paid for and is ready to be assigned.', v_case.title),
      'info',
      format('/app/cases/%s', v_case.id)
    );
  END LOOP;

  RETURN v_case.id;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_case_filing_fee(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_case_filing_fee(UUID) TO service_role;


-- ── SECTION 4 — the reminder ledger ─────────────────────────────────────────

-- One row per nudge actually sent. Two jobs:
--
--   * CADENCE. How many have gone out, and when the last one did, is what
--     decides whether another is due. There is no scheduler state anywhere
--     else; this table IS the schedule.
--
--   * IDEMPOTENCY. The UNIQUE constraint is load-bearing. Two sweeps running
--     concurrently — an overlapping cron, or a retry after a timeout — both
--     compute the same next sequence number, and exactly one INSERT wins. The
--     loser sends nothing. Without it, a slow sweep double-nags every debtor.
CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_kind TEXT NOT NULL CHECK (obligation_kind IN (
    'case_filing', 'engagement_deposit', 'property_verification'
  )),
  obligation_id   UUID NOT NULL,
  user_id         UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  sequence_no     SMALLINT NOT NULL CHECK (sequence_no > 0),
  channels        TEXT[] NOT NULL DEFAULT '{}',
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_reminders_once_per_step
    UNIQUE (obligation_kind, obligation_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_obligation
  ON public.payment_reminders(obligation_kind, obligation_id);

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
-- `authenticated` must be named explicitly. Supabase's default privileges
-- grant ALL on every new table in `public` to anon, authenticated and
-- service_role, so revoking from PUBLIC and anon alone left authenticated
-- holding INSERT/UPDATE/DELETE. RLS would still refuse the writes — there is
-- no write policy — but the ledger that decides who gets chased for money
-- should not rest on a single layer. The verification block below caught this
-- on the first push.
REVOKE ALL ON public.payment_reminders FROM PUBLIC, anon, authenticated;

-- A payer may see what they have been sent. Nobody may write from a client.
GRANT SELECT ON public.payment_reminders TO authenticated;
DROP POLICY IF EXISTS "Payers see their own reminders" ON public.payment_reminders;
CREATE POLICY "Payers see their own reminders" ON public.payment_reminders
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- The cadence, in one place: day 1, day 3, day 7, then weekly for as long as
-- the obligation stands. Front-loaded because intent decays fast, and capped
-- at weekly because a daily nag about money is how an app gets muted.
CREATE OR REPLACE FUNCTION public.payment_reminder_due_at(
  p_created   TIMESTAMPTZ,
  p_sent      INT,
  p_last_sent TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_sent
    WHEN 0 THEN p_created + INTERVAL '1 day'
    WHEN 1 THEN p_created + INTERVAL '3 days'
    WHEN 2 THEN p_created + INTERVAL '7 days'
    ELSE COALESCE(p_last_sent, p_created) + INTERVAL '7 days'
  END;
$$;


-- ── SECTION 5 — what is due right now ───────────────────────────────────────

-- Every outstanding obligation on the platform, of all three kinds, that is
-- due a nudge at this moment. The sweep function is a thin loop over this.
CREATE OR REPLACE FUNCTION public.due_payment_reminders()
RETURNS TABLE (
  obligation_kind  TEXT,
  obligation_id    UUID,
  user_id          UUID,
  next_sequence    SMALLINT,
  amount           NUMERIC,
  currency         TEXT,
  subject          TEXT,
  pay_link         TEXT,
  days_outstanding INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- 1. Unpaid case filing fees.
  SELECT
    'case_filing'::TEXT,
    c.id,
    c.complainant_id,
    (r.sent + 1)::SMALLINT,
    sp.amount,
    sp.currency,
    c.title,
    format('/app/payments?purpose=%s&caseId=%s', sp.key, c.id),
    EXTRACT(DAY FROM now() - c.created_at)::INT
  FROM public.cases c
  JOIN public.service_prices sp
    ON sp.key = CASE WHEN c.urgency IN ('critical','high')
                     THEN 'case_filing_urgent' ELSE 'case_filing_standard' END
  CROSS JOIN LATERAL (
    SELECT count(*)::INT AS sent, max(pr.sent_at) AS last_sent
    FROM public.payment_reminders pr
    WHERE pr.obligation_kind = 'case_filing' AND pr.obligation_id = c.id
  ) r
  WHERE c.filing_fee_required
    AND c.filing_fee_paid_at IS NULL
    -- A closed case is not chased. Whatever happened, it is over.
    AND c.status NOT IN ('completed', 'closed')
    AND public.payment_reminder_due_at(c.created_at, r.sent, r.last_sent) <= now()

  UNION ALL

  -- 2. Engagement deposits an administrator has booked but nobody has funded.
  SELECT
    'engagement_deposit'::TEXT,
    e.id,
    c.complainant_id,
    (r.sent + 1)::SMALLINT,
    e.deposit_amount,
    e.currency,
    c.title,
    format('/app/payments?purpose=%s&caseId=%s', e.service_key, e.case_id),
    EXTRACT(DAY FROM now() - e.created_at)::INT
  FROM public.case_engagements e
  JOIN public.cases c ON c.id = e.case_id
  CROSS JOIN LATERAL (
    SELECT count(*)::INT AS sent, max(pr.sent_at) AS last_sent
    FROM public.payment_reminders pr
    WHERE pr.obligation_kind = 'engagement_deposit' AND pr.obligation_id = e.id
  ) r
  WHERE e.status = 'awaiting_deposit'
    AND c.status NOT IN ('completed', 'closed')
    AND public.payment_reminder_due_at(e.created_at, r.sent, r.last_sent) <= now()

  UNION ALL

  -- 3. Property verifications requested but never paid for. The webhook moves
  --    these to 'in_review' on payment, so 'pending' means unfunded.
  SELECT
    'property_verification'::TEXT,
    v.id,
    v.requester_id,
    (r.sent + 1)::SMALLINT,
    sp.amount,
    sp.currency,
    p.title,
    format('/app/payments?purpose=property_verification&propertyId=%s', v.property_id),
    EXTRACT(DAY FROM now() - v.created_at)::INT
  FROM public.property_verification_requests v
  JOIN public.properties p ON p.id = v.property_id
  JOIN public.service_prices sp ON sp.key = 'property_verification'
  CROSS JOIN LATERAL (
    SELECT count(*)::INT AS sent, max(pr.sent_at) AS last_sent
    FROM public.payment_reminders pr
    WHERE pr.obligation_kind = 'property_verification' AND pr.obligation_id = v.id
  ) r
  WHERE v.status = 'pending'
    AND public.payment_reminder_due_at(v.created_at, r.sent, r.last_sent) <= now();
$$;

REVOKE ALL ON FUNCTION public.due_payment_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_payment_reminders() TO service_role;


-- Claims one step of the cadence. Returns false if another sweep already took
-- it, which is the caller's signal to send nothing.
CREATE OR REPLACE FUNCTION public.record_payment_reminder(
  p_kind        TEXT,
  p_obligation  UUID,
  p_user        UUID,
  p_sequence    SMALLINT,
  p_channels    TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.payment_reminders
    (obligation_kind, obligation_id, user_id, sequence_no, channels)
  VALUES (p_kind, p_obligation, p_user, p_sequence, p_channels);
  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment_reminder(TEXT, UUID, UUID, SMALLINT, TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_reminder(TEXT, UUID, UUID, SMALLINT, TEXT[])
  TO service_role;


-- ── SECTION 6 — verification ────────────────────────────────────────────────

-- Fails the migration loudly rather than leaving a half-applied state that
-- only shows itself the first time someone does not get chased for money.
DO $verify$
BEGIN
  IF has_function_privilege('authenticated', 'public.settle_case_filing_fee(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '032 failed: settle_case_filing_fee is callable by authenticated';
  END IF;

  IF has_function_privilege('authenticated', 'public.due_payment_reminders()', 'EXECUTE') THEN
    RAISE EXCEPTION '032 failed: due_payment_reminders is callable by authenticated';
  END IF;

  IF has_table_privilege('authenticated', 'public.payment_reminders', 'INSERT') THEN
    RAISE EXCEPTION '032 failed: authenticated can write the reminder ledger';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_filing_fee_gate'
  ) THEN
    RAISE EXCEPTION '032 failed: the filing fee gate is not installed';
  END IF;

  -- The pin is what stops a complainant from writing filing_fee_paid_at
  -- themselves. Without it the gate is a suggestion.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'enforce_filing_fee_gate'
      AND prosrc LIKE '%NEW.filing_fee_paid_at  := OLD.filing_fee_paid_at%'
  ) THEN
    RAISE EXCEPTION '032 failed: the fee columns are not pinned against client writes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'settle_case_filing_fee' AND prosrc LIKE '%tsw_elevate()%'
  ) THEN
    RAISE EXCEPTION '032 failed: settle_case_filing_fee does not elevate, so its write would be discarded';
  END IF;

  -- The backfill is the one thing that cannot be re-run safely, so assert it
  -- happened rather than trusting that it did.
  IF NOT EXISTS (
    SELECT 1 FROM public.schema_migration_marks WHERE mark = '032_backfill'
  ) THEN
    RAISE EXCEPTION '032 failed: pre-existing cases were not exempted';
  END IF;
END
$verify$;

COMMENT ON TABLE public.payment_reminders IS
  'One row per reminder sent. Doubles as the cadence state and the idempotency guard — see the UNIQUE constraint.';
COMMENT ON FUNCTION public.due_payment_reminders() IS
  'Every outstanding obligation due a nudge now, across filing fees, engagement deposits and property verifications.';
