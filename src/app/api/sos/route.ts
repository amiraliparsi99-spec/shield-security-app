/**
 * Lone-worker SOS. A guard raises a panic alert (POST); the venue + assigned
 * agency are notified with the guard's live location and it shows on Live
 * Check-In. Resolvable via PATCH once handled.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendPushNotification } from "@/lib/notifications/push-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (user && !error) return user;
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => cookieStore.get(n)?.value,
        set: (n: string, v: string, o: CookieOptions) => cookieStore.set({ name: n, value: v, ...o }),
        remove: (n: string, o: CookieOptions) => cookieStore.set({ name: n, value: "", ...o }),
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    shift_id?: string;
    latitude?: number;
    longitude?: number;
    note?: string;
  };

  const { data: personnel } = await supabaseAdmin
    .from("personnel")
    .select("id, display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!personnel) {
    return NextResponse.json({ error: "Only personnel can raise an SOS." }, { status: 403 });
  }

  // Resolve booking + venue from the shift, if provided.
  let bookingId: string | null = null;
  let venueId: string | null = null;
  let venueUserId: string | null = null;
  let agencyId: string | null = null;
  let eventName = "their shift";
  if (body.shift_id) {
    const { data: shift } = await supabaseAdmin
      .from("shifts")
      .select("booking_id, agency_id")
      .eq("id", body.shift_id)
      .maybeSingle();
    bookingId = (shift as { booking_id?: string } | null)?.booking_id ?? null;
    agencyId = (shift as { agency_id?: string | null } | null)?.agency_id ?? null;
    if (bookingId) {
      const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("venue_id, event_name")
        .eq("id", bookingId)
        .maybeSingle();
      venueId = (booking as { venue_id?: string } | null)?.venue_id ?? null;
      eventName = (booking as { event_name?: string } | null)?.event_name ?? eventName;
      if (venueId) {
        const { data: venue } = await supabaseAdmin
          .from("venues")
          .select("user_id")
          .eq("id", venueId)
          .maybeSingle();
        venueUserId = (venue as { user_id?: string } | null)?.user_id ?? null;
      }
    }
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("sos_alerts")
    .insert({
      personnel_id: personnel.id,
      shift_id: body.shift_id ?? null,
      booking_id: bookingId,
      venue_id: venueId,
      lat: typeof body.latitude === "number" ? body.latitude : null,
      lng: typeof body.longitude === "number" ? body.longitude : null,
      note: body.note ?? null,
      status: "active",
    } as never)
    .select("id")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const guardName = (personnel as { display_name?: string }).display_name || "A guard";
  const title = "🆘 SOS raised";
  const bodyText = `${guardName} has raised an SOS during "${eventName}". Open Live Check-In to see their location and respond.`;

  if (venueUserId) {
    await supabaseAdmin.from("notifications").insert({
      user_id: venueUserId,
      type: "shift",
      title,
      body: bodyText,
      data: {
        type: "sos",
        sos_id: (inserted as { id: string }).id,
        shift_id: body.shift_id ?? null,
        booking_id: bookingId,
        action: "open_live_checkin",
      },
      is_read: false,
    } as never);

    await sendPushNotification({
      userId: venueUserId,
      type: "shift_reminder",
      title,
      body: bodyText,
      data: { reminder_kind: "sos", sos_id: (inserted as { id: string }).id, booking_id: bookingId ?? "" },
    });
  }

  // Also alert the assigned agency so an SOS is never missed on their side.
  // Prefer the shift's agency_id; fall back to the guard's active agency.
  if (!agencyId) {
    const { data: staffLink } = await supabaseAdmin
      .from("agency_staff")
      .select("agency_id")
      .eq("personnel_id", personnel.id)
      .eq("is_active", true)
      .maybeSingle();
    agencyId = (staffLink as { agency_id?: string } | null)?.agency_id ?? null;
  }
  if (agencyId) {
    const { data: agency } = await supabaseAdmin
      .from("agencies")
      .select("user_id")
      .eq("id", agencyId)
      .maybeSingle();
    const agencyUserId = (agency as { user_id?: string } | null)?.user_id ?? null;
    // Don't double-notify if the agency owner is also the venue owner.
    if (agencyUserId && agencyUserId !== venueUserId) {
      await supabaseAdmin.from("notifications").insert({
        user_id: agencyUserId,
        type: "shift",
        title,
        body: bodyText,
        data: {
          type: "sos",
          sos_id: (inserted as { id: string }).id,
          shift_id: body.shift_id ?? null,
          booking_id: bookingId,
          action: "open_live_checkin",
        },
        is_read: false,
      } as never);

      await sendPushNotification({
        userId: agencyUserId,
        type: "shift_reminder",
        title,
        body: bodyText,
        data: { reminder_kind: "sos", sos_id: (inserted as { id: string }).id, booking_id: bookingId ?? "" },
      });
    }
  }

  // Mission Control line (best-effort).
  if (bookingId && venueUserId) {
    const { data: gc } = await supabaseAdmin
      .from("group_chats")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("chat_type", "mission_control")
      .eq("is_active", true)
      .maybeSingle();
    if (gc?.id) {
      await supabaseAdmin.from("group_chat_messages").insert({
        group_chat_id: gc.id,
        sender_id: venueUserId,
        content:
          `🆘 **${guardName} has raised an SOS**\n\n` +
          `Check their live location on Live Check-In and make contact immediately.`,
        message_type: "system",
        metadata: { type: "sos", sos_id: (inserted as { id: string }).id, booking_id: bookingId },
      } as never);
    }
  }

  return NextResponse.json({ success: true, id: (inserted as { id: string }).id });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Authorise: venue owner of the alert, or the guard who raised it.
  const { data: alert } = await supabaseAdmin
    .from("sos_alerts")
    .select("venue_id, personnel_id")
    .eq("id", id)
    .maybeSingle();
  if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let allowed = false;
  const a = alert as { venue_id: string | null; personnel_id: string | null };
  if (a.venue_id) {
    const { data: venue } = await supabaseAdmin
      .from("venues")
      .select("user_id")
      .eq("id", a.venue_id)
      .maybeSingle();
    if ((venue as { user_id?: string } | null)?.user_id === user.id) allowed = true;
  }
  if (!allowed && a.personnel_id) {
    const { data: p } = await supabaseAdmin
      .from("personnel")
      .select("user_id")
      .eq("id", a.personnel_id)
      .maybeSingle();
    if ((p as { user_id?: string } | null)?.user_id === user.id) allowed = true;
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("sos_alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user.id } as never)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
