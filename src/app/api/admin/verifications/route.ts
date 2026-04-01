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
  const { data: { user } } = await supabase.auth.getUser();
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

  // Ensure every personnel has a verifications row
  const { data: allPersonnel } = await admin.from("personnel").select("id");
  if (allPersonnel) {
    for (const p of allPersonnel) {
      await admin
        .from("verifications")
        .upsert(
          { owner_type: "personnel", owner_id: p.id, status: "pending" },
          { onConflict: "owner_id" }
        );
    }
  }

  const { data: verifications, error } = await admin
    .from("verifications")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const verificationsWithDocs = await Promise.all(
    (verifications || []).map(async (verification) => {
      const { data: documents } = await admin
        .from("verification_documents")
        .select("*")
        .eq("owner_type", verification.owner_type)
        .eq("owner_id", verification.owner_id);

      let guardName = "Unknown";
      let siaLicenseNumber: string | null = null;
      let siaExpiryDate: string | null = null;

      if (verification.owner_type === "personnel") {
        const { data: p } = await admin
          .from("personnel")
          .select("display_name, sia_license_number, sia_expiry_date")
          .eq("id", verification.owner_id)
          .single();
        guardName = p?.display_name || "Unknown";
        siaLicenseNumber = p?.sia_license_number ?? null;
        siaExpiryDate = p?.sia_expiry_date ?? null;
      } else if (verification.owner_type === "agency") {
        const { data: a } = await admin
          .from("agencies")
          .select("name")
          .eq("id", verification.owner_id)
          .single();
        guardName = a?.name || "Unknown";
      }

      let email: string | null = null;
      let avatarUrl: string | null = null;
      if (verification.owner_type === "personnel") {
        const { data: personnel } = await admin
          .from("personnel")
          .select("user_id")
          .eq("id", verification.owner_id)
          .single();
        if (personnel?.user_id) {
          const { data: profile } = await admin
            .from("profiles")
            .select("email, avatar_url")
            .or(`id.eq.${personnel.user_id},user_id.eq.${personnel.user_id}`)
            .maybeSingle();
          email = profile?.email ?? null;
          avatarUrl = profile?.avatar_url ?? null;
        }
      }

      return {
        ...verification,
        documents: documents || [],
        guardName,
        siaLicenseNumber,
        siaExpiryDate,
        email,
        avatarUrl,
      };
    })
  );

  const filtered = verificationsWithDocs.filter((v) => v.documents.length > 0);
  return NextResponse.json(filtered);
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isAdmin(user.id)))
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await request.json();
  const { action, documentId, verificationId, reason } = body;
  const admin = getAdminClient();

  if (action === "approve_document") {
    const { error } = await admin
      .from("verification_documents")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verified_by: user.id,
      })
      .eq("id", documentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (verificationId) {
      const { data: verification } = await admin
        .from("verifications")
        .select("owner_type, owner_id")
        .eq("id", verificationId)
        .single();

      if (verification) {
        const { data: docs } = await admin
          .from("verification_documents")
          .select("status")
          .eq("owner_type", verification.owner_type)
          .eq("owner_id", verification.owner_id);

        const allVerified = docs?.every((d) => d.status === "verified");
        if (allVerified && verification.owner_type === "personnel") {
          await admin
            .from("personnel")
            .update({
              sia_verified: true,
              right_to_work_verified: true,
            })
            .eq("id", verification.owner_id);
          await admin
            .from("verifications")
            .update({ status: "verified", verified_at: new Date().toISOString() })
            .eq("id", verificationId);
        }
      }
    }
    return NextResponse.json({ success: true });
  }

  if (action === "reject_document") {
    const { error } = await admin
      .from("verification_documents")
      .update({
        status: "rejected",
        rejection_reason: reason || "Rejected by admin",
        verified_at: new Date().toISOString(),
        verified_by: user.id,
      })
      .eq("id", documentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "approve_all") {
    const { data: verification } = await admin
      .from("verifications")
      .select("owner_type, owner_id")
      .eq("id", verificationId)
      .single();
    if (!verification) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await admin
      .from("verification_documents")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verified_by: user.id,
      })
      .eq("owner_type", verification.owner_type)
      .eq("owner_id", verification.owner_id);

    await admin
      .from("verifications")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .eq("id", verificationId);

    if (verification.owner_type === "personnel") {
      await admin
        .from("personnel")
        .update({ sia_verified: true, right_to_work_verified: true })
        .eq("id", verification.owner_id);
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
