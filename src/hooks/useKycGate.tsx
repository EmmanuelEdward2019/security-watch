import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, ArrowRight, Clock, X } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';

/**
 * KYC gating.
 *
 * Verification exists so that the people who read criminal case files, handle
 * evidence and take payments are known to us. Until now nothing pointed a user
 * at it: an unverified account could file a case and simply never be told why
 * nothing happened afterwards.
 *
 * Two levels, deliberately different:
 *
 *   * **Soft** — a dismissible banner and a prompt on protected actions. Used
 *     for complainants and witnesses, who must never be prevented from
 *     reporting a crime. We ask; we do not block.
 *   * **Hard** — the action does not proceed. Used for roles that would be
 *     handling other people's data or taking money: investigators, lawyers,
 *     experts, landlords and media agents.
 *
 * That distinction matters. Blocking a kidnapping report behind a verification
 * wall would be indefensible, so `complainant` and `witness` are never hard
 * gated regardless of the action.
 */

/** Roles that must be verified before they can act on the platform. */
const HARD_GATED_ROLES: UserRole[] = [
  'investigator',
  'lawyer',
  'medical_expert',
  'landlord',
  'media_agent',
];

/** Roles we prompt but never block. Reporting a crime is not gated. */
const NEVER_BLOCKED: UserRole[] = ['complainant', 'witness'];

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
  /** True when we should nag but never block. */
  isSoftPrompt: boolean;
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
    const neverBlocked = !!role && NEVER_BLOCKED.includes(role) && !awaitingRoleGrant;

    return {
      isVerified: kyc === 'approved',
      isPending: kyc === 'pending' && awaitingRoleGrant,
      isRejected: kyc === 'rejected',
      isRequired: isRequired && kyc !== 'approved',
      isSoftPrompt: neverBlocked && kyc !== 'approved',
      awaitingRoleGrant,
      kycPath: isRequired || awaitingRoleGrant ? '/app/verification' : '/app/profile',
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
  const navigate = useNavigate();
  const [pendingAction, setPendingAction] = useState<GatedAction | null>(null);

  const requireKyc = useCallback(
    (action: GatedAction) => {
      if (state.isVerified) return true;

      // Always prompt — but only stop the action for hard-gated roles.
      setPendingAction(action);
      return !state.isRequired;
    },
    [state.isVerified, state.isRequired]
  );

  const close = () => setPendingAction(null);

  const value = useMemo(() => ({ requireKyc, state }), [requireKyc, state]);

  const blocking = state.isRequired;
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
