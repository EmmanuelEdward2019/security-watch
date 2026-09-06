import { describe, it, expect } from 'vitest';
import { buildCustodyCertificate } from './custodyExport';
import type { Evidence } from '@/types';

/**
 * The custody certificate.
 *
 * This document is intended to leave the platform and be read by a lawyer, an
 * insurer, or a court. Two things therefore matter more than usual.
 *
 * First, every value in it comes from user input — file names, descriptions and
 * custody notes are all typed by people, and one of them is a complainant
 * describing a crime. Unescaped, a file name is script in a document somebody
 * opens in a browser.
 *
 * Second, the document must not overstate what a hash proves. It attests that
 * bytes are unchanged since receipt and nothing else; a certificate that
 * implied authenticity would be worse than issuing none.
 */

const evidence = (overrides: Partial<Evidence> = {}): Evidence =>
  ({
    id: 'ev-1',
    case_id: 'case-1',
    uploaded_by: 'user-1',
    file_url: 'user-1/abc-photo.jpg',
    file_name: 'photo.jpg',
    file_type: 'image/jpeg',
    file_size: 12345,
    file_hash: 'a'.repeat(64),
    description: 'A photograph of the gate',
    chain_of_custody: [
      {
        timestamp: '2026-08-01T10:00:00.000Z',
        action: 'uploaded',
        user_id: 'user-1',
        user_name: 'Ada Obi',
        notes: 'Initial upload. SHA-256 recorded.',
      },
    ],
    created_at: '2026-08-01T10:00:00.000Z',
    ...overrides,
  }) as Evidence;

const build = (e: Evidence, verifiedNow?: boolean | null) =>
  buildCustodyCertificate({
    evidence: e,
    caseTitle: 'Test case',
    caseId: 'case-1',
    issuedBy: 'Admin',
    verifiedNow,
  });

describe('buildCustodyCertificate', () => {
  it('includes the exhibit details and the recorded hash', () => {
    const html = build(evidence());
    expect(html).toContain('photo.jpg');
    expect(html).toContain('a'.repeat(64));
    expect(html).toContain('Test case');
  });

  it('renders the custody trail using the keys the trigger writes', () => {
    // migration 004 writes timestamp / action / user_id / user_name / notes.
    // Reading a different shape silently produces empty cells.
    const html = build(evidence());
    expect(html).toContain('uploaded');
    expect(html).toContain('Ada Obi');
    expect(html).toContain('Initial upload');
  });

  it('escapes a file name containing markup', () => {
    const html = build(evidence({ file_name: '<script>alert(1)</script>.jpg' }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes a custody note containing markup', () => {
    const html = build(
      evidence({
        chain_of_custody: [
          {
            timestamp: '2026-08-01T10:00:00.000Z',
            action: 'downloaded',
            user_id: 'u',
            user_name: '<img src=x onerror=alert(1)>',
            notes: '"><script>alert(2)</script>',
          },
        ],
      } as Partial<Evidence>)
    );
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(2)</script>');
  });

  it('escapes a description containing markup', () => {
    const html = build(evidence({ description: '</dd></dl><script>alert(3)</script>' }));
    expect(html).not.toContain('<script>alert(3)</script>');
  });

  it('states the verification result at issue', () => {
    expect(build(evidence(), true)).toMatch(/Verified at issue/i);
    expect(build(evidence(), false)).toMatch(/FAILED at issue/i);
    // Not re-verified is its own statement, distinct from either outcome —
    // implying a check that never ran would be the worst of the three.
    expect(build(evidence(), null)).toMatch(/Not re-verified/i);
  });

  it('never claims authenticity', () => {
    const html = build(evidence(), true);
    expect(html).toMatch(/does not certify/i);
    expect(html).toMatch(/authenticity/i);
    expect(html).toMatch(/not\s+independently\s+corroborated/i);
  });

  it('handles an empty custody trail without breaking the table', () => {
    const html = build(evidence({ chain_of_custody: [] }));
    expect(html).toContain('No custody entries recorded');
  });

  it('survives a missing description and malformed timestamp', () => {
    const html = build(
      evidence({
        description: undefined,
        chain_of_custody: [
          { timestamp: 'not-a-date', action: 'x', user_id: 'u', user_name: 'N' },
        ],
      } as Partial<Evidence>)
    );
    expect(html).toContain('not-a-date');
    expect(html).not.toContain('Invalid Date');
  });
});

type Anchor = { anchoredAt: string; capturedAt: string | null; heldHours: number | null };

describe('buildCustodyCertificate — early anchor', () => {
  const anchor: Anchor = {
    anchoredAt: '2026-08-01T21:04:03.000Z',
    capturedAt: '2026-08-01T21:00:00.000Z',
    heldHours: 72,
  };

  const withAnchor = (a: Anchor | null) =>
    buildCustodyCertificate({
      evidence: evidence(),
      caseTitle: 'Test case',
      caseId: 'case-1',
      issuedBy: 'Admin',
      verifiedNow: true,
      anchor: a,
    });

  it('omits the paragraph entirely when there is no anchor', () => {
    // The normal case for anything uploaded from a browser. A weaker version
    // of the claim would be worse than none.
    const html = withAnchor(null);
    expect(html).not.toMatch(/registered with The Security Watch/i);
  });

  it('states the registration time and that it preceded the upload', () => {
    const html = withAnchor(anchor);
    expect(html).toMatch(/registered with The Security Watch/i);
    expect(html).toMatch(/before this file was\s+uploaded/i);
    expect(html).toMatch(/72 hours later/);
  });

  it('labels the device clock as unverified', () => {
    // The whole point of separating anchoredAt from capturedAt. Presenting a
    // device-reported time as established would be the exact overreach the
    // certificate exists to avoid.
    const html = withAnchor(anchor);
    expect(html).toMatch(/device's own clock/i);
    expect(html).toMatch(/not independently verified/i);
  });

  it('disclaims third-party notarisation in the same breath', () => {
    const html = withAnchor(anchor);
    expect(html).toMatch(/the same party\s+storing the file/i);
    expect(html).toMatch(/not\s+third-party notarisation/i);
  });

  it('says nothing about a capture time it does not have', () => {
    const html = withAnchor({ ...anchor, capturedAt: null });
    expect(html).toMatch(/registered with The Security Watch/i);
    expect(html).not.toMatch(/device's own clock/i);
  });

  it('drops the delay clause when the file arrived immediately', () => {
    const html = withAnchor({ ...anchor, heldHours: 0 });
    expect(html).not.toMatch(/hours later/);
  });

  it('singularises a one-hour delay', () => {
    const html = withAnchor({ ...anchor, heldHours: 1 });
    expect(html).toMatch(/1 hour later/);
    expect(html).not.toMatch(/1 hours later/);
  });
});
