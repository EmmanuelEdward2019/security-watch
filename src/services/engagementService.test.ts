import { describe, it, expect } from 'vitest';
import { previewSplit, type BookableService } from './engagementService';

/**
 * The engagement split.
 *
 * previewSplit shows an administrator what they are committing to before they
 * book. admin_create_engagement then computes the same figures in SQL and
 * writes them. If the two ever disagree, the administrator agrees one number on
 * a professional's behalf and a different one is recorded — the kind of fault
 * nobody notices until reconciliation, months later, over real money.
 *
 * These cases are the live catalogue, verified against the database at the time
 * the feature shipped.
 */

const service = (amount: number, commission_rate: number): BookableService => ({
  key: 'test_service',
  label: 'Test service',
  amount,
  currency: 'NGN',
  commission_rate,
});

describe('previewSplit', () => {
  it.each([
    // amount, rate, commission, professional, deposit@50%, deposit share
    [150_000, 0.2, 30_000, 120_000, 75_000, 60_000], // investigation_retainer
    [120_000, 0.2, 24_000, 96_000, 60_000, 48_000], // legal_processing
    [90_000, 0.2, 18_000, 72_000, 45_000, 36_000], // forensic_analysis
  ])(
    'matches the SQL for %i at %f commission',
    (amount, rate, commission, professional, deposit, depositShare) => {
      const split = previewSplit(service(amount, rate), 0.5);

      expect(split.commission).toBe(commission);
      expect(split.professional).toBe(professional);
      expect(split.deposit).toBe(deposit);
      expect(split.depositProfessionalShare).toBe(depositShare);
    }
  );

  it('never loses money to rounding', () => {
    // A rate and amount chosen to produce a repeating decimal. The database
    // has a CHECK that commission + professional = total, so a split that does
    // not balance is rejected at write time — better to fail here.
    const split = previewSplit(service(99_999.99, 0.333), 0.5);
    expect(split.commission + split.professional).toBeCloseTo(99_999.99, 2);
  });

  it('gives the professional everything at a zero commission', () => {
    const split = previewSplit(service(50_000, 0), 0.5);
    expect(split.commission).toBe(0);
    expect(split.professional).toBe(50_000);
  });

  it('gives the professional nothing at full commission', () => {
    // This is the platform-fee shape. admin_create_engagement refuses to book
    // such a service at all, but the arithmetic must still be coherent.
    const split = previewSplit(service(25_000, 1), 0.5);
    expect(split.commission).toBe(25_000);
    expect(split.professional).toBe(0);
    expect(split.depositProfessionalShare).toBe(0);
  });

  it('scales the deposit with its rate', () => {
    const full = previewSplit(service(100_000, 0.2), 1);
    expect(full.deposit).toBe(100_000);
    expect(full.depositProfessionalShare).toBe(80_000);

    const quarter = previewSplit(service(100_000, 0.2), 0.25);
    expect(quarter.deposit).toBe(25_000);
    expect(quarter.depositProfessionalShare).toBe(20_000);
  });

  it('never accrues more to the professional than they are owed in total', () => {
    // The deposit share is a tranche of the professional's total, never more.
    // Exceeding it would pay someone for work not yet agreed.
    const split = previewSplit(service(150_000, 0.2), 1);
    expect(split.depositProfessionalShare).toBeLessThanOrEqual(split.professional);
  });
});
