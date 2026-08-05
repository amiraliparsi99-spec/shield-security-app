"use client";

import { use } from "react";
import { BookingDetail } from "@/components/bookings/BookingDetail";

export default function VenueBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <BookingDetail bookingId={id} basePath="/d/venue" />;
}
