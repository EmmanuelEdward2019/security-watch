> # ⚠️ SUPERSEDED — DO NOT BUILD FROM THIS FILE
>
> This describes a backend that no longer exists. Between this document and
> now, the platform was security-hardened across migrations 004–011: roles
> can no longer be self-granted, case status and payments are server-mediated,
> private buckets require signed URLs, and several patterns below now fail —
> some of them **silently**, by design.
>
> Use **[MOBILE_MASTER_PROMPT.md](MOBILE_MASTER_PROMPT.md)** instead. It was verified against the live
> database on 30 July 2026.
>
> Kept only for historical reference.

---

# Master Prompt — Build "The Security Watch" Mobile App (React Native / Expo)

> Paste the entire block below into Antigravity (or any other AI coding agent) to bootstrap the mobile app. Attach `MOBILE_APP_API_DOCUMENTATION.md`, the project's `src/types/index.ts`, and the SQL migrations as context — they are the authoritative specs for the backend and types.

---

## SYSTEM PROMPT — Read this first

You are building **The Security Watch Mobile App** — a React Native (Expo) companion to the production web app at `https://thesecuritywatch.com`. The web app already exists, fully deployed, and the **backend is shared**: same Supabase project (`pqjwzidrgkskpjihxvxa`), same Postgres tables, same RLS policies, same storage buckets, same edge functions. Do not propose a new backend. Do not change the schema. Do not invent new endpoints.

Your job is to ship a **production-grade, accessible, branded mobile app** that hooks into the existing backend exactly as documented in `MOBILE_APP_API_DOCUMENTATION.md`.

---

## 1. Product Context (Read This Before Writing Code)

**The Security Watch** is a Nigerian-built civic-tech platform that combines three pillars:

1. **Investigative Services** — citizens (complainants) report cases (fraud, robbery, missing persons, corruption, etc.); the platform matches them with verified investigators, lawyers, and medical/forensic experts who collaborate through case files, evidence uploads with chain-of-custody, and encrypted chat.
2. **Property Verification & Marketplace** — landlords list properties, tenants browse and request verifications before paying; admin verifies title documents.
3. **Institutional Transparency** — media agents film and upload field reports about public institutions (police stations, hospitals, schools, markets, government offices, courts); citizens rate institutions on 5 dimensions (punctuality, professionalism, cleanliness, integrity, service delivery).

A fourth secondary module — **Fountain Source** — is a public-facing service-enquiry form for corporate security contracts (guards, surveillance, escort services, event security, debt recovery, etc.).

**Mission statement:** "Investigative services · Property verification · Institutional transparency."
**Tagline:** "...your concern"
**Tone:** Trustworthy, civic-minded, journalistic. Premium but accessible. Not flashy.

---

## 2. Tech Stack (Use Exactly These)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 54+ with EAS Build** | Cross-platform, OTA updates, push notifications built-in |
| Language | **TypeScript 5.x** (strict mode) | Shared types with web |
| Navigation | **Expo Router (file-based) + React Navigation under the hood** | Deep linking maps cleanly to web routes |
| State (server) | **TanStack Query v5** | Caching, retries, optimistic updates |
| State (client) | **Zustand v5** with `AsyncStorage` persistence | Mirrors the web app's authStore pattern |
| Forms | **React Hook Form + Zod** | Same pattern as web |
| Backend client | **@supabase/supabase-js v2** | Same as web — no abstraction layer |
| Storage adapter | **@react-native-async-storage/async-storage** | Required for Supabase session persistence |
| Icons | **lucide-react-native** | Exact same icon set as web |
| Date | **date-fns v4** | Same as web |
| Animations | **react-native-reanimated v3** + **moti** | Drop-in framer-motion alternative |
| Payments | **react-native-paystack-webview** | Paystack inline doesn't run in RN |
| Charts | **react-native-svg-charts** or **victory-native** | For earnings/analytics screens |
| Notifications | **expo-notifications** + APNs/FCM via EAS | Replaces in-app polling |
| Media capture | **expo-camera**, **expo-image-picker**, **expo-av**, **expo-document-picker**, **expo-location** | Required for evidence + media report flows |
| File hash | **expo-crypto** (SHA-256) | Mirror web's `generateFileHash` |
| Maps | **react-native-maps** with Google Maps provider | Case location, property location |
| Toasts | **react-native-toast-message** or **sonner-native** | Replace `react-hot-toast` |
| Testing | **Jest + @testing-library/react-native** | Standard |
| Linting | **ESLint + Prettier** | Same rules as web where applicable |

---

## 3. Branding & Visual Identity

### 3.1 Logo

Use `https://thesecuritywatch.com/assets/logo.png` (already public). Bundle a local copy at `assets/logo.png` for splash/icon. Logo aspect: 1:1 square, dark forest-green background recommended.

### 3.2 Color Palette (Lift verbatim from web `src/index.css`)

```ts
// theme/colors.ts
export const colors = {
  // Brand — primary forest green
  brand: {
    50:  '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',   // primary action
    700: '#15803d',
    800: '#166534',
    900: '#14532d',   // headers, primary dark
    950: '#052e16',
  },
  // Forest (logo) — used for hero/header surfaces
  forest: {
    50:  '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    500: '#22c55e',
    600: '#1b4332',   // signature deep forest from logo
    700: '#14532d',
    800: '#0f3d32',
  },
  // Accent — red (alerts, urgent cases)
  accent: {
    50:  '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  // Lime — pulled from logo for highlights/success badges
  lime: { 400: '#a3e635', 500: '#84cc16' },

  // Light theme surfaces
  surface: {
    0:   '#ffffff',
    50:  '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  // Dark theme surfaces (palette inverted exactly as the web does)
  surfaceDark: {
    0:   '#09090b',
    50:  '#111113',
    100: '#1c1c21',
    200: '#26262e',
    300: '#3a3a45',
    400: '#52525b',
    500: '#71717a',
    600: '#a1a1aa',
    700: '#d4d4d8',
    800: '#e4e4e7',
    900: '#f4f4f5',
  },
} as const
```

**Semantic mapping:**
- **Primary CTA:** `brand-600` (`#16a34a`), pressed → `brand-700`.
- **Header / nav background:** `forest-600` (`#1b4332`).
- **Destructive / urgent:** `accent-600` (`#dc2626`).
- **Success badges:** `brand-500` / `lime-500`.
- **Critical urgency badge:** `accent-600` bg, white text.
- **High:** orange-500.
- **Medium:** yellow-500.
- **Low:** `brand-500`.

### 3.3 Typography

| Use | Family | Weights |
|---|---|---|
| All text | **Inter** | 400, 500, 600, 700, 800 |
| Optional display variant | **Inter Display** | 600, 700, 800 |

Load via `expo-font` from `@expo-google-fonts/inter`.

**Type scale:**

| Token | Size / Line height | Weight | Use |
|---|---|---|---|
| `display-1` | 32 / 40 | 800 | Splash hero |
| `display-2` | 28 / 36 | 700 | Page titles |
| `h1` | 24 / 32 | 700 | Section titles |
| `h2` | 20 / 28 | 700 | Card titles |
| `h3` | 18 / 26 | 600 | Sub-section |
| `body-lg` | 16 / 24 | 400 | Body text |
| `body` | 14 / 22 | 400 | Default body |
| `caption` | 12 / 18 | 500 | Labels, metadata |
| `overline` | 11 / 16 | 600, +0.08em letter-spacing, uppercase | Tags |

### 3.4 Spacing, Radii, Shadows

**Spacing (4-pt scale):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
**Border radii:** `xs:4`, `sm:8`, `md:12`, `lg:16`, `xl:20`, `2xl:24`, `pill:9999`.
**Shadows:** use Reanimated/UIKit shadow; standardize 4 levels (sm, md, lg, xl). All shadows tinted slightly green (`rgba(15, 61, 50, 0.08)`).

### 3.5 Iconography
**lucide-react-native** at 20-24px for inline, 32px for empty-states, 48px+ for hero. Stroke width 2.

### 3.6 Imagery
Bundled assets in web app (`public/assets/*.jpg`) are available at `https://thesecuritywatch.com/assets/*.jpg`. Reference them via remote URLs in marketing screens. Photo style: documentary photojournalism — real people, real settings, no stock-photo gloss.

### 3.7 Dark mode

Required. Use a `ThemeProvider` that swaps `surface` for `surfaceDark`. System-preference + user override (persist in AsyncStorage key `tsw-theme`). Mirror the web's anti-flash pattern (apply theme before first render).

---

## 4. Information Architecture (Tabs & Screens)

### 4.1 Auth stack (unauthenticated)
- `WelcomeScreen` — logo, value props, CTA buttons (Sign In / Create Account / Browse Properties).
- `SignInScreen` — email + password, "Remember me" toggle (mirror web's behaviour: persist session in AsyncStorage if checked; clear on app background+terminate if unchecked), forgot-password link.
- `SignUpScreen` — multi-step: step 1 role select (8 user roles, exclude admin), step 2 personal info, step 3 password + T&Cs.
- `VerifyOtpScreen` — 8-box numeric OTP input (auto-advance, paste support, auto-submit on completion). Modes: `signup` or `recovery`.
- `ResetPasswordScreen` — new password + confirm, strength meter.
- `ProfileCompletionScreen` — KYC document upload, avatar, bio, location.

### 4.2 Authenticated bottom-tab layout

Tabs depend on role. Show 4–5 tabs max per role.

| Role | Tabs (in order) |
|---|---|
| `complainant` | Dashboard · Cases · Messages · Notifications · Profile |
| `investigator` | Dashboard · Cases · Availability · Earnings · Profile |
| `lawyer` | Dashboard · Cases · Documents · Earnings · Profile |
| `medical_expert` | Dashboard · Cases · Evidence · Profile |
| `witness` | Dashboard · Cases · Messages · Profile |
| `landlord` | Dashboard · Properties · Requests · Transactions · Profile |
| `tenant` | Dashboard · Browse · Saved · Requests · Profile |
| `media_agent` | Dashboard · Record · Library · Activity · Profile |
| `admin` | Overview · Users · Verifications · Reports · Profile |

A **central FAB** appears on Dashboard for role-specific quick actions:
- complainant → "Report a Case"
- landlord → "Add Property"
- media_agent → "Record Field Report"

### 4.3 Deep screens (modal/stack pushed)
- Case detail (tabs: Overview, Evidence, Chain of custody, Messages, Payments)
- Property detail (gallery, details, owner, verification status, request CTA)
- Chat room (`messages/<conversationId>`)
- Settings (profile, theme, 2FA enrol, notification prefs, account deletion)
- Payment sheet (Paystack WebView)
- Media viewer (image / video / audio with playback controls)

---

## 5. UI Component System

Build a shared `components/` library mirroring the web's `src/components/ui`:

| Component | Mirrors web | Notes |
|---|---|---|
| `<Button>` | `components/ui/Button.tsx` | Variants: primary, secondary, outline, ghost, danger. Loading state with spinner. |
| `<Input>` | text/email/numeric/password | Leading icon, trailing eye-toggle on password, error text below |
| `<OtpInput>` | 8 boxes | Auto-advance, paste-anywhere, auto-submit when full |
| `<Card>` | rounded-2xl, shadow-sm | |
| `<Badge>` | status pills | Color variants match case urgency / verification status |
| `<Avatar>` | with initials fallback | Round, 3 sizes |
| `<EmptyState>` | icon + title + body + CTA | |
| `<Skeleton>` | loading placeholders | |
| `<Modal>` / `<BottomSheet>` | use `@gorhom/bottom-sheet` | |
| `<Toast>` | success / error / info / warning | |
| `<Header>` | left back, title, right action | |
| `<TabBar>` | custom curved with center FAB | |
| `<FileUploader>` | image / video / document picker | Calls `expo-image-picker` etc., generates SHA-256, uploads to correct bucket |
| `<MapView>` | react-native-maps wrapper | Used for case locations & properties |
| `<RoleBadge>` | colored pill per UserRole | Matches web colors |

**Accessibility:** every interactive element must have `accessibilityLabel`, hit-slop ≥ 44pt, support Dynamic Type, screen-reader labels in English. Pass `accessibilityRole` consistently.

---

## 6. Data Layer Implementation Rules

### 6.1 Supabase client
Create `lib/supabase.ts` per docs §1.3. Single instance, no wrappers.

### 6.2 TanStack Query
Wrap every read in a query hook (`useCases`, `useCase(id)`, `useProperties`, …).
Wrap every write in a mutation that invalidates the relevant queries.
**Key conventions:**
- `['cases', { role, userId, filters }]`
- `['case', id]`
- `['evidence', caseId]`
- `['properties', filters]`
- `['property', id]`
- `['conversations', userId]`
- `['messages', conversationId]`
- `['notifications', userId, { unreadOnly }]`
- `['payments', userId]`
- `['earnings', userId, role]`

### 6.3 Zustand stores
Only for true client state: auth (session + profile), theme, search filters, offline queue. **Do not duplicate server data in Zustand** — that lives in Query cache.

### 6.4 Realtime
Subscribe in screen `useEffect` and unsubscribe on unmount. Listen to:
- `messages` filtered by current conversation
- `notifications` filtered by current user
- `cases` filtered by `id` on case detail screen (for status changes)

### 6.5 Offline support
- Cache last-fetched data via TanStack Query's `persistQueryClient` to AsyncStorage.
- Queue mutations (case creation, message send, evidence upload) when offline; replay on reconnect.
- Show a top banner when offline (use `@react-native-community/netinfo`).

### 6.6 Push notifications
1. On login, register an Expo push token; upsert into `profiles.expo_push_token` (add this column via migration if not present).
2. When the app receives a notification, route based on `data.link` mirroring the web routes.
3. Show a badge on the Notifications tab tied to `count(notifications where read = false)`.

---

## 7. Critical Feature Specifications

### 7.1 Sign-up flow
1. Step 1 — Role picker grid (8 roles, exclude admin). Show role icon + label + 1-line description.
2. Step 2 — `full_name`, `email`, `phone`.
3. Step 3 — `password`, `confirmPassword`, T&C checkbox.
4. Call `supabase.auth.signUp` with `options.data = { full_name, role }`.
5. Push `VerifyOtpScreen` with `mode=signup`.

### 7.2 OTP entry (sign-up + recovery)
- **8 input boxes**, numeric only, auto-advance, paste support (split a pasted 8-digit string across all boxes), auto-submit when filled.
- Resend button with 60s cooldown.
- On success in signup mode → fetch profile → push role's home tab stack.
- On success in recovery mode → push `ResetPasswordScreen`.

### 7.3 Report a Case (complainant)
- Multi-step form: title + description → category picker (with icons) → urgency slider (low → critical with color) → location (map picker + reverse geocoding) → evidence (multi-upload). 
- On submit: insert into `cases`, then for each evidence file: upload to `evidence` bucket, generate SHA-256, insert into `evidence` with initial chain-of-custody entry `{action: 'submitted', user_id, user_name}`.
- After case created, optionally call `match-investigator` edge function to surface top 3 candidate agents.

### 7.4 Case detail
Tabs:
1. **Overview** — title, description, status timeline, location map, assigned team avatars.
2. **Evidence** — grid of files with type-specific previews (image lightbox, video player, document opener). Add new evidence button (role-gated).
3. **Chain of Custody** — vertical timeline reading `evidence.chain_of_custody` JSONB.
4. **Messages** — embedded chat for case conversation.
5. **Payments** — list of payments for `case_id` (visible only to payer + admin).

Status transitions emit notifications + transactional emails (already wired server-side via `caseStore.updateCase` — replicate the same logic in mobile mutations).

### 7.5 Messaging
- Inbox list: query `conversations` joined with last message + unread count.
- Chat room: paginated infinite scroll (50 msgs/page, `range()`), realtime subscription for new inserts, file attachment via `chat-files` bucket.
- Read receipts: on opening a conversation, update `messages.read_at` for unread incoming.

### 7.6 Property browsing
- Public list visible without auth (use anon key directly). Filters: type, listing_type (sale/rent), price range, bedrooms, location text search.
- Tenant can save a property (new table `saved_properties` if not present — add via migration).
- Tenant can request a verification (insert into `property_requests`).

### 7.7 Media field report (media_agent)
- "Record" screen: camera/audio/document picker → metadata (title, description, institution selector, tags, GPS auto-capture) → upload.
- Show activity log of own submissions and current `status`.

### 7.8 Payments (Paystack WebView)
- Reuse the rule from web: only payer roles see `Payments`. Earnings tab for payees shows aggregated completed payments tied to their assigned cases.
- On Paystack success: insert into `payments` table, send `payment_received` email via edge function.

### 7.9 Notifications screen
- Group by date.
- Tap to mark read + deep-link to `notification.link`.
- "Mark all as read" action.

### 7.10 Settings
- Profile (edit name, phone, avatar, bio, location).
- Appearance (light / dark / system).
- Notifications (in-app + push toggles, persisted per user in `profiles.notification_prefs` — add JSONB column via migration).
- Security (change password, enrol/unenrol 2FA TOTP).
- Account (delete account → insert deletion request, sign out, route to Welcome).

---

## 8. Quality Bar

### 8.1 Performance
- All list screens must use `FlashList` (Shopify) or `FlatList` with `getItemLayout`.
- Image cache via `expo-image` (`memory-disk` policy).
- Avoid re-renders on chat: virtualize and stabilize message identity.
- Hit interaction budget < 100ms; cold start < 2s on a mid-tier Android.

### 8.2 Accessibility
- All forms support TalkBack/VoiceOver.
- All text scales to 200% without truncation.
- Color contrast WCAG AA (test with brand-600 on white — it passes).
- Long-press alternatives for every gesture.

### 8.3 Security
- Never log JWTs, OTPs, or file paths to console in production.
- Strip `console.*` via Babel in release builds.
- Use Expo SecureStore for any local secrets beyond the Supabase session (e.g. biometric flag).
- Use device biometric to unlock app on resume (optional toggle in Settings).

### 8.4 Internationalization
- All strings via `i18next` with `en` baseline.
- Future locales: `yo`, `ig`, `ha` (Nigeria's main languages) — leave scaffolding ready.

### 8.5 Build / Release
- Configure EAS Build profiles: `development`, `preview`, `production`.
- Set up EAS Update for OTA delivery of JS bundle.
- App Store metadata: name "The Security Watch", category "Lifestyle / News", primary keyword "investigative". Privacy-policy URL: `https://thesecuritywatch.com/privacy`.
- Google Play: same as above, content rating Teen, in-app purchases disabled (Paystack handled via WebView).

---

## 9. Deliverables Checklist

Working toward MVP launch, deliver in this order:

- [ ] Project bootstrap — Expo + TypeScript strict + ESLint + Prettier + folder structure.
- [ ] Theme system — colors, typography, spacing tokens, dark mode.
- [ ] Component library — 12 components in §5.
- [ ] Auth — sign in, sign up, OTP, password reset, session persistence, remember-me parity with web.
- [ ] Profile completion + role gating.
- [ ] Dashboard scaffolds for all 9 roles.
- [ ] Cases module — list, create, detail, evidence upload, chain of custody.
- [ ] Messaging — inbox, realtime chat, attachments.
- [ ] Notifications + push.
- [ ] Property module (landlord + tenant).
- [ ] Media reports module (media_agent).
- [ ] Earnings + payments (Paystack WebView).
- [ ] Settings (theme, 2FA, account deletion).
- [ ] Admin overview screens (read-only mobile view of users, cases, verifications).
- [ ] Offline queue.
- [ ] EAS Build configs + first internal preview build to TestFlight & Google Play Internal Testing.

---

## 10. Non-Negotiables (Do These or the App Will Break)

1. **Use the existing Supabase project — do not spin up a new one.** Credentials in §1.1 of `MOBILE_APP_API_DOCUMENTATION.md`.
2. **Mirror the 8-digit OTP behavior** — the Supabase project's OTP length is 8, not 6. All OTP screens have 8 boxes.
3. **Respect RLS** — every query relies on the authenticated user's JWT. Never use a service-role key client-side.
4. **Mirror the role-based payment rule** — payee roles (`investigator`, `lawyer`, `medical_expert`, `media_agent`) never see a "Pay" screen; they see "Earnings". Admin never sees either.
5. **Use Inter font everywhere** — system fallback only on the splash before fonts load.
6. **Logo on every transactional email scenario** in mobile must match the web — the edge function already handles this; just don't replace the email shell.
7. **Deep-link routes must match the web routes** in §11 of the API docs (with `/app/` prefix).
8. **All copy + brand colors come from this doc** — do not invent slogans or recolor primary actions.

---

## 11. First Task

Once you've read this entire prompt and the attached API documentation, your **first deliverable** is:

1. Initialize a new Expo project with all dependencies installed.
2. Wire up the Supabase client with AsyncStorage persistence.
3. Build the theme system (colors, typography, spacing, dark mode).
4. Build the auth flow end-to-end: Welcome → Sign In / Sign Up → 8-digit OTP → role-routed Dashboard placeholder.
5. Verify on Expo Go that a new account can be created and a sign-in attempt with that account succeeds with the existing production Supabase instance.

Confirm with a short summary of what's running and what's stubbed, then await go-ahead before scaffolding the rest.

---

**Reference docs to consult continuously:**
- `MOBILE_APP_API_DOCUMENTATION.md` (this repo)
- `src/types/index.ts` (this repo) — single source of truth for TS interfaces
- `supabase/migrations/*.sql` (this repo) — authoritative schema
- `https://supabase.com/docs/reference/javascript/introduction`
- `https://docs.expo.dev`
