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

  { path: '/app/verification', roles: ['investigator'] },
  { path: '/app/availability', roles: ['investigator'] },
  { path: '/app/earnings', roles: ['investigator', 'lawyer'] },
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
  { path: '/app/media/upload', roles: ['media_agent'], exact: true },
  { path: '/app/media/activity', roles: ['media_agent'], exact: true },
  { path: '/app/media/institutions', roles: ['media_agent', 'admin'] },
  { path: '/app/media', roles: ['media_agent', 'admin'] },

  // ── Admin ─────────────────────────────────────────────────────
  { path: '/app/admin', roles: ['admin'] },
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
