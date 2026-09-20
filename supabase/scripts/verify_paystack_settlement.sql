-- =============================================================================
-- VERIFY PAYSTACK SETTLEMENT — read-only. Run AFTER one test-mode purchase.
-- =============================================================================
-- Nothing here writes. payments-webhook is the only writer permitted to mark a
-- payment completed, and it does several things in sequence after it verifies
-- the charge. Each block below asserts one of those links, so a partial
-- failure is located rather than merely noticed.
--
-- Run in: Dashboard → SQL Editor, or `supabase db execute -f` once linked.
--
-- Test card (test mode only): 4084 0840 8408 4081, any future expiry, CVV 408.
--
-- See also: verify_paystack_keys.sh, which proves the key is correct. Run that
-- FIRST — a key mismatch leaves every row below at 'pending' and block 1 is
-- then the only symptom you will see.
-- =============================================================================


-- =============================================================================
-- 1. THE PAYMENT ROW  ← the one that matters most
-- =============================================================================
-- Created 'pending' by payments-initialize. Only the webhook may move it to
-- 'completed', and only after re-fetching the charge from Paystack and
-- matching it against the amount we priced server-side.
SELECT id, purpose, amount, currency, status, provider_reference,
       verified_at, created_at,
       provider_payload->>'status'  AS paystack_status,
       provider_payload->>'channel' AS channel
FROM public.payments
ORDER BY created_at DESC
LIMIT 5;
-- EXPECTED: status='completed', verified_at NOT NULL, paystack_status='success'.
--   status='pending' → the webhook never arrived. Either the Webhook URL is
--     wrong in the Paystack dashboard, or the signature was rejected. Check
--     the function logs for 'REJECTED — signature mismatch', then run
--     verify_paystack_keys.sh.
--   status='failed'  → it arrived, but verification or the amount check
--     refused it. Block 2 says which.


-- =============================================================================
-- 2. THE TAMPER AND ACCRUAL ALARMS
-- =============================================================================
-- payment_amount_mismatch is raised when the charge does not match what we
-- priced — an under-payment attempt. engagement_deposit_settle_failed means
-- the money is confirmed but the professional's share was never accrued,
-- which is a person owed money with no ledger record of it.
SELECT created_at, action, resource_id, details, severity
FROM public.audit_logs
WHERE action IN ('payment_amount_mismatch', 'engagement_deposit_settle_failed')
ORDER BY created_at DESC
LIMIT 10;
-- EXPECTED: 0 rows. Any row here is a settlement the webhook deliberately
-- refused, or a payout that silently did not happen. Both need a human.


-- =============================================================================
-- 3. THE PAYER WAS TOLD
-- =============================================================================
SELECT created_at, user_id, title, message, type, link
FROM public.notifications
WHERE title = 'Payment confirmed'
ORDER BY created_at DESC
LIMIT 5;
-- EXPECTED: one row per completed payment. Missing rows mean the payment
-- settled but the payer has no in-app confirmation of it.


-- =============================================================================
-- 4. PROPERTY PURCHASES REACH THE ADMIN QUEUE
-- =============================================================================
-- Only relevant if the test purchase used purpose='property_verification'.
SELECT pvr.id, pvr.status, pvr.payment_id, p.status AS payment_status, p.purpose
FROM public.property_verification_requests pvr
LEFT JOIN public.payments p ON p.id = pvr.payment_id
ORDER BY pvr.created_at DESC
LIMIT 5;
-- EXPECTED: status='in_review' wherever a property_verification payment
-- completed. Still 'pending' means the payer was charged for a review that
-- nobody has been asked to do.


-- =============================================================================
-- 5. NO ORPHANS
-- =============================================================================
-- verified_at is stamped in the same UPDATE that sets 'completed'. A completed
-- payment without one means something OTHER than the webhook wrote that
-- status, which is precisely what this design exists to prevent.
SELECT count(*) AS completed_without_verified_at
FROM public.payments
WHERE status = 'completed' AND verified_at IS NULL;
-- EXPECTED: 0. Anything else is a self-declared payment. Investigate before
-- trusting any revenue figure.
