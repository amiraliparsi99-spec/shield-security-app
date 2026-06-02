/**
 * Auto-Confirm Shifts Cron Job
 *
 * Runs periodically to auto-confirm shifts that:
 * - Are completed (checked_out)
 * - Not yet confirmed by venue
 * - Not disputed
 * - More than 48 hours since checkout
 *
 * Then processes Stripe transfers for pending guard_payout escrow rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { executeGuardPayoutTransfer } from "@/lib/shifts/guardPayoutRelease";
import { analyzeShiftAttendance } from "@/lib/shifts/attendanceAnalysis";
import { sendPushNotification } from "@/lib/notifications/push-service";
import { requireCronAuth } from "@/lib/auth/cronAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-01-28.clover" });

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const cutoffIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error: candidatesErr } = await supabase
      .from("shifts")
      .select("id, booking_id, personnel_id, actual_end, dispute_status, venue_confirmed")
      .eq("status", "checked_out")
      .eq("venue_confirmed", false)
      .or("dispute_status.is.null,dispute_status.eq.none")
      .lte("actual_end", cutoffIso)
      .limit(200);

    if (candidatesErr) {
      console.error("[AUTO-CONFIRM] Candidate query error:", candidatesErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    let count = 0;
    let flagged = 0;
    for (const shift of candidates ?? []) {
      const analysis = await analyzeShiftAttendance(supabase as any, shift.id);

      await supabase
        .from("shift_attendance_flags" as any)
        .upsert({
          shift_id: shift.id,
          booking_id: shift.booking_id,
          confidence: analysis.confidence,
          suspicious: analysis.suspicious,
          flag_codes: analysis.flags,
          summary: analysis.summary,
          created_at: new Date().toISOString(),
        }, { onConflict: "shift_id" } as any);

      if (analysis.suspicious) {
        flagged++;
        const { data: booking } = await supabase
          .from("bookings")
          .select("venue_id, event_name")
          .eq("id", shift.booking_id)
          .single();

        if (booking?.venue_id) {
          const { data: venue } = await supabase
            .from("venues")
            .select("user_id, owner_id, name")
            .eq("id", booking.venue_id)
            .single();

          const venueUserId =
            (venue as any)?.owner_id ??
            (venue as any)?.user_id ??
            null;

          if (venueUserId) {
            const title = "Attendance review required";
            const body =
              `We detected unusual attendance signals for "${booking.event_name}". ` +
              "Please confirm or dispute this shift manually.";

            await supabase.from("notifications").insert({
              user_id: venueUserId,
              type: "alert",
              title,
              body,
              data: {
                shift_id: shift.id,
                booking_id: shift.booking_id,
                action: "open_live_checkin",
                flags: analysis.flags,
                confidence: analysis.confidence,
              },
              is_read: false,
            } as any);

            await sendPushNotification({
              userId: venueUserId,
              type: "shift_reminder",
              title,
              body,
              data: {
                reminder_kind: "attendance_review_required",
                shift_id: shift.id,
                booking_id: shift.booking_id,
              },
            });
          }
        }

        await supabase
          .from("shifts")
          .update({
            dispute_status: "under_review",
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", shift.id);
        continue;
      }

      const confirmedAt = new Date().toISOString();
      await supabase
        .from("shifts")
        .update({
          venue_confirmed: true,
          venue_confirmed_at: confirmedAt,
          auto_confirmed: true,
          updated_at: confirmedAt,
        } as any)
        .eq("id", shift.id);

      const { data: payment } = await supabase
        .from("shift_payments")
        .select("id, personnel_net")
        .eq("shift_id", shift.id)
        .maybeSingle();

      if (payment?.id) {
        await supabase
          .from("shift_payments")
          .update({
            escrow_status: "confirmed",
            venue_confirmed_at: confirmedAt,
            updated_at: confirmedAt,
          } as any)
          .eq("id", payment.id);

        const { data: existingEscrow } = await supabase
          .from("escrow_transactions")
          .select("id")
          .eq("shift_id", shift.id)
          .eq("transaction_type", "guard_payout")
          .eq("status", "pending")
          .maybeSingle();

        if (!existingEscrow) {
          await supabase.from("escrow_transactions").insert({
            booking_id: shift.booking_id,
            shift_id: shift.id,
            shift_payment_id: payment.id,
            transaction_type: "guard_payout",
            amount: payment.personnel_net ?? 0,
            currency: "gbp",
            from_account: "escrow",
            to_account: "guard",
            status: "pending",
            notes: "Auto-confirm after 48h (attendance confidence checks passed)",
          } as any);
        }
      }
      count++;
    }

    console.log(`[AUTO-CONFIRM] Auto-confirmed ${count || 0} shifts`);

    const { data: pendingEscrows, error: escrowErr } = await supabase
      .from("escrow_transactions")
      .select("id, shift_id, amount, booking_id")
      .eq("transaction_type", "guard_payout")
      .eq("status", "pending")
      .limit(50);

    if (escrowErr) {
      console.error("[AUTO-CONFIRM] Escrow query error:", escrowErr);
    }

    let payoutsProcessed = 0;
    let payoutsFailed = 0;

    for (const escrow of pendingEscrows || []) {
      if (!escrow.shift_id) continue;

      const { data: shift } = await supabase
        .from("shifts")
        .select("personnel_id, booking_id")
        .eq("id", escrow.shift_id)
        .single();

      if (!shift?.personnel_id) continue;

      const { data: personnel } = await supabase
        .from("personnel")
        .select("user_id")
        .eq("id", shift.personnel_id)
        .single();

      if (!personnel?.user_id) continue;

      const { data: sp } = await supabase
        .from("shift_payments")
        .select("id, personnel_net")
        .eq("shift_id", escrow.shift_id)
        .maybeSingle();

      if (!sp?.id) continue;

      const result = await executeGuardPayoutTransfer({
        supabase,
        stripe,
        shiftId: escrow.shift_id,
        bookingId: escrow.booking_id,
        escrowTransactionId: escrow.id,
        personnelAuthUserId: personnel.user_id,
        payment: {
          id: sp.id,
          personnel_net: sp.personnel_net ?? escrow.amount ?? 0,
        },
      });

      if (result.ok) {
        if (personnel.user_id) {
          await supabase.from("notifications").insert({
            user_id: personnel.user_id,
            type: "payment",
            title: "💰 Payment Released!",
            body: `Your shift payment of £${((sp.personnel_net ?? escrow.amount ?? 0) / 100).toFixed(2)} has been auto-released.`,
            data: {
              shift_id: escrow.shift_id,
              amount: sp.personnel_net ?? escrow.amount,
              auto_confirmed: true,
            },
          });
        }
        payoutsProcessed++;
      } else if (!result.skipped) {
        console.error(
          `[AUTO-CONFIRM] Stripe error for escrow ${escrow.id}:`,
          result.error,
        );
        payoutsFailed++;
      }
    }

    return NextResponse.json({
      success: true,
      shifts_auto_confirmed: count || 0,
      shifts_flagged_for_review: flagged,
      payouts_processed: payoutsProcessed,
      payouts_failed: payoutsFailed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("[AUTO-CONFIRM] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
