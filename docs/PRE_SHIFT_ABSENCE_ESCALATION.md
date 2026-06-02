# Pre-shift absence escalation — detection spec

**Status:** Draft for alignment
**Audience:** Product, Engineering, Ops
**Sister doc:** [`SHIFT_COVER_ESCALATION_PLAN.md`](./SHIFT_COVER_ESCALATION_PLAN.md) — covers the *response* (cover sourcing). This doc covers the *detection* (when to declare a confirmed guard at risk of not showing).

---

## 1. The problem

A guard accepts a shift, taps **"I'm coming"** at T−2h, and then goes silent. The platform currently has no server-side record that the confirm happened (it's a chat message + AsyncStorage), no evaluation of pre-shift GPS, and no escalation until T+10m after start. By then the venue has already been exposed.

**This spec defines how we turn that silence into a live, ringed status that the venue can trust.**

---

## 2. Design principles

| # | Principle |
|---|-----------|
| D1 | **Time × distance, never distance alone.** A guard 40 km away at T−60m is fine. The same guard at T−15m is not. Every ring combines both axes. |
| D2 | **Visibility before action.** The venue always sees a status card from T−30m to T+10m. "Silence" is never an option. |
| D3 | **Protect standby goodwill.** Standby guards are a finite, trust-driven resource. We do not ping them on false alarms. Cover sourcing starts as late as safely possible. |
| D4 | **The commit is the accountability anchor.** The 2h confirm must be written to the DB so we can distinguish *"ghosted after confirming"* from *"never replied"* — they carry different Shield penalties. |
| D5 | **Escape hatch first-class.** If the guard recovers during escalation, we stand down standby guards with a thank-you + Shield credit. The escalation is reversible until it isn't. |
| D6 | **Per-shift-type ladders.** A single-guard door shift escalates one ring earlier than a multi-guard event. We already have the shift metadata to branch on. |

---

## 3. The ring model

Concentric rings of time and distance. Each ring has **one trigger**, **one audience**, **one message**.

| Ring | When | Distance / signal trigger | Audience | Action | Reversible? |
|------|------|---------------------------|----------|--------|-------------|
| **R1 — Commit** | T−2h | Guard taps "I'm coming" | Guard, DB | Write `shifts.attendance_confirmed_at`, capture GPS at tap. MC chat message (as today). | Yes (guard can re-tap "Can't make it") |
| **R2 — Heartbeat** | T−60m → T−30m | Any GPS fix in `shift_gps_log` | — | Silent green state in Live Check-In. | n/a |
| **R3 — Travel warning** | T−30m | No GPS fix in last 15 min **OR** >15 km from site | Guard (soft push), Venue (yellow banner) | "Status unclear" banner in MC. Guard push: "Shift in 30 min — tap to confirm you're en route." **No third-party guards contacted.** | Yes — single GPS fix clears it |
| **R4 — Amber** | T−15m | No GPS in last 10 min **OR** >5 km away | Guard (direct push + in-app call), Venue (MC card), Dispatcher (flag) | Flip `dispatcher_status = 'at_risk'`. Venue sees "We're watching this — standby pool is ready." **Standby pre-warmed (flagged), not offered.** | Yes — check-in or fresh GPS inside 5km clears |
| **R5 — Red** | T−5m | Not within 1 km **OR** no GPS in last 5 min | Standby guards (wave 1), Guard (last-call push), Venue (MC card) | Auto-send cover offers to standby pool wave 1. Venue sees "Sourcing cover — you'll be notified when confirmed." Original guard: "Are you okay? Reply now or we'll release." | Yes until replacement accepts |
| **R6 — No-show** | T+10m | Still `accepted`, not `checked_in` | All parties | Auto `status = 'no_show'`, `no_show_at = now()`, Shield −25 (or −35 if R1 was tapped). Auto-release for wave 2 cover. | No |

### 3.1 Distance source of truth

- **Site coordinates** come from `bookings.site_latitude / site_longitude` (booking-specific pin), falling back to `venues.latitude / venues.longitude`. `LiveCheckIn.tsx` currently uses only `venues.*` — this is a known drift we should fix as part of the build.
- **Guard coordinates** come from `shift_gps_log` (most recent row for the `shift_id + personnel_id`).
- **Distance function** lives in `src/lib/geo/distance.ts` (Haversine; already exists).

### 3.2 Time source of truth

All rings are relative to `shifts.scheduled_start`, **not** the booking start. Dispatchers can re-time shifts and we should honour the latest scheduled value.

---

## 4. Per-shift-type ladder adjustments

The ring table above is the **default** (single-guard non-urgent). Variants:

| Shift type | Rule | Ring shift |
|------------|------|-----------|
| **Single-guard door / static** (1 personnel assigned) | Higher exposure — start sourcing earlier | R5 fires at **T−15m** instead of T−5m |
| **Multi-guard event** (≥3 personnel assigned) | One late guard ≠ venue catastrophe | R5 fires at **T+5m** instead of T−5m; R4 only surfaces to dispatcher, not venue |
| **Urgent flag** (`shifts.is_urgent = true`) | Already marked high-risk | All rings shifted 15 min earlier |
| **Overnight / lone worker** (`scheduled_start` between 22:00–05:00) | Welfare-sensitive | R3 adds a mandatory welfare-check message (copy varies) before escalation continues |

We read `dispatcher_status`, `is_urgent`, shift type, and a count of accepted personnel for the booking. No new columns needed for branching.

---

## 5. The second confirm ("double commit")

Optional but strongly recommended. At **T−30m** (simultaneous with R3), prompt the guard with a second mandatory tap:

> **"Still on track to arrive at [site] by [time]? Tap to confirm."**

Writes `shifts.attendance_reconfirmed_at`. If this fails to come through by T−20m, that alone trips R4 regardless of GPS.

This gives us three Shield penalty tiers for no-shows:

| Scenario | Shield penalty |
|---------|---------------|
| Never confirmed at T−2h | −15 |
| Confirmed at T−2h only | −25 (current) |
| Double-confirmed then ghosted | −35 + 30-day "requires pre-shift video verification" flag |

The third tier is the one that matters — *"he lied to us twice and didn't show"* deserves a distinct mark.

---

## 6. Venue-facing copy (per ring)

What the venue sees in Mission Control. Copy matters more than the code.

| Ring | Card title | Card body | CTA |
|------|-----------|-----------|-----|
| R2 | *(no card — green dot on the roster row)* | — | — |
| R3 | **En-route status unclear** | "[Guard first name]'s location hasn't updated recently. We've nudged them." | "Message guard" |
| R4 | **Late-risk flagged** | "We're watching this closely. Standby cover is ready to deploy if needed." | "View standby pool" |
| R5 | **Sourcing cover now** | "[Guard] hasn't arrived. We're contacting standby guards. You'll be notified when confirmed." | "View offers" |
| R6 | **Marked no-show** | "[Guard] has been marked no-show. Cover is being sourced on priority — ETA shown below." | "View cover ETA" |

Critical: R5 and R6 **never show a button to the venue that says "source cover"**. The system has already started. Giving them a button implies they need to press it.

---

## 7. Escape hatch (false-alarm recovery)

At any point before R6, if the guard:

- Fixes their GPS inside R4's distance threshold, OR
- Successfully checks in, OR
- Sends any Mission Control reply

→ We **stand down the escalation**:

1. `dispatcher_status` clears to `null`.
2. Any offered standby guards receive a **"false alarm — thanks, +2 Shield reliability"** push. Their acceptance of the cover offer is invalidated server-side.
3. Venue MC card switches to green with body: "Back on track — [Guard] just checked in."
4. Original guard gets nothing (avoid shaming).

The standby-thank-you is the critical UX detail. Without it, standbys learn to stop responding.

---

## 8. Data model deltas

All additive — no destructive changes.

### 8.1 `shifts` table

```sql
ALTER TABLE public.shifts
  ADD COLUMN attendance_confirmed_at   timestamptz,
  ADD COLUMN attendance_confirm_location jsonb,   -- { lat, lng, accuracy, ts }
  ADD COLUMN attendance_reconfirmed_at timestamptz,
  ADD COLUMN travel_risk               text CHECK (travel_risk IN ('none','far','silent','amber','red')) DEFAULT 'none',
  ADD COLUMN travel_risk_evaluated_at  timestamptz;
```

### 8.2 New audit table `shift_travel_risk_events`

Gives us the *"why did we flag them"* audit trail for venue transparency and Shield appeals.

```sql
CREATE TABLE public.shift_travel_risk_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        uuid REFERENCES public.shifts(id) ON DELETE CASCADE,
  personnel_id    uuid REFERENCES public.personnel(id) ON DELETE CASCADE,
  ring            text NOT NULL,            -- 'R3' | 'R4' | 'R5' | 'R6'
  trigger_reason  text NOT NULL,            -- 'no_gps_10m' | 'distance_5km' | 'no_reconfirm' | etc.
  distance_m      int,
  last_gps_at     timestamptz,
  created_at      timestamptz DEFAULT now()
);
```

### 8.3 No changes needed to

- `shift_gps_log` — already has what we need
- `shift_mission_reminders` — dedupe table stays as-is, we add new `REMINDER_KINDS` values
- `personnel` — standby pool is queried live, no new columns

---

## 9. Cron architecture

One new cron: **`/api/cron/check-pre-shift-eta`**, runs **every 5 minutes**.

For each `accepted` shift with `scheduled_start` between `now() - 15 minutes` and `now() + 60 minutes`:

1. Load latest `shift_gps_log` row for `(shift_id, personnel_id)`.
2. Compute `minutes_to_start`, `distance_m`, `gps_age_seconds`.
3. Evaluate ring against the per-shift-type ladder.
4. If ring changed since last evaluation → write `travel_risk`, insert `shift_travel_risk_events` row, dispatch push/MC message/standby ping per ring definition.
5. Idempotency: use `shift_mission_reminders` with kinds `ETA_R3`, `ETA_R4`, `ETA_R5` to prevent duplicate pushes.

Existing crons keep running unchanged. `check-attendance` becomes redundant for our purposes but we leave it in place as a safety net for the rare shift that bypasses the new cron (e.g. cron outage).

---

## 10. Build sequence (when we come back to this)

Ordered by "smallest unit of value shippable":

1. **Persist the commit** — migration for `attendance_confirmed_at` + `attendance_confirm_location`, update `/api/shifts/attendance-confirm` to write them, update mobile to read from DB. Unblocks all further logic.
2. **Ring evaluation engine** — pure function `src/lib/shifts/travelRisk.ts` taking `(shift, latestGps, now)` and returning `{ ring, reason }`. Fully unit-testable, no side effects.
3. **The cron** — wire the engine into `/api/cron/check-pre-shift-eta`, plumb Vercel schedule in `vercel.json` (5-min interval).
4. **Venue MC cards** — surface `travel_risk` in `LiveCheckIn.tsx` and the venue Mission Control page with the copy from §6.
5. **Second confirm (§5)** — add the T−30m reconfirm prompt on mobile, migration for `attendance_reconfirmed_at`, engine reads it.
6. **Standby pre-warm / auto-cover-kick-off** — hook R5 into `findReplacement` with a new "pre-warm" mode that prepares but doesn't send, plus an actual send on red.
7. **Auto no-show at R6** — new `src/lib/shifts/autoNoShow.ts` wrapper, called from the cron, wraps existing `markNoShow`.
8. **Escape hatch (§7)** — standby stand-down + thank-you push.
9. **Per-shift-type ladder variants (§4)** — until this lands, one default ladder for all shifts is acceptable.

Items 1–4 are the MVP. Everything after is hardening.

---

## 11. Open questions (resolve before build)

- **Default distance thresholds**: §3 uses 15 km / 5 km / 1 km. Are these right for UK urban shifts? London vs rural Norfolk will behave very differently. First instinct: make them env-configurable and seed with these numbers, observe over 2 weeks of real shifts, then move to a per-region table.
- **Welfare vs discipline tone**: The guard-facing R4/R5 pushes need to balance *"are you okay?"* (safeguarding) with *"you're about to lose this shift and take a Shield hit"* (accountability). Likely needs ops/legal review before copy is locked.
- **GPS accuracy floor**: If `accuracy_m > 500`, should we treat it as "no fix" for ring purposes? (A 2 km accuracy radius tells us nothing about whether they're at the site.) Proposed: yes, discard fixes with accuracy > 250m for distance checks but keep them as "heartbeat" evidence.
- **Standby pool size**: R5 pings "wave 1". Cover plan says wave 1 = ranked guards within 5 mi. For pre-shift we may want a separate, tighter pool (e.g. guards who have themselves opened the app in the last 30 min). Revisit during build step 6.
- **Tracking consent**: Any flagging that depends on `shift_gps_log` assumes the guard has granted location permission. If they haven't, R3/R4 should trip on *time alone* (no reconfirm, no check-in) rather than distance. This is already partly handled — worth an explicit branch in the engine.

---

## 12. Success metrics (post-launch)

| Metric | Target | Why |
|--------|--------|-----|
| Median time from "guard silent" → venue notified | < 2 min | Venue-trust metric. Today = infinite. |
| False-positive rate (R4+ rings that self-resolved before R6) | < 25% | Tests whether our thresholds are too aggressive — protects standby goodwill. |
| Guard no-show rate on shifts where R1 was tapped | < 1% | Tests whether the commit + reconfirm meaningfully bind behaviour. |
| Cover-fill rate when R5 fires before T−0 | > 60% | Tests whether early sourcing beats post-start sourcing. |
| Standby guards who accept a pre-warm → actually deployed | ≥ 40% | Guards standby reliability; anything lower means we're burning goodwill. |

---

*End of spec. Complements `SHIFT_COVER_ESCALATION_PLAN.md` §3 waves E–H.*
