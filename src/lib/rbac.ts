import type { UserRole } from '@/types';

export const ROLE_HOME: Record<UserRole, string> = {
  complainant: '/app/dashboard',
  investigator: '/app/dashboard',
  lawyer: '/app/dashboard',
  medical_expert: '/app/dashboard',
  witness: '/app/dashboard',
  landlord: '/app/dashboard',
  tenant: '/app/dashboard',
  media_agent: '/app/dashboard',
  admin: '/app/admin',
};

/**
 * Which roles are allowed on each route path.
 * Paths are matched as prefixes (a route entry of '/app/cases' permits
 * '/app/cases', '/app/cases/new', '/app/cases/:id', etc.) unless an
 * exact entry for the deeper path exists.
 *
 * Order matters: more-specific paths must come before less-specific ones
 * so the first match wins.
 */
const ROUTE_PERMISSIONS: { path: string; roles: UserRole[]; exact?: boolean }[] = [
  // ── Common (all authenticated roles) ──────────────────────────
  { path: '/app/dashboard', roles: ['complainant', 'investigator', 'lawyer', 'medical_expert', 'witness', 'landlord', 'tenant', 'media_agent'], exact: true },
  { path: '/app/messages', roles: ['complainant', 'investigator', 'lawyer', 'medical_expert', 'witness', 'landlord', 'tenant', 'media_agent', 'admin'] },
  { path: '/app/notifications', roles: ['complainant', 'investigator', 'lawyer', 'medical_expert', 'witness', 'landlord', 'tenant', 'media_agent', 'admin'] },
  { path: '/app/profile', roles: ['complainant', 'investigator', 'lawyer', 'medical_expert', 'witness', 'landlord', 'tenant', 'media_agent', 'admin'] },
  { path: '/app/settings', roles: ['complainant', 'investigator', 'lawyer', 'medical_expert', 'witness', 'landlord', 'tenant', 'media_agent', 'admin'] },
  // Only payers can access the generic payment page; payees have /app/earnings instead
  { path: '/app/payments', roles: ['complainant', 'witness', 'landlord', 'tenant'] },

  // ── Investigative Services ────────────────────────────────────
  { path: '/app/cases/new', roles: ['complainant'], exact: true },
  { path: '/app/cases/assigned', roles: ['investigator'], exact: true },
  { path: '/app/cases/submit-report', roles: ['investigator', 'medical_expert'], exact: true },
  { path: '/app/cases', roles: ['complainant', 'investigator', 'lawyer', 'medical_expert', 'witness', 'admin'] },

  // Reachable by applicants, not just by people who already hold the role.
  //
  // Since migration 004, requesting `investigator`, `lawyer` or `medical_expert`
  // at signup no longer grants it — the account stays `complainant` with the
  // request recorded in `profiles.requested_role` until an admin approves the
  // KYC submission. Gating this page on the granted role therefore locked every
  // applicant out of the only screen that could get them approved.
  //
  // The `investigators` table backs all three reviewed roles; the name is
  // historical. `admin_review_investigator()` grants whichever role the
  // applicant requested.
  //
  // Open to every signed-in role. Landlords, media agents and witnesses were
  // previously excluded, so the "complete your verification" banner shown to
  // them pointed at a page they were not permitted to load — it fell back to
  // /app/profile, which is a display-name-and-bio form with no NIN, no document
  // upload and no guarantors. This is the only screen that performs identity
  // verification, so every role that can be asked to verify must reach it.
  {
    path: '/app/verification',
    roles: [
      'complainant',
      'investigator',
      'lawyer',
      'medical_expert',
      'witness',
      'landlord',
      'tenant',
      'media_agent',
    ],
  },
  { path: '/app/availability', roles: ['investigator'] },
  { path: '/app/earnings', roles: ['investigator', 'lawyer', 'medical_expert'] },
  // Where a payout is sent. Same three roles that can be booked on an
  // engagement — nobody else has anything to be paid.
  { path: '/app/payout-account', roles: ['investigator', 'lawyer', 'medical_expert'] },
  { path: '/app/legal-documents', roles: ['lawyer'] },
  { path: '/app/evidence-analysis', roles: ['medical_expert'] },

  // ── Property ──────────────────────────────────────────────────
  { path: '/app/property/landlord', roles: ['landlord'], exact: true },
  { path: '/app/property/create', roles: ['landlord'], exact: true },
  { path: '/app/property/requests', roles: ['landlord'], exact: true },
  { path: '/app/property/transactions', roles: ['landlord'], exact: true },
  { path: '/app/property/tenant', roles: ['tenant'], exact: true },
  { path: '/app/property/saved', roles: ['tenant'], exact: true },
  { path: '/app/property/verify', roles: ['tenant'], exact: true },
  { path: '/app/property', roles: ['landlord', 'tenant', 'admin'] },

  // ── Media ─────────────────────────────────────────────────────
  { path: '/app/media/agent', roles: ['media_agent'], exact: true },
  { path: '/app/media/record', roles: ['media_agent'], exact: true },
  // The library is not media-agent-only: investigators and medical experts
  // also capture in the field, and everything they gather has to live
  // somewhere before it is attached to a case.
  { path: '/app/media/library', roles: ['media_agent', 'investigator', 'medical_expert', 'lawyer'], exact: true },
  { path: '/app/media/upload', roles: ['media_agent'], exact: true },
  { path: '/app/media/activity', roles: ['media_agent'], exact: true },
  { path: '/app/media/institutions', roles: ['media_agent', 'admin'] },
  { path: '/app/media', roles: ['media_agent', 'admin'] },

  // ── Admin ─────────────────────────────────────────────────────
  { path: '/app/admin', roles: ['admin'] },
  // Covered by the /app/admin prefix already, but listed so the payout
  // surface is explicit in the access table — it is the one screen that
  // records money leaving the platform.
  { path: '/app/admin/payouts', roles: ['admin'] },
];

export function isRouteAllowed(pathname: string, role: UserRole): boolean {
  if (role === 'admin') return true;

  for (const rule of ROUTE_PERMISSIONS) {
    if (rule.exact) {
      if (pathname === rule.path) return rule.roles.includes(role);
    } else {
      if (pathname === rule.path || pathname.startsWith(rule.path + '/')) {
        return rule.roles.includes(role);
      }
    }
  }

  return false;
}

export function getRolesForRoute(pathname: string): UserRole[] | null {
  for (const rule of ROUTE_PERMISSIONS) {
    if (rule.exact) {
      if (pathname === rule.path) return rule.roles;
    } else {
      if (pathname === rule.path || pathname.startsWith(rule.path + '/')) {
        return rule.roles;
      }
    }
  }
  return null;
}
