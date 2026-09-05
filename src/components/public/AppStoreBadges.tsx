import { cn } from '@/utils/cn';

/**
 * "Coming soon" badges for the iOS and Android apps.
 *
 * Deliberately NOT Apple's "Download on the App Store" or Google's "Get it on
 * Google Play" artwork. Those lockups are trademarked, their brand guidelines
 * require the unmodified official asset, and — the part that actually matters
 * here — both assert that the app is available to download. Ours are not
 * published yet, so showing them would be a claim we cannot honour, and every
 * visitor who tapped one would land on a dead end.
 *
 * These are house-styled, carry the platform mark so they are recognisable at a
 * glance, and say plainly that the app is on its way. When the listings go
 * live, swap these for the official badges and point them at the real store
 * URLs — that is the moment the official artwork becomes both accurate and
 * permitted.
 *
 * Rendered as spans, not links or buttons. There is nowhere to go, and a
 * control that looks pressable and does nothing is worse than an honest label.
 */

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function PlayMark({ className }: { className?: string }) {
  // The four-segment play triangle. Kept in its own colours rather than
  // currentColor — a monochrome version reads as a generic arrow.
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M3.6 1.8a1.5 1.5 0 0 0-.35 1.05v18.3c0 .42.13.78.35 1.05l.06.06L13.8 12.06v-.12L3.66 1.74z" fill="#00A0FF" />
      <path d="M17.18 15.42 13.8 12.06v-.12l3.38-3.36.08.04 4 2.28c1.14.65 1.14 1.71 0 2.36l-4 2.28z" fill="#FFBC00" />
      <path d="M17.26 15.38 13.8 12 3.66 22.26c.38.4 1 .45 1.7.05l11.9-6.93" fill="#FF3A44" />
      <path d="M17.26 8.62 5.36 1.69c-.7-.4-1.32-.35-1.7.05L13.8 12z" fill="#00C853" />
    </svg>
  );
}

export interface AppStoreBadgesProps {
  className?: string;
  /** `dark` sits on a dark ground (the footer); `light` on a pale one. */
  tone?: 'dark' | 'light';
}

export function AppStoreBadges({ className, tone = 'dark' }: AppStoreBadgesProps) {
  const shell =
    tone === 'dark'
      ? 'border-surface-700 bg-surface-800 text-surface-200'
      : 'border-surface-200 bg-white text-surface-700';

  const caption = tone === 'dark' ? 'text-surface-500' : 'text-surface-400';

  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {[
        { key: 'ios', mark: <AppleMark className="h-6 w-6" />, name: 'iOS' },
        { key: 'android', mark: <PlayMark className="h-6 w-6" />, name: 'Android' },
      ].map((platform) => (
        <span
          key={platform.key}
          className={cn(
            'inline-flex items-center gap-3 rounded-xl border px-4 py-2.5',
            shell
          )}
        >
          {platform.mark}
          <span className="leading-tight">
            <span className={cn('block text-[10px] uppercase tracking-wide', caption)}>
              Coming soon on
            </span>
            <span className="block text-sm font-semibold">{platform.name}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
