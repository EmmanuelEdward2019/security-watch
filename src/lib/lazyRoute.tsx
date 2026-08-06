import { lazy, type ComponentType } from 'react';

/**
 * Lazy route loading that survives a bad connection and a redeploy.
 *
 * `React.lazy(() => import(...))` fails permanently on the first error: the
 * rejected promise is cached, so every subsequent attempt to render that route
 * rethrows without retrying. Users saw:
 *
 *     error loading dynamically imported module:
 *     https://www.thesecuritywatch.com/assets/CaseListPage-DWjfqe7z.js
 *
 * Two quite different things produce that message, and they need different
 * responses:
 *
 *   1. **A flaky connection.** The request for the chunk simply failed. Field
 *      users on mobile data in poor coverage hit this constantly, and the right
 *      answer is to try again — the file is still there.
 *
 *   2. **A redeploy.** Vite fingerprints every chunk, so a deploy replaces
 *      `CaseListPage-DWjfqe7z.js` with a new hash and deletes the old one. A tab
 *      that was open across the deploy is still running the previous
 *      `index.js`, which asks for a filename the server no longer has. Retrying
 *      can never fix this: the file is gone. Only reloading the document —
 *      which refetches `index.html` and with it the new chunk names — will.
 *
 * So: retry a few times with backoff for (1), then reload exactly once for (2).
 * The reload is recorded in sessionStorage so a genuinely missing chunk cannot
 * put the tab into a refresh loop; the second failure falls through to the
 * route error boundary, which tells the user something true.
 */

const RELOAD_FLAG = 'tsw-chunk-reloaded';
const ATTEMPTS = 3;
const BASE_DELAY_MS = 350;

/** Chunk-loading failures, as reported by the various browser engines. */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading dynamically imported module/i.test(
    message
  );
}

function hasReloaded(): boolean {
  try {
    return window.sessionStorage.getItem(RELOAD_FLAG) === '1';
  } catch {
    // Private mode with storage disabled. Treat as "already reloaded" so we
    // never risk a loop we cannot detect our way out of.
    return true;
  }
}

function markReloaded() {
  try {
    window.sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    /* nothing we can do; the flag above fails closed */
  }
}

/**
 * Clears the one-shot reload flag.
 *
 * Called once the app has successfully rendered, so a reload used up in this
 * session does not disarm the recovery for a deploy that happens later in the
 * same tab.
 */
export function armChunkRecovery() {
  try {
    window.sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function lazyRoute<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;

        // A real programming error inside the module should surface at once
        // rather than being retried three times and then hidden behind a
        // reload.
        if (!isChunkLoadError(error)) throw error;

        if (attempt < ATTEMPTS - 1) {
          await wait(BASE_DELAY_MS * 2 ** attempt);
        }
      }
    }

    // Still failing after retries. If this is the first time in this tab, the
    // most likely explanation is that the deployment moved underneath us.
    if (!hasReloaded()) {
      markReloaded();
      window.location.reload();
      // Never resolves — the document is being replaced. Returning a pending
      // promise keeps Suspense showing the fallback instead of flashing an
      // error for the moment before navigation.
      return new Promise<{ default: T }>(() => {});
    }

    throw lastError;
  });
}
