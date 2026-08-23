-- ============================================================================
-- 022 — Only professional services can fund an engagement          (TSW-21a)
-- ============================================================================
--
-- Corrects the seeding in 021. That migration marked the two filing fees as
-- platform revenue and gave the three professional services a 20% commission,
-- but left the remaining five on the column DEFAULT of 0.2 with
-- is_platform_fee = false.
--
-- The consequence: `admin_create_engagement()` refuses a service only when
-- `is_platform_fee` is true, so property verification, listing boost, tenant
-- background, institution reports and archive access were all bookable as
-- professional engagements. Booking one would have accrued a payout against
-- money nobody had agreed to share — for work the platform itself performs.
--
-- An engagement is a person doing chargeable work on a case. Exactly three
-- services are that:
--
--   investigation_retainer   an investigator engaged on a case
--   legal_processing         a lawyer engaged on a case
--   forensic_analysis        a medical or forensic expert engaged on a case
--
-- Everything else is the platform selling its own service, and belongs to The
-- Security Watch in full — the same rule already applied to the filing fee.
--
-- Nothing is live: `case_engagements` and `payout_ledger` are both empty, so no
-- agreement is being rewritten.
-- ============================================================================

UPDATE public.service_prices
SET is_platform_fee = true,
    commission_rate = 1.0000
WHERE key NOT IN ('investigation_retainer', 'legal_processing', 'forensic_analysis');

-- ── Verify ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_bookable INT;
  v_engagements INT;
BEGIN
  -- Exactly the three professional services may fund an engagement.
  SELECT count(*) INTO v_bookable
  FROM public.service_prices
  WHERE NOT is_platform_fee;

  IF v_bookable <> 3 THEN
    RAISE EXCEPTION
      '022 failed: % service(s) are bookable as engagements, expected exactly 3', v_bookable;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.service_prices
    WHERE NOT is_platform_fee
      AND key NOT IN ('investigation_retainer','legal_processing','forensic_analysis')
  ) THEN
    RAISE EXCEPTION '022 failed: a non-professional service is bookable as an engagement';
  END IF;

  -- A platform-only service must keep the whole fee.
  IF EXISTS (SELECT 1 FROM public.service_prices WHERE is_platform_fee AND commission_rate <> 1) THEN
    RAISE EXCEPTION '022 failed: a platform-only service does not keep the full fee';
  END IF;

  -- This correction is only safe because nothing has been booked yet. If that
  -- ever stops being true, the fix has to consider existing agreements.
  SELECT count(*) INTO v_engagements FROM public.case_engagements;
  IF v_engagements > 0 THEN
    RAISE WARNING
      '022: % engagement(s) already exist; their snapshotted terms are unchanged, '
      'which is correct, but review that none were booked against a service now '
      'marked platform-only.', v_engagements;
  END IF;

  RAISE NOTICE '022 verified';
END;
$$;
