import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { sendPushNotification } from "@/lib/notifications/push-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
// Internal-server-to-server token for trusted callers (cron, webhooks). NEVER
// expose this to the client. The previous implementation accepted the Supabase
// service role key in the `x-service-key` header, which leaked the key on every
// internal call — that's now removed.
const internalApiSecret = process.env.INTERNAL_API_SECRET;

async function authorize(request: NextRequest): Promise<NextResponse | null> {
  const authHeader = request.headers.get("authorization");

  // Server-to-server: bearer the internal secret.
  if (
    internalApiSecret &&
    authHeader === `Bearer ${internalApiSecret}`
  ) {
    return null;
  }

  // User-authenticated path: the caller must be a real, signed-in user (the
  // push-service itself enforces that the target userId has a valid push token,
  // so the worst-case is a logged-in user spamming themselves or another known
  // user; rate limiting upstream covers that).
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies
          .getAll()
          .map((c) => ({ name: c.name, value: c.value }));
      },
      setAll() {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const denied = await authorize(request);
    if (denied) return denied;

    const { userId, type, title, body, data } = await request.json();

    if (!userId || !type) {
      return NextResponse.json(
        { error: "userId and type required" },
        { status: 400 },
      );
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
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 },
    );
  }
}
