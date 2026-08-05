"use client";

import { use } from "react";
import { BookingDetail } from "@/components/bookings/BookingDetail";

export default function AgencyBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <BookingDetail bookingId={id} basePath="/d/agency" />;
}
