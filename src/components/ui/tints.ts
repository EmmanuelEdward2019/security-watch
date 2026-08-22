/**
 * Pastel tint roles, shared by EmptyState, StatsCard and anything else that
 * needs a soft ground with a readable foreground.
 *
 * Mirrors `colors.tint` in the mobile theme so a figure or an empty screen
 * means the same colour on both clients.
 *
 * Each entry is a unit. The foreground is chosen to read on its own
 * background, so mixing a `text-` from one role onto the `bg-` of another does
 * not hold up.
 *
 * NOTE the deliberate absence of a brand-green role. A green badge on this
 * platform can mean "this title was checked against the land registry", so a
 * decorative green surface must not read as a verification result. `emerald`
 * is reserved for genuine success.
 *
 * Lives in its own module rather than beside a component: exporting a constant
 * from a file that also exports a component breaks React Fast Refresh.
 */
export const EMPTY_TINTS = {
  slate: 'bg-slate-100 text-slate-500',
  emerald: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600',
  teal: 'bg-teal-50 text-teal-600',
} as const;

export type EmptyTint = keyof typeof EMPTY_TINTS;
