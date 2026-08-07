/* eslint-disable react-refresh/only-export-components --
 * This file is a context module: it exports the KycGateProvider component
 * alongside the useKycState and useKycGate hooks that read it. That is the
 * standard React context pattern, and splitting the hooks into a second file to
 * satisfy a Fast Refresh ergonomics rule would leave the provider and its
 * consumers in separate places for no behavioural gain. The rule was already
 * failing here, and `eslint .` exits non-zero on errors — so this was quietly
 * failing CI's lint step, and with it the verify job that deploy.yml gates on.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, ArrowRight, Clock, X } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

/**
 * KYC gating.
 *
 * Verification exists so that the people who read criminal case files, handle
 * evidence and take payments are known to us. Until now nothing pointed a user
 * at it: an unverified account could file a case and simply never be told why
 * nothing happened afterwards.
 *
 * Verification is required of EVERY role. The earlier two-tier model — where
 * complainant and witness were permanently "soft" and merely nagged — is gone:
 * an account nobody has identified could otherwise file indefinitely.
 *
 * The single exception is a first filing. See REPORTING_ACTIONS below.
 */

/**
 * Roles that must be verified before they can act on the platform.
 *
 * Every signed-in role is on this list: verification is required, not optional.
 * `tenant` and `witness` were added alongside the others so that no account can
 * transact, message or file against a real case while anonymous.
 */
const HARD_GATED_ROLES: UserRole[] = [
  'complainant',
  'investigator',
  'lawyer',
  'medical_expert',
  'witness',
  'landlord',
  'tenant',
  'media_agent',
];

/**
 * The one carve-out, and it is deliberate: a FIRST filing is never blocked.
 *
 * Someone reporting a kidnapping, an assault or a disappearance must be able to
 * get that report in front of us at 2am without first finding their NIN slip
 * and two guarantors. So a complainant or witness who has never filed before may
 * file once, unverified.
 *
 * It is an on-ramp, not a standing exemption. Once they have filed once, the
 * next one waits for verification like everything else — otherwise an account
 * nobody has identified can file indefinitely, which is the abuse this platform
 * cannot absorb.
 *
 * This previously exempted the two roles unconditionally, which diverged from
 * the mobile client: the same user filing a second report was allowed on web and
 * blocked on mobile. Both now implement the one-time on-ramp.
 *
 * Scoped tightly on purpose: only these two actions, only these two roles, only
 * before the first filing. Evidence upload, property listing, publishing and
 * payment are never carved out for anyone.
 */
const REPORTING_ACTIONS: GatedAction[] = ['create_case', 'file_report'];
const REPORTING_EXEMPT_ROLES: UserRole[] = ['complainant', 'witness'];

export type GatedAction =
  | 'create_case'
  | 'upload_evidence'
  | 'list_property'
  | 'file_report'
  | 'upload_media'
  | 'request_verification'
  | 'make_payment'
  | 'send_message';

const ACTION_LABELS: Record<GatedAction, string> = {
  create_case: 'file a case',
  upload_evidence: 'upload evidence',
  list_property: 'list a property',
  file_report: 'file a report',
  upload_media: 'publish a field report',
  request_verification: 'request a verification',
  make_payment: 'make a payment',
  send_message: 'send messages',
};

export interface KycState {
  /** True when the account has cleared verification. */
  isVerified: boolean;
  /** True when an application is in with an admin. */
  isPending: boolean;
  /** True when an application came back rejected. */
  isRejected: boolean;
  /** True when this role must verify before acting. */
  isRequired: boolean;
  /** Awaiting a role grant (requested_role differs from role). */
  awaitingRoleGrant: boolean;
  /** Where this user completes verification. */
  kycPath: string;
}

export function useKycState(): KycState {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    const role = user?.role;
    const kyc = user?.kyc_status;

    const awaitingRoleGrant = Boolean(
      user?.requested_role && user.requested_role !== role && !user.role_confirmed_at
    );

    // An applicant for a professional role is technically a complainant, but
    // should be treated as that professional for prompting purposes — otherwise
    // we would nag them about the wrong thing.
    const effectiveRole = (awaitingRoleGrant ? user?.requested_role : role) as UserRole | undefined;

    const isRequired = !!effectiveRole && HARD_GATED_ROLES.includes(effectiveRole);

    return {
      isVerified: kyc === 'approved',
      // A pending application is pending whether or not a role grant is
      // involved. Tying this to awaitingRoleGrant meant a landlord who had
      // submitted was still told to "start verification".
      isPending: kyc === 'pending' && Boolean(user?.kyc_submitted_at ?? awaitingRoleGrant),
      isRejected: kyc === 'rejected',
      isRequired: isRequired && kyc !== 'approved',
      awaitingRoleGrant,
      // Always the verification screen. This used to fall back to /app/profile
      // for roles that were not hard gated, which is a display-name and bio
      // form — users following the banner landed somewhere with no NIN field,
      // no document upload and no guarantors, and reasonably concluded the
      // platform had no verification at all.
      kycPath: '/app/verification',
    };
  }, [user]);
}

interface KycGateContextValue {
  /**
   * Checks whether an action may proceed.
   *
   * Returns true when it may. Returns false and shows the prompt when it may
   * not — so the call site reads:
   *
   *   if (!requireKyc('create_case')) return;
   */
  requireKyc: (action: GatedAction) => boolean;
  state: KycState;
}

const KycGateContext = createContext<KycGateContextValue | null>(null);

export function KycGateProvider({ children }: { children: ReactNode }) {
  const state = useKycState();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [pendingAction, setPendingAction] = useState<GatedAction | null>(null);

  /**
   * Gate on the role the user is ACTING as, not the one stored on the profile.
   *
   * Since migration 004 an investigator applicant keeps `role = 'complainant'`
   * until an admin approves them. Reading `role` directly handed those
   * applicants the complainant first-filing on-ramp, which was never meant for
   * them. `useKycState` already resolves this; use the same answer here so the
   * banner and the gate cannot disagree.
   */
  const effectiveRole = (
    state.awaitingRoleGrant ? user?.requested_role : user?.role
  ) as UserRole | undefined;

  /**
   * Whether this account has already filed.
   *
   * `undefined` means we do not know yet — the query is in flight or failed.
   * That case FAILS OPEN for the two reporting actions: wrongly blocking a first
   * report because a count query timed out is far worse than letting a second
   * one through. Matches the mobile client's `hasFiledBefore` contract exactly.
   */
  const [hasFiledBefore, setHasFiledBefore] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // Only relevant to an unverified account that could use the on-ramp.
    if (!user?.user_id || state.isVerified || !effectiveRole) return;
    if (!REPORTING_EXEMPT_ROLES.includes(effectiveRole)) return;

    let active = true;

    void supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .eq('complainant_id', user.user_id)
      .then(({ count, error }) => {
        if (!active) return;
        // Leave it undefined on error so the on-ramp stays open.
        if (error) return;
        setHasFiledBefore((count ?? 0) > 0);
      });

    return () => {
      active = false;
    };
  }, [user?.user_id, state.isVerified, effectiveRole]);

  const requireKyc = useCallback(
    (action: GatedAction) => {
      if (state.isVerified) return true;

      // A FIRST report is never blocked — see REPORTING_ACTIONS above.
      // `hasFiledBefore !== true` is deliberate: unknown fails open.
      const onRampApplies =
        REPORTING_ACTIONS.includes(action) &&
        !!effectiveRole &&
        REPORTING_EXEMPT_ROLES.includes(effectiveRole) &&
        hasFiledBefore !== true;

      if (onRampApplies) {
        setPendingAction(action);
        return true;
      }

      // Always prompt — but only stop the action for hard-gated roles.
      setPendingAction(action);
      return !state.isRequired;
    },
    [state.isVerified, state.isRequired, effectiveRole, hasFiledBefore]
  );

  const close = () => setPendingAction(null);

  const value = useMemo(() => ({ requireKyc, state }), [requireKyc, state]);

  // The modal only offers a dismiss route when the action is actually going
  // ahead — i.e. the user is using their one-time on-ramp.
  const blocking = state.isRequired && !(
    pendingAction !== null &&
    REPORTING_ACTIONS.includes(pendingAction) &&
    !!effectiveRole &&
    REPORTING_EXEMPT_ROLES.includes(effectiveRole) &&
    hasFiledBefore !== true
  );
  const label = pendingAction ? ACTION_LABELS[pendingAction] : 'continue';

  return (
    <KycGateContext.Provider value={value}>
      {children}

      <Modal
        isOpen={pendingAction !== null}
        onClose={close}
        title={
          state.isPending
            ? 'Your verification is being reviewed'
            : state.isRejected
              ? 'Your verification needs attention'
              : 'Complete your verification'
        }
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={
                state.isPending
                  ? 'rounded-full bg-amber-100 p-2.5'
                  : state.isRejected
                    ? 'rounded-full bg-accent-100 p-2.5'
                    : 'rounded-full bg-brand-100 p-2.5'
              }
            >
              {state.isPending ? (
                <Clock size={20} className="text-amber-600" />
              ) : state.isRejected ? (
                <ShieldAlert size={20} className="text-accent-600" />
              ) : (
                <ShieldCheck size={20} className="text-brand-600" />
              )}
            </div>

            <div className="min-w-0 text-sm text-surface-700 space-y-2">
              {state.isPending ? (
                <>
                  <p>
                    We have your documents and an administrator is reviewing them. You will be
                    notified as soon as a decision is made — usually within two working days.
                  </p>
                  {!blocking && (
                    <p className="text-surface-500">
                      You can continue to {label} in the meantime.
                    </p>
                  )}
                </>
              ) : state.isRejected ? (
                <>
                  <p>
                    Your previous submission could not be approved. Open your verification page to
                    see the reviewer's notes and resubmit.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {blocking
                      ? `Before you can ${label}, we need to verify who you are.`
                      : `You have not completed verification yet. You can still ${label}, but verifying helps us act on your case faster.`}
                  </p>
                  <p className="text-surface-500">
                    Verification protects the people on this platform. Anyone who handles case
                    files, evidence or payments is identity-checked first.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
            <Button variant="ghost" onClick={close} className="flex-1" icon={X}>
              {blocking ? 'Not now' : `Continue anyway`}
            </Button>
            {!state.isPending && (
              <Button
                className="flex-1"
                icon={ArrowRight}
                onClick={() => {
                  close();
                  navigate(state.kycPath);
                }}
              >
                {state.isRejected ? 'Review and resubmit' : 'Verify now'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </KycGateContext.Provider>
  );
}

export function useKycGate(): KycGateContextValue {
  const ctx = useContext(KycGateContext);
  if (!ctx) {
    throw new Error('useKycGate must be used inside <KycGateProvider>');
  }
  return ctx;
}
