import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout';
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
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const VerifyOtpPage = lazy(() => import('@/pages/auth/VerifyOtpPage').then((m) => ({ default: m.VerifyOtpPage })));
const ProfileCompletionPage = lazy(() => import('@/pages/auth/ProfileCompletionPage').then((m) => ({ default: m.ProfileCompletionPage })));
const UnauthorizedPage = lazy(() => import('@/pages/auth/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage })));

// ── Public ────────────────────────────────────────────────────────────────────
const AboutPage = lazy(() => import('@/pages/public/AboutPage'));
const HowItWorksPage = lazy(() => import('@/pages/public/HowItWorksPage'));
const InvestigationsPage = lazy(() => import('@/pages/public/InvestigationsPage'));
const PropertyVerificationPage = lazy(() => import('@/pages/public/PropertyVerificationPage'));
const TransparencyPage = lazy(() => import('@/pages/public/TransparencyPage'));
const BecomeAgentPage = lazy(() => import('@/pages/public/BecomeAgentPage'));
const PartnersPage = lazy(() => import('@/pages/public/PartnersPage'));
const PricingPage = lazy(() => import('@/pages/public/PricingPage'));
const FAQsPage = lazy(() => import('@/pages/public/FAQsPage'));
const ContactPage = lazy(() => import('@/pages/public/ContactPage'));
const BlogPage = lazy(() => import('@/pages/public/BlogPage'));
const BlogPostPage = lazy(() => import('@/pages/public/BlogPostPage'));
const LegalPage = lazy(() => import('@/pages/public/LegalPage'));
const ReportsPage = lazy(() => import('@/pages/public/ReportsPage'));
const MediaPage = lazy(() => import('@/pages/public/MediaPage'));
const PublicPropertyListPage = lazy(() => import('@/pages/public/PublicPropertyListPage'));
const PublicPropertyDetailPage = lazy(() => import('@/pages/public/PublicPropertyDetailPage'));
const FountainSourcePage = lazy(() => import('@/pages/public/FountainSourcePage'));
const FountainSourceRequestPage = lazy(() => import('@/pages/public/FountainSourceRequestPage'));

// ── Dashboard ─────────────────────────────────────────────────────────────────
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import('@/pages/dashboard/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NotificationsPage = lazy(() => import('@/pages/dashboard/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));

// ── Cases ─────────────────────────────────────────────────────────────────────
const CaseListPage = lazy(() => import('@/pages/cases/CaseListPage').then((m) => ({ default: m.CaseListPage })));
const CreateCasePage = lazy(() => import('@/pages/cases/CreateCasePage').then((m) => ({ default: m.CreateCasePage })));
const CaseDetailPage = lazy(() => import('@/pages/cases/CaseDetailPage').then((m) => ({ default: m.CaseDetailPage })));
const AgentVerificationPage = lazy(() => import('@/pages/cases/AgentVerificationPage').then((m) => ({ default: m.AgentVerificationPage })));
const SubmitReportPage = lazy(() => import('@/pages/cases/SubmitReportPage'));

// ── Property ──────────────────────────────────────────────────────────────────
const PropertyListPage = lazy(() => import('@/pages/property/PropertyListPage').then((m) => ({ default: m.PropertyListPage })));
const PropertyDetailPage = lazy(() => import('@/pages/property/PropertyDetailPage').then((m) => ({ default: m.PropertyDetailPage })));
const CreatePropertyPage = lazy(() => import('@/pages/property/CreatePropertyPage').then((m) => ({ default: m.CreatePropertyPage })));
const LandlordDashboard = lazy(() => import('@/pages/property/LandlordDashboard').then((m) => ({ default: m.LandlordDashboard })));
const TenantDashboard = lazy(() => import('@/pages/property/TenantDashboard').then((m) => ({ default: m.TenantDashboard })));
const TenantRequestsPage = lazy(() => import('@/pages/property/TenantRequestsPage'));
const TransactionsPage = lazy(() => import('@/pages/property/TransactionsPage'));
const SavedPropertiesPage = lazy(() => import('@/pages/property/SavedPropertiesPage'));
const VerificationRequestsPage = lazy(() => import('@/pages/property/VerificationRequestsPage'));

// ── Media ─────────────────────────────────────────────────────────────────────
const MediaFeedPage = lazy(() => import('@/pages/media/MediaFeedPage').then((m) => ({ default: m.MediaFeedPage })));
const MediaDetailPage = lazy(() => import('@/pages/media/MediaDetailPage').then((m) => ({ default: m.MediaDetailPage })));
const UploadMediaPage = lazy(() => import('@/pages/media/UploadMediaPage').then((m) => ({ default: m.UploadMediaPage })));
const InstitutionsPage = lazy(() => import('@/pages/media/InstitutionsPage').then((m) => ({ default: m.InstitutionsPage })));
const InstitutionDetailPage = lazy(() => import('@/pages/media/InstitutionDetailPage').then((m) => ({ default: m.InstitutionDetailPage })));
const MediaAgentDashboard = lazy(() => import('@/pages/media/MediaAgentDashboard').then((m) => ({ default: m.MediaAgentDashboard })));
const FieldRecordingPage = lazy(() => import('@/pages/media/FieldRecordingPage'));
const ActivityLogPage = lazy(() => import('@/pages/media/ActivityLogPage'));
const ContentLibraryPage = lazy(() => import('@/pages/media/ContentLibraryPage'));
const PublishPage = lazy(() => import('@/pages/media/PublishPage'));

// ── Role-specific ─────────────────────────────────────────────────────────────
const AvailabilityPage = lazy(() => import('@/pages/investigator/AvailabilityPage'));
const EarningsPage = lazy(() => import('@/pages/investigator/EarningsPage'));
const LegalDocumentsPage = lazy(() => import('@/pages/lawyer/LegalDocumentsPage'));
const EvidenceAnalysisPage = lazy(() => import('@/pages/medical/EvidenceAnalysisPage'));
const MessagingPage = lazy(() => import('@/pages/messaging/MessagingPage').then((m) => ({ default: m.MessagingPage })));
const PaymentPage = lazy(() => import('@/pages/payments/PaymentPage').then((m) => ({ default: m.PaymentPage })));
const PaymentHistoryPage = lazy(() => import('@/pages/payments/PaymentHistoryPage').then((m) => ({ default: m.PaymentHistoryPage })));

// ── Admin ─────────────────────────────────────────────────────────────────────
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage').then((m) => ({ default: m.UserManagementPage })));
const CaseOversightPage = lazy(() => import('@/pages/admin/CaseOversightPage').then((m) => ({ default: m.CaseOversightPage })));
const VerificationPage = lazy(() => import('@/pages/admin/VerificationPage').then((m) => ({ default: m.VerificationPage })));
const MediaApprovalsPage = lazy(() => import('@/pages/admin/MediaApprovalsPage').then((m) => ({ default: m.MediaApprovalsPage })));
const PaymentMonitoringPage = lazy(() => import('@/pages/admin/PaymentMonitoringPage').then((m) => ({ default: m.PaymentMonitoringPage })));
const AnalyticsPage = lazy(() => import('@/pages/admin/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const PricingControlPage = lazy(() => import('@/pages/admin/PricingControlPage'));
const InstitutionReportsPage = lazy(() => import('@/pages/admin/InstitutionReportsPage'));
const SecurityRequestsPage = lazy(() => import('@/pages/admin/SecurityRequestsPage'));
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage'));

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
            <DashboardLayout />
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
          { path: 'media/activity', element: page(<ActivityLogPage />) },
          { path: 'media/:id', element: page(<MediaDetailPage />) },

          // ── Admin ─────────────────────────────────────────────────────────
          { path: 'admin', element: page(<AdminDashboard />) },
          { path: 'admin/users', element: page(<UserManagementPage />) },
          { path: 'admin/cases', element: page(<CaseOversightPage />) },
          { path: 'admin/verifications', element: page(<VerificationPage />) },
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
