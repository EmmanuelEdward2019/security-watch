import type { CaseUrgency } from '@/types';

/**
 * Which filing fee a case attracts.
 *
 * This mapping exists in three places by necessity: here for the two screens
 * that quote the figure, and again in SQL inside due_payment_reminders(),
 * which has to price an obligation without a browser. The copies must agree —
 * if they drift, a complainant is shown one amount, chased for a second and
 * charged a third by payments-initialize, which prices from the catalogue
 * server-side and is the only one of the three that moves money.
 *
 * Keeping the client halves in one tested function is what makes that drift a
 * test failure rather than a support ticket. The SQL copy is covered by the
 * comment above it in 032.
 */
export function filingFeeKeyFor(urgency: CaseUrgency): 'case_filing_urgent' | 'case_filing_standard' {
  return urgency === 'critical' || urgency === 'high'
    ? 'case_filing_urgent'
    : 'case_filing_standard';
}
