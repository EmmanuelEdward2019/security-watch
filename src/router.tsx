import { Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { lazyRoute, type LazyRouteComponent } from '@/lib/lazyRoute';
import { registerRouteChunk } from '@/lib/prefetchRoute';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { DashboardLayout } from '@/components/layout';
import { KycGateProvider } from '@/hooks/useKycGate';
import { ProtectedRoute } from '@/components/auth';
import { ScrollToTop } from '@/components/ScrollToTop';
import { Spinner } from '@/components/ui';

/**
 * Routes are lazily imported.
 *
 * All 76 route components used to be eagerly imported here, which is how the
 * whole application ended up in a single 1.67 MB chunk — a first-time visitor
 * downloaded the admin analytics charts and the field-recording screen just to
 * read the landing page. On the mobile connections this platform is built for,
 * that is the difference between usable and abandoned.
 *
 * The landing page is the one deliberate exception: it is the most common entry
 * point, so it stays in the initial bundle to avoid a spinner on first paint.
 */
import LandingPage from '@/pages/LandingPage';

// ── Auth ──────────────────────────────────────────────────────────────────────
const LoginPage = lazyRoute(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazyRoute(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ResetPasswordPage = lazyRoute(() => import('@/pages/auth/ResetPasswordPage'));
const VerifyOtpPage = lazyRoute(() => import('@/pages/auth/VerifyOtpPage').then((m) => ({ default: m.VerifyOtpPage })));
const ProfileCompletionPage = lazyRoute(() => import('@/pages/auth/ProfileCompletionPage').then((m) => ({ default: m.ProfileCompletionPage })));
const UnauthorizedPage = lazyRoute(() => import('@/pages/auth/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage })));

// ── Public ────────────────────────────────────────────────────────────────────
const AboutPage = lazyRoute(() => import('@/pages/public/AboutPage'));
const HowItWorksPage = lazyRoute(() => import('@/pages/public/HowItWorksPage'));
const InvestigationsPage = lazyRoute(() => import('@/pages/public/InvestigationsPage'));
const PropertyVerificationPage = lazyRoute(() => import('@/pages/public/PropertyVerificationPage'));
const TransparencyPage = lazyRoute(() => import('@/pages/public/TransparencyPage'));
const BecomeAgentPage = lazyRoute(() => import('@/pages/public/BecomeAgentPage'));
const PartnersPage = lazyRoute(() => import('@/pages/public/PartnersPage'));
const PricingPage = lazyRoute(() => import('@/pages/public/PricingPage'));
const FAQsPage = lazyRoute(() => import('@/pages/public/FAQsPage'));
const ContactPage = lazyRoute(() => import('@/pages/public/ContactPage'));
const BlogPage = lazyRoute(() => import('@/pages/public/BlogPage'));
const BlogPostPage = lazyRoute(() => import('@/pages/public/BlogPostPage'));
const LegalPage = lazyRoute(() => import('@/pages/public/LegalPage'));
const ReportsPage = lazyRoute(() => import('@/pages/public/ReportsPage'));
const MediaPage = lazyRoute(() => import('@/pages/public/MediaPage'));
const PublicPropertyListPage = lazyRoute(() => import('@/pages/public/PublicPropertyListPage'));
const PublicPropertyDetailPage = lazyRoute(() => import('@/pages/public/PublicPropertyDetailPage'));
const FountainSourcePage = lazyRoute(() => import('@/pages/public/FountainSourcePage'));
const FountainSourceRequestPage = lazyRoute(() => import('@/pages/public/FountainSourceRequestPage'));

// ── Dashboard ─────────────────────────────────────────────────────────────────
const DashboardPage = lazyRoute(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProfilePage = lazyRoute(() => import('@/pages/dashboard/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazyRoute(() => import('@/pages/dashboard/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NotificationsPage = lazyRoute(() => import('@/pages/dashboard/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));

// ── Cases ─────────────────────────────────────────────────────────────────────
const CaseListPage = lazyRoute(() => import('@/pages/cases/CaseListPage').then((m) => ({ default: m.CaseListPage })));
const CreateCasePage = lazyRoute(() => import('@/pages/cases/CreateCasePage').then((m) => ({ default: m.CreateCasePage })));
const CaseDetailPage = lazyRoute(() => import('@/pages/cases/CaseDetailPage').then((m) => ({ default: m.CaseDetailPage })));
const AgentVerificationPage = lazyRoute(() => import('@/pages/cases/AgentVerificationPage').then((m) => ({ default: m.AgentVerificationPage })));
const SubmitReportPage = lazyRoute(() => import('@/pages/cases/SubmitReportPage'));

// ── Property ──────────────────────────────────────────────────────────────────
const PropertyListPage = lazyRoute(() => import('@/pages/property/PropertyListPage').then((m) => ({ default: m.PropertyListPage })));
const PropertyDetailPage = lazyRoute(() => import('@/pages/property/PropertyDetailPage').then((m) => ({ default: m.PropertyDetailPage })));
const CreatePropertyPage = lazyRoute(() => import('@/pages/property/CreatePropertyPage').then((m) => ({ default: m.CreatePropertyPage })));
const LandlordDashboard = lazyRoute(() => import('@/pages/property/LandlordDashboard').then((m) => ({ default: m.LandlordDashboard })));
const TenantDashboard = lazyRoute(() => import('@/pages/property/TenantDashboard').then((m) => ({ default: m.TenantDashboard })));
const TenantRequestsPage = lazyRoute(() => import('@/pages/property/TenantRequestsPage'));
const TransactionsPage = lazyRoute(() => import('@/pages/property/TransactionsPage'));
const SavedPropertiesPage = lazyRoute(() => import('@/pages/property/SavedPropertiesPage'));
const VerificationRequestsPage = lazyRoute(() => import('@/pages/property/VerificationRequestsPage'));

// ── Media ─────────────────────────────────────────────────────────────────────
const MediaFeedPage = lazyRoute(() => import('@/pages/media/MediaFeedPage').then((m) => ({ default: m.MediaFeedPage })));
const MediaDetailPage = lazyRoute(() => import('@/pages/media/MediaDetailPage').then((m) => ({ default: m.MediaDetailPage })));
const UploadMediaPage = lazyRoute(() => import('@/pages/media/UploadMediaPage').then((m) => ({ default: m.UploadMediaPage })));
const InstitutionsPage = lazyRoute(() => import('@/pages/media/InstitutionsPage').then((m) => ({ default: m.InstitutionsPage })));
const InstitutionDetailPage = lazyRoute(() => import('@/pages/media/InstitutionDetailPage').then((m) => ({ default: m.InstitutionDetailPage })));
const MediaAgentDashboard = lazyRoute(() => import('@/pages/media/MediaAgentDashboard').then((m) => ({ default: m.MediaAgentDashboard })));
const FieldRecordingPage = lazyRoute(() => import('@/pages/media/FieldRecordingPage'));
const MediaLibraryPage = lazyRoute(() => import('@/pages/media/MediaLibraryPage'));
const ActivityLogPage = lazyRoute(() => import('@/pages/media/ActivityLogPage'));
const ContentLibraryPage = lazyRoute(() => import('@/pages/media/ContentLibraryPage'));
const PublishPage = lazyRoute(() => import('@/pages/media/PublishPage'));

// ── Role-specific ─────────────────────────────────────────────────────────────
const AvailabilityPage = lazyRoute(() => import('@/pages/investigator/AvailabilityPage'));
const EarningsPage = lazyRoute(() => import('@/pages/investigator/EarningsPage'));
const PayoutAccountPage = lazyRoute(() => import('@/pages/investigator/PayoutAccountPage'));
const LegalDocumentsPage = lazyRoute(() => import('@/pages/lawyer/LegalDocumentsPage'));
const EvidenceAnalysisPage = lazyRoute(() => import('@/pages/medical/EvidenceAnalysisPage'));
const MessagingPage = lazyRoute(() => import('@/pages/messaging/MessagingPage').then((m) => ({ default: m.MessagingPage })));
const PaymentPage = lazyRoute(() => import('@/pages/payments/PaymentPage').then((m) => ({ default: m.PaymentPage })));
const PaymentHistoryPage = lazyRoute(() => import('@/pages/payments/PaymentHistoryPage').then((m) => ({ default: m.PaymentHistoryPage })));

// ── Admin ─────────────────────────────────────────────────────────────────────
const AdminDashboard = lazyRoute(() => import('@/pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const UserManagementPage = lazyRoute(() => import('@/pages/admin/UserManagementPage').then((m) => ({ default: m.UserManagementPage })));
const CaseOversightPage = lazyRoute(() => import('@/pages/admin/CaseOversightPage').then((m) => ({ default: m.CaseOversightPage })));
const VerificationPage = lazyRoute(() => import('@/pages/admin/VerificationPage').then((m) => ({ default: m.VerificationPage })));
const KycReviewPage = lazyRoute(() => import('@/pages/admin/KycReviewPage'));
const MediaApprovalsPage = lazyRoute(() => import('@/pages/admin/MediaApprovalsPage').then((m) => ({ default: m.MediaApprovalsPage })));
const PaymentMonitoringPage = lazyRoute(() => import('@/pages/admin/PaymentMonitoringPage').then((m) => ({ default: m.PaymentMonitoringPage })));
const AnalyticsPage = lazyRoute(() => import('@/pages/admin/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const PricingControlPage = lazyRoute(() => import('@/pages/admin/PricingControlPage'));
const InstitutionReportsPage = lazyRoute(() => import('@/pages/admin/InstitutionReportsPage'));
const SecurityRequestsPage = lazyRoute(() => import('@/pages/admin/SecurityRequestsPage'));
const AuditLogPage = lazyRoute(() => import('@/pages/admin/AuditLogPage'));

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
      <Spinner size="lg" />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}

/** Wraps a lazily-loaded route so navigation never renders an empty screen. */
function page(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function RootLayout() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    // Without this, React Router falls back to its own developer-facing screen
    // — the "Unexpected Application Error!" one that prints the raw chunk URL
    // and tells the *developer* to add an error boundary. Users were seeing it.
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: page(<LoginPage />) },
      { path: '/register', element: page(<RegisterPage />) },
      { path: '/verify-otp', element: page(<VerifyOtpPage />) },
      { path: '/reset-password', element: page(<ResetPasswordPage />) },

      // ── Public ────────────────────────────────────────────────────────────
      { path: '/about', element: page(<AboutPage />) },
      { path: '/how-it-works', element: page(<HowItWorksPage />) },
      { path: '/services/investigations', element: page(<InvestigationsPage />) },
      { path: '/services/property', element: page(<PropertyVerificationPage />) },
      { path: '/services/transparency', element: page(<TransparencyPage />) },
      { path: '/property', element: page(<PublicPropertyListPage />) },
      { path: '/property/:id', element: page(<PublicPropertyDetailPage />) },
      { path: '/media', element: page(<MediaPage />) },
      { path: '/reports', element: page(<ReportsPage />) },
      { path: '/become-agent', element: page(<BecomeAgentPage />) },
      { path: '/partners', element: page(<PartnersPage />) },
      { path: '/pricing', element: page(<PricingPage />) },
      { path: '/faqs', element: page(<FAQsPage />) },
      { path: '/contact', element: page(<ContactPage />) },
      { path: '/blog', element: page(<BlogPage />) },
      { path: '/blog/:slug', element: page(<BlogPostPage />) },
      { path: '/privacy', element: page(<LegalPage />) },
      { path: '/terms', element: page(<LegalPage />) },
      { path: '/disclaimer', element: page(<LegalPage />) },
      { path: '/legal/:type', element: page(<LegalPage />) },
      { path: '/fountain-source', element: page(<FountainSourcePage />) },
      { path: '/fountain-source/request', element: page(<FountainSourceRequestPage />) },

      {
        path: '/profile/complete',
        element: (
          <ProtectedRoute>
            {page(<ProfileCompletionPage />)}
          </ProtectedRoute>
        ),
      },
      { path: '/unauthorized', element: page(<UnauthorizedPage />) },

      // ── Dashboard (authenticated) ─────────────────────────────────────────
      {
        path: '/app',
        element: (
          <ProtectedRoute>
            <KycGateProvider>
          <DashboardLayout />
        </KycGateProvider>
          </ProtectedRoute>
        ),
        children: [
          // Common to every authenticated role
          { index: true, element: <Navigate to="/app/dashboard" replace /> },
          { path: 'dashboard', element: page(<DashboardPage />) },
          { path: 'messages', element: page(<MessagingPage />) },
          { path: 'notifications', element: page(<NotificationsPage />) },
          { path: 'profile', element: page(<ProfilePage />) },
          { path: 'settings', element: page(<SettingsPage />) },
          { path: 'payments', element: page(<PaymentPage />) },
          { path: 'payments/history', element: page(<PaymentHistoryPage />) },

          // ── Investigative services ────────────────────────────────────────
          { path: 'cases', element: page(<CaseListPage />) },
          { path: 'cases/assigned', element: page(<CaseListPage />) },
          { path: 'cases/new', element: page(<CreateCasePage />) },
          { path: 'cases/:id', element: page(<CaseDetailPage />) },
          { path: 'cases/submit-report', element: page(<SubmitReportPage />) },

          { path: 'verification', element: page(<AgentVerificationPage />) },
          { path: 'availability', element: page(<AvailabilityPage />) },
          { path: 'earnings', element: page(<EarningsPage />) },
          { path: 'payout-account', element: page(<PayoutAccountPage />) },
          { path: 'legal-documents', element: page(<LegalDocumentsPage />) },
          { path: 'evidence-analysis', element: page(<EvidenceAnalysisPage />) },

          // ── Property ──────────────────────────────────────────────────────
          { path: 'property', element: page(<PropertyListPage />) },
          { path: 'property/:id', element: page(<PropertyDetailPage />) },
          { path: 'property/create', element: page(<CreatePropertyPage />) },
          { path: 'property/landlord', element: page(<LandlordDashboard />) },
          { path: 'property/requests', element: page(<TenantRequestsPage />) },
          { path: 'property/transactions', element: page(<TransactionsPage />) },
          { path: 'property/tenant', element: page(<TenantDashboard />) },
          { path: 'property/saved', element: page(<SavedPropertiesPage />) },
          { path: 'property/verify', element: page(<VerificationRequestsPage />) },

          // ── Media ─────────────────────────────────────────────────────────
          { path: 'media', element: page(<MediaFeedPage />) },
          { path: 'media/agent', element: page(<MediaAgentDashboard />) },
          { path: 'media/institutions', element: page(<InstitutionsPage />) },
          { path: 'media/institutions/:id', element: page(<InstitutionDetailPage />) },
          { path: 'media/upload', element: page(<UploadMediaPage />) },
          { path: 'media/record', element: page(<FieldRecordingPage />) },
          { path: 'media/library', element: page(<MediaLibraryPage />) },
          { path: 'media/activity', element: page(<ActivityLogPage />) },
          { path: 'media/:id', element: page(<MediaDetailPage />) },

          // ── Admin ─────────────────────────────────────────────────────────
          { path: 'admin', element: page(<AdminDashboard />) },
          { path: 'admin/users', element: page(<UserManagementPage />) },
          { path: 'admin/cases', element: page(<CaseOversightPage />) },
          { path: 'admin/verifications', element: page(<VerificationPage />) },
          // The sidebar has linked here since KYC review shipped, but the
          // route was never registered — so it fell through to the catch-all
          // and bounced admins to the public home page.
          { path: 'admin/kyc', element: page(<KycReviewPage />) },
          { path: 'admin/properties', element: page(<PropertyListPage />) },
          { path: 'admin/media', element: page(<MediaApprovalsPage />) },
          { path: 'admin/media/library', element: page(<ContentLibraryPage />) },
          { path: 'admin/media/publish', element: page(<PublishPage />) },
          { path: 'admin/payments', element: page(<PaymentMonitoringPage />) },
          { path: 'admin/pricing', element: page(<PricingControlPage />) },
          { path: 'admin/analytics', element: page(<AnalyticsPage />) },
          { path: 'admin/institution-reports', element: page(<InstitutionReportsPage />) },
          { path: 'admin/security-requests', element: page(<SecurityRequestsPage />) },
          { path: 'admin/audit', element: page(<AuditLogPage />) },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

/*
 * Register every lazy route so its chunk can be warmed on hover.
 *
 * Walked from the route table rather than annotated per route: there are 71 of
 * them, and a list maintained by hand would drift the first time someone adds
 * a page. `page()` wraps each element in <Suspense>, so the lazy component is
 * the Suspense child.
 *
 * Paths in the table are relative to their parent, so the walk rebuilds the
 * absolute path as it descends — that is what the sidebar's `to` will match.
 */
interface WalkableRoute {
  path?: string;
  index?: boolean;
  element?: unknown;
  children?: WalkableRoute[];
}

function registerChunks(routes: WalkableRoute[], parent = '') {
  for (const route of routes) {
    const full = route.path
      ? route.path.startsWith('/')
        ? route.path
        : `${parent.replace(/\/$/, '')}/${route.path}`
      : parent;

    const element = route.element as
      | { props?: { children?: { type?: unknown } } }
      | undefined;
    const child = element?.props?.children as { type?: LazyRouteComponent } | undefined;
    const preload = child?.type?.preload;

    if (typeof preload === 'function' && route.path) {
      registerRouteChunk(full, preload);
    }

    if (route.children) registerChunks(route.children, full);
  }
}

registerChunks(router.routes as unknown as WalkableRoute[]);
