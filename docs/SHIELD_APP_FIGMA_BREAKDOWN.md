# Shield App — Figma Design Breakdown (A–Z)

A complete breakdown of the Shield security staffing platform for designers. Use this to replicate flows, understand hierarchy, and build accurate Figma designs.

---

## How to Upload into Figma

You can get Shield’s design system and documentation **into Figma** in three ways:

### Option A: Design tokens (colors, spacing, typography)

1. Install **Tokens Studio for Figma** from the [Figma Community](https://www.figma.com/community/plugin/843461159747178978/tokens-studio-for-figma).
2. Open your Figma file → Plugins → **Tokens Studio for Figma**.
3. Go to **Tokens** → create or select a Token Set (e.g. “Shield”).
4. Toggle to **JSON View** (top right).
5. Copy the contents of `docs/figma/shield-design-tokens.json` and paste into the JSON editor.
6. Click **Save**.
7. Open **Settings** → **Export** → export tokens as **Variables** and/or **Styles** into Figma.

Your colors, spacing, radius, typography, and shadows will appear as Figma variables/styles.

### Option B: Sync tokens from GitHub / URL

1. Push this repo (including `docs/figma/shield-design-tokens.json`) to GitHub.
2. In Tokens Studio → **Settings** → **Manage Sync Providers** → add **GitHub**.
3. Point it to `docs/figma/shield-design-tokens.json`.
4. **Pull** to load tokens. Any future updates to the JSON will sync automatically.

### Option C: Full documentation (Markdown → Figma)

1. Install the **md2fig** plugin from the [Figma Community](https://www.figma.com/community/search?model_type=plugins&q=md2fig) (search for “md2fig” or “Markdown to Figma”).
2. Open `docs/SHIELD_APP_FIGMA_BREAKDOWN.md` in a text editor.
3. Copy the entire contents.
4. Run **md2fig** in Figma → paste the Markdown → it will generate text frames with headings, lists, and structure.

Use this for the app breakdown, flows, and feature descriptions. You can then style those frames using the tokens from Option A.

---

## 1. App Overview

**Shield** is a security staffing marketplace connecting:
1. **Venues** — Nightclubs, bars, events, retail
2. **Personnel** — Security guards / door staff
3. **Agencies** — Staffing providers managing multiple guards

**Tech Stack:**
- **Web:** Next.js 14 (App Router), React, Tailwind, Supabase
- **Mobile:** Expo (React Native), Supabase Realtime, Expo Push

**Core flows:** Job posting → Guard matching → Uber-style offers → Accept → Check-in → Payment

---

## 2. User Roles & Entry Points

| Role | Web URL | Mobile | Primary use |
|------|---------|--------|-------------|
| **Venue** | `/d/venue/*` | `/d/venue`, `/venue/[id]` | Post shifts, pay, live view |
| **Personnel** | `/d/personnel/*` | Tabs + standalone screens | Accept shifts, track earnings |
| **Agency** | `/d/agency/*` | `/d/agency`, `/agency/[id]` | Staff management, bookings |
| **Admin** | `/admin` | — | Verifications, errors |

---

## 3. Design System (Design Tokens)

### Colors (Mobile)

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0c0d10` | App background |
| `surface` | `rgba(255,255,255,0.05)` | Cards, inputs |
| `surfaceElevated` | `rgba(255,255,255,0.08)` | Elevated cards |
| `glass` | `rgba(255,255,255,0.03)` | Glass overlays |
| `glassBorder` | `rgba(255,255,255,0.08)` | Borders on glass |
| `text` | `#fafafa` | Primary text |
| `textSecondary` | `#a1a1aa` | Secondary text |
| `textMuted` | `#71717a` | Muted / placeholder |
| `accent` | `#2dd4bf` | Primary accent (teal) |
| `accentMuted` | `rgba(45,212,191,0.25)` | Accent at low opacity |
| `accentSoft` | `rgba(45,212,191,0.15)` | Soft accent bg |
| `primaryBtn` | `#14b8a6` | Primary button |
| `primaryBtnPressed` | `#0d9488` | Pressed state |
| `success` | `#34d399` | Success states |
| `warning` | `#f59e0b` | Warning |
| `error` | `#f87171` | Error (red) |
| `info` | `#60a5fa` | Info (blue) |

### Web Tailwind (Shield palette)

- `shield-50` … `shield-950` (teal scale)
- `ink-950` … `ink-600` (dark neutrals)
- Glow: `0 0 25px rgba(20, 184, 166, 0.4)`
- Glass: `backdrop-blur-glass`, `backdrop-blur-glass-lg`

### Typography (Mobile)

| Style | Size | Weight | Line height |
|-------|------|--------|-------------|
| `display` | 26 | 700 | 32 |
| `title` | 20 | 600 | 26 |
| `titleCard` | 16 | 600 | 22 |
| `body` | 15 | 400 | 22 |
| `bodySmall` | 14 | 400 | 20 |
| `label` | 13 | 500 | — |
| `caption` | 12 | 400 | — |
| `captionMuted` | 11 | 500 | — |

### Spacing

| Token | Px |
|-------|-----|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 20 |
| `xxl` | 24 |

### Radius

| Token | Px |
|-------|-----|
| `xs` | 6 |
| `sm` | 10 |
| `md` | 14 |
| `lg` | 18 |
| `xl` | 24 |
| `full` | 999 |

### Shadows & Effects

- **Glow:** `shadowColor: accent`, `shadowOpacity: 0.3`, `shadowRadius: 12`
- **Subtle:** `shadowOpacity: 0.3`, `shadowRadius: 8`, offset `(0,4)`
- **Orbs:** Floating teal/cyan gradients in the background

---

## 4. Mobile App — Screen Map

### 4.1 Navigation Structure

```
Root _layout
├── (auth) — login, signup, complete-profile
├── (tabs) — Main app
│   ├── explore     — Explore index, agency/[id], personnel/[id], venue/[id]
│   ├── messages    — Message list
│   ├── payments    — Payments (Stripe Connect)
│   ├── account     — Account overview
│   └── settings    — Settings
├── accept-shift/[id]   — Accept shift from offer / deep link
├── booking/[id]        — Booking flow + pay
├── chat/[id]           — Thread view
├── shift/[id]          — Shift detail
├── incidents/report    — Incident report
├── d/                 — Role-specific dashboards (agency, personnel, venue)
└── (standalone)       — calendar, jobs, profile-edit, referrals, etc.
```

### 4.2 Tab Bar (PremiumTabBar)

- **Position:** Floating, bottom, with safe area
- **Width:** Screen − 32px
- **Style:** Blur background, glassmorphism
- **Tabs (5):** Explore | Messages | Payments | Account | Settings
- **Active state:** Scale 1.1, translateY −4, accent color

---

## 5. Key Features — Flows & Components

### 5.1 Uber-Style Shift Offer (Critical)

**When:** Venue posts a new booking → notify-guards API → matched guards get offers

**Flow:**
1. Supabase Realtime inserts into `shift_offers`
2. `ShiftOfferContext` receives event → sets `currentOffer`
3. `ShiftOfferPopup` mounts as full-screen modal
4. Guard sees: venue name, address, date/time, earnings breakdown, countdown (e.g. 60s)
5. Actions: **Swipe right to accept** or tap Decline
6. On accept → `respond-offer` API → assigns shift → success animation

**Components:**
- `ShiftOfferPopup` — Full-screen overlay
- Countdown bar (fills as time runs out)
- Venue card with glass styling
- Swipe-to-accept bar (teal gradient)
- Success checkmark animation on accept

**Design:** Dark background, glass cards, teal CTA, urgency (countdown).

---

### 5.2 Set Up Payments (Stripe Connect)

**Where:** Mobile `payments` tab

**Flow:**
1. User sees "Set Up Payments" / "Connect Bank Account"
2. Fields: Account Holder Name, Sort Code, Account Number
3. Validation errors (e.g. red highlight on invalid field)
4. Stripe capability warning (if `transfers` without `card_payments`)
5. Security copy: "Your bank details are sent directly to Stripe and are never stored on our servers."
6. Button: **Connect Bank Account** (teal primary)

**Note:** Stripe Connect onboarding; platform needs approval for transfers-only in some regions.

---

### 5.3 Mission Control (Chat Hub)

**Where:** Web `d/venue/mission-control`, `d/personnel/mission-control`

**Concept:** Central hub for venue ↔ personnel chat during shifts. Real-time messaging, thread list, AI assistant availability.

---

### 5.4 AI Legal Report

**Flow:**
1. User provides incident/context
2. API: `/api/ai/generate-legal-report`
3. Returns structured legal report (liability, recommendations, etc.)

**Design:** Form → loading → report view (sections, copy button).

---

### 5.5 AI Dispatcher (No-Show / Replacement)

**Backend:**
- Cron `/api/cron/check-attendance` every 5 min
- Logic: `checkGuardStatus` → `findReplacement` → `assignReplacement`
- Uses `is_standby` (personnel), `is_urgent`, `surge_rate` (shifts)

**User-facing:** Standby toggle in Availability Manager; replacement assignments appear like normal shift offers.

---

### 5.6 Venue Booking Creation

**Where:** Web `d/venue/bookings/new`

**Flow:**
1. Venue fills: date, time, venue, role, rate, headcount
2. Submits → `notify-guards` API (proximity matching) instead of bulk notify
3. Shift offers created for matched guards

---

### 5.7 Accept Shift (From Offer / Deep Link)

**Where:** Mobile `accept-shift/[id]`

**Sources:**
- In-app popup accept (navigates here to confirm)
- Push deep link: `new_shift_offer` → `accept-shift/[id]`
- Supports `source=shift_offers` for offer-based flow

---

### 5.8 Explore Tab

**Sections:**
- Agency cards → `agency/[id]`
- Personnel cards → `personnel/[id]`
- Venue cards → `venue/[id]`

**Design:** Card grid/list, images, labels, tap-through.

---

### 5.9 Messages Tab

**Layout:**
- Thread list (chats)
- Input bar raised above tab bar (`paddingBottom: insets.bottom + 70`)
- Keyboard offset: 90 (to avoid overlap)

---

### 5.10 Standby Mode Toggle

**Where:** Web `AvailabilityManager` (personnel)

**UI:** Toggle for `is_standby` — when on, guard is eligible for AI dispatcher replacement offers.

---

## 6. Web App — Screen Map

### 6.1 Venue Dashboard (`/d/venue`)

| Route | Purpose |
|-------|---------|
| `/d/venue` | Overview |
| `/d/venue/bookings` | List bookings |
| `/d/venue/bookings/new` | Create booking (triggers notify-guards) |
| `/d/venue/bookings/[id]` | Booking detail |
| `/d/venue/bookings/[id]/pay` | Pay for booking |
| `/d/venue/live` | Live shift view |
| `/d/venue/mission-control` | Chat hub |
| `/d/venue/incidents` | Incidents |
| `/d/venue/ratings` | Guard ratings |
| `/d/venue/preferred-staff` | Preferred staff list |
| `/d/venue/templates` | Booking templates |
| `/d/venue/spend` | Spend analytics |
| `/d/venue/ai` | AI tools |
| `/d/venue/silent-support` | Support |
| `/d/venue/settings` | Settings |
| `/d/venue/calls` | Calls |
| `/d/venue/messages` | Messages |

### 6.2 Personnel Dashboard (`/d/personnel`)

| Route | Purpose |
|-------|---------|
| `/d/personnel` | Overview |
| `/d/personnel/jobs` | Available jobs |
| `/d/personnel/calendar` | Calendar |
| `/d/personnel/availability` | Availability + Standby toggle |
| `/d/personnel/shift/[id]` | Shift detail |
| `/d/personnel/earnings` | Earnings |
| `/d/personnel/payments` | Payments |
| `/d/personnel/incidents` | Incidents |
| `/d/personnel/score` | Reputation score |
| `/d/personnel/training` | Training |
| `/d/personnel/documents` | Documents |
| `/d/personnel/cv` | CV |
| `/d/personnel/profile` | Profile |
| `/d/personnel/mission-control` | Chat hub |
| `/d/personnel/settings` | Settings |
| `/d/personnel/calls` | Calls |
| `/d/personnel/messages` | Messages |

### 6.3 Agency Dashboard (`/d/agency`)

| Route | Purpose |
|-------|---------|
| `/d/agency` | Overview |
| `/d/agency/bookings` | Bookings |
| `/d/agency/staff` | Staff list |
| `/d/agency/staff/add` | Add staff |
| `/d/agency/staff/[id]` | Staff detail |
| `/d/agency/scheduler` | Scheduler |
| `/d/agency/availability` | Availability |
| `/d/agency/instant-fill` | Instant fill |
| `/d/agency/invoices` | Invoices |
| `/d/agency/quotes` | Quotes |
| `/d/agency/analytics` | Analytics |
| `/d/agency/compliance` | Compliance |
| `/d/agency/tracking` | Tracking |
| `/d/agency/settings` | Settings |
| `/d/agency/calls` | Calls |
| `/d/agency/messages` | Messages |

### 6.4 Shared / Public

| Route | Purpose |
|-------|---------|
| `/` | Landing |
| `/login` | Login |
| `/signup` | Signup (role selection) |
| `/signup/venue` | Venue signup |
| `/signup/personnel` | Personnel signup |
| `/signup/agency` | Agency signup |
| `/dashboard` | Post-login redirect |
| `/checkout` | Stripe checkout |
| `/checkout/success` | Success page |
| `/how-it-works` | Marketing |
| `/why-shield` | Marketing |
| `/partners` | Partners |
| `/pitch/venue` | Venue pitch |
| `/pitch/personnel` | Personnel pitch |
| `/pitch/agency` | Agency pitch |
| `/support/[code]` | Support |
| `/verification` | Verification |
| `/admin` | Admin dashboard |
| `/admin/verifications` | Verifications |
| `/admin/errors` | Errors |
| `/chat` | Chat (legacy) |
| `/chat/start` | Start chat |
| `/chat/[id]` | Chat thread |

---

## 7. Component Inventory (Design Reference)

### Mobile

| Component | Description |
|-----------|-------------|
| `PremiumTabBar` | 5-tab floating tab bar with blur |
| `ShiftOfferPopup` | Full-screen Uber-style offer modal |
| `ShiftOfferContext` | Realtime + state for offers |
| Chat input | Raised input with `keyboardVerticalOffset` |
| Card (glass) | `surface` bg, `radius.sm/md`, `glassBorder` |
| Primary button | Teal bg, `primaryBtn` / `primaryBtnPressed` |
| Form inputs | Dark `surface`, white text, error state red |

### Web

| Component | Description |
|-----------|-------------|
| Dashboard layout | Sidebar + main content |
| Card (glass) | `backdrop-blur-glass`, shadow |
| Glow CTA | Teal glow shadow |
| Form sections | Label + input groups |

---

## 8. Data Entities (for Labels & Copy)

- **Venue** — Name, address, type
- **Personnel** — Name, roles, availability, `is_standby`, score
- **Shift** — Date, time, venue, role, rate, `is_urgent`, `surge_rate`
- **Booking** — Venue, shifts, status, payment
- **Shift Offer** — Shift, guard, status (pending/accepted/declined), expires_at
- **Message** — Thread, sender, content
- **Incident** — Booking, reporter, description

---

## 9. Error & Edge States

- **Stripe Connect:** "Platform needs approval for transfers without card_payments" — link to support
- **Invalid account number:** Red highlight on field
- **Offer expired:** Countdown reaches 0 → offer dismissed
- **Race condition:** Another guard accepted first → "Shift taken" message

---

## 10. Animations (Mobile)

- **Shift offer:** Card slide-in (spring), pulse on accept button
- **Swipe accept:** Pan gesture, threshold ~40% screen width
- **Success:** Checkmark scale + fade
- **Tab bar:** Scale 1.1 + translateY −4 on focus
- **Orbs:** Float 6–8s ease-in-out

---

## 11. Figma Setup Suggestions

1. **Design tokens:** Create styles for colors, typography, spacing, radius.
2. **Components:** Primary button, glass card, input, tab bar, shift offer modal.
3. **Variants:** Light/dark (Shield is dark-first).
4. **Flows:** Document as separate flow files (e.g. "Shift offer flow", "Payments setup", "Booking creation").
5. **Breakpoints:** Web responsive; mobile 375×812 as base.

---

*Generated for Shield design handoff. Update as features evolve.*
