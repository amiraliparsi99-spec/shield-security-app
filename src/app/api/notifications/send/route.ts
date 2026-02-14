import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushNotification, NotificationTemplates } from "@/lib/notifications/push-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Verify service key for internal calls or auth for user calls
    const authHeader = request.headers.get("authorization");
    const serviceKey = request.headers.get("x-service-key");

    if (serviceKey !== supabaseServiceKey && !authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, type, title, body, data } = await request.json();

    if (!userId || !type) {
      return NextResponse.json({ error: "userId and type required" }, { status: 400 });
    }

    const success = await sendPushNotification({
      userId,
      type,
      title: title || "Shield Notification",
      body: body || "",
      data,
    });

    return NextResponse.json({ success });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
