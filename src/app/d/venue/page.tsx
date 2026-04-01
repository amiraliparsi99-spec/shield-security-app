import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";
import { VenueDashboardTabs } from "@/components/dashboard/VenueDashboardTabs";
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

  // Fetch personnel from Supabase
  let personnel: Personnel[] = [];
  const { data: personnelRows, error: personnelError } = await supabase
    .from("personnel")
    .select("*")
    .eq("is_active", true)
    .order("shield_score", { ascending: false })
    .limit(50);
  if (personnelError) {
    console.error("[VenueDashboard] Failed to load personnel:", personnelError.message);
  }
  if (personnelRows && personnelRows.length > 0) {
    personnel = personnelRows as Personnel[];
  }

  // Fetch agencies from Supabase
  let agencies: any[] = [];
  const { data: agencyRows, error: agenciesError } = await supabase
    .from("agencies")
    .select("*")
    .eq("is_active", true)
    .order("name")
    .limit(50);
  if (agenciesError) {
    console.error("[VenueDashboard] Failed to load agencies:", agenciesError.message);
  }
  if (agencyRows && agencyRows.length > 0) {
    agencies = agencyRows;
  }

  // Fetch bookings for this venue's venues (guests have none)
  let venueIds: string[] = [];
  if (session?.user?.id != null) {
    const { data: venueRows, error: venueIdsError } = await supabase
      .from("venues")
      .select("id")
      .eq("user_id", session.user.id);
    if (venueIdsError) {
      console.error("[VenueDashboard] Failed to resolve venue IDs:", venueIdsError.message);
    } else {
      venueIds = venueRows?.map((v) => v.id) ?? [];
    }
  }

  let bookings: EnrichedBooking[] = [];
  if (venueIds.length > 0) {
    const { data: bookingRows, error: bookingsError } = await supabase
      .from("bookings")
      .select("*")
      .in("venue_id", venueIds)
      .order("event_date", { ascending: false });
    if (bookingsError) {
      console.error("[VenueDashboard] Failed to load bookings:", bookingsError.message);
    }

    if (bookingRows && bookingRows.length > 0) {
      const personnelIds = [...new Set(bookingRows.filter((b) => b.provider_type === "personnel").map((b) => b.provider_id))];
      const agencyIds = [...new Set(bookingRows.filter((b) => b.provider_type === "agency").map((b) => b.provider_id))];

      const { data: personnelForBookings, error: personnelBookingsError } = personnelIds.length > 0
        ? await supabase.from("personnel").select("id, display_name").in("id", personnelIds)
        : { data: [], error: null };
      if (personnelBookingsError) {
        console.error("[VenueDashboard] Failed to load booking personnel:", personnelBookingsError.message);
      }
      const { data: agenciesForBookings, error: agenciesBookingsError } = agencyIds.length > 0
        ? await supabase.from("agencies").select("id, name").in("id", agencyIds)
        : { data: [], error: null };
      if (agenciesBookingsError) {
        console.error("[VenueDashboard] Failed to load booking agencies:", agenciesBookingsError.message);
      }

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
