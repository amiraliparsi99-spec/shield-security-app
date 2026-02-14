import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VerificationDashboard } from "@/components/verification/VerificationDashboard";

export default async function VerificationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's profile to determine role (handle both structures)
  let { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const { data: profileByUserId } = await supabase
      .from("profiles")
      .select("id, role, user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = profileByUserId;
  }

  if (!profile) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 -z-10">
          <div className="gradient-bg absolute inset-0" />
          <div className="mesh-gradient absolute inset-0 opacity-50" />
          <div className="grid-pattern absolute inset-0 opacity-20" />
        </div>
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-4">Verification</h1>
            <div className="glass rounded-xl p-6">
              <p className="text-zinc-400 mb-4">
                Profile not found. Please make sure you have completed your account setup.
              </p>
              <p className="text-sm text-zinc-500">
                If you just created your account, try refreshing the page or contact support.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const profileId = (profile as { user_id?: string; id: string }).user_id || profile.id;

  let ownerType: "personnel" | "agency" | null = null;
  let ownerId: string | null = null;

  if (profile.role === "personnel") {
    let { data: personnel } = await supabase
      .from("personnel")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!personnel) {
      const { data: personnelByProfileId } = await supabase
        .from("personnel")
        .select("id")
        .eq("user_id", profileId)
        .maybeSingle();
      personnel = personnelByProfileId;
    }

    if (!personnel) {
      let { data: newPersonnel, error: createError } = await supabase
        .from("personnel")
        .insert({
          user_id: profileId,
          display_name: user.email?.split("@")[0] || "Security Personnel",
          bio: null,
          city: null,
          region: null,
          country: "GB",
          status: "looking",
        })
        .select("id")
        .single();

      if (createError) {
        const { data: newPersonnelByUserId, error: createError2 } = await supabase
          .from("personnel")
          .insert({
            user_id: user.id,
            display_name: user.email?.split("@")[0] || "Security Personnel",
            bio: null,
            city: null,
            region: null,
            country: "GB",
            status: "looking",
          })
          .select("id")
          .single();
        
        if (!createError2 && newPersonnelByUserId) {
          newPersonnel = newPersonnelByUserId;
          createError = null;
        }
      }

      if (!createError && newPersonnel) {
        personnel = newPersonnel;
      }
    }

    if (personnel) {
      ownerType = "personnel";
      ownerId = personnel.id;
    }
  } else if (profile.role === "agency") {
    let { data: agency } = await supabase
      .from("agencies")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!agency) {
      const { data: agencyByProfileId } = await supabase
        .from("agencies")
        .select("id")
        .eq("owner_id", profileId)
        .maybeSingle();
      agency = agencyByProfileId;
    }

    if (!agency) {
      const slug = `agency-${user.id.substring(0, 8)}-${Date.now()}`;
      let { data: newAgency, error: createError } = await supabase
        .from("agencies")
        .insert({
          owner_id: profileId,
          name: user.email?.split("@")[0] || "Security Agency",
          slug: slug,
          description: null,
          city: null,
          region: null,
          country: "GB",
          status: "looking",
        })
        .select("id")
        .single();

      if (createError) {
        const slug2 = `agency-${user.id.substring(0, 8)}-${Date.now()}`;
        const { data: newAgencyByUserId, error: createError2 } = await supabase
          .from("agencies")
          .insert({
            owner_id: user.id,
            name: user.email?.split("@")[0] || "Security Agency",
            slug: slug2,
            description: null,
            city: null,
            region: null,
            country: "GB",
            status: "looking",
          })
          .select("id")
          .single();
        
        if (!createError2 && newAgencyByUserId) {
          newAgency = newAgencyByUserId;
          createError = null;
        }
      }

      if (!createError && newAgency) {
        agency = newAgency;
      }
    }

    if (agency) {
      ownerType = "agency";
      ownerId = agency.id;
    }
  }

  if (!ownerType || !ownerId) {
    if (profile.role !== "personnel" && profile.role !== "agency") {
      return (
        <div className="relative min-h-screen">
          <div className="fixed inset-0 -z-10">
            <div className="gradient-bg absolute inset-0" />
            <div className="mesh-gradient absolute inset-0 opacity-50" />
            <div className="grid-pattern absolute inset-0 opacity-20" />
          </div>
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl font-bold text-white mb-4">Verification</h1>
              <div className="glass rounded-xl p-6">
                <p className="text-zinc-400 mb-2">
                  Verification is only available for Security Personnel and Agency accounts.
                </p>
                <p className="text-sm text-zinc-500">
                  Your current role is: <strong className="text-zinc-400">{profile.role}</strong>. Please contact support if you need to change your account type.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 -z-10">
          <div className="gradient-bg absolute inset-0" />
          <div className="mesh-gradient absolute inset-0 opacity-50" />
          <div className="grid-pattern absolute inset-0 opacity-20" />
        </div>
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-4">Verification</h1>
            <div className="glass rounded-xl p-6">
              <p className="text-zinc-400 mb-2">
                Setting up your verification profile...
              </p>
              <p className="text-sm text-zinc-500">
                Please refresh the page. If the problem persists, the profile record may need to be created manually.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Verification</h1>
            <p className="text-zinc-400">
              Complete your verification to start accepting bookings. All documents are securely stored
              and reviewed by our team.
            </p>
          </div>
          <VerificationDashboard ownerType={ownerType} ownerId={ownerId} />
        </div>
      </div>
    </div>
  );
}
