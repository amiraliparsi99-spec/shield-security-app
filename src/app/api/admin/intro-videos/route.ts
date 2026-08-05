import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getAuthUser(request: NextRequest) {
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll() {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function isAdmin(userId: string) {
  const admin = getAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role")
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();
  return data?.role === "admin";
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isAdmin(user.id)))
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("personnel")
    .select("id, display_name, intro_video_playback_id, intro_video_uploaded_at, intro_video_status")
    .eq("intro_video_status", "pending")
    .order("intro_video_uploaded_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isAdmin(user.id)))
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { personnelId, action } = (await request.json()) as {
    personnelId?: string;
    action?: "approve" | "reject";
  };
  if (!personnelId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from("personnel")
    .update({
      intro_video_status: action === "approve" ? "approved" : "rejected",
      intro_video_reviewed_at: new Date().toISOString(),
    })
    .eq("id", personnelId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
