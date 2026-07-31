import { supabase } from '@/lib/supabase';
import type { AuditLogEntry, SecuritySummary } from '@/types';

/**
 * Audit trail — read side only.
 *
 * This module used to export `logAuditEvent()`, which was never imported, so
 * nothing was ever recorded despite the README claiming audit coverage of all
 * critical operations. A client-side audit log is unenforceable in any case: the
 * caller decides whether to write it.
 *
 * Writes now come from database triggers (migration 007) and from the
 * SECURITY DEFINER RPCs, and client INSERT on `audit_logs` has been revoked. So
 * there is deliberately no write function here — recording happens whether or
 * not the UI cooperates.
 */

export interface AuditLogFilters {
  action?: string;
  resourceType?: string;
  severity?: AuditLogEntry['severity'];
  userId?: string;
  limit?: number;
  offset?: number;
}

export async function fetchAuditLogs(
  filters: AuditLogFilters = {}
): Promise<{ entries: AuditLogEntry[]; total: number; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_audit_log', {
    p_limit: filters.limit ?? 100,
    p_offset: filters.offset ?? 0,
    p_action: filters.action ?? null,
    p_resource_type: filters.resourceType ?? null,
    p_severity: filters.severity ?? null,
    p_user_id: filters.userId ?? null,
  });

  if (error) return { entries: [], total: 0, error: error.message };

  const entries = (data ?? []) as AuditLogEntry[];
  return {
    entries,
    total: entries[0]?.total_count ?? 0,
    error: null,
  };
}

/**
 * Counts of unresolved security signals for the admin dashboard.
 *
 * `guardViolations24h` is the one to watch: it counts attempts to write a
 * protected column — a role, a verification status, a published flag. A non-zero
 * value means someone is probing the API directly.
 */
export async function fetchSecuritySummary(): Promise<{
  summary: SecuritySummary | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('admin_security_summary');
  if (error) return { summary: null, error: error.message };
  return { summary: data as SecuritySummary, error: null };
}

/** Human-readable label for an audit action key. */
export function describeAuditAction(action: string): string {
  const known: Record<string, string> = {
    guard_violation: 'Blocked privileged write',
    role_changed: 'Role changed',
    kyc_status_changed: 'KYC status changed',
    case_status_changed: 'Case status changed',
    case_assigned: 'Case assigned',
    investigator_reviewed: 'Investigator reviewed',
    media_report_reviewed: 'Media report reviewed',
    property_status_changed: 'Property status changed',
    verification_request_resolved: 'Verification resolved',
    account_deletion_requested: 'Account deletion requested',
    account_deleted: 'Account deleted',
    payment_amount_mismatch: 'Payment amount mismatch',
    report_generated: 'Institution report generated',
  };
  if (known[action]) return known[action];
  return action
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}
