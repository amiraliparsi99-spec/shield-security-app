"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSupabase, useUser } from "@/hooks";

type StripeStatus = {
  has_stripe_account: boolean;
  stripe_account_id?: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
};

type WalletData = {
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
};

type Transaction = {
  id: string;
  type: string;
  status: string;
  gross_amount: number;
  net_amount: number;
  platform_fee: number;
  description: string;
  created_at: string;
  booking_id: string | null;
  booking?: {
    event_name: string;
    event_date: string;
    venue?: {
      name: string;
    };
  };
};

export default function PaymentsPage() {
  const supabase = useSupabase();
  const { user, loading: userLoading } = useUser();
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Stripe status and wallet
  useEffect(() => {
    async function loadData() {
      if (userLoading || !user) return;

      try {
        // Check Stripe Connect status
        const statusRes = await fetch("/api/stripe/connect");
        const statusData = await statusRes.json();
        setStripeStatus(statusData);

        // Load wallet
        const { data: walletData } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (walletData) {
          setWallet(walletData);
        }

        // Load recent transactions with booking details
        console.log("Loading transactions for user:", user.id);
        
        const { data: txData, error: txError } = await supabase
          .from("transactions")
          .select(`
            *,
            booking:bookings(
              event_name,
              event_date,
              venue:venues(name)
            )
          `)
          .eq("payee_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        console.log("Transactions:", txData, "Error:", txError);
        setTransactions(txData || []);
      } catch (e) {
        console.error("Error loading payment data:", e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, userLoading, supabase]);

  // Connect Stripe account
  const connectStripe = async () => {
    setConnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start Stripe setup");
        setConnecting(false);
        return;
      }

      // Redirect to Stripe onboarding
      window.location.href = data.onboarding_url;
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setConnecting(false);
    }
  };

  // Open Stripe Dashboard
  const openDashboard = async () => {
    try {
      const res = await fetch("/api/stripe/connect/dashboard");
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (e) {
      console.error("Error opening dashboard:", e);
    }
  };

  const formatCurrency = (pence: number) => {
    return `£${(pence / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Payments</h1>
        <p className="text-zinc-400 mt-1">Manage your earnings and payouts</p>
      </div>

      {/* Stripe Connect Status */}
      {!stripeStatus?.onboarding_complete ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-6 mb-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">💳</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white mb-1">
                {stripeStatus?.has_stripe_account
                  ? "Complete Payment Setup"
                  : "Set Up Payments"}
              </h2>
              <p className="text-zinc-400 text-sm mb-4">
                {stripeStatus?.has_stripe_account
                  ? "Finish setting up your Stripe account to receive payments from venues."
                  : "Connect your bank account to receive payments when venues pay for your shifts. Powered by Stripe - secure and instant."}
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={connectStripe}
                disabled={connecting}
                className="bg-purple-500 hover:bg-purple-400 disabled:bg-zinc-600 text-white font-bold px-6 py-3 rounded-xl transition flex items-center gap-2"
              >
                {connecting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {stripeStatus?.has_stripe_account ? "Continue Setup" : "Connect with Stripe"}
                  </>
                )}
              </button>

              <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Bank-level security
                </span>
                <span>Instant payouts available</span>
                <span>No monthly fees</span>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Connected Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-lg">✅</span>
              </div>
              <div>
                <p className="text-white font-medium">Stripe Connected</p>
                <p className="text-xs text-zinc-400">Ready to receive payments</p>
              </div>
            </div>
            <button
              onClick={openDashboard}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition"
            >
              Open Dashboard
            </button>
          </motion.div>

          {/* Wallet */}
          {wallet && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 gap-4 mb-6"
            >
              <div className="bg-white/5 rounded-xl p-5">
                <p className="text-sm text-zinc-400 mb-1">Available</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {formatCurrency(wallet.available_balance)}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-5">
                <p className="text-sm text-zinc-400 mb-1">Pending</p>
                <p className="text-2xl font-bold text-amber-400">
                  {formatCurrency(wallet.pending_balance)}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-5">
                <p className="text-sm text-zinc-400 mb-1">Total Earned</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(wallet.total_earned)}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-5">
                <p className="text-sm text-zinc-400 mb-1">Withdrawn</p>
                <p className="text-2xl font-bold text-zinc-400">
                  {formatCurrency(wallet.total_withdrawn)}
                </p>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-bold text-white mb-4">Recent Transactions</h2>

        {transactions.length === 0 ? (
          <div className="bg-white/5 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">💰</div>
            <p className="text-zinc-400">No transactions yet</p>
            <p className="text-sm text-zinc-500 mt-1">
              Payments will appear here when venues pay for your shifts
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-white/5 rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        tx.type === "payment"
                          ? "bg-emerald-500/20"
                          : tx.type === "payout"
                          ? "bg-blue-500/20"
                          : "bg-red-500/20"
                      }`}
                    >
                      <span className="text-xl">
                        {tx.type === "payment" ? "💰" : tx.type === "payout" ? "🏦" : "↩️"}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {tx.booking?.event_name || tx.description || "Payment"}
                      </p>
                      {tx.booking?.venue?.name && (
                        <p className="text-sm text-zinc-400">
                          from {tx.booking.venue.name}
                        </p>
                      )}
                      <p className="text-xs text-zinc-500 mt-0.5">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${
                        tx.type === "payment"
                          ? "text-emerald-400"
                          : tx.type === "refund"
                          ? "text-red-400"
                          : "text-white"
                      }`}
                    >
                      {tx.type === "refund" ? "-" : "+"}
                      {formatCurrency(tx.net_amount)}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                        tx.status === "succeeded"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : tx.status === "pending"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {tx.status === "succeeded" && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {tx.status}
                    </span>
                  </div>
                </div>
                {tx.platform_fee > 0 && tx.status === "succeeded" && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs text-zinc-500">
                    <span>Gross: {formatCurrency(tx.gross_amount)}</span>
                    <span>Platform fee: {formatCurrency(tx.platform_fee)}</span>
                    <span className="text-emerald-400">You received: {formatCurrency(tx.net_amount)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
