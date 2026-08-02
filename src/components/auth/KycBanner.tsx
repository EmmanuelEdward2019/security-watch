import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Clock, ArrowRight, X } from 'lucide-react';
import { useKycState } from '@/hooks/useKycGate';
import { cn } from '@/utils/cn';

const DISMISS_KEY = 'tsw-kyc-banner-dismissed-until';

/**
 * Persistent verification prompt across the authenticated app.
 *
 * Sits under the header on every screen until the account is verified. A user
 * who never completes KYC previously got no explanation for why their case sat
 * untouched — nothing in the interface connected the two.
 *
 * Dismissible, but it comes back after 24 hours: this is not a marketing
 * message, it is the reason their account does not work properly. Not
 * dismissible at all for accounts that are hard-gated, since for them nothing
 * will function until it is done.
 */
export function KycBanner() {
  const state = useKycState();
  const [dismissed, setDismissed] = useState(() => {
    try {
      const until = window.localStorage.getItem(DISMISS_KEY);
      return until ? Date.now() < Number(until) : false;
    } catch {
      return false;
    }
  });

  if (state.isVerified) return null;
  if (!state.isRequired && !state.isSoftPrompt && !state.awaitingRoleGrant) return null;

  const dismissible = !state.isRequired;
  if (dismissible && dismissed) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    } catch {
      /* private mode — it will simply reappear on navigation */
    }
    setDismissed(true);
  };

  const tone = state.isPending
    ? 'amber'
    : state.isRejected
      ? 'accent'
      : state.isRequired
        ? 'accent'
        : 'brand';

  const Icon = state.isPending ? Clock : state.isRejected || state.isRequired ? ShieldAlert : ShieldCheck;

  const { title, body } = state.isPending
    ? {
        title: 'Verification under review',
        body: 'An administrator is checking your documents. We will notify you as soon as there is a decision.',
      }
    : state.isRejected
      ? {
          title: 'Your verification was not approved',
          body: 'Open your verification page to read the reviewer’s notes and resubmit.',
        }
      : state.isRequired
        ? {
            title: 'Verification required',
            body: 'Your account is limited until we have verified your identity. It takes a few minutes.',
          }
        : {
            title: 'Complete your verification',
            body: 'Verified accounts get their cases picked up faster, and it helps us keep the platform safe.',
          };

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-xl border p-3 sm:p-4',
        tone === 'amber' && 'border-amber-200 bg-amber-50',
        tone === 'accent' && 'border-accent-200 bg-accent-50',
        tone === 'brand' && 'border-brand-200 bg-brand-50'
      )}
    >
      <Icon
        size={20}
        className={cn(
          'mt-0.5 shrink-0',
          tone === 'amber' && 'text-amber-600',
          tone === 'accent' && 'text-accent-600',
          tone === 'brand' && 'text-brand-600'
        )}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-semibold',
            tone === 'amber' && 'text-amber-900',
            tone === 'accent' && 'text-accent-900',
            tone === 'brand' && 'text-brand-900'
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            'text-sm',
            tone === 'amber' && 'text-amber-800',
            tone === 'accent' && 'text-accent-800',
            tone === 'brand' && 'text-brand-800'
          )}
        >
          {body}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {!state.isPending && (
          <Link
            to={state.kycPath}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-white',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              tone === 'accent'
                ? 'bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500'
                : 'bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500'
            )}
          >
            {state.isRejected ? 'Resubmit' : 'Verify now'}
            <ArrowRight size={14} />
          </Link>
        )}

        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss for today"
            className="rounded-lg p-1.5 text-surface-500 hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
