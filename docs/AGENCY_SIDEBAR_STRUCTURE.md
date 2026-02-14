# Agency Sidebar — Grouped Navigation Structure

## New Sidebar Layout

The agency sidebar now uses **collapsible dropdown groups** to organize related features:

```
📊 Overview
📅 Shift Scheduler
👥 Staff
⏰ Availability
📆 Bookings

💬 Communications ▼
   ├─ 🎯 Mission Control
   ├─ ✉️ Direct Messages
   └─ 📞 Calls

⚙️ Operations ▼
   ├─ 📹 Live Tracking
   ├─ 📍 GPS History
   ├─ ⚠️ Incidents
   └─ ⚡ Instant Fill

💰 Financial ▼
   ├─ 📊 Revenue Analytics
   ├─ 📝 Quotes
   └─ 🧾 Invoices

📈 Insights ▼
   ├─ 📊 Analytics
   ├─ ⭐ Staff Ratings
   └─ ❤️ Preferred Venues

🛡️ Compliance
🤖 AI Assistant
⚙️ Settings
```

---

## Group Definitions

### 1. **Communications** 💬
All messaging and communication tools:
- **Mission Control** — Group chats for active shifts
- **Direct Messages** — 1-on-1 messaging
- **Calls** — Voice/video calling

**Why grouped:** Agencies need quick access to all communication channels in one place.

---

### 2. **Operations** ⚙️
Real-time operational tools:
- **Live Tracking** — Real-time staff locations
- **GPS History** — Historical tracking data
- **Incidents** — Incident reports
- **Instant Fill** — Emergency staff placement

**Why grouped:** These are all time-sensitive operational tools used during active shifts.

---

### 3. **Financial** 💰
Revenue and billing:
- **Revenue Analytics** — Charts, trends, growth
- **Quotes** — Create quotes for venues
- **Invoices** — Generate and track invoices

**Why grouped:** Financial management in one section for easier accounting workflows.

---

### 4. **Insights** 📈
Performance and relationship data:
- **Analytics** — Overall performance metrics
- **Staff Ratings** — Venue feedback on staff
- **Preferred Venues** — Top venue clients

**Why grouped:** These are all analysis/reporting tools for strategic decisions.

---

## Interaction Design

### Dropdown Behavior:
- **Click group header** → Expand/collapse
- **Chevron icon** rotates 180° when open
- **Active indicator** — Group header highlights if any sub-item is active
- **Default state** — All groups open on first load
- **Smooth animation** — Height/opacity transition (200ms)

### Visual Hierarchy:
- **Top-level items** — Full icon (20px) + label
- **Group headers** — Full icon (20px) + label + chevron
- **Sub-items** — Smaller icon (16px) + label, indented (pl-11)

### Active States:
- **Top-level** — Shield teal background (20% opacity)
- **Sub-items** — Shield teal background (10% opacity)
- **Icons** — Teal color when active

---

## Mobile Adaptation

Mobile bottom nav shows **top 5 items only** (no groups):
- Overview
- Shift Scheduler
- Staff
- Availability
- Bookings

Groups are accessible by tapping the hamburger menu (future enhancement).

---

## Benefits

1. **Cleaner UI** — 18 items → 9 top-level + 4 groups
2. **Faster navigation** — Related features grouped logically
3. **Scalability** — Easy to add new features to existing groups
4. **Professional** — Matches enterprise SaaS patterns (Slack, Notion, Linear)

---

## Future Enhancements

- **Group badges** — Show unread count on Communications group
- **Keyboard shortcuts** — Cmd+K to search, numbers to jump to groups
- **Favorites** — Pin frequently used items to the top
- **Collapsed mode** — Icons-only sidebar with tooltips

---

**Status:** ✅ Implemented and ready to test at `/d/agency`
