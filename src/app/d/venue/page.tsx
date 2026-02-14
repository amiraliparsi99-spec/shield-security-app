import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";
import { VenueDashboardTabs } from "@/components/dashboard/VenueDashboardTabs";
import { AGENCIES, AVAILABLE_PERSONNEL } from "@/lib/dashboard-mock";
import type { EnrichedBooking } from "@/components/dashboard/VenueBookingsList";
import type { Personnel } from "@/types/database";

export default async function VenueDashboard() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const cookieStore = await cookies();
  const guestRole = cookieStore.get("shield_guest_role")?.value;

  const role = session ? await getProfileRole(supabase, session.user.id) : null;
  const allow = (session && role === "venue") || (!session && guestRole === "venue");
  if (!allow) redirect(role ? getRoleDashboardPath(role) : "/signup");

  // Fetch personnel: try Supabase, fallback to mock
  let personnel: Personnel[] = [...AVAILABLE_PERSONNEL];
  const { data: personnelRows } = await supabase
    .from("personnel")
    .select("*")
    .in("status", ["available", "looking"]);
  if (personnelRows && personnelRows.length > 0) {
    personnel = personnelRows as Personnel[];
  }

  // Fetch agencies: use mock (DB shape differs from Agency in dashboard-mock)
  const agencies = [...AGENCIES];

  // Fetch bookings for this venue's venues (guests have none)
  const venueIds =
    session?.user?.id != null
      ? (await supabase.from("venues").select("id").eq("owner_id", session.user.id)).data?.map((v) => v.id) ?? []
      : [];

  let bookings: EnrichedBooking[] = [];
  if (venueIds.length > 0) {
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("*")
      .in("venue_id", venueIds)
      .order("start", { ascending: false });

    if (bookingRows && bookingRows.length > 0) {
      const personnelIds = [...new Set(bookingRows.filter((b) => b.provider_type === "personnel").map((b) => b.provider_id))];
      const agencyIds = [...new Set(bookingRows.filter((b) => b.provider_type === "agency").map((b) => b.provider_id))];

      const { data: personnelForBookings } = personnelIds.length > 0
        ? await supabase.from("personnel").select("id, display_name").in("id", personnelIds)
        : { data: [] };
      const { data: agenciesForBookings } = agencyIds.length > 0
        ? await supabase.from("agencies").select("id, name").in("id", agencyIds)
        : { data: [] };

      const personnelMap = new Map((personnelForBookings ?? []).map((p) => [p.id, p.display_name]));
      const agenciesMap = new Map((agenciesForBookings ?? []).map((a) => [a.id, a.name]));

      bookings = bookingRows.map((b) => {
        const name = b.provider_type === "personnel"
          ? personnelMap.get(b.provider_id) ?? "Unknown"
          : agenciesMap.get(b.provider_id) ?? "Unknown";
        const href = b.provider_type === "personnel"
          ? `/personnel/${b.provider_id}`
          : `/agency/${b.provider_id}`;
        return { ...b, provider_name: name, provider_profile_href: href };
      }) as EnrichedBooking[];
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <header className="shrink-0 glass border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <h1 className="font-display text-xl font-semibold text-white">Your venue</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Browse available personnel and agencies, and manage your bookings.
        </p>
      </header>

      <VenueDashboardTabs
        personnel={personnel}
        agencies={agencies}
        bookings={bookings}
      />
    </div>
  );
}
