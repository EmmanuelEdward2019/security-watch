import { describe, it, expect } from 'vitest';
import { checkPassword, passwordSchema, PASSWORD_MIN_LENGTH } from './password';

/**
 * The password policy.
 *
 * Supabase's project floor is still six characters with no complexity rule and
 * leaked-password protection off — `123456` and `password` were both accepted
 * at signup, verified against production. Until an owner raises the project
 * setting, this module is the only barrier for everyone who signs up through
 * the interface, which is everyone.
 *
 * A regression here would not fail visibly. It would quietly start accepting
 * weaker credentials on accounts that open criminal case files.
 */

describe('checkPassword', () => {
  it('accepts a password that meets the whole policy', () => {
    const result = checkPassword('Str0ng!Passw0rd');
    expect(result.acceptable).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects the passwords that were actually getting through', () => {
    // Both of these were accepted by the live project when this was written.
    for (const weak of ['123456', 'password']) {
      expect(checkPassword(weak).acceptable).toBe(false);
    }
  });

  it('enforces the length floor', () => {
    const short = 'Ab1!' + 'x'.repeat(PASSWORD_MIN_LENGTH - 5);
    expect(short.length).toBeLessThan(PASSWORD_MIN_LENGTH);
    expect(checkPassword(short).acceptable).toBe(false);
  });

  it.each([
    ['no lowercase', 'PASSW0RD!!!!'],
    ['no uppercase', 'passw0rd!!!!'],
    ['no digit', 'Password!!!!'],
    ['no symbol', 'Passw0rdAbcd'],
  ])('rejects %s', (_label, candidate) => {
    expect(checkPassword(candidate).acceptable).toBe(false);
  });

  it('rejects locally common passwords, not just global ones', () => {
    // The generic lists miss these, and they are exactly what gets used here.
    expect(checkPassword('nigeria123').acceptable).toBe(false);
    expect(checkPassword('lagos123').acceptable).toBe(false);
  });

  it('rejects a password built from the account email', () => {
    const result = checkPassword('Adebayo!2026', 'adebayo@example.com');
    expect(result.acceptable).toBe(false);
    expect(result.issues.join(' ')).toMatch(/email/i);
  });

  it('ignores a very short email local part', () => {
    // A two-letter local part would match almost anything; treating that as
    // "contains your email" would reject good passwords for no benefit.
    expect(checkPassword('Str0ng!Passw0rd', 'ab@example.com').acceptable).toBe(true);
  });

  it('rejects a single repeated character and keyboard runs', () => {
    expect(checkPassword('aaaaaaaaaaaa').acceptable).toBe(false);
    expect(checkPassword('qwertyuiop!A1').acceptable).toBe(false);
  });

  it('scores a stronger password higher', () => {
    const weak = checkPassword('Passw0rdAbcd');
    const strong = checkPassword('C0rrect-Horse-Battery!');
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('gives a common password the floor score regardless of shape', () => {
    expect(checkPassword('password123').score).toBe(0);
  });

  it('never throws on empty or missing input', () => {
    expect(() => checkPassword('')).not.toThrow();
    expect(checkPassword('').acceptable).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('agrees with checkPassword on acceptance', () => {
    // Two implementations of one policy is a drift risk; this is the guard.
    for (const candidate of [
      'Str0ng!Passw0rd',
      '123456',
      'password',
      'Passw0rdAbcd',
      'nigeria123',
    ]) {
      expect(passwordSchema.safeParse(candidate).success).toBe(
        checkPassword(candidate).acceptable
      );
    }
  });
});
