import { describe, it, expect } from 'vitest';
import {
  isSelfServe,
  openEngagementFor,
  purchasableServices,
  amountDue,
  type DepositBearing,
} from './servicePurchase';
import type { ServicePrice } from '@/types';

const price = (key: string, amount: number, isPlatform: boolean | undefined): ServicePrice =>
  ({
    id: key,
    key,
    module: 'investigation',
    label: key,
    amount,
    currency: 'NGN',
    is_active: true,
    sort_order: 0,
    updated_at: '',
    is_platform_fee: isPlatform,
  }) as ServicePrice;

// The real production catalogue, as confirmed against the live database.
const CATALOGUE = [
  price('case_filing_standard', 25000, true),
  price('case_filing_urgent', 60000, true),
  price('investigation_retainer', 150000, false),
  price('legal_processing', 120000, false),
  price('forensic_analysis', 90000, false),
  price('property_verification', 35000, true),
];

const engagement = (key: string, deposit: number, status = 'awaiting_deposit'): DepositBearing => ({
  service_key: key,
  status,
  deposit_amount: deposit,
});

describe('isSelfServe', () => {
  it('allows platform services', () => {
    expect(isSelfServe(price('case_filing_standard', 25000, true))).toBe(true);
  });

  it('refuses professional services', () => {
    expect(isSelfServe(price('investigation_retainer', 150000, false))).toBe(false);
  });

  it('degrades to self-serve when the column was not selected', () => {
    expect(isSelfServe(price('anything', 1, undefined))).toBe(true);
  });
});

describe('purchasableServices', () => {
  it('hides every professional service when nothing is booked', () => {
    const out = purchasableServices(CATALOGUE, []).map((p) => p.key);
    expect(out).toEqual(['case_filing_standard', 'case_filing_urgent', 'property_verification']);
    expect(out).not.toContain('investigation_retainer');
  });

  it('reveals exactly the professional service that was booked', () => {
    const out = purchasableServices(CATALOGUE, [engagement('investigation_retainer', 75000)]).map(
      (p) => p.key
    );
    expect(out).toContain('investigation_retainer');
    expect(out).not.toContain('legal_processing');
  });

  it('keeps a funded engagement hidden — it is already paid', () => {
    const funded = [engagement('investigation_retainer', 75000, 'funded')];
    expect(purchasableServices(CATALOGUE, funded).map((p) => p.key)).not.toContain(
      'investigation_retainer'
    );
  });
});

describe('amountDue', () => {
  // The bug this pins: the engagement panel offered "Pay NGN 75,000 deposit"
  // and checkout charged the NGN 150,000 catalogue total.
  it('charges the deposit, not the catalogue total', () => {
    const retainer = price('investigation_retainer', 150000, false);
    expect(amountDue(retainer, engagement('investigation_retainer', 75000), 1)).toBe(75000);
  });

  it('never multiplies a deposit by quantity', () => {
    const retainer = price('investigation_retainer', 150000, false);
    expect(amountDue(retainer, engagement('investigation_retainer', 75000), 7)).toBe(75000);
  });

  it('still multiplies an ordinary platform service', () => {
    expect(amountDue(price('institution_report', 10000, true), null, 3)).toBe(30000);
  });

  it('treats a zero or negative quantity as one', () => {
    expect(amountDue(price('institution_report', 10000, true), null, 0)).toBe(10000);
  });
});

describe('openEngagementFor', () => {
  it('matches only an engagement awaiting its deposit', () => {
    const rows = [engagement('legal_processing', 60000, 'funded')];
    expect(openEngagementFor(rows, 'legal_processing')).toBeNull();
  });

  it('returns null for no key', () => {
    expect(openEngagementFor([engagement('x', 1)], undefined)).toBeNull();
  });
});
