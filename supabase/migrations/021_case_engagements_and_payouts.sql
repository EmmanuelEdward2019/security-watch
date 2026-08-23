-- ============================================================================
-- 021 — Case engagements, deposits and the payout ledger            (TSW-21)
-- ============================================================================
--
-- Until now the platform could take money and had no idea what to do with it.
--
--   * A completed `case_filing_standard` payment changed nothing. The filing
--     screen promised "the fee activates the investigation"; the webhook only
--     marked the row paid and emailed a receipt. Nothing was assigned, no
--     administrator was told a case had been funded.
--   * There was no notion of what a professional is owed. `my_earnings()`
--     returned the COMPLAINANT'S payments on cases the professional was
--     assigned to, so an investigator saw "₦25,000 earned" against a fee that
--     had never been agreed and a commission that had never been deducted.
--   * There was no payout record, no commission, and nowhere to put a bank
--     account. Paying someone meant a manual transfer with nothing written down.
--
-- The model this implements, as decided:
--
--   The filing fee is The Security Watch's revenue. It buys the case being
--   taken on, and no professional has a claim to it.
--
--   Investigative work is a separate ENGAGEMENT: an administrator books a named
--   professional against a case at a catalogue price. The complainant pays a
--   deposit (50% by default) to mobilise them. The platform holds that money
--   and releases the professional's share against a ledger, keeping its
--   commission.
--
-- DELIBERATELY NOT CALLED ESCROW. Paystack settles funds to the platform's own
-- account; there is no third party holding anything. Calling it escrow would
-- describe a legal arrangement that does not exist. The user-facing term is
-- "deposit held by The Security Watch", which is what actually happens.
--
-- Nothing has ever been charged — `payments` is empty — so there is no data to
-- migrate and no existing agreement to honour.
-- ============================================================================

-- ── SECTION 1 — what the catalogue price means ──────────────────────────────

ALTER TABLE public.service_prices
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.2000,
  ADD COLUMN IF NOT EXISTS is_platform_fee BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_prices_commission_rate_range'
  ) THEN
    ALTER TABLE public.service_prices
      ADD CONSTRAINT service_prices_commission_rate_range
      CHECK (commission_rate >= 0 AND commission_rate <= 1);
  END IF;
END;
$$;

COMMENT ON COLUMN public.service_prices.commission_rate IS
  'Platform share of this service, 0..1. Snapshotted onto an engagement at '
  'creation so a later price change cannot retroactively alter agreed terms.';

COMMENT ON COLUMN public.service_prices.is_platform_fee IS
  'True when the whole fee is platform revenue and no professional has a claim '
  'to it. The filing fee is the case in point: it buys the case being taken on.';

-- Filing fees belong entirely to The Security Watch.
UPDATE public.service_prices
SET is_platform_fee = true, commission_rate = 1.0000
WHERE key IN ('case_filing_standard', 'case_filing_urgent');

-- Professional services carry a platform commission on top of the fee earned.
UPDATE public.service_prices
SET is_platform_fee = false, commission_rate = 0.2000
WHERE key IN ('investigation_retainer', 'legal_processing', 'forensic_analysis');

-- ── SECTION 2 — where a payout is actually sent ─────────────────────────────
--
-- Separate table rather than columns on `investigators`, for two reasons: a
-- lawyer or medical expert needs one too, and bank details deserve their own
-- RLS boundary rather than riding along with a professional profile that other
-- policies already expose more widely.

CREATE TABLE IF NOT EXISTS public.payout_accounts (
  user_id        UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  bank_name      TEXT NOT NULL,
  bank_code      TEXT,
  account_number TEXT NOT NULL CHECK (account_number ~ '^[0-9]{10}$'),
  account_name   TEXT NOT NULL,
  -- Paystack transfer recipient, once created. Null until then; a payout can
  -- still be made by manual bank transfer and recorded on the ledger.
  recipient_code TEXT,
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_accounts_select" ON public.payout_accounts;
CREATE POLICY "payout_accounts_select" ON public.payout_accounts
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "payout_accounts_write" ON public.payout_accounts;
CREATE POLICY "payout_accounts_write" ON public.payout_accounts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.payout_accounts IS
  'Bank details for professionals. Owner-writable, readable by owner and admins '
  'only — never exposed through a case or profile join.';

-- ── SECTION 3 — the engagement ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.case_engagements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  professional_id    UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  professional_role  TEXT NOT NULL CHECK (professional_role IN ('investigator','lawyer','medical_expert')),

  service_key        TEXT NOT NULL REFERENCES public.service_prices(key) ON DELETE RESTRICT,
  currency           TEXT NOT NULL DEFAULT 'NGN',

  -- All four snapshotted at creation. A price or commission change later must
  -- not silently rewrite what both sides agreed.
  total_amount        NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  commission_rate     NUMERIC(5,4)  NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  commission_amount   NUMERIC(12,2) NOT NULL CHECK (commission_amount >= 0),
  professional_amount NUMERIC(12,2) NOT NULL CHECK (professional_amount >= 0),

  deposit_rate       NUMERIC(5,4) NOT NULL DEFAULT 0.5000
                       CHECK (deposit_rate > 0 AND deposit_rate <= 1),
  deposit_amount     NUMERIC(12,2) NOT NULL CHECK (deposit_amount > 0),
  deposit_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  deposit_paid_at    TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'awaiting_deposit'
    CHECK (status IN ('awaiting_deposit','funded','in_progress','completed','cancelled')),

  note        TEXT,
  created_by  UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The split must always add up. A rounding bug that quietly loses money is
  -- exactly the kind of thing nobody notices until reconciliation.
  CONSTRAINT case_engagements_split_balances
    CHECK (commission_amount + professional_amount = total_amount),

  -- One live engagement per professional per case. A cancelled one may be
  -- replaced.
  CONSTRAINT case_engagements_one_live
    EXCLUDE (case_id WITH =, professional_id WITH =)
    WHERE (status <> 'cancelled')
);

CREATE INDEX IF NOT EXISTS idx_case_engagements_case ON public.case_engagements(case_id);
CREATE INDEX IF NOT EXISTS idx_case_engagements_professional
  ON public.case_engagements(professional_id, status);

ALTER TABLE public.case_engagements ENABLE ROW LEVEL SECURITY;

-- The complainant must see what they are being asked to fund; the professional
-- must see what they have been booked for. Nobody else.
DROP POLICY IF EXISTS "case_engagements_select" ON public.case_engagements;
CREATE POLICY "case_engagements_select" ON public.case_engagements
  FOR SELECT USING (
    professional_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_engagements.case_id AND c.complainant_id = auth.uid()
    )
  );

-- Writes go through the RPCs only. An engagement a client can create is an
-- engagement a client can price.
DROP POLICY IF EXISTS "case_engagements_no_client_write" ON public.case_engagements;
CREATE POLICY "case_engagements_no_client_write" ON public.case_engagements
  FOR INSERT WITH CHECK (false);

-- ── SECTION 4 — the payout ledger ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payout_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id   UUID NOT NULL REFERENCES public.case_engagements(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,

  amount   NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',

  -- What this tranche is for, so a statement reads sensibly.
  reason TEXT NOT NULL CHECK (reason IN ('deposit_share','balance_share','adjustment')),

  status TEXT NOT NULL DEFAULT 'accrued'
    CHECK (status IN ('accrued','approved','released','cancelled')),

  approved_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  released_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  released_at TIMESTAMPTZ,
  -- Bank or Paystack transfer reference. Required to mark something released:
  -- "we paid them" with no reference is not a record.
  transfer_reference TEXT,
  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payout_ledger_released_needs_reference
    CHECK (status <> 'released' OR (transfer_reference IS NOT NULL AND released_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_payout_ledger_professional
  ON public.payout_ledger(professional_id, status);
CREATE INDEX IF NOT EXISTS idx_payout_ledger_engagement
  ON public.payout_ledger(engagement_id);

ALTER TABLE public.payout_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_ledger_select" ON public.payout_ledger;
CREATE POLICY "payout_ledger_select" ON public.payout_ledger
  FOR SELECT USING (professional_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "payout_ledger_no_client_write" ON public.payout_ledger;
CREATE POLICY "payout_ledger_no_client_write" ON public.payout_ledger
  FOR INSERT WITH CHECK (false);

COMMENT ON TABLE public.payout_ledger IS
  'What the platform owes a professional and when it was paid. Written only by '
  'SECURITY DEFINER functions; no client can insert or alter a row.';

-- ── SECTION 5 — booking an engagement ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_engagement(
  p_case_id         UUID,
  p_professional_id UUID,
  p_role            TEXT,
  p_service_key     TEXT,
  p_deposit_rate    NUMERIC DEFAULT 0.5,
  p_note            TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin      UUID := auth.uid();
  v_price      public.service_prices%ROWTYPE;
  v_role       TEXT;
  v_kyc        TEXT;
  v_commission NUMERIC(12,2);
  v_deposit    NUMERIC(12,2);
  v_id         UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can book an engagement';
  END IF;

  IF p_deposit_rate <= 0 OR p_deposit_rate > 1 THEN
    RAISE EXCEPTION 'Deposit rate must be greater than 0 and at most 1';
  END IF;

  SELECT * INTO v_price FROM public.service_prices
  WHERE key = p_service_key AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active service priced as %', p_service_key;
  END IF;

  -- A filing fee is platform revenue. Booking a professional against it would
  -- promise them a share of money that is not theirs.
  IF v_price.is_platform_fee THEN
    RAISE EXCEPTION 'That fee belongs to the platform and cannot fund an engagement';
  END IF;

  SELECT role, kyc_status INTO v_role, v_kyc
  FROM public.profiles WHERE user_id = p_professional_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'That professional does not exist';
  END IF;

  -- Same authority admin_assign_case uses. Booking someone who could not be
  -- assigned the case would create an obligation nobody can act on.
  IF v_role <> p_role THEN
    RAISE EXCEPTION 'That user is not a %', p_role;
  END IF;

  IF v_kyc <> 'approved' THEN
    RAISE EXCEPTION 'That professional has not completed verification';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cases WHERE id = p_case_id) THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  v_commission := round(v_price.amount * v_price.commission_rate, 2);
  v_deposit    := round(v_price.amount * p_deposit_rate, 2);

  INSERT INTO public.case_engagements (
    case_id, professional_id, professional_role, service_key, currency,
    total_amount, commission_rate, commission_amount, professional_amount,
    deposit_rate, deposit_amount, note, created_by
  )
  VALUES (
    p_case_id, p_professional_id, p_role, p_service_key, v_price.currency,
    v_price.amount, v_price.commission_rate, v_commission,
    -- Subtraction rather than a second round(), so the two halves always sum
    -- to the total however the rounding fell.
    v_price.amount - v_commission,
    p_deposit_rate, v_deposit, p_note, v_admin
  )
  RETURNING id INTO v_id;

  -- Tell the complainant what is being asked of them, and the professional
  -- that they have been booked.
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT c.complainant_id,
         'A deposit is needed to begin work',
         format('%s %s to mobilise your %s. The balance is due on completion.',
                v_price.currency, to_char(v_deposit, 'FM999,999,999.00'), replace(p_role, '_', ' ')),
         'info',
         '/app/cases/' || p_case_id
  FROM public.cases c WHERE c.id = p_case_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_professional_id,
          'You have been booked on a case',
          'Work begins once the complainant pays the deposit.',
          'info',
          '/app/cases/' || p_case_id);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_engagement(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_engagement(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;

-- ── SECTION 6 — a deposit lands ─────────────────────────────────────────────
--
-- Called by the payments webhook once a payment is verified. Idempotent: the
-- webhook retries, and a second call must not accrue a second tranche.

CREATE OR REPLACE FUNCTION public.settle_engagement_deposit(p_payment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pay   public.payments%ROWTYPE;
  v_eng   public.case_engagements%ROWTYPE;
  v_share NUMERIC(12,2);
BEGIN
  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND OR v_pay.status <> 'completed' OR v_pay.case_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_eng FROM public.case_engagements
  WHERE case_id = v_pay.case_id
    AND service_key = v_pay.purpose
    AND status = 'awaiting_deposit'
  ORDER BY created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.case_engagements
  SET status = 'funded',
      deposit_payment_id = p_payment_id,
      deposit_paid_at = now(),
      updated_at = now()
  WHERE id = v_eng.id;

  -- The professional's share OF THE DEPOSIT, not of the total. The balance
  -- accrues separately when the work is completed.
  v_share := round(v_eng.deposit_amount * (1 - v_eng.commission_rate), 2);

  IF v_share > 0 THEN
    INSERT INTO public.payout_ledger (engagement_id, professional_id, amount, currency, reason)
    VALUES (v_eng.id, v_eng.professional_id, v_share, v_eng.currency, 'deposit_share');
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (v_eng.professional_id,
          'Deposit received — you can begin',
          'The complainant has funded the mobilisation deposit for this case.',
          'success',
          '/app/cases/' || v_eng.case_id);

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT p.user_id, 'A case has been funded',
         'A mobilisation deposit has cleared and work can start.',
         'success', '/app/admin/cases'
  FROM public.profiles p WHERE p.role = 'admin';

  RETURN v_eng.id;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_engagement_deposit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_engagement_deposit(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.settle_engagement_deposit(UUID) FROM authenticated;

-- ── SECTION 7 — releasing money ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_release_payout(
  p_ledger_id UUID,
  p_reference TEXT,
  p_note      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.payout_ledger%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can release a payout';
  END IF;

  IF coalesce(btrim(p_reference), '') = '' THEN
    RAISE EXCEPTION 'A transfer reference is required to record a payout';
  END IF;

  SELECT * INTO v_row FROM public.payout_ledger WHERE id = p_ledger_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such payout';
  END IF;

  IF v_row.status = 'released' THEN
    RAISE EXCEPTION 'That payout was already released';
  END IF;

  IF v_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'That payout was cancelled';
  END IF;

  UPDATE public.payout_ledger
  SET status = 'released',
      released_by = auth.uid(),
      released_at = now(),
      transfer_reference = btrim(p_reference),
      note = coalesce(p_note, note),
      approved_by = coalesce(approved_by, auth.uid()),
      approved_at = coalesce(approved_at, now())
  WHERE id = p_ledger_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (v_row.professional_id,
          'Payment released',
          format('%s %s has been sent to your account.',
                 v_row.currency, to_char(v_row.amount, 'FM999,999,999.00')),
          'success',
          '/app/earnings');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_release_payout(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_release_payout(UUID, TEXT, TEXT) TO authenticated;

-- ── SECTION 8 — what a professional is actually owed ────────────────────────
--
-- Replaces the body of my_earnings(). It used to return the COMPLAINANT'S
-- payments on cases the professional was assigned to, which is a different
-- number entirely — gross of commission, and owed to nobody in particular.

-- Dropped rather than replaced: CREATE OR REPLACE cannot change a function's
-- return type, and the column list is deliberately different. The old shape
-- described the client's payments; this one describes the professional's
-- ledger. Grants are re-applied below, since DROP takes them with it.
DROP FUNCTION IF EXISTS public.my_earnings();

CREATE OR REPLACE FUNCTION public.my_earnings()
RETURNS TABLE (
  ledger_id   UUID,
  case_id     UUID,
  case_title  TEXT,
  amount      NUMERIC,
  currency    TEXT,
  status      TEXT,
  reason      TEXT,
  reference   TEXT,
  released_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.id, e.case_id, c.title, l.amount, l.currency, l.status, l.reason,
         l.transfer_reference, l.released_at, l.created_at
  FROM public.payout_ledger l
  JOIN public.case_engagements e ON e.id = l.engagement_id
  JOIN public.cases c ON c.id = e.case_id
  WHERE l.professional_id = auth.uid()
  ORDER BY l.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.my_earnings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_earnings() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_earnings() TO authenticated;

-- ── SECTION 9 — verify ──────────────────────────────────────────────────────

DO $$
DECLARE
  v_bad INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='case_engagements' AND rowsecurity) THEN
    RAISE EXCEPTION '021 failed: case_engagements missing or RLS off';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='payout_ledger' AND rowsecurity) THEN
    RAISE EXCEPTION '021 failed: payout_ledger missing or RLS off';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='payout_accounts' AND rowsecurity) THEN
    RAISE EXCEPTION '021 failed: payout_accounts missing or RLS off';
  END IF;

  -- The filing fee must be platform revenue. If this ever flips, a professional
  -- could be booked against it and promised a share of money that is not theirs.
  SELECT count(*) INTO v_bad FROM public.service_prices
  WHERE key IN ('case_filing_standard','case_filing_urgent')
    AND (is_platform_fee IS DISTINCT FROM true OR commission_rate <> 1);
  IF v_bad > 0 THEN
    RAISE EXCEPTION '021 failed: filing fees are not marked as platform revenue';
  END IF;

  -- The webhook path must not be callable by a client: it accrues money.
  IF has_function_privilege('authenticated', 'public.settle_engagement_deposit(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '021 failed: settle_engagement_deposit is callable by authenticated';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.admin_release_payout(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION '021 failed: admins cannot release a payout';
  END IF;

  -- 010's lesson, checked wherever grants are touched.
  IF NOT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION '021 failed: authenticated lost EXECUTE on is_admin()';
  END IF;

  RAISE NOTICE '021 verified';
END;
$$;
