/**
 * Asks the browser to remember a password after a successful sign-in.
 *
 * The login form already has everything the heuristics want — a real `<form>`,
 * `autoComplete="username"` and `"current-password"`, and named fields from
 * React Hook Form. What it does not have is a real navigation: the submit is
 * `preventDefault`ed and success ends in `navigate(path, { replace: true })`,
 * a History replaceState. Chrome's "Save password?" prompt keys off a form
 * submission followed by a navigation it recognises, and a replaceState inside
 * a single-page app frequently is not one — so the prompt never appeared and
 * the browser never learned the credential.
 *
 * The Credential Management API removes the guesswork by asking outright.
 * Chromium-only, secure contexts only, and it throws rather than resolving in
 * several ordinary situations (an iframe, a user who has disabled the manager,
 * a browser that exposes the constructor but not the store). None of that is
 * an error worth showing anyone: the sign-in has already succeeded, and a
 * password the browser declined to remember costs one extra typing next time.
 * So every failure here is swallowed deliberately.
 */

interface PasswordCredentialInit {
  id: string;
  password: string;
  name?: string;
}

type PasswordCredentialCtor = new (data: PasswordCredentialInit) => Credential;

/** True when this browser can be asked at all. */
export function canStoreCredentials(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    'credentials' in navigator &&
    typeof navigator.credentials?.store === 'function' &&
    'PasswordCredential' in window
  );
}

/**
 * Offers the credential to the browser's password manager.
 *
 * Call it while the login form is still mounted and BEFORE navigating away —
 * the prompt is tied to the page that submitted.
 *
 * Returns whether the browser accepted it, for tests and for logging. Never
 * throws and never rejects.
 */
export async function offerCredentialToBrowser(
  email: string,
  password: string,
  displayName?: string
): Promise<boolean> {
  if (!canStoreCredentials()) return false;
  if (!email || !password) return false;

  try {
    const Ctor = (window as unknown as { PasswordCredential: PasswordCredentialCtor })
      .PasswordCredential;
    const credential = new Ctor({
      id: email,
      password,
      name: displayName || email,
    });
    await navigator.credentials.store(credential);
    return true;
  } catch {
    // Declined, blocked, or unsupported despite the feature check. The user is
    // signed in either way; this is a convenience, not part of the flow.
    return false;
  }
}
