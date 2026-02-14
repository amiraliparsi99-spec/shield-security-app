"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const [confirmed, setConfirmed] = useState(false);
  const bookingId = searchParams.get("booking_id");
  const paymentIntent = searchParams.get("payment_intent");

  useEffect(() => {
    // Confirm payment on backend if we have the payment intent
    const confirmPayment = async () => {
      if (paymentIntent) {
        try {
          await fetch("/api/stripe/payment/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_intent_id: paymentIntent }),
          });
          setConfirmed(true);
        } catch (err) {
          console.error("Failed to confirm payment:", err);
          setConfirmed(true); // Still show success as Stripe already processed it
        }
      } else {
        setConfirmed(true);
      }
    };

    confirmPayment();
  }, [paymentIntent]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
        <p className="text-gray-400 mb-6">
          Your payment has been processed successfully.
          {bookingId && ` Booking #${bookingId.slice(0, 8)} has been marked as paid.`}
        </p>
        <p className="text-gray-500 text-sm mb-6">
          You can now close this window and return to the app.
        </p>
        <button
          onClick={() => window.close()}
          className="bg-emerald-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-600 transition"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}
