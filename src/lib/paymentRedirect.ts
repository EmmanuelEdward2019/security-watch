/**
 * Guards the hand-off to the payment provider.
 *
 * `payments-initialize` returns whatever `authorization_url` Paystack gave it,
 * and both payment screens assigned that straight to `window.location.href`.
 * The value is server-to-server over TLS and the function is ours, so this is
 * not a known hole — but an unvalidated `location.href =` is the last hop
 * before the user hands over card details, and it is the one place where a
 * compromised response turns into a convincing phishing page rather than a
 * failed request.
 *
 * The check costs nothing and bounds the damage: anything that is not a
 * Paystack checkout host over HTTPS is refused, and the payment simply fails.
 */

/** Hosts allowed to receive a payment redirect. */
const ALLOWED_HOSTS = ['checkout.paystack.com', 'paystack.com'];

export function isAllowedPaymentUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  // No http, no javascript:, no data:.
  if (url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/**
 * Navigates to the provider's checkout, or returns false if the URL is not one
 * we are willing to send a payer to. Callers surface their own error.
 */
export function goToCheckout(raw: string): boolean {
  if (!isAllowedPaymentUrl(raw)) return false;
  window.location.href = raw;
  return true;
}
