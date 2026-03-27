import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth';
import { ScrollToTop } from '@/components/ScrollToTop';
import LandingPage from '@/pages/LandingPage';
import {
  LoginPage,
  RegisterPage,
  ProfileCompletionPage,
  UnauthorizedPage,
} from '@/pages/auth';
import {
  CaseListPage,
  CreateCasePage,
  CaseDetailPage,
  AgentVerificationPage,
  SubmitReportPage,
} from '@/pages/cases';
import {
  PropertyListPage,
  PropertyDetailPage,
  CreatePropertyPage,
  LandlordDashboard,
  TenantDashboard,
  TenantRequestsPage,
  TransactionsPage,
  SavedPropertiesPage,
  VerificationRequestsPage,
} from '@/pages/property';
import {
  MediaFeedPage,
  MediaDetailPage,
  UploadMediaPage,
  InstitutionsPage,
  InstitutionDetailPage,
  MediaAgentDashboard,
  FieldRecordingPage,
  ActivityLogPage,
  ContentLibraryPage,
  PublishPage,
} from '@/pages/media';
import { AvailabilityPage, EarningsPage } from '@/pages/investigator';
import { LegalDocumentsPage } from '@/pages/lawyer';
import { EvidenceAnalysisPage } from '@/pages/medical';
import { MessagingPage } from '@/pages/messaging';
import { PaymentPage, PaymentHistoryPage } from '@/pages/payments';
import {
  DashboardPage,
  ProfilePage,
  SettingsPage,
  NotificationsPage,
} from '@/pages/dashboard';
import {
  AdminDashboard,
  UserManagementPage,
  CaseOversightPage,
  VerificationPage,
  MediaApprovalsPage,
  PaymentMonitoringPage,
  AnalyticsPage,
  PricingControlPage,
  InstitutionReportsPage,
  SecurityRequestsPage,
} from '@/pages/admin';
import {
  AboutPage,
  HowItWorksPage,
  InvestigationsPage,
  PropertyVerificationPage,
  TransparencyPage,
  BecomeAgentPage,
  PartnersPage,
  PricingPage,
  FAQsPage,
  ContactPage,
  BlogPage,
  BlogPostPage,
  LegalPage,
  ReportsPage,
  MediaPage,
  PublicPropertyListPage,
  PublicPropertyDetailPage,
  FountainSourcePage,
  FountainSourceRequestPage,
} from '@/pages/public';

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
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Public pages
  { path: '/about', element: <AboutPage /> },
  { path: '/how-it-works', element: <HowItWorksPage /> },
  { path: '/services/investigations', element: <InvestigationsPage /> },
  { path: '/services/property', element: <PropertyVerificationPage /> },
  { path: '/services/transparency', element: <TransparencyPage /> },
  { path: '/property', element: <PublicPropertyListPage /> },
  { path: '/property/:id', element: <PublicPropertyDetailPage /> },
  { path: '/media', element: <MediaPage /> },
  { path: '/reports', element: <ReportsPage /> },
  { path: '/become-agent', element: <BecomeAgentPage /> },
  { path: '/partners', element: <PartnersPage /> },
  { path: '/pricing', element: <PricingPage /> },
  { path: '/faqs', element: <FAQsPage /> },
  { path: '/contact', element: <ContactPage /> },
  { path: '/blog', element: <BlogPage /> },
  { path: '/blog/:slug', element: <BlogPostPage /> },
  { path: '/privacy', element: <LegalPage /> },
  { path: '/terms', element: <LegalPage /> },
  { path: '/disclaimer', element: <LegalPage /> },
  { path: '/legal/:type', element: <LegalPage /> },
  { path: '/fountain-source', element: <FountainSourcePage /> },
  { path: '/fountain-source/request', element: <FountainSourceRequestPage /> },

  {
    path: '/profile/complete',
    element: (
      <ProtectedRoute>
        <ProfileCompletionPage />
      </ProtectedRoute>
    ),
  },
  { path: '/unauthorized', element: <UnauthorizedPage /> },

  // Dashboard (authenticated)
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      // ── Common (all authenticated roles) ──────────────────────
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'messages', element: <MessagingPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'payments', element: <PaymentPage /> },
      { path: 'payments/history', element: <PaymentHistoryPage /> },

      // ── Investigative Services ────────────────────────────────
      // complainant, investigator, lawyer, medical_expert, witness
      { path: 'cases', element: <CaseListPage /> },
      { path: 'cases/assigned', element: <CaseListPage /> },
      { path: 'cases/new', element: <CreateCasePage /> },
      { path: 'cases/:id', element: <CaseDetailPage /> },
      { path: 'cases/submit-report', element: <SubmitReportPage /> },

      // investigator only
      { path: 'verification', element: <AgentVerificationPage /> },
      { path: 'availability', element: <AvailabilityPage /> },

      // investigator, lawyer
      { path: 'earnings', element: <EarningsPage /> },

      // lawyer only
      { path: 'legal-documents', element: <LegalDocumentsPage /> },

      // medical_expert only
      { path: 'evidence-analysis', element: <EvidenceAnalysisPage /> },

      // ── Property ──────────────────────────────────────────────
      // landlord, tenant
      { path: 'property', element: <PropertyListPage /> },
      { path: 'property/:id', element: <PropertyDetailPage /> },

      // landlord only
      { path: 'property/create', element: <CreatePropertyPage /> },
      { path: 'property/landlord', element: <LandlordDashboard /> },
      { path: 'property/requests', element: <TenantRequestsPage /> },
      { path: 'property/transactions', element: <TransactionsPage /> },

      // tenant only
      { path: 'property/tenant', element: <TenantDashboard /> },
      { path: 'property/saved', element: <SavedPropertiesPage /> },
      { path: 'property/verify', element: <VerificationRequestsPage /> },

      // ── Media ─────────────────────────────────────────────────
      // media_agent only
      { path: 'media', element: <MediaFeedPage /> },
      { path: 'media/agent', element: <MediaAgentDashboard /> },
      { path: 'media/institutions', element: <InstitutionsPage /> },
      { path: 'media/institutions/:id', element: <InstitutionDetailPage /> },
      { path: 'media/upload', element: <UploadMediaPage /> },
      { path: 'media/record', element: <FieldRecordingPage /> },
      { path: 'media/activity', element: <ActivityLogPage /> },
      { path: 'media/:id', element: <MediaDetailPage /> },

      // ── Admin ─────────────────────────────────────────────────
      { path: 'admin', element: <AdminDashboard /> },
      { path: 'admin/users', element: <UserManagementPage /> },
      { path: 'admin/cases', element: <CaseOversightPage /> },
      { path: 'admin/verifications', element: <VerificationPage /> },
      { path: 'admin/properties', element: <PropertyListPage /> },
      { path: 'admin/media', element: <MediaApprovalsPage /> },
      { path: 'admin/media/library', element: <ContentLibraryPage /> },
      { path: 'admin/media/publish', element: <PublishPage /> },
      { path: 'admin/payments', element: <PaymentMonitoringPage /> },
      { path: 'admin/pricing', element: <PricingControlPage /> },
      { path: 'admin/analytics', element: <AnalyticsPage /> },
      { path: 'admin/institution-reports', element: <InstitutionReportsPage /> },
      { path: 'admin/security-requests', element: <SecurityRequestsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
