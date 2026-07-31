# Master Prompt — The Security Watch mobile app

**Version 2.0 · 30 July 2026**

Paste everything below into your coding agent in the React Native repo. Attach
`MOBILE_API.md` alongside it — that file is the authoritative backend contract and
this one assumes you have read it.

This supersedes `MOBILE_APP_MASTER_PROMPT.md`. The backend it described has been
security-hardened and materially changed; building from the old prompt will
produce an app that fails silently.

---

# SYSTEM PROMPT

You are building **The Security Watch** mobile app — a React Native (Expo)
companion to the production web app at `https://www.thesecuritywatch.com`.

The backend is **shared and live**: same Supabase project
(`pqjwzidrgkskpjihxvxa`), same Postgres, same RLS, same storage, same edge
functions. Do not propose a new backend. Do not change the schema. Do not invent
endpoints. `MOBILE_API.md` is the contract — when this prompt and that file
disagree, that file wins.

## The single most important thing to understand

This backend actively defends itself, and **some rejections are silent**.

Guard triggers on `profiles`, `cases`, `investigators`, `media_reports` and
`properties` revert forbidden writes and return success. `error` will be `null`.
An optimistic UI will show a change that did not happen, and the attempt is
recorded as a `critical` audit event.

So:

- **Never write a protected column.** Roles, verification statuses, case status,
  publication status, verified badges — all of these go through RPCs.
- **Re-read after mutating a guarded table**, or use the RPC and trust its thrown
  exception.
- **Design the UI so forbidden actions are never offered.** If a user can see a
  button that the database will refuse, that is a bug in the UI, not a security
  feature working.

Assume every screen you build will be used by someone whose safety depends on it
behaving correctly. This is not a CRUD app with a security layer bolted on; the
security model *is* the product.

---

# 1. What this product is

A Nigerian civic-technology platform with three pillars and one commercial arm.

**Investigative services.** Citizens file cases — fraud, robbery, murder,
kidnapping, corruption, missing persons. The platform matches them with verified
investigators, lawyers and forensic experts who collaborate through case files,
hash-verified evidence with a chain of custody, and private chat.

**Property verification and marketplace.** Landlords list; tenants browse, save
and request. A *verified* badge means our team checked the title against the land
registry and inspected the property. That badge is the module's whole value — an
owner cannot apply it to their own listing, and the UI must never suggest they can.

**Institutional transparency.** Media agents record field reports on public
institutions — police commands, hospitals, schools, markets, courts. Citizens rate
them on five measures. Everything is reviewed by an editor before publication,
because these are public accusations against named institutions.

**Fountain Source.** A corporate security-services enquiry funnel: guards,
surveillance, escorts, event security, maritime, debt recovery.

Tone: **trustworthy, civic-minded, journalistic.** Premium but not flashy. People
arrive here on the worst day of their year. Nothing should feel playful.

---

# 2. Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 54+, EAS Build, TypeScript strict |
| Navigation | Expo Router (file-based) |
| Server state | TanStack Query v5 |
| Client state | Zustand + AsyncStorage |
| Backend | `@supabase/supabase-js` v2 — no abstraction layer |
| Session storage | `expo-secure-store` (see API doc §1.3) |
| Forms | React Hook Form + Zod |
| Styling | Unistyles or StyleSheet + a typed theme. **Not** NativeWind |
| Icons | `lucide-react-native` — same set as web |
| Animation | `react-native-reanimated` v3 |
| Camera / media | `expo-camera`, `expo-image-picker`, `expo-av`, `expo-document-picker`, `expo-location` |
| Crypto | `expo-crypto` (SHA-256) |
| Payments | `expo-web-browser` → Paystack hosted checkout |
| Charts | `victory-native` v41 (Skia) |
| Lists | `@shopify/flash-list` |
| Dates | `date-fns` v4 |
| Toasts | `sonner-native` |
| Testing | Jest + `@testing-library/react-native`, Maestro for E2E |

**Why not NativeWind:** the web app's Tailwind config does not translate cleanly,
and a typed theme object gives better autocomplete and no runtime class parsing.
Port the *tokens*, not the utility classes.

---

# 3. Design system

## 3.1 Colour

Derived from the logo — forest green, red accent, lime highlight. Ported verbatim
from the web app so the two products look like one company.

```ts
// theme/colors.ts
export const palette = {
  // Brand — forest green
  brand50:  '#f0fdf4',  brand100: '#dcfce7',  brand200: '#bbf7d0',
  brand300: '#86efac',  brand400: '#4ade80',  brand500: '#22c55e',
  brand600: '#16a34a',  brand700: '#15803d',  brand800: '#166534',
  brand900: '#14532d',  brand950: '#052e16',

  // Deep forest — headers, dark surfaces
  forest600: '#1b4332', forest700: '#14532d', forest800: '#0f3d32',

  // Accent — red. Destructive actions and critical urgency ONLY.
  accent50:  '#fef2f2', accent100: '#fee2e2', accent300: '#fca5a5',
  accent500: '#ef4444', accent600: '#dc2626', accent700: '#b91c1c',

  // Lime — sparingly, for highlight moments
  lime400: '#a3e635', lime500: '#84cc16',

  // Neutrals
  surface0:   '#ffffff', surface50:  '#fafafa', surface100: '#f4f4f5',
  surface200: '#e4e4e7', surface300: '#d4d4d8', surface400: '#a1a1aa',
  surface500: '#71717a', surface600: '#52525b', surface700: '#3f3f46',
  surface800: '#27272a', surface900: '#18181b',

  // Semantic — separate from brand. Never reuse brand green for "success".
  success: '#16a34a', warning: '#d97706', danger: '#dc2626', info: '#0284c7',
} as const;
```

**Dark mode is required**, not optional — field agents record at night and
complainants often use the app privately. Build both from day one; retrofitting
is far more expensive.

```ts
export const lightTheme = {
  bg: palette.surface50,      card: palette.surface0,
  text: palette.surface900,   textMuted: palette.surface500,
  border: palette.surface200, primary: palette.brand600,
  onPrimary: '#ffffff',
};

export const darkTheme = {
  bg: '#0b0f0d',              card: '#151a17',
  text: '#e8ece9',            textMuted: '#8a938d',
  border: '#252c28',          primary: palette.brand400,  // lifted for contrast
  onPrimary: '#052e16',
};
```

Check contrast on both grounds. `brand600` on dark fails WCAG AA — hence the lift
to `brand400`.

## 3.2 Status colour

Encode state in **form as well as colour**, so it survives colour blindness and
low outdoor brightness. Every status pill gets an icon or a distinct shape.

| Domain | Value | Colour | Also signalled by |
|---|---|---|---|
| Case urgency | `critical` | `accent600` | filled dot + bold label |
| | `high` | `warning` | filled dot |
| | `medium` | `info` | outline dot |
| | `low` | `surface400` | outline dot |
| Case status | `submitted` → `closed` | 7-stage progress rail | position on the rail |
| Verification | `verified` | `success` | shield-check icon |
| | `pending` | `warning` | clock icon |
| | `unverified` / `rejected` | `surface400` / `danger` | outline / alert icon |
| Payment | `completed` | `success` | check |
| | `pending` | `warning` | spinner |
| | `failed` | `danger` | alert |

## 3.3 Typography

**Inter**, matching the web app. Load via `expo-font` — do not rely on a system
fallback, the metrics differ enough to break layouts.

```ts
export const type = {
  displayLg: { fontFamily: 'Inter_700Bold',     fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  displayMd: { fontFamily: 'Inter_700Bold',     fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  titleLg:   { fontFamily: 'Inter_600SemiBold', fontSize: 20, lineHeight: 26 },
  titleMd:   { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 22 },
  body:      { fontFamily: 'Inter_400Regular',  fontSize: 15, lineHeight: 22 },
  bodyStrong:{ fontFamily: 'Inter_500Medium',   fontSize: 15, lineHeight: 22 },
  caption:   { fontFamily: 'Inter_400Regular',  fontSize: 13, lineHeight: 18 },
  label:     { fontFamily: 'Inter_500Medium',   fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
  mono:      { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, lineHeight: 16 },
} as const;
```

Use `mono` for hashes, case references, payment references and GPS coordinates —
anything the user may need to read character by character or quote to support.

Respect `allowFontScaling` and test at 200%. Cap headings with `maxFontSizeMultiplier={1.4}`
so a large-text user does not get a two-word title per line.

## 3.4 Spacing, radius, elevation

```ts
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };
```

4pt grid. Screen padding `lg` (16). Card padding `lg`. Gap between cards `md`.

Elevation is restrained — one subtle shadow for cards, one stronger for sheets and
modals. Nothing else floats. On Android use `elevation`; on iOS use `shadowOpacity`
around 0.06–0.10, never higher.

Minimum touch target **44×44**. Field agents use this one-handed, in a hurry,
sometimes in the rain.

## 3.5 Motion

Reanimated, 150–250 ms, `Easing.out(Easing.cubic)`. Purposeful only: sheet entry,
tab transitions, list item entry on first load, the recording pulse.

**No decorative animation.** Respect `useReducedMotion()` and disable everything
non-essential when it is on.

---

# 4. Navigation

Tabs are **role-derived** — the web app's sidebar map is the reference. Never show
a tab the user's role cannot use.

```
app/
  (auth)/          welcome · login · register · verify-otp · forgot-password
                   reset-password · pending-verification
  (app)/
    (tabs)/        _layout.tsx  ← tabs built from role
      index        role dashboard
      [module]     cases | property | media  (per role)
      messages
      notifications
      profile
    cases/[id]     detail · evidence · chat · timeline
    cases/new
    cases/report                (investigator, medical_expert)
    property/[id]
    property/create             (landlord)
    media/[id]
    media/record                (media_agent)
    institutions/[id]
    payments/checkout
    payments/history
    settings/*
  (public)/        properties · media archive · institution rankings · blog
```

Tabs per role — maximum five, overflow into the profile stack:

| Role | Tabs |
|---|---|
| `complainant` | Home · My Cases · Messages · Notifications · Profile |
| `investigator` | Home · Assigned · Reports · Messages · Profile |
| `lawyer` | Home · Cases · Documents · Messages · Profile |
| `medical_expert` | Home · Cases · Analyses · Messages · Profile |
| `witness` | Home · Cases · Messages · Notifications · Profile |
| `landlord` | Home · Listings · Requests · Messages · Profile |
| `tenant` | Home · Browse · Saved · Messages · Profile |
| `media_agent` | Home · Record · Institutions · Activity · Profile |
| `admin` | Overview · Queues · Users · Audit · Profile |

**The public stack must work signed out.** Property listings, the transparency
archive, institution rankings, pricing and the blog are all anonymously readable
and are the app's acquisition surface. Do not gate them behind a login wall.

---

# 5. Screens to build

Ordered by dependency. Ship in this sequence.

## Phase 1 — Foundation

1. **Theme, tokens, primitives** — Button, Input, Select, Card, Badge, StatusPill,
   Avatar, Sheet, Toast, EmptyState, Skeleton, ErrorState. Light and dark. Build
   this first; everything else depends on it.
2. **Supabase client + session** — AppState refresh, SecureStore, deep-link handling.
3. **Auth flows** — welcome, register with role picker, login, 8-digit OTP,
   forgot/reset, TOTP enrolment and challenge.
4. **Pending verification screen** — for accounts whose `requested_role` was not
   granted. Explains what is happening and links to KYC upload. Without this,
   applicants land on an empty dashboard and churn.

## Phase 2 — Core

5. **Role dashboard** — different per role; counts, next actions, recent activity.
6. **Case list + detail** — filters, 7-stage status rail, participants, evidence
   list, custody timeline.
7. **File a case** — multi-step: category → description → location (map pin +
   GPS) → evidence → review. Save a draft locally; people get interrupted.
8. **Evidence capture** — camera, gallery, document. Hash before upload. Show the
   hash. Show verified/failed state on download.
9. **Chat** — conversation list, thread, attachments, read receipts, realtime.

## Phase 3 — Modules

10. **Property browse + detail** — public, works signed out. Verified badge
    prominent, with a tap-through explaining what it means.
11. **Landlord** — listings, create with image upload, tenant requests, transactions.
12. **Tenant** — saved, requests, verification request → checkout.
13. **Field recording** — the flagship screen. See §6.
14. **Institutions** — list, rankings, detail, five-metric rating sheet.
15. **Media archive** — public, published only.

## Phase 4 — Professional roles

16. **Submit investigation report** — case picker, findings, recommendations, attachments.
17. **Legal documents** — upload, type, link to case, filing lifecycle.
18. **Forensic analysis** — case + exhibit picker, methodology, findings,
    conclusion, confidence. **Includes evidence integrity verification.**
19. **Availability + earnings** — investigator/lawyer.

## Phase 5 — Payments, admin, polish

20. **Checkout** — service picker from `service_prices`, hosted Paystack, settlement polling.
21. **Payment history**.
22. **Admin** — queues (verification, media publication, erasure), user management,
    audit trail, stats.
23. **Settings** — profile, notifications, theme, 2FA, account deletion.
24. **Offline, push, accessibility pass, E2E**.

---

# 6. Field recording — build this properly

This is the screen that justifies a mobile app existing at all. The web version
cannot do it well.

Requirements:

- **Video, audio and photo** modes, switchable without losing state.
- **GPS captured at the moment recording starts**, not at submit. Show accuracy
  in metres. Handle denial gracefully — a report without GPS is still accepted,
  and say so rather than blocking.
- **Timestamp** from device clock, displayed and embedded in the description.
- **SHA-256 hash** computed before upload and recorded.
- Live **duration counter** and a recording indicator that is unmistakable.
- **Retake** without losing the metadata form.
- **Resumable upload** — 200 MB limit and Nigerian mobile data means a failed
  upload must not mean a lost recording. Persist the local file and retry.
- **Background-safe**: if the app is backgrounded mid-recording, stop cleanly and
  keep the file.

Make it unmistakably clear that everything filed enters `pending_review` and an
editor decides. The agent is producing evidence about a named institution; they
should feel the weight of that, and be protected by the review step.

---

# 7. Things the old app got wrong

Do not repeat these. Each was a real defect.

1. **Payments were self-declared.** The browser wrote `status: 'completed'` after
   the popup closed. Never infer payment success from UI state — poll the row.
2. **Evidence was unreadable.** Public URLs were stored for a private bucket.
   Store paths; sign on read.
3. **Hashes were recorded but never checked.** Verify on download and surface a
   mismatch loudly.
4. **Roles were self-granted at signup.** Read `profile.role`, never the request.
5. **Mock screens shipped looking real** — hardcoded arrays with success toasts
   that persisted nothing. If a feature is not wired, show an honest empty state.
6. **Errors were swallowed** — `if (!error && data) set(...)` left stale data and
   said nothing. Surface every failure.
7. **Encryption was claimed but absent.** `is_encrypted` is always false. Do not
   put a padlock in the chat UI.

---

# 8. Quality bar

**Performance.** Cold start under 2s on a mid-range Android. FlashList for
anything unbounded. `expo-image` with caching. Memoise list items. Target 60fps
scrolling on a Redmi-class device, not just a flagship — that is the actual user.

**Offline.** Persist the TanStack Query cache. Cases, messages and listings must
be readable offline. Queue evidence uploads and drafts, retry on reconnect. Show
a clear offline banner. This is Nigeria; connectivity is intermittent by default.

**Accessibility.** Every control labelled. 44pt targets. Test with TalkBack and
VoiceOver. Support 200% text. Never rely on colour alone.

**Security.**
- Session in SecureStore, not AsyncStorage.
- No secrets in the bundle beyond the anon key.
- Certificate pinning for the Supabase host on release builds.
- Screenshot blocking on evidence and case-detail screens (`expo-screen-capture`).
- Biometric re-auth before evidence, payments and settings (`expo-local-authentication`).
- Clear the query cache on sign-out.

**Testing.** Unit-test the hash helper, path builder, role permissions and status
transitions. Maestro flows for register → verify → file case → upload evidence,
and browse → verify → pay.

---

# 9. Definition of done

A feature is done when:

- [ ] Works on iOS and Android, light and dark
- [ ] Loading, empty, error and offline states all exist and are honest
- [ ] Every mutation on a guarded table re-reads or uses an RPC
- [ ] No action is offered that the database will refuse
- [ ] Labelled for screen readers, legible at 200% text
- [ ] Errors surface `error.message` from RPCs verbatim
- [ ] No hardcoded data anywhere
- [ ] Tested on a mid-range Android on a throttled connection

---

# 10. Start here

1. `npx create-expo-app@latest --template default` with TypeScript strict.
2. Build the theme and the primitive components. Nothing else until those are solid.
3. Wire the Supabase client exactly as in `MOBILE_API.md` §1.3 — the AppState
   refresh and `detectSessionInUrl: false` are both load-bearing on native.
4. Auth flows end to end, including the pending-verification state.
5. Then Phase 2.

Ask before: adding a dependency not listed here, changing the schema, or building
anything that writes to a guarded table outside its RPC.

When something in `MOBILE_API.md` is ambiguous, **query the live database and find
out** rather than guessing. The migrations in `supabase/migrations/` are the
source of truth and are current as of `011`.
