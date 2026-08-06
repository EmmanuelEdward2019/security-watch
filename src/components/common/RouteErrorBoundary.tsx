import { isRouteErrorResponse, useRouteError, Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home, WifiOff } from 'lucide-react';

/**
 * The route-level error screen.
 *
 * Without an `errorElement`, React Router renders its own developer-facing
 * default — the one that says "Unexpected Application Error!" and then advises
 * the developer to add an error boundary. Users of this platform were being
 * shown that, including the raw chunk URL, when their connection dropped.
 *
 * The most common failure here by far is a chunk that would not load, so that
 * case gets its own wording and a reload button rather than being folded into a
 * generic apology. lazyRoute() already retries and reloads once; by the time
 * this renders, the automatic recovery has been used up.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  const message =
    isRouteErrorResponse(error)
      ? `${error.status} ${error.statusText}`
      : error instanceof Error
        ? error.message
        : 'Something went wrong.';

  const isChunkError =
    /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError/i.test(
      message
    );

  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
          {isChunkError || isOffline ? (
            <WifiOff className="h-8 w-8 text-amber-600" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          )}
        </div>

        {isChunkError || isOffline ? (
          <>
            <h1 className="mb-2 text-2xl font-bold text-surface-900">
              This page could not load
            </h1>
            <p className="mb-6 text-surface-600">
              {isOffline
                ? 'You appear to be offline. Check your connection and try again.'
                : 'Part of the app failed to download. This is usually a weak connection, or the site having been updated while your tab was open.'}
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-bold text-surface-900">
              Something went wrong
            </h1>
            <p className="mb-6 text-surface-600">
              We hit an unexpected error. Your data has not been affected — nothing
              you had already submitted is lost.
            </p>
          </>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700"
          >
            <RefreshCw className="h-4 w-4" />
            Reload the page
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-surface-300 px-5 py-2.5 font-medium text-surface-700 transition-colors hover:bg-surface-50"
          >
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </div>

        {/*
          The technical detail stays available for a support conversation, but
          collapsed — the previous screen led with the raw asset URL, which tells
          a complainant nothing and reads like the site is broken.
        */}
        <details className="mt-8 text-left">
          <summary className="cursor-pointer text-sm text-surface-500 hover:text-surface-700">
            Technical details
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-100 p-3 text-xs text-surface-600">
            {message}
          </pre>
        </details>
      </div>
    </div>
  );
}

export default RouteErrorBoundary;
