import { redirect } from "next/navigation";

/**
 * Agencies never pay for bookings through platform escrow — guard pay runs
 * through their own payroll. Kept only so old links land on the booking
 * rather than a Stripe form.
 */
export default async function AgencyPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/d/agency/bookings/${id}`);
}
