/**
 * Shift Reminders Edge Function
 * 
 * Sends reminder notifications to personnel for upcoming shifts.
 * Should be triggered by a cron job (e.g., every hour).
 * 
 * Reminder schedule:
 * - 24 hours before shift: First reminder
 * - 2 hours before shift: Final reminder
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Shift {
  id: string;
  personnel_id: string;
  scheduled_start: string;
  role: string;
  hourly_rate: number;
  booking: {
    event_name: string;
    venue: {
      name: string;
      address_line1: string | null;
      city: string;
    };
  };
  personnel: {
    user_id: string;
    display_name: string;
  };
}

interface ReminderResult {
  shiftId: string;
  personnelId: string;
  reminderType: "24h" | "2h";
  success: boolean;
  error?: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Verify this is from our cron job (in production, add proper auth)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const results: ReminderResult[] = [];

    // Calculate time windows
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 1 * 60 * 60 * 1000);

    // Get shifts needing 24-hour reminder (23-24 hours from now)
    const { data: shifts24h, error: err24h } = await supabase
      .from("shifts")
      .select(`
        id,
        personnel_id,
        scheduled_start,
        role,
        hourly_rate,
        booking:bookings (
          event_name,
          venue:venues (
            name,
            address_line1,
            city
          )
        ),
        personnel (
          user_id,
          display_name
        )
      `)
      .eq("status", "accepted")
      .gte("scheduled_start", in23Hours.toISOString())
      .lt("scheduled_start", in24Hours.toISOString())
      .not("personnel_id", "is", null);

    if (err24h) {
      console.error("Error fetching 24h shifts:", err24h);
    }

    // Get shifts needing 2-hour reminder (1-2 hours from now)
    const { data: shifts2h, error: err2h } = await supabase
      .from("shifts")
      .select(`
        id,
        personnel_id,
        scheduled_start,
        role,
        hourly_rate,
        booking:bookings (
          event_name,
          venue:venues (
            name,
            address_line1,
            city
          )
        ),
        personnel (
          user_id,
          display_name
        )
      `)
      .eq("status", "accepted")
      .gte("scheduled_start", in1Hour.toISOString())
      .lt("scheduled_start", in2Hours.toISOString())
      .not("personnel_id", "is", null);

    if (err2h) {
      console.error("Error fetching 2h shifts:", err2h);
    }

    // Send 24-hour reminders
    for (const shift of (shifts24h as Shift[]) || []) {
      const result = await send24HourReminder(supabase, shift);
      results.push(result);
    }

    // Send 2-hour reminders
    for (const shift of (shifts2h as Shift[]) || []) {
      const result = await send2HourReminder(supabase, shift);
      results.push(result);
    }

    // Log summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Shift reminders sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.length,
          successful,
          failed,
        },
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Shift reminder error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

async function send24HourReminder(
  supabase: ReturnType<typeof createClient>,
  shift: Shift
): Promise<ReminderResult> {
  const result: ReminderResult = {
    shiftId: shift.id,
    personnelId: shift.personnel_id,
    reminderType: "24h",
    success: false,
  };

  try {
    const shiftDate = new Date(shift.scheduled_start);
    const formattedDate = shiftDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const formattedTime = shiftDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const venueName = shift.booking?.venue?.name || "Unknown Venue";
    const eventName = shift.booking?.event_name || "Shift";

    // Check if we've already sent this reminder
    const { data: existingReminder } = await supabase
      .from("notification_log")
      .select("id")
      .eq("related_id", shift.id)
      .eq("notification_type", "shift_reminder_24h")
      .limit(1)
      .maybeSingle();

    if (existingReminder) {
      result.success = true;
      result.error = "Already sent";
      return result;
    }

    // Create in-app notification
    await supabase.from("notifications").insert({
      user_id: shift.personnel.user_id,
      type: "shift",
      title: "📅 Shift Tomorrow",
      body: `Your shift at ${venueName} starts tomorrow at ${formattedTime}. Event: ${eventName}`,
      data: {
        shift_id: shift.id,
        type: "shift_reminder_24h",
        venue_name: venueName,
        start_time: shift.scheduled_start,
      },
    });

    // Log the reminder
    await supabase.from("notification_log").insert({
      user_id: shift.personnel.user_id,
      title: "Shift Tomorrow",
      body: `Reminder for shift at ${venueName}`,
      notification_type: "shift_reminder_24h",
      related_id: shift.id,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    result.success = true;
  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function send2HourReminder(
  supabase: ReturnType<typeof createClient>,
  shift: Shift
): Promise<ReminderResult> {
  const result: ReminderResult = {
    shiftId: shift.id,
    personnelId: shift.personnel_id,
    reminderType: "2h",
    success: false,
  };

  try {
    const shiftDate = new Date(shift.scheduled_start);
    const formattedTime = shiftDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const venueName = shift.booking?.venue?.name || "Unknown Venue";
    const venueAddress = shift.booking?.venue?.address_line1 || "";
    const venueCity = shift.booking?.venue?.city || "";
    const location = [venueAddress, venueCity].filter(Boolean).join(", ");

    // Check if we've already sent this reminder
    const { data: existingReminder } = await supabase
      .from("notification_log")
      .select("id")
      .eq("related_id", shift.id)
      .eq("notification_type", "shift_reminder_2h")
      .limit(1)
      .maybeSingle();

    if (existingReminder) {
      result.success = true;
      result.error = "Already sent";
      return result;
    }

    // Create in-app notification
    await supabase.from("notifications").insert({
      user_id: shift.personnel.user_id,
      type: "shift",
      title: "⏰ Shift Starting Soon",
      body: `Your shift at ${venueName} starts at ${formattedTime}. ${location ? `Location: ${location}` : ""}`,
      data: {
        shift_id: shift.id,
        type: "shift_reminder_2h",
        venue_name: venueName,
        start_time: shift.scheduled_start,
        priority: "high",
      },
    });

    // Log the reminder
    await supabase.from("notification_log").insert({
      user_id: shift.personnel.user_id,
      title: "Shift Starting Soon",
      body: `2-hour reminder for shift at ${venueName}`,
      notification_type: "shift_reminder_2h",
      related_id: shift.id,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    result.success = true;
  } catch (error) {
    result.error = error.message;
  }

  return result;
}
