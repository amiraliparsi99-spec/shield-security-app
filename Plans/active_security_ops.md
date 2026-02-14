# Security-First Party Features: "Active Operations" Mode

To make Shield the best app for parties *from a security perspective*, we need to move beyond "booking staff" and "reporting incidents after the fact." We need tools for **during the shift**.

## 1. 🚨 "Guard Assist" (The Digital Panic Button)
**The Problem:** Radios are loud, channels get blocked, and sometimes you can't speak freely if de-escalating a situation.
**The Solution:** A one-tap "Assist" button on the guard's active shift screen.
*   **How it works:**
    *   Guard taps "Request Assist".
    *   All other guards at the same venue get a **haptic alert** and a push notification: *"Backup requested at VIP Entrance"*.
    *   Manager sees the alert on their dashboard map.
*   **Levels:**
    *   🟡 **Assist:** "Need a second pair of eyes." (Non-emergency)
    *   🔴 **Emergency:** "Officer down / Fight in progress." (All units respond)

## 2. 🚫 Live Ejection & Banned Sync
**The Problem:** A troublemaker gets kicked out of the front door, walks around the block, and pays to get in the back door because the other bouncer doesn't know them.
**The Solution:** Real-time "Bolo" (Be On Look Out) feed.
*   **How it works:**
    *   Guard snaps a quick photo of the ejected person (or ID).
    *   Tags reason: "Fighting", "Too Intoxicated".
    *   **Instantly** appears on the "Active Shift" feed of every other guard at that venue.
    *   Prevents re-entry and alerts the team to watch out.

## 3. 📍 Zone Check-In (The "Heatmap")
**The Problem:** "Where are my guards?" The manager shouldn't have to ask on radio.
**The Solution:**
*   Guards tap "Check In" on specific zones (e.g., "VIP Area", "Main Bar", "Front Door").
*   The app tracks their location.
*   If a zone is left unattended for too long (e.g., "Main Floor" has 0 guards), the Manager gets an alert.

## 4. 💊 Drug/Weapon Discovery Map
**The Problem:** Finding a baggie of powder is usually just thrown away or logged later.
**The Solution:**
*   Quick-tap log: "Found Class A - Men's Toilets".
*   If multiple finds happen in one spot, the app flags a **"Hotspot"** to the Head of Security: *"Check Men's Toilets - 3 incidents in 1 hour."*

---

## Implementation Plan

We will add a new **"Active Shift"** mode to the mobile app that activates when a guard clocks in.

### New Mobile Screens Needed:
1.  **Active Shift Dashboard:**
    *   Big "Guard Assist" button.
    *   Live Feed (Ejections, Alerts).
    *   Current Zone status.
2.  **Ejection Logger:**
    *   Camera view -> Tag Reason -> Submit (10 seconds max).

### Backend Requirements:
*   **Realtime**: Use Supabase Realtime channels to broadcast alerts instantly (sub-100ms latency).
*   **Push Notifications**: Critical for the "Guard Assist" feature.
