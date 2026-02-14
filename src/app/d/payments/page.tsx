"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/stripe";
import type { Wallet, TransactionWithDetails, PayoutRequest, OnboardingStatus } from "@/types/payments";

interface WalletData {
  wallet: Wallet;
  transactions: TransactionWithDetails[];
  pending_payouts: PayoutRequest[];
  onboarding_status: OnboardingStatus;
}

export default function PaymentsDashboard() {
  const router = useRouter();
  const [data, setData] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<"instant" | "standard">("standard");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const res = await fetch("/api/wallet");
      if (!res.ok) throw new Error("Failed to fetch wallet");
      const data = await res.json();
      setData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startOnboarding = async () => {
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (data.onboarding_url) {
        window.location.href = data.onboarding_url;
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openStripeDashboard = async () => {
    try {
      const res = await fetch("/api/stripe/connect/dashboard");
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isWithdrawing) return;

    const amount = Math.round(parseFloat(withdrawAmount) * 100);
    if (amount < 1000) {
      alert("Minimum withdrawal is £10");
      return;
    }

    setIsWithdrawing(true);
    try {
      const res = await fetch("/api/stripe/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method: withdrawMethod }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setShowWithdrawModal(false);
      setWithdrawAmount("");
      fetchWallet();
      alert(`Withdrawal of ${formatCurrency(result.net_amount)} initiated!`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const getInstantFee = () => {
    const amount = Math.round(parseFloat(withdrawAmount || "0") * 100);
    const fee = Math.max(50, Math.round(amount * 0.01));
    return { fee, net: amount - fee };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const { wallet, transactions, pending_payouts, onboarding_status } = data!;

  // Show onboarding if not complete
  if (!onboarding_status.onboarding_complete) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">💳</div>
          <h1 className="text-2xl font-semibold text-white mb-2">Set Up Payments</h1>
          <p className="text-zinc-400 mb-6">
            Connect your bank account to receive payments from bookings.
          </p>

          {onboarding_status.has_stripe_account ? (
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-yellow-400 text-sm">
                Your account setup is incomplete. Please finish connecting your bank details.
              </div>
              <button
                onClick={startOnboarding}
                className="w-full bg-gradient-to-r from-shield-500 to-shield-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-shield-600 hover:to-shield-700 transition"
              >
                Continue Setup
              </button>
            </div>
          ) : (
            <button
              onClick={startOnboarding}
              className="w-full bg-gradient-to-r from-shield-500 to-shield-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-shield-600 hover:to-shield-700 transition"
            >
              Connect Bank Account
            </button>
          )}

          <p className="text-xs text-zinc-500 mt-4">
            Powered by Stripe. Your bank details are secure and encrypted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Payments</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage your earnings and withdrawals</p>
        </div>
        <button
          onClick={openStripeDashboard}
          className="text-sm text-shield-500 hover:text-shield-400 transition"
        >
          Open Stripe Dashboard →
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-6">
          <p className="text-zinc-400 text-sm">Available Balance</p>
          <p className="text-3xl font-semibold text-white mt-1">
            {formatCurrency(wallet.available_balance)}
          </p>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={wallet.available_balance < 1000}
            className="mt-4 w-full bg-shield-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-shield-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Withdraw
          </button>
        </div>

        <div className="glass rounded-xl p-6">
          <p className="text-zinc-400 text-sm">Pending Balance</p>
          <p className="text-3xl font-semibold text-yellow-500 mt-1">
            {formatCurrency(wallet.pending_balance)}
          </p>
          <p className="text-xs text-zinc-500 mt-4">
            Funds clearing (usually 2-7 days)
          </p>
        </div>

        <div className="glass rounded-xl p-6">
          <p className="text-zinc-400 text-sm">Total Earned</p>
          <p className="text-3xl font-semibold text-emerald-500 mt-1">
            {formatCurrency(wallet.total_earned)}
          </p>
          <p className="text-xs text-zinc-500 mt-4">
            Lifetime earnings
          </p>
        </div>
      </div>

      {/* Pending Payouts */}
      {pending_payouts.length > 0 && (
        <div className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Pending Withdrawals</h2>
          <div className="space-y-3">
            {pending_payouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">{formatCurrency(payout.net_amount)}</p>
                  <p className="text-xs text-zinc-400">
                    {payout.payout_method === "instant" ? "⚡ Instant" : "🏦 Standard"} • 
                    {payout.estimated_arrival && ` Est. ${new Date(payout.estimated_arrival).toLocaleDateString()}`}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                  {payout.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === "payment" ? "bg-emerald-500/20" :
                    tx.type === "payout" ? "bg-blue-500/20" :
                    "bg-red-500/20"
                  }`}>
                    {tx.type === "payment" ? "💰" : tx.type === "payout" ? "🏦" : "↩️"}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {tx.type === "payment" ? "Payment received" :
                       tx.type === "payout" ? "Withdrawal" :
                       "Refund"}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {new Date(tx.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${
                    tx.type === "payment" ? "text-emerald-500" :
                    tx.type === "payout" ? "text-blue-500" :
                    "text-red-500"
                  }`}>
                    {tx.type === "payment" ? "+" : "-"}{formatCurrency(tx.net_amount)}
                  </p>
                  <p className={`text-xs ${
                    tx.status === "succeeded" ? "text-emerald-400" :
                    tx.status === "pending" || tx.status === "processing" ? "text-yellow-400" :
                    "text-red-400"
                  }`}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Withdraw Funds</h2>
            
            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2">Amount (£)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                min="10"
                max={wallet.available_balance / 100}
                step="0.01"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-xl focus:border-shield-500 focus:outline-none"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Available: {formatCurrency(wallet.available_balance)} • Min: £10
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <label
                className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition ${
                  withdrawMethod === "standard"
                    ? "border-shield-500 bg-shield-500/10"
                    : "border-zinc-700 hover:border-zinc-600"
                }`}
                onClick={() => setWithdrawMethod("standard")}
              >
                <div>
                  <p className="text-white font-medium">🏦 Standard</p>
                  <p className="text-sm text-zinc-400">2-3 business days • Free</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">
                    {formatCurrency(Math.round(parseFloat(withdrawAmount || "0") * 100))}
                  </p>
                </div>
              </label>

              <label
                className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition ${
                  withdrawMethod === "instant"
                    ? "border-shield-500 bg-shield-500/10"
                    : "border-zinc-700 hover:border-zinc-600"
                }`}
                onClick={() => setWithdrawMethod("instant")}
              >
                <div>
                  <p className="text-white font-medium">⚡ Instant</p>
                  <p className="text-sm text-zinc-400">~30 minutes • 1% fee</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">
                    {formatCurrency(getInstantFee().net)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Fee: {formatCurrency(getInstantFee().fee)}
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 py-3 px-4 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) < 10}
                className="flex-1 bg-shield-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-shield-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWithdrawing ? "Processing..." : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
