import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function requireAdminUser(
  request: NextRequest,
): Promise<{ userId: string } | NextResponse> {
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

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { userId: user.id };
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdminUser(request);
    if (guard instanceof NextResponse) return guard;

    const { verification_id, status, identity_verified } = await request.json();

    if (!verification_id || !status) {
      return NextResponse.json(
        { error: "verification_id and status are required" },
        { status: 400 },
      );
    }

    if (!["pending", "submitted", "verified", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 },
      );
    }

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (identity_verified !== undefined) {
      updateData.identity_verified = identity_verified;
    }

    const { data, error } = await supabaseAdmin
      .from("verifications")
      .update(updateData)
      .eq("id", verification_id)
      .select()
      .single();

    if (error) {
      console.error("[Verify Status] Update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, verification: data });
  } catch (error: any) {
    console.error("[Verify Status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
