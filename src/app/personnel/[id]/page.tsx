import { createClient } from "@/lib/supabase/server";
import { PersonnelProfile } from "@/components/personnel/PersonnelProfile";
import { AddToPreferredButton } from "@/components/personnel/AddToPreferredButton";
import type { Personnel, PersonnelReviewWithAuthor } from "@/types/database";
import { AVAILABLE_PERSONNEL } from "@/lib/dashboard-mock";

async function getPersonnelWithReviews(
  id: string
): Promise<{
  personnel: Personnel;
  avatarUrl: string | null;
  reviews: PersonnelReviewWithAuthor[];
} | null> {
  // First try to fetch from Supabase
  const supabase = await createClient();
  
  const { data: personnelData, error } = await supabase
    .from("personnel")
    .select("*")
    .eq("id", id)
    .single();

  console.log("Personnel query for ID:", id, "Result:", personnelData, "Error:", error);

  if (personnelData && !error) {
    // Try to get profile avatar
    let avatarUrl = personnelData.profile_image_url || null;
    if (!avatarUrl && personnelData.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", personnelData.user_id)
        .single();
      avatarUrl = profile?.avatar_url || null;
    }
    
    // Try to fetch reviews (may not exist)
    let reviews: PersonnelReviewWithAuthor[] = [];
    try {
      const { data: reviewsData } = await supabase
        .from("personnel_reviews")
        .select("*")
        .eq("personnel_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      reviews = (reviewsData || []).map((r: any) => ({
        id: r.id,
        personnel_id: r.personnel_id,
        author_id: r.author_id,
        booking_id: r.booking_id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        author_name: "Venue Manager",
        venue_name: "Venue",
      }));
    } catch (e) {
      // Reviews table may not exist
      console.log("Could not fetch reviews:", e);
    }

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

    return {
      personnel,
      avatarUrl,
      reviews,
    };
  }

  // Fallback to mock data
  const fromDashboard = AVAILABLE_PERSONNEL.find((p) => p.id === id);
  if (fromDashboard) {
    const personnel: Personnel = { ...fromDashboard, created_at: "", updated_at: "" };
    const reviews: PersonnelReviewWithAuthor[] = [
      { id: "r1", personnel_id: id, author_id: "a1", booking_id: null, rating: 5, comment: "Professional and on time. Would book again.", created_at: "2025-01-10T12:00:00Z", author_name: "Venue manager", venue_name: "City Centre Club" },
      { id: "r2", personnel_id: id, author_id: "a2", booking_id: null, rating: 4, comment: "Reliable. Good with crowds.", created_at: "2024-12-28T12:00:00Z", author_name: "James K.", venue_name: "The Basement" },
    ];
    return { personnel, avatarUrl: null, reviews };
  }

  // Legacy /personnel/demo: Marcus Webb
  if (id === "demo") {
    const personnel: Personnel = {
      id: "p1",
      user_id: "user-demo",
      display_name: "Marcus Webb",
      bio: "SIA-licensed door supervisor with 8+ years across clubs, festivals, and corporate events. Reliable, calm under pressure, and used to working in high-volume, alcohol-serving venues.",
      certs: ["SIA Door Supervisor", "First Aid at Work", "CCTV (PSS)"],
      experience_years: 8,
      experience_since_year: 2016,
      rate_per_hour: 2850,
      currency: "GBP",
      city: "London",
      region: "Greater London",
      country: "UK",
      location_name: "Central London, UK",
      lat: 51.5074,
      lng: -0.1278,
      status: "available",
      insurance_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const reviews: PersonnelReviewWithAuthor[] = [
      {
        id: "rev-1",
        personnel_id: id,
        author_id: "author-1",
        booking_id: "book-1",
        rating: 5,
        comment: "Marcus was excellent. Professional, on time, and great with a busy crowd. We'll book him again.",
        created_at: "2025-01-15T10:00:00Z",
        author_name: "James K.",
        venue_name: "The Vault",
      },
      {
        id: "rev-2",
        personnel_id: id,
        author_id: "author-2",
        booking_id: "book-2",
        rating: 5,
        comment: "Really solid. Handled a tricky situation calmly and by the book. Highly recommend.",
        created_at: "2025-01-08T14:30:00Z",
        author_name: "Sarah M.",
        venue_name: "Echo Lounge",
      },
    ];

    return { personnel, avatarUrl: null, reviews };
  }
  
  return null;
}

export default async function PersonnelProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPersonnelWithReviews(id);
  
  if (!data) {
    // Show a simple fallback page instead of 404
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 -z-10">
          <div className="gradient-bg absolute inset-0" />
        </div>
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="glass rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">👤</div>
            <h1 className="text-2xl font-bold text-white mb-2">Security Professional</h1>
            <p className="text-zinc-400 mb-4">Profile ID: {id}</p>
            <p className="text-zinc-500 text-sm">
              This guard&apos;s full profile is not available yet.
            </p>
            <a href="/d/venue/bookings" className="inline-block mt-6 text-shield-400 hover:text-shield-300">
              ← Back to Bookings
            </a>
          </div>
        </main>
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

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <PersonnelProfile
          personnel={data.personnel}
          avatarUrl={data.avatarUrl}
          reviews={data.reviews}
          showMessageButton={false}
          headerAction={<AddToPreferredButton personnelId={id} />}
        />
      </main>
    </div>
  );
}
