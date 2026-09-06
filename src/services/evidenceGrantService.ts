import { supabase } from '@/lib/supabase';

/**
 * Time-boxed, revocable access to evidence.
 *
 * The alternative it replaces is a download, which cannot be expired,
 * withdrawn, counted, or attributed. For material a complainant is handing to
 * an officer they do not entirely trust, that difference is the whole product.
 *
 * THE TOKEN IS RETURNED EXACTLY ONCE. The database keeps only its SHA-256, so
 * there is no call that reads a link back — not for us, not for support, not
 * for anyone with database access. A lost link is reissued. Any UI built on
 * this must therefore make the one-time display unmissable, because "I'll copy
 * it later" is not available.
 *
 * The watermark is drawn by the viewer page, so it deters and attributes; it is
 * not forensic and the interface says so. What actually constrains a recipient
 * is that every open is counted against their name and the grant can be pulled
 * mid-use.
 */

export interface EvidenceGrant {
  id: string;
  evidenceId: string | null;
  /** The exhibit's file name, or null for a grant covering the whole case. */
  evidenceName: string | null;
  recipientName: string;
  recipientEmail: string | null;
  purpose: string | null;
  createdByName: string | null;
  expiresAt: string;
  revokedAt: string | null;
  maxViews: number | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  /** Not derived here — the database decides, including the view ceiling. */
  isLive: boolean;
}

export interface IssuedGrant {
  grantId: string;
  /** Shown once and never retrievable again. */
  token: string;
  expiresAt: string;
}

interface RawGrant {
  id: string;
  evidence_id: string | null;
  evidence_name: string | null;
  recipient_name: string;
  recipient_email: string | null;
  purpose: string | null;
  created_by_name: string | null;
  expires_at: string;
  revoked_at: string | null;
  max_views: number | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  is_live: boolean;
}

export async function fetchCaseGrants(
  caseId: string
): Promise<{ grants: EvidenceGrant[]; error: string | null }> {
  const { data, error } = await supabase.rpc('case_evidence_grants', {
    p_case_id: caseId,
  });

  if (error) return { grants: [], error: error.message };

  return {
    grants: ((data ?? []) as RawGrant[]).map((r) => ({
      id: r.id,
      evidenceId: r.evidence_id ?? null,
      evidenceName: r.evidence_name ?? null,
      recipientName: r.recipient_name,
      recipientEmail: r.recipient_email ?? null,
      purpose: r.purpose ?? null,
      createdByName: r.created_by_name ?? null,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at ?? null,
      maxViews: r.max_views ?? null,
      viewCount: r.view_count ?? 0,
      lastViewedAt: r.last_viewed_at ?? null,
      createdAt: r.created_at,
      isLive: Boolean(r.is_live),
    })),
    error: null,
  };
}

export async function createGrant(input: {
  caseId: string;
  recipientName: string;
  expiresInHours?: number;
  evidenceId?: string | null;
  recipientEmail?: string | null;
  purpose?: string | null;
  maxViews?: number | null;
}): Promise<{ grant: IssuedGrant | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_evidence_grant', {
    p_case_id: input.caseId,
    p_recipient_name: input.recipientName,
    p_expires_in_hours: input.expiresInHours ?? 72,
    p_evidence_id: input.evidenceId ?? undefined,
    p_recipient_email: input.recipientEmail ?? undefined,
    p_purpose: input.purpose ?? undefined,
    p_max_views: input.maxViews ?? undefined,
  });

  if (error) return { grant: null, error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { grant: null, error: 'No grant was returned.' };

  return {
    grant: { grantId: row.grant_id, token: row.token, expiresAt: row.expires_at },
    error: null,
  };
}

export async function revokeGrant(grantId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('revoke_evidence_grant', { p_grant_id: grantId });
  return { error: error?.message ?? null };
}

/** The link handed to a recipient. Built from the token, which is shown once. */
export function grantUrl(token: string): string {
  return `${window.location.origin}/evidence/${token}`;
}

/** Plain words for what a grant is currently doing. */
export function grantState(g: EvidenceGrant): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'default';
} {
  if (g.revokedAt) return { label: 'Withdrawn', tone: 'danger' };
  if (new Date(g.expiresAt) <= new Date()) return { label: 'Expired', tone: 'default' };
  if (g.maxViews !== null && g.viewCount >= g.maxViews) {
    return { label: 'View limit reached', tone: 'default' };
  }
  if (g.viewCount > 0) return { label: 'Open · viewed', tone: 'success' };
  return { label: 'Open · not yet viewed', tone: 'warning' };
}

// ── The recipient's side ────────────────────────────────────────────────────

export interface GrantedEvidence {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  fileHash: string | null;
  description: string | null;
  createdAt: string;
  /** Short-lived signed URL. Null when signing failed for this exhibit. */
  url: string | null;
}

export interface OpenedGrant {
  caseTitle: string;
  recipientName: string;
  purpose: string | null;
  expiresAt: string;
  viewsLeft: number | null;
  urlTtlSeconds: number;
  evidence: GrantedEvidence[];
}

/**
 * Redeems a token.
 *
 * Goes through the edge function, not the database directly: signing storage
 * URLs needs the service role, and the caller here has no account at all. The
 * function counts the open, so calling this twice counts twice — it belongs at
 * the top of a page load and nowhere else.
 */
export async function openGrant(
  token: string
): Promise<{ grant: OpenedGrant | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('evidence-grant', {
    body: { token },
  });

  if (error) {
    // The function answers 404 with a deliberately uniform message for
    // expired, revoked, exhausted and never-existed. Preserve that: telling a
    // holder which one applies confirms the link was once real.
    const message =
      (data as { error?: string } | null)?.error ??
      'This link is no longer valid. It may have expired or been withdrawn.';
    return { grant: null, error: message };
  }

  const payload = data as {
    case_title: string;
    recipient_name: string;
    purpose: string | null;
    expires_at: string;
    views_left: number | null;
    url_ttl_seconds: number;
    evidence: {
      id: string;
      file_name: string;
      file_type: string;
      file_size: number | null;
      file_hash: string | null;
      description: string | null;
      created_at: string;
      url: string | null;
    }[];
  };

  return {
    grant: {
      caseTitle: payload.case_title,
      recipientName: payload.recipient_name,
      purpose: payload.purpose,
      expiresAt: payload.expires_at,
      viewsLeft: payload.views_left,
      urlTtlSeconds: payload.url_ttl_seconds,
      evidence: (payload.evidence ?? []).map((e) => ({
        id: e.id,
        fileName: e.file_name,
        fileType: e.file_type,
        fileSize: e.file_size,
        fileHash: e.file_hash,
        description: e.description,
        createdAt: e.created_at,
        url: e.url,
      })),
    },
    error: null,
  };
}
