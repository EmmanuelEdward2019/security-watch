import { supabase } from '@/lib/supabase';
import type { Evidence, CustodyLog } from '@/types';

/**
 * A chain-of-custody certificate for one exhibit.
 *
 * The platform already hashes evidence on upload, re-checks that hash every
 * time the file is opened, and records each access. All of that lived only
 * inside the app — so the integrity claim was true but unusable anywhere it
 * matters, which is outside the platform: with a lawyer, an insurer, a court.
 *
 * This renders the record as a self-contained document that can be printed or
 * saved as PDF from the browser's print dialogue.
 *
 * It states what the platform can actually attest to and no more. Specifically
 * it does NOT claim the file is authentic or that its contents are true — only
 * that the bytes are unchanged since they were received, which is the single
 * thing a hash can support. Overstating that in a document intended for legal
 * use would be worse than issuing nothing.
 */

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  // Explicit timezone: a custody record whose times cannot be placed against a
  // clock is far less useful to whoever reads it later.
  return `${date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')} UTC`;
}

export interface CustodyCertificateInput {
  evidence: Evidence;
  caseTitle: string;
  caseId: string;
  /** Who generated it — recorded on the document itself. */
  issuedBy: string;
  /** Result of a verification run immediately before issuing, if one was made. */
  verifiedNow?: boolean | null;
  /**
   * When the platform first saw this file's digest, if it was registered
   * before the bytes were uploaded (migration 028). Materially strengthens the
   * claim — see the paragraph it produces below.
   */
  anchor?: {
    anchoredAt: string;
    /** Device clock at capture. UNVERIFIED, and labelled so on the document. */
    capturedAt: string | null;
    /** Hours the file existed off-platform between anchoring and arrival. */
    heldHours: number | null;
  } | null;
}

export function buildCustodyCertificate(input: CustodyCertificateInput): string {
  const { evidence, caseTitle, caseId, issuedBy, verifiedNow, anchor } = input;
  const trail = (evidence.chain_of_custody ?? []) as CustodyLog[];

  const verificationLine =
    verifiedNow === true
      ? '<span class="ok">Verified at issue — the stored file hashes to the value recorded on receipt.</span>'
      : verifiedNow === false
        ? '<span class="bad">FAILED at issue — the stored file does NOT hash to the recorded value. This exhibit must not be relied upon.</span>'
        : '<span class="muted">Not re-verified at the time this certificate was issued.</span>';

  /*
   * The early-anchor paragraph.
   *
   * This is the strongest statement the platform can make about WHEN, so the
   * wording is careful in both directions. It says the digest was registered
   * before the bytes arrived, which narrows the window in which the file could
   * have been fabricated. It also says, in the same breath, that the platform
   * is the attesting party and that the capture time came from a device clock
   * nobody verified — because a certificate that let a reader infer
   * independent notarisation would be worse than one that said nothing.
   */
  const anchorBlock = anchor
    ? `
  <div class="scope">
    <strong>Digest registered before upload.</strong> The SHA-256 above was
    registered with The Security Watch at
    ${escapeHtml(formatTimestamp(anchor.anchoredAt))}, before this file was
    uploaded${
      anchor.heldHours !== null && anchor.heldHours > 0
        ? ` — the bytes themselves arrived approximately ${anchor.heldHours} hour${anchor.heldHours === 1 ? '' : 's'} later`
        : ''
    }. The uploaded file matches that digest. This narrows the period in which
    the file could have been altered to the time before it was registered.
    ${
      anchor.capturedAt
        ? `The capturing device reported a recording time of ${escapeHtml(formatTimestamp(anchor.capturedAt))}; that figure comes from the device's own clock and is not independently verified.`
        : ''
    }
    Note that the registering party is The Security Watch, the same party
    storing the file. This is a strengthening of the platform's own record, not
    third-party notarisation.
  </div>`
    : '';

  const rows = trail.length
    ? trail
        .map(
          // Keys come from the trigger in migration 004 and append_custody_entry:
          // timestamp / action / user_id / user_name / notes. `user_name` is
          // resolved server-side at write time, so the record survives a later
          // profile rename — which is the point of a custody log.
          (entry) => `
          <tr>
            <td>${formatTimestamp(entry.timestamp)}</td>
            <td>${escapeHtml(entry.action)}</td>
            <td>${escapeHtml(entry.user_name || entry.user_id)}</td>
            <td>${escapeHtml(entry.notes ?? '')}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="4" class="muted">No custody entries recorded.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Chain of custody — ${escapeHtml(evidence.file_name)}</title>
<style>
  :root { color-scheme: light; }
  body { font: 13px/1.55 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         color: #18181b; margin: 0; padding: 40px; max-width: 820px; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em;
       color: #52525b; margin: 28px 0 8px; }
  .sub { color: #52525b; margin: 0 0 24px; }
  .rule { height: 3px; background: #1b4332; margin: 0 0 20px; }
  dl { display: grid; grid-template-columns: 190px 1fr; gap: 6px 16px; margin: 0; }
  dt { color: #52525b; }
  dd { margin: 0; }
  code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #52525b; }
  .ok   { color: #15803d; font-weight: 600; }
  .bad  { color: #b91c1c; font-weight: 700; }
  .muted{ color: #71717a; }
  .scope { margin-top: 28px; padding: 14px 16px; background: #fafafa;
           border-left: 3px solid #1b4332; color: #3f3f46; }
  footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e4e4e7;
           color: #71717a; font-size: 11px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="rule"></div>
  <h1>Chain of Custody Certificate</h1>
  <p class="sub">The Security Watch</p>

  <h2>Exhibit</h2>
  <dl>
    <dt>File name</dt><dd>${escapeHtml(evidence.file_name)}</dd>
    <dt>Type</dt><dd>${escapeHtml(evidence.file_type)}</dd>
    <dt>Size</dt><dd>${escapeHtml(evidence.file_size)} bytes</dd>
    <dt>SHA-256 on receipt</dt><dd><code>${escapeHtml(evidence.file_hash)}</code></dd>
    <dt>Received</dt><dd>${formatTimestamp(evidence.created_at)}</dd>
    <dt>Description</dt><dd>${escapeHtml(evidence.description ?? '—')}</dd>
  </dl>

  <h2>Case</h2>
  <dl>
    <dt>Title</dt><dd>${escapeHtml(caseTitle)}</dd>
    <dt>Case reference</dt><dd><code>${escapeHtml(caseId)}</code></dd>
  </dl>

  <h2>Integrity</h2>
  <p>${verificationLine}</p>

  <h2>Access record</h2>
  <table>
    <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${anchorBlock}

  <div class="scope">
    <strong>What this certifies.</strong> The Security Watch recorded the SHA-256
    digest above when this file was received, and re-computes it whenever the file
    is retrieved. A match establishes that the stored bytes are unchanged since
    receipt.
    <br><br>
    <strong>What it does not certify.</strong> It makes no statement about the
    authenticity of the file, the truth of its contents, the circumstances of its
    capture, or the identity of whoever produced it. Timestamps for material
    captured on a personal device are reported by that device and are not
    independently corroborated.
  </div>

  <footer>
    Issued ${formatTimestamp(new Date().toISOString())} by ${escapeHtml(issuedBy)}.
    Generated from the platform record; it is not a substitute for a forensic examination.
  </footer>
</body>
</html>`;
}

/** Opens the certificate in a new tab, ready to print or save as PDF. */
export function openCustodyCertificate(html: string): boolean {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  // Popup blocked. The caller surfaces this — silently doing nothing would
  // look like the button is broken.
  if (!win) return false;

  win.document.write(html);
  win.document.close();
  return true;
}

/**
 * When the platform first saw this exhibit's digest, if it was registered
 * before the bytes arrived.
 *
 * Returns null for anything uploaded straight from a browser, which was never
 * anchored — that is the normal case and not a fault. The certificate simply
 * omits the paragraph rather than making a weaker version of the claim.
 */
export async function fetchEvidenceAnchor(evidenceId: string): Promise<
  { anchoredAt: string; capturedAt: string | null; heldHours: number | null } | null
> {
  const { data, error } = await supabase.rpc('evidence_anchor_for', {
    p_evidence_id: evidenceId,
  });

  if (error) return null;

  const row = Array.isArray(data) ? data[0] : null;
  // `fulfilled_at` is what says the bytes actually arrived and matched. An
  // anchor without it is a digest still waiting for its file, and has nothing
  // to say about an exhibit that already exists.
  if (!row?.anchored_at || !row?.fulfilled_at) return null;

  return {
    anchoredAt: row.anchored_at,
    capturedAt: row.captured_at ?? null,
    heldHours: row.held_hours ?? null,
  };
}
