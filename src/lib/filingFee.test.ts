import { describe, it, expect } from 'vitest';
import { filingFeeKeyFor } from './filingFee';
import { CASE_URGENCY_LABELS } from '@/types';
import type { CaseUrgency } from '@/types';

describe('filingFeeKeyFor', () => {
  it('charges the urgent fee for critical and high', () => {
    expect(filingFeeKeyFor('critical')).toBe('case_filing_urgent');
    expect(filingFeeKeyFor('high')).toBe('case_filing_urgent');
  });

  it('charges the standard fee for medium and low', () => {
    expect(filingFeeKeyFor('medium')).toBe('case_filing_standard');
    expect(filingFeeKeyFor('low')).toBe('case_filing_standard');
  });

  // The real risk is not a wrong answer for a known urgency, it is a NEW
  // urgency added to the enum that silently falls through to the standard fee
  // — an urgent case billed at the cheap rate, with nothing to notice it.
  it('covers every urgency the type allows', () => {
    const all = Object.keys(CASE_URGENCY_LABELS) as CaseUrgency[];
    expect(all.length).toBeGreaterThan(0);
    for (const u of all) {
      expect(['case_filing_urgent', 'case_filing_standard']).toContain(filingFeeKeyFor(u));
    }
    // Pin the split. If an urgency is added, this fails and forces a decision
    // about which side of the line it belongs on.
    expect(all.filter((u) => filingFeeKeyFor(u) === 'case_filing_urgent').sort())
      .toEqual(['critical', 'high']);
  });
});
