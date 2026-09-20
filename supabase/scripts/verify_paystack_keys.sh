#!/usr/bin/env bash
# =============================================================================
# VERIFY PAYSTACK KEYS — safe to run against production. Writes nothing.
# =============================================================================
# Probing the deployed functions from outside proves PAYSTACK_SECRET_KEY is
# SET (an unsigned POST to the webhook answers 401 rather than 500), but it
# cannot prove the key is CORRECT. Two gaps survive that probe:
#
#   1. The key may not belong to a real Paystack account. Checkout then fails
#      at the initialize call with a 502 and the payer sees nothing useful.
#
#   2. The key in Supabase secrets may differ from the one Paystack signs
#      with — most often a test key held against a live dashboard, or the
#      reverse. Everything looks configured, every real webhook delivery
#      401s, and payments sit at 'pending' forever while the payer is shown a
#      success page. This is the single most common way the integration
#      breaks, and nothing else in the stack reports it.
#
# This script closes both. The key is read from the environment, never written
# to disk and never echoed.
#
# Run:
#   PAYSTACK_SECRET_KEY=sk_test_xxx bash supabase/scripts/verify_paystack_keys.sh
#
# See also: verify_paystack_settlement.sql, which checks the money landed.
# =============================================================================
set -u

WH="https://pqjwzidrgkskpjihxvxa.supabase.co/functions/v1/payments-webhook"
KEY="${PAYSTACK_SECRET_KEY:-}"

if [ -z "$KEY" ]; then
  echo "✗ PAYSTACK_SECRET_KEY is not set in this shell."
  echo "  Run:  PAYSTACK_SECRET_KEY=sk_test_xxx bash $0"
  exit 1
fi

case "$KEY" in
  sk_test_*) MODE="TEST" ;;
  sk_live_*) MODE="LIVE" ;;
  *) echo "✗ Key does not start with sk_test_ or sk_live_, so it is not a"
     echo "  Paystack SECRET key. A pk_ key is the public one and fails both"
     echo "  checks below."; exit 1 ;;
esac
echo "Key mode: $MODE"

echo
echo "── A. Is the key valid at Paystack?"
A=$(curl -s -o /tmp/pk_a -w '%{http_code}' https://api.paystack.co/balance \
      -H "Authorization: Bearer $KEY")
if [ "$A" = "200" ]; then
  echo "   ✓ HTTP 200 — Paystack accepted the key."
  echo "     $(head -c 200 /tmp/pk_a)"
else
  echo "   ✗ HTTP $A — Paystack REJECTED the key."
  echo "     payments-initialize will answer 502 'The payment provider declined'."
  echo "     $(head -c 200 /tmp/pk_a)"
  rm -f /tmp/pk_a; exit 1
fi
rm -f /tmp/pk_a

echo
echo "── B. Does the deployed webhook accept a signature from THIS key?"
# Deliberately unknown reference. payments-webhook looks it up, finds nothing,
# and returns {received:true} without writing. Nothing is mutated, and a
# forged reference could not settle anyway — the handler re-verifies every
# charge against Paystack before marking it completed.
REF="verify_probe_$(date +%s)_$RANDOM"
BODY="{\"event\":\"charge.success\",\"data\":{\"reference\":\"$REF\"}}"
SIG=$(printf '%s' "$BODY" | openssl dgst -sha512 -hmac "$KEY" -hex | awk '{print $NF}')
B=$(curl -s -o /tmp/pk_b -w '%{http_code}' -X POST "$WH" \
      -H 'Content-Type: application/json' \
      -H "x-paystack-signature: $SIG" -d "$BODY")
echo "   HTTP $B — $(head -c 200 /tmp/pk_b)"
rm -f /tmp/pk_b
case "$B" in
  200) echo "   ✓ Signature ACCEPTED. Supabase holds this same key." ;;
  401) echo "   ✗ Signature REJECTED. Supabase holds a DIFFERENT key."
       echo "     Every real webhook will 401 and no payment will ever settle."
       echo "     Fix: supabase secrets set PAYSTACK_SECRET_KEY=<the key just tested>"
       exit 1 ;;
  *)   echo "   ? Unexpected status — check the function logs."; exit 1 ;;
esac

echo
echo "── Result"
echo "   Key is valid AND matches Supabase. Confirm the Paystack dashboard is"
echo "   in $MODE mode; a $MODE key against the other mode will not match on"
echo "   real deliveries, which is exactly the failure check B is built to catch."
