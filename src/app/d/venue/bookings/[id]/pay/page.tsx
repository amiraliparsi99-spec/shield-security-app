"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useSupabase, useUser } from "@/hooks";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

type BookingDetails = {
  id: string;
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  estimated_total: number;
  staff_requirements: { role: string; quantity: number; rate: number }[];
  guards: { id: string; display_name: string; user_id: string }[];
};

// Inner checkout form (wrapped in Elements provider)
function CheckoutForm({
  booking,
  amount,
  onSuccess,
}: {
  booking: BookingDetails;
  amount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/d/venue/bookings/${booking.id}/pay?success=true`,
      },
    });

    if (submitError) {
      setError(submitError.message || "Payment failed");
      setProcessing(false);
    }
    // If successful, the page will redirect via return_url
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-600 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl text-lg transition"
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          `Pay £${(amount / 100).toFixed(2)}`
        )}
      </button>

      <p className="text-xs text-zinc-500 text-center">
        Secure payment powered by Stripe. Your card details are never stored on our servers.
      </p>
    </form>
  );
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useSupabase();
  const { user, loading: userLoading } = useUser();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for success redirect and update payment status
  useEffect(() => {
    const url = new URL(window.location.href);
    const paymentIntentId = url.searchParams.get("payment_intent");
    const redirectStatus = url.searchParams.get("redirect_status");
    
    if (url.searchParams.get("success") === "true" || paymentIntentId) {
      setSuccess(true);
      
      // Update transaction status to succeeded (fallback for local dev without webhooks)
      if (paymentIntentId && redirectStatus === "succeeded") {
        const updatePaymentStatus = async () => {
          try {
            await fetch("/api/stripe/payment/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payment_intent_id: paymentIntentId }),
            });
          } catch (e) {
            console.error("Failed to update payment status:", e);
          }
        };
        updatePaymentStatus();
      }
    }
  }, []);

  // Load booking details
  useEffect(() => {
    async function loadBooking() {
      if (userLoading || !user) return;

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (bookingError || !bookingData) {
        setError("Booking not found");
        setLoading(false);
        return;
      }

      // Get assigned guards
      const { data: shifts } = await supabase
        .from("shifts")
        .select("id, personnel_id, role, hourly_rate, scheduled_start, scheduled_end")
        .eq("booking_id", bookingId)
        .not("personnel_id", "is", null);

      let guards: any[] = [];
      if (shifts && shifts.length > 0) {
        const personnelIds = shifts.map((s) => s.personnel_id).filter(Boolean);
        if (personnelIds.length > 0) {
          const { data: personnelData } = await supabase
            .from("personnel")
            .select("id, display_name, user_id")
            .in("id", personnelIds);
          guards = personnelData || [];
        }
      }

      setBooking({
        ...bookingData,
        guards,
      });
      setLoading(false);
    }

    loadBooking();
  }, [user, userLoading, bookingId, supabase]);

  // Create payment intent
  const initiatePayment = async () => {
    if (!booking || !booking.guards.length) return;

    setError(null);

    // Calculate total amount in pence
    const hours = calculateHours(booking.start_time, booking.end_time);
    const totalPence = Math.round(booking.estimated_total * 100) || 
      booking.staff_requirements.reduce((total, req) => {
        return total + (req.rate * 100 * req.quantity * hours);
      }, 0);

    // Use the first guard's user_id as payee
    const payeeId = booking.guards[0]?.user_id;

    if (!payeeId) {
      setError("No guard assigned to pay");
      return;
    }

    try {
      const res = await fetch("/api/stripe/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: booking.id,
          amount: totalPence,
          payee_id: payeeId,
          description: `Security for ${booking.event_name} on ${new Date(booking.event_date).toLocaleDateString("en-GB")}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create payment");
        return;
      }

      setClientSecret(data.client_secret);
      setPaymentDetails(data);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    }
  };

  const calculateHours = (start: string, end: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let hours = eh - sh + (em - sm) / 60;
    if (hours <= 0) hours += 24; // overnight
    return hours;
  };

  // Success state
  if (success) {
    return (
      <div className="max-w-lg mx-auto p-6 pt-12">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
          <p className="text-zinc-400 mb-6">
            The guard has been paid for this booking. The funds will be available in their account shortly.
          </p>
          <button
            onClick={() => router.push("/d/venue/bookings")}
            className="bg-emerald-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-emerald-400 transition"
          >
            Back to Bookings
          </button>
        </motion.div>
      </div>
    );
  }

  // Loading state
  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Error state
  if (!booking) {
    return (
      <div className="max-w-lg mx-auto p-6 pt-12 text-center">
        <p className="text-red-400">{error || "Booking not found"}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-zinc-400 hover:text-white transition"
        >
          Go back
        </button>
      </div>
    );
  }

  const hours = calculateHours(booking.start_time, booking.end_time);
  const totalPence = Math.round(booking.estimated_total * 100) ||
    booking.staff_requirements.reduce((total, req) => {
      return total + (req.rate * 100 * req.quantity * hours);
    }, 0);
  const platformFee = Math.round(totalPence * 0.10);
  const guardReceives = totalPence - platformFee;

  return (
    <div className="max-w-lg mx-auto p-6 pt-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-zinc-400 hover:text-white transition mb-4 flex items-center gap-1"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white">Pay for Booking</h1>
        <p className="text-zinc-400 mt-1">Secure payment via Stripe</p>
      </div>

      {/* Booking Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 rounded-2xl p-6 mb-6"
      >
        <h2 className="font-bold text-white text-lg mb-1">{booking.event_name}</h2>
        <p className="text-zinc-400 text-sm">
          {new Date(booking.event_date).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <p className="text-zinc-400 text-sm">
          {booking.start_time} - {booking.end_time} ({hours.toFixed(1)} hours)
        </p>

        {/* Staff breakdown */}
        <div className="mt-4 space-y-2">
          {booking.staff_requirements.map((req, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-zinc-300">
                {req.quantity}x {req.role}
              </span>
              <span className="text-zinc-400">
                £{req.rate}/hr x {hours.toFixed(1)}h = £{(req.rate * req.quantity * hours).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Guards assigned */}
        {booking.guards.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-zinc-500 mb-2">ASSIGNED GUARDS</p>
            {booking.guards.map((g) => (
              <div key={g.id} className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-xs">🛡️</span>
                </div>
                <span className="text-sm text-white">{g.display_name}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Fee Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/5 rounded-2xl p-6 mb-6"
      >
        <h3 className="text-sm text-zinc-500 font-medium mb-3">PAYMENT BREAKDOWN</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-300">Subtotal</span>
            <span className="text-white font-medium">£{(totalPence / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400 text-sm">Platform fee (10%)</span>
            <span className="text-zinc-400 text-sm">£{(platformFee / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400 text-sm">Guard receives</span>
            <span className="text-emerald-400 text-sm">£{(guardReceives / 100).toFixed(2)}</span>
          </div>
          <div className="border-t border-white/10 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="text-white font-bold">Total to pay</span>
              <span className="text-emerald-400 font-bold text-xl">
                £{(totalPence / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm font-medium">{error}</p>
          {error.includes("payment setup") && (
            <p className="text-zinc-400 text-xs mt-2">
              The guard needs to connect their Stripe account before you can pay them. 
              Please ask them to go to their Payments page and complete the setup.
            </p>
          )}
        </div>
      )}

      {/* Payment Form or Initiate Button */}
      {clientSecret ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 rounded-2xl p-6"
        >
          <h3 className="text-sm text-zinc-500 font-medium mb-4">PAYMENT DETAILS</h3>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#10B981",
                  colorBackground: "#18181b",
                  colorText: "#ffffff",
                  colorDanger: "#ef4444",
                  borderRadius: "12px",
                  fontFamily: "system-ui, sans-serif",
                },
              },
            }}
          >
            <CheckoutForm
              booking={booking}
              amount={totalPence}
              onSuccess={() => setSuccess(true)}
            />
          </Elements>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={initiatePayment}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl text-lg transition"
          >
            Proceed to Payment
          </button>
          <p className="text-xs text-zinc-500 text-center mt-3">
            You will be charged £{(totalPence / 100).toFixed(2)} via Stripe
          </p>
        </motion.div>
      )}
    </div>
  );
}
