import { notFound } from "next/navigation";
import { PersonnelProfile } from "@/components/personnel/PersonnelProfile";
import type { Personnel, PersonnelReviewWithAuthor } from "@/types/database";
import { AVAILABLE_PERSONNEL } from "@/lib/dashboard-mock";

// Demo data until Supabase is wired.
async function getPersonnelWithReviews(
  id: string
): Promise<{
  personnel: Personnel;
  avatarUrl: string | null;
  reviews: PersonnelReviewWithAuthor[];
} | null> {
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
      {
        id: "rev-3",
        personnel_id: id,
        author_id: "author-3",
        booking_id: null,
        rating: 4,
        comment: "Good experience. Would have given 5 if he'd been able to stay a bit later, but that was our change last minute.",
        created_at: "2024-12-20T09:00:00Z",
        author_name: "David L.",
        venue_name: "The Basement",
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
  if (!data) notFound();

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
        />
      </main>
    </div>
  );
}
