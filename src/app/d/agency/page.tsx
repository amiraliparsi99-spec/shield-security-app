import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricsCard, QuickActionCard, ActivityItem, BookingListItem } from "@/components/agency";

async function getAgencyData(supabase: any, userId: string) {
  // Get agency directly using user_id
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!agency) return null;

  // Get staff count - use is_active boolean column
  const { count: staffCount } = await supabase
    .from("agency_staff")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agency.id)
    .eq("is_active", true);

  // Get upcoming bookings
  const now = new Date().toISOString();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: upcomingBookings, count: upcomingCount } = await supabase
    .from("bookings")
    .select(`
      id, start, end, guards_count, rate, currency, status,
      venue:venues(name, address)
    `, { count: "exact" })
    .eq("provider_type", "agency")
    .eq("provider_id", agency.id)
    .gte("start", now)
    .lte("start", nextWeek)
    .in("status", ["pending", "confirmed"])
    .order("start")
    .limit(5);

  // Get completed bookings this month for revenue
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: completedBookings } = await supabase
    .from("bookings")
    .select("rate, guards_count, start, end")
    .eq("provider_type", "agency")
    .eq("provider_id", agency.id)
    .eq("status", "completed")
    .gte("end", startOfMonth.toISOString());

  // Calculate monthly revenue
  let monthlyRevenue = 0;
  let hoursWorked = 0;
  
  if (completedBookings) {
    for (const booking of completedBookings) {
      const hours = (new Date(booking.end).getTime() - new Date(booking.start).getTime()) / (1000 * 60 * 60);
      monthlyRevenue += (booking.rate * hours * booking.guards_count);
      hoursWorked += hours * booking.guards_count;
    }
  }

  // Get staff IDs first, then count pending assignments
  const { data: staffIds } = await supabase
    .from("agency_staff")
    .select("id")
    .eq("agency_id", agency.id);

  const staffIdList = staffIds?.map((s: { id: string }) => s.id) || [];
  
  let pendingAssignments = 0;
  if (staffIdList.length > 0) {
    const { count } = await supabase
      .from("booking_assignments")
      .select("id", { count: "exact", head: true })
      .eq("status", "assigned")
      .in("agency_staff_id", staffIdList);
    pendingAssignments = count || 0;
  }

  return {
    agency,
    staffCount: staffCount || 0,
    upcomingBookings: upcomingBookings || [],
    upcomingCount: upcomingCount || 0,
    monthlyRevenue,
    hoursWorked: Math.round(hoursWorked),
    pendingAssignments: pendingAssignments || 0,
  };
}

export default async function AgencyOverview() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const data = session ? await getAgencyData(supabase, session.user.id) : null;

  // Guest mode or no data
  if (!data) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <header className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-white">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Welcome to your agency CRM. Get started by adding staff to your team.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricsCard
            title="Active Staff"
            value={0}
            subtitle="Add your first team member"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <MetricsCard
            title="Upcoming Shifts"
            value={0}
            subtitle="Next 7 days"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <MetricsCard
            title="Monthly Revenue"
            value="£0"
            subtitle="This month"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetricsCard
            title="Hours Worked"
            value={0}
            subtitle="This month"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        <div className="mt-8">
          <h2 className="mb-4 font-display text-lg font-medium text-white">Get Started</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickActionCard
              title="Add Staff"
              description="Invite security personnel to your team"
              href="/d/agency/staff/add"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              }
            />
            <QuickActionCard
              title="Browse Requests"
              description="Find open security requests from venues"
              href="/dashboard"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <QuickActionCard
              title="Update Profile"
              description="Complete your agency profile"
              href="/d/agency/settings"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  const { staffCount, upcomingBookings, upcomingCount, monthlyRevenue, hoursWorked, pendingAssignments } = data;

  return (
    <div className="px-4 py-6 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-white">Dashboard Overview</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Track your agency performance and manage operations.
        </p>
      </header>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/d/agency/staff">
          <MetricsCard
            title="Active Staff"
            value={staffCount}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
        </Link>
        <Link href="/d/agency/bookings">
          <MetricsCard
            title="Upcoming Shifts"
            value={upcomingCount}
            subtitle="Next 7 days"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
        </Link>
        <MetricsCard
          title="Monthly Revenue"
          value={`£${(monthlyRevenue / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`}
          subtitle="This month"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MetricsCard
          title="Hours Worked"
          value={hoursWorked}
          subtitle="This month"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="mb-4 font-display text-lg font-medium text-white">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="Add Staff"
            description="Invite new personnel to your team"
            href="/d/agency/staff/add"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            }
          />
          {pendingAssignments > 0 && (
            <QuickActionCard
              title="Pending Assignments"
              description={`${pendingAssignments} staff awaiting confirmation`}
              href="/d/agency/bookings"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          )}
          <QuickActionCard
            title="Browse Requests"
            description="Find open security requests"
            href="/dashboard"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Upcoming Bookings */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-white">Upcoming Bookings</h2>
          <Link
            href="/d/agency/bookings"
            className="text-sm text-shield-400 hover:text-shield-300"
          >
            View all
          </Link>
        </div>
        {upcomingBookings.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-4 text-sm text-zinc-400">No upcoming bookings</p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-shield-500/20 px-4 py-2 text-sm font-medium text-shield-300 transition hover:bg-shield-500/30"
            >
              Browse requests
            </Link>
          </div>
        ) : (
          <div className="glass divide-y divide-white/[0.06] rounded-xl">
            {upcomingBookings.map((booking: any) => (
              <BookingListItem key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="mb-4 font-display text-lg font-medium text-white">Recent Activity</h2>
        <div className="glass divide-y divide-white/[0.06] rounded-xl px-4">
          <ActivityItem
            type="staff"
            title="Welcome to your CRM"
            description="Start by adding staff to your team"
            time="Now"
          />
        </div>
      </div>
    </div>
  );
}
