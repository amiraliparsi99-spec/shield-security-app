# Tracking, arrival, and optional AI agents

This note describes how **deterministic location logic** and **Mission Control** fit together, and where an **LLM-based agent** can sit safely on top.

---

## 1. Ground truth (non-AI)

Arrival and check-in must stay **rules + geometry + time**:

- Compare GPS to the **booking snapshot** (`site_latitude` / `site_longitude`) or venue fallback.
- Optional **dwell** (inside radius for N seconds) to reduce noise.
- **Official** check-in/checkout remains **HTTP APIs** (`/api/shifts/checkin`, etc.) that update `shifts` and post to Mission Control.

Do not use an LLM to decide whether a point is inside a geofence.

---

## 2. Domain events (facts the system emits)

These are append-only **facts** from tracking workers, geofence logic, or APIs — not model output.

| Event type | When | Payload (minimum) |
|------------|------|-------------------|
| `location.sample` | Periodic tracking tick | `shift_id`, `personnel_id`, `lat`, `lng`, `accuracy_m`, `recorded_at`, `source` (foreground / background) |
| `geofence.enter` | First fix inside booking pin radius | `shift_id`, `booking_id`, `site_label`, `distance_m`, `lat`, `lng` |
| `geofence.exit` | Left radius after being inside | same + optional `dwell_s` |
| `geofence.dwell_satisfied` | Inside for N seconds | `shift_id`, `dwell_s` |
| `check_in.confirmed` | Successful check-in API | `shift_id`, `actual_start`, `distance_m`, `geofence_skipped` |
| `check_out.confirmed` | Successful check-out API | `shift_id`, … |
| `shift.window.opened` | e.g. T−15 to start (aligns with cron reminder kinds) | `shift_id`, `kind` |
| `anomaly.flagged` | Rule engine | `code` (e.g. `impossible_jump`, `stale_gps`, `accuracy_poor`), `shift_id`, `detail` |

**Persist** in something like `tracking_events` (or equivalent logs) so the agent or ops can query **recent** rows, not raw high-frequency streams.

---

## 3. Stack alignment (Shield today)

- **Mission Control**: `group_chats` (`chat_type = mission_control`), `group_chat_messages` with `message_type = system` and structured `metadata` (see check-in route and `insertMissionControlSystemMessage` in `src/lib/mission-control/shiftReminders.ts`).
- **Notifications**: `notifications` for venue/guard user_ids.
- **Idempotency**: `shift_mission_reminders` + `reminder_kind` (see `REMINDER_KINDS` in `shiftReminders.ts`); extend with new kinds for tracking (e.g. `geofence_arrival_pending_checkin`) if needed.

---

## 4. Agent tools (callable code, not LLM math)

| Tool | Purpose |
|------|---------|
| `post_mission_control` | Insert system line into the booking MC chat (`group_chat_messages` + metadata). |
| `notify_venue_user` | In-app/push to venue owner (`notifications`). |
| `notify_guard` | Reminder to guard (`notifications`). |
| `get_shift_context` | Read-only: `shifts` + `bookings` + `site_label` + guard display name. |
| `escalate_to_agency` | Optional, if product supports it. |
| `append_tracking_event` | Audit / analytics. |

The model should **not** receive tools that set coordinates or bypass validated check-in unless those tools enforce the same rules as the API.

---

## 5. Suggested agent loop

1. **Rule worker** emits events (e.g. `geofence.enter` + `dwell_satisfied`).
2. **Policy (code)** decides whether to notify (e.g. do not spam; skip if `check_in.confirmed` already exists).
3. **Optional LLM**: given event + `get_shift_context`, produce **short copy** for Mission Control and/or venue notification.
4. **Execute** `post_mission_control` / `notify_venue_user` with **fixed templates** if the LLM is disabled or fails.

**Template example (no AI):**  
`{guardName} appears on site at {site_label} (GPS). Tap Check in to confirm.`

**With AI (same facts):**  
Natural language variant of the same facts, no invented coordinates.

---

## 6. Minimal first slice to implement

1. Persist or derive **`geofence.enter` / `dwell_satisfied`** from existing tracking (or new worker).
2. **Worker** (cron or edge): read events → dedupe → `post_mission_control` with **template** copy.
3. **Later**: replace template body with LLM output using the same tools and idempotency keys.

---

## 7. Model choice

- Use **strong models** (e.g. Opus-class) for nuanced wording, escalation explanations, and multi-step tool use on **low-volume** events.
- Use **templates or small models** for high-volume, repetitive pings.
