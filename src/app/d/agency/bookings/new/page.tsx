import { redirect } from "next/navigation";

/**
 * Agencies do not use the venue pay-to-post flow — guard pay runs through
 * their own payroll. New work is scheduled onto the roster instead, so this
 * route exists only to catch old links and bookmarks.
 */
export default function AgencyNewBookingPage() {
  redirect("/d/agency/scheduler");
}
