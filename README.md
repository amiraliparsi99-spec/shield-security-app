# Shield — Venue × Security Marketplace

First-of-its-kind marketplace connecting **venues** (who need security) with **security personnel and agencies** (who are available or looking for work).

## What’s in the repo

- **Next.js 15** (App Router, TypeScript, Tailwind)
- **Supabase** — Auth, Postgres, Realtime (client + server helpers wired)
- **Landing** — Hero, two-sided value prop, how it works, CTAs
- **Auth shells** — `/signup`, `/login` (Supabase Auth to be connected)
- **Data models** — `Profile`, `Venue`, `Personnel`, `Agency`, `Availability`, `Request`, `Booking`, `PersonnelReview` (TypeScript + SQL migrations)
- **Personnel profile** — `/personnel/[id]` with **reviews**, **location name**, **years in security** (and “since” year), certs, rate, status. Run `0002_personnel_reviews_and_profile.sql` after `0001`.
- **Strategy** — `STRATEGY.md` for vision, differentiation, and phased build

## Run on mobile

- **PWA:** Deploy the web app (HTTPS), then on your phone open it in Chrome/Safari and use **“Add to Home Screen”**. See [MOBILE.md](./MOBILE.md).
- **Native app (Expo):** `cd mobile && npm install && npx expo start`. Use Expo Go on a device or a simulator. See [MOBILE.md](./MOBILE.md).

## Quick start

### 1. Install

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/0001_initial.sql`, then `0002_personnel_reviews_and_profile.sql` in the SQL Editor.
3. Copy `.env.local.example` to `.env.local` and set:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
  app/           # Routes: /, /signup, /login, /how-it-works, /personnel/[id]
  components/    # personnel/PersonnelProfile, etc.
  lib/           # supabase/, format.ts
  types/         # database.ts (Profile, Venue, Personnel, PersonnelReview, etc.)
supabase/
  migrations/    # 0001_initial.sql, 0002_personnel_reviews_and_profile.sql
```

## Next steps (from STRATEGY.md)

1. **Wire Supabase Auth** — sign up, login, session, and create/update `profiles` (with `role`) on first login.
2. **Dashboards** — `/dashboard/venue`, `/dashboard/personnel`, `/dashboard/agency` (role-based redirect after login).
3. **CRUD** — Venue create/edit, Personnel/Agency profiles, Availability.
4. **Requests** — Venues create requests; personnel/agencies see and apply.
5. **Bookings** — Offer → accept → Booking; calendar views.
6. **Payments** — Stripe when ready.

## Name

**Shield** is the working name. The app structure supports any brand.
