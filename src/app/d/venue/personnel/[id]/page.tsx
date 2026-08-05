import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PersonnelProfile } from "@/components/personnel/PersonnelProfile";
import type { Personnel, PersonnelReviewWithAuthor } from "@/types/database";

async function getVenuePersonnelWithReviews(
  id: string,
): Promise<{
  personnel: Personnel;
  avatarUrl: string | null;
  reviews: PersonnelReviewWithAuthor[];
} | null> {
  const supabase = await createClient();

  const { data: personnelData, error } = await supabase
    .from("personnel")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !personnelData) return null;

  let avatarUrl = personnelData.profile_image_url || null;
  if (!avatarUrl && personnelData.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", personnelData.user_id)
      .maybeSingle();
    avatarUrl = profile?.avatar_url || null;
  }

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, reviewer_id, reviewee_id, overall_rating, content, created_at, booking_id")
    .eq("reviewee_id", id)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  const reviewerIds = (reviewRows || []).map((r: any) => r.reviewer_id).filter(Boolean);
  let profilesById: Record<string, { display_name: string | null }> = {};
  if (reviewerIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", reviewerIds);
    (profileRows || []).forEach((p: any) => {
      profilesById[p.id] = { display_name: p.display_name };
    });
  }

  const reviews: PersonnelReviewWithAuthor[] = (reviewRows || []).map((r: any) => ({
    id: r.id,
    personnel_id: id,
    author_id: r.reviewer_id,
    booking_id: r.booking_id || null,
    rating: Number(r.overall_rating || 0),
    comment: r.content || "",
    created_at: r.created_at,
    author_name: profilesById[r.reviewer_id]?.display_name || "Venue",
    venue_name: undefined,
  }));

  const personnel: Personnel = {
    id: personnelData.id,
    user_id: personnelData.user_id,
    display_name: personnelData.display_name || personnelData.full_name || "Security Professional",
    bio: personnelData.bio || "Experienced security professional.",
    certs: personnelData.certifications || personnelData.skills || [],
    experience_years: personnelData.experience_years || 0,
    experience_since_year: personnelData.experience_since_year,
    rate_per_hour: personnelData.hourly_rate ? personnelData.hourly_rate * 100 : 2000,
    currency: "GBP",
    city: personnelData.city || "Unknown",
    region: personnelData.region,
    country: personnelData.country || "UK",
    location_name: personnelData.city || "Unknown Location",
    lat: personnelData.lat || personnelData.latitude,
    lng: personnelData.lng || personnelData.longitude,
    status: personnelData.status || "available",
    insurance_verified: personnelData.insurance_verified || false,
    created_at: personnelData.created_at,
    updated_at: personnelData.updated_at,
    shield_score: personnelData.shield_score,
    total_shifts: personnelData.total_shifts,
    intro_video_status: personnelData.intro_video_status ?? undefined,
    intro_video_playback_id: personnelData.intro_video_playback_id ?? null,
  };

  return { personnel, avatarUrl, reviews };
}

export default async function VenuePersonnelProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getVenuePersonnelWithReviews(id);

  if (!data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="glass rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Security Professional</h1>
          <p className="text-zinc-500 text-sm mb-6">This profile is not available right now.</p>
          <Link href="/d/venue/ratings" className="text-shield-400 hover:text-shield-300">
            Back to Staff Ratings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4">
        <Link href="/d/venue/ratings" className="text-sm text-zinc-400 hover:text-white transition">
          ← Back to Staff Ratings
        </Link>
      </div>
      <PersonnelProfile personnel={data.personnel} avatarUrl={data.avatarUrl} reviews={data.reviews} showMessageButton={false} />
    </div>
  );
}
