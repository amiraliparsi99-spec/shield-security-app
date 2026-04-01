/**
 * Notify Guards — Smart Matching API
 *
 * Called after a venue creates a booking with unassigned shifts.
 * Core logic: @/lib/notifications/notify-guards
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  notifyGuardsForBooking,
  DEFAULT_SEARCH_RADIUS_MILES,
} from "@/lib/notifications/notify-guards";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAuthUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await admin.auth.getUser(token);
    return data.user?.id ?? null;
  }
  try {
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const sb = await createServerClient();
    const {
      data: { session },
    } = await sb.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { booking_id, radius_miles } = body as {
      booking_id?: string;
      radius_miles?: number;
    };

    if (!booking_id || typeof booking_id !== "string") {
      return NextResponse.json({ error: "booking_id is required" }, { status: 400 });
    }

    const searchRadiusMiles = radius_miles ?? DEFAULT_SEARCH_RADIUS_MILES;

    const result = await notifyGuardsForBooking(booking_id, searchRadiusMiles);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error("[NOTIFY-GUARDS] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to notify guards";
    const isNotFound =
      /not found/i.test(message) || /Venue not found/i.test(message);
    return NextResponse.json(
      { error: message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
