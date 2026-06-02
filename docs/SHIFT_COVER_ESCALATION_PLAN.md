# Shift cover & last-minute reliability — internal plan

**Status:** P0–P3 shipped (May 2026); P4–P5 still on the roadmap  
**Audience:** Product, Engineering, Ops, Legal, GTM  
**Purpose:** Single source of truth from strategy → phases → ownership → acceptance criteria.

> **Update — 2026-05-09:** The full pre-shift detection ring engine (R3/R4/R5/R6),
> auto-cover wave engine (5 mi → 15 mi → 25 mi), wave-broadening cron, venue
> Mission Control banners, and per-venue rural / critical-tier toggles are all
> shipped. See §8 for the full implementation map. The remaining work is in
> §4 P4 (agency partner webhook) and §4 P5 (attendance hardening / dispute exports).

---

## 1. North star

When an assigned guard cannot work or fails to show, **Shield runs a deterministic escalation** until either:

- **Cover is secured** and the roster reflects one clear assignee, or  
- The venue receives a **timely, explicit outcome** (“unfilled by HH:MM”) with **audit trail**—not silence.

We optimise **managed outcomes** and **time-to-action**, not a literal guarantee that a human is always available in 5 minutes in every postcode.

---

## 2. Design principles

| # | Principle |
|---|-----------|
| P1 | **Guarantee the process**, not the person—SLA on attempts, timeboxes, notifications, evidence. |
| P2 | **One source of truth** per shift: assignee, cover status, wave of outreach. |
| P3 | **Escalate in waves**: product automation → wider pool → partners / venue / optional human ops. |
| P4 | **Align incentives**: surge pay, fees, credits—**Legal review** before public rules. |
| P5 | **Attendance evidence**: server-validated check-in; don’t over-claim “proof” in copy. |
| P6 | **Geofence & proximity**: use **site-centric zones** + **progressive radius** for discovery; optional **live proximity** only for **opted-in** guards—see §3.1. |

---

## 3. End-to-end lifecycle (A→Z)

| Stage | What happens |
|-------|----------------|
| **A** | Booking created; site pin & pay locked. |
| **B** | Guard accepts shift; **acceptance timestamp** stored. |
| **C** | Reminders: configurable (e.g. T-24h, T-2h, T-30m) + optional “still good?” ping. |
| **D** | Guard taps **“Can’t attend”** → shift → **NEEDS_COVER**; policy engine applies strikes/fees if applicable. |
| **E** | **Wave 1**: urgent offers to ranked guards (short TTL, optional rate bump). |
| **F** | **Wave 2**: widen radius / safe relaxations; notify venue “searching.” |
| **G** | **Wave 3**: agency partner hook / Mission Control / venue escalation path. |
| **H** | **No-show path**: if no check-in by T+X → same orchestration without guard tap. |
| **I** | Replacement accepted → **atomic handoff**; roster + notifications updated. |
| **J** | Check-in validated server-side (radius, accuracy, window); **audit record**. |
| **Z** | Post-shift: ratings, reliability scores; funnel metrics for fill time. |

### 3.1 Geofence, radius & proximity-based discovery (cover & urgent notify)

This complements **waves E–F** when standard ranked offers don’t fill a shift (e.g. after cancel or no-show).

**Layers (use together; configure per wave):**

| Layer | What it is | Role in product |
|--------|------------|-----------------|
| **A. Site pin + radius** | Circle around **booking `site_latitude` / `site_longitude`** (or venue polygon later). | Primary: same as today’s **notify-guards** distance filter—cheap, predictable, no extra consent. |
| **B. Venue geofence (optional)** | Polygon or stored boundary in `geofences` (when populated). | Tighter “on campus” semantics for large sites; **fallback to radius** if no polygon. |
| **C. Progressive broadening** | Automated steps: e.g. **5 mi → 15 mi → 25 mi** (or km equivalents), each step only if previous wave **expires unfilled**. | Ensures you don’t spam the whole country on wave 1; **log each wave** for metrics. |
| **D. Live proximity pool (urgent only)** | Guards whose **last known location** (from app, when tracking/on-duty or foreground) falls **inside current search radius** of the **shift site** get **priority or extra weight** in the offer queue. | Targets people **already nearby** when the clock is short—strong lever for last-minute cover. |

**When NEEDS_COVER fires:**

1. Run **standard urgent offers** (skills, availability, shield score—existing logic).  
2. If under-filled, **re-run notify** with **next radius tier** + mark wave in audit (`cover_wave: 2`, etc.).  
3. Optionally **boost** guards in **layer D** (sort key or separate “proximity pass”)—**only** if they have **location sharing / availability** consent and recent **fresh** coords (e.g. under 15–30 minutes stale—configurable).  
4. If still unfilled → **Wave 3** (agency / human) as in §3.

**Privacy & trust (non-negotiable):**

- **No background stalking:** proximity uses **consented** location flows (e.g. on-shift tracking opt-in, or last foreground fix with clear policy).  
- **Purpose limitation:** data used for **matching offers**, not sold; **retention** capped for location pings.  
- **Transparency:** guard sees **why** they got an urgent ping (“You appear within X km of this site”).  
- **Legal** signs off on copy and retention.

**Relation to check-in:** Geofence/radius for **discovery** is separate from **check-in validation** (§3 stage J)—same site pin can anchor both.

---

## 4. Phased roadmap — ticket buckets & acceptance criteria

### P0 — Truth, visibility, no silent failures

**Goal:** Venue and ops always see shift truth; nothing fails quietly.

| ID | Ticket bucket | Acceptance criteria |
|----|----------------|---------------------|
| P0.1 | **Shift / cover states** documented in DB & product | States include at minimum: assigned, needs_cover, cover_pending, fulfilled, unfilled (names can match existing enums after audit). |
| P0.2 | **Venue notification** on NEEDS_COVER | Venue sees in-app (and optional email) within 1 min of state change in test env. |
| P0.3 | **Mission Control / ops view** | Single place lists shifts in NEEDS_COVER + timestamp + last action. |
| P0.4 | **Audit log row** per transition | Who/what triggered; immutable timestamp. |

**RACI (P0)**

| Activity | Accountable | Responsible | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| State model & migrations | Eng lead | Backend | Product | Ops |
| Venue notifications | Product | Eng + Design | — | GTM |
| Mission Control scope | Product | Eng | Ops | Venue success |

---

### P1 — Guard-initiated “can’t attend”

**Goal:** Controlled exits; automatic NEEDS_COVER.

| ID | Ticket bucket | Acceptance criteria |
|----|----------------|---------------------|
| P1.1 | **Mobile + web flow** “Withdraw / can’t attend” | Reason captured (internal); time-before-shift shown; confirmation modal. |
| P1.2 | **Policy placeholders** | Config for “late cancel” window; **Legal** signs off before enforcement text goes live. |
| P1.3 | **Shift → NEEDS_COVER** on submit | Idempotent; can’t double-trigger same shift. |

**RACI (P1)**

| Activity | Accountable | Responsible | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| UX copy & flows | Product | Design + Eng | Legal | — |
| Policy rules | Legal / Ops | Product | Eng | GTM |

---

### P2 — Urgent cover engine (automation)

**Goal:** First automated replacement attempts in minutes.

| ID | Ticket bucket | Acceptance criteria |
|----|----------------|---------------------|
| P2.1 | **Offer type: urgent** | Distinct from standard: TTL, max recipients, optional `rate_multiplier` field. |
| P2.2 | **notify-guards (or successor) urgent mode** | Wider radius / shorter expiry; metrics logged; no duplicate offers to same guard in same wave. |
| P2.3 | **Repost / board** | Open slot visible with urgency badge + optional bumped rate. |
| P2.4 | **Venue “searching”** | In-app banner when Wave 1 active; updates when Wave 2 starts. |
| P2.5 | **Radius / geofence tiers for urgent cover** | Config table or env: e.g. `URGENT_RADIUS_MILES_WAVE1/2/3`; orchestrator steps waves on expiry; uses **site** coords from booking. |
| P2.6 | **Wave audit** | Each offer batch logs `cover_wave`, `radius_miles`, `candidate_count`, timestamp. |
| P2.7 | **Proximity-weighted queue (optional)** | If guard has fresh lat/lng within tier radius → higher rank or parallel “proximity pass”; **gated on consent + staleness rules**. |
| P2.8 | **Geofence table integration (when rows exist)** | If `geofences` active for venue, optional filter “inside polygon OR within radius”; **never block** if polygon missing. |

**RACI (P2)**

| Activity | Accountable | Responsible | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| Offer & notify logic | Eng lead | Backend | Product | Ops |
| Venue UX | Product | Design + Eng | — | GTM |
| Pricing / surge | Product | Ops + Legal | Finance | — |

---

### P3 — No-show automation

**Goal:** Same engine when guard never cancels but doesn’t check in.

| ID | Ticket bucket | Acceptance criteria |
|----|----------------|---------------------|
| P3.1 | **Expected check-in window** per shift | Configurable offset from scheduled start. |
| P3.2 | **Trigger NEEDS_COVER** at T+X if no check-in | Idempotent; respects already-filled state. |
| P3.3 | **Guard notification** before declaring no-show | Optional grace ping (“Check in now”). |

**RACI (P3)**

| Activity | Accountable | Responsible | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| Cron / jobs | Eng lead | Backend | Product | Ops |
| Guard comms | Product | Eng | Legal | — |

---

### P4 — Partners & human escalation

**Goal:** Near–100% *managed* outcomes in mature markets.

| ID | Ticket bucket | Acceptance criteria |
|----|----------------|---------------------|
| P4.1 | **Agency webhook or dashboard** | Partner receives NEEDS_COVER payload with SLA fields. |
| P4.2 | **Optional human queue** | Internal triage for enterprise tier; documented SLA. |
| P4.3 | **Runbook** | Ops doc: who to call, when to refund/credit (with Finance). |

**RACI (P4)**

| Activity | Accountable | Responsible | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| Partner integrations | BD / Ops | Eng | Product | Legal |
| Enterprise SLA | Ops | Product | GTM | Finance |

---

### P5 — Attendance hardening

**Goal:** Defensible check-in for disputes.

| ID | Ticket bucket | Acceptance criteria |
|----|----------------|---------------------|
| P5.1 | **Accuracy threshold** on check-in API | Reject or soft-fail poor GPS fixes; message to user. |
| P5.2 | **Audit export** | Venue/admin can export check-in evidence for a shift. |
| P5.3 | **Copy** | Public-facing text says “location-verified” not “proof of physical presence.” |

**RACI (P5)**

| Activity | Accountable | Responsible | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| API rules | Eng lead | Backend | Legal | Product |
| Copy | Product | Legal | — | GTM |

---

## 5. Metrics (review monthly)

| Metric | Definition |
|--------|------------|
| Time-to-first-offer | NEEDS_COVER → first urgent offer sent |
| Time-to-fill | NEEDS_COVER → accepted assignment |
| Unfilled rate | NEEDS_COVER → unfilled after all waves |
| Late cancel rate | By guard vs venue |
| No-show rate | After reminder window |
| Check-in pass rate | vs GPS accuracy distribution |
| Cover wave fill rate | % filled at wave 1 vs 2 vs 3 |
| Proximity offer uplift | Acceptance rate when proximity boost applied vs control (A/B) |
| Median guard distance at offer | Per wave—sanity-check broadening |

---

## 6. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Thin market liquidity | City-by-city rollout; don’t promise national fill rates |
| Employment / deductions | Legal review on fees and strikes |
| Over-promising in marketing | Message: process reliability + speed to escalate |

---

## 7. How to use this doc

1. **Product** turns each P*.x row into epics in your tracker.  
2. **Eng** maps P0–P2 to schema and services (align with existing `shifts`, `shift_offers`, `notify-guards`, optional `geofences`, personnel `latitude`/`longitude`).  
3. **Legal** gates P1/P2/P4 commercial rules.  
4. **Ops** owns P4 runbooks and partner onboarding.

Update this file when phase boundaries or state names change.

---

## 8. Implemented in codebase (living)

### 8.1 Detection — pre-shift travel risk (rings R3–R6)

| Item | Location |
|------|----------|
| Pure ring evaluator with thresholds for time, distance, GPS staleness | `src/lib/shifts/travelRisk.ts` |
| Per-shift-type ladder: `singleGuardDoor`, `multiGuardEvent`, `urgent`, `criticalVenue`, `rural` | `adjustThresholdsForShiftType()` |
| Env-driven defaults (`TRAVEL_RISK_*_DISTANCE_M`, `TRAVEL_RISK_*_MINUTES_BEFORE`, `TRAVEL_RISK_RURAL_MULTIPLIER`) | `resolveThresholdsFromEnv()` / `ruralMultiplierFromEnv()` |
| Cron: every 5 min, evaluates accepted shifts in ±60 min window, posts MC card + push, fires cover engine on R5/R6 | `src/app/api/cron/check-pre-shift-eta/route.ts` |
| Audit table: every ring flip with reason, distance, GPS age | `shift_travel_risk_events` (migration `0054`) |
| 28 unit tests covering distance / timing / GPS staleness / per-tier ladder | `src/lib/shifts/travelRisk.test.ts` |

**Default thresholds (May 2026):**
- R3 (yellow): T-30m + (>5 km OR no GPS in 15 min)
- R4 (amber): T-15m + (>2 km OR no GPS in 10 min)
- R5 (red, sourcing cover): T-5m + (>500 m OR no GPS in 5 min)
- R6 (no-show): T+10m
- Per-tier shifts: single-guard moves R5 to T-15m; multi-guard moves R5 to T+5m and R6 to T+15m; critical venue moves R5 to T-20m / R6 to T+5m; rural multiplies all distances 2.5×.

### 8.2 Response — auto-cover engine

| Item | Location |
|------|----------|
| Single orchestration helper: `kickoffCoverWave1`, `broadenCoverWave`, `markShiftNoShow`, `markCoverUnfilled` | `src/lib/shifts/coverEngine.ts` |
| Wave config (env-tunable: `COVER_WAVE_1/2/3_RADIUS_MILES`, `COVER_WAVE_*_DELAY_MINUTES`) | `resolveCoverWavesFromEnv()` |
| **Wave 1**: 5 mi, fires on R5 / guard withdrawal / venue release | `kickoffCoverWave1()` |
| **Wave 2**: 15 mi, auto-fires +5 min after Wave 1 expires unfilled | `broadenCoverWave()` + cron |
| **Wave 3**: 25 mi + agency partner alert flag, +10 min after Wave 2 | `broadenCoverWave({ finalWave: true })` |
| **Wave-broadening cron**: every minute, bumps stuck waves, marks `cover_unfilled_at` after final wave | `src/app/api/cron/cover-wave-broadening/route.ts` |
| **Wave dedupe**: each broader wave excludes personnel who already received offers in prior waves | `coverEngine` reads `shift_offers` for prior `personnel_id`s |
| Audit table: every wave with `radius_miles`, `trigger`, `guards_notified`, `offers_created` | `shift_cover_waves` (migration `0056`) |
| Atomic race protection: `assignReplacement` requires `dispatcher_status IN ('searching','at_risk')` | `src/lib/dispatcher.ts` |
| Original-guard recovery: check-in clears `cover_search_*`, sets `dispatcher_status='none'` so in-flight cover takers fail the atomic guard | `src/app/api/shifts/checkin/route.ts` |
| Replacement-found cleanup: `assignReplacement` zeros `cover_search_wave` so venue banner clears immediately | `src/lib/dispatcher.ts` |

### 8.3 Visibility & UX

| Item | Location |
|------|----------|
| Venue Mission Control banner: travel-risk ring (R3-R6) + cover-search wave/radius/elapsed | `src/components/venue/LiveCheckIn.tsx` (`travelRiskBannerCopy`, `coverSearchBannerCopy`) |
| Venue **Cover Activity timeline** (history of waves, triggers, fill outcome) | `src/components/venue/CoverActivityTimeline.tsx` |
| Per-venue toggles: **Rural / hard-to-reach** + **Critical venue tier** | `/d/venue/settings` |
| Push to venue on every NEEDS_COVER state change + wave broadening | `coverEngine.pushVenueNeedsCover` |
| Mobile guard "you're being covered, recover now" screen with one-tap check-in | `mobile/app/shift/[id].tsx` |
| Mobile guard urgent-cover offer accept (with proximity validation) | `src/app/api/dispatcher/accept-shift/route.ts` |

### 8.4 Database state

| Migration | Adds |
|-----------|------|
| `0049_shift_guard_withdrawal_cover.sql` | `withdrawal_reason`, `withdrawal_at`, `cover_search_wave`, `original_personnel_id` |
| `0054_pre_shift_absence_tracking.sql` | `attendance_confirmed_at`, `travel_risk`, `shift_travel_risk_events` |
| `0056_cover_engine_columns.sql` | `venues.is_rural`, `venues.is_critical`, `shifts.cover_search_started_at`, `cover_search_last_wave_at`, `cover_unfilled_at`, `shift_cover_waves` audit table |

### 8.5 Vercel cron schedule

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/check-pre-shift-eta` | `*/5 * * * *` | Evaluates rings, posts MC, fires cover on R5/R6 |
| `/api/cron/cover-wave-broadening` | `* * * * *` | Bumps waves 1→2→3, marks unfilled |
| `/api/cron/auto-checkout-shifts` | `* * * * *` | Caps over-running shifts at scheduled_end |
| `/api/cron/auto-confirm-shifts` | `0 * * * *` | T-2h "I'm coming" reminder cycle |
| `/api/cron/mission-control-shift-reminders` | `*/5 * * * *` | Standard pre-shift reminders |

### 8.6 What's still on the roadmap

- **P4.1 Agency partner webhook** — external partners receive NEEDS_COVER payload
- **P4.2 Optional human queue** — internal triage UI for enterprise-tier venues
- **P4.3 Runbook** — Ops doc for refunds/credits when fill fails
- **P5.1 Check-in accuracy threshold** — reject low-quality GPS fixes
- **P5.2 Audit export** — venue/admin can export check-in evidence per shift
- **P5.3 Copy review** — Legal sign-off on "location-verified" wording
