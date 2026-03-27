# The Security Watch

**...your concern**

A comprehensive, production-ready platform integrating three systems: **Investigative Services**, **Institutional Transparency & Media**, and **Property Verification & Real Estate Marketplace**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| State | Zustand |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| Payments | Stripe (international), Paystack (Nigeria/West Africa) |
| Email | Resend |
| Build | Vite 8 |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- Stripe & Paystack accounts (for payments)
- Resend account (for emails)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxx
VITE_RESEND_API_KEY=re_xxx
```

### 3. Set Up Database

Run the migration SQL in your Supabase SQL Editor or via CLI:

```bash
# Using Supabase CLI
supabase db push

# Or manually copy supabase/migrations/001_initial_schema.sql
# into the Supabase Dashboard → SQL Editor → Run
```

Then run the seed data:

```bash
# Copy supabase/seed/seed.sql into the SQL Editor
```

### 4. Deploy Edge Functions

```bash
supabase functions deploy match-investigator
supabase functions deploy send-notification-email
supabase functions deploy generate-report
```

Set secrets for Edge Functions:

```bash
supabase secrets set RESEND_API_KEY=re_xxx
```

### 5. Create Storage Buckets

In Supabase Dashboard → Storage, create these buckets:

- `evidence` (private)
- `avatars` (public)
- `property-images` (public)
- `property-documents` (private)
- `media-reports` (public)
- `kyc-documents` (private)
- `chat-files` (private)

### 6. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

---

## Project Structure

```
├── public/
│   └── assets/           # Logo, static assets
├── src/
│   ├── components/
│   │   ├── ui/           # Reusable UI components (Button, Card, Modal, etc.)
│   │   ├── layout/       # Sidebar, Header, DashboardLayout
│   │   ├── auth/         # ProtectedRoute
│   │   ├── cases/        # CaseCard, EvidenceTimeline, CaseStatusTracker
│   │   ├── property/     # PropertyCard
│   │   ├── media/        # ScoreCard, InstitutionCard
│   │   ├── messaging/    # ConversationList, ChatWindow, MessageInput
│   │   └── payments/     # PaymentModal
│   ├── pages/
│   │   ├── auth/         # Login, Register, ProfileCompletion
│   │   ├── dashboard/    # Dashboard, Profile, Settings, Notifications
│   │   ├── cases/        # CaseList, CreateCase, CaseDetail, AgentVerification
│   │   ├── property/     # PropertyList, PropertyDetail, CreateProperty, Landlord/Tenant
│   │   ├── media/        # MediaFeed, MediaDetail, UploadMedia, Institutions
│   │   ├── admin/        # Admin Dashboard, User/Case/Property/Media Management
│   │   ├── messaging/    # MessagingPage
│   │   └── payments/     # PaymentPage, PaymentHistory
│   ├── stores/           # Zustand stores (auth, case, message, property, media, notification, payment)
│   ├── services/         # Business logic (matching, payments, audit)
│   ├── lib/              # Supabase client, utilities
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Helper functions
├── supabase/
│   ├── migrations/       # PostgreSQL schema with RLS
│   ├── functions/        # Edge Functions (matching, email, reports)
│   └── seed/             # Seed data
```

---

## User Roles

| Role | Access |
|------|--------|
| Complainant | Create cases, upload evidence, track case progress |
| Investigator | Receive case assignments, manage investigations |
| Lawyer | Handle legal processing of cases |
| Medical/Forensic Expert | Provide expert analysis on cases |
| Witness/Informant | Submit witness reports |
| Landlord | List properties, manage tenants, handle verification |
| Tenant/Buyer | Browse properties, submit requests |
| Media Agent | Upload institutional reports, monitor institutions |
| Admin | Full platform control, approvals, analytics |

---

## Core Modules

### 1. Investigative Services
- Case creation with evidence uploads
- SHA-256 file hashing and chain of custody
- AI-powered agent matching (Edge Function)
- Case status tracking through 7 stages
- Multi-step agent verification with guarantor system

### 2. Institutional Transparency & Media
- Monitor police, hospitals, schools, courts, markets
- Upload and publish video/audio/photo reports
- GPS and timestamp auto-attachment
- 5-metric performance scoring system
- Institution rankings and downloadable reports

### 3. Property Verification & Real Estate
- Property listings with image galleries
- Document-based verification workflow
- Landlord dashboard with tenant management
- Tenant property requests and background checks
- Marketplace with filtering by location, price, type

### 4. Secure Communication
- Real-time messaging (Supabase Realtime)
- 1:1 and group case chat
- File sharing in conversations
- Read receipts

### 5. Payment System
- Stripe integration (international)
- Paystack integration (Nigeria/West Africa)
- Payment history and receipts
- Admin payment monitoring

---

## Security

- **Row Level Security (RLS)** on all tables
- **JWT-based authentication** via Supabase Auth
- **File access restrictions** via storage policies
- **Audit logging** for all critical operations
- **Role-based access control** enforced at database and frontend levels
- **Evidence integrity** via SHA-256 hashing and chain of custody

---

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

---

## License

Proprietary — The Security Watch © 2026
