import { z } from 'zod';

/**
 * Password policy.
 *
 * Supabase's project-level minimum is 6 characters with no complexity rule and
 * leaked-password protection disabled, so `123456` and `password` were both
 * accepted at signup — verified against production. On a platform where an
 * investigator account opens criminal case files, complainant identities and
 * filed evidence, that is not a defensible floor.
 *
 * This raises the bar in the client. It is not a substitute for the project
 * setting — anyone can call the auth endpoint directly and bypass this — but it
 * covers everyone who signs up through the interface, which is everyone.
 *
 * The dashboard settings still need raising: Authentication → Providers → Email
 * (minimum length, required characters) and Authentication → Attack Protection
 * (leaked password protection).
 */

const MIN_LENGTH = 10;

/**
 * Passwords seen constantly in credential-stuffing lists. This is a stopgap for
 * the Have I Been Pwned check being switched off at the project level, not a
 * replacement for it — HIBP covers hundreds of millions of entries.
 */
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssword', 'p@ssw0rd',
  '12345678', '123456789', '1234567890', 'qwertyuiop', 'qwerty123',
  'iloveyou', 'admin123', 'welcome1', 'welcome123', 'letmein1',
  'football', 'baseball', 'superman', 'trustno1', 'sunshine',
  'security', 'securitywatch', 'nigeria123', 'lagos123',
]);

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  issues: string[];
  acceptable: boolean;
}

export function checkPassword(password: string, email?: string): PasswordStrength {
  const issues: string[] = [];
  const pw = password ?? '';
  const lower = pw.toLowerCase();

  if (pw.length < MIN_LENGTH) {
    issues.push(`Use at least ${MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(pw)) issues.push('Add a lowercase letter');
  if (!/[A-Z]/.test(pw)) issues.push('Add an uppercase letter');
  if (!/\d/.test(pw)) issues.push('Add a number');
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push('Add a symbol');

  if (COMMON.has(lower)) {
    issues.push('This is one of the most commonly used passwords');
  }

  // A password built from the account's own email is trivially guessable.
  if (email) {
    const localPart = email.split('@')[0]?.toLowerCase();
    if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
      issues.push('Do not use your email address in your password');
    }
  }

  if (/^(.)\1+$/.test(pw)) issues.push('Do not repeat a single character');
  if (/^(?:0123456789|abcdefghij|qwertyuiop)/.test(lower)) {
    issues.push('Avoid keyboard and number sequences');
  }

  // Scored on variety and length rather than raw entropy — the point is to
  // steer people upward, not to be precise.
  let score = 0;
  if (pw.length >= MIN_LENGTH) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (COMMON.has(lower)) score = 0;

  const bounded = Math.min(score, 4) as PasswordStrength['score'];
  const labels: PasswordStrength['label'][] = [
    'Too weak', 'Weak', 'Fair', 'Strong', 'Very strong',
  ];

  return {
    score: bounded,
    label: labels[bounded],
    issues,
    acceptable: issues.length === 0,
  };
}

/** Zod schema for any form that sets a password. */
export const passwordSchema = z
  .string()
  .min(MIN_LENGTH, `Password must be at least ${MIN_LENGTH} characters`)
  .refine((v) => /[a-z]/.test(v), 'Include a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Include an uppercase letter')
  .refine((v) => /\d/.test(v), 'Include a number')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Include a symbol')
  .refine((v) => !COMMON.has(v.toLowerCase()), 'That password is too common to be safe');

export const PASSWORD_MIN_LENGTH = MIN_LENGTH;
