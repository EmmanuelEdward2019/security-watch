import { describe, it, expect } from 'vitest';
import { isAllowedPaymentUrl } from './paymentRedirect';

/**
 * The last hop before someone types their card details.
 *
 * This check bounds what a compromised or tampered response can do: anything
 * that is not a Paystack checkout host over HTTPS is refused and the payment
 * simply fails. A regression here would not break any flow — it would quietly
 * widen the set of places the platform is willing to send a payer, which is
 * precisely the sort of change that gets through review.
 */

describe('isAllowedPaymentUrl', () => {
  it('accepts Paystack checkout', () => {
    expect(isAllowedPaymentUrl('https://checkout.paystack.com/abc123')).toBe(true);
    expect(isAllowedPaymentUrl('https://paystack.com/pay/xyz')).toBe(true);
  });

  it('accepts Paystack subdomains', () => {
    expect(isAllowedPaymentUrl('https://api.paystack.com/x')).toBe(true);
  });

  it('refuses plain HTTP even on an allowed host', () => {
    // Card details must never be handed over an unencrypted hop.
    expect(isAllowedPaymentUrl('http://checkout.paystack.com/abc')).toBe(false);
  });

  it('refuses other hosts', () => {
    expect(isAllowedPaymentUrl('https://evil.example.com/checkout')).toBe(false);
  });

  it('refuses a lookalike that merely ends with the brand', () => {
    // The check is on the host, not a substring — `notpaystack.com` and
    // `paystack.com.evil.co` must both fail.
    expect(isAllowedPaymentUrl('https://notpaystack.com/pay')).toBe(false);
    expect(isAllowedPaymentUrl('https://paystack.com.evil.co/pay')).toBe(false);
  });

  it('refuses a host embedded in the path or credentials', () => {
    expect(isAllowedPaymentUrl('https://evil.com/https://checkout.paystack.com')).toBe(false);
    expect(isAllowedPaymentUrl('https://checkout.paystack.com@evil.com/pay')).toBe(false);
  });

  it('refuses non-http schemes', () => {
    expect(isAllowedPaymentUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedPaymentUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('refuses anything unparseable', () => {
    expect(isAllowedPaymentUrl('')).toBe(false);
    expect(isAllowedPaymentUrl('not a url')).toBe(false);
    expect(isAllowedPaymentUrl('//checkout.paystack.com/pay')).toBe(false);
  });

  it('is case-insensitive on the host', () => {
    expect(isAllowedPaymentUrl('https://CHECKOUT.PAYSTACK.COM/abc')).toBe(true);
  });
});
