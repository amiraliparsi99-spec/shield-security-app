/**
 * Shield Watchdog — Cron Attendance Checker
 *
 * Called every 5 minutes (e.g. by Vercel Cron).
 * Finds all confirmed shifts that are about to start (or recently started)
 * where the guard hasn't checked in, and runs the dispatcher.
 *
 * Vercel cron config (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-attendance",
 *     "schedule": "*/5 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkGuardStatus, type CheckGuardStatusResult } from "@/lib/dispatcher";

// ——— Environment ———
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET; // Optional: protect the endpoint

// ——— Time window ———
const WINDOW_BEFORE_MINUTES = 15; // Check shifts starting in the next 15 min
const WINDOW_AFTER_MINUTES = 15; // Check shifts that started up to 15 min ago

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // --- Auth: verify the cron caller (optional but recommended) ---
    if (CRON_SECRET) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // --- Create admin Supabase client ---
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Calculate the time window ---
    const now = new Date();

    // 15 minutes from now (shifts about to start)
    const windowEnd = new Date(now.getTime() + WINDOW_BEFORE_MINUTES * 60_000);

    // 15 minutes ago (shifts that should have started already)
    const windowStart = new Date(now.getTime() - WINDOW_AFTER_MINUTES * 60_000);

    console.log(
      `[WATCHDOG] Running attendance check at ${now.toISOString()}`,
      `\n  Window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`
    );

    // --- Query at-risk shifts ---
    // Conditions:
    //  1. Status is "accepted" (confirmed but not checked_in)
    //  2. Scheduled start is within our window
    //  3. Dispatcher hasn't already marked them as "replacement_found" or "failed"
    const { data: atRiskShifts, error: queryErr } = await supabase
      .from("shifts")
      .select("id, personnel_id, scheduled_start, status, dispatcher_status")
      .eq("status", "accepted")
      .gte("scheduled_start", windowStart.toISOString())
      .lte("scheduled_start", windowEnd.toISOString())
      .or("dispatcher_status.is.null,dispatcher_status.eq.none,dispatcher_status.eq.at_risk")
      .not("personnel_id", "is", null)
      .order("scheduled_start", { ascending: true });

    if (queryErr) {
      console.error("[WATCHDOG] Query error:", queryErr.message);
      return NextResponse.json(
        { error: "Database query failed", details: queryErr.message },
        { status: 500 }
      );
    }

    if (!atRiskShifts || atRiskShifts.length === 0) {
      console.log("[WATCHDOG] No at-risk shifts found. All clear.");
      return NextResponse.json({
        success: true,
        message: "No at-risk shifts found.",
        shifts_checked: 0,
        processing_time_ms: Date.now() - startTime,
      });
    }

    console.log(`[WATCHDOG] Found ${atRiskShifts.length} at-risk shift(s). Processing...`);

    // --- Process each shift through the dispatcher ---
    const results: CheckGuardStatusResult[] = [];

    for (const shift of atRiskShifts) {
      try {
        const result = await checkGuardStatus(shift.id);
        results.push(result);
        console.log(`[WATCHDOG] Shift ${shift.id}: ${result.action} — ${result.message}`);
      } catch (err) {
        console.error(`[WATCHDOG] Error processing shift ${shift.id}:`, err);
        results.push({
          action: "error",
          shiftId: shift.id,
          message: String(err),
        });
      }
    }

    // --- Summarise ---
    const summary = {
      total: results.length,
      welfare_sent: results.filter((r) => r.action === "welfare_sent").length,
      marked_at_risk: results.filter((r) => r.action === "marked_at_risk").length,
      ok: results.filter((r) => r.action === "ok").length,
      errors: results.filter((r) => r.action === "error").length,
    };

    console.log("[WATCHDOG] Run complete:", summary);

    return NextResponse.json({
      success: true,
      summary,
      results,
      processing_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[WATCHDOG] Fatal error:", error);
    return NextResponse.json(
      { error: "Watchdog check failed", details: String(error) },
      { status: 500 }
    );
  }
}
