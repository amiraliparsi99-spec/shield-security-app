import { createClient } from "@/lib/supabase/server";
import { AgencyAnalytics, StaffPerformanceTable } from "@/components/agency";

async function getAnalyticsData(supabase: any, userId: string) {
  // Get profile and agency
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!profile) return null;

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name")
    .eq("owner_id", profile.id)
    .single();

  if (!agency) return null;

  // Get this month's data
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfLastMonth = new Date(startOfMonth);
  startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

  // Get completed bookings this month
  const { data: thisMonthBookings } = await supabase
    .from("bookings")
    .select("rate, guards_count, start, end, status")
    .eq("provider_type", "agency")
    .eq("provider_id", agency.id)
    .gte("end", startOfMonth.toISOString());

  // Get completed bookings last month
  const { data: lastMonthBookings } = await supabase
    .from("bookings")
    .select("rate, guards_count, start, end")
    .eq("provider_type", "agency")
    .eq("provider_id", agency.id)
    .eq("status", "completed")
    .gte("end", startOfLastMonth.toISOString())
    .lt("end", startOfMonth.toISOString());

  // Calculate revenue
  const calcRevenue = (bookings: any[]) => {
    return (bookings || []).reduce((sum, b) => {
      const hours = (new Date(b.end).getTime() - new Date(b.start).getTime()) / (1000 * 60 * 60);
      return sum + (b.rate * hours * b.guards_count);
    }, 0);
  };

  const thisMonthRevenue = calcRevenue(thisMonthBookings?.filter((b: any) => b.status === "completed") || []);
  const lastMonthRevenue = calcRevenue(lastMonthBookings || []);
  const revenueTrend = lastMonthRevenue > 0 
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) 
    : 0;

  // Get staff
  const { data: staff, count: staffCount } = await supabase
    .from("agency_staff")
    .select("*", { count: "exact" })
    .eq("agency_id", agency.id)
    .eq("status", "active");

  // Count shifts
  const completedShifts = thisMonthBookings?.filter((b: any) => b.status === "completed").length || 0;
  const upcomingShifts = thisMonthBookings?.filter((b: any) => ["pending", "confirmed"].includes(b.status)).length || 0;
  const cancelledShifts = thisMonthBookings?.filter((b: any) => b.status === "cancelled").length || 0;

  // Get unique venues (clients)
  const { data: allBookings } = await supabase
    .from("bookings")
    .select("venue_id")
    .eq("provider_type", "agency")
    .eq("provider_id", agency.id);

  const uniqueVenues = new Set((allBookings || []).map((b: any) => b.venue_id));

  // Get new clients this month
  const { data: newClients } = await supabase
    .from("bookings")
    .select("venue_id, created_at")
    .eq("provider_type", "agency")
    .eq("provider_id", agency.id)
    .gte("created_at", startOfMonth.toISOString());

  // Staff for performance table
  const staffPerformance = (staff || []).map((s: any) => ({
    id: s.id,
    name: s.display_name || "Unknown",
    role: s.position || "Security",
    shifts: Math.floor(Math.random() * 15), // Demo data
    hours: Math.floor(Math.random() * 80), // Demo data
    rating: 4.5 + Math.random() * 0.5, // Demo data
    available: s.status === "active",
  }));

  return {
    analytics: {
      revenue: {
        thisMonth: thisMonthRevenue,
        lastMonth: lastMonthRevenue,
        trend: revenueTrend,
      },
      shifts: {
        completed: completedShifts,
        upcoming: upcomingShifts,
        cancelled: cancelledShifts,
      },
      staff: {
        total: staffCount || 0,
        available: staff?.filter((s: any) => s.status === "active").length || 0,
        utilization: staffCount ? Math.round((completedShifts / (staffCount * 20)) * 100) : 0,
      },
      clients: {
        total: uniqueVenues.size,
        newThisMonth: new Set((newClients || []).map((b: any) => b.venue_id)).size,
        repeatRate: uniqueVenues.size > 0 ? Math.round(((allBookings?.length || 0) / uniqueVenues.size) * 10) : 0,
      },
      ratings: {
        average: 4.7, // Demo
        total: completedShifts,
      },
    },
    staffPerformance,
  };
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const data = session ? await getAnalyticsData(supabase, session.user.id) : null;

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6">
      <AgencyAnalytics data={data?.analytics} />
      
      <div>
        <h2 className="mb-4 font-display text-lg font-medium text-white">Staff Performance</h2>
        <StaffPerformanceTable staff={data?.staffPerformance || []} />
      </div>
    </div>
  );
}
