/**
 * Warms a route's lazy chunk before it is needed.
 *
 * Route components are code-split, so the first visit to a tab cannot render
 * until its chunk has been fetched. The chunks are small — 2 to 4 kB gzipped —
 * but on a slow or high-latency connection that is still a round trip standing
 * between the click and the content.
 *
 * Pointing at a link is a reliable signal that it is about to be clicked, and
 * the gap between hover and click is usually enough to cover the fetch. By the
 * time the route mounts the module is already in memory and the transition is
 * immediate.
 *
 * Each importer runs at most once — `import()` caches, and the Set stops us
 * re-invoking the factory on every mouse pass.
 */
const warmed = new Set<string>();

type Importer = () => Promise<unknown>;

/** path -> the same dynamic import the router uses. */
const registry = new Map<string, Importer>();

export function registerRouteChunk(path: string, importer: Importer) {
  registry.set(path, importer);
}

export function prefetchRoute(path: string) {
  if (warmed.has(path)) return;
  warmed.add(path);

  const importer = registry.get(path);
  if (!importer) return;

  // Never let a warm-up surface as an error. If it fails the real navigation
  // will retry through lazyRoute, which has its own retry and reload handling.
  void importer().catch(() => {
    warmed.delete(path);
  });
}
