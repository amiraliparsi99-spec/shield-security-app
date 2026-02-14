# Shield — Venue × Security Marketplace

## Vision

**First-of-its-kind marketplace where venues and security personnel/agencies meet.**  
Venues say *"We need people"*. Security staff and agencies say *"We're available"*.  
One place, real-time, verified, built for how the industry actually works.

---

## Why This Can Be Generational

| **Others** | **Shield** |
|------------|------------|
| Job boards or generic staffing | **Dual-sided discovery**: "Available" + "Hiring" in one feed |
| Enterprise, clunky tools | **Consumer-grade UX**: fast, clear, mobile-first |
| Security as an afterthought category | **Security-native**: certs, insurance, venue-type, compliance |
| Opaque pricing, back-and-forth | **Transparent rates**, clear scope (per shift, per event, ongoing) |
| One-off postings | **Ongoing relationships**: preferred guards, recurring shifts, last-minute fill-ins |

---

## User Types

1. **Venues**  
   Clubs, stadiums, event spaces, bars, corporate, retail.  
   - Post: “We need X guards for [date/time/scope]”  
   - Or: “We’re always looking — here’s our usual needs”  
   - Filters: certs, experience, proximity, rate

2. **Security Personnel (Individuals)**  
   - Profile: certs, experience, availability, rate  
   - Status: “Available”, “Looking for work”, “Booked”  
   - Get matched to venue posts and incoming requests

3. **Agencies**  
   - Same as above, but for a roster of guards  
   - Can post team availability or respond to venue requests with multiple personnel

---

## Core Flows

### Venue: “We need people”
- Create a **Request** (date, time, # of guards, certs, rate, notes)  
- See **matches**: available personnel/agencies that fit  
- Send **offers** or **invites**  
- **Book** → shift confirmed, on calendar, ready for settlement

### Security / Agency: “We’re available”
- Set **availability** (calendar, recurring, one-off)  
- **Profile** with certs, insurance, experience, rate  
- Appear in venue **search** and **match** lists  
- Receive **requests** and **offers** → accept/decline → **Booked**

### Trust & Compliance
- **Verified** certs (where we can integrate)  
- **Insurance** on file  
- **Ratings & reviews** both ways  
- **Compliance tags** (alcohol-serving, events, corporate, etc.)

---

## Tech Direction (V1)

- **Next.js 14+ (App Router)** — one codebase, SSR, API routes, easy PWA
- **TypeScript** — end-to-end safety
- **Supabase** — Auth, Postgres, Realtime, Storage (one backend to move fast)
- **Prisma** (optional if we want an ORM over Supabase) — or **Supabase client + SQL** for clarity
- **Stripe** — payments, escrow, payouts (Connect for agencies later)
- **Vercel** — host + edge

**Mobile:** PWA first (installable, offline-capable). Native (React Native/Expo) when we need push and deeper device features.

---

## Phased Build

### Phase 1 — Foundation (Now)
- [ ] Project scaffold (Next.js, TS, Supabase, env)
- [ ] Auth (email + magic link or OAuth), **roles**: `venue` | `personnel` | `agency`
- [ ] Data models: `User`, `Venue`, `Personnel`, `Agency`, `Availability`, `Request`, `Booking`
- [ ] Landing + “How it works” + sign up CTA
- [ ] Basic dashboard shells: Venue / Personnel / Agency

### Phase 2 — Discovery & Matching
- [ ] Venue: create Request (when, where, how many, what certs, rate)
- [ ] Personnel/Agency: set availability, profile (certs, rate, experience)
- [ ] Search & filters (date, location, certs, rate)
- [ ] Match list: “Available near you” / “Requests that fit you”

### Phase 3 — Booking & Operations
- [ ] Offer/Invite flow (venue → personnel/agency)
- [ ] Accept/Decline + confirm **Booking**
- [ ] Calendar view (for both sides)
- [ ] Messaging (in-app, or “contact” that respects privacy)

### Phase 4 — Trust & Money
- [ ] Verification (certs, insurance) — manual at first, integrations later
- [ ] Ratings & reviews
- [ ] Stripe: payments, escrow, payouts

### Phase 5 — Scale & Polish
- [ ] Realtime (availability, new requests, messages)
- [ ] Notifications (email, then push via PWA)
- [ ] Mobile app (PWA → native if needed)
- [ ] AI-assisted matching (optional)

---

## Principles

1. **Venue and security are peers** — both get great tools, not “employer vs worker” feel.
2. **Availability is first-class** — always-on, calendar-driven, not just “post and pray”.
3. **Trust through verification and reviews** — certs and insurance matter; we make that visible.
4. **Clear scope and pricing** — per shift, per event, or ongoing; no surprise fees.
5. **Fast and simple** — every step should feel obvious; we cut enterprise friction.

---

## Name (working)

**Shield** — one word, security, protection, easy to say and remember.  
(Can be changed; the structure supports any brand.)

---

Next: implement **Phase 1** — project scaffold, auth, data models, landing, and dashboard shells.
