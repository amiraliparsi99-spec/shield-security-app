"use client";

import { use } from "react";
import { BookingPayment } from "@/components/bookings/BookingPayment";

export default function VenuePaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <BookingPayment bookingId={id} basePath="/d/venue" />;
}
